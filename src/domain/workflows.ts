import type {
  ActionHistory,
  Audit,
  Condition,
  DisagreeReason,
  DocumentationIssue,
  PatientReview,
  RecommendationAction,
  SeedData,
  User
} from "./types";
import { uid } from "./format";
import { canManageLocks, getUnresolvedConditions, reviewConditions } from "./selectors";

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

export function openReview(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review) return data;
  if (review.lock && review.lock.lockedByUserId !== user.id && !canManageLocks(user)) return data;

  const next = updateReview(data, reviewId, (item) => ({
    ...item,
    status: item.status === "Available" || item.status === "Pended" ? "In Progress" : item.status,
    lock: { lockedByUserId: user.id, lockedAt: stamp() }
  }));
  return addHistory(next, { reviewId, userId: user.id, event: "Lock acquired", detail: "Patient-level review opened and locked." });
}

export function releaseReview(data: SeedData, reviewId: string, user: User): SeedData {
  const next = updateReview(data, reviewId, (review) => ({ ...review, lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Lock released", detail: "Chart exited and lock released." });
}

export function overrideLock(data: SeedData, reviewId: string, user: User, reason: string): SeedData {
  if (!canManageLocks(user)) return data;
  const next = updateReview(data, reviewId, (review) => ({
    ...review,
    lock: { lockedByUserId: user.id, lockedAt: stamp() },
    status: review.status === "Available" || review.status === "Pended" ? "In Progress" : review.status
  }));
  return addHistory(next, { reviewId, userId: user.id, event: "Lock overridden", detail: reason || "Manager/admin override." });
}

export function pendReview(data: SeedData, reviewId: string, user: User): SeedData {
  const next = updateReview(data, reviewId, (review) => ({ ...review, status: "Pended", lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Review pended", detail: "Unfinished patient review was pended." });
}

export function routeReview(data: SeedData, reviewId: string, user: User, queue: PatientReview["queue"]): SeedData {
  const status = queue === "Auditor Queue" || queue === "Manager Review Queue" ? "Awaiting Review" : "Available";
  const next = updateReview(data, reviewId, (review) => ({ ...review, status, queue, lock: undefined }));
  return addHistory(next, { reviewId, userId: user.id, event: "Review routed", detail: `Sent to ${queue}.` });
}

export function completeReview(data: SeedData, reviewId: string, user: User): { data: SeedData; unresolved: Condition[] } {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review) return { data, unresolved: [] };
  const unresolved = getUnresolvedConditions(data, review);
  if (unresolved.length > 0) return { data, unresolved };

  let next = updateReview(data, reviewId, (item) => ({ ...item, status: "Completed", lock: undefined }));
  next = addHistory(next, { reviewId, userId: user.id, event: "Review completed", detail: "All actionable conditions have dispositions." });
  if (Math.random() * 100 < 25) {
    next = startAudit(next, reviewId, user, true);
  }
  return { data: next, unresolved: [] };
}

export function assignReview(data: SeedData, reviewId: string, user: User, assignedUserId: string): SeedData {
  const assigned = data.users.find((item) => item.id === assignedUserId);
  if (!assigned) return data;
  const next = updateReview(data, reviewId, (review) => ({
    ...review,
    assignedCoderId: assigned.roles.includes("Coder") ? assigned.id : review.assignedCoderId,
    assignedCdiId: assigned.roles.includes("CDI Specialist") ? assigned.id : review.assignedCdiId
  }));
  return addHistory(next, { reviewId, userId: user.id, event: "Assignment changed", detail: `Assigned or covered by ${assigned.name}.` });
}

export function takeCoverage(data: SeedData, reviewId: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review || review.lock) return data;
  return assignReview(data, reviewId, user, user.id);
}

export function setDisposition(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  user: User,
  action: RecommendationAction,
  agreedWithRecommendation?: boolean,
  reason?: DisagreeReason,
  comments?: string,
  replacementCode?: string
): SeedData {
  const decidedAt = stamp();
  let next = updateCondition(data, conditionId, (condition) => ({
    ...condition,
    disposition: {
      action,
      reason,
      comments,
      replacementCode,
      userId: user.id,
      decidedAt,
      agreedWithRecommendation
    }
  }));

  const condition = next.conditions.find((item) => item.id === conditionId);
  if (condition && action === "Validate") {
    next = applyThreeValidationRule(next, reviewId, condition.hcc, user);
  }
  if (condition && action === "Add to Claim") {
    next = disableDuplicateHccAdditions(next, reviewId, condition.hcc, conditionId);
  }
  if (action === "Send to Prospective" || (action === "Disagree" && (reason === "Not Enough MEAT" || reason === "Conflicting Evidence"))) {
    const review = next.reviews.find((item) => item.id === reviewId);
    if (review?.calendarYear === 2026) {
      next = updateReview(next, reviewId, (item) => ({ ...item, queue: "Prospective Review Queue" }));
    }
  }
  if (reason === "Other") {
    next = updateReview(next, reviewId, (item) => ({ ...item, queue: "Manager Review Queue", status: "Awaiting Review", lock: undefined }));
  }

  return addHistory(next, {
    reviewId,
    conditionId,
    userId: user.id,
    event: "Action selected",
    detail: reason ? `${action} - ${reason}` : action
  });
}

function applyThreeValidationRule(data: SeedData, reviewId: string, hcc: string, user: User): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review) return data;
  const matching = reviewConditions(data, review).filter((condition) => condition.hcc === hcc && condition.workflow === "codesOnClaim");
  const validatedCount = matching.filter((condition) => condition.disposition?.action === "Validate").length;
  if (validatedCount < 3) return data;
  let next = data;
  matching.forEach((condition) => {
    if (!condition.disposition) {
      next = updateCondition(next, condition.id, (item) => ({
        ...item,
        disposition: {
          action: "Validate",
          userId: user.id,
          decidedAt: stamp(),
          agreedWithRecommendation: true,
          comments: "Auto-validated by same-HCC three-validation prototype rule."
        },
        disabledReason: "Auto-validated after three same-HCC validations."
      }));
    } else if (condition.disposition.action === "Delete") {
      next = updateCondition(next, condition.id, (item) => ({
        ...item,
        disabledReason: "Delete option disabled by same-HCC validation rule."
      }));
    }
  });
  return addHistory(next, { reviewId, userId: user.id, event: "Same-HCC rule applied", detail: `Three validations reached for ${hcc}.` });
}

function disableDuplicateHccAdditions(data: SeedData, reviewId: string, hcc: string, selectedConditionId: string): SeedData {
  const review = data.reviews.find((item) => item.id === reviewId);
  if (!review) return data;
  let next = data;
  reviewConditions(data, review)
    .filter((condition) => condition.hcc === hcc && condition.workflow === "codesNotOnClaim" && condition.id !== selectedConditionId)
    .forEach((condition) => {
      next = updateCondition(next, condition.id, (item) => ({ ...item, disabledReason: `Duplicate ${hcc} already selected for addition.` }));
    });
  return next;
}

export function flagDocumentationIssue(
  data: SeedData,
  reviewId: string,
  conditionId: string,
  user: User,
  issue: DocumentationIssue,
  comments?: string
): SeedData {
  let next = updateCondition(data, conditionId, (condition) => ({
    ...condition,
    documentationIssues: [{ issue, comments, userId: user.id, createdAt: stamp() }, ...condition.documentationIssues]
  }));
  next = updateReview(next, reviewId, (review) => ({ ...review, queue: "Manager Review Queue", status: "Awaiting Review", lock: undefined }));
  return addHistory(next, { reviewId, conditionId, userId: user.id, event: "Documentation issue flagged", detail: issue });
}

export function startAudit(data: SeedData, reviewId: string, user: User, sampled = false): SeedData {
  const existing = data.audits.find((audit) => audit.reviewId === reviewId);
  let next = updateReview(data, reviewId, (review) => ({ ...review, status: "Under Audit", queue: "Auditor Queue", assignedAuditorId: review.assignedAuditorId ?? "u-auditor-1", lock: undefined }));
  if (!existing) {
    const audit: Audit = {
      id: uid("audit"),
      reviewId,
      auditorId: user.roles.includes("Auditor") ? user.id : "u-auditor-1",
      status: "In Progress"
    };
    next = { ...next, audits: [audit, ...next.audits] };
  }
  return addHistory(next, { reviewId, userId: user.id, event: sampled ? "Audit sample selected" : "Audit started", detail: sampled ? "Random prototype sample selected." : "Review sent to audit." });
}

export function completeAudit(data: SeedData, reviewId: string, user: User, outcome: "Agree" | "Disagree" | "Return for Correction", comments?: string): SeedData {
  const nextStatus = outcome === "Return for Correction" ? "Awaiting Review" : "Audit Complete";
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
            comments,
            completedAt: stamp()
          }
        : audit
    )
  };
  next = updateReview(next, reviewId, (review) => ({ ...review, status: nextStatus, lock: undefined, queue: outcome === "Return for Correction" ? "Manager Review Queue" : "Auditor Queue" }));
  return addHistory(next, { reviewId, userId: user.id, event: "Audit completed", detail: comments ? `${outcome}: ${comments}` : outcome });
}
