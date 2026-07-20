import { describe, expect, it } from "vitest";
import { demoSeedData } from "../data/seed";
import { compareConditionsByHierarchy, getConditionClinicalFamily, getConditionHierarchySuppression } from "./conditionRisk";
import { getUnresolvedConditions } from "./selectors";
import { completeReview, openReview, setDisposition } from "./workflows";

const settings = {
  recommendationMode: "simulated" as const,
  auditSampleRate: 25,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

describe("human-only V28 hierarchy state", () => {
  it("orders related diabetes diagnoses by HCC hierarchy and documented specificity", () => {
    const data = structuredClone(demoSeedData);
    const patient = data.patients.find((item) => item.id === "pat-100")!;
    const diabetes = data.conditions
      .filter((condition) => condition.reviewId === "rev-100" && getConditionClinicalFamily(condition)?.key === "diabetes")
      .sort((left, right) => compareConditionsByHierarchy(left, right, patient));

    expect(diabetes.map((condition) => condition.icd10)).toEqual(["E11.42", "E11.51", "E11.40", "E11.65"]);
  });

  it("does not lock a lower HCC from flags, seeded recommendations, or prospective Yes", () => {
    const data = structuredClone(demoSeedData);
    const review = data.reviews.find((item) => item.id === "rev-116")!;
    const lower = data.conditions.find((item) => item.id === "cond-116-a")!;
    const higher = data.conditions.find((item) => item.id === "cond-116-b")!;

    higher.disposition = undefined;
    higher.hasCurrentYearCapture = true;
    higher.seededRecommendation = { action: "Validate", confidence: "High", source: "seeded", rationale: "Advisory only" };
    expect(getConditionHierarchySuppression(lower, review, data).fullySuppressed).toBe(false);

    higher.disposition = {
      action: "Yes",
      userId: "u-coder-3",
      decidedAt: "2026-07-16T10:00:00.000Z",
      source: "user-selected"
    };
    expect(getConditionHierarchySuppression(lower, review, data).fullySuppressed).toBe(false);
  });

  it("locks the visible lower HCC after human validation and records the event", () => {
    let data = structuredClone(demoSeedData);
    const reviewer = data.users.find((item) => item.id === "u-coder-3")!;
    data.conditions.find((item) => item.id === "cond-116-b")!.disposition = undefined;
    data = openReview(data, "rev-116", reviewer);
    const review = data.reviews.find((item) => item.id === "rev-116")!;
    const lowerBefore = data.conditions.find((item) => item.id === "cond-116-a")!;
    expect(getConditionHierarchySuppression(lowerBefore, review, data).fullySuppressed).toBe(false);
    expect(getUnresolvedConditions(data, review).map((item) => item.id)).toContain(lowerBefore.id);

    data = setDisposition(data, review.id, "cond-116-b", reviewer, "Validate", true, settings);
    const lowerAfter = data.conditions.find((item) => item.id === "cond-116-a")!;
    const suppression = getConditionHierarchySuppression(lowerAfter, review, data);
    expect(suppression).toMatchObject({
      fullySuppressed: true,
      suppressedHccs: [expect.objectContaining({ lower: "HCC38", higher: "HCC37" })]
    });
    expect(getUnresolvedConditions(data, review).map((item) => item.id)).not.toContain(lowerAfter.id);
    expect(data.history.some((entry) => entry.event === "Hierarchy lock applied")).toBe(false);
    data = completeReview(data, review.id, reviewer, { ...settings, auditSampleRate: 0 }).data;
    expect(data.history).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "Hierarchy lock applied", conditionId: lowerAfter.id, detail: expect.stringContaining("HCC38") })
    ]));
  });
});
