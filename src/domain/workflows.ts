import type {
  ActionHistory,
  AppSettings,
  AssignmentMode,
  Audit,
  Condition,
  DisagreeReason,
  DocumentationIssue,
  DownstreamTask,
  DownstreamTaskQueue,
  DownstreamTaskStatus,
  DownstreamTaskType,
  PatientReview,
  RecommendationAction,
  SeedData,
  User
} from "./types";
import { uid } from "./format";
import {
  canAssignReviews,
  canCompleteAudit as userCanCompleteAudit,
  canCompleteReview as userCanCompleteReview,
  canFlagDocumentationIssue as userCanFlagDocumentationIssue,
  canOpenReview,
  canOverrideLock,
  canReleaseReviewLock,
  canReopenAudit,
  canRouteWholeReview,
  canSetConditionDisposition,
  canStartAudit,
  canTakeCoverage,
  getVisibleReviews,
  hasAnyRole,
  isReviewLockOwner
} from "./auth";
import { getAuditSamplingProfile, getPatientCalendarYearHccGroup, getRuleResult, getUnresolvedConditions, getUpcomingAppointmentsForReview } from "./selectors";
import { appendGeneratedChartForAssignee } from "./generatedCharts";

function stamp() {
  return new Date().toISOString();
}

function addHistory(data: SeedData, entry: Omit<ActionHistory, "id" | "at"> & { at?: string }): SeedData {
  return {
    ...data,
    history: [
      {
        id: uid("hist"),
        at: entry.at ?? stamp(),
        reviewId: entry.reviewId,
        conditionId: entry.conditionId,
        userId: entry.userId,
        event: entry.event,
        detail: entry.detail
      },
      ...data.history
    ]
  };
}

function updateReview(data: SeedData, reviewId: string, updater: (review: PatientReview) => PatientReview) {
  return { ...data, reviews: data.reviews.map((review) => (review.id === reviewId ? updater(review) : review)) };
}

function updateCondition(data: SeedData, conditionId: string, updater: (condition: Condition) => Condition) {
  return { ...data, conditions: data.conditions.map((condition) => (condition.id === conditionId ? updater(condition) : condition)) };
}

function updateClinicAssignment(data: SeedData, clinicId: string, assignedUser: User) {
  return {
    ...data,
    clinics: data.clinics.map((clinic) =>
      clinic.id === clinicId
        ? {
            ...clinic,
            defaultAssigneeId: assignedUser.id
          }
        : clinic
    )
  };
}

function taskQueue(type: DownstreamTaskType): DownstreamTaskQueue {
  if (type === "Prospective CDI Review") return "Prospective Review Queue";
  if (type === "Provider Education") return "Provider Education Queue";
  if (type === "Auditor Exception") return "Auditor Queue";
  if (type === "Manager Exception") return "Manager Review Queue";
  if (type === "Scheduling Outreach") return "Scheduling Outreach Queue";
  return "Export List";
}

function createDownstreamTask(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  type: DownstreamTaskType,
  user: User,
  comments?: string,
  assignedUserId?: string
): SeedData {
  const existing = data.downstreamTasks.find(
    (task) => task.reviewId === reviewId && task.conditionId === conditionId && task.type === type && task.status !== "Cancelled"
  );
  if (existing) return data;
  const task: DownstreamTask = {
    id: uid("task"),
    reviewId,
    conditionId,
    type,
    status: "Open",
    queue: taskQueue(type),
    assignedUserId,
    createdByUserId: user.id,
    createdAt: stamp(),
    comments: comments?.trim() || undefined
  };
  return {
    ...data,
    downstreamTasks: [task, ...data.downstreamTasks]
  };
}

function isPrototypeCurrentYear(review: PatientReview, condition: Condition, settings: AppSettings) {
  return review.calendarYear === settings.prototypeCurrentYear && condition.currentYear;
}

function clampAuditRate(rate: number) {
  return Math.max(0, Math.min(100, Number.isFinite(rate) ? rate : 0));
}

export function shouldSampleReviewForAudit(reviewId: string, auditSampleRate: number) {
  const rate = clampAuditRate(auditSampleRate);
  if (rate <= 0) return false;
  if (rate >= 100) return true;
  let hash = 0;
  for (const char of reviewId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 10000;
  }
  return hash % 100 < rate;
}

export function openReview(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canOpenReview(data, review, user)) return data;
  if (review.lock && !isReviewLockOwner(review, user)) return data;
  if (isReviewLockOwner(review, user)) return data;

  const next = updateReview(data, reviewId, (item) => ({
    ...item,
    status: item.status === "Available" || item.status === "Pended" || item.status === "Rework Required" ? "In Progress" : item.status,
    lock: { lockedByUserId: user.id, lockedAt: stamp() }
  }));
  return addHistory(next, { reviewId, userId: user.id, event: "Lock acquired", detail: "Patient-level review opened and locked." });
}

export function findNextEligibleReview(data: SeedData, currentReviewId: string, user: User, excludeCurrent = false): PatientReview | undefined {
  const visibleReviews = getVisibleReviews(data, user).filter((review) => canOpenReview(data, review, user));
  const currentIndex = visibleReviews.findIndex((review) => review.id === currentReviewId);
  const orderedReviews =
    currentIndex >= 0
      ? [...visibleReviews.slice(currentIndex + 1), ...visibleReviews.slice(0, currentIndex)]
      : visibleReviews;
  return orderedReviews.find((review) => (!excludeCurrent || review.id !== currentReviewId) && !review.lock && (review.status === "Available" || review.status === "Pended"));
}

export function openNextEligibleReview(data: SeedData, currentReviewId: string, user: User): { data: SeedData; nextReviewId?: string } {
  const nextReview = findNextEligibleReview(data, currentReviewId, user);
  if (!nextReview) return { data };

  const currentReview = data.reviews.find((review) => review.id === currentReviewId);
  const releasedData = currentReview && isReviewLockOwner(currentReview, user) ? releaseReview(data, currentReviewId, user) : data;
  const openedData = openReview(releasedData, nextReview.id, user);
  const openedReview = openedData.reviews.find((review) => review.id === nextReview.id);
  return openedReview?.lock?.lockedByUserId === user.id ? { data: openedData, nextReviewId: nextReview.id } : { data };
}

export function releaseReview(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canReleaseReviewLock(review, user)) return data;
  const next = updateReview(data, reviewId, (item) => ({ ...item, lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Lock released", detail: "Chart exited and lock released." });
}

export function overrideLock(data: SeedData, reviewId: string, user: User, reason: string): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canOverrideLock(review, user, reason)) return data;
  const priorOwner = data.users.find((item) => item.id === review.lock?.lockedByUserId)?.name ?? "Unknown user";
  const next = updateReview(data, reviewId, (item) => ({
    ...item,
    lock: { lockedByUserId: user.id, lockedAt: stamp() },
    status: item.status === "Available" || item.status === "Pended" || item.status === "Rework Required" ? "In Progress" : item.status
  }));
  return addHistory(next, {
    reviewId,
    userId: user.id,
    event: "Lock overridden",
    detail: `Prior owner: ${priorOwner}. New owner: ${user.name}. Reason: ${reason.trim()}`
  });
}

export function pendReview(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canReleaseReviewLock(review, user)) return data;
  const next = updateReview(data, reviewId, (item) => ({ ...item, status: "Pended", lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Review pended", detail: "Unfinished patient review was pended." });
}

export function pendAndOpenNextEligibleReview(data: SeedData, currentReviewId: string, user: User): { data: SeedData; nextReviewId?: string } {
  const pendedData = pendReview(data, currentReviewId, user);
  const currentReview = pendedData.reviews.find((review) => review.id === currentReviewId);
  if (!currentReview || currentReview.lock) return { data };
  const nextReview = findNextEligibleReview(pendedData, currentReviewId, user, true);
  if (!nextReview) return { data: pendedData };
  const openedData = openReview(pendedData, nextReview.id, user);
  const openedReview = openedData.reviews.find((review) => review.id === nextReview.id);
  return openedReview?.lock?.lockedByUserId === user.id ? { data: openedData, nextReviewId: nextReview.id } : { data: pendedData };
}

export function routeReview(data: SeedData, reviewId: string, user: User, queue: PatientReview["queue"]): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canRouteWholeReview(review, user)) return data;
  const status = queue === "Auditor Queue" || queue === "Manager Review Queue" ? "Awaiting Review" : "Available";
  const next = updateReview(data, reviewId, (item) => ({ ...item, status, queue, lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Whole review routed", detail: `Sent to ${queue}.` });
}

export function completeReview(data: SeedData, reviewId: string, user: User, settings: AppSettings): { data: SeedData; unresolved: Condition[] } {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !userCanCompleteReview(review, user)) return { data, unresolved: [] };
  const unresolved = getUnresolvedConditions(data, review);
  if (unresolved.length > 0) return { data, unresolved };

  let next = updateReview(data, reviewId, (item) => ({ ...item, status: "Completed", lock: undefined, auditReturn: undefined }));
  next = addHistory(next, { reviewId, userId: user.id, event: "Review completed", detail: "All actionable conditions have a user-selected disposition or deterministic rule-derived outcome." });
  next = appendGeneratedChartForAssignee(next, review.assignedUserId, settings.prototypeCurrentYear);
  next = addHistory(next, { reviewId, userId: user.id, event: "Queue refilled", detail: "A deterministic synthetic chart was appended to the CDI/Coder queue." });
  if (shouldSampleReviewForAudit(reviewId, settings.auditSampleRate)) {
    next = startAudit(next, reviewId, user, true, settings.auditSampleRate);
  }
  return { data: next, unresolved: [] };
}

export function assignReview(
  data: SeedData,
  reviewId: string,
  user: User,
  assignedUserId: string,
  mode: AssignmentMode = "Coverage",
  reason?: string
): SeedData {
  if (!canAssignReviews(user)) return data;
  const review = data.reviews.find((item) => item.id === reviewId);
  const assigned = data.users.find((item) => item.id === assignedUserId);
  if (!review || !assigned) return data;
  let next =
    mode === "Coverage"
      ? updateReview(data, reviewId, (item) => ({
          ...item,
          coverage: {
            originalAssignedUserId: item.coverage?.originalAssignedUserId ?? item.assignedUserId,
            coveringUserId: assigned.id,
            startedAt: stamp(),
            initiatedByUserId: user.id
          }
        }))
      : updateReview(data, reviewId, (item) => ({
          ...item,
          assignedUserId: assigned.id,
          coverage: undefined
        }));
  if (mode === "Permanent reassignment") {
    next = updateClinicAssignment(next, review.clinicId, assigned);
  }
  return addHistory(next, {
    reviewId,
    userId: user.id,
    event: "Assignment changed",
    detail: `${mode}: ${assigned.name}.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`
  });
}

export function takeCoverage(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canTakeCoverage(data, review, user)) return data;
  const next = updateReview(data, reviewId, (item) => ({
    ...item,
    status: item.status === "Available" || item.status === "Pended" || item.status === "Rework Required" ? "In Progress" : item.status,
    coverage: {
      originalAssignedUserId: item.coverage?.originalAssignedUserId ?? item.assignedUserId,
      coveringUserId: user.id,
      startedAt: stamp(),
      initiatedByUserId: user.id
    },
    lock: { lockedByUserId: user.id, lockedAt: stamp() }
  }));
  const originalAssignee = data.users.find((item) => item.id === review.assignedUserId)?.name ?? "original CDI/Coder";
  return addHistory(next, { reviewId, userId: user.id, event: "Coverage assignment taken", detail: `${user.name} took temporary coverage from ${originalAssignee}.` });
}

export function setDisposition(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  user: User,
  action: RecommendationAction,
  agreedWithRecommendation: boolean | undefined,
  settings: AppSettings,
  reason?: DisagreeReason,
  comments?: string,
  replacementCode?: string
): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const conditionBefore = data.conditions.find((item) => item.id === conditionId);
  if (!review || !conditionBefore || !canSetConditionDisposition(review, user)) return data;
  const ruleResult = getRuleResult(conditionBefore, review, data, settings);
  if (ruleResult.disabledActions.some((disabledAction) => disabledAction.action === action)) return data;
  if (action === "Disagree" && reason === "Other" && !comments?.trim()) return data;
  const decidedAt = stamp();
  let next = updateCondition(data, conditionId, (condition) => ({
    ...condition,
    disposition: {
      action,
      reason,
      comments: comments?.trim() || undefined,
      replacementCode,
      userId: user.id,
      decidedAt,
      agreedWithRecommendation,
      source: "user-selected"
    }
  }));

  const condition = next.conditions.find((item) => item.id === conditionId);
  if (condition && action === "Validate") {
    next = applyThreeValidationRule(next, reviewId, condition.hcc, user, settings.sameHccValidationThreshold);
  }
  if (condition && action === "Add to Claim") {
    next = disableDuplicateHccAdditions(next, reviewId, condition.hcc, conditionId, user);
    next = createDownstreamTask(next, reviewId, conditionId, "Addition to Claim", user, comments);
  }
  if (condition && action === "Delete") {
    next = createDownstreamTask(next, reviewId, conditionId, "Deletion", user, comments);
  }
  if (
    condition &&
    isPrototypeCurrentYear(review, condition, settings) &&
    (action === "Send to Prospective" || (action === "Disagree" && (reason === "Not Enough MEAT" || reason === "Conflicting Evidence")))
  ) {
    next = createDownstreamTask(next, reviewId, conditionId, "Prospective CDI Review", user, comments, review.assignedUserId);
  }
  if (condition && shouldCreateSchedulingOutreach(next, review, condition, action, reason, settings)) {
    next = createDownstreamTask(
      next,
      reviewId,
      conditionId,
      "Scheduling Outreach",
      user,
      "No same-patient appointment is available in the prototype schedule for this current-year prospective opportunity.",
      review.assignedUserId
    );
  }
  if (condition && action === "Disagree" && reason === "Other") {
    next = createDownstreamTask(next, reviewId, conditionId, "Manager Exception", user, comments);
  }

  return addHistory(next, {
    reviewId,
    conditionId,
    userId: user.id,
    event: "Action selected",
    detail: reason ? `${action} - ${reason}` : action
  });
}

function shouldCreateSchedulingOutreach(
  data: SeedData,
  review: PatientReview,
  condition: Condition,
  action: RecommendationAction,
  reason: DisagreeReason | undefined,
  settings: AppSettings
) {
  if (!isPrototypeCurrentYear(review, condition, settings)) return false;
  if (getUpcomingAppointmentsForReview(data, review).length > 0) return false;
  if (action === "Send to Prospective" || action === "Yes" || action === "Change") return true;
  return action === "Disagree" && (reason === "Not Enough MEAT" || reason === "Conflicting Evidence");
}

function applyThreeValidationRule(data: SeedData, reviewId: string, hcc: string, user: User, thresholdSetting: number): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review) return data;
  const matching = getPatientCalendarYearHccGroup(data, review.patientId, review.calendarYear, hcc).filter((condition) => condition.workflow === "codesOnClaim");
  const threshold = Math.max(1, Math.min(10, Math.trunc(Number.isFinite(thresholdSetting) ? thresholdSetting : 3)));
  const validatedCount = matching.filter((condition) => condition.disposition?.action === "Validate").length;
  if (validatedCount < threshold) return data;
  let next = data;
  matching.forEach((condition) => {
    if (!condition.disposition && !condition.ruleOutcome && !condition.auditorDisposition) {
      const explanation = `${hcc} reached ${threshold} user-selected validations for this patient and calendar year. This condition was rule-resolved as validated.`;
      next = updateCondition(next, condition.id, (item) => ({
        ...item,
        ruleOutcome: {
          source: "rule-resolved",
          action: "Validate",
          ruleId: "same-hcc-validation-threshold",
          explanation,
          supportingEvidenceIds: item.evidenceIds,
          createdAt: stamp()
        },
        disabledReason: `Rule-resolved after same-HCC validation threshold (${threshold}) was reached.`
      }));
      next = addHistory(next, {
        reviewId: condition.reviewId,
        conditionId: condition.id,
        userId: user.id,
        event: "Rule-resolved condition",
        detail: explanation
      });
    }
  });
  return addHistory(next, { reviewId, userId: user.id, event: "Same-HCC rule applied", detail: `${threshold} validations reached for ${hcc}.` });
}

function disableDuplicateHccAdditions(data: SeedData, reviewId: string, hcc: string, selectedConditionId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review) return data;
  const selectedCondition = data.conditions.find((condition) => condition.id === selectedConditionId);
  if (!selectedCondition) return data;
  let next = data;
  getPatientCalendarYearHccGroup(data, review.patientId, review.calendarYear, hcc)
    .filter(
      (condition) =>
        condition.hcc === hcc &&
        condition.workflow === "codesNotOnClaim" &&
        condition.id !== selectedConditionId &&
        !condition.disposition &&
        !condition.ruleOutcome &&
        !condition.auditorDisposition
    )
    .forEach((condition) => {
      const selectedBy = data.users.find((item) => item.id === selectedCondition.disposition?.userId)?.name ?? "a reviewer";
      const selectedAt = selectedCondition.disposition?.decidedAt ? ` at ${selectedCondition.disposition.decidedAt}` : "";
      const explanation = `Add to Claim suppressed because ${selectedCondition.icd10} was selected by ${selectedBy}${selectedAt} for the same patient, calendar year, and ${hcc}.`;
      next = updateCondition(next, condition.id, (item) => ({
        ...item,
        ruleOutcome: {
          source: "rule-suppressed",
          action: "Add to Claim",
          ruleId: "same-hcc-duplicate-add",
          explanation,
          selectedConditionId,
          supportingEvidenceIds: selectedCondition.evidenceIds,
          createdAt: stamp()
        },
        disabledReason: explanation
      }));
      next = addHistory(next, {
        reviewId: condition.reviewId,
        conditionId: condition.id,
        userId: user.id,
        event: "Rule-suppressed condition",
        detail: explanation
      });
    });
  return next;
}

export function flagDocumentationIssue(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  user: User,
  issue: DocumentationIssue,
  comments?: string
): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !userCanFlagDocumentationIssue(review, user)) return data;
  if (issue === "Provider education" && !comments?.trim()) return data;
  let next = updateCondition(data, conditionId, (condition) => ({
    ...condition,
    documentationIssues: [{ issue, comments: comments?.trim() || undefined, userId: user.id, createdAt: stamp() }, ...condition.documentationIssues]
  }));
  const taskType: DownstreamTaskType = issue === "Provider education" ? "Provider Education" : "Manager Exception";
  next = createDownstreamTask(next, reviewId, conditionId, taskType, user, comments);
  return addHistory(next, { reviewId, conditionId, userId: user.id, event: "Documentation issue flagged", detail: issue });
}

export function startAudit(data: SeedData, reviewId: string, user: User, sampled = false, sampleRate = 0): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || (!sampled && !canStartAudit(review, user))) return data;
  const existing = data.audits.find((audit) => audit.reviewId === reviewId);
  if (existing?.status === "Complete") return data;
  const sampleProfile = getAuditSamplingProfile(data, review, sampleRate);
  const sampledAt = sampled ? stamp() : undefined;
  let next = updateReview(data, reviewId, (item) => ({
    ...item,
    status: "Under Audit",
    queue: "Auditor Queue",
    assignedAuditorId: user.roles.includes("Auditor") ? user.id : item.assignedAuditorId ?? "u-auditor-1",
    lock: undefined
  }));
  if (existing) {
    next = {
      ...next,
      audits: next.audits.map((audit) =>
        audit.reviewId === reviewId
          ? {
              ...audit,
              auditorId: user.roles.includes("Auditor") ? user.id : audit.auditorId,
              status: "In Progress",
              selectionSource: sampled ? "deterministic-sample" : audit.selectionSource ?? "manual",
              sampledAt: sampledAt ?? audit.sampledAt,
              sampleRate: sampled ? sampleProfile.sampleRate : audit.sampleRate,
              sampleBucket: sampled ? sampleProfile.sampleBucket : audit.sampleBucket,
              sampleCategories: sampled ? sampleProfile.sampleCategories : audit.sampleCategories,
              outcome: undefined,
              completedAt: undefined
            }
          : audit
      )
    };
  } else {
    const audit: Audit = {
      id: uid("audit"),
      reviewId,
      auditorId: user.roles.includes("Auditor") ? user.id : "u-auditor-1",
      status: "In Progress",
      selectionSource: sampled ? "deterministic-sample" : "manual",
      sampledAt,
      sampleRate: sampled ? sampleProfile.sampleRate : undefined,
      sampleBucket: sampled ? sampleProfile.sampleBucket : undefined,
      sampleCategories: sampled ? sampleProfile.sampleCategories : undefined
    };
    next = { ...next, audits: [audit, ...next.audits] };
  }
  return addHistory(next, {
    reviewId,
    userId: user.id,
    event: sampled ? "Audit sample selected" : "Audit started",
    detail: sampled
      ? `Deterministic prototype sample selected from configured ${sampleProfile.sampleRate}% audit percentage across ${sampleProfile.sampleCategories.join(", ") || "review"} opportunities.`
      : "Review sent to audit."
  });
}

export function updateDownstreamTaskStatus(data: SeedData, taskId: string, user: User, status: DownstreamTaskStatus, comments?: string): SeedData {
  const task = data.downstreamTasks.find((item) => item.id === taskId);
  const review = task ? data.reviews.find((item) => item.id === task.reviewId) : undefined;
  if (!task || !review) return data;
  const canUpdate = hasAnyRole(user, ["Administrator", "Manager"]) || task.assignedUserId === user.id || isReviewLockOwner(review, user);
  if (!canUpdate || status === "Cancelled") return data;
  const next = {
    ...data,
    downstreamTasks: data.downstreamTasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            status,
            comments: comments?.trim() || item.comments
          }
        : item
    )
  };
  return addHistory(next, {
    reviewId: task.reviewId,
    conditionId: task.conditionId,
    userId: user.id,
    event: "Downstream task updated",
    detail: `${task.type} marked ${status}.${comments?.trim() ? ` ${comments.trim()}` : ""}`
  });
}

export function completeAudit(data: SeedData, reviewId: string, user: User, outcome: "Agree" | "Disagree" | "Return for Correction", comments?: string): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const existingAudit = data.audits.find((audit) => audit.reviewId === reviewId);
  if (!review || !existingAudit || !userCanCompleteAudit(review, user) || existingAudit.status === "Complete") return data;
  if (outcome === "Return for Correction" && !comments?.trim()) return data;

  const completedAt = stamp();
  const auditStatus: Audit["status"] = outcome === "Return for Correction" ? "Returned" : "Complete";
  let next = {
    ...data,
    audits: data.audits.map((audit) =>
      audit.reviewId === reviewId
        ? {
            ...audit,
            auditorId: user.id,
            status: auditStatus,
            outcome,
            comments: comments?.trim() || undefined,
            completedAt
          }
        : audit
    ),
    conditions: data.conditions.map((condition) =>
      condition.reviewId === reviewId && condition.disposition
        ? {
            ...condition,
            auditorDisposition: {
              outcome,
              comments: comments?.trim() || undefined,
              auditorId: user.id,
              decidedAt: completedAt,
              agreedWithUser: outcome === "Agree",
              source: "auditor-selected" as const
            },
            agreementWithAuditor: outcome === "Agree"
          }
        : condition
    )
  };
  next = updateReview(next, reviewId, (item) =>
    outcome === "Return for Correction"
      ? {
          ...item,
          status: "Rework Required",
          queue: "CDI/Coder Queue",
          assignedAuditorId: undefined,
          lock: undefined,
          auditReturn: {
            auditId: existingAudit.id,
            returnedByUserId: user.id,
            returnedAt: completedAt,
            comments: comments!.trim()
          }
        }
      : { ...item, status: "Audit Complete", queue: "Auditor Queue", lock: undefined }
  );
  return addHistory(next, { reviewId, userId: user.id, event: "Audit completed", detail: comments?.trim() ? `${outcome}: ${comments.trim()}` : outcome });
}

export function reopenAudit(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const audit = data.audits.find((item) => item.reviewId === reviewId);
  if (!review || !audit || !canReopenAudit(user)) return data;
  const reopenedAt = stamp();
  let next = {
    ...data,
    audits: data.audits.map((item) =>
      item.reviewId === reviewId
        ? {
            ...item,
            auditorId: user.roles.includes("Auditor") ? user.id : item.auditorId,
            status: "In Progress" as const,
            outcome: undefined,
            completedAt: undefined,
            reopenedAt
          }
        : item
    )
  };
  next = updateReview(next, reviewId, (item) => ({
    ...item,
    status: "Under Audit",
    queue: "Auditor Queue",
    assignedAuditorId: user.roles.includes("Auditor") ? user.id : item.assignedAuditorId ?? audit.auditorId,
    lock: undefined
  }));
  return addHistory(next, { reviewId, userId: user.id, event: "Audit reopened", detail: "Completed audit reopened for deliberate follow-up." });
}
