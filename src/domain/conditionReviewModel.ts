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
  if (review.calendarYear < settings.prototypeCurrentYear) return "retrospective";
  return review.appointmentId && data.appointments.some((appointment) => appointment.id === review.appointmentId)
    ? "scheduledUpcomingVisit"
    : "noUpcomingVisit";
}

function legacyDecision(action: RecommendationAction | undefined, context: ReviewContext): ConditionDecision | undefined {
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
      return context === "scheduledUpcomingVisit" ? "prepareProviderQuery" : undefined;
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

function retrospectiveActions(condition: Condition): ConditionDecision[] {
  if (condition.workflow === "codesOnClaim") return ["validate", "delete", "changeCode"];
  if (condition.workflow === "codesNotOnClaim") return ["addToClaim", "dismiss", "changeCode"];
  return ["dismiss", "changeCode"];
}

function prospectiveActions(condition: Condition, context: ReviewContext, hasSupport: boolean) {
  if (condition.workflow === "codesOnClaim" && condition.hasSufficientMeat && hasSupport) {
    return { decisions: ["validate", "delete", "changeCode"] as ConditionDecision[], routes: [] as Exclude<RoutingOutcome, "none">[] };
  }
  if (context === "scheduledUpcomingVisit") {
    return {
      decisions: condition.workflow === "codesOnClaim"
        ? ["prepareProviderQuery", "delete", "changeCode"] as ConditionDecision[]
        : ["prepareProviderQuery", "dismiss", "changeCode"] as ConditionDecision[],
      routes: ["providerQueryTask"] as Exclude<RoutingOutcome, "none">[]
    };
  }
  return {
    decisions: condition.workflow === "codesOnClaim"
      ? ["delete", "changeCode"] as ConditionDecision[]
      : ["dismiss", "changeCode"] as ConditionDecision[],
    routes: ["prospectiveHold"] as Exclude<RoutingOutcome, "none">[]
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
  const decision = condition.decision?.decision ?? condition.draftDecision?.decision ?? legacyDecision(disposition?.action, reviewContext);
  const captured = decision === "validate" || decision === "addToClaim" || decision === "changeCode";
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

  const available = reviewContext === "retrospective"
    ? { decisions: retrospectiveActions(condition), routes: [] as Exclude<RoutingOutcome, "none">[] }
    : prospectiveActions(condition, reviewContext, evidence.hasEligibleCurrentClinicalSupport);
  const legacyRecommendation = decisionSupportService.getRecommendation(condition, review, data, settings);
  let recommendation: ConditionReviewModel["recommendation"];

  if (reviewContext === "retrospective") {
    const legacy = legacyDecision(legacyRecommendation?.action, reviewContext);
    if (legacy && available.decisions.includes(legacy)) {
      recommendation = {
        decision: legacy,
        confidence: legacyRecommendation?.confidence ?? "Medium",
        rationale: legacyRecommendation?.rationale ?? "Prior-year reconciliation requires reviewer confirmation."
      };
    }
  } else if (condition.workflow === "codesOnClaim" && condition.hasSufficientMeat && evidence.hasEligibleCurrentClinicalSupport && evidence.hasEligibleClaimForAction) {
    recommendation = {
      decision: "validate",
      confidence: "High",
      rationale: "The diagnosis is on an eligible current-year claim and an eligible signed encounter documents MEAT."
    };
  } else if (reviewContext === "scheduledUpcomingVisit") {
    recommendation = {
      decision: "prepareProviderQuery",
      route: "providerQueryTask",
      confidence: evidence.hasOwnedEvidence ? "High" : "Medium",
      rationale: "The opportunity requires provider confirmation and is tied to the attached appointment."
    };
  } else {
    recommendation = {
      route: "prospectiveHold",
      confidence: evidence.hasOwnedEvidence ? "High" : "Medium",
      rationale: "No appointment is attached, so the opportunity should be held for the next review."
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
