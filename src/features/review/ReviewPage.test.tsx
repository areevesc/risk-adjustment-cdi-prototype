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

    expect(await screen.findByText("Conditions & Actions")).toBeInTheDocument();
    const conditionName = screen.getAllByText(/Chronic diastolic.*heart failure/i).find((element) => element.closest("article"));
    expect(conditionName).toBeDefined();
    const conditionCard = conditionName!.closest("article");
    expect(conditionCard).not.toBeNull();
    expect(within(conditionCard!).getByText(/HCC226 locked by captured HCC224/i)).toBeInTheDocument();
    expect(within(conditionCard!).getByRole("button", { name: "Validate for 2026" })).toBeDisabled();
    expect(within(conditionCard!).getByRole("button", { name: "Delete for 2026" })).toBeDisabled();
    expect(within(conditionCard!.querySelector(".rule-evidence-links")!).getAllByRole("button")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /Next Evidence/i })).toBeEnabled();
  });

  it("keeps workflow provenance available without crowding the primary condition actions", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ contentRevision: CURRENT_CONTENT_REVISION, currentUserId: "u-manager-1", settings, data: demoSeedData })
    );

    renderVictorReview();

    expect(await screen.findByText("Documented HCCs that may need to be added to the claim.")).toBeInTheDocument();
    const reviewDetails = screen.getAllByText("Review details");
    expect(reviewDetails.length).toBeGreaterThan(0);
    reviewDetails.forEach((summary) => expect(summary.closest("details")).not.toHaveAttribute("open"));
    expect(screen.queryByText("Eligible CPT / encounter type")).not.toBeInTheDocument();
  });

  it("keeps recommendations, evidence, non-HCC context, and acute actions clinically consistent", async () => {
    const data = structuredClone(demoSeedData);
    const review = data.reviews.find((item) => item.id === "rev-100")!;
    review.status = "In Progress";
    review.lock = { lockedByUserId: "u-coder-1", lockedAt: "2026-07-20T12:00:00.000Z" };
    localStorage.setItem(
      storageKey,
      JSON.stringify({ contentRevision: CURRENT_CONTENT_REVISION, currentUserId: "u-coder-1", settings, data })
    );
    const user = userEvent.setup();

    render(
      <AppStateProvider>
        <MemoryRouter initialEntries={["/review/rev-100"]}>
          <Routes>
            <Route path="/review/:reviewId" element={<ReviewPage />} />
          </Routes>
        </MemoryRouter>
      </AppStateProvider>
    );

    expect(await screen.findByText("Conditions & Actions")).toBeInTheDocument();

    const diabetesGroup = screen.getByRole("region", { name: "Diabetes hierarchy group" });
    expect(Array.from(diabetesGroup.querySelectorAll(":scope > [data-condition-code]")).map((item) => item.getAttribute("data-condition-code"))).toEqual([
      "E11.42",
      "E11.51",
      "E11.40",
      "E11.65"
    ]);

    const neuropathyCard = screen.getAllByText("E11.40").find((element) => element.classList.contains("mono"))!.closest("article")!;
    const neuropathy = data.conditions.find((item) => item.id === "cond-100-d")!;
    const neuropathyEvidence = getActiveConditionEvidence(data, data.evidence.filter((item) => item.reviewId === review.id), neuropathy.id);
    const neuropathyPlan = neuropathyEvidence.find((item) => item.id === "ev-cond-100-d-plan")!;
    expect(within(neuropathyCard).getByText(/AI recommends Disagree/i)).toBeInTheDocument();
    expect(within(neuropathyCard).getByText(/More specific option: E11.42/i)).toBeInTheDocument();
    expect(within(neuropathyCard).queryByText("No evidence found.")).not.toBeInTheDocument();
    await user.click(within(neuropathyCard).getByRole("button", { name: new RegExp(neuropathyPlan.summary, "i") }));
    await expectEvidenceSelection(neuropathyPlan, neuropathyEvidence.indexOf(neuropathyPlan) + 1, neuropathyEvidence.length);

    const angiopathyCard = screen.getAllByText("E11.51").find((element) => element.classList.contains("mono"))!.closest("article")!;
    const angiopathy = data.conditions.find((item) => item.id === "cond-100-f")!;
    const angiopathyEvidence = getActiveConditionEvidence(data, data.evidence.filter((item) => item.reviewId === review.id), angiopathy.id);
    const angiopathyAbi = angiopathyEvidence.find((item) => item.id === "ev-cond-100-f-abi")!;
    expect(angiopathyEvidence).toHaveLength(1);
    expect(within(angiopathyCard).getByText(/AI recommends Yes/i)).toBeInTheDocument();
    expect(within(angiopathyCard).getByText(/abnormal bilateral resting ABI values/i)).toBeInTheDocument();
    expect(within(angiopathyCard).queryByText(/payer data|HIE and SDoH/i)).not.toBeInTheDocument();
    expect(within(angiopathyCard).queryByText("No evidence found.")).not.toBeInTheDocument();
    await user.click(within(angiopathyCard).getByRole("button", { name: new RegExp(angiopathyAbi.summary, "i") }));
    await expectEvidenceSelection(angiopathyAbi, 1, 1);

    const hypertensionCard = screen.getAllByText("I10").find((element) => element.classList.contains("mono"))!.closest("article")!;
    expect(within(hypertensionCard).getByText("Non-HCC context")).toBeInTheDocument();
    expect(within(hypertensionCard).queryByText("Potential Delete")).not.toBeInTheDocument();
    expect(within(hypertensionCard).getByText(/Evidence: Blood-pressure measurement/i)).toBeInTheDocument();
    const flagButton = within(hypertensionCard).getByRole("button", { name: "Flag issue" });
    expect(flagButton).toBeEnabled();
    await user.click(flagButton);
    const flagDialog = screen.getByRole("dialog", { name: "Flag Documentation Issue" });
    await user.selectOptions(within(flagDialog).getByLabelText("Issue"), "Other documentation issue");
    await user.type(within(flagDialog).getByLabelText("Comments"), "Verify the clinical-context classification.");
    await user.click(within(flagDialog).getByRole("button", { name: "Route issue" }));
    expect(await within(hypertensionCard).findByText("Other documentation issue")).toBeInTheDocument();

    const acuteCard = screen.getAllByText("I50.33").find((element) => element.classList.contains("mono"))!.closest("article")!;
    expect(within(acuteCard).getByText(/AI recommends Delete/i)).toBeInTheDocument();
    expect(within(acuteCard).getByText("Potential Delete")).toBeInTheDocument();
    expect(within(acuteCard).queryByText("Recapture")).not.toBeInTheDocument();
    expect(within(acuteCard).getByRole("button", { name: "Send to Prospective for CY 2026" })).toBeDisabled();
    expect(within(acuteCard).queryByRole("button", { name: "Send to Prospective for CY 2027" })).not.toBeInTheDocument();

    await user.click(within(neuropathyCard).getByRole("button", { name: "Add to 2026 Claim" }));
    expect(await within(neuropathyCard).findByText("Draft: Add to Claim for CY 2026")).toBeInTheDocument();
    const polyneuropathyCard = screen.getAllByText("E11.42").find((element) => element.classList.contains("mono"))!.closest("article")!;
    const polyneuropathyAdd = within(polyneuropathyCard).getByRole("button", { name: "Add to 2026 Claim" });
    expect(polyneuropathyAdd).toBeEnabled();
    await user.click(polyneuropathyAdd);
    expect(await within(polyneuropathyCard).findByText("Draft: Add to Claim for CY 2026")).toBeInTheDocument();
    expect(within(neuropathyCard).getByRole("button", { name: "Add to 2026 Claim" })).toBeEnabled();

    const trumpedHyperglycemia = diabetesGroup.querySelector('[data-condition-code="E11.65"] details.trumped-condition-card');
    expect(trumpedHyperglycemia).not.toBeNull();
    expect(trumpedHyperglycemia).not.toHaveAttribute("open");
    expect(within(trumpedHyperglycemia as HTMLElement).getByText(/HCC38 is below selected HCC37/i)).toBeInTheDocument();
    expect(screen.getByText("Conditions & Actions")).toBeInTheDocument();
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
    expect(within(conditionCard).getByRole("button", { name: "Send to Prospective for CY 2025" })).toBeDisabled();

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
