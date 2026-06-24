// @ts-expect-error Vitest runs in Node; this prototype does not include @types/node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seedData } from "../data/seed";
import { decisionSupportService } from "../decisionSupport/DecisionSupportService";
import { canAccessRoute } from "./auth";
import {
  assignReview,
  completeAudit,
  completeReview,
  flagDocumentationIssue,
  openReview,
  overrideLock,
  releaseReview,
  routeReview,
  setDisposition,
  shouldSampleReviewForAudit,
  takeCoverage
} from "./workflows";
import { getDispositionSummary, getGeneratedExports, getPersonalStats, getPresentedOpportunitySummary, getRafSummary, getReviewScenarioTags } from "./selectors";
import type { AppSettings, SeedData } from "./types";

const settings: AppSettings = {
  recommendationMode: "rules",
  auditSampleRate: 25,
  prototypeCurrentYear: 2026
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
  next = setDisposition(next, "rev-100", "cond-100-f", user(data, "u-coder-1"), "Yes", true, settings);
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
    expect(canAccessRoute(user(data, "u-auditor-1"), "audit")).toBe(true);
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
    expect(review.queue).toBe("Assigned Coder");
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

  it("blocks completion while actionable conditions are unresolved", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const result = completeReview(data, "rev-100", user(data, "u-coder-1"), settings);
    expect(result.unresolved.length).toBeGreaterThan(0);
    expect(result.data.reviews.find((item) => item.id === "rev-100")?.status).toBe("In Progress");
  });

  it("disables duplicate same-HCC additions after one add-to-claim selection", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-d", user(data, "u-coder-1"), "Add to Claim", true, settings);
    const duplicate = next.conditions.find((item) => item.id === "cond-100-e")!;
    expect(duplicate.disabledReason).toContain("HCC 37");
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

  it("uses deterministic audit sampling setting", () => {
    expect(shouldSampleReviewForAudit("rev-100", 0)).toBe(false);
    expect(shouldSampleReviewForAudit("rev-100", 100)).toBe(true);
    expect(shouldSampleReviewForAudit("rev-100", 25)).toBe(shouldSampleReviewForAudit("rev-100", 25));
  });

  it("uses audit sample setting when completing a review", () => {
    const noAudit = disposeRev100(cloneSeed(), 0);
    const withAudit = disposeRev100(cloneSeed(), 100);
    expect(noAudit.data.reviews.find((item) => item.id === "rev-100")?.status).toBe("Completed");
    expect(withAudit.data.reviews.find((item) => item.id === "rev-100")?.status).toBe("Under Audit");
  });

  it("returns audit work to original reviewer as Rework Required", () => {
    const data = cloneSeed();
    const next = completeAudit(data, "rev-105", user(data, "u-auditor-1"), "Return for Correction", "Fix MEAT support");
    const review = next.reviews.find((item) => item.id === "rev-105")!;
    const audit = next.audits.find((item) => item.reviewId === "rev-105")!;
    expect(review.status).toBe("Rework Required");
    expect(review.queue).toBe("Assigned Coder");
    expect(review.assignedCoderId).toBe("u-coder-2");
    expect(review.assignedAuditorId).toBeUndefined();
    expect(review.auditReturn?.comments).toBe("Fix MEAT support");
    expect(audit.status).toBe("Returned");
  });

  it("prevents completed audit actions unless reopened", () => {
    const data = cloneSeed();
    const completedAgain = completeAudit(data, "rev-109", user(data, "u-auditor-2"), "Disagree", "Late disagreement");
    expect(completedAgain.audits.find((item) => item.reviewId === "rev-109")?.outcome).toBe("Agree");
  });

  it("keeps coverage assignment separate from clinic defaults and records permanent reassignment", () => {
    const data = cloneSeed();
    const coverage = takeCoverage(data, "rev-106", user(data, "u-coder-4"));
    expect(coverage.reviews.find((item) => item.id === "rev-106")?.assignedCoderId).toBe("u-coder-4");
    expect(coverage.clinics.find((item) => item.id === "clinic-lake")?.defaultCoderId).toBe("u-coder-3");
    const permanent = assignReview(data, "rev-106", user(data, "u-manager-2"), "u-coder-4", "Permanent reassignment", "Panel move");
    expect(permanent.clinics.find((item) => item.id === "clinic-lake")?.defaultCoderId).toBe("u-coder-4");
    expect(permanent.history[0].detail).toContain("Panel move");
  });

  it("calculates personal statistics only for the selected user", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-a", user(data, "u-coder-1"), "Validate", true, settings);
    const coderOneStats = getPersonalStats(next, user(next, "u-coder-1"));
    const coderSixStats = getPersonalStats(next, user(next, "u-coder-6"));
    expect(coderOneStats.validations).toBe(1);
    expect(coderSixStats.validations).toBe(0);
  });

  it("generates exports from downstream tasks instead of duplicate generic seed records", () => {
    const data = openReview(cloneSeed(), "rev-100", user(seedData, "u-coder-1"));
    const next = setDisposition(data, "rev-100", "cond-100-d", user(data, "u-coder-1"), "Add to Claim", true, settings);
    const exports = getGeneratedExports(next);
    expect(exports.filter((record) => record.id === "generated-addition")).toHaveLength(1);
    expect(exports.find((record) => record.id === "generated-addition")?.rows[0]).toMatchObject({ reviewId: "rev-100", icd10: "E11.40" });
  });

  it("derives source and scenario discovery tags from seeded review data", () => {
    const data = cloneSeed();
    const rev100 = data.reviews.find((item) => item.id === "rev-100")!;
    const rev103 = data.reviews.find((item) => item.id === "rev-103")!;
    expect(getReviewScenarioTags(data, rev100)).toEqual(expect.arrayContaining(["HIE", "MOR", "Payer Data", "Registry", "Specialist Note"]));
    expect(getReviewScenarioTags(data, rev103)).toContain("Ineligible CPT");
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
