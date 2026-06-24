import type { AppSettings, Condition, PatientReview, Recommendation, SeedData } from "../domain/types";

export interface DecisionSupportService {
  getRecommendation(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): Recommendation | undefined;
  getDisplayLabel(recommendation: Recommendation, settings: AppSettings): string;
}

export class PrototypeDecisionSupportService implements DecisionSupportService {
  getRecommendation(condition: Condition, review: PatientReview, _data: SeedData, settings: AppSettings): Recommendation | undefined {
    if (settings.recommendationMode === "hidden") return undefined;
    if (condition.seededRecommendation) return condition.seededRecommendation;

    if (condition.resolvedFlag) {
      return {
        action: "Disagree",
        confidence: "High",
        source: "rules",
        rationale: "Structured review data marks the condition as resolved."
      };
    }

    if (condition.workflow === "prospective") {
      if (condition.subtype === "recapture" && condition.hadPriorCapture && !condition.hasCurrentYearCapture) {
        return {
          action: "Yes",
          confidence: "High",
          source: "rules",
          rationale: "Prior historical capture exists without current-year capture, so this is a recapture opportunity."
        };
      }
      if (condition.subtype === "suspect" && condition.hasClinicalIndicators && !condition.hadPriorCapture) {
        return {
          action: "Yes",
          confidence: "Medium",
          source: "rules",
          rationale: "Current clinical indicators exist without prior capture, so this is a suspect opportunity."
        };
      }
    }

    if (condition.workflow === "codesOnClaim") {
      if (condition.hasSufficientMeat) {
        return {
          action: "Validate",
          confidence: "High",
          source: "rules",
          rationale: "The code is on a risk-eligible claim and current documentation supports MEAT."
        };
      }
      if (condition.currentYear && condition.hasOtherSupportingEvidence) {
        return {
          action: "Send to Prospective",
          confidence: "Medium",
          source: "rules",
          rationale: "MEAT is incomplete, but current-year supporting evidence remains available for prospective follow-up."
        };
      }
      if (!condition.hasOtherSupportingEvidence) {
        return {
          action: "Delete",
          confidence: "Medium",
          source: "rules",
          rationale: "The claim contains the HCC, but no other supporting calendar-year evidence is present in the prototype data."
        };
      }
    }

    if (condition.workflow === "codesNotOnClaim") {
      if (condition.hasSufficientMeat) {
        return {
          action: "Add to Claim",
          confidence: "High",
          source: "rules",
          rationale: "The HCC is not on a risk-eligible claim and structured evidence supports capture."
        };
      }
      if (condition.conflictingEvidence) {
        return {
          action: "Disagree",
          confidence: "Medium",
          source: "rules",
          rationale: "Conflicting evidence is present and should be resolved before claim action."
        };
      }
    }

    if (review.reviewType === "Prospective" && condition.hasClinicalIndicators) {
      return {
        action: "Yes",
        confidence: "Low",
        source: "rules",
        rationale: "Prospective review contains structured indicators that should be considered by a CDI specialist."
      };
    }

    return undefined;
  }

  getDisplayLabel(recommendation: Recommendation, settings: AppSettings) {
    if (settings.recommendationMode === "rules" && recommendation.source === "rules") {
      return "Rule-based decision support";
    }
    return "Simulated AI recommendation - prototype only";
  }
}

export const decisionSupportService = new PrototypeDecisionSupportService();
