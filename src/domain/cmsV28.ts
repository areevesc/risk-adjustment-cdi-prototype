export const CMS_V28_MODEL = {
  paymentYear: 2026,
  model: "CMS-HCC V28",
  segment: "COMMUNITY_NA",
  segmentLabel: "Community Non-Dual Aged",
  referenceDate: "2026-02-01",
  originallyDisabled: false,
  mappingSourceUrl: "https://www.cms.gov/files/zip/2026-midyear-final-icd-10-mappings.zip",
  coefficientSourceUrl: "https://www.cms.gov/files/zip/2026-midyear-final-model-software-python.zip"
} as const;

export type CmsV28Sex = "F" | "M";
export type CmsV28Hcc =
  | "HCC37"
  | "HCC38"
  | "HCC48"
  | "HCC155"
  | "HCC224"
  | "HCC226"
  | "HCC280"
  | "HCC298"
  | "HCC327"
  | "HCC328"
  | "HCC383";

export type ConditionProgram = "risk-adjustment" | "quality" | "clinical-context";

export interface CmsV28Diagnosis {
  icd10: string;
  description: string;
  program: ConditionProgram;
  hccs: CmsV28Hcc[];
  minimumAge?: number;
}

export interface CmsV28ScoreInput {
  dob: string;
  sex: CmsV28Sex;
  diagnosisCodes: string[];
  referenceDate?: string;
}

export interface CmsV28ScoreBreakdown {
  model: typeof CMS_V28_MODEL.model;
  paymentYear: typeof CMS_V28_MODEL.paymentYear;
  segment: typeof CMS_V28_MODEL.segment;
  referenceDate: string;
  age: number;
  sex: CmsV28Sex;
  demographicVariable?: string;
  demographicFactor: number;
  mappedHccs: CmsV28Hcc[];
  activeHccs: CmsV28Hcc[];
  suppressedHccs: Array<{ hcc: CmsV28Hcc; suppressedBy: CmsV28Hcc }>;
  hccFactors: Array<{ hcc: CmsV28Hcc; label: string; factor: number }>;
  interactions: Array<{ variable: string; label: string; factor: number }>;
  countFactor: { variable: string; count: number; factor: number };
  total: number;
}

const DIAGNOSES: Record<string, CmsV28Diagnosis> = {
  "E11.22": riskDiagnosis("E11.22", "Type 2 diabetes mellitus with diabetic chronic kidney disease", ["HCC37"]),
  "E11.311": riskDiagnosis("E11.311", "Type 2 diabetes mellitus with unspecified diabetic retinopathy with macular edema", ["HCC37", "HCC298"]),
  "E11.40": riskDiagnosis("E11.40", "Type 2 diabetes mellitus with diabetic neuropathy, unspecified", ["HCC37"]),
  "E11.42": riskDiagnosis("E11.42", "Type 2 diabetes mellitus with diabetic polyneuropathy", ["HCC37"]),
  "E11.51": riskDiagnosis("E11.51", "Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene", ["HCC37"]),
  "E11.621": riskDiagnosis("E11.621", "Type 2 diabetes mellitus with foot ulcer", ["HCC37", "HCC383"]),
  "E11.65": riskDiagnosis("E11.65", "Type 2 diabetes mellitus with hyperglycemia", ["HCC38"]),
  "E66.01": riskDiagnosis("E66.01", "Morbid (severe) obesity due to excess calories", ["HCC48"]),
  "F33.1": riskDiagnosis("F33.1", "Major depressive disorder, recurrent, moderate", ["HCC155"]),
  I10: nonRiskDiagnosis("I10", "Essential (primary) hypertension", "quality"),
  "I50.32": riskDiagnosis("I50.32", "Chronic diastolic (congestive) heart failure", ["HCC226"]),
  "I50.33": riskDiagnosis("I50.33", "Acute on chronic diastolic (congestive) heart failure", ["HCC224"]),
  "J20.9": nonRiskDiagnosis("J20.9", "Acute bronchitis, unspecified", "clinical-context"),
  "J44.89": { ...riskDiagnosis("J44.89", "Other specified chronic obstructive pulmonary disease", ["HCC280"]), minimumAge: 18 },
  "J44.9": { ...riskDiagnosis("J44.9", "Chronic obstructive pulmonary disease, unspecified", ["HCC280"]), minimumAge: 18 },
  "N18.32": riskDiagnosis("N18.32", "Chronic kidney disease, stage 3b", ["HCC328"]),
  "N18.4": riskDiagnosis("N18.4", "Chronic kidney disease, stage 4 (severe)", ["HCC327"]),
  "N18.9": nonRiskDiagnosis("N18.9", "Chronic kidney disease, unspecified", "clinical-context"),
  "Z13.89": nonRiskDiagnosis("Z13.89", "Encounter for screening for other disorder", "quality")
};

export const CMS_V28_HCC_METADATA: Record<CmsV28Hcc, { label: string; factor: number }> = {
  HCC37: { label: "Diabetes with chronic complications", factor: 0.166 },
  HCC38: { label: "Diabetes without complication", factor: 0.166 },
  HCC48: { label: "Morbid obesity", factor: 0.186 },
  HCC155: { label: "Major depression, moderate or severe, without psychosis", factor: 0.299 },
  HCC224: { label: "Acute on chronic heart failure", factor: 0.36 },
  HCC226: { label: "Heart failure, except end-stage and acute", factor: 0.36 },
  HCC280: { label: "Chronic obstructive pulmonary disease", factor: 0.319 },
  HCC298: { label: "Severe diabetic eye disease", factor: 0.336 },
  HCC327: { label: "Chronic kidney disease, stage 4", factor: 0.514 },
  HCC328: { label: "Chronic kidney disease, stage 3b", factor: 0.127 },
  HCC383: { label: "Chronic ulcer of skin, except pressure", factor: 0.646 }
};

export const CMS_V28_HIERARCHY: ReadonlyArray<{ higher: CmsV28Hcc; lower: CmsV28Hcc }> = [
  { higher: "HCC37", lower: "HCC38" },
  { higher: "HCC224", lower: "HCC226" },
  { higher: "HCC327", lower: "HCC328" }
];

const DEMOGRAPHIC_FACTORS: Record<string, number> = {
  F65_69: 0.33,
  F70_74: 0.395,
  F75_79: 0.465,
  F80_84: 0.524,
  F85_89: 0.624,
  F90_94: 0.737,
  F95_GT: 0.742,
  M65_69: 0.332,
  M70_74: 0.396,
  M75_79: 0.502,
  M80_84: 0.571,
  M85_89: 0.664,
  M90_94: 0.8,
  M95_GT: 0.896
};

const INTERACTIONS = [
  {
    variable: "DIABETES_HF_V28",
    label: "Diabetes and heart failure",
    factor: 0.112,
    applies: (hccs: Set<CmsV28Hcc>) => hasAny(hccs, ["HCC37", "HCC38"]) && hasAny(hccs, ["HCC224", "HCC226"])
  },
  {
    variable: "HF_CHR_LUNG_V28",
    label: "Heart failure and chronic lung disease",
    factor: 0.078,
    applies: (hccs: Set<CmsV28Hcc>) => hasAny(hccs, ["HCC224", "HCC226"]) && hccs.has("HCC280")
  },
  {
    variable: "HF_KIDNEY_V28",
    label: "Heart failure and kidney disease",
    factor: 0.176,
    applies: (hccs: Set<CmsV28Hcc>) => hasAny(hccs, ["HCC224", "HCC226"]) && hasAny(hccs, ["HCC327", "HCC328"])
  }
] as const;

const COUNT_FACTORS: Record<number, number> = { 5: 0.05, 6: 0.102, 7: 0.188, 8: 0.316, 9: 0.444 };

function riskDiagnosis(icd10: string, description: string, hccs: CmsV28Hcc[]): CmsV28Diagnosis {
  return { icd10, description, program: "risk-adjustment", hccs };
}

function nonRiskDiagnosis(icd10: string, description: string, program: Exclude<ConditionProgram, "risk-adjustment">): CmsV28Diagnosis {
  return { icd10, description, program, hccs: [] };
}

function hasAny(hccs: Set<CmsV28Hcc>, candidates: CmsV28Hcc[]) {
  return candidates.some((hcc) => hccs.has(hcc));
}

export function normalizeIcd10(code: string) {
  return code.trim().toUpperCase();
}

export function getCmsV28Diagnosis(code: string): CmsV28Diagnosis | undefined {
  return DIAGNOSES[normalizeIcd10(code)];
}

export function getCmsV28Diagnoses(): CmsV28Diagnosis[] {
  return Object.values(DIAGNOSES);
}

export function getCmsV28Hccs(code: string, age?: number): CmsV28Hcc[] {
  const diagnosis = getCmsV28Diagnosis(code);
  if (!diagnosis || (diagnosis.minimumAge !== undefined && age !== undefined && age < diagnosis.minimumAge)) return [];
  return diagnosis.hccs;
}

export function getCmsV28Program(code: string): ConditionProgram {
  return getCmsV28Diagnosis(code)?.program ?? "clinical-context";
}

export function getCmsV28DisplayHccs(code: string, age?: number) {
  return getCmsV28Hccs(code, age).map((hcc) => hcc.replace("HCC", "HCC ")).join(" + ");
}

export function getCmsV28StandaloneFactor(code: string, age?: number) {
  return getCmsV28Hccs(code, age).reduce((sum, hcc) => sum + CMS_V28_HCC_METADATA[hcc].factor, 0);
}

export function calculateAge(dob: string, referenceDate: string = CMS_V28_MODEL.referenceDate): number {
  const birth = parseIsoDate(dob);
  const reference = parseIsoDate(referenceDate);
  let age = reference.year - birth.year;
  if (reference.month < birth.month || (reference.month === birth.month && reference.day < birth.day)) age -= 1;
  return age;
}

export function applyCmsV28Hierarchy(hccs: Iterable<CmsV28Hcc>) {
  const active = new Set(hccs);
  const suppressedHccs: CmsV28ScoreBreakdown["suppressedHccs"] = [];
  CMS_V28_HIERARCHY.forEach(({ higher, lower }) => {
    if (active.has(higher) && active.has(lower)) {
      active.delete(lower);
      suppressedHccs.push({ hcc: lower, suppressedBy: higher });
    }
  });
  return { activeHccs: sortHccs(active), suppressedHccs };
}

export function getHigherCmsV28Hccs(hcc: CmsV28Hcc) {
  return CMS_V28_HIERARCHY.filter(({ lower }) => lower === hcc).map(({ higher }) => higher);
}

export function sortCmsV28HccsForDisplay(hccs: Iterable<CmsV28Hcc>) {
  const items = Array.from(new Set(hccs));
  return items.sort((left, right) => {
    if (CMS_V28_HIERARCHY.some(({ higher, lower }) => higher === left && lower === right)) return -1;
    if (CMS_V28_HIERARCHY.some(({ higher, lower }) => higher === right && lower === left)) return 1;
    return Number(left.slice(3)) - Number(right.slice(3));
  });
}

export function scoreCmsV28CommunityNa(input: CmsV28ScoreInput): CmsV28ScoreBreakdown {
  const referenceDate = input.referenceDate ?? CMS_V28_MODEL.referenceDate;
  const age = calculateAge(input.dob, referenceDate);
  const mappedHccs = sortHccs(
    new Set(input.diagnosisCodes.flatMap((code) => getCmsV28Hccs(code, age)))
  );
  const { activeHccs, suppressedHccs } = applyCmsV28Hierarchy(mappedHccs);
  const demographicVariable = getDemographicVariable(input.sex, age);
  const demographicFactor = demographicVariable ? DEMOGRAPHIC_FACTORS[demographicVariable] : 0;
  const hccFactors = activeHccs.map((hcc) => ({ hcc, ...CMS_V28_HCC_METADATA[hcc] }));
  const activeSet = new Set(activeHccs);
  const interactions = INTERACTIONS.filter((interaction) => interaction.applies(activeSet)).map(({ variable, label, factor }) => ({ variable, label, factor }));
  const count = activeHccs.length;
  const countVariable = count >= 10 ? "D10P" : `D${count}`;
  const countFactor = count >= 10 ? 0.728 : COUNT_FACTORS[count] ?? 0;
  const total = roundToThree(
    demographicFactor +
      hccFactors.reduce((sum, item) => sum + item.factor, 0) +
      interactions.reduce((sum, item) => sum + item.factor, 0) +
      countFactor
  );

  return {
    model: CMS_V28_MODEL.model,
    paymentYear: CMS_V28_MODEL.paymentYear,
    segment: CMS_V28_MODEL.segment,
    referenceDate,
    age,
    sex: input.sex,
    demographicVariable,
    demographicFactor,
    mappedHccs,
    activeHccs,
    suppressedHccs,
    hccFactors,
    interactions,
    countFactor: { variable: countVariable, count, factor: countFactor },
    total
  };
}

function getDemographicVariable(sex: CmsV28Sex, age: number) {
  if (age < 65) return undefined;
  if (age >= 95) return `${sex}95_GT`;
  const lower = Math.floor(age / 5) * 5;
  return `${sex}${lower}_${lower + 4}`;
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) throw new Error(`Expected an ISO date, received: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function sortHccs(hccs: Iterable<CmsV28Hcc>) {
  return Array.from(hccs).sort((left, right) => Number(left.slice(3)) - Number(right.slice(3)));
}

function roundToThree(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
