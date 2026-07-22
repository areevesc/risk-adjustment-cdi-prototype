import type { PatientReview, Role, SeedData, User } from "./types";

export type AppRouteKey = "login" | "queue" | "stats" | "review" | "audit" | "manager" | "admin";

const finalReviewStatuses = new Set<PatientReview["status"]>(["Completed", "Under Audit", "Audit Complete"]);

export function isFinalReviewStatus(review: PatientReview) {
  return finalReviewStatuses.has(review.status);
}

export const routePathByKey: Record<AppRouteKey, string> = {
  login: "/login",
  queue: "/queue",
  stats: "/stats",
  review: "/queue",
  audit: "/audit",
  manager: "/manager",
  admin: "/admin"
};

const routeRoles: Record<AppRouteKey, Role[]> = {
  login: ["Administrator", "Manager", "Auditor", "CDI/Coder"],
  queue: ["Administrator", "Manager", "Auditor", "CDI/Coder"],
  stats: ["CDI/Coder"],
  review: ["Administrator", "Manager", "Auditor", "CDI/Coder"],
  audit: ["Administrator", "Manager", "Auditor"],
  manager: ["Administrator", "Manager"],
  admin: ["Administrator"]
};

export function hasAnyRole(user: User, roles: Role[]) {
  return roles.some((role) => user.roles.includes(role));
}

export function canAccessRoute(user: User, route: AppRouteKey) {
  return hasAnyRole(user, routeRoles[route]);
}

export function getFirstPermittedRoute(user: User) {
  const ordered: AppRouteKey[] = ["queue", "stats", "audit", "manager", "admin", "login"];
  return routePathByKey[ordered.find((route) => canAccessRoute(user, route)) ?? "login"];
}

export function getRouteDenialMessage(route: AppRouteKey) {
  if (route === "admin") return "Administrator settings are restricted to Administrator users in this prototype.";
  if (route === "manager") return "Manager dashboard access is restricted to Managers and Administrators.";
  if (route === "audit") return "Audit workspace access is restricted to Auditors, Managers, and Administrators.";
  return "Your simulated role does not have access to that page.";
}

export function canManageLocks(user: User) {
  return hasAnyRole(user, ["Administrator", "Manager"]);
}

export function canAssignReviews(user: User) {
  return hasAnyRole(user, ["Administrator", "Manager"]);
}

export function canConfigurePrototype(user: User) {
  return user.roles.includes("Administrator");
}

export function isAssignedToReview(review: PatientReview, user: User) {
  return review.assignedUserId === user.id || review.coverage?.coveringUserId === user.id || review.assignedAuditorId === user.id;
}

export function isOriginalAssignee(review: PatientReview, user: User) {
  return review.assignedUserId === user.id;
}

export function isReviewLockOwner(review: PatientReview, user: User) {
  return review.lock?.lockedByUserId === user.id;
}

export function hasDifferentLockOwner(review: PatientReview, user: User) {
  return Boolean(review.lock && review.lock.lockedByUserId !== user.id);
}

export function canViewReview(data: SeedData, review: PatientReview, user: User) {
  if (hasAnyRole(user, ["Administrator", "Manager"])) return true;
  if (user.roles.includes("Auditor")) {
    return review.queue === "Auditor Queue" || review.status === "Under Audit" || review.status === "Audit Complete";
  }
  if (hasAnyRole(user, ["CDI/Coder"])) {
    const assigned = data.users.find((item) => item.id === review.assignedUserId);
    return (
      review.assignedUserId === user.id ||
      review.coverage?.coveringUserId === user.id ||
      (review.queue === "CDI/Coder Queue" && assigned?.roles.includes("CDI/Coder") && assigned.teamId === user.teamId) ||
      data.downstreamTasks.some((task) => task.reviewId === review.id && task.assignedUserId === user.id && task.status !== "Completed")
    );
  }
  return false;
}

export function canOpenReview(data: SeedData, review: PatientReview, user: User) {
  if (!canViewReview(data, review, user)) return false;
  if (isFinalReviewStatus(review)) return false;
  if (hasAnyRole(user, ["Administrator", "Manager"])) return true;
  if (user.roles.includes("Auditor")) return review.assignedAuditorId === user.id || review.queue === "Auditor Queue";
  if (user.roles.includes("CDI/Coder")) {
    return (
      review.assignedUserId === user.id ||
      review.coverage?.coveringUserId === user.id ||
      data.downstreamTasks.some((task) => task.reviewId === review.id && task.assignedUserId === user.id && task.status !== "Completed")
    );
  }
  return false;
}

export function canMutateReview(review: PatientReview, user: User) {
  if (isFinalReviewStatus(review)) return false;
  if (user.roles.includes("Auditor") && !hasAnyRole(user, ["Administrator", "Manager"])) return false;
  return isReviewLockOwner(review, user);
}

export function canReleaseReviewLock(review: PatientReview, user: User) {
  return isReviewLockOwner(review, user);
}

export function canOverrideLock(review: PatientReview, user: User, reason: string) {
  return !isFinalReviewStatus(review) && canManageLocks(user) && hasDifferentLockOwner(review, user) && reason.trim().length > 0;
}

export function canRouteWholeReview(review: PatientReview, user: User) {
  return canMutateReview(review, user);
}

export function canCompleteReview(review: PatientReview, user: User) {
  return canMutateReview(review, user);
}

export function canSetConditionDisposition(review: PatientReview, user: User) {
  return canMutateReview(review, user);
}

export function canFlagDocumentationIssue(review: PatientReview, user: User) {
  return canMutateReview(review, user);
}

export function canTakeCoverage(data: SeedData, review: PatientReview, user: User) {
  if (!user.roles.includes("CDI/Coder") || hasAnyRole(user, ["Administrator", "Manager", "Auditor"])) return false;
  if (review.queue !== "CDI/Coder Queue") return false;
  if (!["Available", "Pended", "Rework Required"].includes(review.status)) return false;
  if (review.assignedUserId === user.id || review.coverage?.coveringUserId === user.id) return false;
  if (review.lock || review.coverage) return false;
  const originalAssignee = data.users.find((item) => item.id === review.assignedUserId);
  return Boolean(originalAssignee?.roles.includes("CDI/Coder") && originalAssignee.teamId === user.teamId);
}

export function canStartAudit(review: PatientReview, user: User) {
  return hasAnyRole(user, ["Administrator", "Manager", "Auditor"]) && review.status !== "Audit Complete";
}

export function canCompleteAudit(review: PatientReview, user: User) {
  return hasAnyRole(user, ["Administrator", "Manager", "Auditor"]) && review.status === "Under Audit";
}

export function canReopenAudit(user: User) {
  return hasAnyRole(user, ["Administrator", "Manager", "Auditor"]);
}

export function canViewCoverageQueue(data: SeedData, review: PatientReview, user: User) {
  if (!user.roles.includes("CDI/Coder") || hasAnyRole(user, ["Administrator", "Manager", "Auditor"])) return false;
  if (review.queue !== "CDI/Coder Queue") return false;
  const assigned = data.users.find((item) => item.id === review.assignedUserId);
  return Boolean(assigned?.roles.includes("CDI/Coder") && assigned.teamId === user.teamId);
}

export function getVisibleReviews(data: SeedData, user: User) {
  return data.reviews.filter((review) => canViewReview(data, review, user) || canViewCoverageQueue(data, review, user));
}

export function getActiveQueueReviews(data: SeedData, user: User) {
  return getVisibleReviews(data, user).filter((review) => !isFinalReviewStatus(review));
}
