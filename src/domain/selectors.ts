import type {
  AppSettings,
  Audit,
  Category,
  Condition,
  DownstreamTask,
  DownstreamTaskType,
  EvidencePassage,
  ExportRecord,
  PatientReview,
  Recommendation,
  RuleResult,
  SeedData,
  SourceDocument,
  UpcomingAppointment,
  User
} from "./types";
import { decisionSupportService } from "../decisionSupport/DecisionSupportService";
import {
  canManageLocks as userCanManageLocks,
  canMutateReview,
  getVisibleReviews,
  isAssignedToReview
} from "./auth";

export function byId<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export function getCurrentUser(data: SeedData, userId: string) {
  return data.users.find((user) => user.id === userId) ?? data.users[0];
}

export function canManageLocks(user: User) {
  return userCanManageLocks(user);
}

export function canEditReview(review: PatientReview, user: User) {
  return canMutateReview(review, user);
}

export function isAssignedToUser(review: PatientReview, user: User) {
  return isAssignedToReview(review, user);
}

export function reviewConditions(data: SeedData, review: PatientReview) {
  const conditionMap = byId(data.conditions);
  return review.conditionIds.map((id) => conditionMap.get(id)).filter(Boolean) as Condition[];
}

export function reviewEvidence(data: SeedData, review: PatientReview) {
  return data.evidence.filter((item) => item.reviewId === review.id);
}

export function getPatientReviews(data: SeedData, patientId: string) {
  return data.reviews.filter((review) => review.patientId === patientId);
}

export function getPatientCalendarYearReviews(data: SeedData, patientId: string, calendarYear: number) {
  return getPatientReviews(data, patientId).filter((review) => review.calendarYear === calendarYear);
}

export function getPatientCalendarYearConditions(data: SeedData, patientId: string, calendarYear: number) {
  const reviewIds = new Set(getPatientCalendarYearReviews(data, patientId, calendarYear).map((review) => review.id));
  return data.conditions.filter((condition) => reviewIds.has(condition.reviewId));
}

export function getPatientCalendarYearHccGroup(data: SeedData, patientId: string, calendarYear: number, hcc: string) {
  return getPatientCalendarYearConditions(data, patientId, calendarYear).filter((condition) => condition.hcc === hcc);
}

export function getSameHccCandidates(data: SeedData, review: PatientReview, condition: Condition) {
  return getPatientCalendarYearHccGroup(data, review.patientId, review.calendarYear, condition.hcc);
}

export function getRecommendation(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): Recommendation | undefined {
  return decisionSupportService.getRecommendation(condition, review, data, settings);
}

export function getRuleResult(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): RuleResult {
  return decisionSupportService.evaluateRules(condition, review, data, settings);
}

export function getUnresolvedConditions(data: SeedData, review: PatientReview) {
  return reviewConditions(data, review).filter((condition) => condition.actionable && !condition.disposition && !condition.ruleOutcome);
}

export function getPresentedOpportunitySummary(data: SeedData, review: PatientReview) {
  const conditions = reviewConditions(data, review);
  const initial: Record<Category, { count: number; raf: number }> = {
    validated: { count: 0, raf: 0 },
    potentialDelete: { count: 0, raf: 0 },
    potentialAddition: { count: 0, raf: 0 },
    prospective: { count: 0, raf: 0 }
  };
  return conditions.reduce((summary, condition) => {
    const category = condition.originalCategory ?? condition.category;
    summary[category].count += 1;
    summary[category].raf += condition.raf;
    return summary;
  }, initial);
}

export const dispositionLabels = [
  "Validated",
  "Deleted",
  "Added to Claim",
  "Sent to Prospective",
  "Prospective Yes",
  "Prospective No",
  "Changed",
  "Rule Suppressed",
  "Unresolved"
] as const;

export type DispositionSummaryLabel = (typeof dispositionLabels)[number];

export function getDispositionSummary(data: SeedData, review: PatientReview) {
  const initial = Object.fromEntries(dispositionLabels.map((label) => [label, { count: 0, raf: 0 }])) as Record<
    DispositionSummaryLabel,
    { count: number; raf: number }
  >;
  reviewConditions(data, review).forEach((condition) => {
    const label = getDispositionSummaryLabel(condition);
    initial[label].count += 1;
    initial[label].raf += condition.raf;
  });
  return initial;
}

export function getDispositionSummaryLabel(condition: Condition): DispositionSummaryLabel {
  if (!condition.disposition && condition.ruleOutcome) {
    if (condition.ruleOutcome.source === "rule-suppressed") return "Rule Suppressed";
    if (condition.ruleOutcome.action === "Validate") return "Validated";
    if (condition.ruleOutcome.action === "Add to Claim") return "Added to Claim";
  }
  switch (condition.disposition?.action) {
    case "Validate":
      return "Validated";
    case "Delete":
      return "Deleted";
    case "Add to Claim":
      return "Added to Claim";
    case "Send to Prospective":
    case "Disagree":
      if (condition.disposition.action === "Disagree" && condition.disposition.reason === "Condition Resolved") return "Unresolved";
      return "Sent to Prospective";
    case "Yes":
      return "Prospective Yes";
    case "No":
      return "Prospective No";
    case "Change":
      return "Changed";
    default:
      return "Unresolved";
  }
}

export function getDownstreamTaskForCondition(data: SeedData, conditionId: string): DownstreamTask | undefined {
  return data.downstreamTasks.find((task) => task.conditionId === conditionId && task.status !== "Cancelled");
}

export function getDownstreamTasksForCondition(data: SeedData, conditionId: string): DownstreamTask[] {
  return data.downstreamTasks.filter((task) => task.conditionId === conditionId && task.status !== "Cancelled");
}

export function getRafSummary(data: SeedData, review: PatientReview) {
  const patient = data.patients.find((item) => item.id === review.patientId);
  const conditions = reviewConditions(data, review);
  const patientYearConditions = patient ? getPatientCalendarYearConditions(data, patient.id, review.calendarYear) : conditions;
  const selectedCapturedActions = new Set(["Validate", "Add to Claim", "Yes", "Change"]);
  const demographicRaf = patient?.demographicRaf ?? 0;
  // Synthetic only: completed capture actions are counted once as current captured RAF.
  const capturedByHcc = new Map<string, number>();
  patientYearConditions
    .filter(
      (condition) =>
        (condition.disposition && selectedCapturedActions.has(condition.disposition.action)) ||
        (condition.ruleOutcome?.source === "rule-resolved" && condition.ruleOutcome.action && selectedCapturedActions.has(condition.ruleOutcome.action))
    )
    .forEach((condition) => {
      capturedByHcc.set(condition.hcc, Math.max(capturedByHcc.get(condition.hcc) ?? 0, condition.raf));
    });
  const validatedCapturedRaf = Array.from(capturedByHcc.values()).reduce((sum, raf) => sum + raf, 0);
  // Synthetic only: unresolved potential excludes prospective recapture/suspect so open RAF and prospective RAF do not overlap.
  const unresolvedPotentialRaf = conditions
    .filter(
      (condition) =>
        condition.actionable && !condition.disposition && !condition.ruleOutcome && ["potentialDelete", "potentialAddition"].includes(condition.originalCategory ?? condition.category)
    )
    .reduce((sum, condition) => sum + condition.raf, 0);
  // Synthetic only: potential additions are open, uncaptured opportunities and are not counted in current captured RAF.
  const potentialAdditionRaf = conditions
    .filter((condition) => condition.actionable && !condition.disposition && !condition.ruleOutcome && (condition.originalCategory ?? condition.category) === "potentialAddition")
    .reduce((sum, condition) => sum + condition.raf, 0);
  // Synthetic only: potential deletions are displayed separately as possible negative adjustment, not double-subtracted from projection.
  const potentialDeletionRaf = conditions
    .filter((condition) => condition.actionable && !condition.disposition && !condition.ruleOutcome && (condition.originalCategory ?? condition.category) === "potentialDelete")
    .reduce((sum, condition) => sum + condition.raf, 0);
  // Synthetic only: recapture and suspect are separate prospective buckets and are excluded from unresolved potential RAF.
  const prospectiveRecaptureRaf = conditions
    .filter((condition) => condition.actionable && !condition.disposition && !condition.ruleOutcome && condition.subtype === "recapture")
    .reduce((sum, condition) => sum + condition.raf, 0);
  const prospectiveSuspectRaf = conditions
    .filter((condition) => condition.actionable && !condition.disposition && !condition.ruleOutcome && condition.subtype === "suspect")
    .reduce((sum, condition) => sum + condition.raf, 0);
  const selectedDeletionRaf = conditions.filter((condition) => condition.disposition?.action === "Delete").reduce((sum, condition) => sum + condition.raf, 0);
  // Synthetic only: projected RAF after selected dispositions includes demographic RAF plus selected captures and subtracts selected deletions.
  const projectedRaf = demographicRaf + validatedCapturedRaf - selectedDeletionRaf;

  return {
    demographicRaf,
    validatedCapturedRaf,
    unresolvedPotentialRaf,
    potentialAdditionRaf,
    potentialDeletionRaf,
    prospectiveRecaptureRaf,
    prospectiveSuspectRaf,
    selectedDeletionRaf,
    projectedRaf,
    // Backward-compatible aliases for older UI text.
    openRaf: unresolvedPotentialRaf,
    closedRaf: validatedCapturedRaf,
    deletionRaf: selectedDeletionRaf,
    prospectiveRaf: prospectiveRecaptureRaf + prospectiveSuspectRaf,
    totalRaf: projectedRaf
  };
}

export function getPopulationRafSummary(data: SeedData, reviews: PatientReview[] = data.reviews) {
  const patientIds = new Set(reviews.map((review) => review.patientId));
  const demographicRaf = data.patients.filter((patient) => patientIds.has(patient.id)).reduce((sum, patient) => sum + patient.demographicRaf, 0);
  const reviewSummaries = reviews.map((review) => getRafSummary(data, review));
  const capturedRaf = reviewSummaries.reduce((sum, summary) => sum + summary.validatedCapturedRaf, 0);
  const openRaf = reviewSummaries.reduce((sum, summary) => sum + summary.unresolvedPotentialRaf, 0);
  const prospectiveRaf = reviewSummaries.reduce((sum, summary) => sum + summary.prospectiveRaf, 0);
  const deletionRaf = reviewSummaries.reduce((sum, summary) => sum + summary.selectedDeletionRaf, 0);
  const projectedRaf = demographicRaf + capturedRaf - deletionRaf;
  const patientCount = patientIds.size;

  function average(value: number) {
    return patientCount ? value / patientCount : 0;
  }

  return {
    patientCount,
    reviewCount: reviews.length,
    totals: {
      demographicRaf,
      capturedRaf,
      openRaf,
      prospectiveRaf,
      deletionRaf,
      projectedRaf
    },
    averages: {
      demographicRaf: average(demographicRaf),
      capturedRaf: average(capturedRaf),
      openRaf: average(openRaf),
      prospectiveRaf: average(prospectiveRaf),
      deletionRaf: average(deletionRaf),
      projectedRaf: average(projectedRaf)
    }
  };
}

export function getProspectiveCounts(data: SeedData, review: PatientReview) {
  const conditions = reviewConditions(data, review);
  return {
    recapture: conditions.filter((condition) => condition.subtype === "recapture").length,
    suspect: conditions.filter((condition) => condition.subtype === "suspect").length
  };
}

export function getEvidenceForCondition(data: SeedData, condition: Condition): EvidencePassage[] {
  const evidenceMap = byId(data.evidence);
  return condition.evidenceIds.map((id) => evidenceMap.get(id)).filter(Boolean) as EvidencePassage[];
}

export function getAuditForReview(data: SeedData, reviewId: string): Audit | undefined {
  return data.audits.find((audit) => audit.reviewId === reviewId);
}

export function getAuditSamplingProfile(data: SeedData, review: PatientReview, auditSampleRate: number) {
  const rate = Math.max(0, Math.min(100, Number.isFinite(auditSampleRate) ? auditSampleRate : 0));
  const bucket = deterministicAuditBucket(review.id);
  const categories = Array.from(new Set(reviewConditions(data, review).map((condition) => condition.originalCategory ?? condition.category))).sort((a, b) => a.localeCompare(b));
  return {
    eligible: review.status === "Completed" || review.status === "Audit Complete",
    sampled: rate >= 100 || (rate > 0 && bucket < rate),
    sampleRate: rate,
    sampleBucket: bucket,
    sampleCategories: categories
  };
}

function deterministicAuditBucket(reviewId: string) {
  let hash = 0;
  for (const char of reviewId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 10000;
  }
  return hash % 100;
}

export function getClaimForReview(data: SeedData, reviewId: string) {
  return data.claims.find((claim) => claim.reviewId === reviewId);
}

export function isPrototypeCurrentYear(review: PatientReview, settings: AppSettings) {
  return review.calendarYear === settings.prototypeCurrentYear;
}

export function getUpcomingAppointmentsForReview(data: SeedData, review: PatientReview): UpcomingAppointment[] {
  const yearStart = `${review.calendarYear}-01-01`;
  const yearEnd = `${review.calendarYear}-12-31`;
  return data.appointments
    .filter((appointment) => appointment.patientId === review.patientId && appointment.date >= yearStart && appointment.date <= yearEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getSchedulingOutreachTaskForReview(data: SeedData, review: PatientReview): DownstreamTask | undefined {
  return data.downstreamTasks.find((task) => task.reviewId === review.id && task.type === "Scheduling Outreach" && task.status !== "Cancelled");
}

export function getOutreachStatusForReview(data: SeedData, review: PatientReview) {
  const appointment = getUpcomingAppointmentsForReview(data, review)[0];
  const task = getSchedulingOutreachTaskForReview(data, review);
  const hasProspectiveNeed =
    review.reviewType === "Prospective" ||
    data.downstreamTasks.some((item) => item.reviewId === review.id && item.type === "Prospective CDI Review" && item.status !== "Cancelled") ||
    reviewConditions(data, review).some((condition) => {
      if (!condition.actionable || condition.ruleOutcome?.source === "rule-suppressed") return false;
      if (condition.workflow === "prospective" && !condition.disposition) return true;
      return ["Send to Prospective", "Yes", "Change"].includes(condition.disposition?.action ?? "");
    });

  if (appointment) {
    return {
      status: "Scheduled" as const,
      label: "Scheduled",
      reason: "Same-patient appointment exists in the prototype schedule for this calendar year.",
      appointment,
      task
    };
  }
  if (task) {
    return {
      status: task.status as "Open" | "In Progress" | "Completed",
      label: task.status === "Completed" ? "Outreach completed" : `Outreach ${task.status.toLowerCase()}`,
      reason: task.comments ?? "Scheduling outreach task exists because no same-patient appointment was found.",
      task
    };
  }
  if (hasProspectiveNeed) {
    return {
      status: "Needed" as const,
      label: "Outreach needed",
      reason: "No same-patient appointment exists in the prototype schedule for an open or selected prospective opportunity."
    };
  }
  return {
    status: "Not Needed" as const,
    label: "No outreach need",
    reason: "No open prospective scheduling need is visible in this review."
  };
}

export function getReviewScenarioTags(data: SeedData, review: PatientReview) {
  const tags = new Set<string>();
  const documents = data.documents.filter((document) => document.reviewId === review.id);
  const sourceTypes = new Set<SourceDocument["type"]>(documents.map((document) => document.type));
  (["MOR", "Payer Data", "Registry", "HIE", "Specialist Note", "Pathology", "Imaging"] as const).forEach((type) => {
    if (sourceTypes.has(type)) tags.add(type);
  });

  const reviewEvidenceText = data.evidence
    .filter((evidence) => evidence.reviewId === review.id)
    .map((evidence) => `${evidence.text} ${evidence.exactText ?? ""} ${evidence.summary}`)
    .join(" ")
    .toLowerCase();
  if (reviewEvidenceText.includes("payer data")) tags.add("Payer Data");
  if (reviewEvidenceText.includes("registry")) tags.add("Registry");

  const claim = getClaimForReview(data, review.id);
  if (claim?.cptSourceEligible === false) tags.add("Ineligible CPT");
  if (claim?.providerTypeEligible === false) tags.add("Ineligible provider");
  if (claim?.faceToFace === false) tags.add("Non-face-to-face");
  if (claim?.providerSignatureValid === false) tags.add("Invalid signature");

  const conditions = reviewConditions(data, review);
  const outreachStatus = getOutreachStatusForReview(data, review);
  if (outreachStatus.status !== "Scheduled" && outreachStatus.status !== "Not Needed") tags.add("Scheduling outreach");
  const hccGroups = new Map<string, Condition[]>();
  conditions.forEach((condition) => hccGroups.set(condition.hcc, [...(hccGroups.get(condition.hcc) ?? []), condition]));
  if (Array.from(hccGroups.values()).some((group) => group.filter((condition) => condition.workflow === "codesOnClaim").length >= 3)) tags.add("Same-HCC threshold");
  if (Array.from(hccGroups.values()).some((group) => group.filter((condition) => condition.workflow === "codesNotOnClaim").length >= 2)) tags.add("Duplicate HCC addition");

  conditions.forEach((condition) => {
    if (condition.claimStatus === "Registry") tags.add("Registry");
    if (condition.acuteCondition) tags.add("Acute condition");
    if (condition.persistence === "acute" && condition.subtype === "recapture") tags.add("Acute-only recapture");
    if (condition.trumpedByCode) tags.add("Trumping");
    if (condition.sdohCode) tags.add("SDoH");
    if (condition.qualityExclusionCode) tags.add("Quality exclusion");
    if (condition.supportingEvidenceIds?.length || condition.conflictingEvidenceIds?.length) tags.add("Delete safety");
    if (condition.subtype === "recapture" && hasThreeYearLookbackEvidence(data, review, condition)) tags.add("Three-year lookback");
  });

  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function hasThreeYearLookbackEvidence(data: SeedData, review: PatientReview, condition: Condition) {
  const evidenceIds = new Set([...(condition.evidenceIds ?? []), ...(condition.lookbackEvidenceIds ?? [])]);
  return data.evidence
    .filter((evidence) => evidenceIds.has(evidence.id) || evidence.conditionIds.includes(condition.id))
    .some((evidence) => {
      const evidenceReview = data.reviews.find((item) => item.id === evidence.reviewId);
      const year = Number(evidence.date.slice(0, 4));
      return evidenceReview?.patientId === review.patientId && Number.isFinite(year) && year >= review.calendarYear - 3 && year <= review.calendarYear - 1;
    });
}

export function getTeamStats(data: SeedData) {
  return data.users
    .filter((user) => user.roles.includes("CDI/Coder"))
    .map((user) => {
      const assigned = data.reviews.filter((review) => isAssignedToUser(review, user));
      const completed = assigned.filter((review) => review.status === "Completed" || review.status === "Audit Complete").length;
      return {
        name: user.name.split(" ")[0],
        assigned: assigned.length,
        completed,
        pended: assigned.filter((review) => review.status === "Pended").length,
        open: assigned.filter((review) => ["Available", "In Progress", "Awaiting Review"].includes(review.status)).length
      };
    });
}

export function getActionTotals(data: SeedData) {
  const totals = new Map<string, number>();
  data.conditions.forEach((condition) => {
    const action = getDispositionSummaryLabel(condition);
    totals.set(action, (totals.get(action) ?? 0) + 1);
  });
  return Array.from(totals, ([name, value]) => ({ name, value }));
}

export function getReviewStatusTotals(data: SeedData) {
  const totals = new Map<string, number>();
  data.reviews.forEach((review) => totals.set(review.status, (totals.get(review.status) ?? 0) + 1));
  return Array.from(totals, ([name, value]) => ({ name, value }));
}

export function getPersonalStats(data: SeedData, user: User) {
  const reviews = getVisibleReviews(data, user).filter((review) => isAssignedToReview(review, user));
  const reviewIds = new Set(reviews.map((review) => review.id));
  const conditions = data.conditions.filter((condition) => reviewIds.has(condition.reviewId) && condition.disposition?.userId === user.id);
  const completedAuditReviews = data.audits.filter((audit) => audit.outcome && reviewIds.has(audit.reviewId));
  const auditAgreements = data.conditions.filter((condition) => reviewIds.has(condition.reviewId) && condition.disposition?.userId === user.id && condition.agreementWithAuditor);
  return {
    assignedReviews: reviews.length,
    completedReviews: reviews.filter((review) => review.status === "Completed" || review.status === "Audit Complete").length,
    pendedReviews: reviews.filter((review) => review.status === "Pended").length,
    validations: conditions.filter((condition) => condition.disposition?.action === "Validate").length,
    deletions: conditions.filter((condition) => condition.disposition?.action === "Delete").length,
    additions: conditions.filter((condition) => condition.disposition?.action === "Add to Claim").length,
    prospectiveDecisions: conditions.filter((condition) => ["Send to Prospective", "Yes", "No"].includes(condition.disposition?.action ?? "")).length,
    recaptureDecisions: conditions.filter((condition) => condition.subtype === "recapture").length,
    suspectDecisions: conditions.filter((condition) => condition.subtype === "suspect").length,
    recommendationAgreement: Math.round(
      (conditions.filter((condition) => condition.disposition?.agreedWithRecommendation).length / Math.max(1, conditions.length)) * 100
    ),
    auditAgreement: Math.round((auditAgreements.length / Math.max(1, completedAuditReviews.length || auditAgreements.length)) * 100)
  };
}

function rowsFromTasks(
  data: SeedData,
  type: DownstreamTaskType,
  mapper: (task: DownstreamTask, condition: Condition, review: PatientReview) => Record<string, string | number>
) {
  return data.downstreamTasks
    .filter((task) => task.type === type && task.status !== "Cancelled")
    .flatMap((task) => {
      const condition = data.conditions.find((item) => item.id === task.conditionId);
      const review = data.reviews.find((item) => item.id === task.reviewId);
      return condition && review ? [mapper(task, condition, review)] : [];
    });
}

export function getGeneratedExports(data: SeedData): ExportRecord[] {
  const patients = byId(data.patients);
  const payers = byId(data.payers);
  const deletionRows = rowsFromTasks(data, "Deletion", (_task, condition, review) => {
    const patient = patients.get(review.patientId)!;
    return { memberId: patient.memberId, reviewId: review.id, icd10: condition.icd10, hcc: condition.hcc, raf: condition.raf, note: "Generated from completed deletion disposition" };
  });
  const additionRows = rowsFromTasks(data, "Addition to Claim", (_task, condition, review) => {
    const patient = patients.get(review.patientId)!;
    const payer = payers.get(patient.payerId)!;
    return { memberId: patient.memberId, reviewId: review.id, icd10: condition.icd10, hcc: condition.hcc, payer: payer.name, profile: payer.asmProfile };
  });
  const payerRows = data.downstreamTasks
    .filter((task) => ["Addition to Claim", "Deletion"].includes(task.type) && task.status !== "Cancelled")
    .flatMap((task) => {
      const condition = data.conditions.find((item) => item.id === task.conditionId);
      const review = data.reviews.find((item) => item.id === task.reviewId);
      if (!condition || !review) return [];
      const patient = patients.get(review.patientId)!;
      const payer = payers.get(patient.payerId)!;
      return [{ memberId: patient.memberId, reviewId: review.id, icd10: condition.icd10, action: task.type, payer: payer.name, profile: payer.asmProfile }];
    });
  const auditRows = data.audits.map((audit) => ({
    reviewId: audit.reviewId,
    auditorId: audit.auditorId,
    selectionSource: audit.selectionSource ?? "manual",
    sampleRate: audit.sampleRate ?? "",
    sampleBucket: audit.sampleBucket ?? "",
    sampleCategories: audit.sampleCategories?.join("|") ?? "",
    outcome: audit.outcome ?? "Open",
    note: audit.comments ?? "Simulated audit result row"
  }));
  return [
    { id: "generated-delete", type: "Deletion list", createdAt: new Date().toISOString(), rows: deletionRows },
    { id: "generated-addition", type: "Addition to claim list", createdAt: new Date().toISOString(), rows: additionRows },
    { id: "generated-asm", type: "Payer ASM export", createdAt: new Date().toISOString(), rows: payerRows },
    { id: "generated-audit", type: "Audit results", createdAt: new Date().toISOString(), rows: auditRows }
  ];
}
