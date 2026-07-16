import type { AppSettings, Condition, PatientReview, Recommendation, RecommendationAction, RuleActionSuppression, RuleResult, SeedData } from "../domain/types";
import { getConditionHccs, getConditionHierarchySuppression, isRiskAdjustmentCondition } from "../domain/conditionRisk";
import type { CmsV28Hcc } from "../domain/cmsV28";

export interface DecisionSupportService {
  getRecommendation(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): Recommendation | undefined;
  evaluateRules(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): RuleResult;
  getDisplayLabel(recommendation: Recommendation, settings: AppSettings): string;
}

export class PrototypeDecisionSupportService implements DecisionSupportService {
  getRecommendation(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): Recommendation | undefined {
    if (settings.recommendationMode === "hidden") return undefined;
    return this.getBaseRecommendation(condition, review, data, settings);
  }

  evaluateRules(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): RuleResult {
    const recommendation = this.getBaseRecommendation(condition, review, data, settings);
    const disabledActions: RuleActionSuppression[] = [];
    const warnings: RuleResult["warnings"] = [];
    const supportingEvidenceIds = new Set<string>(condition.supportingEvidenceIds ?? []);
    const conflictingEvidenceIds = new Set<string>(condition.conflictingEvidenceIds ?? []);
    const acuteExclusion = evaluateAcuteOnlyRecaptureExclusion(condition);
    const hierarchy = evaluateHierarchySuppression(condition, review, data);
    const contextualExclusion = evaluateContextualExclusion(condition);
    const lookback = evaluateThreeYearLookbackRecapture(condition, review, data);

    const deleteSafety = evaluateDeleteSafety(condition, review, data);
    deleteSafety.supportingEvidenceIds.forEach((id) => supportingEvidenceIds.add(id));
    deleteSafety.conflictingEvidenceIds.forEach((id) => conflictingEvidenceIds.add(id));
    acuteExclusion.evidenceIds.forEach((id) => supportingEvidenceIds.add(id));
    hierarchy.evidenceIds.forEach((id) => supportingEvidenceIds.add(id));
    contextualExclusion.evidenceIds.forEach((id) => supportingEvidenceIds.add(id));
    lookback.evidenceIds.forEach((id) => supportingEvidenceIds.add(id));

    if (condition.ruleOutcome) {
      if (condition.ruleOutcome.action) {
        disabledActions.push({
          action: condition.ruleOutcome.action,
          reason: condition.ruleOutcome.explanation,
          ruleId: condition.ruleOutcome.ruleId,
          source: condition.ruleOutcome.source,
          supportingEvidenceIds: condition.ruleOutcome.supportingEvidenceIds,
          conflictingEvidenceIds: condition.ruleOutcome.conflictingEvidenceIds
        });
      }
      condition.ruleOutcome.supportingEvidenceIds?.forEach((id) => supportingEvidenceIds.add(id));
      condition.ruleOutcome.conflictingEvidenceIds?.forEach((id) => conflictingEvidenceIds.add(id));
    }

    if (!condition.disposition && condition.workflow === "codesNotOnClaim") {
      const selectedDuplicate = getSamePatientYearHccConditions(data, review, condition.hcc).find(
        (item) => item.id !== condition.id && item.workflow === "codesNotOnClaim" && item.disposition?.action === "Add to Claim"
      );
      if (selectedDuplicate) {
        const selectedBy = data.users.find((item) => item.id === selectedDuplicate.disposition?.userId);
        const selectedAt = selectedDuplicate.disposition?.decidedAt ? ` at ${selectedDuplicate.disposition.decidedAt}` : "";
        selectedDuplicate.evidenceIds.forEach((id) => supportingEvidenceIds.add(id));
        disabledActions.push({
          action: "Add to Claim",
          reason: `Add to Claim unavailable because ${selectedDuplicate.icd10} was selected by ${selectedBy?.name ?? "a reviewer"}${selectedAt} for the same patient, calendar year, and ${condition.hcc}.`,
          ruleId: "same-hcc-duplicate-add",
          source: "rule-suppressed",
          supportingEvidenceIds: selectedDuplicate.evidenceIds
        });
      }
    }

    if (condition.workflow === "codesOnClaim" && deleteSafety.supportingEvidenceIds.length > 0) {
      warnings.push({
        message: "Possible current-year supporting evidence was identified. Review before deleting.",
        severity: "warning",
        evidenceIds: deleteSafety.supportingEvidenceIds
      });
    }

    if (condition.workflow === "codesOnClaim" && deleteSafety.conflictingEvidenceIds.length > 0) {
      warnings.push({
        message: "Conflicting or ambiguous current-year evidence exists. Escalate to manager or auditor review when needed.",
        severity: "warning",
        evidenceIds: deleteSafety.conflictingEvidenceIds
      });
    }

    if (condition.workflow === "codesOnClaim" && (review.calendarYear !== settings.prototypeCurrentYear || !condition.currentYear)) {
      disabledActions.push({
        action: "Send to Prospective",
        reason: "Send to Prospective is unavailable because this is not the configured prototype current calendar year.",
        ruleId: "current-year-prospective-routing",
        source: "rule-suppressed"
      });
    }

    if (!condition.disposition && !condition.ruleOutcome && condition.workflow === "prospective" && condition.subtype === "recapture" && lookback.hasCurrentYearCapture) {
      disabledActions.push({
        action: "Yes",
        reason: `${condition.hcc} already has a current-year capture for this patient and calendar year, so prospective recapture is suppressed.`,
        ruleId: "current-year-hcc-captured",
        source: "rule-suppressed",
        supportingEvidenceIds: lookback.currentCaptureEvidenceIds
      });
      lookback.currentCaptureEvidenceIds.forEach((id) => supportingEvidenceIds.add(id));
    }

    if (!condition.disposition && !condition.ruleOutcome && acuteExclusion.applies) {
      warnings.push({
        message: "The rule engine recommends No because this appears acute or resolved in the synthetic scenario. This is advisory; the reviewer may still select Yes.",
        severity: "warning",
        evidenceIds: acuteExclusion.evidenceIds
      });
    }

    if (!condition.disposition && !condition.ruleOutcome && hierarchy.applies) {
      hierarchy.disabledActions.forEach((action) =>
        disabledActions.push({
          action,
          reason: hierarchy.reason,
          ruleId: "hierarchy-trumping-suppression",
          source: "rule-suppressed",
          supportingEvidenceIds: hierarchy.evidenceIds
        })
      );
    }

    if (!condition.disposition && !condition.ruleOutcome && hierarchy.warning) {
      warnings.push({
        message: hierarchy.warning,
        severity: "warning",
        evidenceIds: hierarchy.evidenceIds
      });
    }

    if (!condition.disposition && !condition.ruleOutcome && contextualExclusion.applies) {
      if (contextualExclusion.hardRestriction) {
        contextualExclusion.disabledActions.forEach((action) =>
          disabledActions.push({
            action,
            reason: contextualExclusion.reason,
            ruleId: contextualExclusion.ruleId,
            source: "rule-suppressed",
            supportingEvidenceIds: contextualExclusion.evidenceIds
          })
        );
      }
      warnings.push({
        message: contextualExclusion.reason,
        severity: contextualExclusion.hardRestriction ? "info" : "warning",
        evidenceIds: contextualExclusion.evidenceIds
      });
    }

    const threshold = clampThreshold(settings.sameHccValidationThreshold);
    const sameHccValidations = getSamePatientYearHccConditions(data, review, condition.hcc).filter((item) => item.disposition?.action === "Validate").length;
    if (!condition.disposition && !condition.ruleOutcome && condition.workflow === "codesOnClaim" && sameHccValidations >= threshold) {
      disabledActions.push({
        action: "Delete",
        reason: `${condition.hcc} already reached the same-HCC validation threshold for this patient and calendar year.`,
        ruleId: "same-hcc-validation-threshold",
        source: "rule-resolved"
      });
    }

    return {
      ruleId:
        condition.ruleOutcome?.ruleId ??
        (acuteExclusion.applies
          ? "acute-only-recapture-exclusion"
          : hierarchy.applies
            ? "hierarchy-trumping-suppression"
            : contextualExclusion.applies
              ? contextualExclusion.ruleId
              : lookback.qualifies
                ? "three-year-lookback-recapture"
                : "condition-action-rules"),
      recommendedAction: recommendation?.action,
      explanation: condition.ruleOutcome?.explanation ?? recommendation?.rationale ?? "No rule-based recommendation is available for this condition.",
      supportingEvidenceIds: Array.from(supportingEvidenceIds),
      conflictingEvidenceIds: Array.from(conflictingEvidenceIds),
      disabledActions: dedupeDisabledActions(disabledActions),
      warnings,
      outcomeSource: condition.ruleOutcome?.source
    };
  }

  private getBaseRecommendation(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): Recommendation | undefined {
    if (!isRiskAdjustmentCondition(condition)) return undefined;
    if (condition.seededRecommendation) return condition.seededRecommendation;
    const claim = data.claims.find((item) => item.reviewId === review.id);
    const riskEligibleSource =
      claim?.riskEligible !== false &&
      claim?.cptSourceEligible !== false &&
      claim?.providerTypeEligible !== false &&
      claim?.faceToFace !== false &&
      claim?.providerSignatureValid !== false;
    const currentPrototypeYear = review.calendarYear === settings.prototypeCurrentYear && condition.currentYear;

    if (!riskEligibleSource && condition.workflow !== "prospective") {
      return {
        action: "Disagree",
        confidence: "High",
        source: "rules",
        rationale: "The structured prototype source indicators mark this evidence as not risk eligible for direct claim action."
      };
    }

    const acuteExclusion = evaluateAcuteOnlyRecaptureExclusion(condition);
    if (acuteExclusion.applies) {
      return {
        action: "No",
        confidence: "High",
        source: "rules",
        rationale: "Excluded from prospective recapture because the curated prototype scenario marks this as acute-only, with no explicit later evidence showing continued relevance."
      };
    }

    const hierarchy = evaluateHierarchySuppression(condition, review, data);
    if (hierarchy.applies) {
      return {
        action: "Change",
        confidence: "High",
        source: "rules",
        replacementCode: hierarchy.replacementCode,
        rationale: hierarchy.reason
      };
    }

    const contextualExclusion = evaluateContextualExclusion(condition);
    if (contextualExclusion.applies) {
      return {
        action: contextualExclusion.recommendedAction,
        confidence: "High",
        source: "rules",
        rationale: contextualExclusion.reason
      };
    }

    if (condition.resolvedFlag) {
      return {
        action: "Disagree",
        confidence: "High",
        source: "rules",
        rationale: "Structured review data marks the condition as resolved."
      };
    }

    if (condition.workflow === "prospective") {
      const lookback = evaluateThreeYearLookbackRecapture(condition, review, data);
      if (condition.subtype === "recapture") {
        if (lookback.qualifies) {
          return {
            action: "Yes",
            confidence: "High",
            source: "rules",
            rationale: buildLookbackRationale(condition, review, data, lookback)
          };
        }
        if (lookback.hasCurrentYearCapture) {
          return {
            action: "No",
            confidence: "Medium",
            source: "rules",
            rationale: `${condition.hcc} already has a current-year capture for this patient and calendar year, so prospective recapture is not recommended.`
          };
        }
        return undefined;
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
      if (currentPrototypeYear && (condition.hasOtherSupportingEvidence || evaluateDeleteSafety(condition, review, data).supportingEvidenceIds.length > 0)) {
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
      return "Rule-Based Recommendation - Reviewer Decision Required";
    }
    return recommendation.source === "seeded" ? "Seeded Rule-Based Recommendation - Reviewer Decision Required" : "Rule-Based Recommendation - Reviewer Decision Required";
  }
}

export const decisionSupportService = new PrototypeDecisionSupportService();

function clampThreshold(value: number | undefined) {
  return Math.max(1, Math.min(10, Math.trunc(Number.isFinite(value) ? value! : 3)));
}

function getSamePatientYearHccConditions(data: SeedData, review: PatientReview, hcc: string) {
  const patientYearReviewIds = new Set(data.reviews.filter((item) => item.patientId === review.patientId && item.calendarYear === review.calendarYear).map((item) => item.id));
  const patient = data.patients.find((item) => item.id === review.patientId);
  const requested = new Set<CmsV28Hcc>();
  for (const match of hcc.matchAll(/HCC\s*(\d+)/gi)) requested.add(`HCC${match[1]}` as CmsV28Hcc);
  return data.conditions.filter(
    (condition) => patientYearReviewIds.has(condition.reviewId) && getConditionHccs(condition, patient).some((conditionHcc) => requested.has(conditionHcc))
  );
}

function evaluateAcuteOnlyRecaptureExclusion(condition: Condition) {
  const acuteOnly = condition.persistence === "acute" || condition.acuteCondition;
  const applies =
    acuteOnly &&
    condition.workflow === "prospective" &&
    condition.subtype === "recapture" &&
    !condition.hasCurrentYearCapture &&
    !condition.hasClinicalIndicators;
  return {
    applies,
    evidenceIds: applies ? [...condition.evidenceIds, ...(condition.lookbackEvidenceIds ?? [])] : []
  };
}

function evaluateHierarchySuppression(condition: Condition, review: PatientReview, data: SeedData) {
  const disabledActions = getAllActionsForWorkflow(condition);
  const state = getConditionHierarchySuppression(condition, review, data);
  if (!state.fullySuppressed || disabledActions.length === 0) {
    return {
      applies: false,
      disabledActions: [] as RecommendationAction[],
      evidenceIds: state.suppressedHccs.flatMap(({ capturedCondition }) => capturedCondition.evidenceIds),
      reason: "",
      warning: state.suppressedHccs.length
        ? `${state.suppressedHccs.map(({ lower, higher }) => `${lower} is suppressed by ${higher}`).join("; ")}. This multi-HCC diagnosis remains actionable because at least one mapped HCC is still active.`
        : "",
      replacementCode: undefined
    };
  }
  const suppression = state.suppressedHccs[0];
  const disposition = suppression.capturedCondition.disposition!;
  const user = data.users.find((candidate) => candidate.id === disposition.userId);
  return {
    applies: true,
    disabledActions,
    evidenceIds: [...condition.evidenceIds, ...suppression.capturedCondition.evidenceIds],
    reason: `${suppression.lower} remains visible but direct capture is locked because ${suppression.higher} was captured through ${suppression.capturedCondition.icd10} by ${user?.name ?? "a CDI/coder"} using ${disposition.action} on ${disposition.decidedAt}.`,
    warning: "",
    replacementCode: suppression.capturedCondition.icd10
  };
}

function evaluateContextualExclusion(condition: Condition) {
  if (!condition.sdohCode) {
    return {
      applies: false,
      ruleId: "condition-action-rules",
      recommendedAction: "Disagree" as RecommendationAction,
      disabledActions: [] as RecommendationAction[],
      evidenceIds: [] as string[],
      reason: "",
      hardRestriction: false
    };
  }
  const ruleId = "sdoh-context-suppression";
  const label = "SDoH";
  const recommendedAction: RecommendationAction = condition.workflow === "codesOnClaim" ? "Delete" : condition.workflow === "prospective" ? "No" : "Disagree";
  const hardRestriction = condition.trustedCodeMetadata === true;
  return {
    applies: true,
    ruleId,
    recommendedAction,
    disabledActions: hardRestriction ? getCaptureActionsForWorkflow(condition) : [],
    evidenceIds: condition.evidenceIds,
    reason: hardRestriction
      ? `Capture action is unavailable because trusted prototype code metadata marks the displayed ICD-10 as an ineligible ${label} code.`
      : `The simulated rules flagged ${label} context, but this is advisory only. Confirm whether the displayed diagnosis is actually an HCC opportunity before acting.`,
    hardRestriction
  };
}

function getCaptureActionsForWorkflow(condition: Condition): RecommendationAction[] {
  if (condition.workflow === "codesOnClaim") return ["Validate", "Send to Prospective"];
  if (condition.workflow === "codesNotOnClaim") return ["Add to Claim"];
  if (condition.workflow === "prospective") return ["Yes", "Change"];
  return [];
}

function getAllActionsForWorkflow(condition: Condition): RecommendationAction[] {
  if (condition.workflow === "codesOnClaim") return ["Validate", "Delete", "Send to Prospective"];
  if (condition.workflow === "codesNotOnClaim") return ["Add to Claim", "Disagree"];
  if (condition.workflow === "prospective") return ["Yes", "No", "Change"];
  return [];
}

function evaluateThreeYearLookbackRecapture(condition: Condition, review: PatientReview, data: SeedData) {
  const empty = {
    qualifies: false,
    evidenceIds: [] as string[],
    evidenceLabels: [] as string[],
    hasCurrentYearCapture: false,
    currentCaptureEvidenceIds: [] as string[]
  };
  if (condition.workflow !== "prospective" || condition.subtype !== "recapture" || !condition.hadPriorCapture) return empty;

  const currentCaptureEvidenceIds = new Set(getCurrentYearCaptureEvidenceIds(condition, review, data));
  if (condition.hasCurrentYearCapture) {
    condition.evidenceIds.filter((id) => isCurrentYearEvidence(id, review, data)).forEach((id) => currentCaptureEvidenceIds.add(id));
  }
  const hasHumanCurrentYearCapture = getSamePatientYearHccConditions(data, review, condition.hcc).some(
    (item) =>
      item.id !== condition.id &&
      item.currentYear &&
      item.disposition !== undefined &&
      ["Validate", "Add to Claim", "Change"].includes(item.disposition.action)
  );
  const hasCurrentYearCapture = condition.hasCurrentYearCapture || hasHumanCurrentYearCapture || currentCaptureEvidenceIds.size > 0;
  const lookbackEvidence = getLookbackEvidence(condition, review, data);
  return {
    qualifies: lookbackEvidence.length > 0 && !hasCurrentYearCapture,
    evidenceIds: lookbackEvidence.map((item) => item.id),
    evidenceLabels: lookbackEvidence.map((item) => item.label),
    hasCurrentYearCapture,
    currentCaptureEvidenceIds: Array.from(currentCaptureEvidenceIds)
  };
}

function getLookbackEvidence(condition: Condition, review: PatientReview, data: SeedData) {
  const patientReviewIds = new Set(data.reviews.filter((item) => item.patientId === review.patientId).map((item) => item.id));
  const explicitEvidenceIds = new Set([...(condition.evidenceIds ?? []), ...(condition.lookbackEvidenceIds ?? [])]);
  return data.evidence
    .filter((evidence) => patientReviewIds.has(evidence.reviewId))
    .filter((evidence) => explicitEvidenceIds.has(evidence.id) || evidence.conditionIds.includes(condition.id))
    .filter((evidence) => {
      const year = Number(evidence.date.slice(0, 4));
      return Number.isFinite(year) && year >= review.calendarYear - 3 && year <= review.calendarYear - 1;
    })
    .map((evidence) => {
      const document = data.documents.find((item) => item.id === evidence.documentId);
      return {
        id: evidence.id,
        date: evidence.date,
        label: `${evidence.date} ${document?.type ?? "Evidence"}`
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getCurrentYearCaptureEvidenceIds(condition: Condition, review: PatientReview, data: SeedData) {
  const captureActions = new Set(["Validate", "Add to Claim", "Change"]);
  const evidenceIds = new Set<string>();
  getSamePatientYearHccConditions(data, review, condition.hcc)
    .filter((item) => item.id !== condition.id && item.currentYear)
    .filter(
      (item) =>
        item.hasCurrentYearCapture ||
        (item.disposition?.action && captureActions.has(item.disposition.action))
    )
    .forEach((item) => item.evidenceIds.forEach((id) => evidenceIds.add(id)));
  return Array.from(evidenceIds).filter((id) => isCurrentYearEvidence(id, review, data));
}

function buildLookbackRationale(condition: Condition, review: PatientReview, data: SeedData, lookback: ReturnType<typeof evaluateThreeYearLookbackRecapture>) {
  const appointment = review.appointmentId ? data.appointments.find((item) => item.id === review.appointmentId) : undefined;
  const evidenceLabel = lookback.evidenceLabels.length ? lookback.evidenceLabels.join(", ") : "curated prior evidence";
  const appointmentText = appointment ? `${appointment.type} on ${appointment.date}` : "no attached upcoming appointment";
  return `Three-year lookback found prior ${condition.hcc} evidence in ${evidenceLabel}. No current-year capture is present for this HCC in the same patient/calendar-year group. The attached visit context is ${appointmentText}. This creates a prospective recapture opportunity for provider confirmation, not an automatic claim action.`;
}

function evaluateDeleteSafety(condition: Condition, review: PatientReview, data: SeedData) {
  if (condition.workflow !== "codesOnClaim") {
    return { supportingEvidenceIds: [] as string[], conflictingEvidenceIds: [] as string[] };
  }

  const sameHccConditions = getSamePatientYearHccConditions(data, review, condition.hcc);
  const supporting = new Set<string>(condition.supportingEvidenceIds ?? []);
  const conflicting = new Set<string>(condition.conflictingEvidenceIds ?? []);

  if (condition.currentYear && (condition.hasSufficientMeat || condition.hasOtherSupportingEvidence)) {
    condition.evidenceIds.forEach((id) => supporting.add(id));
  }

  sameHccConditions
    .filter((item) => item.id !== condition.id && item.currentYear)
    .filter(
      (item) =>
        item.hasSufficientMeat ||
        item.hasOtherSupportingEvidence ||
        item.disposition?.action === "Validate" ||
        item.disposition?.action === "Add to Claim"
    )
    .forEach((item) => item.evidenceIds.forEach((id) => supporting.add(id)));

  if (condition.conflictingEvidence) {
    condition.evidenceIds.forEach((id) => conflicting.add(id));
  }

  return {
    supportingEvidenceIds: Array.from(supporting).filter((id) => isCurrentYearEvidence(id, review, data)),
    conflictingEvidenceIds: Array.from(conflicting).filter((id) => isCurrentYearEvidence(id, review, data))
  };
}

function isCurrentYearEvidence(evidenceId: string, review: PatientReview, data: SeedData) {
  const evidence = data.evidence.find((item) => item.id === evidenceId);
  if (!evidence) return false;
  const evidenceReview = data.reviews.find((item) => item.id === evidence.reviewId);
  if (!evidenceReview || evidenceReview.patientId !== review.patientId || evidenceReview.calendarYear !== review.calendarYear) return false;
  const evidenceYear = Number(evidence.date.slice(0, 4));
  if (evidenceYear === review.calendarYear) return true;
  const document = data.documents.find((item) => item.id === evidence.documentId);
  return document?.isCurrentYear === true;
}

function dedupeDisabledActions(actions: RuleActionSuppression[]) {
  const seen = new Set<string>();
  return actions.filter((item) => {
    const key = `${item.action}:${item.ruleId}:${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
