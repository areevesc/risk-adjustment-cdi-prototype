import React, { createContext, useContext, useMemo, useState } from "react";
import { seedData } from "../data/seed";
import type { AppSettings, AssignmentMode, DocumentationIssue, DownstreamTaskStatus, PatientReview, QueueType, RecommendationAction, Role, SeedData, User } from "../domain/types";
import {
  assignReview,
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
  startAudit,
  takeCoverage,
  updateDownstreamTaskStatus
} from "../domain/workflows";
import { getCurrentUser } from "../domain/selectors";
import type { DisagreeReason, RecommendationMode } from "../domain/types";

const storageKey = "risk-adjustment-cdi-prototype-state-v1";

interface PersistedState {
  currentUserId: string;
  settings: AppSettings;
  data: SeedData;
}

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
  const users = raw.users.map((user) => {
    const roles = Array.from(new Set(user.roles.map(normalizeRole)));
    return {
      ...user,
      roles,
      primaryRole: normalizeRole(user.primaryRole)
    };
  });
  return {
    ...raw,
    users,
    clinics,
    reviews: raw.reviews.map((review) => {
      const legacyReview = review as typeof review & { assignedCoderId?: string; assignedCdiId?: string };
      const { assignedCoderId: _assignedCoderId, assignedCdiId: _assignedCdiId, ...currentReview } = legacyReview;
      return {
        ...currentReview,
        queue: normalizeQueue(review.queue),
        assignedUserId: review.assignedUserId ?? legacyReview.assignedCoderId ?? legacyReview.assignedCdiId ?? clinicById.get(review.clinicId)?.defaultAssigneeId ?? "u-coder-1",
        assignedAuditorId: review.assignedAuditorId
      };
    })
  };
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.data?.reviews?.length) return initialState;
    const data = normalizeSeedData({ ...seedData, ...parsed.data, downstreamTasks: parsed.data.downstreamTasks ?? [] });
    const currentUser = data.users.find((user) => user.id === parsed.currentUserId) ?? data.users.find((user) => user.id === initialState.currentUserId) ?? data.users[0];
    const next = {
      currentUserId: currentUser.id,
      settings: { ...defaultSettings, ...parsed.settings },
      data
    };
    localStorage.setItem(storageKey, JSON.stringify(next));
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
    localStorage.setItem(storageKey, JSON.stringify(next));
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
