import { describe, expect, it } from "vitest";
import { seedData } from "../data/seed";
import { decisionSupportService } from "../decisionSupport/DecisionSupportService";
import { completeReview, openReview, setDisposition } from "./workflows";
import type { SeedData } from "./types";

function cloneSeed(): SeedData {
  return structuredClone(seedData);
}

describe("prototype workflow rules", () => {
  it("locks an available patient review for the opening user", () => {
    const data = cloneSeed();
    const user = data.users.find((item) => item.id === "u-coder-1")!;
    const next = openReview(data, "rev-100", user);
    const review = next.reviews.find((item) => item.id === "rev-100")!;
    expect(review.status).toBe("In Progress");
    expect(review.lock?.lockedByUserId).toBe("u-coder-1");
  });

  it("does not allow another non-manager user to overwrite an active lock", () => {
    const data = cloneSeed();
    const opener = data.users.find((item) => item.id === "u-coder-1")!;
    const otherCoder = data.users.find((item) => item.id === "u-coder-2")!;
    const locked = openReview(data, "rev-100", opener);
    const attempted = openReview(locked, "rev-100", otherCoder);
    expect(attempted.reviews.find((item) => item.id === "rev-100")?.lock?.lockedByUserId).toBe("u-coder-1");
  });

  it("blocks completion while actionable conditions are unresolved", () => {
    const data = cloneSeed();
    const user = data.users.find((item) => item.id === "u-coder-1")!;
    const result = completeReview(data, "rev-100", user);
    expect(result.unresolved.length).toBeGreaterThan(0);
    expect(result.data.reviews.find((item) => item.id === "rev-100")?.status).toBe("Available");
  });

  it("disables duplicate same-HCC additions after one add-to-claim selection", () => {
    const data = cloneSeed();
    const user = data.users.find((item) => item.id === "u-coder-1")!;
    const next = setDisposition(data, "rev-100", "cond-100-d", user, "Add to Claim", true);
    const duplicate = next.conditions.find((item) => item.id === "cond-100-e")!;
    expect(duplicate.disabledReason).toContain("HCC 37");
  });
});

describe("prototype decision support", () => {
  it("derives validate from claim plus sufficient MEAT", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const condition = data.conditions.find((item) => item.id === "cond-100-a")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, {
      recommendationMode: "rules",
      auditSampleRate: 25
    });
    expect(recommendation?.action).toBe("Validate");
    expect(recommendation?.source).toBe("rules");
  });

  it("can hide recommendation assistance without changing cases", () => {
    const data = cloneSeed();
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    const condition = data.conditions.find((item) => item.id === "cond-100-c")!;
    const recommendation = decisionSupportService.getRecommendation(condition, review, data, {
      recommendationMode: "hidden",
      auditSampleRate: 25
    });
    expect(recommendation).toBeUndefined();
  });
});
