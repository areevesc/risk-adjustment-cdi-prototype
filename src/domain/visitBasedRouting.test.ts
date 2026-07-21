import { describe, expect, it } from "vitest";

import { demoSeedData } from "../data/seed";
import type { AppSettings, SeedData, User } from "./types";
import { completeReview, openReview, setDisposition } from "./workflows";

const settings: AppSettings = {
  recommendationMode: "rules",
  auditSampleRate: 0,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

function cloneSeed(): SeedData {
  return structuredClone(demoSeedData);
}

function user(data: SeedData, id: string): User {
  return data.users.find((item) => item.id === id)!;
}

describe("visit-based downstream routing", () => {
  it("creates an appointment-linked Provider Query for a scheduled opportunity", () => {
    let data = cloneSeed();
    data = openReview(data, "rev-113", user(data, "u-coder-4"));
    data = setDisposition(data, "rev-113", "cond-113-a", user(data, "u-coder-4"), "Yes", true, settings);
    const completed = completeReview(data, "rev-113", user(data, "u-coder-4"), settings);
    const task = completed.data.downstreamTasks.find((item) => item.conditionId === "cond-113-a");

    expect(completed.unresolved).toEqual([]);
    expect(task).toMatchObject({
      type: "Provider Query",
      queue: "Provider Query Queue",
      appointmentId: "appt-113"
    });
    expect(completed.data.downstreamTasks.some((item) => item.conditionId === "cond-113-a" && item.type === "Prospective CDI Review")).toBe(false);
  });

  it("creates an unscheduled prospective hold without a target calendar year", () => {
    let data = cloneSeed();
    data = openReview(data, "rev-107", user(data, "u-coder-4"));
    data = setDisposition(data, "rev-107", "cond-107-a", user(data, "u-coder-4"), "Delete", true, settings);
    data = setDisposition(data, "rev-107", "cond-107-b", user(data, "u-coder-4"), "Add to Claim", true, settings);
    data = setDisposition(data, "rev-107", "cond-107-c", user(data, "u-coder-4"), "Yes", true, settings);
    const completed = completeReview(data, "rev-107", user(data, "u-coder-4"), settings);
    const task = completed.data.downstreamTasks.find((item) => item.conditionId === "cond-107-c");

    expect(completed.unresolved).toEqual([]);
    expect(task).toMatchObject({ type: "Prospective CDI Review", queue: "Prospective Review Queue" });
    expect(task?.targetCalendarYear).toBeUndefined();
    expect(task?.appointmentId).toBeUndefined();
    expect(completed.data.downstreamTasks.some((item) => item.reviewId === "rev-107" && item.type === "Scheduling Outreach")).toBe(false);
  });
});
