import type {
  AppSettings,
  Audit,
  Category,
  Condition,
  EvidencePassage,
  PatientReview,
  Recommendation,
  SeedData,
  User
} from "./types";
import { decisionSupportService } from "../decisionSupport/DecisionSupportService";

export function byId<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export function getCurrentUser(data: SeedData, userId: string) {
  return data.users.find((user) => user.id === userId) ?? data.users[0];
}

export function canManageLocks(user: User) {
  return user.roles.includes("Administrator") || user.roles.includes("Manager");
}

export function canEditReview(review: PatientReview, user: User) {
  return !review.lock || review.lock.lockedByUserId === user.id || canManageLocks(user);
}

export function isAssignedToUser(review: PatientReview, user: User) {
  return review.assignedCoderId === user.id || review.assignedCdiId === user.id || review.assignedAuditorId === user.id;
}

export function reviewConditions(data: SeedData, review: PatientReview) {
  const conditionMap = byId(data.conditions);
  return review.conditionIds.map((id) => conditionMap.get(id)).filter(Boolean) as Condition[];
}

export function reviewEvidence(data: SeedData, review: PatientReview) {
  return data.evidence.filter((item) => item.reviewId === review.id);
}

export function getRecommendation(condition: Condition, review: PatientReview, data: SeedData, settings: AppSettings): Recommendation | undefined {
  return decisionSupportService.getRecommendation(condition, review, data, settings);
}

export function getUnresolvedConditions(data: SeedData, review: PatientReview) {
  return reviewConditions(data, review).filter((condition) => condition.actionable && !condition.disposition);
}

export function getCategorySummary(data: SeedData, review: PatientReview) {
  const conditions = reviewConditions(data, review);
  const initial: Record<Category, { count: number; raf: number }> = {
    validated: { count: 0, raf: 0 },
    potentialDelete: { count: 0, raf: 0 },
    potentialAddition: { count: 0, raf: 0 },
    prospective: { count: 0, raf: 0 }
  };
  return conditions.reduce((summary, condition) => {
    summary[condition.category].count += 1;
    summary[condition.category].raf += condition.raf;
    return summary;
  }, initial);
}

export function getRafSummary(data: SeedData, review: PatientReview) {
  const patient = data.patients.find((item) => item.id === review.patientId);
  const conditions = reviewConditions(data, review);
  const closedRaf = conditions
    .filter((condition) => condition.disposition?.action === "Validate" || condition.disposition?.action === "Add to Claim" || condition.disposition?.action === "Yes")
    .reduce((sum, condition) => sum + condition.raf, 0);
  const deletionRaf = conditions.filter((condition) => condition.disposition?.action === "Delete").reduce((sum, condition) => sum + condition.raf, 0);
  const openRaf = conditions.filter((condition) => condition.actionable && !condition.disposition).reduce((sum, condition) => sum + condition.raf, 0);
  const prospectiveRaf = conditions.filter((condition) => condition.category === "prospective").reduce((sum, condition) => sum + condition.raf, 0);
  const demographicRaf = patient?.demographicRaf ?? 0;

  return {
    openRaf,
    closedRaf,
    deletionRaf,
    prospectiveRaf,
    demographicRaf,
    totalRaf: closedRaf + openRaf + prospectiveRaf + demographicRaf - deletionRaf
  };
}

export function getProspectiveCounts(data: SeedData, review: PatientReview) {
  const conditions = reviewConditions(data, review);
  return {
    recapture: conditions.filter((condition) => condition.subtype === "recapture").length,
    suspect: conditions.filter((condition) => condition.subtype === "suspect").length
  };
}

export function getEvidenceForCondition(data: SeedData, condition: Condition): EvidencePassage[] {
  const evidenceMap = byId(data.evidence);
  return condition.evidenceIds.map((id) => evidenceMap.get(id)).filter(Boolean) as EvidencePassage[];
}

export function getAuditForReview(data: SeedData, reviewId: string): Audit | undefined {
  return data.audits.find((audit) => audit.reviewId === reviewId);
}

export function getTeamStats(data: SeedData) {
  return data.users
    .filter((user) => user.roles.includes("Coder") || user.roles.includes("CDI Specialist"))
    .map((user) => {
      const assigned = data.reviews.filter((review) => isAssignedToUser(review, user));
      const completed = assigned.filter((review) => review.status === "Completed" || review.status === "Audit Complete").length;
      return {
        name: user.name.split(" ")[0],
        assigned: assigned.length,
        completed,
        pended: assigned.filter((review) => review.status === "Pended").length,
        open: assigned.filter((review) => ["Available", "In Progress", "Awaiting Review"].includes(review.status)).length
      };
    });
}

export function getActionTotals(data: SeedData) {
  const totals = new Map<string, number>();
  data.conditions.forEach((condition) => {
    const action = condition.disposition?.action ?? "Unresolved";
    totals.set(action, (totals.get(action) ?? 0) + 1);
  });
  return Array.from(totals, ([name, value]) => ({ name, value }));
}

export function getReviewStatusTotals(data: SeedData) {
  const totals = new Map<string, number>();
  data.reviews.forEach((review) => totals.set(review.status, (totals.get(review.status) ?? 0) + 1));
  return Array.from(totals, ([name, value]) => ({ name, value }));
}
