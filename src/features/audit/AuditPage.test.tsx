// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { demoSeedData } from "../../data/seed";
import type { AppSettings } from "../../domain/types";
import { AppStateProvider } from "../../state/AppState";
import { CURRENT_CONTENT_REVISION } from "../../state/persistence";
import { AuditPage } from "./AuditPage";

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

describe("AuditPage controls", () => {
  it("shows an in-progress state instead of offering to start the audit again", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ contentRevision: CURRENT_CONTENT_REVISION, currentUserId: "u-auditor-1", settings, data: demoSeedData })
    );

    render(
      <AppStateProvider>
        <AuditPage />
      </AppStateProvider>
    );

    expect(await screen.findByText("Audit in progress")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start audit/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Agree complete$/i })).toBeEnabled();
  });
});
