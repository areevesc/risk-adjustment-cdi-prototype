import { decisionSupportService } from "../decisionSupport/DecisionSupportService";
import { isRiskAdjustmentCondition } from "./conditionRisk";
import { getUnresolvedConditions } from "./selectors";
import type { AppSettings, RecommendationAction, SeedData } from "./types";

const evidenceDependentActions = new Set<RecommendationAction>(["Validate", "Add to Claim", "Yes", "Send to Prospective", "Change"]);
const finalStatuses = new Set(["Completed", "Under Audit", "Audit Complete"]);

export function getClinicalDataConsistencyErrors(data: SeedData, settings: AppSettings) {
  const errors: string[] = [];
  const conditionsById = new Map(data.conditions.map((condition) => [condition.id, condition]));
  const evidenceById = new Map(data.evidence.map((evidence) => [evidence.id, evidence]));

  for (const condition of data.conditions) {
    for (const evidenceId of condition.evidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) errors.push(`${condition.id} references missing evidence ${evidenceId}.`);
      else if (!evidence.conditionIds.includes(condition.id)) errors.push(`${condition.id} and ${evidenceId} have one-way ownership.`);
    }
  }

  for (const evidence of data.evidence) {
    for (const conditionId of evidence.conditionIds) {
      const condition = conditionsById.get(conditionId);
      if (!condition) errors.push(`${evidence.id} references missing condition ${conditionId}.`);
      else if (condition.reviewId !== evidence.reviewId) errors.push(`${evidence.id} crosses review boundaries to ${conditionId}.`);
      else if (!condition.evidenceIds.includes(evidence.id)) errors.push(`${evidence.id} and ${conditionId} have one-way ownership.`);
    }
  }

  for (const review of data.reviews) {
    const currentClaimCodes = new Set(
      data.claims
        .filter((claim) => claim.reviewId === review.id && Number(claim.dateOfService.slice(0, 4)) === review.calendarYear)
        .flatMap((claim) => claim.icd10Codes)
    );
    const reviewConditions = data.conditions.filter((condition) => condition.reviewId === review.id);
    for (const condition of reviewConditions.filter((item) => isRiskAdjustmentCondition(item) && item.actionable)) {
      if (condition.workflow === "codesOnClaim" && !currentClaimCodes.has(condition.icd10)) {
        errors.push(`${condition.id} is classified on-claim but ${condition.icd10} is absent from the current claim.`);
      }
      if (condition.workflow === "codesNotOnClaim" && currentClaimCodes.has(condition.icd10)) {
        errors.push(`${condition.id} is classified off-claim but ${condition.icd10} is present on the current claim.`);
      }
      if (condition.workflow === "codesOnClaim" && !condition.hasCurrentYearCapture) {
        errors.push(`${condition.id} is on the review-year claim but hasCurrentYearCapture is false.`);
      }

      const recommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
      if (recommendation && evidenceDependentActions.has(recommendation.action) && condition.evidenceIds.length === 0) {
        errors.push(`${condition.id} recommends ${recommendation.action} without owned evidence.`);
      }
    }

    if (finalStatuses.has(review.status)) {
      const unresolvedIds = getUnresolvedConditions(data, review).map((condition) => condition.id);
      if (unresolvedIds.length > 0) errors.push(`${review.id} is ${review.status} with unresolved conditions: ${unresolvedIds.join(", ")}.`);
    }
  }

  return errors;
}

export function assertClinicalDataConsistency(data: SeedData, settings: AppSettings) {
  const errors = getClinicalDataConsistencyErrors(data, settings);
  if (errors.length > 0) throw new Error(`Clinical seed consistency failed:\n${errors.join("\n")}`);
}
