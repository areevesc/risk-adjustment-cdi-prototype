import type { AppSettings, Condition, PatientReview, SeedData } from "../domain/types";

export const CURRENT_CONTENT_REVISION = 3;

export interface PersistedState {
  contentRevision: number;
  currentUserId: string;
  settings: AppSettings;
  data: SeedData;
}

export type StoredPersistedState = Omit<PersistedState, "contentRevision"> & {
  contentRevision?: number;
};

const reviewWorkflowFields = ["status", "queue", "assignedUserId", "assignedAuditorId", "coverage", "lock", "auditReturn"] as const;
const conditionWorkflowFields = ["disposition", "ruleOutcome", "auditorDisposition", "agreementWithAuditor", "documentationIssues", "disabledReason"] as const;

function overlayFields<T extends object, K extends keyof T>(current: T, persisted: T | undefined, fields: readonly K[]): T {
  if (!persisted) return current;
  const overlay = {} as Pick<T, K>;
  for (const field of fields) overlay[field] = persisted[field];
  return { ...current, ...overlay };
}

function replaceSeedReviewRows<T extends { reviewId: string }>(persisted: T[], seedRows: T[], seedReviewIds: Set<string>): T[] {
  return [...seedRows, ...persisted.filter((item) => !seedReviewIds.has(item.reviewId))];
}

/**
 * Replaces every seed-owned clinical record as one content bundle while retaining
 * mutable review decisions and every record belonging to generated/custom reviews.
 */
export function refreshSeedClinicalBundles(persisted: SeedData, seed: SeedData): SeedData {
  const seedReviewIds = new Set(seed.reviews.map((review) => review.id));
  const seedPatientIds = new Set(seed.patients.map((patient) => patient.id));
  const persistedReviewById = new Map(persisted.reviews.map((review) => [review.id, review]));
  const persistedConditionById = new Map(persisted.conditions.map((condition) => [condition.id, condition]));

  const reviews = [
    ...seed.reviews.map((review) => overlayFields<PatientReview, keyof PatientReview>(review, persistedReviewById.get(review.id), reviewWorkflowFields)),
    ...persisted.reviews.filter((review) => !seedReviewIds.has(review.id))
  ];
  const conditions = [
    ...seed.conditions.map((condition) => overlayFields<Condition, keyof Condition>(condition, persistedConditionById.get(condition.id), conditionWorkflowFields)),
    ...persisted.conditions.filter((condition) => !seedReviewIds.has(condition.reviewId))
  ];

  return {
    ...persisted,
    patients: [...seed.patients, ...persisted.patients.filter((patient) => !seedPatientIds.has(patient.id))],
    reviews,
    documents: replaceSeedReviewRows(persisted.documents, seed.documents, seedReviewIds),
    evidence: replaceSeedReviewRows(persisted.evidence, seed.evidence, seedReviewIds),
    claims: replaceSeedReviewRows(persisted.claims, seed.claims, seedReviewIds),
    charts: replaceSeedReviewRows(persisted.charts, seed.charts, seedReviewIds),
    conditions,
    appointments: [...seed.appointments, ...persisted.appointments.filter((appointment) => !seedPatientIds.has(appointment.patientId))]
  };
}

export function storedContentRevision(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}
