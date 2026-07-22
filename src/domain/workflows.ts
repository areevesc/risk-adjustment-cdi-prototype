import type {
  ActionHistory,
  AppSettings,
  AssignmentMode,
  Audit,
  Condition,
  ConditionDecision,
  DisagreeReason,
  DocumentationIssue,
  DownstreamTask,
  DownstreamTaskQueue,
  DownstreamTaskStatus,
  DownstreamTaskType,
  PatientReview,
  RecommendationAction,
  RoutingOutcome,
  SeedData,
  User
} from "./types";
import { uid } from "./format";
import {
  canAssignReviews,
  canCompleteAudit as userCanCompleteAudit,
  canCompleteReview as userCanCompleteReview,
  canFlagDocumentationIssue as userCanFlagDocumentationIssue,
  canOpenReview,
  canOverrideLock,
  canReleaseReviewLock,
  canReopenAudit,
  canRouteWholeReview,
  canSetConditionDisposition,
  canStartAudit,
  canTakeCoverage,
  getActiveQueueReviews,
  hasAnyRole,
  isReviewLockOwner
} from "./auth";
import { getAuditSamplingProfile, getPatientCalendarYearHccGroup, getRuleResult, getUnresolvedConditions } from "./selectors";
import { appendGeneratedChartForAssignee, GENERATED_CHART_CONTENT_REVISION } from "./generatedCharts";
import { getConditionHierarchySuppression, getEffectiveDisposition, isRiskAdjustmentCondition } from "./conditionRisk";
import { deriveConditionReviewModel, deriveReviewContext, routingOutcomeForTask } from "./conditionReviewModel";

function stamp() {
  return new Date().toISOString();
}

function addHistory(data: SeedData, entry: Omit<ActionHistory, "id" | "at"> & { at?: string }): SeedData {
  return {
    ...data,
    history: [
      {
        id: uid("hist"),
        at: entry.at ?? stamp(),
        reviewId: entry.reviewId,
        conditionId: entry.conditionId,
        userId: entry.userId,
        event: entry.event,
        detail: entry.detail
      },
      ...data.history
    ]
  };
}

function updateReview(data: SeedData, reviewId: string, updater: (review: PatientReview) => PatientReview) {
  return { ...data, reviews: data.reviews.map((review) => (review.id === reviewId ? updater(review) : review)) };
}

function updateCondition(data: SeedData, conditionId: string, updater: (condition: Condition) => Condition) {
  return { ...data, conditions: data.conditions.map((condition) => (condition.id === conditionId ? updater(condition) : condition)) };
}

function updateClinicAssignment(data: SeedData, clinicId: string, assignedUser: User) {
  return {
    ...data,
    clinics: data.clinics.map((clinic) =>
      clinic.id === clinicId
        ? {
            ...clinic,
            defaultAssigneeId: assignedUser.id
          }
        : clinic
    )
  };
}

function taskQueue(type: DownstreamTaskType): DownstreamTaskQueue {
  if (type === "Provider Query") return "Provider Query Queue";
  if (type === "Prospective CDI Review") return "Prospective Review Queue";
  if (type === "Provider Education") return "Provider Education Queue";
  if (type === "Auditor Exception") return "Auditor Queue";
  if (type === "Manager Exception") return "Manager Review Queue";
  if (type === "Scheduling Outreach") return "Scheduling Outreach Queue";
  return "Export List";
}

function createDownstreamTask(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  type: DownstreamTaskType,
  user: User,
  comments?: string,
  assignedUserId?: string,
  targetCalendarYear?: number,
  appointmentId?: string
): SeedData {
  const reviewCalendarYear = data.reviews.find((review) => review.id === reviewId)?.calendarYear;
  const existing = data.downstreamTasks.find(
    (task) =>
      task.reviewId === reviewId &&
      task.conditionId === conditionId &&
      task.type === type &&
      task.status !== "Cancelled" &&
      (targetCalendarYear === undefined || (task.targetCalendarYear ?? reviewCalendarYear) === targetCalendarYear)
  );
  if (existing) return data;
  const task: DownstreamTask = {
    id: uid("task"),
    reviewId,
    conditionId,
    type,
    status: "Open",
    queue: taskQueue(type),
    assignedUserId,
    createdByUserId: user.id,
    createdAt: stamp(),
    comments: comments?.trim() || undefined,
    appointmentId,
    sourceCalendarYear: targetCalendarYear === undefined ? undefined : reviewCalendarYear,
    targetCalendarYear
  };
  const next = {
    ...data,
    downstreamTasks: [task, ...data.downstreamTasks]
  };
  const outcome = routingOutcomeForTask(task);
  return outcome === "none"
    ? next
    : updateCondition(next, conditionId, (condition) => ({
        ...condition,
        draftRoutingOutcome: undefined,
        routingOutcome: {
          outcome,
          userId: user.id,
          routedAt: task.createdAt,
          appointmentId,
          taskId: task.id,
          comments: task.comments
        }
      }));
}

function isPrototypeCurrentYear(review: PatientReview, condition: Condition, settings: AppSettings) {
  return review.calendarYear === settings.prototypeCurrentYear && condition.currentYear;
}

function clampAuditRate(rate: number) {
  return Math.max(0, Math.min(100, Number.isFinite(rate) ? rate : 0));
}

export function shouldSampleReviewForAudit(reviewId: string, auditSampleRate: number) {
  const rate = clampAuditRate(auditSampleRate);
  if (rate <= 0) return false;
  if (rate >= 100) return true;
  let hash = 0;
  for (const char of reviewId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 10000;
  }
  return hash % 100 < rate;
}

export function openReview(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canOpenReview(data, review, user)) return data;
  if (review.lock && !isReviewLockOwner(review, user)) return data;
  if (isReviewLockOwner(review, user)) return data;

  const next = updateReview(data, reviewId, (item) => ({
    ...item,
    status: item.status === "Available" || item.status === "Pended" || item.status === "Rework Required" ? "In Progress" : item.status,
    lock: { lockedByUserId: user.id, lockedAt: stamp() }
  }));
  return addHistory(next, { reviewId, userId: user.id, event: "Lock acquired", detail: "Patient-level review opened and locked." });
}

export function findNextEligibleReview(data: SeedData, currentReviewId: string, user: User, excludeCurrent = false): PatientReview | undefined {
  const visibleReviews = getActiveQueueReviews(data, user).filter((review) => canOpenReview(data, review, user));
  const currentIndex = visibleReviews.findIndex((review) => review.id === currentReviewId);
  const orderedReviews =
    currentIndex >= 0
      ? [...visibleReviews.slice(currentIndex + 1), ...visibleReviews.slice(0, currentIndex)]
      : visibleReviews;
  return orderedReviews.find((review) => (!excludeCurrent || review.id !== currentReviewId) && !review.lock && (review.status === "Available" || review.status === "Pended"));
}

export function openNextEligibleReview(data: SeedData, currentReviewId: string, user: User): { data: SeedData; nextReviewId?: string } {
  const nextReview = findNextEligibleReview(data, currentReviewId, user);
  if (!nextReview) return { data };

  const currentReview = data.reviews.find((review) => review.id === currentReviewId);
  const releasedData = currentReview && isReviewLockOwner(currentReview, user) ? releaseReview(data, currentReviewId, user) : data;
  const openedData = openReview(releasedData, nextReview.id, user);
  const openedReview = openedData.reviews.find((review) => review.id === nextReview.id);
  return openedReview?.lock?.lockedByUserId === user.id ? { data: openedData, nextReviewId: nextReview.id } : { data };
}

export function releaseReview(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canReleaseReviewLock(review, user)) return data;
  const next = updateReview(data, reviewId, (item) => ({ ...item, lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Lock released", detail: "Chart exited and lock released." });
}

export function overrideLock(data: SeedData, reviewId: string, user: User, reason: string): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canOverrideLock(review, user, reason)) return data;
  const priorOwner = data.users.find((item) => item.id === review.lock?.lockedByUserId)?.name ?? "Unknown user";
  const next = updateReview(data, reviewId, (item) => ({
    ...item,
    lock: { lockedByUserId: user.id, lockedAt: stamp() },
    status: item.status === "Available" || item.status === "Pended" || item.status === "Rework Required" ? "In Progress" : item.status
  }));
  return addHistory(next, {
    reviewId,
    userId: user.id,
    event: "Lock overridden",
    detail: `Prior owner: ${priorOwner}. New owner: ${user.name}. Reason: ${reason.trim()}`
  });
}

export function pendReview(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canReleaseReviewLock(review, user)) return data;
  const next = updateReview(data, reviewId, (item) => ({ ...item, status: "Pended", lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Review pended", detail: "Unfinished patient review was pended." });
}

export function pendAndOpenNextEligibleReview(data: SeedData, currentReviewId: string, user: User): { data: SeedData; nextReviewId?: string } {
  const pendedData = pendReview(data, currentReviewId, user);
  const currentReview = pendedData.reviews.find((review) => review.id === currentReviewId);
  if (!currentReview || currentReview.lock) return { data };
  const nextReview = findNextEligibleReview(pendedData, currentReviewId, user, true);
  if (!nextReview) return { data: pendedData };
  const openedData = openReview(pendedData, nextReview.id, user);
  const openedReview = openedData.reviews.find((review) => review.id === nextReview.id);
  return openedReview?.lock?.lockedByUserId === user.id ? { data: openedData, nextReviewId: nextReview.id } : { data: pendedData };
}

export function routeReview(data: SeedData, reviewId: string, user: User, queue: PatientReview["queue"]): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canRouteWholeReview(review, user)) return data;
  const status = queue === "Auditor Queue" || queue === "Manager Review Queue" ? "Awaiting Review" : "Available";
  const next = updateReview(data, reviewId, (item) => ({ ...item, status, queue, lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Whole review routed", detail: `Sent to ${queue}.` });
}

export function completeReview(data: SeedData, reviewId: string, user: User, settings: AppSettings): { data: SeedData; unresolved: Condition[] } {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !userCanCompleteReview(review, user)) return { data, unresolved: [] };
  const unresolved = getUnresolvedConditions(data, review);
  if (unresolved.length > 0) return { data, unresolved };

  let next = clearDraftRuleOutcomesForPatientYear(data, review);
  const drafts = next.conditions.filter((condition) => condition.reviewId === reviewId && condition.draftDisposition);
  drafts.forEach((condition) => {
    const draft = condition.draftDisposition!;
    const decisionUser = next.users.find((item) => item.id === draft.userId) ?? user;
    next = commitDisposition(
      next,
      reviewId,
      condition.id,
      decisionUser,
      draft.action,
      draft.agreedWithRecommendation,
      settings,
      draft.reason,
      draft.comments,
      draft.replacementCode
    );
  });
  const prospectiveHandoffDrafts = next.conditions.filter(
    (condition) => condition.reviewId === reviewId && condition.draftProspectiveHandoff
  );
  prospectiveHandoffDrafts.forEach((condition) => {
    const draft = condition.draftProspectiveHandoff!;
    const handoffUser = next.users.find((item) => item.id === draft.userId) ?? user;
    next = commitProspectiveHandoff(next, review, condition, handoffUser, draft.targetCalendarYear, draft.note);
  });
  next = updateReview(next, reviewId, (item) => ({ ...item, status: "Completed", lock: undefined, auditReturn: undefined }));
  next = addHistory(next, { reviewId, userId: user.id, event: "Review completed", detail: "All actionable conditions have a user-selected disposition or deterministic rule-derived outcome." });
  next = appendGeneratedChartForAssignee(next, review.assignedUserId, settings.prototypeCurrentYear, {
    completedReviewId: review.id,
    contentRevision: GENERATED_CHART_CONTENT_REVISION
  });
  next = addHistory(next, { reviewId, userId: user.id, event: "Queue refilled", detail: "A seeded synthetic chart was appended to the CDI/Coder queue." });
  if (shouldSampleReviewForAudit(reviewId, settings.auditSampleRate)) {
    next = startAudit(next, reviewId, user, true, settings.auditSampleRate);
  }
  return { data: next, unresolved: [] };
}

export function assignReview(
  data: SeedData,
  reviewId: string,
  user: User,
  assignedUserId: string,
  mode: AssignmentMode = "Coverage",
  reason?: string
): SeedData {
  if (!canAssignReviews(user)) return data;
  const review = data.reviews.find((item) => item.id === reviewId);
  const assigned = data.users.find((item) => item.id === assignedUserId);
  if (!review || !assigned) return data;
  let next =
    mode === "Coverage"
      ? updateReview(data, reviewId, (item) => ({
          ...item,
          coverage: {
            originalAssignedUserId: item.coverage?.originalAssignedUserId ?? item.assignedUserId,
            coveringUserId: assigned.id,
            startedAt: stamp(),
            initiatedByUserId: user.id
          }
        }))
      : updateReview(data, reviewId, (item) => ({
          ...item,
          assignedUserId: assigned.id,
          coverage: undefined
        }));
  if (mode === "Permanent reassignment") {
    next = updateClinicAssignment(next, review.clinicId, assigned);
  }
  return addHistory(next, {
    reviewId,
    userId: user.id,
    event: "Assignment changed",
    detail: `${mode}: ${assigned.name}.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`
  });
}

export function takeCoverage(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !canTakeCoverage(data, review, user)) return data;
  const next = updateReview(data, reviewId, (item) => ({
    ...item,
    status: item.status === "Available" || item.status === "Pended" || item.status === "Rework Required" ? "In Progress" : item.status,
    coverage: {
      originalAssignedUserId: item.coverage?.originalAssignedUserId ?? item.assignedUserId,
      coveringUserId: user.id,
      startedAt: stamp(),
      initiatedByUserId: user.id
    },
    lock: { lockedByUserId: user.id, lockedAt: stamp() }
  }));
  const originalAssignee = data.users.find((item) => item.id === review.assignedUserId)?.name ?? "original CDI/Coder";
  return addHistory(next, { reviewId, userId: user.id, event: "Coverage assignment taken", detail: `${user.name} took temporary coverage from ${originalAssignee}.` });
}

function decisionForLegacyAction(action: RecommendationAction, reviewContext: ReturnType<typeof deriveReviewContext>): ConditionDecision | undefined {
  if (action === "Validate") return "validate";
  if (action === "Delete") return "delete";
  if (action === "Add to Claim") return "addToClaim";
  if (action === "Disagree" || action === "No") return "dismiss";
  if (action === "Change") return "changeCode";
  if (action === "Yes" && reviewContext === "scheduledUpcomingVisit") return "prepareProviderQuery";
  return undefined;
}

function stagedRouteForLegacyAction(
  action: RecommendationAction,
  reviewContext: ReturnType<typeof deriveReviewContext>,
  reason?: DisagreeReason
): Exclude<RoutingOutcome, "none"> | undefined {
  if (action === "Add to Claim") return "additionExport";
  if (action === "Delete") return "deletionExport";
  if (action === "Yes") return reviewContext === "scheduledUpcomingVisit" ? "providerQueryTask" : "prospectiveHold";
  if (action === "Send to Prospective") return "prospectiveHold";
  if (action === "Disagree" && (reason === "Not Enough MEAT" || reason === "Conflicting Evidence")) {
    return reviewContext === "scheduledUpcomingVisit" ? "providerQueryTask" : "prospectiveHold";
  }
  if (action === "Disagree" && reason === "Other") return "exceptionRouting";
  return undefined;
}

export function setDisposition(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  user: User,
  action: RecommendationAction,
  agreedWithRecommendation: boolean | undefined,
  settings: AppSettings,
  reason?: DisagreeReason,
  comments?: string,
  replacementCode?: string
): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const conditionBefore = data.conditions.find((item) => item.id === conditionId);
  if (!review || !conditionBefore || !isRiskAdjustmentCondition(conditionBefore) || !isActionAllowedForWorkflow(conditionBefore, action) || !canSetConditionDisposition(review, user)) return data;
  const ruleResult = getRuleResult(conditionBefore, review, data, settings);
  if (ruleResult.disabledActions.some((disabledAction) => disabledAction.action === action)) return data;
  if (conditionBefore.draftRuleOutcome?.source === "rule-suppressed" && conditionBefore.draftRuleOutcome.action === action) return data;
  if (action === "Disagree" && reason === "Other" && !comments?.trim()) return data;
  const stagedAt = stamp();
  const reviewContext = deriveReviewContext(review, data, settings);
  const decision = decisionForLegacyAction(action, reviewContext);
  const route = stagedRouteForLegacyAction(action, reviewContext, reason);
  const next = updateCondition(data, conditionId, (condition) => ({
    ...condition,
    draftDecision: decision
      ? {
          decision,
          reason,
          comments: comments?.trim() || undefined,
          replacementCode,
          userId: user.id,
          stagedAt
        }
      : undefined,
    draftRoutingOutcome: route
      ? {
          outcome: route,
          userId: user.id,
          stagedAt,
          appointmentId: route === "providerQueryTask" ? review.appointmentId : undefined,
          comments: comments?.trim() || undefined
        }
      : undefined,
    draftDisposition: {
      action,
      reason,
      comments: comments?.trim() || undefined,
      replacementCode,
      userId: user.id,
      stagedAt,
      agreedWithRecommendation,
      source: "user-selected"
    }
  }));
  return refreshDraftRuleOutcomes(next, review, settings);
}

export function clearDispositionDraft(data: SeedData, reviewId: string, conditionId: string, user: User, settings: AppSettings): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const condition = data.conditions.find((item) => item.id === conditionId && item.reviewId === reviewId);
  if (!review || !condition?.draftDisposition || !canSetConditionDisposition(review, user)) return data;
  const next = updateCondition(data, conditionId, (item) => ({ ...item, draftDisposition: undefined, draftDecision: undefined, draftRoutingOutcome: undefined }));
  return refreshDraftRuleOutcomes(next, review, settings);
}

export function stageProspectiveHandoff(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  user: User,
  note?: string
): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const condition = data.conditions.find((item) => item.id === conditionId && item.reviewId === reviewId);
  if (!review || !condition || !isRiskAdjustmentCondition(condition) || !canSetConditionDisposition(review, user)) return data;
  const currentDataYear = Math.max(...data.reviews.map((item) => item.calendarYear));
  if (review.calendarYear < currentDataYear) return data;
  const appointmentId = review.appointmentId && data.appointments.some((appointment) => appointment.id === review.appointmentId)
    ? review.appointmentId
    : undefined;
  return updateCondition(data, conditionId, (item) => ({
    ...item,
    draftRoutingOutcome: {
      outcome: appointmentId ? "providerQueryTask" : "prospectiveHold",
      userId: user.id,
      stagedAt: stamp(),
      appointmentId,
      comments: note?.trim() || undefined
    },
    draftProspectiveHandoff: {
      targetCalendarYear: review.calendarYear + 1,
      note: note?.trim() || undefined,
      userId: user.id,
      stagedAt: stamp()
    }
  }));
}

export function clearProspectiveHandoffDraft(data: SeedData, reviewId: string, conditionId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const condition = data.conditions.find((item) => item.id === conditionId && item.reviewId === reviewId);
  if (!review || !condition?.draftProspectiveHandoff || !canSetConditionDisposition(review, user)) return data;
  return updateCondition(data, conditionId, (item) => ({ ...item, draftProspectiveHandoff: undefined, draftRoutingOutcome: undefined }));
}

function commitProspectiveHandoff(
  data: SeedData,
  review: PatientReview,
  condition: Condition,
  user: User,
  targetCalendarYear: number,
  note?: string
): SeedData {
  const committedAt = stamp();
  const appointmentId = review.appointmentId && data.appointments.some((appointment) => appointment.id === review.appointmentId)
    ? review.appointmentId
    : undefined;
  if (appointmentId) {
    let next = updateCondition(data, condition.id, (item) => ({ ...item, draftProspectiveHandoff: undefined, draftRoutingOutcome: undefined }));
    next = createDownstreamTask(next, review.id, condition.id, "Provider Query", user, note, review.assignedUserId, undefined, appointmentId);
    return addHistory(next, {
      reviewId: review.id,
      conditionId: condition.id,
      userId: user.id,
      event: "Provider query prepared",
      detail: `${condition.icd10} routed to appointment ${appointmentId}${note?.trim() ? ` with note: ${note.trim()}` : "."}`
    });
  }
  const existing = data.downstreamTasks.find(
    (task) =>
      task.reviewId === review.id &&
      task.conditionId === condition.id &&
      task.type === "Prospective CDI Review" &&
      task.status !== "Cancelled" &&
      (task.targetCalendarYear ?? review.calendarYear + 1) === targetCalendarYear
  );
  let next: SeedData = {
    ...data,
    conditions: data.conditions.map((item) =>
      item.id === condition.id ? { ...item, draftProspectiveHandoff: undefined, draftRoutingOutcome: undefined } : item
    ),
    downstreamTasks: existing
      ? data.downstreamTasks.map((task) =>
          task.id === existing.id
            ? {
                ...task,
                comments: note?.trim() || undefined,
                sourceCalendarYear: review.calendarYear,
                targetCalendarYear,
                assignedUserId: undefined,
                updatedByUserId: user.id,
                updatedAt: committedAt
              }
            : task
        )
      : [
          {
            id: uid("task"),
            reviewId: review.id,
            conditionId: condition.id,
            type: "Prospective CDI Review",
            status: "Open",
            queue: "Prospective Review Queue",
            createdByUserId: user.id,
            createdAt: committedAt,
            comments: note?.trim() || undefined,
            sourceCalendarYear: review.calendarYear,
            targetCalendarYear
          },
          ...data.downstreamTasks
        ]
  };
  next = addHistory(next, {
    reviewId: review.id,
    conditionId: condition.id,
    userId: user.id,
    event: existing ? "Prospective handoff updated" : "Prospective handoff sent",
    detail: `${condition.icd10} sent to the shared Prospective Review Queue for CY ${targetCalendarYear}${note?.trim() ? ` with note: ${note.trim()}` : "."}`
  });
  return next;
}

function commitDisposition(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  user: User,
  action: RecommendationAction,
  agreedWithRecommendation: boolean | undefined,
  settings: AppSettings,
  reason?: DisagreeReason,
  comments?: string,
  replacementCode?: string
): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const conditionBefore = data.conditions.find((item) => item.id === conditionId);
  if (!review || !conditionBefore) return data;
  const hierarchyBefore = conditionBefore.draftDisposition
    ? updateCondition(data, conditionId, (condition) => ({ ...condition, draftDisposition: undefined }))
    : data;
  const decidedAt = stamp();
  const reviewContext = deriveReviewContext(review, data, settings);
  const decision = decisionForLegacyAction(action, reviewContext);
  let next = updateCondition(data, conditionId, (condition) => ({
    ...condition,
    draftDisposition: undefined,
    draftDecision: undefined,
    draftRoutingOutcome: undefined,
    decision: decision
      ? {
          decision,
          reason,
          comments: comments?.trim() || undefined,
          replacementCode,
          userId: user.id,
          decidedAt
        }
      : condition.decision,
    disposition: {
      action,
      reason,
      comments: comments?.trim() || undefined,
      replacementCode,
      userId: user.id,
      decidedAt,
      agreedWithRecommendation,
      source: "user-selected"
    }
  }));

  const condition = next.conditions.find((item) => item.id === conditionId);
  if (condition && action === "Validate") {
    next = applyThreeValidationRule(next, reviewId, condition.hcc, user, settings.sameHccValidationThreshold);
  }
  if (condition && action === "Add to Claim") {
    next = createDownstreamTask(next, reviewId, conditionId, "Addition to Claim", user, comments);
  }
  if (condition && action === "Delete") {
    next = createDownstreamTask(next, reviewId, conditionId, "Deletion", user, comments);
  }
  if (condition && (action === "Yes" || action === "Send to Prospective") && isPrototypeCurrentYear(review, condition, settings)) {
    next = reviewContext === "scheduledUpcomingVisit"
      ? createDownstreamTask(next, reviewId, conditionId, "Provider Query", user, comments, review.assignedUserId, undefined, review.appointmentId)
      : createDownstreamTask(next, reviewId, conditionId, "Prospective CDI Review", user, comments);
  }
  if (
    condition &&
    isPrototypeCurrentYear(review, condition, settings) &&
    action === "Disagree" &&
    (reason === "Not Enough MEAT" || reason === "Conflicting Evidence")
  ) {
    next = reviewContext === "scheduledUpcomingVisit"
      ? createDownstreamTask(next, reviewId, conditionId, "Provider Query", user, comments, review.assignedUserId, undefined, review.appointmentId)
      : createDownstreamTask(next, reviewId, conditionId, "Prospective CDI Review", user, comments);
  }
  if (condition && action === "Disagree" && reason === "Other") {
    next = createDownstreamTask(next, reviewId, conditionId, "Manager Exception", user, comments);
  }

  next = addHistory(next, {
    reviewId,
    conditionId,
    userId: user.id,
    event: "Action selected",
    detail: reason ? `${action} - ${reason}` : action
  });
  return ["Validate", "Add to Claim", "Change"].includes(action)
    ? addHierarchyLockHistory(hierarchyBefore, next, review, user)
    : next;
}

function isActionAllowedForWorkflow(condition: Condition, action: RecommendationAction) {
  if (condition.workflow === "codesOnClaim") return ["Validate", "Delete", "Change", "Yes", "Send to Prospective"].includes(action);
  if (condition.workflow === "codesNotOnClaim") return ["Add to Claim", "Disagree", "Change", "Yes", "No"].includes(action);
  return ["Yes", "No", "Change"].includes(action);
}

function addHierarchyLockHistory(before: SeedData, after: SeedData, review: PatientReview, user: User) {
  const patientYearReviewIds = new Set(
    after.reviews
      .filter((item) => item.patientId === review.patientId && item.calendarYear === review.calendarYear)
      .map((item) => item.id)
  );
  return after.conditions
    .filter((condition) => patientYearReviewIds.has(condition.reviewId))
    .reduce((next, condition) => {
      const wasSuppressed = getConditionHierarchySuppression(condition, review, before).fullySuppressed;
      const suppression = getConditionHierarchySuppression(condition, review, next);
      if (wasSuppressed || !suppression.fullySuppressed) return next;
      const detail = suppression.suppressedHccs
        .map(({ lower, higher, capturedCondition }) => `${lower} on ${condition.icd10} locked because ${higher} was captured through ${capturedCondition.icd10}.`)
        .join(" ");
      return addHistory(next, {
        reviewId: condition.reviewId,
        conditionId: condition.id,
        userId: user.id,
        event: "Hierarchy lock applied",
        detail
      });
    }, after);
}

function clearDraftRuleOutcomesForPatientYear(data: SeedData, review: PatientReview): SeedData {
  const reviewIds = new Set(
    data.reviews
      .filter((item) => item.patientId === review.patientId && item.calendarYear === review.calendarYear)
      .map((item) => item.id)
  );
  return {
    ...data,
    conditions: data.conditions.map((condition) =>
      reviewIds.has(condition.reviewId) && condition.draftRuleOutcome
        ? { ...condition, draftRuleOutcome: undefined }
        : condition
    )
  };
}

function refreshDraftRuleOutcomes(data: SeedData, review: PatientReview, settings: AppSettings): SeedData {
  let next = clearDraftRuleOutcomesForPatientYear(data, review);
  const reviewIds = new Set(
    next.reviews
      .filter((item) => item.patientId === review.patientId && item.calendarYear === review.calendarYear)
      .map((item) => item.id)
  );
  const patientYearConditions = next.conditions.filter((condition) => reviewIds.has(condition.reviewId));
  const threshold = Math.max(1, Math.min(10, Math.trunc(Number.isFinite(settings.sameHccValidationThreshold) ? settings.sameHccValidationThreshold : 3)));
  const validatedHccs = new Set(
    patientYearConditions
      .filter((condition) => condition.workflow === "codesOnClaim" && getEffectiveDisposition(condition)?.action === "Validate")
      .map((condition) => condition.hcc)
  );

  validatedHccs.forEach((hcc) => {
    const matching = getPatientCalendarYearHccGroup(next, review.patientId, review.calendarYear, hcc).filter(
      (condition) => condition.workflow === "codesOnClaim"
    );
    if (matching.filter((condition) => getEffectiveDisposition(condition)?.action === "Validate").length < threshold) return;
    matching.forEach((condition) => {
      if (getEffectiveDisposition(condition) || condition.ruleOutcome || condition.auditorDisposition) return;
      const explanation = `${hcc} has ${threshold} staged or completed reviewer validations for this patient and calendar year. This condition will be rule-resolved when the review is completed.`;
      next = updateCondition(next, condition.id, (item) => ({
        ...item,
        draftRuleOutcome: {
          source: "rule-resolved",
          action: "Validate",
          ruleId: "same-hcc-validation-threshold",
          explanation,
          supportingEvidenceIds: item.evidenceIds,
          createdAt: stamp()
        }
      }));
    });
  });

  return next;
}

function applyThreeValidationRule(data: SeedData, reviewId: string, hcc: string, user: User, thresholdSetting: number): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review) return data;
  const matching = getPatientCalendarYearHccGroup(data, review.patientId, review.calendarYear, hcc).filter((condition) => condition.workflow === "codesOnClaim");
  const threshold = Math.max(1, Math.min(10, Math.trunc(Number.isFinite(thresholdSetting) ? thresholdSetting : 3)));
  const validatedCount = matching.filter((condition) => condition.disposition?.action === "Validate").length;
  if (validatedCount < threshold) return data;
  let next = data;
  matching.forEach((condition) => {
    if (!condition.disposition && !condition.ruleOutcome && !condition.auditorDisposition) {
      const explanation = `${hcc} reached ${threshold} user-selected validations for this patient and calendar year. This condition was rule-resolved as validated.`;
      next = updateCondition(next, condition.id, (item) => ({
        ...item,
        ruleOutcome: {
          source: "rule-resolved",
          action: "Validate",
          ruleId: "same-hcc-validation-threshold",
          explanation,
          supportingEvidenceIds: item.evidenceIds,
          createdAt: stamp()
        },
        disabledReason: `Rule-resolved after same-HCC validation threshold (${threshold}) was reached.`
      }));
      next = addHistory(next, {
        reviewId: condition.reviewId,
        conditionId: condition.id,
        userId: user.id,
        event: "Rule-resolved condition",
        detail: explanation
      });
    }
  });
  return addHistory(next, { reviewId, userId: user.id, event: "Same-HCC rule applied", detail: `${threshold} validations reached for ${hcc}.` });
}

export function flagDocumentationIssue(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  user: User,
  issue: DocumentationIssue,
  comments?: string
): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || !userCanFlagDocumentationIssue(review, user)) return data;
  if (["Provider education", "Other documentation issue"].includes(issue) && !comments?.trim()) return data;
  let next = updateCondition(data, conditionId, (condition) => ({
    ...condition,
    documentationIssues: [{ issue, comments: comments?.trim() || undefined, userId: user.id, createdAt: stamp() }, ...condition.documentationIssues]
  }));
  const taskType: DownstreamTaskType = issue === "Provider education" ? "Provider Education" : "Manager Exception";
  next = createDownstreamTask(next, reviewId, conditionId, taskType, user, comments);
  return addHistory(next, { reviewId, conditionId, userId: user.id, event: "Documentation issue flagged", detail: issue });
}

export function startAudit(data: SeedData, reviewId: string, user: User, sampled = false, sampleRate = 0): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || (!sampled && !canStartAudit(review, user))) return data;
  const existing = data.audits.find((audit) => audit.reviewId === reviewId);
  if (existing?.status === "In Progress" || existing?.status === "Complete") return data;
  const sampleProfile = getAuditSamplingProfile(data, review, sampleRate);
  const sampledAt = sampled ? stamp() : undefined;
  let next = updateReview(data, reviewId, (item) => ({
    ...item,
    status: "Under Audit",
    queue: "Auditor Queue",
    assignedAuditorId: user.roles.includes("Auditor") ? user.id : item.assignedAuditorId ?? "u-auditor-1",
    lock: undefined
  }));
  if (existing) {
    next = {
      ...next,
      audits: next.audits.map((audit) =>
        audit.reviewId === reviewId
          ? {
              ...audit,
              auditorId: user.roles.includes("Auditor") ? user.id : audit.auditorId,
              status: "In Progress",
              selectionSource: sampled ? "deterministic-sample" : audit.selectionSource ?? "manual",
              sampledAt: sampledAt ?? audit.sampledAt,
              sampleRate: sampled ? sampleProfile.sampleRate : audit.sampleRate,
              sampleBucket: sampled ? sampleProfile.sampleBucket : audit.sampleBucket,
              sampleCategories: sampled ? sampleProfile.sampleCategories : audit.sampleCategories,
              outcome: undefined,
              completedAt: undefined
            }
          : audit
      )
    };
  } else {
    const audit: Audit = {
      id: uid("audit"),
      reviewId,
      auditorId: user.roles.includes("Auditor") ? user.id : "u-auditor-1",
      status: "In Progress",
      selectionSource: sampled ? "deterministic-sample" : "manual",
      sampledAt,
      sampleRate: sampled ? sampleProfile.sampleRate : undefined,
      sampleBucket: sampled ? sampleProfile.sampleBucket : undefined,
      sampleCategories: sampled ? sampleProfile.sampleCategories : undefined
    };
    next = { ...next, audits: [audit, ...next.audits] };
  }
  return addHistory(next, {
    reviewId,
    userId: user.id,
    event: sampled ? "Audit sample selected" : "Audit started",
    detail: sampled
      ? `Deterministic prototype sample selected from configured ${sampleProfile.sampleRate}% audit percentage across ${sampleProfile.sampleCategories.join(", ") || "review"} opportunities.`
      : "Review sent to audit."
  });
}

export function updateDownstreamTaskStatus(data: SeedData, taskId: string, user: User, status: DownstreamTaskStatus, comments?: string): SeedData {
  const task = data.downstreamTasks.find((item) => item.id === taskId);
  const review = task ? data.reviews.find((item) => item.id === task.reviewId) : undefined;
  if (!task || !review) return data;
  const canUpdate = hasAnyRole(user, ["Administrator", "Manager"]) || task.assignedUserId === user.id || isReviewLockOwner(review, user);
  if (!canUpdate || status === "Cancelled") return data;
  const next = {
    ...data,
    downstreamTasks: data.downstreamTasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            status,
            comments: comments?.trim() || item.comments
          }
        : item
    )
  };
  return addHistory(next, {
    reviewId: task.reviewId,
    conditionId: task.conditionId,
    userId: user.id,
    event: "Downstream task updated",
    detail: `${task.type} marked ${status}.${comments?.trim() ? ` ${comments.trim()}` : ""}`
  });
}

export function completeAudit(data: SeedData, reviewId: string, user: User, outcome: "Agree" | "Disagree" | "Return for Correction", comments?: string): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const existingAudit = data.audits.find((audit) => audit.reviewId === reviewId);
  if (!review || !existingAudit || !userCanCompleteAudit(review, user) || existingAudit.status === "Complete") return data;
  if (outcome === "Return for Correction" && !comments?.trim()) return data;

  const completedAt = stamp();
  const auditStatus: Audit["status"] = outcome === "Return for Correction" ? "Returned" : "Complete";
  let next = {
    ...data,
    audits: data.audits.map((audit) =>
      audit.reviewId === reviewId
        ? {
            ...audit,
            auditorId: user.id,
            status: auditStatus,
            outcome,
            comments: comments?.trim() || undefined,
            completedAt
          }
        : audit
    ),
    conditions: data.conditions.map((condition) =>
      condition.reviewId === reviewId && condition.disposition
        ? {
            ...condition,
            auditorDisposition: {
              outcome,
              comments: comments?.trim() || undefined,
              auditorId: user.id,
              decidedAt: completedAt,
              agreedWithUser: outcome === "Agree",
              source: "auditor-selected" as const
            },
            agreementWithAuditor: outcome === "Agree"
          }
        : condition
    )
  };
  next = updateReview(next, reviewId, (item) =>
    outcome === "Return for Correction"
      ? {
          ...item,
          status: "Rework Required",
          queue: "CDI/Coder Queue",
          assignedAuditorId: undefined,
          lock: undefined,
          auditReturn: {
            auditId: existingAudit.id,
            returnedByUserId: user.id,
            returnedAt: completedAt,
            comments: comments!.trim()
          }
        }
      : { ...item, status: "Audit Complete", queue: "Auditor Queue", lock: undefined }
  );
  return addHistory(next, { reviewId, userId: user.id, event: "Audit completed", detail: comments?.trim() ? `${outcome}: ${comments.trim()}` : outcome });
}

export function reopenAudit(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  const audit = data.audits.find((item) => item.reviewId === reviewId);
  if (!review || !audit || !canReopenAudit(user)) return data;
  const reopenedAt = stamp();
  let next = {
    ...data,
    audits: data.audits.map((item) =>
      item.reviewId === reviewId
        ? {
            ...item,
            auditorId: user.roles.includes("Auditor") ? user.id : item.auditorId,
            status: "In Progress" as const,
            outcome: undefined,
            completedAt: undefined,
            reopenedAt
          }
        : item
    )
  };
  next = updateReview(next, reviewId, (item) => ({
    ...item,
    status: "Under Audit",
    queue: "Auditor Queue",
    assignedAuditorId: user.roles.includes("Auditor") ? user.id : item.assignedAuditorId ?? audit.auditorId,
    lock: undefined
  }));
  return addHistory(next, { reviewId, userId: user.id, event: "Audit reopened", detail: "Completed audit reopened for deliberate follow-up." });
}
