import { describe, expect, it } from "vitest";

import { demoSeedData } from "../data/seed";
import { decisionSupportService } from "../decisionSupport/DecisionSupportService";
import { getConditionEvidenceEligibility } from "./evidenceEligibility";
import type { AppSettings } from "./types";

const settings: AppSettings = {
  recommendationMode: "rules",
  auditSampleRate: 10,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

describe("source-specific evidence eligibility", () => {
  it("keeps Angela Rossi's structurally owned E11.22 assessment and plan evidence", () => {
    const review = demoSeedData.reviews.find((item) => item.id === "rev-108")!;
    const condition = demoSeedData.conditions.find((item) => item.id === "cond-108-a")!;
    const eligibility = getConditionEvidenceEligibility(condition, review, demoSeedData);

    expect(eligibility.eligibleCurrentClinicalEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ownership: "structured", sourceType: "planSentence", currentYearSupport: true })
      ])
    );
    expect(decisionSupportService.getRecommendation(condition, review, demoSeedData, settings)).toMatchObject({
      action: "Validate",
      confidence: "High"
    });
  });

  it("does not let a claim-level signature flag erase eligible signed-note support", () => {
    const data = structuredClone(demoSeedData);
    const review = data.reviews.find((item) => item.id === "rev-108")!;
    const condition = data.conditions.find((item) => item.id === "cond-108-a")!;
    const claim = data.claims.find((item) => item.id === "claim-rev-108")!;
    claim.providerSignatureValid = false;

    expect(getConditionEvidenceEligibility(condition, review, data)).toMatchObject({
      hasEligibleClaimForAction: true,
      hasEligibleCurrentClinicalSupport: true
    });
    expect(decisionSupportService.getRecommendation(condition, review, data, settings)?.action).toBe("Validate");
  });
});
