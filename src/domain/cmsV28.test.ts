import { describe, expect, it } from "vitest";
import {
  CMS_V28_HIERARCHY,
  calculateAge,
  getCmsV28Diagnoses,
  getCmsV28Diagnosis,
  getCmsV28Hccs,
  scoreCmsV28CommunityNa
} from "./cmsV28";

describe("2026 CMS-HCC V28 domain", () => {
  it("maps every diagnosis used by the prototype from the official 2026 V28 subset", () => {
    expect(Object.fromEntries(getCmsV28Diagnoses().map((diagnosis) => [diagnosis.icd10, diagnosis.hccs]))).toEqual({
      "E11.22": ["HCC37"],
      "E11.311": ["HCC37", "HCC298"],
      "E11.40": ["HCC37"],
      "E11.42": ["HCC37"],
      "E11.51": ["HCC37"],
      "E11.621": ["HCC37", "HCC383"],
      "E11.65": ["HCC38"],
      "E66.01": ["HCC48"],
      "F33.1": ["HCC155"],
      I10: [],
      "I50.32": ["HCC226"],
      "I50.33": ["HCC224"],
      "J20.9": [],
      "J44.89": ["HCC280"],
      "J44.9": ["HCC280"],
      "N18.32": ["HCC328"],
      "N18.4": ["HCC327"],
      "N18.9": [],
      "Z13.89": []
    });
    expect(getCmsV28Diagnoses()).toHaveLength(19);
  });

  it("keeps non-payment conditions out of the HCC model and classifies their program", () => {
    expect(getCmsV28Diagnosis("I10")).toMatchObject({ program: "quality", hccs: [] });
    expect(getCmsV28Diagnosis("J20.9")).toMatchObject({ program: "clinical-context", hccs: [] });
    expect(getCmsV28Diagnosis("Z13.89")).toMatchObject({ program: "quality", hccs: [] });
  });

  it("applies the adult edit to COPD diagnoses", () => {
    expect(getCmsV28Hccs("J44.9", 17)).toEqual([]);
    expect(getCmsV28Hccs("J44.9", 18)).toEqual(["HCC280"]);
  });

  it("uses the official three hierarchy relationships present in the prototype subset", () => {
    expect(CMS_V28_HIERARCHY).toEqual([
      { higher: "HCC37", lower: "HCC38" },
      { higher: "HCC224", lower: "HCC226" },
      { higher: "HCC327", lower: "HCC328" }
    ]);
  });

  it("calculates age at the official February 1 reference date", () => {
    expect(calculateAge("1951-02-01")).toBe(75);
    expect(calculateAge("1951-02-02")).toBe(74);
  });

  it("scores demographics, active HCCs, hierarchy, interactions, and count factors", () => {
    const score = scoreCmsV28CommunityNa({
      dob: "1951-02-01",
      sex: "F",
      diagnosisCodes: ["E11.22", "E11.65", "I50.32", "I50.33", "J44.9", "N18.32", "N18.4"]
    });

    expect(score.demographicVariable).toBe("F75_79");
    expect(score.demographicFactor).toBe(0.465);
    expect(score.activeHccs).toEqual(["HCC37", "HCC224", "HCC280", "HCC327"]);
    expect(score.suppressedHccs).toEqual([
      { hcc: "HCC38", suppressedBy: "HCC37" },
      { hcc: "HCC226", suppressedBy: "HCC224" },
      { hcc: "HCC328", suppressedBy: "HCC327" }
    ]);
    expect(score.interactions.map((item) => item.variable)).toEqual(["DIABETES_HF_V28", "HF_CHR_LUNG_V28", "HF_KIDNEY_V28"]);
    expect(score.countFactor).toEqual({ variable: "D4", count: 4, factor: 0 });
    expect(score.total).toBe(2.19);
  });

  it("applies the official disease-count factor and rounds the raw score to three decimals", () => {
    const score = scoreCmsV28CommunityNa({
      dob: "1930-01-01",
      sex: "M",
      diagnosisCodes: ["E11.311", "E11.621", "E66.01", "F33.1", "I50.33", "J44.9", "N18.4"]
    });

    expect(score.activeHccs).toHaveLength(8);
    expect(score.countFactor).toEqual({ variable: "D8", count: 8, factor: 0.316 });
    expect(score.total).toBe(4.404);
  });
});
