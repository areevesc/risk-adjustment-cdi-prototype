// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { demoSeedData } from "../../data/seed";
import type { AppSettings, SeedData } from "../../domain/types";
import { AppStateProvider } from "../../state/AppState";
import { CURRENT_CONTENT_REVISION } from "../../state/persistence";
import { QueuePage } from "./QueuePage";

const storageKey = "risk-adjustment-cdi-prototype-state-v1";
const settings: AppSettings = {
  recommendationMode: "simulated",
  auditSampleRate: 25,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("QueuePage lifecycle filtering", () => {
  it("excludes final reviews from the active queue", async () => {
    const data: SeedData = structuredClone(demoSeedData);
    data.reviews = data.reviews.map((review) => ({
      ...review,
      status: "Completed",
      queue: "CDI/Coder Queue",
      assignedUserId: "u-coder-1",
      lock: undefined
    }));
    localStorage.setItem(
      storageKey,
      JSON.stringify({ contentRevision: CURRENT_CONTENT_REVISION, currentUserId: "u-coder-1", settings, data })
    );

    const user = userEvent.setup();
    render(
      <AppStateProvider>
        <MemoryRouter>
          <QueuePage />
        </MemoryRouter>
      </AppStateProvider>
    );

    await user.click(await screen.findByRole("button", { name: /Next Patient Chart/i }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "No charts match the current filters. Clear or adjust the filters to continue."
    );
    expect(screen.getByText(/0 of 0 charts/)).toBeInTheDocument();
  });
});
