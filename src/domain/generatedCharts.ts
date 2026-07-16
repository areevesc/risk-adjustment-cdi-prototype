import type {
  Category,
  ChartAssessmentPlanItem,
  ChartEncounter,
  ChartImagingReport,
  ChartLabPanel,
  ChartMedication,
  ChartProblem,
  ChartSpecialistNote,
  ChartVital,
  Claim,
  ClinicalChart,
  Condition,
  EvidenceSourceType,
  EvidenceStrength,
  EvidencePassage,
  Patient,
  PatientReview,
  SeedData,
  SourceDocument,
  UpcomingAppointment
} from "./types";
import { evidenceStrengthLabel, meatTypesForSource, sourceLocationFor } from "./mockClinicalContent";
import { getCmsV28Diagnosis, getCmsV28DisplayHccs, getCmsV28StandaloneFactor, scoreCmsV28CommunityNa } from "./cmsV28";

interface GeneratedChartBundle {
  patient: Patient;
  review: PatientReview;
  documents: SourceDocument[];
  evidence: EvidencePassage[];
  claims: Claim[];
  chart: ClinicalChart;
  conditions: Condition[];
  appointment?: UpcomingAppointment;
}

interface ScenarioCondition {
  suffix: string;
  icd10: string;
  description: string;
  hcc: string;
  raf: number;
  category: Category;
  subtype?: "recapture" | "suspect";
  claimStatus: Condition["claimStatus"];
  supportPhrases: readonly string[];
  planPhrases: readonly string[];
  problemStatus?: ChartProblem["status"];
  medication: ChartMedication;
  labResults: ChartLabPanel["results"];
  imaging: Omit<ChartImagingReport, "id" | "date" | "evidenceIds">;
  specialist: Omit<ChartSpecialistNote, "id" | "date" | "evidenceIds">;
}

interface GeneratedConditionFacts extends Omit<ScenarioCondition, "supportPhrases" | "planPhrases"> {
  support: string;
  plan: string;
}

interface GeneratedClinicalFacts {
  ordinal: number;
  scenarioKey: string;
  patientName: string;
  dob: string;
  sex: "F" | "M";
  demographicRaf: number;
  hasVisit: boolean;
  visitDate: string;
  noteDate: string;
  labDate: string;
  priorDate: string;
  pmh: string[];
  vitals: Omit<ChartVital, "id" | "date" | "evidenceIds">;
  conditions: GeneratedConditionFacts[];
  clinic: SeedData["clinics"][number];
  provider: SeedData["providers"][number];
  payer: SeedData["payers"][number];
}

export interface GeneratedChartContext {
  completedReviewId: string;
  contentRevision: number;
}

export const GENERATED_CHART_CONTENT_REVISION = 2;

const generatedNames = [
  ["Alicia", "Moreno", "F"],
  ["Curtis", "Lang", "M"],
  ["Janet", "Price", "F"],
  ["Elaine", "Wong", "F"],
  ["Frank", "Dawson", "M"],
  ["Rose", "Gaines", "F"],
  ["Milton", "Shaw", "M"],
  ["Selena", "Foster", "F"]
] as const;

const scenarios: Array<{ key: string; conditions: ScenarioCondition[]; pmh: string[]; vitals: Omit<ChartVital, "id" | "date" | "evidenceIds"> }> = [
  {
    key: "diabetes-ckd-hf",
    pmh: ["Type 2 diabetes mellitus for more than 10 years", "Stage 3 chronic kidney disease followed by nephrology", "Hypertension", "Hyperlipidemia"],
    vitals: { systolic: 138, diastolic: 76, heartRate: 72, temperature: 98.3, weight: 194, height: 65, bmi: 32.3, oxygenSaturation: 96 },
    conditions: [
      {
        suffix: "a",
        icd10: "E11.22",
        description: "Type 2 DM with diabetic chronic kidney disease",
        hcc: "HCC 328",
        raf: 0.299,
        category: "potentialAddition",
        claimStatus: "Not on claim",
        supportPhrases: [
          "Home glucose readings are mostly 150-190 mg/dL with two missed evening insulin doses last week. Renal labs were reviewed and patient denies dysuria, flank pain, or NSAID use.",
          "Glucose logs remain above goal, usually 145-185 mg/dL. The patient missed several evening insulin doses, and the recent renal panel and urine albumin results were reviewed.",
          "The patient reports fasting glucose values in the 150s with occasional evening readings near 190. Medication adherence and kidney function trends were discussed."
        ],
        planPhrases: [
          "Continue renal-dose medication review, repeat urine microalbumin in 3 months, reinforce sick-day guidance, and monitor diabetic kidney disease.",
          "Continue the current diabetes regimen with renal dosing, repeat A1c and urine albumin in 3 months, and avoid NSAIDs.",
          "Reinforce insulin adherence, continue renal-protective therapy, and repeat A1c, creatinine, and urine albumin before the next visit."
        ],
        medication: { id: "", name: "Insulin glargine", dose: "18 units", frequency: "nightly", route: "Subcutaneous", prescriber: "", evidenceIds: [] },
        labResults: [
          { id: "", component: "HbA1c", value: "8.4", unit: "%", referenceRange: "4.0-5.6", flag: "abnormal", evidenceIds: [] },
          { id: "", component: "Estimated GFR", value: "41", unit: "mL/min", referenceRange: ">60", flag: "abnormal", evidenceIds: [] },
          { id: "", component: "Urine Albumin/Creatinine Ratio", value: "186", unit: "mg/g", referenceRange: "<30", flag: "abnormal", evidenceIds: [] }
        ],
        imaging: {
          type: "Renal ultrasound",
          indication: "Chronic kidney disease",
          findings: "Bilateral increased renal echogenicity compatible with chronic medical renal disease; no hydronephrosis.",
          impression: ["Chronic medical renal disease.", "No obstruction."]
        },
        specialist: {
          specialty: "Nephrology",
          provider: "Renee Cole, MD",
          title: "Nephrology follow-up",
          note: "Diabetic CKD stage 3b reviewed. Albuminuria persists despite ACE inhibitor therapy.",
          assessment: ["Type 2 diabetes with chronic kidney disease", "Continue renal-protective therapy"]
        }
      },
      {
        suffix: "b",
        icd10: "I50.32",
        description: "Chronic diastolic heart failure",
        hcc: "HCC 222",
        raf: 0.323,
        category: "prospective",
        subtype: "recapture",
        claimStatus: "Historical",
        supportPhrases: [
          "Patient reports mild dyspnea with stairs and intermittent ankle edema that improves when furosemide is taken consistently. No chest pain or syncope today.",
          "Ankle swelling occurs late in the day and improves with elevation and regular furosemide use. The patient denies chest pressure, orthopnea, or syncope.",
          "The patient notes shortness of breath on stairs but no symptoms at rest. Weight has been stable and lower-extremity edema remains intermittent."
        ],
        planPhrases: [
          "HFpEF remains listed in outside cardiology records. Request the current cardiology note and reconcile the diagnosis and medication list at follow-up.",
          "Outside cardiology records list HFpEF. No condition-specific medication change was made today; updated cardiology records were requested.",
          "History of HFpEF is noted in prior cardiology records. Confirm interval status when the updated specialist note is received."
        ],
        medication: { id: "", name: "Furosemide", dose: "40 mg", frequency: "daily", route: "PO", prescriber: "", evidenceIds: [] },
        labResults: [{ id: "", component: "BNP", value: "412", unit: "pg/mL", referenceRange: "<100", flag: "abnormal", evidenceIds: [] }],
        imaging: {
          type: "Echocardiogram",
          indication: "Dyspnea and edema",
          findings: "EF 58% with grade II diastolic dysfunction and mild left atrial enlargement.",
          impression: ["Preserved systolic function.", "Diastolic dysfunction consistent with HFpEF history."]
        },
        specialist: {
          specialty: "Cardiology",
          provider: "Caleb Morris, MD",
          title: "Cardiology interval note",
          note: "Chronic diastolic heart failure is stable with intermittent edema responsive to diuretic titration.",
          assessment: ["HFpEF, chronic", "Continue the current heart-failure regimen"]
        }
      }
    ]
  },
  {
    key: "copd-depression",
    pmh: ["Remote tobacco exposure", "COPD with prior spirometry obstruction", "Major depressive disorder", "Osteoarthritis"],
    vitals: { systolic: 126, diastolic: 68, heartRate: 84, temperature: 98.7, weight: 172, height: 66, bmi: 27.8, oxygenSaturation: 93 },
    conditions: [
      {
        suffix: "a",
        icd10: "J44.9",
        description: "Chronic obstructive pulmonary disease",
        hcc: "HCC 280",
        raf: 0.214,
        category: "prospective",
        subtype: "recapture",
        claimStatus: "Historical",
        supportPhrases: [
          "Patient reports exertional dyspnea and uses albuterol several times weekly. No fever, hemoptysis, or increased sputum today; maintenance inhaler use was reviewed.",
          "Breathing is comfortable at rest, but the patient becomes winded walking uphill and uses the rescue inhaler three times most weeks. There has been no recent change in sputum.",
          "The patient continues to have intermittent wheezing with activity. Daily inhaler technique and rescue-inhaler frequency were reviewed."
        ],
        planPhrases: [
          "COPD remains listed in outside pulmonary records. Request the recent spirometry report and pulmonology note before the next chronic-care visit.",
          "Maintenance inhalers remain on the medication list. Updated pulmonary records were requested for interval diagnosis and treatment history.",
          "Prior pulmonary notes list COPD. Reconcile current inhaler use and pulmonary status when the updated specialist note is received."
        ],
        medication: { id: "", name: "Tiotropium-olodaterol", dose: "2 inhalations", frequency: "daily", route: "Inhaled", prescriber: "", evidenceIds: [] },
        labResults: [{ id: "", component: "CO2", value: "31", unit: "mmol/L", referenceRange: "22-30", flag: "abnormal", evidenceIds: [] }],
        imaging: {
          type: "Chest CT",
          indication: "COPD follow-up",
          findings: "Hyperinflation and emphysematous change without acute infiltrate.",
          impression: ["COPD/emphysematous change.", "No acute pneumonia."]
        },
        specialist: {
          specialty: "Pulmonology",
          provider: "Ira Nash, DO",
          title: "Pulmonology follow-up",
          note: "COPD remains active with dyspnea on exertion and rescue inhaler use several times weekly.",
          assessment: ["COPD, active", "Continue maintenance inhaler"]
        }
      },
      {
        suffix: "b",
        icd10: "F33.1",
        description: "Major depressive disorder, recurrent, moderate",
        hcc: "HCC 155",
        raf: 0.291,
        category: "potentialAddition",
        claimStatus: "Not on claim",
        supportPhrases: [
          "Patient reports low mood, reduced motivation, poor sleep, and social withdrawal over the last two months. PHQ-9 score is 15 and the patient denies active suicidal ideation.",
          "Mood and motivation remain low, with fragmented sleep and less interest in usual activities. PHQ-9 is 15; the patient denies suicidal intent or plan.",
          "The patient describes persistent sadness, reduced energy, and difficulty sleeping. Safety questions were reviewed and there is no active suicidal ideation."
        ],
        planPhrases: [
          "Continue SSRI titration, review the safety plan, and follow up with integrated behavioral health in 4 weeks.",
          "Increase sertraline as discussed, continue counseling, and return in 4 weeks for symptom and medication review.",
          "Continue sertraline and behavioral-health follow-up. The patient will use the reviewed crisis resources for any worsening safety concerns."
        ],
        medication: { id: "", name: "Sertraline", dose: "100 mg", frequency: "daily", route: "PO", prescriber: "", evidenceIds: [] },
        labResults: [{ id: "", component: "TSH", value: "2.8", unit: "uIU/mL", referenceRange: "0.45-4.50", flag: "normal", evidenceIds: [] }],
        imaging: {
          type: "No current neuroimaging",
          indication: "Mood disorder workup",
        findings: "Behavioral health screening documents PHQ-9 score of 15 with sleep disruption, low motivation, and no active suicidal ideation.",
          impression: ["No imaging driver identified for mood symptoms."]
        },
        specialist: {
          specialty: "Behavioral Health",
          provider: "Lana Price, LCSW",
          title: "Behavioral health note",
          note: "Recurrent moderate depression documented with PHQ-9 score 15, low motivation, and medication titration.",
          assessment: ["MDD recurrent moderate", "Continue medication and counseling"]
        }
      }
    ]
  }
];

function section(id: string, text: string, evidenceIds: string[] = []) {
  return { id, text, evidenceIds };
}

function generatedReviewCount(data: SeedData) {
  return data.reviews.filter((review) => review.id.startsWith("gen-rev-")).length;
}

function nextGeneratedOrdinal(data: SeedData) {
  return data.reviews.reduce((highest, review) => {
    const match = /^gen-rev-(\d+)$/.exec(review.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function integerBetween(minimum: number, maximum: number, random: () => number) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function buildGeneratedClinicalFacts(
  data: SeedData,
  assignedUserId: string,
  calendarYear: number,
  context?: Partial<GeneratedChartContext>
): GeneratedClinicalFacts {
  const generationCount = generatedReviewCount(data);
  const ordinal = nextGeneratedOrdinal(data);
  const completedReviewId = context?.completedReviewId ?? `direct-generation-${generationCount}`;
  const contentRevision = context?.contentRevision ?? GENERATED_CHART_CONTENT_REVISION;
  const random = seededRandom(hashSeed(`${contentRevision}:${completedReviewId}:${generationCount}`));
  const scenario = pick(scenarios, random);
  const [firstName, lastName, sex] = pick(generatedNames, random);
  const assignedClinic = data.clinics.find((item) => item.defaultAssigneeId === assignedUserId);
  const clinic = assignedClinic ?? pick(data.clinics, random);
  const clinicProviders = data.providers.filter((item) => item.clinicId === clinic.id);
  const provider = pick(clinicProviders.length > 0 ? clinicProviders : data.providers, random);
  const payer = pick(data.payers, random);
  const height = scenario.vitals.height;
  const weight = scenario.vitals.weight + integerBetween(-6, 6, random);
  const vitals = {
    ...scenario.vitals,
    systolic: scenario.vitals.systolic + integerBetween(-8, 8, random),
    diastolic: scenario.vitals.diastolic + integerBetween(-4, 4, random),
    heartRate: scenario.vitals.heartRate + integerBetween(-6, 6, random),
    temperature: Number((scenario.vitals.temperature + integerBetween(-3, 3, random) / 10).toFixed(1)),
    weight,
    bmi: Number(((weight * 703) / (height * height)).toFixed(1)),
    oxygenSaturation: scenario.vitals.oxygenSaturation + integerBetween(-1, 1, random)
  };
  const noteDay = integerBetween(11, 22, random);
  const orderedConditions = [...scenario.conditions].sort((left, right) => Number(left.category === "prospective") - Number(right.category === "prospective"));
  const conditions = orderedConditions.map((condition): GeneratedConditionFacts => {
    const { supportPhrases, planPhrases, ...base } = condition;
    const diagnosis = getCmsV28Diagnosis(base.icd10);
    return {
      ...base,
      description: diagnosis?.description ?? base.description,
      hcc: getCmsV28DisplayHccs(base.icd10),
      raf: getCmsV28StandaloneFactor(base.icd10),
      support: pick(supportPhrases, random),
      plan: pick(planPhrases, random),
      medication: { ...base.medication, evidenceIds: [] },
      labResults: base.labResults.map((result) => ({ ...result, evidenceIds: [] })),
      imaging: { ...base.imaging, impression: [...base.imaging.impression] },
      specialist: { ...base.specialist, assessment: [...base.specialist.assessment] }
    };
  });

  const dob = `${1940 + integerBetween(0, 16, random)}-${String(integerBetween(1, 12, random)).padStart(2, "0")}-${String(integerBetween(3, 25, random)).padStart(2, "0")}`;
  return {
    ordinal,
    scenarioKey: scenario.key,
    patientName: `${firstName} ${lastName}`,
    dob,
    sex,
    demographicRaf: scoreCmsV28CommunityNa({ dob, sex, diagnosisCodes: [] }).demographicFactor,
    hasVisit: random() >= 0.25,
    visitDate: `${calendarYear}-08-${String(integerBetween(8, 24, random)).padStart(2, "0")}`,
    noteDate: `${calendarYear}-06-${String(noteDay).padStart(2, "0")}`,
    labDate: `${calendarYear}-06-${String(noteDay - integerBetween(2, 7, random)).padStart(2, "0")}`,
    priorDate: `${calendarYear - 1}-${String(integerBetween(8, 11, random)).padStart(2, "0")}-${String(integerBetween(10, 24, random)).padStart(2, "0")}`,
    pmh: [...scenario.pmh],
    vitals,
    conditions,
    clinic,
    provider,
    payer
  };
}

function vital(id: string, date: string, base: Omit<ChartVital, "id" | "date" | "evidenceIds">, evidenceIds: string[]): ChartVital {
  return { id, date, ...base, evidenceIds };
}

function joinSentenceFragments(items: string[], fallback: string) {
  if (items.length === 0) return fallback;
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(" ")} ${items[items.length - 1]}`;
}

function billingCodeFor(encounterType: string, hasVisit: boolean) {
  if (!hasVisit || encounterType.toLowerCase().includes("wellness")) return "G0439";
  return "99214";
}

function signatureTimeFor(index: number) {
  const hour = 2 + (index % 4);
  const minute = 12 + (index * 7) % 45;
  return `${hour}:${String(minute).padStart(2, "0")} PM`;
}

function buildMockStyleHpi(patientName: string, conditionText: string[]) {
  return `${patientName} returns for follow-up of chronic conditions and medication reconciliation. ${joinSentenceFragments(conditionText, "Interval symptoms, medication adherence, and home monitoring logs were discussed.")}`;
}

function buildMockStyleReviewOfSystems(scenarioKey: string) {
  const shared = [
    "Constitutional: no fever or acute unintentional weight loss.",
    "Cardiovascular: no chest pain or syncope today.",
    "Respiratory: no hemoptysis.",
    "Gastrointestinal: no melena or persistent vomiting."
  ];
  if (scenarioKey.includes("diabetes")) {
    return [...shared, "Endocrine: home glucose readings remain variable.", "Genitourinary: no dysuria or flank pain."];
  }
  return [...shared, "Psychiatric: mood and sleep concerns discussed when relevant.", "Neurologic: no new focal weakness."];
}

function buildMockStylePhysicalExam(scenarioKey: string) {
  const base = [
    { system: "General", text: "Alert, conversant, and in no acute distress." },
    { system: "Cardiovascular", text: "Regular rhythm; trace lower-extremity edema when present." },
    { system: "Respiratory", text: "No accessory muscle use; breath sounds mildly diminished at bases when present." }
  ];
  if (scenarioKey.includes("diabetes")) {
    return [...base, { system: "Extremities", text: "Feet intact without ulceration; monofilament sensation reduced when neuropathy symptoms are present." }];
  }
  return [...base, { system: "Psychiatric", text: "Affect appropriate; thought process linear." }];
}

function conditionWorkflow(category: Category): Condition["workflow"] {
  if (category === "potentialAddition") return "codesNotOnClaim";
  if (category === "prospective") return "prospective";
  return "codesOnClaim";
}

function generatedEvidenceStrength(category: Category, subtype: ScenarioCondition["subtype"], sourceType: EvidenceSourceType): EvidenceStrength {
  if (sourceType === "labResultRow") return "labIndicatorOnly";
  if (sourceType === "claimLine") return subtype === "recapture" ? "historicalClaimOnly" : "weakMentionOnly";
  if (sourceType === "planSentence") return category === "prospective" ? "assessmentWithoutPlan" : "assessmentWithPlan";
  if (category === "prospective") return subtype === "suspect" ? "suspect" : "recapture";
  if (sourceType === "hpiSentence") return "weakMentionOnly";
  return "weakMentionOnly";
}

function generatedEvidenceMeta(
  scenarioCondition: Pick<ScenarioCondition, "category" | "subtype" | "description">,
  sourceType: EvidenceSourceType
) {
  const evidenceStrength = generatedEvidenceStrength(scenarioCondition.category, scenarioCondition.subtype, sourceType);
  const sourceLocation = sourceLocationFor(sourceType);
  return {
    sourceType,
    sourceLocation,
    evidenceStrength,
    meatType: meatTypesForSource(sourceType, evidenceStrength),
    currentYearSupport: evidenceStrength === "strongCurrentYearMEAT" || evidenceStrength === "assessmentWithPlan",
    historicalOnly: evidenceStrength === "historicalOnly" || evidenceStrength === "historicalClaimOnly" || evidenceStrength === "specialistHistoricalOnly",
    suspectOnly: evidenceStrength === "suspect" || scenarioCondition.subtype === "suspect",
    recaptureOnly: scenarioCondition.subtype === "recapture" && evidenceStrength !== "strongCurrentYearMEAT",
    summary: `${evidenceStrengthLabel(evidenceStrength)} - ${sourceLocation}`,
    reviewerExplanation:
      evidenceStrength === "strongCurrentYearMEAT"
        || evidenceStrength === "assessmentWithPlan"
        ? `${sourceLocation} contains current-year MEAT support for ${scenarioCondition.description}.`
        : evidenceStrength === "clinicalIndicatorOnly" || evidenceStrength === "labIndicatorOnly" || evidenceStrength === "imagingIndicatorOnly"
          ? `${sourceLocation} is a clinical indicator for ${scenarioCondition.description}; it does not validate the diagnosis without assessment and plan support.`
          : evidenceStrength === "historicalOnly" || evidenceStrength === "historicalClaimOnly" || evidenceStrength === "recapture"
            ? `${sourceLocation} is lookback or prior-capture evidence for ${scenarioCondition.description}.`
            : evidenceStrength === "suspect"
              ? `${sourceLocation} supports a suspect opportunity for ${scenarioCondition.description}; provider confirmation is needed.`
              : `${sourceLocation} mentions ${scenarioCondition.description} without complete current-year MEAT.`
  };
}

export function buildGeneratedChart(
  data: SeedData,
  assignedUserId: string,
  calendarYear: number,
  context?: Partial<GeneratedChartContext>
): GeneratedChartBundle {
  const facts = buildGeneratedClinicalFacts(data, assignedUserId, calendarYear, context);
  const index = facts.ordinal - 1;
  const idNumber = String(facts.ordinal).padStart(3, "0");
  const scenario = { key: facts.scenarioKey, conditions: facts.conditions, pmh: facts.pmh, vitals: facts.vitals };
  const { clinic, provider, payer, hasVisit, visitDate, noteDate, labDate, priorDate, patientName } = facts;
  const patientId = `gen-pat-${idNumber}`;
  const reviewId = `gen-rev-${idNumber}`;
  const patient: Patient = {
    id: patientId,
    name: patientName,
    dob: facts.dob,
    memberId: `${payer.id.slice(6, 8).toUpperCase()}-${820000 + facts.ordinal}`,
    payerId: payer.id,
    riskProfile: { sex: facts.sex, segment: "COMMUNITY_NA", originallyDisabled: false },
    demographicRaf: facts.demographicRaf
  };
  const conditionIds = scenario.conditions.map((condition) => `gen-cond-${idNumber}-${condition.suffix}`);
  const review: PatientReview = {
    id: reviewId,
    patientId,
    calendarYear,
    reviewType: hasVisit ? "Concurrent" : "Prospective",
    clinicId: clinic.id,
    providerId: provider.id,
    status: "Available",
    queue: "CDI/Coder Queue",
    assignedUserId,
    appointmentId: hasVisit ? `gen-appt-${idNumber}` : undefined,
    conditionIds
  };
  const evidence = scenario.conditions.flatMap((scenarioCondition, conditionIndex): EvidencePassage[] => {
    const conditionId = conditionIds[conditionIndex];
    const prefix = `gen-ev-${idNumber}-${scenarioCondition.suffix}`;
    const workflow = conditionWorkflow(scenarioCondition.category);
    const clinicalEvidence: EvidencePassage[] = [
      {
        id: `${prefix}-hpi`,
        reviewId,
        documentId: `gen-doc-${reviewId}-progress`,
        anchorId: `chart-${reviewId}-encounter-current-hpi`,
        text: scenarioCondition.support,
        exactText: scenarioCondition.support,
        date: noteDate,
        category: scenarioCondition.category,
        subtype: scenarioCondition.subtype,
        conditionIds: [conditionId],
        ...generatedEvidenceMeta(scenarioCondition, "hpiSentence"),
        chartAnchor: { tab: "encounters", itemId: `chart-${reviewId}-encounter-current`, sectionId: "hpi" }
      },
      {
        id: `${prefix}-ap`,
        reviewId,
        documentId: `gen-doc-${reviewId}-progress`,
        anchorId: `chart-${reviewId}-encounter-current-ap`,
        text: scenarioCondition.plan,
        exactText: scenarioCondition.plan,
        date: noteDate,
        category: scenarioCondition.category,
        subtype: scenarioCondition.subtype,
        conditionIds: [conditionId],
        ...generatedEvidenceMeta(scenarioCondition, "planSentence"),
        chartAnchor: { tab: "encounters", itemId: `chart-${reviewId}-plan-${scenarioCondition.suffix}`, sectionId: "assessmentPlan" }
      },
      {
        id: `${prefix}-lab`,
        reviewId,
        documentId: `gen-doc-${reviewId}-labs`,
        anchorId: `chart-${reviewId}-labs`,
        text: scenarioCondition.labResults.map((result) => `${result.component} ${result.value} ${result.unit}`.trim()).join("; "),
        exactText: scenarioCondition.labResults[0] ? `${scenarioCondition.labResults[0].component} ${scenarioCondition.labResults[0].value} ${scenarioCondition.labResults[0].unit}`.trim() : undefined,
        date: labDate,
        category: scenarioCondition.category,
        subtype: scenarioCondition.subtype,
        conditionIds: [conditionId],
        ...generatedEvidenceMeta(scenarioCondition, "labResultRow"),
        chartAnchor: { tab: "labs", itemId: `chart-${reviewId}-lab-${scenarioCondition.suffix}-0` }
      }
    ];
    if (workflow !== "codesNotOnClaim") {
      clinicalEvidence.push({
        id: `${prefix}-claim`,
        reviewId,
        documentId: `gen-doc-${reviewId}-chart`,
        anchorId: `chart-${reviewId}-claims`,
        text: scenarioCondition.icd10,
        date: scenarioCondition.category === "prospective" ? priorDate : noteDate,
        category: scenarioCondition.category,
        subtype: scenarioCondition.subtype,
        conditionIds: [conditionId],
        exactText: scenarioCondition.icd10,
        ...generatedEvidenceMeta(scenarioCondition, "claimLine"),
        chartAnchor: { tab: "claims", itemId: `gen-claim-${reviewId}-${scenarioCondition.suffix}` }
      });
    }
    return clinicalEvidence;
  });
  const evidenceByCondition = new Map(conditionIds.map((id) => [id, evidence.filter((item) => item.conditionIds.includes(id)).map((item) => item.id)]));
  const chartVitals = [
    vital(`chart-${reviewId}-vital-current`, noteDate, scenario.vitals, []),
    vital(`chart-${reviewId}-vital-prior`, priorDate, { ...scenario.vitals, systolic: scenario.vitals.systolic + 6, heartRate: scenario.vitals.heartRate + 3 }, [])
  ];
  const assessmentPlan: ChartAssessmentPlanItem[] = scenario.conditions.map((scenarioCondition, conditionIndex) => {
    const conditionId = conditionIds[conditionIndex];
    return {
      id: `chart-${reviewId}-plan-${scenarioCondition.suffix}`,
      problem: `${scenarioCondition.description} (${scenarioCondition.icd10})`,
      code: scenarioCondition.icd10,
      detail: scenarioCondition.plan,
      evidenceIds: evidenceByCondition.get(conditionId)?.filter((id) => id.endsWith("-ap")) ?? []
    };
  });
  const currentEncounter: ChartEncounter = {
    id: `chart-${reviewId}-encounter-current`,
    date: noteDate,
    type: "Established patient chronic care follow-up",
    provider: provider.name,
    quality: "good",
    chiefComplaint: "Chronic condition follow-up and medication reconciliation.",
    hpi: buildMockStyleHpi(patientName, scenario.conditions.map((item) => item.support)),
    reviewOfSystems: buildMockStyleReviewOfSystems(scenario.key),
    physicalExam: buildMockStylePhysicalExam(scenario.key),
    vitals: chartVitals[0],
    assessmentPlan,
    signatureTime: signatureTimeFor(index),
    billingCode: billingCodeFor("Established patient chronic care follow-up", hasVisit),
    evidenceIds: evidence.filter((item) => item.id.endsWith("-hpi") || item.id.endsWith("-ap")).map((item) => item.id),
    sectionEvidenceIds: {
      hpi: evidence.filter((item) => item.id.endsWith("-hpi")).map((item) => item.id),
      assessmentPlan: evidence.filter((item) => item.id.endsWith("-ap")).map((item) => item.id),
      billing: evidence.filter((item) => item.id.endsWith("-claim")).map((item) => item.id)
    }
  };
  const historicalEncounter: ChartEncounter = {
    ...currentEncounter,
    id: `chart-${reviewId}-encounter-prior`,
    date: priorDate,
    type: "Prior-year chronic care follow-up",
    chiefComplaint: "Prior-year chronic condition follow-up.",
    hpi: "Patient was seen for annual wellness and chronic condition follow-up. Medication adherence, interval symptoms, and specialist follow-up were discussed.",
    assessmentPlan: assessmentPlan.map((plan) => ({ ...plan, id: `${plan.id}-prior`, detail: `Continue existing chronic-care regimen for ${plan.problem}. Follow up with primary care and specialists as scheduled.` })),
    vitals: chartVitals[1],
    evidenceIds: [],
    sectionEvidenceIds: {}
  };
  const labs: ChartLabPanel[] = [
    {
      id: `chart-${reviewId}-panel-current`,
      name: "Chronic Disease Monitoring Panel",
      date: labDate,
      results: scenario.conditions.flatMap((scenarioCondition, conditionIndex) => {
        const conditionId = conditionIds[conditionIndex];
        return scenarioCondition.labResults.map((result, resultIndex) => ({
          ...result,
          id: `chart-${reviewId}-lab-${scenarioCondition.suffix}-${resultIndex}`,
          evidenceIds: resultIndex === 0 ? evidenceByCondition.get(conditionId)?.filter((id) => id.endsWith("-lab")) ?? [] : []
        }));
      })
    },
    {
      id: `chart-${reviewId}-panel-cmp`,
      name: "Comprehensive Metabolic Panel",
      date: labDate,
      results: [
        { id: `chart-${reviewId}-lab-cmp-na`, component: "Sodium", value: "139", unit: "mmol/L", referenceRange: "136-145", flag: "normal", evidenceIds: [] },
        { id: `chart-${reviewId}-lab-cmp-k`, component: "Potassium", value: "4.3", unit: "mmol/L", referenceRange: "3.5-5.1", flag: "normal", evidenceIds: [] },
        { id: `chart-${reviewId}-lab-cmp-glu`, component: "Glucose", value: "148", unit: "mg/dL", referenceRange: "70-99", flag: "abnormal", evidenceIds: [] }
      ]
    }
  ];
  const problems: ChartProblem[] = scenario.conditions.map((scenarioCondition, conditionIndex) => {
    return {
      id: `chart-${reviewId}-problem-${scenarioCondition.suffix}`,
      diagnosis: scenarioCondition.description,
      code: scenarioCondition.icd10,
      status: scenarioCondition.problemStatus ?? "Active",
      dateAdded: `${calendarYear - 2}-02-${String(10 + conditionIndex).padStart(2, "0")}`,
      isHcc: getCmsV28Diagnosis(scenarioCondition.icd10)?.program === "risk-adjustment",
      evidenceIds: []
    };
  });
  const medications = scenario.conditions.map((scenarioCondition): ChartMedication => {
    return {
      ...scenarioCondition.medication,
      id: `chart-${reviewId}-med-${scenarioCondition.suffix}`,
      prescriber: provider.name,
      evidenceIds: []
    };
  });
  const imaging = scenario.conditions.map((scenarioCondition, conditionIndex): ChartImagingReport => {
    return {
      ...scenarioCondition.imaging,
      id: `chart-${reviewId}-image-${scenarioCondition.suffix}`,
      date: conditionIndex === 0 ? `${calendarYear}-05-30` : `${calendarYear}-04-19`,
      evidenceIds: []
    };
  });
  const specialistNotes = scenario.conditions.map((scenarioCondition, conditionIndex): ChartSpecialistNote => {
    return {
      ...scenarioCondition.specialist,
      id: `chart-${reviewId}-specialist-${scenarioCondition.suffix}`,
      date: conditionIndex === 0 ? `${calendarYear}-05-21` : `${calendarYear}-03-12`,
      evidenceIds: []
    };
  });
  const claims = scenario.conditions.flatMap((scenarioCondition, conditionIndex): Claim[] => {
    const conditionId = conditionIds[conditionIndex];
    const workflow = conditionWorkflow(scenarioCondition.category);
    if (workflow === "codesNotOnClaim") return [];
    const currentYearClaim = workflow !== "prospective";
    return [{
      id: `gen-claim-${reviewId}-${scenarioCondition.suffix}`,
      reviewId,
      dateOfService: currentYearClaim ? noteDate : priorDate,
      provider: provider.name,
      cptCode: currentYearClaim ? "99214" : "G0439",
      encounterType: currentYearClaim ? "Established patient office visit" : "Annual wellness visit / historical capture",
      payer: payer.name,
      riskEligible: true,
      cptSourceEligible: true,
      providerTypeEligible: true,
      faceToFace: true,
      providerSignatureValid: true,
      icd10Codes: [scenarioCondition.icd10]
    }];
  });
  const chart: ClinicalChart = {
    reviewId,
    problems,
    encounters: [currentEncounter, historicalEncounter],
    medications,
    labs,
    vitals: chartVitals,
    imaging,
    pastMedicalHistory: scenario.pmh.map((text, pmhIndex) => ({ id: `chart-${reviewId}-pmh-${pmhIndex}`, text, evidenceIds: [] })),
    specialistNotes,
    claims
  };
  const documents: SourceDocument[] = [
    {
      id: `gen-doc-${reviewId}-progress`,
      reviewId,
      type: "Progress Note",
      title: `${calendarYear} embedded EMR progress note`,
      date: noteDate,
      isCurrentYear: true,
      riskEligibleSource: true,
      cptSourceEligible: true,
      providerTypeEligible: true,
      faceToFace: true,
      providerSignatureValid: true,
      sections: [
        section(`chart-${reviewId}-encounter-current-cc`, currentEncounter.chiefComplaint),
        section(`chart-${reviewId}-encounter-current-hpi`, currentEncounter.hpi, evidence.filter((item) => item.id.endsWith("-hpi")).map((item) => item.id)),
        section(`chart-${reviewId}-encounter-current-ros`, currentEncounter.reviewOfSystems.join(" ")),
        section(`chart-${reviewId}-encounter-current-exam`, currentEncounter.physicalExam.map((item) => `${item.system}: ${item.text}`).join(" ")),
        section(`chart-${reviewId}-encounter-current-ap`, currentEncounter.assessmentPlan.map((item) => `${item.problem}: ${item.detail}`).join(" "), evidence.filter((item) => item.id.endsWith("-ap")).map((item) => item.id))
      ]
    },
    {
      id: `gen-doc-${reviewId}-labs`,
      reviewId,
      type: "Lab",
      title: `${calendarYear} laboratory results`,
      date: labDate,
      isCurrentYear: true,
      sections: [section(`chart-${reviewId}-labs`, labs.flatMap((panel) => panel.results.map((result) => `${result.component} ${result.value} ${result.unit}`.trim())).join("; "), evidence.filter((item) => item.id.endsWith("-lab")).map((item) => item.id))]
    },
    {
      id: `gen-doc-${reviewId}-chart`,
      reviewId,
      type: "Registry",
      title: "Problem list, PMH, medications, imaging, specialist notes, and claims snapshot",
      date: noteDate,
      isCurrentYear: true,
      sections: [
        section(`chart-${reviewId}-problem-list`, problems.map((item) => `${item.diagnosis} ${item.code}`).join("; ")),
        section(`chart-${reviewId}-meds`, medications.map((item) => `${item.name} ${item.dose} ${item.frequency}`).join("; ")),
        section(`chart-${reviewId}-claims`, claims.map((item) => `${item.dateOfService} | ${item.provider ?? "Rendering provider"} | CPT ${item.cptCode ?? "not listed"} | ICD-10 ${item.icd10Codes.join(", ")}`).join("; "), evidence.filter((item) => item.id.endsWith("-claim")).map((item) => item.id))
      ]
    }
  ];
  const conditions = scenario.conditions.map((scenarioCondition, conditionIndex): Condition => {
    const conditionId = conditionIds[conditionIndex];
    const workflow = conditionWorkflow(scenarioCondition.category);
    const conditionEvidenceIds = evidenceByCondition.get(conditionId) ?? [];
    const diagnosis = getCmsV28Diagnosis(scenarioCondition.icd10);
    return {
      id: conditionId,
      reviewId,
      workflow,
      category: scenarioCondition.category,
      subtype: scenarioCondition.subtype,
      icd10: scenarioCondition.icd10,
      description: diagnosis?.description ?? scenarioCondition.description,
      program: diagnosis?.program ?? "clinical-context",
      hcc: getCmsV28DisplayHccs(scenarioCondition.icd10),
      raf: getCmsV28StandaloneFactor(scenarioCondition.icd10),
      claimStatus: scenarioCondition.claimStatus,
      sourceDate: workflow === "prospective" ? priorDate : noteDate,
      evidenceIds: conditionEvidenceIds,
      lookbackEvidenceIds: workflow === "prospective" ? conditionEvidenceIds.filter((id) => id.endsWith("-claim")) : undefined,
      actionable: true,
      currentYear: true,
      hasSufficientMeat: workflow !== "prospective",
      hasOtherSupportingEvidence: true,
      hadPriorCapture: workflow === "prospective",
      hasCurrentYearCapture: workflow !== "prospective",
      hasClinicalIndicators: true,
      seededRecommendation: {
        action: workflow === "codesNotOnClaim" ? "Add to Claim" : workflow === "prospective" ? "Yes" : "Validate",
        confidence: "Medium",
        source: "seeded",
        rationale: workflow === "codesNotOnClaim"
          ? "Assessment and plan contain current diagnosis-specific management, while the diagnosis is not on the claim."
          : workflow === "prospective"
            ? "Historical or outside-source documentation supports review at an upcoming encounter, but current primary care validation is incomplete."
            : "Current assessment and plan contain diagnosis-specific monitoring or treatment."
      },
      documentationIssues: []
    };
  });
  const appointment: UpcomingAppointment | undefined = hasVisit
    ? { id: review.appointmentId!, patientId, providerId: provider.id, date: visitDate, type: "Pre-visit chronic care review" }
    : undefined;

  return { patient, review, documents, evidence, claims, chart, conditions, appointment };
}

export function appendGeneratedChartForAssignee(
  data: SeedData,
  assignedUserId: string,
  calendarYear: number,
  context?: Partial<GeneratedChartContext>
): SeedData {
  const bundle = buildGeneratedChart(data, assignedUserId, calendarYear, context);
  return {
    ...data,
    patients: [...data.patients, bundle.patient],
    reviews: [...data.reviews, bundle.review],
    documents: [...data.documents, ...bundle.documents],
    evidence: [...data.evidence, ...bundle.evidence],
    claims: [...data.claims, ...bundle.claims],
    charts: [...data.charts, bundle.chart],
    conditions: [...data.conditions, ...bundle.conditions],
    appointments: bundle.appointment ? [...data.appointments, bundle.appointment] : data.appointments
  };
}
