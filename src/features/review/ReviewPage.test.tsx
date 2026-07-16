// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoSeedData } from "../../data/seed";
import { getActiveConditionEvidence } from "../../domain/selectors";
import type { AppSettings, EvidencePassage, SeedData } from "../../domain/types";
import { AppStateProvider } from "../../state/AppState";
import { CURRENT_CONTENT_REVISION } from "../../state/persistence";
import { ReviewPage, targetForEvidence } from "./ReviewPage";

const storageKey = "risk-adjustment-cdi-prototype-state-v1";
const settings: AppSettings = {
  recommendationMode: "simulated",
  auditSampleRate: 25,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

let scrolledElementIds: string[];

function legacyPagesData(): SeedData {
  const data = structuredClone(demoSeedData);
  const reviewId = "rev-109";
  const staleDocument = data.documents.find((item) => item.reviewId === reviewId)!;
  const staleEvidence = data.evidence.find((item) => item.reviewId === reviewId)!;
  return {
    ...data,
    documents: [
      ...data.documents.filter((item) => item.reviewId !== reviewId),
      { ...staleDocument, id: "stale-victor-document", title: "Stale Pages document" }
    ],
    evidence: [
      ...data.evidence.filter((item) => item.reviewId !== reviewId),
      {
        ...staleEvidence,
        id: "stale-victor-evidence",
        documentId: "stale-victor-document",
        anchorId: "missing-pages-anchor",
        chartAnchor: undefined
      }
    ]
  };
}

function renderVictorReview() {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={["/review/rev-109"]}>
        <Routes>
          <Route path="/review/:reviewId" element={<ReviewPage />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>
  );
}

async function expectEvidenceSelection(evidence: EvidencePassage, position: number, total: number) {
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`Evidence ${position} of ${total}`));
  if (evidence.chartAnchor) {
    expect(document.getElementById(`chart-tab-${evidence.chartAnchor.tab}`)).toHaveAttribute("aria-selected", "true");
  }

  const chart = demoSeedData.charts.find((item) => item.reviewId === evidence.reviewId)!;
  const fallbackTargetId = targetForEvidence(chart, evidence.id, evidence);
  await waitFor(() => {
    const span = document.getElementById(`span-${evidence.id}`);
    const target = span ?? (fallbackTargetId ? document.getElementById(fallbackTargetId) : null) ?? document.getElementById(evidence.anchorId);
    expect(target).not.toBeNull();
    expect(scrolledElementIds).toContain(target!.id);
    const owningDetails = target!.closest("details");
    if (owningDetails) expect(owningDetails).toHaveAttribute("open");
  });
}

beforeEach(() => {
  localStorage.clear();
  scrolledElementIds = [];
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(function (this: HTMLElement) {
      scrolledElementIds.push(this.id);
    })
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ReviewPage evidence navigation", () => {
  it("migrates stale Pages content and cycles rendered evidence across chart tabs", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        currentUserId: "u-manager-1",
        settings,
        data: legacyPagesData()
      })
    );

    const user = userEvent.setup();
    renderVictorReview();
    expect(await screen.findByText("Victor Coleman")).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(storageKey)!) as { contentRevision: number; data: SeedData };
    expect(stored.contentRevision).toBe(CURRENT_CONTENT_REVISION);
    expect(stored.data.documents.some((item) => item.id === "stale-victor-document")).toBe(false);
    expect(stored.data.evidence.some((item) => item.id === "stale-victor-evidence")).toBe(false);

    const conditionId = "cond-109-a";
    const reviewEvidence = demoSeedData.evidence.filter((item) => item.reviewId === "rev-109");
    const conditionEvidence = getActiveConditionEvidence(demoSeedData, reviewEvidence, conditionId);
    expect(conditionEvidence.length).toBeGreaterThan(1);

    const conditionCode = screen.getByText("N18.4");
    const conditionCard = conditionCode.closest("article");
    expect(conditionCard).not.toBeNull();
    await user.click(conditionCard!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`Evidence 0 of ${conditionEvidence.length}`));

    const nextButton = screen.getByRole("button", { name: /Next Evidence/i });
    const previousButton = screen.getByRole("button", { name: /Previous Evidence/i });
    expect(nextButton).toBeEnabled();
    expect(previousButton).toBeEnabled();

    await user.click(nextButton);
    await expectEvidenceSelection(conditionEvidence[0], 1, conditionEvidence.length);
    expect(conditionCard).toHaveClass("active-condition");

    await user.click(nextButton);
    await expectEvidenceSelection(conditionEvidence[1], 2, conditionEvidence.length);

    for (let index = 2; index < conditionEvidence.length; index += 1) {
      await user.click(nextButton);
      await expectEvidenceSelection(conditionEvidence[index], index + 1, conditionEvidence.length);
    }
    await user.click(nextButton);
    await expectEvidenceSelection(conditionEvidence[0], 1, conditionEvidence.length);

    await user.click(previousButton);
    await expectEvidenceSelection(conditionEvidence[conditionEvidence.length - 1], conditionEvidence.length, conditionEvidence.length);
    expect(conditionCard).toHaveClass("active-condition");
  });

  it("opens the sibling chart when a same-HCC evidence action targets another review", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        contentRevision: CURRENT_CONTENT_REVISION,
        currentUserId: "u-coder-2",
        settings,
        data: demoSeedData
      })
    );

    const user = userEvent.setup();
    render(
      <AppStateProvider>
        <MemoryRouter initialEntries={["/review/rev-111"]}>
          <Routes>
            <Route path="/review/:reviewId" element={<ReviewPage />} />
          </Routes>
        </MemoryRouter>
      </AppStateProvider>
    );

    expect(await screen.findByText("Chronic diastolic heart failure")).toBeInTheDocument();
    const crossReviewEvidence = await screen.findByRole("button", { name: /current-year MEAT support for Acute-on-chronic diastolic heart failure/i });
    await user.click(crossReviewEvidence);

    expect(await screen.findByText("I50.33")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Evidence 1 of 1"));
    expect(screen.getByText(/Exertional dyspnea and intermittent ankle edema remain stable/).closest("mark")).not.toBeNull();
  });
});
