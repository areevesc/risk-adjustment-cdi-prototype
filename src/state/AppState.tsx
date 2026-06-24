import React, { createContext, useContext, useMemo, useState } from "react";
import { seedData } from "../data/seed";
import type { AppSettings, DocumentationIssue, PatientReview, RecommendationAction, SeedData, User } from "../domain/types";
import {
  assignReview,
  completeAudit,
  completeReview,
  flagDocumentationIssue,
  openReview,
  overrideLock,
  pendReview,
  releaseReview,
  routeReview,
  setDisposition,
  startAudit,
  takeCoverage
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
  resetDemo: () => void;
  actions: {
    openReview: (reviewId: string) => void;
    releaseReview: (reviewId: string) => void;
    overrideLock: (reviewId: string, reason: string) => void;
    pendReview: (reviewId: string) => void;
    routeReview: (reviewId: string, queue: PatientReview["queue"]) => void;
    completeReview: (reviewId: string) => string[];
    assignReview: (reviewId: string, assignedUserId: string) => void;
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
  };
}

const defaultSettings: AppSettings = {
  recommendationMode: "simulated",
  auditSampleRate: 25
};

const initialState: PersistedState = {
  currentUserId: "u-coder-1",
  settings: defaultSettings,
  data: seedData
};

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.data?.reviews?.length) return initialState;
    return parsed;
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
      setAuditSampleRate: (rate) => commit({ ...state, settings: { ...state.settings, auditSampleRate: rate } }),
      resetDemo: () => commit(initialState),
      actions: {
        openReview: (reviewId) => withData((data) => openReview(data, reviewId, currentUser)),
        releaseReview: (reviewId) => withData((data) => releaseReview(data, reviewId, currentUser)),
        overrideLock: (reviewId, reason) => withData((data) => overrideLock(data, reviewId, currentUser, reason)),
        pendReview: (reviewId) => withData((data) => pendReview(data, reviewId, currentUser)),
        routeReview: (reviewId, queue) => withData((data) => routeReview(data, reviewId, currentUser, queue)),
        completeReview: (reviewId) => {
          const result = completeReview(state.data, reviewId, currentUser);
          if (result.unresolved.length === 0) commit({ ...state, data: result.data });
          return result.unresolved.map((condition) => condition.id);
        },
        assignReview: (reviewId, assignedUserId) => withData((data) => assignReview(data, reviewId, currentUser, assignedUserId)),
        takeCoverage: (reviewId) => withData((data) => takeCoverage(data, reviewId, currentUser)),
        setDisposition: (reviewId, conditionId, action, agreed, reason, comments, replacementCode) =>
          withData((data) => setDisposition(data, reviewId, conditionId, currentUser, action, agreed, reason, comments, replacementCode)),
        flagDocumentationIssue: (reviewId, conditionId, issue, comments) => withData((data) => flagDocumentationIssue(data, reviewId, conditionId, currentUser, issue, comments)),
        startAudit: (reviewId) => withData((data) => startAudit(data, reviewId, currentUser)),
        completeAudit: (reviewId, outcome, comments) => withData((data) => completeAudit(data, reviewId, currentUser, outcome, comments))
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
