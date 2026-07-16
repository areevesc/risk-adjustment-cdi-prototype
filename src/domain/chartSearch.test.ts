import { describe, expect, it } from "vitest";
import type { ClinicalChart } from "./types";
import { buildChartSearchResults, normalizeChartSearchQuery } from "./chartSearch";

const chart: ClinicalChart = {
  reviewId: "review-1",
  encounters: [
    {
      id: "encounter-1",
      date: "2026-04-12",
      type: "Chronic care follow-up",
      provider: "Dr. Rivera",
      quality: "good",
      chiefComplaint: "Diabetes follow-up",
      hpi: "Diabetes remains stable. DIABETES medications were reviewed.",
      reviewOfSystems: ["Cardiac: no chest pain", "Respiratory: no cough"],
      physicalExam: [{ system: "Neurologic", text: "Reduced monofilament sensation" }],
      vitals: {
        id: "encounter-vital-1",
        date: "2026-04-12",
        systolic: 132,
        diastolic: 76,
        heartRate: 72,
        temperature: 97.6,
        weight: 184,
        height: 65,
        bmi: 30.6,
        oxygenSaturation: 98,
        evidenceIds: []
      },
      assessmentPlan: [
        {
          id: "plan-1",
          problem: "Type 2 diabetes mellitus",
          code: "E11.9",
          detail: "Continue metformin and repeat A1c.",
          evidenceIds: []
        }
      ],
      signatureTime: "4:15 PM",
      billingCode: "99214",
      evidenceIds: [],
      sectionEvidenceIds: {}
    }
  ],
  problems: [
    {
      id: "problem-1",
      diagnosis: "Type 2 diabetes mellitus",
      code: "E11.9",
      status: "Active",
      dateAdded: "2024-03-01",
      isHcc: true,
      evidenceIds: []
    }
  ],
  pastMedicalHistory: [{ id: "pmh-1", text: "Appendectomy in childhood", evidenceIds: [] }],
  medications: [
    {
      id: "medication-1",
      name: "Metformin",
      dose: "500 mg",
      frequency: "Twice daily",
      route: "Oral",
      prescriber: "Dr. Rivera",
      evidenceIds: []
    }
  ],
  labs: [
    {
      id: "panel-1",
      name: "Comprehensive Metabolic Panel",
      date: "2026-04-10",
      results: [
        {
          id: "lab-result-1",
          component: "Creatinine",
          value: "1.4",
          unit: "mg/dL",
          referenceRange: "0.6-1.2",
          flag: "abnormal",
          evidenceIds: []
        }
      ]
    }
  ],
  vitals: [
    {
      id: "vital-1",
      date: "2026-01-02",
      systolic: 128,
      diastolic: 74,
      heartRate: 68,
      temperature: 98.2,
      weight: 181,
      height: 65,
      bmi: 30.1,
      oxygenSaturation: 99,
      evidenceIds: []
    }
  ],
  imaging: [
    {
      id: "imaging-1",
      type: "Chest radiograph",
      date: "2026-02-14",
      indication: "Persistent cough",
      findings: "Mild bibasilar atelectasis.",
      impression: ["No focal pneumonia."],
      evidenceIds: []
    }
  ],
  specialistNotes: [
    {
      id: "specialist-1",
      date: "2026-03-08",
      specialty: "Podiatry",
      provider: "Dr. Chen",
      title: "Diabetic foot evaluation",
      note: "Protective sensation is diminished.",
      assessment: ["Peripheral neuropathy"],
      evidenceIds: []
    }
  ],
  claims: [
    {
      id: "claim-1",
      reviewId: "review-1",
      dateOfService: "2026-04-12",
      provider: "Dr. Rivera",
      cptCode: "99214",
      encounterType: "Office visit",
      payer: "Example Health Plan",
      riskEligible: true,
      cptSourceEligible: true,
      providerTypeEligible: true,
      faceToFace: true,
      providerSignatureValid: true,
      icd10Codes: ["E11.9"]
    }
  ]
};

describe("full-chart search", () => {
  it("normalizes case and whitespace and treats a blank query as empty", () => {
    expect(normalizeChartSearchQuery("  Type 2\n  DIABETES\tMellitus  ")).toBe("type 2 diabetes mellitus");
    expect(buildChartSearchResults(chart, " \n\t ")).toEqual([]);
    expect(buildChartSearchResults(chart, "04/12/2026").some((result) => result.tab === "encounters")).toBe(true);
  });

  it("indexes every chart tab", () => {
    const searches = [
      ["chest pain", "encounters"],
      ["E11.9", "problem-list"],
      ["appendectomy", "pmh"],
      ["twice daily", "medications"],
      ["creatinine", "labs"],
      ["181 lb", "vitals"],
      ["atelectasis", "imaging"],
      ["neuropathy", "specialist-notes"],
      ["Example Health Plan", "claims"]
    ] as const;

    searches.forEach(([query, tab]) => {
      expect(buildChartSearchResults(chart, query).some((result) => result.tab === tab), `${tab} should be searchable`).toBe(true);
    });
  });

  it("returns section-level navigation data and case-insensitive match counts", () => {
    const diabetesResults = buildChartSearchResults(chart, "diabetes");
    const hpiResult = diabetesResults.find((result) => result.sectionId === "hpi");
    const planResult = diabetesResults.find((result) => result.itemId === "plan-1");

    expect(hpiResult).toMatchObject({
      tab: "encounters",
      parentId: "encounter-1",
      itemId: "encounter-1",
      sectionId: "hpi",
      sectionLabel: "History of Present Illness",
      matchCount: 2
    });
    expect(planResult).toMatchObject({
      tab: "encounters",
      parentId: "encounter-1",
      itemId: "plan-1",
      sectionId: "assessmentPlan"
    });
    expect(hpiResult?.preview.toLowerCase()).toContain("diabetes");
  });

  it("keeps nested container IDs and result order deterministic", () => {
    expect(buildChartSearchResults(chart, "creatinine")).toEqual([
      expect.objectContaining({
        tab: "labs",
        parentId: "panel-1",
        itemId: "lab-result-1",
        sectionLabel: "Creatinine",
        matchCount: 1
      })
    ]);
    expect(buildChartSearchResults(chart, "diabetes")).toEqual(buildChartSearchResults(chart, "DIABETES"));
  });
});
