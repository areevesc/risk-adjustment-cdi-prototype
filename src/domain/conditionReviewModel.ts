import { decisionSupportService } from "../decisionSupport/DecisionSupportService";
import { getEffectiveDisposition } from "./conditionRisk";
import { getConditionEvidenceEligibility } from "./evidenceEligibility";
import type {
  AppSettings,
  Condition,
  ConditionDecision,
  ConditionReviewModel,
  DownstreamTask,
  PatientReview,
  RecommendationAction,
  ReviewContext,
  RoutingOutcome,
  SeedData
} from "./types";

export function deriveReviewContext(review: PatientReview, data: SeedData, settings: AppSettings): ReviewContext {
  if (review.appointmentId && data.appointments.some((appointment) => appointment.id === review.appointmentId)) return "scheduledUpcomingVisit";
  return review.calendarYear < settings.prototypeCurrentYear ? "retrospective" : "noUpcomingVisit";
}

function legacyDecision(action: RecommendationAction | undefined): ConditionDecision | undefined {
  switch (action) {
    case "Validate":
      return "validate";
    case "Delete":
      return "delete";
    case "Add to Claim":
      return "addToClaim";
    case "Disagree":
    case "No":
      return "dismiss";
    case "Change":
      return "changeCode";
    case "Yes":
      return "prepareProviderQuery";
    default:
      return undefined;
  }
}

export function routingOutcomeForTask(task: DownstreamTask | undefined): RoutingOutcome {
  switch (task?.type) {
    case "Provider Query":
      return "providerQueryTask";
    case "Prospective CDI Review":
      return "prospectiveHold";
    case "Addition to Claim":
      return "additionExport";
    case "Deletion":
      return "deletionExport";
    case "Auditor Exception":
    case "Manager Exception":
      return "exceptionRouting";
    default:
      return "none";
  }
}

function activeConditionTask(data: SeedData, conditionId: string) {
  return data.downstreamTasks.find((task) => task.conditionId === conditionId && task.status !== "Cancelled");
}

function actionsForWorkflow(condition: Condition) {
  if (condition.workflow === "codesOnClaim") {
    return {
      decisions: ["validate", "delete"] as ConditionDecision[],
      routes: ["prospectiveHold"] as Exclude<RoutingOutcome, "none">[]
    };
  }
  if (condition.workflow === "codesNotOnClaim") {
    return {
      decisions: ["addToClaim", "dismiss"] as ConditionDecision[],
      routes: [] as Exclude<RoutingOutcome, "none">[]
    };
  }
  return {
    decisions: ["prepareProviderQuery", "dismiss", "changeCode"] as ConditionDecision[],
    routes: [] as Exclude<RoutingOutcome, "none">[]
  };
}

export function deriveConditionReviewModel(
  condition: Condition,
  review: PatientReview,
  data: SeedData,
  settings: AppSettings
): ConditionReviewModel {
  const reviewContext = deriveReviewContext(review, data, settings);
  const appointmentId = reviewContext === "scheduledUpcomingVisit" ? review.appointmentId : undefined;
  const evidence = getConditionEvidenceEligibility(condition, review, data);
  const task = activeConditionTask(data, condition.id);
  const taskRoute = routingOutcomeForTask(task);
  const downstreamRoute = condition.routingOutcome?.outcome ?? condition.draftRoutingOutcome?.outcome ?? taskRoute;
  const disposition = getEffectiveDisposition(condition);
  const decision = condition.decision?.decision ?? condition.draftDecision?.decision ?? legacyDecision(disposition?.action);
  const captured = decision === "validate" || decision === "addToClaim";
  const resolved = Boolean(condition.decision || condition.disposition || condition.ruleOutcome || taskRoute !== "none");
  const staged = !resolved && Boolean(condition.draftDecision || condition.draftDisposition || condition.draftRoutingOutcome || condition.draftProspectiveHandoff);
  const resolutionState = resolved ? "resolved" : staged ? "staged" : "open";
  const captureState = condition.claimStatus === "On claim"
    ? "currentYearClaim"
    : condition.hadPriorCapture || condition.claimStatus === "Historical"
      ? "priorCapture"
      : "uncaptured";

  if (resolutionState === "resolved") {
    return {
      reviewContext,
      captureState,
      evidenceState: {
        hasOwnedEvidence: evidence.hasOwnedEvidence,
        hasEligibleCurrentClinicalSupport: evidence.hasEligibleCurrentClinicalSupport,
        hasEligibleClaimForAction: evidence.hasEligibleClaimForAction
      },
      resolutionState,
      resolvedLabel: captured ? `Captured for ${review.calendarYear}` : downstreamRoute !== "none" ? "Routed" : "Resolved",
      availableDecisions: [],
      availableRoutes: [],
      downstreamRoute,
      appointmentId
    };
  }

  const available = actionsForWorkflow(condition);
  const legacyRecommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
  let recommendation: ConditionReviewModel["recommendation"];

  const recommendedDecision = legacyDecision(legacyRecommendation?.action);
  if (recommendedDecision && available.decisions.includes(recommendedDecision)) {
    recommendation = {
      decision: recommendedDecision,
      confidence: legacyRecommendation?.confidence ?? "Medium",
      rationale: legacyRecommendation?.rationale ?? "Review the diagnosis-scoped evidence before selecting an action."
    };
  } else if (legacyRecommendation?.action === "Send to Prospective" && available.routes.includes("prospectiveHold")) {
    recommendation = {
      route: "prospectiveHold",
      confidence: legacyRecommendation.confidence,
      rationale: legacyRecommendation.rationale
    };
  }

  return {
    reviewContext,
    captureState,
    evidenceState: {
      hasOwnedEvidence: evidence.hasOwnedEvidence,
      hasEligibleCurrentClinicalSupport: evidence.hasEligibleCurrentClinicalSupport,
      hasEligibleClaimForAction: evidence.hasEligibleClaimForAction
    },
    resolutionState,
    recommendation,
    availableDecisions: available.decisions,
    availableRoutes: available.routes,
    downstreamRoute,
    appointmentId
  };
}
