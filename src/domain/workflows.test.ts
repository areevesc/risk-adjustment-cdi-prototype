// @ts-expect-error Vitest runs in Node; this prototype does not include @types/node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seedData } from "../data/seed";
import { decisionSupportService } from "../decisionSupport/DecisionSupportService";
import { targetForEvidence } from "../features/review/ReviewPage";
import { canAccessRoute, canOpenReview, canTakeCoverage, getVisibleReviews } from "./auth";
import { normalizeSeedData } from "../state/AppState";
import {
  assignReview,
  completeAudit,
  completeReview,
  flagDocumentationIssue,
  findNextEligibleReview,
  openNextEligibleReview,
  openReview,
  overrideLock,
  pendAndOpenNextEligibleReview,
  pendReview,
  releaseReview,
  routeReview,
  setDisposition,
  shouldSampleReviewForAudit,
  startAudit,
  takeCoverage,
  updateDownstreamTaskStatus
} from "./workflows";
import {
  getActionTotals,
  getActiveConditionEvidence,
  getAuditSamplingProfile,
  getDispositionSummary,
  getEvidenceCycleTarget,
  getGeneratedExports,
  getOutreachStatusForReview,
  getPatientCalendarYearHccGroup,
  getPersonalStats,
  getPopulationRafSummary,
  getPresentedOpportunitySummary,
  getRafSummary,
  getReviewScenarioTags,
  getRuleResult,
  getUnresolvedConditions
} from "./selectors";
import type { AppSettings, SeedData } from "./types";

const settings: AppSettings = {
  recommendationMode: "rules",
  auditSampleRate: 25,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

function cloneSeed(): SeedData {
  return structuredClone(seedData);
}

function user(data: SeedData, id: string) {
  return data.users.find((item) => item.id === id)!;
}

function disposeRev100(data: SeedData, auditSampleRate: number) {
  let next = openReview(data, "rev-100", user(data, "u-coder-1"));
  next = setDisposition(next, "rev-100", "cond-100-a", user(data, "u-coder-1"), "Validate", true, settings);
  next = setDisposition(next, "rev-100", "cond-100-b", user(data, "u-coder-1"), "Delete", true, settings);
  next = setDisposition(next, "rev-100", "cond-100-c", user(data, "u-coder-1"), "Send to Prospective", true, settings);
  next = setDisposition(next, "rev-100", "cond-100-d", user(data, "u-coder-1"), "Add to Claim", true, settings);
  next = setDisposition(next, "rev-100", "cond-100-e", user(data, "u-coder-1"), "Disagree", true, settings, "Condition Resolved");
  next = setDisposition(next, "rev-100", "cond-100-f", user(data, "u-coder-1"), "Change", true, settings, undefined, "Use higher specificity", "E11.311");
  return completeReview(next, "rev-100", user(data, "u-coder-1"), { ...settings, auditSampleRate });
}

describe("routing and prototype authorization", () => {
  it("uses HashRouter for GitHub Pages routing", () => {
    const main = readFileSync("src/main.tsx", "utf8");
    expect(main).toContain("HashRouter");
    expect(main).not.toContain("BrowserRouter");
  });

  it("guards restricted routes by role", () => {
    const data = cloneSeed();
    expect(canAccessRoute(user(data, "u-admin"), "admin")).toBe(true);
    expect(canAccessRoute(user(data, "u-manager-1"), "admin")).toBe(false);
    expect(canAccessRoute(user(data, "u-coder-1"), "manager")).toBe(false);
    expect(canAccessRoute(user(data, "u-coder-1"), "stats")).toBe(true);
    expect(canAccessRoute(user(data, "u-manager-1"), "stats")).toBe(false);
    expect(canAccessRoute(user(data, "u-auditor-1"), "audit")).toBe(true);
  });

  it("normalizes legacy persisted CDI and Coder role state", () => {
    const legacy = cloneSeed() as SeedData & {
      users: Array<SeedData["users"][number] & { primaryRole: string; roles: string[] }>;
      reviews: Array<SeedData["reviews"][number] & { assignedCoderId?: string; assignedCdiId?: string; assignedUserId?: string }>;
    };
    legacy.users[5] = { ...legacy.users[5], primaryRole: "Coder", roles: ["Coder"] } as never;
    legacy.users[10] = { ...legacy.users[10], primaryRole: "CDI Specialist", roles: ["CDI Specialist"] } as never;
    legacy.reviews[0] = { ...legacy.reviews[0], assignedUserId: undefined as unknown as string, assignedCoderId: "u-coder-1", assignedCdiId: "u-cdi-1", queue: "Assigned Coder" as never } as never;
    const normalized = normalizeSeedData(legacy);
    expect(normalized.users).toHaveLength(7);
    expect(normalized.users.some((item) => item.id === "u-cdi-1")).toBe(false);
    expect(normalized.reviews[0]).toMatchObject({ assignedUserId: "u-coder-1", queue: "CDI/Coder Queue" });
  });

  it("uses the simplified seed user roster", () => {
    const data = cloneSeed();
    expect(data.users.map((item) => item.primaryRole).sort()).toEqual([
      "Administrator",
      "Auditor",
      "CDI/Coder",
      "CDI/Coder",
      "CDI/Coder",
      "CDI/Coder",
      "Manager"
    ]);
    expect(data.users.map((item) => item.id).sort()).toEqual(["u-admin", "u-auditor-1", "u-coder-1", "u-coder-2", "u-coder-3", "u-coder-4", "u-manager-1"]);
  });
});

describe("prototype workflow rules", () => {
  it("locks an available patient review for the opening user", () => {
    const data = cloneSeed();
    const next = openReview(data, "rev-100", user(data, "u-coder-1"));
    const review = next.reviews.find((item) => item.id === "rev-100")!;
    expect(review.status).toBe("In Progress");
    expect(review.lock?.lockedByUserId).toBe("u-coder-1");
  });

  it("does not allow another user or a manager open action to overwrite an active lock", () => {
    const data = cloneSeed();
    const locked = openReview(data, "rev-100", user(data, "u-coder-1"));
    const coderAttempt = openReview(locked, "rev-100", user(data, "u-coder-2"));
    const managerAttempt = openReview(coderAttempt, "rev-100", user(data, "u-manager-1"));
    expect(managerAttempt.reviews.find((item) => item.id === "rev-100")?.lock?.lockedByUserId).toBe("u-coder-1");
  });

  it("blocks modification and release when the current user does not own the lock", () => {
    const data = cloneSeed();
    const locked = openReview(data, "rev-100", user(data, "u-coder-1"));
    const changed = setDisposition(locked, "rev-100", "cond-100-a", user(data, "u-coder-2"), "Validate", true, settings);
    const released = releaseReview(changed, "rev-100", user(data, "u-coder-2"));
    expect(released.conditions.find((item) => item.id === "cond-100-a")?.disposition).toBeUndefined();
    expect(released.reviews.find((item) => item.id === "rev-100")?.lock?.lockedByUserId).toBe("u-coder-1");
  });

  it("requires explicit manager override reason and records prior owner", () => {
    const data = cloneSeed();
    const locked = openReview(data, "rev-100", user(data, "u-coder-1"));
    const denied = overrideLock(locked, "rev-100", user(data, "u-manager-1"), "");
    const overridden = overrideLock(locked, "rev-100", user(data, "u-manager-1"), "Coverage emergency");
    expect(denied.reviews.find((item) => item.id === "rev-100")?.lock?.lockedByUserId).toBe("u-coder-1");
    expect(overridden.reviews.find((item) => item.id === "rev-100")?.lock?.lockedByUserId).toBe("u-manager-1");
    expect(overridden.history[0].detail).toContain("Prior owner: Nina Brooks");
    expect(overridden.history[0].detail).toContain("Coverage emergency");
  });

  it("creates condition-level downstream tasks without changing the patient queue", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-c", user(data, "u-coder-1"), "Send to Prospective", true, settings);
    const review = next.reviews.find((item) => item.id === "rev-100")!;
    expect(review.queue).toBe("CDI/Coder Queue");
    expect(next.downstreamTasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ conditionId: "cond-100-c", type: "Prospective CDI Review", queue: "Prospective Review Queue" })])
    );
  });

  it("keeps whole-review routing as a patient-level queue change", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = routeReview(data, "rev-100", user(data, "u-coder-1"), "Auditor Queue");
    const review = next.reviews.find((item) => item.id === "rev-100")!;
    expect(review.queue).toBe("Auditor Queue");
    expect(review.status).toBe("Awaiting Review");
  });

  it("finds the next eligible chart while skipping locked, completed, audit, and unauthorized reviews", () => {
    const data = cloneSeed();
    data.reviews = data.reviews.map((review) => {
      if (review.id === "rev-106") return { ...review, lock: { lockedByUserId: "u-coder-3", lockedAt: "2026-06-24T09:30:00.000Z" } };
      if (review.id === "rev-110") return { ...review, status: "Completed" as const };
      if (review.id === "rev-114") return { ...review, status: "Under Audit" as const, queue: "Auditor Queue" as const };
      return review;
    });

    expect(findNextEligibleReview(data, "rev-100", user(data, "u-coder-1"))).toBeUndefined();
  });

  it("releases the current lock before opening the next eligible chart", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const result = openNextEligibleReview(data, "rev-100", user(data, "u-coder-1"));

    expect(result.nextReviewId).toBe("rev-110");
    expect(result.data.reviews.find((item) => item.id === "rev-100")?.lock).toBeUndefined();
    expect(result.data.reviews.find((item) => item.id === "rev-110")?.lock?.lockedByUserId).toBe("u-coder-1");
    expect(result.data.reviews.find((item) => item.id === "rev-110")?.status).toBe("In Progress");
  });

  it("pends a chart while preserving assignment and releasing only the active edit lock", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = pendReview(data, "rev-100", user(data, "u-coder-1"));
    const review = next.reviews.find((item) => item.id === "rev-100")!;
    expect(review.status).toBe("Pended");
    expect(review.assignedUserId).toBe("u-coder-1");
    expect(review.lock).toBeUndefined();
    expect(getVisibleReviews(next, user(next, "u-coder-2")).map((item) => item.id)).toContain("rev-100");
    expect(canOpenReview(next, review, user(next, "u-coder-2"))).toBe(false);
    expect(canTakeCoverage(next, review, user(next, "u-coder-2"))).toBe(true);
  });

  it("pends and opens the next assigned patient without reselecting the pended chart", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const result = pendAndOpenNextEligibleReview(data, "rev-100", user(data, "u-coder-1"));
    expect(result.nextReviewId).toBe("rev-110");
    expect(result.data.reviews.find((item) => item.id === "rev-100")).toMatchObject({ status: "Pended", assignedUserId: "u-coder-1" });
    expect(result.data.reviews.find((item) => item.id === "rev-100")?.lock).toBeUndefined();
    expect(result.data.reviews.find((item) => item.id === "rev-110")?.lock?.lockedByUserId).toBe("u-coder-1");
  });

  it("supports return to queue after a pended chart has already released its lock", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const pended = pendReview(data, "rev-100", user(data, "u-coder-1"));
    const returned = releaseReview(pended, "rev-100", user(pended, "u-coder-1"));
    expect(returned.reviews.find((item) => item.id === "rev-100")).toMatchObject({ status: "Pended", assignedUserId: "u-coder-1" });
    expect(returned.reviews.find((item) => item.id === "rev-100")?.lock).toBeUndefined();
  });

  it("supports next patient after a chart is pended", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const pended = pendReview(data, "rev-100", user(data, "u-coder-1"));
    const result = openNextEligibleReview(pended, "rev-100", user(pended, "u-coder-1"));
    expect(result.nextReviewId).toBe("rev-110");
    expect(result.data.reviews.find((item) => item.id === "rev-110")?.lock?.lockedByUserId).toBe("u-coder-1");
  });

  it("supports return to queue and next patient after sending to auditor", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const routed = routeReview(data, "rev-100", user(data, "u-coder-1"), "Auditor Queue");
    const routedReview = routed.reviews.find((item) => item.id === "rev-100")!;
    expect(routedReview).toMatchObject({ queue: "Auditor Queue", status: "Awaiting Review", assignedUserId: "u-coder-1" });
    expect(routedReview.lock).toBeUndefined();
    expect(releaseReview(routed, "rev-100", user(routed, "u-coder-1")).reviews.find((item) => item.id === "rev-100")?.lock).toBeUndefined();
    const result = openNextEligibleReview(routed, "rev-100", user(routed, "u-coder-1"));
    expect(result.nextReviewId).toBe("rev-110");
  });

  it("leaves state unchanged when no next eligible chart exists", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    data.reviews = data.reviews.map((review) => {
      if (review.id === "rev-106") return { ...review, lock: { lockedByUserId: "u-coder-3", lockedAt: "2026-06-24T09:30:00.000Z" } };
      if (review.id === "rev-110" || review.id === "rev-114") return { ...review, status: "Completed" as const };
      return review;
    });

    const result = openNextEligibleReview(data, "rev-100", user(data, "u-coder-1"));
    expect(result.nextReviewId).toBeUndefined();
    expect(result.data).toBe(data);
    expect(result.data.reviews.find((item) => item.id === "rev-100")?.lock?.lockedByUserId).toBe("u-coder-1");
  });

  it("blocks completion while actionable conditions are unresolved", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const result = completeReview(data, "rev-100", user(data, "u-coder-1"), settings);
    expect(result.unresolved.length).toBeGreaterThan(0);
    expect(result.data.reviews.find((item) => item.id === "rev-100")?.status).toBe("In Progress");
  });

  it("records completion history that distinguishes dispositions from rule outcomes", () => {
    let data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    data = setDisposition(data, "rev-100", "cond-100-a", user(data, "u-coder-1"), "Validate", true, settings);
    data = setDisposition(data, "rev-100", "cond-100-b", user(data, "u-coder-1"), "Delete", true, settings);
    data = setDisposition(data, "rev-100", "cond-100-c", user(data, "u-coder-1"), "Send to Prospective", true, settings);
    data = setDisposition(data, "rev-100", "cond-100-d", user(data, "u-coder-1"), "Add to Claim", true, settings);
    data = setDisposition(data, "rev-100", "cond-100-e", user(data, "u-coder-1"), "Disagree", true, settings, "Condition Resolved");
    data = setDisposition(data, "rev-100", "cond-100-f", user(data, "u-coder-1"), "Change", true, settings, undefined, "Use higher specificity", "E11.311");
    const result = completeReview(data, "rev-100", user(data, "u-coder-1"), { ...settings, auditSampleRate: 0 });
    expect(result.unresolved).toHaveLength(0);
    expect(result.data.history).toEqual(expect.arrayContaining([expect.objectContaining({
      event: "Review completed",
      detail: "All actionable conditions have a user-selected disposition or deterministic rule-derived outcome."
    })]));
    expect(result.data.reviews.some((review) => review.id.startsWith("gen-rev-") && review.assignedUserId === "u-coder-1")).toBe(true);
  });

  it("appends one deterministic generated chart to the completing CDI/Coder queue", () => {
    const before = cloneSeed();
    const result = disposeRev100(before, 0);
    const generatedReviews = result.data.reviews.filter((review) => review.id.startsWith("gen-rev-"));
    const generatedChart = result.data.charts.find((chart) => chart.reviewId === generatedReviews[0]?.id);
    expect(generatedReviews).toHaveLength(1);
    expect(generatedReviews[0]).toMatchObject({ assignedUserId: "u-coder-1", status: "Available", queue: "CDI/Coder Queue" });
    expect(result.data.patients.some((patient) => patient.id === generatedReviews[0].patientId)).toBe(true);
    expect(result.data.conditions.some((condition) => condition.reviewId === generatedReviews[0].id)).toBe(true);
    expect(generatedChart).toBeTruthy();
    expect(generatedChart?.encounters.length).toBeGreaterThanOrEqual(2);
    expect(generatedChart?.labs[0].results.some((result) => result.component && result.referenceRange && result.flag)).toBe(true);
    expect(generatedChart?.claims[0]).toMatchObject({ cptCode: expect.any(String), providerTypeEligible: true, faceToFace: true, providerSignatureValid: true });
    expect(result.data.evidence.find((evidence) => evidence.id.endsWith("-ap"))).toMatchObject({ sourceType: "planSentence", evidenceStrength: "assessmentWithPlan" });
    expect(result.data.evidence.find((evidence) => evidence.id.endsWith("-lab"))).toMatchObject({ sourceType: "labResultRow", evidenceStrength: "labIndicatorOnly" });
  });

  it("seeds full embedded chart documentation for reviews", () => {
    const data = cloneSeed();
    const chart = data.charts.find((item) => item.reviewId === "rev-100")!;
    expect(chart.encounters[0]).toMatchObject({
      chiefComplaint: expect.any(String),
      hpi: expect.stringContaining("glucose"),
      billingCode: "99214"
    });
    expect(chart.encounters[0].hpi).toContain("Home glucose logs");
    expect(chart.encounters[0].assessmentPlan.length).toBeGreaterThan(0);
    expect(chart.encounters[0].assessmentPlan[0].detail).toContain("Continue metformin ER");
    expect(chart.encounters[0].assessmentPlan.map((item) => item.detail).join(" ")).not.toContain("risk adjustment items");
    expect(chart.encounters).toHaveLength(5);
    expect(chart.problems.length).toBeGreaterThan(0);
    expect(chart.medications.length).toBeGreaterThan(0);
    expect(chart.labs[0].results[0]).toMatchObject({ component: expect.any(String), value: expect.any(String), unit: expect.any(String), referenceRange: expect.any(String), flag: expect.any(String) });
    expect(chart.labs).toHaveLength(5);
    expect(chart.vitals[0]).toMatchObject({ systolic: expect.any(Number), heartRate: expect.any(Number), bmi: expect.any(Number), oxygenSaturation: expect.any(Number) });
    expect(chart.vitals).toHaveLength(5);
    expect(chart.imaging.length).toBeGreaterThan(0);
    expect(chart.specialistNotes.length).toBeGreaterThan(0);
    expect(chart.claims[0]).toMatchObject({ dateOfService: expect.any(String), provider: expect.any(String), payer: expect.any(String), cptCode: expect.any(String), encounterType: expect.any(String) });
    expect(chart.claims[0].icd10Codes).toEqual(["E11.65", "I10", "I50.33"]);
    const labEvidence = data.evidence.find((item) => item.id === "ev-rev-100-d")!;
    const anchoredLabResult = chart.labs.flatMap((panel) => panel.results).find((result) => result.evidenceIds.includes(labEvidence.id))!;
    expect(targetForEvidence(chart, labEvidence.id, labEvidence)).toBe(`chart-labs-${anchoredLabResult.id}`);
    expect(data.evidence.find((item) => item.id === "ev-rev-100-d")?.chartAnchor).toMatchObject({ tab: "labs" });
    expect(data.evidence.find((item) => item.id === "ev-rev-100-a")).toMatchObject({
      sourceType: "planSentence",
      evidenceStrength: "assessmentWithPlan",
      meatType: expect.arrayContaining(["Assessment", "Treatment"])
    });
    expect(data.evidence.find((item) => item.id === "ev-rev-100-d")).toMatchObject({
      sourceType: "labResultRow",
      evidenceStrength: "labIndicatorOnly",
      currentYearSupport: false
    });
  });

  it("cycles evidence only inside the active condition evidence set", () => {
    const data = cloneSeed();
    const relatedEvidence = data.evidence.filter((evidence) => evidence.reviewId === "rev-100");
    const diabetesEvidence = getActiveConditionEvidence(data, relatedEvidence, "cond-100-a");
    const chfEvidence = getActiveConditionEvidence(data, relatedEvidence, "cond-100-c");

    expect(diabetesEvidence.map((evidence) => evidence.id)).toEqual(["ev-rev-100-a", "ev-rev-100-e"]);
    expect(chfEvidence.map((evidence) => evidence.id)).toEqual(expect.arrayContaining(["ev-rev-100-b", "ev-rev-100-f"]));
    expect(chfEvidence.map((evidence) => evidence.id)).not.toContain("ev-rev-100-a");
    expect(getEvidenceCycleTarget(diabetesEvidence, "ev-rev-100-a", "next")?.id).toBe("ev-rev-100-e");
    expect(getEvidenceCycleTarget(diabetesEvidence, "ev-rev-100-e", "next")?.id).toBe("ev-rev-100-a");
    expect(getEvidenceCycleTarget(diabetesEvidence, "ev-rev-100-a", "prev")?.id).toBe("ev-rev-100-e");
  });

  it("disables duplicate same-HCC additions after one add-to-claim selection", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-d", user(data, "u-coder-1"), "Add to Claim", true, settings);
    const duplicate = next.conditions.find((item) => item.id === "cond-100-e")!;
    expect(duplicate.disabledReason).toContain("HCC 37");
    expect(duplicate.ruleOutcome).toMatchObject({ source: "rule-suppressed", action: "Add to Claim", ruleId: "same-hcc-duplicate-add" });
    expect(next.history).toEqual(expect.arrayContaining([expect.objectContaining({ event: "Rule-suppressed condition", conditionId: "cond-100-e" })]));
  });

  it("does not suppress same-HCC Add to Claim from a recommendation alone", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const recommended = data.conditions.find((item) => item.id === "cond-100-d")!;
    const duplicate = data.conditions.find((item) => item.id === "cond-100-e")!;

    expect(decisionSupportService.getRecommendation(recommended, review, data, settings)?.action).toBe("Add to Claim");
    expect(getRuleResult(duplicate, review, data, settings).disabledActions.some((item) => item.action === "Add to Claim")).toBe(false);
  });

  it("groups same-HCC candidates by patient and calendar year across reviews", () => {
    const data = cloneSeed();
    const group = getPatientCalendarYearHccGroup(data, "pat-111", 2026, "HCC 222");
    expect(group.map((condition) => condition.id).sort()).toEqual(["cond-111-a", "cond-111-b"]);
  });

  it("rule-resolves unresolved same-HCC conditions after the validation threshold", () => {
    let data = openReview(cloneSeed(), "rev-110", user(seedData, "u-coder-1"));
    data = setDisposition(data, "rev-110", "cond-110-a", user(data, "u-coder-1"), "Validate", true, settings);
    data = setDisposition(data, "rev-110", "cond-110-b", user(data, "u-coder-1"), "Validate", true, settings);
    expect(data.conditions.find((item) => item.id === "cond-110-d")?.ruleOutcome).toBeUndefined();
    data = setDisposition(data, "rev-110", "cond-110-c", user(data, "u-coder-1"), "Validate", true, settings);
    const resolved = data.conditions.find((item) => item.id === "cond-110-d")!;
    const review = data.reviews.find((item) => item.id === "rev-110")!;
    expect(resolved.ruleOutcome).toMatchObject({ source: "rule-resolved", action: "Validate", ruleId: "same-hcc-validation-threshold" });
    expect(getUnresolvedConditions(data, review).map((condition) => condition.id)).not.toContain("cond-110-d");
    expect(data.history.some((entry) => entry.event === "Rule-resolved condition" && entry.conditionId === "cond-110-d")).toBe(true);
  });

  it("does not count Validate recommendations toward the same-HCC threshold", () => {
    let data = openReview(cloneSeed(), "rev-110", user(seedData, "u-coder-1"));
    data = setDisposition(data, "rev-110", "cond-110-a", user(data, "u-coder-1"), "Validate", true, settings);
    data = setDisposition(data, "rev-110", "cond-110-b", user(data, "u-coder-1"), "Validate", true, settings);
    const review = data.reviews.find((item) => item.id === "rev-110")!;
    const thirdCandidate = data.conditions.find((item) => item.id === "cond-110-c")!;

    expect(decisionSupportService.getRecommendation(thirdCandidate, review, data, settings)?.action).toBe("Validate");
    expect(data.conditions.find((item) => item.id === "cond-110-d")?.ruleOutcome).toBeUndefined();
  });

  it("does not count rule-suppressed duplicate add outcomes as completed actions", () => {
    let data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    data = setDisposition(data, "rev-100", "cond-100-d", user(data, "u-coder-1"), "Add to Claim", true, settings);
    const totals = getActionTotals(data);
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    expect(totals.some((item) => item.name === "Rule Suppressed")).toBe(false);
    expect(getUnresolvedConditions(data, review).map((condition) => condition.id)).toContain("cond-100-e");
  });

  it("returns structured warning results for delete safety support across same-patient records", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-111")!;
    const condition = data.conditions.find((item) => item.id === "cond-111-a")!;
    const result = getRuleResult(condition, review, data, settings);
    expect(result.disabledActions.some((item) => item.action === "Delete")).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warning", message: "Possible current-year supporting evidence was identified. Review before deleting.", evidenceIds: expect.arrayContaining(["ev-rev-111-support-a"]) })
      ])
    );
  });

  it("allows delete when no current-year same-patient support exists", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const condition = data.conditions.find((item) => item.id === "cond-100-b")!;
    expect(getRuleResult(condition, review, data, settings).disabledActions.some((item) => item.action === "Delete")).toBe(false);
    const next = setDisposition(data, "rev-100", "cond-100-b", user(data, "u-coder-1"), "Delete", true, settings);
    expect(next.conditions.find((item) => item.id === "cond-100-b")?.disposition?.action).toBe("Delete");
  });

  it("allows a CDI/Coder to delete after disagreeing with AI-identified support", () => {
    const data = openReview(cloneSeed(), "rev-111", user(seedData, "u-coder-2"));
    const next = setDisposition(data, "rev-111", "cond-111-a", user(data, "u-coder-2"), "Delete", false, settings, undefined, "Reviewed possible support; delete remains appropriate.");
    expect(next.conditions.find((item) => item.id === "cond-111-a")?.disposition).toMatchObject({
      action: "Delete",
      agreedWithRecommendation: false,
      comments: "Reviewed possible support; delete remains appropriate."
    });
  });

  it("does not require a manager override when delete safety support is advisory", () => {
    const data = openReview(cloneSeed(), "rev-111", user(seedData, "u-manager-1"));
    const next = setDisposition(data, "rev-111", "cond-111-a", user(data, "u-manager-1"), "Delete", true, settings);

    expect(next.conditions.find((item) => item.id === "cond-111-a")?.disposition?.action).toBe("Delete");
  });

  it("warns but does not block delete when curated conflicting evidence exists", () => {
    const data = openReview(cloneSeed(), "rev-112", user(seedData, "u-coder-3"));
    const review = data.reviews.find((item) => item.id === "rev-112")!;
    const condition = data.conditions.find((item) => item.id === "cond-112-a")!;
    const result = getRuleResult(condition, review, data, settings);
    expect(result.warnings[0]?.message).toContain("Conflicting or ambiguous");
    expect(result.disabledActions.some((item) => item.action === "Delete")).toBe(false);
    const next = setDisposition(data, "rev-112", "cond-112-a", user(data, "u-coder-3"), "Delete", true, settings);
    expect(next.conditions.find((item) => item.id === "cond-112-a")?.disposition?.action).toBe("Delete");
  });

  it("preserves presented category while current disposition summary changes", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-b", user(data, "u-coder-1"), "Validate", false, settings);
    const review = next.reviews.find((item) => item.id === "rev-100")!;
    expect(getPresentedOpportunitySummary(next, review).potentialDelete.count).toBe(1);
    expect(getDispositionSummary(next, review).Validated.count).toBe(1);
  });

  it("uses configurable prototype year for prospective routing", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const wrongYear = setDisposition(data, "rev-100", "cond-100-c", user(data, "u-coder-1"), "Send to Prospective", true, {
      ...settings,
      prototypeCurrentYear: 2025
    });
    const currentYear = setDisposition(data, "rev-100", "cond-100-c", user(data, "u-coder-1"), "Send to Prospective", true, settings);
    expect(wrongYear.downstreamTasks).toHaveLength(0);
    expect(currentYear.downstreamTasks).toHaveLength(1);
  });

  it("returns structured three-year lookback recapture results from curated evidence", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-113")!;
    const condition = data.conditions.find((item) => item.id === "cond-113-a")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
    const result = getRuleResult(condition, review, data, settings);

    expect(recommendation?.action).toBe("Yes");
    expect(recommendation?.rationale).toContain("2025-10-20 Claims");
    expect(recommendation?.rationale).toContain("2024-09-12 Specialist Note");
    expect(recommendation?.rationale).toContain("2023-12-01 MOR");
    expect(recommendation?.rationale).toContain("No current-year capture");
    expect(recommendation?.rationale).toContain("COPD follow-up on 2026-07-10");
    expect(result).toMatchObject({
      ruleId: "three-year-lookback-recapture",
      recommendedAction: "Yes",
      supportingEvidenceIds: expect.arrayContaining(["ev-rev-113-lookback-2025", "ev-rev-113-lookback-2024", "ev-rev-113-lookback-2023"])
    });
  });

  it("suppresses prospective recapture when the same patient-year HCC is already captured", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-113")!;
    const currentCapture = structuredClone(data.conditions.find((item) => item.id === "cond-113-a")!);
    data.conditions.push({
      ...currentCapture,
      id: "cond-113-current-capture",
      workflow: "codesOnClaim",
      category: "validated",
      subtype: undefined,
      claimStatus: "On claim",
      sourceDate: "2026-04-12",
      evidenceIds: ["ev-rev-113-a"],
      lookbackEvidenceIds: undefined,
      hasSufficientMeat: true,
      hasOtherSupportingEvidence: true,
      hasCurrentYearCapture: true,
      disposition: {
        action: "Validate",
        userId: "u-coder-4",
        decidedAt: "2026-06-24T10:00:00.000Z",
        agreedWithRecommendation: true,
        source: "user-selected"
      }
    });
    const condition = data.conditions.find((item) => item.id === "cond-113-a")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
    const result = getRuleResult(condition, review, data, settings);

    expect(recommendation?.action).toBe("No");
    expect(result.disabledActions).toEqual(expect.arrayContaining([expect.objectContaining({ action: "Yes", ruleId: "current-year-hcc-captured" })]));
  });

  it("excludes explicitly acute-only conditions from prospective recapture", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-114")!;
    const condition = data.conditions.find((item) => item.id === "cond-114-a")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
    const result = getRuleResult(condition, review, data, settings);

    expect(recommendation?.action).toBe("No");
    expect(recommendation?.rationale).toContain("acute-only");
    expect(result).toMatchObject({
      ruleId: "acute-only-recapture-exclusion",
      recommendedAction: "No",
      supportingEvidenceIds: expect.arrayContaining(["ev-rev-114-acute-2025"])
    });
    expect(result.disabledActions.some((item) => item.ruleId === "acute-only-recapture-exclusion")).toBe(false);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("advisory"), evidenceIds: expect.arrayContaining(["ev-rev-114-acute-2025"]) })]));
  });

  it("allows direct Yes selection for acute-only recapture when the reviewer disagrees", () => {
    const data = openReview(cloneSeed(), "rev-114", user(seedData, "u-coder-1"));
    const selected = setDisposition(data, "rev-114", "cond-114-a", user(data, "u-coder-1"), "Yes", false, settings);
    const allowed = setDisposition(data, "rev-114", "cond-114-a", user(data, "u-coder-1"), "No", true, settings);

    expect(selected.conditions.find((item) => item.id === "cond-114-a")?.disposition).toMatchObject({ action: "Yes", agreedWithRecommendation: false });
    expect(allowed.conditions.find((item) => item.id === "cond-114-a")?.disposition?.action).toBe("No");
  });

  it("allows acute recapture review only when synthetic later indicators are explicit", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-114")!;
    const condition = data.conditions.find((item) => item.id === "cond-114-a")!;
    condition.hasClinicalIndicators = true;
    condition.evidenceIds = [...condition.evidenceIds, "ev-rev-114-a"];
    condition.supportingEvidenceIds = ["ev-rev-114-a"];

    const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
    const result = getRuleResult(condition, review, data, settings);

    expect(recommendation?.action).toBe("Yes");
    expect(result.disabledActions.some((item) => item.ruleId === "acute-only-recapture-exclusion")).toBe(false);
  });

  it("suppresses lower-code direct capture when hierarchy replacement is present", () => {
    const data = openReview(cloneSeed(), "rev-116", user(seedData, "u-coder-3"));
    const review = data.reviews.find((item) => item.id === "rev-116")!;
    const condition = data.conditions.find((item) => item.id === "cond-116-a")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
    const result = getRuleResult(condition, review, data, settings);
    const blocked = setDisposition(data, "rev-116", "cond-116-a", user(data, "u-coder-3"), "Add to Claim", false, settings);
    const changed = setDisposition(data, "rev-116", "cond-116-a", user(data, "u-coder-3"), "Change", true, settings, undefined, "Use higher specificity", "E11.311");

    expect(recommendation).toMatchObject({ action: "Change", replacementCode: "E11.311" });
    expect(result.disabledActions).toEqual(expect.arrayContaining([expect.objectContaining({ action: "Add to Claim", ruleId: "hierarchy-trumping-suppression" })]));
    expect(blocked.conditions.find((item) => item.id === "cond-116-a")?.disposition).toBeUndefined();
    expect(changed.conditions.find((item) => item.id === "cond-116-a")?.disposition).toMatchObject({ action: "Change", replacementCode: "E11.311" });
  });

  it("warns without hard-disabling direct capture when a replacement code is only recommended", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const condition = data.conditions.find((item) => item.id === "cond-100-f")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
    const result = getRuleResult(condition, review, data, settings);
    const selected = setDisposition(data, "rev-100", "cond-100-f", user(data, "u-coder-1"), "Yes", false, settings);

    expect(recommendation).toMatchObject({ action: "Change", replacementCode: "E11.311" });
    expect(result.disabledActions.some((item) => item.action === "Yes")).toBe(false);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("Change is recommended") })]));
    expect(selected.conditions.find((item) => item.id === "cond-100-f")?.disposition?.action).toBe("Yes");
  });

  it("does not suppress an unrelated HCC because social context appears in evidence", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const condition = data.conditions.find((item) => item.id === "cond-100-e")!;
    const result = getRuleResult(condition, review, data, settings);
    const allowed = setDisposition(data, "rev-100", "cond-100-e", user(data, "u-coder-1"), "Add to Claim", false, settings);

    expect(condition.sdohCode).toBeUndefined();
    expect(result.disabledActions.some((item) => item.ruleId === "sdoh-context-suppression")).toBe(false);
    expect(allowed.conditions.find((item) => item.id === "cond-100-e")?.disposition?.action).toBe("Add to Claim");
  });

  it("recommends deletion rather than capture for quality-exclusion context", () => {
    const data = openReview(cloneSeed(), "rev-115", user(seedData, "u-coder-2"));
    const review = data.reviews.find((item) => item.id === "rev-115")!;
    const condition = data.conditions.find((item) => item.id === "cond-115-a")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
    const result = getRuleResult(condition, review, data, settings);
    const blocked = setDisposition(data, "rev-115", "cond-115-a", user(data, "u-coder-2"), "Validate", false, settings);
    const deleted = setDisposition(data, "rev-115", "cond-115-a", user(data, "u-coder-2"), "Delete", true, settings);

    expect(recommendation?.action).toBe("Delete");
    expect(result.ruleId).toBe("quality-exclusion-suppression");
    expect(result.disabledActions).toEqual(expect.arrayContaining([expect.objectContaining({ action: "Validate", ruleId: "quality-exclusion-suppression" })]));
    expect(blocked.conditions.find((item) => item.id === "cond-115-a")?.disposition).toBeUndefined();
    expect(deleted.conditions.find((item) => item.id === "cond-115-a")?.disposition?.action).toBe("Delete");
  });
});

describe("RAF, audit, assignment, stats, and exports", () => {
  it("calculates separated synthetic RAF metrics without double-counting prospective RAF", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const summary = getRafSummary(data, review);
    expect(summary.demographicRaf).toBeCloseTo(0.421);
    expect(summary.unresolvedPotentialRaf).toBeCloseTo(0.121 + 0.318 + 0.309);
    expect(summary.potentialAdditionRaf).toBeCloseTo(0.318 + 0.309);
    expect(summary.potentialDeletionRaf).toBeCloseTo(0.121);
    expect(summary.prospectiveRecaptureRaf).toBeCloseTo(0.323);
    expect(summary.prospectiveSuspectRaf).toBeCloseTo(0.318);
    expect(summary.projectedRaf).toBeCloseTo(0.421);
  });

  it("deduplicates captured RAF by patient, calendar year, and HCC", () => {
    let data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    data = setDisposition(data, "rev-100", "cond-100-a", user(data, "u-coder-1"), "Validate", true, settings);
    data = setDisposition(data, "rev-100", "cond-100-d", user(data, "u-coder-1"), "Add to Claim", true, settings);
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const summary = getRafSummary(data, review);
    expect(summary.validatedCapturedRaf).toBeCloseTo(0.318);
    expect(summary.projectedRaf).toBeCloseTo(0.421 + 0.318);
  });

  it("calculates population RAF totals and averages for manager reporting", () => {
    const data = cloneSeed();
    const summary = getPopulationRafSummary(data);
    const demographicTotal = data.patients.reduce((sum, patient) => sum + patient.demographicRaf, 0);

    expect(summary.patientCount).toBe(data.patients.length);
    expect(summary.reviewCount).toBe(data.reviews.length);
    expect(summary.totals.demographicRaf).toBeCloseTo(demographicTotal);
    expect(summary.totals.capturedRaf).toBeGreaterThan(0);
    expect(summary.totals.openRaf).toBeGreaterThan(0);
    expect(summary.totals.prospectiveRaf).toBeGreaterThan(0);
    expect(summary.totals.deletionRaf).toBeGreaterThanOrEqual(0);
    expect(summary.totals.projectedRaf).toBeCloseTo(summary.totals.demographicRaf + summary.totals.capturedRaf - summary.totals.deletionRaf);
    expect(summary.averages.demographicRaf).toBeCloseTo(summary.totals.demographicRaf / summary.patientCount);
    expect(summary.averages.projectedRaf).toBeCloseTo(summary.totals.projectedRaf / summary.patientCount);
  });

  it("uses deterministic audit sampling setting", () => {
    expect(shouldSampleReviewForAudit("rev-100", 0)).toBe(false);
    expect(shouldSampleReviewForAudit("rev-100", 100)).toBe(true);
    expect(shouldSampleReviewForAudit("rev-100", 25)).toBe(shouldSampleReviewForAudit("rev-100", 25));
  });

  it("builds an audit sampling profile across presented opportunity categories", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const profile = getAuditSamplingProfile(data, review, 25);
    expect(profile.sampleBucket).toBeGreaterThanOrEqual(0);
    expect(profile.sampleBucket).toBeLessThan(100);
    expect(profile.sampleCategories).toEqual(expect.arrayContaining(["validated", "potentialDelete", "potentialAddition", "prospective"]));
  });

  it("uses audit sample setting when completing a review", () => {
    const noAudit = disposeRev100(cloneSeed(), 0);
    const withAudit = disposeRev100(cloneSeed(), 100);
    expect(noAudit.data.reviews.find((item) => item.id === "rev-100")?.status).toBe("Completed");
    expect(withAudit.data.reviews.find((item) => item.id === "rev-100")?.status).toBe("Under Audit");
    expect(withAudit.data.audits.find((item) => item.reviewId === "rev-100")).toMatchObject({
      selectionSource: "deterministic-sample",
      sampleRate: 100,
      sampleCategories: expect.arrayContaining(["potentialAddition", "potentialDelete", "prospective", "validated"])
    });
    expect(withAudit.data.history[0].detail).toContain("configured 100% audit percentage");
  });

  it("distinguishes manually started audit work from sampled audits", () => {
    const data = cloneSeed();
    const next = startAudit(data, "rev-108", user(data, "u-auditor-1"));
    const audit = next.audits.find((item) => item.reviewId === "rev-108")!;
    expect(audit.selectionSource).toBe("manual");
    expect(audit.sampleRate).toBeUndefined();
  });

  it("returns audit work to original reviewer as Rework Required", () => {
    const data = cloneSeed();
    const next = completeAudit(data, "rev-105", user(data, "u-auditor-1"), "Return for Correction", "Fix MEAT support");
    const review = next.reviews.find((item) => item.id === "rev-105")!;
    const audit = next.audits.find((item) => item.reviewId === "rev-105")!;
    expect(review.status).toBe("Rework Required");
    expect(review.queue).toBe("CDI/Coder Queue");
    expect(review.assignedUserId).toBe("u-coder-2");
    expect(review.assignedAuditorId).toBeUndefined();
    expect(review.auditReturn?.comments).toBe("Fix MEAT support");
    expect(audit.status).toBe("Returned");
  });

  it("prevents completed audit actions unless reopened", () => {
    const data = cloneSeed();
    const completedAgain = completeAudit(data, "rev-109", user(data, "u-auditor-1"), "Disagree", "Late disagreement");
    expect(completedAgain.audits.find((item) => item.reviewId === "rev-109")?.outcome).toBe("Agree");
  });

  it("keeps temporary coverage separate from original assignment and records permanent reassignment", () => {
    const data = cloneSeed();
    const coverage = assignReview(data, "rev-106", user(data, "u-manager-1"), "u-coder-4", "Coverage", "Coverage day");
    expect(coverage.reviews.find((item) => item.id === "rev-106")?.assignedUserId).toBe("u-coder-3");
    expect(coverage.reviews.find((item) => item.id === "rev-106")?.coverage).toMatchObject({
      originalAssignedUserId: "u-coder-3",
      coveringUserId: "u-coder-4",
      initiatedByUserId: "u-manager-1"
    });
    expect(coverage.clinics.find((item) => item.id === "clinic-lake")?.defaultAssigneeId).toBe("u-coder-3");
    const permanent = assignReview(data, "rev-106", user(data, "u-manager-1"), "u-coder-4", "Permanent reassignment", "Panel move");
    expect(permanent.reviews.find((item) => item.id === "rev-106")?.assignedUserId).toBe("u-coder-4");
    expect(permanent.reviews.find((item) => item.id === "rev-106")?.coverage).toBeUndefined();
    expect(permanent.clinics.find((item) => item.id === "clinic-lake")?.defaultAssigneeId).toBe("u-coder-4");
    expect(permanent.history[0].detail).toContain("Panel move");
  });

  it("allows a CDI/Coder to take coverage without changing the original assignee", () => {
    const data = cloneSeed();
    const covered = takeCoverage(data, "rev-100", user(data, "u-coder-2"));
    const review = covered.reviews.find((item) => item.id === "rev-100")!;
    expect(review.assignedUserId).toBe("u-coder-1");
    expect(review.coverage).toMatchObject({
      originalAssignedUserId: "u-coder-1",
      coveringUserId: "u-coder-2",
      initiatedByUserId: "u-coder-2"
    });
    expect(review.lock?.lockedByUserId).toBe("u-coder-2");
    expect(canOpenReview(covered, review, user(covered, "u-coder-2"))).toBe(true);
    expect(covered.history[0]).toMatchObject({ event: "Coverage assignment taken", reviewId: "rev-100", userId: "u-coder-2" });
  });

  it("prevents concurrent coverage from being taken by another CDI/Coder", () => {
    const data = takeCoverage(cloneSeed(), "rev-100", user(seedData, "u-coder-2"));
    const second = takeCoverage(data, "rev-100", user(data, "u-coder-3"));
    const review = second.reviews.find((item) => item.id === "rev-100")!;
    expect(review.coverage?.coveringUserId).toBe("u-coder-2");
    expect(review.lock?.lockedByUserId).toBe("u-coder-2");
  });

  it("calculates personal statistics only for the selected user", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-a", user(data, "u-coder-1"), "Validate", true, settings);
    const coderOneStats = getPersonalStats(next, user(next, "u-coder-1"));
    const coderFourStats = getPersonalStats(next, user(next, "u-coder-4"));
    expect(coderOneStats.validations).toBe(1);
    expect(coderFourStats.validations).toBe(0);
  });

  it("generates exports from downstream tasks instead of duplicate generic seed records", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-d", user(data, "u-coder-1"), "Add to Claim", true, settings);
    const exports = getGeneratedExports(next);
    expect(exports.filter((record) => record.id === "generated-addition")).toHaveLength(1);
    expect(exports.find((record) => record.id === "generated-addition")?.rows[0]).toMatchObject({ reviewId: "rev-100", icd10: "E11.40" });
  });

  it("does not create export records or captured RAF from recommendations alone", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const recommendedAddition = data.conditions.find((item) => item.id === "cond-100-d")!;
    const recommendation = decisionSupportService.getRecommendation(recommendedAddition, review, data, settings);
    const exports = getGeneratedExports(data);
    const rafSummary = getRafSummary(data, review);

    expect(recommendation?.action).toBe("Add to Claim");
    expect(exports.find((record) => record.id === "generated-addition")?.rows.some((row) => row.reviewId === "rev-100" && row.icd10 === "E11.40")).toBe(false);
    expect(rafSummary.validatedCapturedRaf).toBeCloseTo(0);
  });

  it("creates and advances scheduling outreach when a prospective action has no same-year appointment", () => {
    let data = cloneSeed();
    data.appointments = data.appointments.filter((appointment) => appointment.patientId !== "pat-113");
    data = openReview(data, "rev-113", user(data, "u-coder-4"));
    data = setDisposition(data, "rev-113", "cond-113-a", user(data, "u-coder-4"), "Yes", true, settings);
    const outreach = data.downstreamTasks.find((task) => task.reviewId === "rev-113" && task.type === "Scheduling Outreach")!;
    expect(outreach).toMatchObject({ status: "Open", queue: "Scheduling Outreach Queue", assignedUserId: "u-coder-4" });
    expect(getOutreachStatusForReview(data, data.reviews.find((item) => item.id === "rev-113")!)).toMatchObject({ status: "Open" });

    data = updateDownstreamTaskStatus(data, outreach.id, user(data, "u-coder-4"), "In Progress");
    expect(data.downstreamTasks.find((task) => task.id === outreach.id)?.status).toBe("In Progress");
    expect(data.history[0]).toMatchObject({ event: "Downstream task updated", conditionId: "cond-113-a" });
  });

  it("does not create scheduling outreach when a same-patient appointment exists", () => {
    let data = openReview(cloneSeed(), "rev-113", user(seedData, "u-coder-4"));
    data = setDisposition(data, "rev-113", "cond-113-a", user(data, "u-coder-4"), "Yes", true, settings);
    expect(data.downstreamTasks.some((task) => task.reviewId === "rev-113" && task.type === "Scheduling Outreach")).toBe(false);
    expect(getOutreachStatusForReview(data, data.reviews.find((item) => item.id === "rev-113")!)).toMatchObject({ status: "Scheduled" });
  });

  it("derives source and scenario discovery tags from seeded review data", () => {
    const data = cloneSeed();
    const rev100 = data.reviews.find((item) => item.id === "rev-100")!;
    const rev103 = data.reviews.find((item) => item.id === "rev-103")!;
    const rev110 = data.reviews.find((item) => item.id === "rev-110")!;
    const rev111 = data.reviews.find((item) => item.id === "rev-111")!;
    const rev113 = data.reviews.find((item) => item.id === "rev-113")!;
    const rev114 = data.reviews.find((item) => item.id === "rev-114")!;
    const rev115 = data.reviews.find((item) => item.id === "rev-115")!;
    const rev116 = data.reviews.find((item) => item.id === "rev-116")!;
    const rev107 = data.reviews.find((item) => item.id === "rev-107")!;
    expect(getReviewScenarioTags(data, rev100)).toEqual(expect.arrayContaining(["HIE", "MOR", "Payer Data", "Registry", "Specialist Note"]));
    expect(getReviewScenarioTags(data, rev100)).toContain("Duplicate HCC addition");
    expect(getReviewScenarioTags(data, rev103)).toContain("Ineligible CPT");
    expect(getReviewScenarioTags(data, rev110)).toContain("Same-HCC threshold");
    expect(getReviewScenarioTags(data, rev111)).toContain("Delete safety");
    expect(getReviewScenarioTags(data, rev113)).toContain("Three-year lookback");
    expect(getReviewScenarioTags(data, rev114)).toEqual(expect.arrayContaining(["Acute condition", "Acute-only recapture"]));
    expect(getReviewScenarioTags(data, rev115)).toContain("Quality exclusion");
    expect(getReviewScenarioTags(data, rev116)).toContain("Trumping");
    expect(getReviewScenarioTags(data, rev107)).toContain("Scheduling outreach");
  });

  it("does not count prospective recapture RAF until selected by a user", () => {
    let data = openReview(cloneSeed(), "rev-113", user(seedData, "u-coder-4"));
    const review = data.reviews.find((item) => item.id === "rev-113")!;
    expect(getRafSummary(data, review).validatedCapturedRaf).toBeCloseTo(0);
    data = setDisposition(data, "rev-113", "cond-113-a", user(data, "u-coder-4"), "Yes", true, settings);
    expect(getRafSummary(data, review).validatedCapturedRaf).toBeCloseTo(0.214);
  });

  it("records recommendation agreement only after the reviewer acts", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const before = getPersonalStats(data, user(data, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-a", user(data, "u-coder-1"), "Validate", true, settings);
    const after = getPersonalStats(next, user(next, "u-coder-1"));

    expect(data.conditions.find((item) => item.id === "cond-100-a")?.disposition).toBeUndefined();
    expect(after.validations).toBe(before.validations + 1);
    expect(next.conditions.find((item) => item.id === "cond-100-a")?.disposition?.agreedWithRecommendation).toBe(true);
  });
});

describe("prototype decision support", () => {
  it("derives validate from claim plus sufficient MEAT", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const condition = data.conditions.find((item) => item.id === "cond-100-a")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
    expect(recommendation?.action).toBe("Validate");
    expect(recommendation?.source).toBe("rules");
  });

  it("can hide recommendation assistance without changing cases", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const condition = data.conditions.find((item) => item.id === "cond-100-c")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, {
      ...settings,
      recommendationMode: "hidden"
    });
    expect(recommendation).toBeUndefined();
  });
});

