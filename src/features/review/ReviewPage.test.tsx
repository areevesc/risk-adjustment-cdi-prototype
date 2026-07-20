// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
  it("renders claim fields and only diagnosis codes actually present on Victor's claim", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ contentRevision: CURRENT_CONTENT_REVISION, currentUserId: "u-manager-1", settings, data: demoSeedData })
    );
    const user = userEvent.setup();
    renderVictorReview();
    expect(await screen.findByText("Victor Coleman")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Claims/i }));
    const currentClaim = document.getElementById("chart-claims-claim-rev-109")!;
    expect(currentClaim).not.toBeNull();
    expect(within(currentClaim).getByText("N18.4")).toBeInTheDocument();
    expect(within(currentClaim).queryByText("E66.01")).not.toBeInTheDocument();
    expect(screen.queryByText("Claim Support")).not.toBeInTheDocument();
  });

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

    const conditionCode = screen.getAllByText("N18.4").find((element) => element.classList.contains("mono"))!;
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

  it("keeps a hierarchy-trumped condition and its evidence visible while locking direct actions", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        contentRevision: CURRENT_CONTENT_REVISION,
        currentUserId: "u-coder-2",
        settings,
        data: demoSeedData
      })
    );

    render(
      <AppStateProvider>
        <MemoryRouter initialEntries={["/review/rev-111"]}>
          <Routes>
            <Route path="/review/:reviewId" element={<ReviewPage />} />
          </Routes>
        </MemoryRouter>
      </AppStateProvider>
    );

    expect(await screen.findByText("Conditions And Actions")).toBeInTheDocument();
    const conditionName = await screen.findByText(/Chronic diastolic.*heart failure/i);
    const conditionCard = conditionName.closest("article");
    expect(conditionCard).not.toBeNull();
    expect(within(conditionCard!).getByText(/HCC226 locked by captured HCC224/i)).toBeInTheDocument();
    expect(within(conditionCard!).getByRole("button", { name: "Validate for 2026" })).toBeDisabled();
    expect(within(conditionCard!).getByRole("button", { name: "Delete for 2026" })).toBeDisabled();
    expect(within(conditionCard!.querySelector(".rule-evidence-links")!).getAllByRole("button")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /Next Evidence/i })).toBeEnabled();
  });

  it("stages an optional next-year prospective note independently from the claim decision", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        contentRevision: CURRENT_CONTENT_REVISION,
        currentUserId: "u-coder-3",
        settings,
        data: demoSeedData
      })
    );
    const user = userEvent.setup();
    render(
      <AppStateProvider>
        <MemoryRouter initialEntries={["/review/rev-102"]}>
          <Routes>
            <Route path="/review/:reviewId" element={<ReviewPage />} />
          </Routes>
        </MemoryRouter>
      </AppStateProvider>
    );

    await user.click(await screen.findByRole("button", { name: "Open chart" }));
    const conditionCode = screen.getAllByText("E11.22").find((element) => element.classList.contains("mono"))!;
    const conditionCard = conditionCode.closest("article")!;
    expect(within(conditionCard).getByRole("button", { name: "Validate for 2025" })).toBeEnabled();

    await user.click(within(conditionCard).getByRole("button", { name: "Send to Prospective for CY 2026" }));
    const dialog = screen.getByRole("dialog", { name: "Send to Prospective for CY 2026" });
    await user.type(within(dialog).getByLabelText(/Note for the prospective reviewer/i), "Recheck CKD at the next visit.");
    await user.click(within(dialog).getByRole("button", { name: "Stage handoff for CY 2026" }));

    expect(await within(conditionCard).findByText("Draft handoff for CY 2026")).toBeInTheDocument();
    expect(within(conditionCard).getByText("Recheck CKD at the next visit.")).toBeInTheDocument();
    expect(within(conditionCard).getByRole("button", { name: "Undo handoff" })).toBeEnabled();
    expect(within(conditionCard).getByRole("button", { name: "Validate for 2025" })).toBeEnabled();
  });
});
