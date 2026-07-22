import React, { createContext, useContext, useMemo, useState } from "react";
import { demoSeedData as seedData } from "../data/seed";
import type { AppSettings, AssignmentMode, Condition, ConditionDecision, DocumentationIssue, DownstreamTaskStatus, PatientReview, QueueType, RecommendationAction, Role, RoutingOutcome, SeedData, User } from "../domain/types";
import {
  assignReview,
  clearDispositionDraft,
  clearProspectiveHandoffDraft,
  completeAudit,
  completeReview,
  flagDocumentationIssue,
  openNextEligibleReview,
  openReview,
  overrideLock,
  pendAndOpenNextEligibleReview,
  pendReview,
  releaseReview,
  reopenAudit,
  routeReview,
  setDisposition,
  stageProspectiveHandoff,
  startAudit,
  takeCoverage,
  updateDownstreamTaskStatus
} from "../domain/workflows";
import { getCurrentUser, getUnresolvedConditions } from "../domain/selectors";
import type { DisagreeReason, RecommendationMode } from "../domain/types";
import {
  CURRENT_CONTENT_REVISION,
  refreshSeedClinicalBundles,
  storedContentRevision,
  type PersistedState,
  type StoredPersistedState
} from "./persistence";

const storageKey = "risk-adjustment-cdi-prototype-state-v1";

interface AppStateValue extends PersistedState {
  currentUser: User;
  setCurrentUserId: (userId: string) => void;
  setRecommendationMode: (mode: RecommendationMode) => void;
  setAuditSampleRate: (rate: number) => void;
  setPrototypeCurrentYear: (year: number) => void;
  setSameHccValidationThreshold: (threshold: number) => void;
  resetDemo: () => void;
  actions: {
    openReview: (reviewId: string) => void;
    openNextEligibleReview: (currentReviewId: string) => string | undefined;
    releaseReview: (reviewId: string) => void;
    overrideLock: (reviewId: string, reason: string) => void;
    pendReview: (reviewId: string) => void;
    pendAndOpenNextEligibleReview: (currentReviewId: string) => string | undefined;
    routeReview: (reviewId: string, queue: PatientReview["queue"]) => void;
    completeReview: (reviewId: string) => string[];
    assignReview: (reviewId: string, assignedUserId: string, mode?: AssignmentMode, reason?: string) => void;
    takeCoverage: (reviewId: string) => void;
    setDisposition: (
      reviewId: string,
      conditionId: string,
      action: RecommendationAction,
      agreedWithRecommendation?: boolean,
      reason?: DisagreeReason,
      comments?: string,
      replacementCode?: string
    ) => void;
    clearDispositionDraft: (reviewId: string, conditionId: string) => void;
    stageProspectiveHandoff: (reviewId: string, conditionId: string, note?: string) => void;
    clearProspectiveHandoffDraft: (reviewId: string, conditionId: string) => void;
    flagDocumentationIssue: (reviewId: string, conditionId: string, issue: DocumentationIssue, comments?: string) => void;
    startAudit: (reviewId: string) => void;
    completeAudit: (reviewId: string, outcome: "Agree" | "Disagree" | "Return for Correction", comments?: string) => void;
    reopenAudit: (reviewId: string) => void;
    updateDownstreamTaskStatus: (taskId: string, status: DownstreamTaskStatus, comments?: string) => void;
  };
}

const defaultSettings: AppSettings = {
  recommendationMode: "simulated",
  auditSampleRate: 25,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

const initialState: PersistedState = {
  contentRevision: CURRENT_CONTENT_REVISION,
  currentUserId: "u-coder-1",
  settings: defaultSettings,
  data: seedData
};

const legacyRoleMap: Record<string, Role> = {
  Administrator: "Administrator",
  Manager: "Manager",
  Auditor: "Auditor",
  Coder: "CDI/Coder",
  "CDI Specialist": "CDI/Coder",
  "CDI/Coder": "CDI/Coder"
};

const legacyUserIdMap: Record<string, string> = {
  "u-admin": "u-admin",
  "u-manager-1": "u-manager-1",
  "u-manager-2": "u-manager-1",
  "u-auditor-1": "u-auditor-1",
  "u-auditor-2": "u-auditor-1",
  "u-coder-1": "u-coder-1",
  "u-coder-2": "u-coder-2",
  "u-coder-3": "u-coder-3",
  "u-coder-4": "u-coder-4",
  "u-coder-5": "u-coder-1",
  "u-coder-6": "u-coder-1",
  "u-cdi-1": "u-coder-1",
  "u-cdi-2": "u-coder-2",
  "u-cdi-3": "u-coder-3",
  "u-cdi-4": "u-coder-4",
  "u-cdi-5": "u-coder-4"
};

function normalizeUserId(id: string | undefined) {
  return id ? legacyUserIdMap[id] ?? id : id;
}

function normalizeRole(role: unknown): Role {
  return legacyRoleMap[String(role)] ?? "CDI/Coder";
}

function normalizeQueue(queue: unknown): QueueType {
  if (queue === "Assigned Coder" || queue === "Assigned CDI Specialist" || queue === "Unassigned Team Queue") return "CDI/Coder Queue";
  if (queue === "Auditor Queue" || queue === "Manager Review Queue" || queue === "Prospective Review Queue" || queue === "CDI/Coder Queue") return queue;
  return "CDI/Coder Queue";
}

export function normalizeSeedData(rawData: SeedData): SeedData {
  const raw = rawData as SeedData & {
    clinics: Array<SeedData["clinics"][number] & { defaultCoderId?: string; defaultCdiId?: string }>;
    reviews: Array<PatientReview & { assignedCoderId?: string; assignedCdiId?: string; assignedUserId?: string }>;
  };
  const clinics = raw.clinics.map((clinic) => {
    const legacyClinic = clinic as typeof clinic & { defaultCoderId?: string; defaultCdiId?: string };
    const { defaultCoderId: _defaultCoderId, defaultCdiId: _defaultCdiId, ...currentClinic } = legacyClinic;
    return {
      ...currentClinic,
      defaultAssigneeId: clinic.defaultAssigneeId ?? legacyClinic.defaultCoderId ?? legacyClinic.defaultCdiId ?? "u-coder-1"
    };
  });
  const clinicById = new Map(clinics.map((clinic) => [clinic.id, clinic]));
  const users = seedData.users;
  return {
    ...raw,
    users,
    teams: raw.teams.map((team) => ({ ...team, managerId: normalizeUserId(team.managerId) ?? "u-manager-1" })),
    clinics: clinics.map((clinic) => ({ ...clinic, defaultAssigneeId: normalizeUserId(clinic.defaultAssigneeId) ?? "u-coder-1" })),
    reviews: raw.reviews.map((review) => {
      const legacyReview = review as typeof review & { assignedCoderId?: string; assignedCdiId?: string };
      const { assignedCoderId: _assignedCoderId, assignedCdiId: _assignedCdiId, ...currentReview } = legacyReview;
      const assignedUserId = normalizeUserId(review.assignedUserId ?? legacyReview.assignedCoderId ?? legacyReview.assignedCdiId ?? clinicById.get(review.clinicId)?.defaultAssigneeId) ?? "u-coder-1";
      return {
        ...currentReview,
        queue: normalizeQueue(review.queue),
        assignedUserId,
        assignedAuditorId: normalizeUserId(review.assignedAuditorId),
        lock: review.lock ? { ...review.lock, lockedByUserId: normalizeUserId(review.lock.lockedByUserId) ?? assignedUserId } : undefined,
        coverage: review.coverage
          ? {
              ...review.coverage,
              originalAssignedUserId: normalizeUserId(review.coverage.originalAssignedUserId) ?? assignedUserId,
              coveringUserId: normalizeUserId(review.coverage.coveringUserId) ?? assignedUserId,
              initiatedByUserId: normalizeUserId(review.coverage.initiatedByUserId) ?? assignedUserId
            }
          : undefined
      };
    }),
    audits: raw.audits.map((audit) => ({ ...audit, auditorId: normalizeUserId(audit.auditorId) ?? "u-auditor-1" })),
    conditions: raw.conditions.map((condition) => ({
      ...condition,
      disposition: condition.disposition ? { ...condition.disposition, userId: normalizeUserId(condition.disposition.userId) ?? "u-coder-1" } : undefined,
      draftDisposition: condition.draftDisposition ? { ...condition.draftDisposition, userId: normalizeUserId(condition.draftDisposition.userId) ?? "u-coder-1" } : undefined,
      draftProspectiveHandoff: condition.draftProspectiveHandoff
        ? { ...condition.draftProspectiveHandoff, userId: normalizeUserId(condition.draftProspectiveHandoff.userId) ?? "u-coder-1" }
        : undefined,
      decision: condition.decision ? { ...condition.decision, userId: normalizeUserId(condition.decision.userId) ?? "u-coder-1" } : undefined,
      draftDecision: condition.draftDecision ? { ...condition.draftDecision, userId: normalizeUserId(condition.draftDecision.userId) ?? "u-coder-1" } : undefined,
      routingOutcome: condition.routingOutcome ? { ...condition.routingOutcome, userId: normalizeUserId(condition.routingOutcome.userId) ?? "u-coder-1" } : undefined,
      draftRoutingOutcome: condition.draftRoutingOutcome
        ? { ...condition.draftRoutingOutcome, userId: normalizeUserId(condition.draftRoutingOutcome.userId) ?? "u-coder-1" }
        : undefined,
      auditorDisposition: condition.auditorDisposition ? { ...condition.auditorDisposition, auditorId: normalizeUserId(condition.auditorDisposition.auditorId) ?? "u-auditor-1" } : undefined,
      documentationIssues: condition.documentationIssues.map((issue) => ({ ...issue, userId: normalizeUserId(issue.userId) ?? "u-coder-1" })),
      ruleOutcome: condition.ruleOutcome?.ruleId === "same-hcc-duplicate-add" ? undefined : condition.ruleOutcome,
      draftRuleOutcome: condition.draftRuleOutcome?.ruleId === "same-hcc-duplicate-add" ? undefined : condition.draftRuleOutcome,
      disabledReason:
        condition.ruleOutcome?.ruleId === "same-hcc-duplicate-add" || condition.draftRuleOutcome?.ruleId === "same-hcc-duplicate-add"
          ? undefined
          : condition.disabledReason
    })),
    downstreamTasks: (raw.downstreamTasks ?? []).map((task) => ({
      ...task,
      assignedUserId: normalizeUserId(task.assignedUserId),
      createdByUserId: normalizeUserId(task.createdByUserId) ?? "u-coder-1",
      updatedByUserId: normalizeUserId(task.updatedByUserId)
    })),
    history: raw.history.map((entry) => ({ ...entry, userId: normalizeUserId(entry.userId) ?? "u-coder-1" }))
  };
}

export function migratePersistedState(parsed: StoredPersistedState): PersistedState {
  const previousRevision = storedContentRevision(parsed.contentRevision);
  const mergedData = { ...seedData, ...parsed.data, downstreamTasks: parsed.data.downstreamTasks ?? [] };
  const refreshedData = previousRevision < CURRENT_CONTENT_REVISION ? refreshSeedClinicalBundles(mergedData, seedData) : mergedData;
  const normalizedData = normalizeSeedData(refreshedData);
  const legacyMigrated = previousRevision < CURRENT_CONTENT_REVISION ? migrateLegacyImmediateDecisions(normalizedData) : normalizedData;
  const visitMigrated = previousRevision < 11 ? migrateVisitBasedWorkflow(legacyMigrated) : legacyMigrated;
  const data = previousRevision < 12 ? migrateDocumentActionContract(visitMigrated) : visitMigrated;
  const currentUser = data.users.find((user) => user.id === parsed.currentUserId) ?? data.users.find((user) => user.id === initialState.currentUserId) ?? data.users[0];
  return {
    contentRevision: Math.max(previousRevision, CURRENT_CONTENT_REVISION),
    currentUserId: currentUser.id,
    settings: { ...defaultSettings, ...parsed.settings },
    data
  };
}

function migrateDocumentActionContract(data: SeedData): SeedData {
  const reviewById = new Map(data.reviews.map((review) => [review.id, review]));
  const appointmentIds = new Set(data.appointments.map((appointment) => appointment.id));
  return {
    ...data,
    conditions: data.conditions.map((condition) => {
      const review = reviewById.get(condition.reviewId);
      const scheduled = Boolean(review?.appointmentId && appointmentIds.has(review.appointmentId));
      const committed = condition.disposition;
      const draft = condition.draftDisposition;
      const decision = decisionForMigratedAction(committed?.action, scheduled);
      const draftDecision = decisionForMigratedAction(draft?.action, scheduled);
      const route = routeForMigratedCondition(condition, scheduled);
      return {
        ...condition,
        decision: condition.decision ?? (decision && committed ? {
          decision,
          reason: committed.reason,
          replacementCode: committed.replacementCode,
          comments: committed.comments,
          userId: committed.userId,
          decidedAt: committed.decidedAt
        } : undefined),
        draftDecision: condition.draftDecision ?? (draftDecision && draft ? {
          decision: draftDecision,
          reason: draft.reason,
          replacementCode: draft.replacementCode,
          comments: draft.comments,
          userId: draft.userId,
          stagedAt: draft.stagedAt
        } : undefined),
        routingOutcome: condition.routingOutcome ?? (route && committed ? {
          outcome: route,
          userId: committed.userId,
          routedAt: committed.decidedAt,
          appointmentId: route === "providerQueryTask" ? review?.appointmentId : undefined,
          comments: committed.comments
        } : undefined),
        draftRoutingOutcome: condition.draftRoutingOutcome ?? (route && draft ? {
          outcome: route,
          userId: draft.userId,
          stagedAt: draft.stagedAt,
          appointmentId: route === "providerQueryTask" ? review?.appointmentId : undefined,
          comments: draft.comments
        } : undefined)
      };
    })
  };
}

function decisionForMigratedAction(action: RecommendationAction | undefined, _scheduled: boolean): ConditionDecision | undefined {
  if (action === "Validate") return "validate";
  if (action === "Delete") return "delete";
  if (action === "Add to Claim") return "addToClaim";
  if (action === "Disagree" || action === "No") return "dismiss";
  if (action === "Change") return "changeCode";
  if (action === "Yes") return "prepareProviderQuery";
  return undefined;
}

function routeForMigratedCondition(condition: Condition, scheduled: boolean): Exclude<RoutingOutcome, "none"> | undefined {
  const action = condition.draftDisposition?.action ?? condition.disposition?.action;
  const reason = condition.draftDisposition?.reason ?? condition.disposition?.reason;
  if (action === "Add to Claim") return "additionExport";
  if (action === "Delete") return "deletionExport";
  if (action === "Yes" || action === "Send to Prospective" || condition.draftProspectiveHandoff) {
    return scheduled ? "providerQueryTask" : "prospectiveHold";
  }
  if (action === "Change" && condition.workflow === "prospective") return scheduled ? "providerQueryTask" : "prospectiveHold";
  if (action === "Disagree" && (reason === "Not Enough MEAT" || reason === "Conflicting Evidence")) {
    return scheduled ? "providerQueryTask" : "prospectiveHold";
  }
  if (action === "Disagree" && reason === "Other") return "exceptionRouting";
  return undefined;
}

function migrateVisitBasedWorkflow(data: SeedData): SeedData {
  const seedAngelaReview = seedData.reviews.find((review) => review.id === "rev-108")!;
  const seedAngelaConditions = new Map(seedData.conditions.filter((condition) => condition.reviewId === "rev-108").map((condition) => [condition.id, condition]));
  const reviewById = new Map(data.reviews.map((review) => [review.id, review]));
  const appointmentIds = new Set(data.appointments.map((appointment) => appointment.id));
  const migratedConditions = data.conditions.map((condition) => {
    if (condition.reviewId === "rev-108") return structuredClone(seedAngelaConditions.get(condition.id) ?? condition);
    const review = reviewById.get(condition.reviewId);
    const scheduled = Boolean(review?.appointmentId && appointmentIds.has(review.appointmentId));
    const committed = condition.disposition;
    const draft = condition.draftDisposition;
    const decision = decisionForMigratedAction(committed?.action, scheduled);
    const draftDecision = decisionForMigratedAction(draft?.action, scheduled);
    const route = routeForMigratedCondition(condition, scheduled);
    return {
      ...condition,
      decision: condition.decision ?? (decision && committed
        ? {
            decision,
            reason: committed.reason,
            replacementCode: committed.replacementCode,
            comments: committed.comments,
            userId: committed.userId,
            decidedAt: committed.decidedAt
          }
        : undefined),
      draftDecision: condition.draftDecision ?? (draftDecision && draft
        ? {
            decision: draftDecision,
            reason: draft.reason,
            replacementCode: draft.replacementCode,
            comments: draft.comments,
            userId: draft.userId,
            stagedAt: draft.stagedAt
          }
        : undefined),
      routingOutcome: condition.routingOutcome ?? (route && committed
        ? {
            outcome: route,
            userId: committed.userId,
            routedAt: committed.decidedAt,
            appointmentId: route === "providerQueryTask" ? review?.appointmentId : undefined,
            comments: committed.comments
          }
        : undefined),
      draftRoutingOutcome: condition.draftRoutingOutcome ?? (route && (draft || condition.draftProspectiveHandoff)
        ? {
            outcome: route,
            userId: draft?.userId ?? condition.draftProspectiveHandoff!.userId,
            stagedAt: draft?.stagedAt ?? condition.draftProspectiveHandoff!.stagedAt,
            appointmentId: route === "providerQueryTask" ? review?.appointmentId : undefined,
            comments: draft?.comments ?? condition.draftProspectiveHandoff?.note
          }
        : undefined)
    };
  });
  let migrated: SeedData = {
    ...data,
    conditions: migratedConditions,
    reviews: data.reviews.map((review) =>
      review.id === "rev-108"
        ? { ...review, ...seedAngelaReview, lock: seedAngelaReview.lock ? { ...seedAngelaReview.lock } : undefined }
        : ["Completed", "Under Audit", "Audit Complete"].includes(review.status)
          ? { ...review, lock: undefined }
          : review
    ),
    downstreamTasks: data.downstreamTasks.map((task) => {
      if (task.type !== "Prospective CDI Review") return task;
      const review = reviewById.get(task.reviewId);
      const scheduled = Boolean(review?.appointmentId && appointmentIds.has(review.appointmentId));
      return scheduled
        ? { ...task, type: "Provider Query", queue: "Provider Query Queue", appointmentId: review?.appointmentId }
        : { ...task, appointmentId: undefined };
    })
  };

  migrated = {
    ...migrated,
    reviews: migrated.reviews.map((review) => {
      if (review.id === "rev-108" || !["Completed", "Under Audit", "Audit Complete"].includes(review.status)) return review;
      return getUnresolvedConditions(migrated, review).length > 0
        ? { ...review, status: "Available", queue: "CDI/Coder Queue", lock: undefined }
        : { ...review, lock: undefined };
    })
  };
  return migrated;
}

function migrateLegacyImmediateDecisions(data: SeedData): SeedData {
  const finalStatuses = new Set<PatientReview["status"]>(["Completed", "Under Audit", "Audit Complete"]);
  const unfinishedReviewIds = new Set(data.reviews.filter((review) => !finalStatuses.has(review.status)).map((review) => review.id));
  const reviewById = new Map(data.reviews.map((review) => [review.id, review]));
  const convertedConditionIds = new Set(
    data.conditions
      .filter(
        (condition) =>
          unfinishedReviewIds.has(condition.reviewId) &&
          Boolean(condition.disposition || condition.draftDisposition?.action === "Send to Prospective")
      )
      .map((condition) => condition.id)
  );
  const actionTaskTypes = new Set(["Addition to Claim", "Deletion", "Provider Query", "Prospective CDI Review", "Scheduling Outreach"]);
  const draftHistoryEvents = new Set(["Action selected", "Hierarchy lock applied", "Rule-resolved condition", "Rule-suppressed condition"]);

  return {
    ...data,
    conditions: data.conditions.map((condition) => {
      if (!unfinishedReviewIds.has(condition.reviewId)) return condition;
      const legacyDisposition = condition.disposition;
      const legacyProspectiveHandoff =
        legacyDisposition?.action === "Send to Prospective"
          ? legacyDisposition
          : condition.draftDisposition?.action === "Send to Prospective"
            ? condition.draftDisposition
            : undefined;
      const sourceCalendarYear = reviewById.get(condition.reviewId)?.calendarYear ?? 2025;
      const convertRuleOutcome = ["same-hcc-validation-threshold", "same-hcc-duplicate-add"].includes(condition.ruleOutcome?.ruleId ?? "");
      return {
        ...condition,
        disposition: legacyDisposition ? undefined : condition.disposition,
        draftDisposition: legacyProspectiveHandoff
          ? undefined
          : legacyDisposition
          ? condition.draftDisposition ?? {
              ...legacyDisposition,
              stagedAt: legacyDisposition.decidedAt,
              decidedAt: undefined
            }
          : condition.draftDisposition,
        draftProspectiveHandoff: legacyProspectiveHandoff
          ? condition.draftProspectiveHandoff ?? {
              targetCalendarYear: sourceCalendarYear + 1,
              note: legacyProspectiveHandoff.comments,
              userId: legacyProspectiveHandoff.userId,
              stagedAt: "decidedAt" in legacyProspectiveHandoff ? legacyProspectiveHandoff.decidedAt : legacyProspectiveHandoff.stagedAt
            }
          : condition.draftProspectiveHandoff,
        ruleOutcome: convertRuleOutcome ? undefined : condition.ruleOutcome,
        draftRuleOutcome: convertRuleOutcome ? condition.draftRuleOutcome ?? condition.ruleOutcome : condition.draftRuleOutcome
      };
    }),
    downstreamTasks: data.downstreamTasks.filter(
      (task) => !(convertedConditionIds.has(task.conditionId) && actionTaskTypes.has(task.type))
    ),
    history: data.history.filter(
      (entry) =>
        !(entry.conditionId && convertedConditionIds.has(entry.conditionId) && draftHistoryEvents.has(entry.event)) &&
        !(unfinishedReviewIds.has(entry.reviewId) && entry.event === "Same-HCC rule applied")
    )
  };
}

function persistState(state: PersistedState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The prototype remains usable when storage is disabled or full.
  }
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as StoredPersistedState;
    if (!parsed.data?.reviews?.length) return initialState;
    const next = migratePersistedState(parsed);
    persistState(next);
    return next;
  } catch {
    return initialState;
  }
}

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => loadInitialState());

  function commit(next: PersistedState) {
    setState(next);
    persistState(next);
  }

  const currentUser = getCurrentUser(state.data, state.currentUserId);

  const value = useMemo<AppStateValue>(() => {
    const withData = (updater: (data: SeedData) => SeedData) => {
      const next = { ...state, data: updater(state.data) };
      commit(next);
    };

    return {
      ...state,
      currentUser,
      setCurrentUserId: (userId) => commit({ ...state, currentUserId: userId }),
      setRecommendationMode: (mode) => commit({ ...state, settings: { ...state.settings, recommendationMode: mode } }),
      setAuditSampleRate: (rate) => commit({ ...state, settings: { ...state.settings, auditSampleRate: Math.max(0, Math.min(100, Number.isFinite(rate) ? rate : 0)) } }),
      setPrototypeCurrentYear: (year) =>
        commit({
          ...state,
          settings: { ...state.settings, prototypeCurrentYear: Math.max(2020, Math.min(2035, Math.trunc(Number.isFinite(year) ? year : 2026))) }
        }),
      setSameHccValidationThreshold: (threshold) =>
        commit({
          ...state,
          settings: { ...state.settings, sameHccValidationThreshold: Math.max(1, Math.min(10, Math.trunc(Number.isFinite(threshold) ? threshold : 3))) }
        }),
      resetDemo: () => commit(initialState),
      actions: {
        openReview: (reviewId) => withData((data) => openReview(data, reviewId, currentUser)),
        openNextEligibleReview: (currentReviewId) => {
          const result = openNextEligibleReview(state.data, currentReviewId, currentUser);
          if (result.nextReviewId) commit({ ...state, data: result.data });
          return result.nextReviewId;
        },
        releaseReview: (reviewId) => withData((data) => releaseReview(data, reviewId, currentUser)),
        overrideLock: (reviewId, reason) => withData((data) => overrideLock(data, reviewId, currentUser, reason)),
        pendReview: (reviewId) => withData((data) => pendReview(data, reviewId, currentUser)),
        pendAndOpenNextEligibleReview: (currentReviewId) => {
          const result = pendAndOpenNextEligibleReview(state.data, currentReviewId, currentUser);
          commit({ ...state, data: result.data });
          return result.nextReviewId;
        },
        routeReview: (reviewId, queue) => withData((data) => routeReview(data, reviewId, currentUser, queue)),
        completeReview: (reviewId) => {
          const result = completeReview(state.data, reviewId, currentUser, state.settings);
          if (result.unresolved.length === 0) commit({ ...state, data: result.data });
          return result.unresolved.map((condition) => condition.id);
        },
        assignReview: (reviewId, assignedUserId, mode, reason) => withData((data) => assignReview(data, reviewId, currentUser, assignedUserId, mode, reason)),
        takeCoverage: (reviewId) => withData((data) => takeCoverage(data, reviewId, currentUser)),
        setDisposition: (reviewId, conditionId, action, agreed, reason, comments, replacementCode) =>
          withData((data) => setDisposition(data, reviewId, conditionId, currentUser, action, agreed, state.settings, reason, comments, replacementCode)),
        clearDispositionDraft: (reviewId, conditionId) =>
          withData((data) => clearDispositionDraft(data, reviewId, conditionId, currentUser, state.settings)),
        stageProspectiveHandoff: (reviewId, conditionId, note) =>
          withData((data) => stageProspectiveHandoff(data, reviewId, conditionId, currentUser, note)),
        clearProspectiveHandoffDraft: (reviewId, conditionId) =>
          withData((data) => clearProspectiveHandoffDraft(data, reviewId, conditionId, currentUser)),
        flagDocumentationIssue: (reviewId, conditionId, issue, comments) => withData((data) => flagDocumentationIssue(data, reviewId, conditionId, currentUser, issue, comments)),
        startAudit: (reviewId) => withData((data) => startAudit(data, reviewId, currentUser)),
        completeAudit: (reviewId, outcome, comments) => withData((data) => completeAudit(data, reviewId, currentUser, outcome, comments)),
        reopenAudit: (reviewId) => withData((data) => reopenAudit(data, reviewId, currentUser)),
        updateDownstreamTaskStatus: (taskId, status, comments) => withData((data) => updateDownstreamTaskStatus(data, taskId, currentUser, status, comments))
      }
    };
  }, [currentUser, state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used within AppStateProvider");
  return context;
}
