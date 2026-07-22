import { describe, expect, it } from "vitest";

import { demoSeedData } from "../data/seed";
import { deriveConditionReviewModel, deriveReviewContext } from "./conditionReviewModel";
import type { AppSettings } from "./types";

const settings: AppSettings = {
  recommendationMode: "rules",
  auditSampleRate: 0,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

describe("derived condition review model", () => {
  it("recommends validation for Angela's supported current-year E11.22 claim", () => {
    const review = demoSeedData.reviews.find((item) => item.id === "rev-108")!;
    const condition = demoSeedData.conditions.find((item) => item.id === "cond-108-a")!;
    const model = deriveConditionReviewModel(condition, review, demoSeedData, settings);

    expect(model).toMatchObject({
      reviewContext: "scheduledUpcomingVisit",
      captureState: "currentYearClaim",
      resolutionState: "open",
      recommendation: { decision: "validate", confidence: "High" },
      downstreamRoute: "none",
      appointmentId: "appt-108"
    });
    expect(model.availableDecisions).toContain("validate");
    expect(model.availableRoutes).toEqual([]);
  });

  it.each(["cond-108-b", "cond-108-c"])("routes Angela's scheduled opportunity %s to a provider query", (conditionId) => {
    const review = demoSeedData.reviews.find((item) => item.id === "rev-108")!;
    const condition = demoSeedData.conditions.find((item) => item.id === conditionId)!;
    const model = deriveConditionReviewModel(condition, review, demoSeedData, settings);

    expect(model.recommendation).toMatchObject({ decision: "prepareProviderQuery", route: "providerQueryTask" });
    expect(model.availableDecisions).toEqual(["prepareProviderQuery", "dismiss", "changeCode"]);
    expect(model.availableRoutes).toEqual(["providerQueryTask"]);
    expect(model.availableRoutes).not.toContain("prospectiveHold");
  });

  it("uses a year-neutral prospective hold when there is no attached visit", () => {
    const review = demoSeedData.reviews.find((item) => item.id === "rev-107")!;
    const condition = demoSeedData.conditions.find((item) => item.id === "cond-107-c")!;
    const model = deriveConditionReviewModel(condition, review, demoSeedData, settings);

    expect(model).toMatchObject({
      reviewContext: "noUpcomingVisit",
      recommendation: { route: "prospectiveHold" },
      availableRoutes: ["prospectiveHold"]
    });
    expect(model.appointmentId).toBeUndefined();
  });

  it("keeps prior-year reconciliation free of prospective and provider-query routes", () => {
    const review = demoSeedData.reviews.find((item) => item.id === "rev-102")!;
    const condition = demoSeedData.conditions.find((item) => item.id === "cond-102-a")!;
    const model = deriveConditionReviewModel(condition, review, demoSeedData, settings);

    expect(deriveReviewContext({ ...review, reviewType: "Prospective" }, demoSeedData, settings)).toBe("retrospective");
    expect(model.availableDecisions).toEqual(["validate", "delete", "changeCode"]);
    expect(model.availableRoutes).toEqual([]);
  });

  it("hides recommendations and actions after a current-year capture decision", () => {
    const data = structuredClone(demoSeedData);
    const review = data.reviews.find((item) => item.id === "rev-108")!;
    const condition = data.conditions.find((item) => item.id === "cond-108-a")!;
    condition.decision = { decision: "validate", userId: "u-coder-1", decidedAt: "2026-06-24T10:00:00.000Z" };
    condition.disposition = { action: "Validate", userId: "u-coder-1", decidedAt: "2026-06-24T10:00:00.000Z" };

    expect(deriveConditionReviewModel(condition, review, data, settings)).toMatchObject({
      resolutionState: "resolved",
      resolvedLabel: "Captured for 2026",
      availableDecisions: [],
      availableRoutes: []
    });
  });
});
