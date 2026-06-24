import type { PatientReview, Role, SeedData, User } from "./types";

export type AppRouteKey = "login" | "queue" | "review" | "audit" | "manager" | "admin";

export const routePathByKey: Record<AppRouteKey, string> = {
  login: "/login",
  queue: "/queue",
  review: "/queue",
  audit: "/audit",
  manager: "/manager",
  admin: "/admin"
};

const routeRoles: Record<AppRouteKey, Role[]> = {
  login: ["Administrator", "Manager", "Auditor", "Coder", "CDI Specialist"],
  queue: ["Administrator", "Manager", "Auditor", "Coder", "CDI Specialist"],
  review: ["Administrator", "Manager", "Auditor", "Coder", "CDI Specialist"],
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
  const ordered: AppRouteKey[] = ["queue", "audit", "manager", "admin", "login"];
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
  return review.assignedCoderId === user.id || review.assignedCdiId === user.id || review.assignedAuditorId === user.id;
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
  if (hasAnyRole(user, ["Coder", "CDI Specialist"])) {
    return (
      isAssignedToReview(review, user) ||
      review.queue === "Unassigned Team Queue" ||
      (user.roles.includes("CDI Specialist") && review.queue === "Prospective Review Queue") ||
      data.downstreamTasks.some((task) => task.reviewId === review.id && task.assignedUserId === user.id && task.status !== "Completed")
    );
  }
  return false;
}

export function canOpenReview(data: SeedData, review: PatientReview, user: User) {
  return canViewReview(data, review, user);
}

export function canMutateReview(review: PatientReview, user: User) {
  if (user.roles.includes("Auditor") && !hasAnyRole(user, ["Administrator", "Manager"])) return false;
  return isReviewLockOwner(review, user);
}

export function canReleaseReviewLock(review: PatientReview, user: User) {
  return isReviewLockOwner(review, user);
}

export function canOverrideLock(review: PatientReview, user: User, reason: string) {
  return canManageLocks(user) && hasDifferentLockOwner(review, user) && reason.trim().length > 0;
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
  if (!hasAnyRole(user, ["Coder", "CDI Specialist"])) return false;
  if (!canViewReview(data, review, user)) return false;
  return !review.lock || isReviewLockOwner(review, user);
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

export function getVisibleReviews(data: SeedData, user: User) {
  return data.reviews.filter((review) => canViewReview(data, review, user));
}
