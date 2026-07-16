import { describe, expect, it } from "vitest";
import { demoSeedData } from "../data/seed";
import {
  appendGeneratedChartForAssignee,
  buildGeneratedChart,
  GENERATED_CHART_CONTENT_REVISION
} from "./generatedCharts";

const context = (completedReviewId: string) => ({
  completedReviewId,
  contentRevision: GENERATED_CHART_CONTENT_REVISION
});

describe("seeded queue-refill chart generation", () => {
  it("reproduces the same clinical bundle for the same seed inputs", () => {
    const first = buildGeneratedChart(structuredClone(demoSeedData), "u-coder-1", 2026, context("rev-101"));
    const second = buildGeneratedChart(structuredClone(demoSeedData), "u-coder-1", 2026, context("rev-101"));

    expect(second).toEqual(first);
  });

  it("varies clinical content across completion events while retaining reproducibility", () => {
    const fingerprints = ["rev-101", "rev-102", "rev-103"].map((completedReviewId) => {
      const bundle = buildGeneratedChart(structuredClone(demoSeedData), "u-coder-1", 2026, context(completedReviewId));
      const encounter = bundle.chart.encounters[0];
      return JSON.stringify({
        patient: bundle.patient,
        reviewType: bundle.review.reviewType,
        hpi: encounter.hpi,
        plans: encounter.assessmentPlan.map((item) => item.detail),
        vitals: encounter.vitals
      });
    });

    expect(new Set(fingerprints).size).toBeGreaterThan(1);
  });

  it("builds evidence from the same facts rendered in the provider chart", () => {
    const bundle = buildGeneratedChart(structuredClone(demoSeedData), "u-coder-1", 2026, context("rev-104"));
    const encounter = bundle.chart.encounters[0];
    const renderedLabRows = bundle.chart.labs.flatMap((panel) =>
      panel.results.map((result) => `${result.component} ${result.value} ${result.unit}`.trim())
    );

    for (const condition of bundle.conditions) {
      const conditionEvidence = bundle.evidence.filter((item) => item.conditionIds.includes(condition.id));
      const hpiEvidence = conditionEvidence.find((item) => item.id.endsWith("-hpi"));
      const planEvidence = conditionEvidence.find((item) => item.id.endsWith("-ap"));
      const labEvidence = conditionEvidence.find((item) => item.id.endsWith("-lab"));
      const claimEvidence = conditionEvidence.find((item) => item.id.endsWith("-claim"));
      const plan = encounter.assessmentPlan.find((item) => item.code === condition.icd10);
      const claim = bundle.claims.find((item) => claimEvidence?.chartAnchor?.itemId === item.id);

      expect(hpiEvidence?.exactText).toBeTruthy();
      expect(encounter.hpi).toContain(hpiEvidence!.exactText!);
      expect(planEvidence?.exactText).toBe(plan?.detail);
      expect(renderedLabRows).toContain(labEvidence?.exactText);
      expect(claimEvidence?.text).toContain(claimEvidence?.exactText);
      expect(claim?.supportSummary).toContain(claimEvidence?.exactText);
      expect(claim?.icd10Codes.includes(condition.icd10)).toBe(condition.workflow !== "codesNotOnClaim");
      expect(condition.evidenceIds).toEqual(expect.arrayContaining(conditionEvidence.map((item) => item.id)));

      for (const evidence of conditionEvidence) {
        const document = bundle.documents.find((item) => item.id === evidence.documentId);
        const section = document?.sections.find((item) => item.id === evidence.anchorId);
        expect(section?.text, `${evidence.id} document source`).toContain(evidence.exactText);
      }
    }

    expect(encounter.vitals?.bmi).toBeCloseTo(
      (encounter.vitals!.weight * 703) / (encounter.vitals!.height * encounter.vitals!.height),
      1
    );

    const providerProse = [encounter.hpi, ...encounter.assessmentPlan.map((item) => item.detail)].join(" ");
    expect(providerProse).not.toMatch(/assessed with|provider confirmation|should be confirmed/i);
  });

  it("appends unique IDs without changing an already-persisted generated chart", () => {
    let data = appendGeneratedChartForAssignee(
      structuredClone(demoSeedData),
      "u-coder-1",
      2026,
      context("rev-105")
    );
    const persistedFirstReview = structuredClone(data.reviews.find((review) => review.id === "gen-rev-001"));
    const persistedFirstChart = structuredClone(data.charts.find((chart) => chart.reviewId === "gen-rev-001"));

    data = appendGeneratedChartForAssignee(data, "u-coder-1", 2026, context("rev-106"));

    const generatedReviews = data.reviews.filter((review) => review.id.startsWith("gen-rev-"));
    const generatedPatients = data.patients.filter((patient) => patient.id.startsWith("gen-pat-"));
    const generatedConditions = data.conditions.filter((condition) => condition.id.startsWith("gen-cond-"));
    const generatedEvidence = data.evidence.filter((evidence) => evidence.id.startsWith("gen-ev-"));

    expect(generatedReviews).toHaveLength(2);
    expect(new Set(generatedReviews.map((review) => review.id)).size).toBe(generatedReviews.length);
    expect(new Set(generatedPatients.map((patient) => patient.id)).size).toBe(generatedPatients.length);
    expect(new Set(generatedConditions.map((condition) => condition.id)).size).toBe(generatedConditions.length);
    expect(new Set(generatedEvidence.map((evidence) => evidence.id)).size).toBe(generatedEvidence.length);
    expect(data.reviews.find((review) => review.id === "gen-rev-001")).toEqual(persistedFirstReview);
    expect(data.charts.find((chart) => chart.reviewId === "gen-rev-001")).toEqual(persistedFirstChart);
  });
});
