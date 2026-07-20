import { describe, expect, it } from "vitest";

import type { ClinicalChart, EvidencePassage } from "../domain/types";
import { demoSeedData } from "./seed";

const providerCoderLanguage = /assessed with|active capture decision|not assessed with|current-year capture|provider confirmation|\bMEAT\b|\bHCC\b/i;

function visibleChartText(chart: ClinicalChart, evidence: EvidencePassage) {
  if (evidence.chartAnchor?.tab === "encounters") {
    for (const encounter of chart.encounters) {
      const plan = encounter.assessmentPlan.find((item) => item.evidenceIds.includes(evidence.id));
      if (plan) return plan.detail;
      const section = Object.entries(encounter.sectionEvidenceIds).find(([, ids]) => ids?.includes(evidence.id))?.[0];
      if (section === "hpi") return encounter.hpi;
      if (section === "assessmentPlan") return encounter.assessmentPlan.map((item) => item.detail).join(" ");
    }
  }
  if (evidence.chartAnchor?.tab === "labs") {
    const result = chart.labs.flatMap((panel) => panel.results).find((item) => item.evidenceIds.includes(evidence.id));
    return result ? `${result.component} ${result.value} ${result.unit}`.trim() : undefined;
  }
  if (evidence.chartAnchor?.tab === "claims") {
    return chart.claims.find((claim) => claim.id === evidence.chartAnchor?.itemId)?.icd10Codes.join(", ");
  }
  if (evidence.chartAnchor?.tab === "problem-list") {
    const item = chart.problems.find((problem) => problem.evidenceIds.includes(evidence.id));
    return item ? `${item.diagnosis} ${item.code}` : undefined;
  }
  if (evidence.chartAnchor?.tab === "pmh") {
    return chart.pastMedicalHistory.find((item) => item.evidenceIds.includes(evidence.id))?.text;
  }
  if (evidence.chartAnchor?.tab === "medications") {
    const item = chart.medications.find((medication) => medication.evidenceIds.includes(evidence.id));
    return item ? `${item.name} ${item.dose}`.trim() : undefined;
  }
  if (evidence.chartAnchor?.tab === "vitals") {
    const item = chart.vitals.find((vital) => vital.evidenceIds.includes(evidence.id));
    return item ? `BP ${item.systolic}/${item.diastolic}; BMI ${item.bmi}` : undefined;
  }
  if (evidence.chartAnchor?.tab === "imaging") {
    const item = chart.imaging.find((report) => report.evidenceIds.includes(evidence.id));
    return item ? `${item.findings} ${item.impression.join(" ")}` : undefined;
  }
  if (evidence.chartAnchor?.tab === "specialist-notes") {
    const item = chart.specialistNotes.find((note) => note.evidenceIds.includes(evidence.id));
    return item ? `${item.note} ${item.assessment.join(" ")}` : undefined;
  }
  return undefined;
}

describe("seeded clinical content", () => {
  it("keeps condition and evidence ownership bidirectional", () => {
    const conditionById = new Map(demoSeedData.conditions.map((condition) => [condition.id, condition]));
    const evidenceById = new Map(demoSeedData.evidence.map((evidence) => [evidence.id, evidence]));

    for (const condition of demoSeedData.conditions) {
      for (const evidenceId of condition.evidenceIds) {
        expect(evidenceById.get(evidenceId)?.conditionIds, `${condition.id} -> ${evidenceId}`).toContain(condition.id);
      }
    }
    for (const evidence of demoSeedData.evidence) {
      for (const conditionId of evidence.conditionIds) {
        expect(conditionById.get(conditionId)?.evidenceIds, `${evidence.id} -> ${conditionId}`).toContain(evidence.id);
      }
    }
  });

  it("keeps every document evidence reference resolvable", () => {
    const evidenceIds = new Set(demoSeedData.evidence.map((item) => item.id));
    const dangling = demoSeedData.documents.flatMap((document) =>
      document.sections.flatMap((section) => section.evidenceIds.filter((id) => !evidenceIds.has(id)).map((id) => `${document.id}:${section.id}:${id}`))
    );
    expect(dangling).toEqual([]);
  });

  it("uses provider-style language in assessment and plan content", () => {
    const providerText = demoSeedData.charts.flatMap((chart) =>
      chart.encounters.flatMap((encounter) => encounter.assessmentPlan.map((item) => item.detail))
    );
    const progressNoteText = demoSeedData.documents
      .filter((document) => document.type === "Progress Note")
      .flatMap((document) => document.sections.map((section) => section.text));

    for (const text of [...providerText, ...progressNoteText]) expect(text).not.toMatch(providerCoderLanguage);
  });

  it("keeps every owned evidence quote in its referenced document section", () => {
    const failures = demoSeedData.evidence
      .filter((evidence) => evidence.conditionIds.length > 0)
      .flatMap((evidence) => {
        const document = demoSeedData.documents.find((item) => item.id === evidence.documentId);
        const section = document?.sections.find((item) => item.id === evidence.anchorId);
        return section?.text.includes(evidence.exactText ?? evidence.text)
          ? []
          : [{ evidenceId: evidence.id, documentId: evidence.documentId, anchorId: evidence.anchorId, exactText: evidence.exactText }];
      });
    expect(failures).toEqual([]);
  });

  it("keeps every owned chart-backed quote in its rendered chart source", () => {
    const failures = demoSeedData.evidence.filter((evidence) => evidence.conditionIds.length > 0 && evidence.sourceType !== "morPayerRegistryHie").flatMap((evidence) => {
      const chart = demoSeedData.charts.find((item) => item.reviewId === evidence.reviewId);
      const sourceText = chart ? visibleChartText(chart, evidence) : undefined;
      return sourceText?.includes(evidence.exactText ?? evidence.text)
        ? []
        : [{ evidenceId: evidence.id, tab: evidence.chartAnchor?.tab, exactText: evidence.exactText, sourceText }];
    });
    expect(failures).toEqual([]);
  });

  it("keeps generated review evidence condition-scoped and present in its document and chart source", () => {
    const generatedReviewIds = new Set(["rev-101", "rev-102", "rev-103", "rev-104", "rev-105", "rev-106", "rev-107", "rev-108", "rev-109"]);
    for (const evidence of demoSeedData.evidence.filter((item) => generatedReviewIds.has(item.reviewId))) {
      expect(evidence.conditionIds).toHaveLength(1);
      const document = demoSeedData.documents.find((item) => item.id === evidence.documentId);
      const section = document?.sections.find((item) => item.id === evidence.anchorId);
      expect(section?.text, `${evidence.id} document source`).toContain(evidence.exactText);

      const chart = demoSeedData.charts.find((item) => item.reviewId === evidence.reviewId);
      expect(chart, `${evidence.id} chart`).toBeDefined();
      expect(visibleChartText(chart!, evidence), `${evidence.id} chart source`).toContain(evidence.exactText);
    }
  });

  it("keeps hypertension and diabetes evidence diagnosis-specific", () => {
    const hypertension = demoSeedData.conditions.find((item) => item.id === "cond-100-b")!;
    const evidence = demoSeedData.evidence.filter((item) => hypertension.evidenceIds.includes(item.id));
    const combinedText = evidence.map((item) => `${item.text} ${item.exactText ?? ""}`).join(" ").toLowerCase();

    expect(hypertension).toMatchObject({ program: "quality", hcc: "", raf: 0, actionable: false });
    expect(evidence.map((item) => item.sourceType)).toEqual(expect.arrayContaining(["vitalRow", "medicationRow", "planSentence"]));
    expect(combinedText).toContain("blood pressure");
    expect(combinedText).toContain("lisinopril");
    expect(combinedText).not.toMatch(/a1c|hba1c|diabetes|bronchitis/);
    expect(evidence.some((item) => item.sourceType === "imagingImpression")).toBe(false);

    const neuropathyEvidence = demoSeedData.evidence.filter((item) => item.conditionIds.includes("cond-100-d"));
    expect(neuropathyEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "planSentence", evidenceStrength: "assessmentWithPlan" })
    ]));
    expect(neuropathyEvidence.map((item) => `${item.text} ${item.exactText ?? ""}`).join(" ").toLowerCase()).toContain("neuropathy");

    const polyneuropathyEvidence = demoSeedData.evidence.filter((item) => item.conditionIds.includes("cond-100-e"));
    expect(polyneuropathyEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "planSentence", evidenceStrength: "assessmentWithPlan" })
    ]));
    expect(polyneuropathyEvidence.map((item) => `${item.text} ${item.exactText ?? ""}`).join(" ").toLowerCase()).toContain("polyneuropathy");

    const angiopathyEvidence = demoSeedData.evidence.filter((item) => item.conditionIds.includes("cond-100-f"));
    const angiopathyText = angiopathyEvidence.map((item) => `${item.text} ${item.exactText ?? ""}`).join(" ").toLowerCase();
    expect(angiopathyEvidence.length).toBeGreaterThan(0);
    expect(angiopathyText).toContain("peripheral angiopathy");
    expect(angiopathyText).not.toMatch(/retina|macular|ophthalm/);
  });

  it("uses coherent stage 4 CKD and severe-obesity facts throughout Victor Coleman's chart", () => {
    const chart = demoSeedData.charts.find((item) => item.reviewId === "rev-109")!;
    const currentEncounter = chart.encounters.find((item) => item.id === "chart-rev-109-encounter-current")!;
    const ckdPlan = currentEncounter.assessmentPlan.find((item) => item.code === "N18.4")!;
    const obesityPlan = currentEncounter.assessmentPlan.find((item) => item.code === "E66.01")!;
    const labRows = chart.labs.flatMap((panel) => panel.results);
    const eGfr = labRows.find((item) => item.component === "Estimated GFR")!;
    const riskCreatinine = labRows.find((item) => item.id.startsWith("chart-rev-109-lab-cond-109-a") && item.component === "Creatinine")!;
    const cmpCreatinine = labRows.find((item) => item.id === "chart-rev-109-lab-cr")!;
    const currentVital = chart.vitals.find((item) => item.id === "chart-rev-109-vital-current")!;

    expect(Number(eGfr.value)).toBeGreaterThanOrEqual(15);
    expect(Number(eGfr.value)).toBeLessThan(30);
    expect(ckdPlan.detail).toContain(`eGFR ${eGfr.value}`);
    expect(ckdPlan.detail).toContain(`creatinine ${riskCreatinine.value}`);
    expect(cmpCreatinine.value).toBe(riskCreatinine.value);

    const calculatedBmi = Math.round(((703 * currentVital.weight) / currentVital.height ** 2) * 10) / 10;
    expect(currentVital.bmi).toBe(calculatedBmi);
    expect(currentVital.bmi).toBeGreaterThanOrEqual(40);
    expect(labRows.some((item) => item.component === "BMI")).toBe(false);
    expect(obesityPlan.detail).toContain(`BMI is ${currentVital.bmi}`);

    const obesityCondition = demoSeedData.conditions.find((item) => item.id === "cond-109-b")!;
    const obesityEvidence = demoSeedData.evidence.filter((item) => obesityCondition.evidenceIds.includes(item.id));
    expect(obesityEvidence).toEqual(expect.arrayContaining([expect.objectContaining({ sourceType: "vitalRow", evidenceStrength: "clinicalIndicatorOnly", chartAnchor: expect.objectContaining({ tab: "vitals" }) })]));
    expect(obesityEvidence.some((item) => item.chartAnchor?.tab === "labs" || item.chartAnchor?.tab === "claims")).toBe(false);
    expect(chart.claims.find((claim) => claim.id === "claim-rev-109")?.icd10Codes).toEqual(["N18.4"]);
    expect(chart.claims.some((claim) => claim.icd10Codes.includes("E66.01"))).toBe(false);

    const ckdEvidence = new Set(demoSeedData.conditions.find((item) => item.id === "cond-109-a")!.evidenceIds);
    const obesityEvidenceIds = new Set(obesityCondition.evidenceIds);
    expect([...ckdEvidence].filter((id) => obesityEvidenceIds.has(id))).toEqual([]);
  });

  it("preserves conflicting obesity as a potential-delete scenario and keeps creatinine panels coherent", () => {
    const conflictingChart = demoSeedData.charts.find((item) => item.reviewId === "rev-112")!;
    const currentVital = conflictingChart.vitals.find((item) => item.id === "chart-rev-112-vital-current")!;
    expect(currentVital.bmi).toBe(31.4);
    expect(conflictingChart.labs.flatMap((panel) => panel.results).some((item) => item.component === "BMI")).toBe(false);
    expect(currentVital.bmi).toBeLessThan(40);
    expect(conflictingChart.encounters[0].assessmentPlan).toEqual([]);

    const unsupportedObesityConditions = demoSeedData.conditions.filter(
      (condition) => condition.icd10 === "E66.01" && (condition.conflictingEvidence || condition.resolvedFlag)
    );
    for (const condition of unsupportedObesityConditions) {
      const chart = demoSeedData.charts.find((item) => item.reviewId === condition.reviewId)!;
      expect(chart.vitals[0].bmi, condition.id).toBeLessThan(40);
    }

    for (const chart of demoSeedData.charts) {
      const labRows = chart.labs.flatMap((panel) => panel.results);
      const conditionCreatinine = labRows.find((item) => item.component === "Creatinine" && item.id.includes("-lab-cond-"));
      const cmpCreatinine = labRows.find((item) => item.id === `chart-${chart.reviewId}-lab-cr`);
      if (conditionCreatinine && cmpCreatinine) expect(cmpCreatinine.value, chart.reviewId).toBe(conditionCreatinine.value);
    }
  });
});
