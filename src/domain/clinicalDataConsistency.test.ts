import { describe, expect, it } from "vitest";

import { demoSeedData } from "../data/seed";
import { getClinicalDataConsistencyErrors } from "./clinicalDataConsistency";
import type { AppSettings } from "./types";

const settings: AppSettings = {
  recommendationMode: "rules",
  auditSampleRate: 10,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

describe("clinical data consistency", () => {
  it("accepts the coherent demo scenarios", () => {
    expect(getClinicalDataConsistencyErrors(demoSeedData, settings)).toEqual([]);
  });

  it("rejects dangling evidence and contradictory claim capture facts", () => {
    const data = structuredClone(demoSeedData);
    const condition = data.conditions.find((item) => item.id === "cond-108-a")!;
    condition.evidenceIds.push("missing-evidence");
    condition.hasCurrentYearCapture = false;

    expect(getClinicalDataConsistencyErrors(data, settings)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing-evidence"),
        expect.stringContaining("hasCurrentYearCapture is false")
      ])
    );
  });

  it("rejects final reviews that still contain unresolved actionable conditions", () => {
    const data = structuredClone(demoSeedData);
    const review = data.reviews.find((item) => item.id === "rev-108")!;
    review.status = "Completed";

    expect(getClinicalDataConsistencyErrors(data, settings)).toEqual([
      expect.stringContaining("rev-108 is Completed with unresolved conditions")
    ]);
  });
});
