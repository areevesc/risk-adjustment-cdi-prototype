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
  support: string;
  plan: string;
  problemStatus?: ChartProblem["status"];
  medication: ChartMedication;
  labResults: ChartLabPanel["results"];
  imaging: Omit<ChartImagingReport, "id" | "date" | "evidenceIds">;
  specialist: Omit<ChartSpecialistNote, "id" | "date" | "evidenceIds">;
}

const generatedNames = [
  ["Alicia", "Moreno"],
  ["Curtis", "Lang"],
  ["Janet", "Price"],
  ["Elaine", "Wong"],
  ["Frank", "Dawson"],
  ["Rose", "Gaines"],
  ["Milton", "Shaw"],
  ["Selena", "Foster"]
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
        support: "Home glucose readings are mostly 150-190 mg/dL with two missed evening insulin doses last week. Renal labs were reviewed and patient denies dysuria, flank pain, or NSAID use.",
        plan: "Continue renal-dose medication review, repeat microalbumin in 3 months, reinforce sick-day guidance, and monitor diabetic kidney disease.",
        medication: { id: "", name: "Metformin ER", dose: "500 mg", frequency: "daily", route: "PO", prescriber: "", evidenceIds: [] },
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
        support: "Patient reports mild dyspnea with stairs and intermittent ankle edema that improves when furosemide is taken consistently. No chest pain or syncope today.",
        plan: "HFpEF history noted from cardiology records. Current primary care visit documents edema history and medication reconciliation, but no current diagnosis-specific heart failure assessment or diuretic adjustment was completed today.",
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
          assessment: ["HFpEF, chronic", "Continue carvedilol and furosemide"]
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
        support: "Patient reports exertional dyspnea and uses albuterol several times weekly. No fever, hemoptysis, or increased sputum today; maintenance inhaler use was reviewed.",
        plan: "COPD is listed in outside pulmonary records. Primary care medication list includes maintenance inhaler therapy, but active COPD severity and treatment plan should be confirmed during the upcoming visit.",
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
        support: "Patient reports low mood, reduced motivation, poor sleep, and social withdrawal over the last two months. PHQ-9 score is 15 and she denies active suicidal ideation.",
        plan: "Continue SSRI titration, safety plan reviewed, and follow up with integrated behavioral health in 4 weeks.",
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

function nextGeneratedIndex(data: SeedData) {
  return data.reviews.filter((review) => review.id.startsWith("gen-rev-")).length;
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

function generatedEvidenceMeta(scenarioCondition: ScenarioCondition, sourceType: EvidenceSourceType) {
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

export function buildGeneratedChart(data: SeedData, assignedUserId: string, calendarYear: number): GeneratedChartBundle {
  const index = nextGeneratedIndex(data);
  const scenario = scenarios[index % scenarios.length];
  const [first, last] = generatedNames[index % generatedNames.length];
  const clinic = data.clinics.find((item) => item.defaultAssigneeId === assignedUserId) ?? data.clinics[index % data.clinics.length];
  const provider = data.providers.find((item) => item.clinicId === clinic.id) ?? data.providers[index % data.providers.length];
  const payer = data.payers[index % data.payers.length];
  const patientId = `gen-pat-${String(index + 1).padStart(3, "0")}`;
  const reviewId = `gen-rev-${String(index + 1).padStart(3, "0")}`;
  const hasVisit = index % 4 !== 3;
  const visitDate = `${calendarYear}-08-${String(8 + (index % 12)).padStart(2, "0")}`;
  const noteDate = `${calendarYear}-06-18`;
  const labDate = `${calendarYear}-06-10`;
  const priorDate = `${calendarYear - 1}-10-20`;
  const patientName = `${first} ${last}`;
  const patient: Patient = {
    id: patientId,
    name: patientName,
    dob: `${1942 + (index % 12)}-${String((index % 9) + 1).padStart(2, "0")}-14`,
    memberId: `${payer.id.slice(6, 8).toUpperCase()}-${820000 + index}`,
    payerId: payer.id,
    demographicRaf: Number((0.33 + (index % 5) * 0.041).toFixed(3))
  };
  const conditionIds = scenario.conditions.map((condition) => `gen-cond-${String(index + 1).padStart(3, "0")}-${condition.suffix}`);
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
    appointmentId: hasVisit ? `gen-appt-${String(index + 1).padStart(3, "0")}` : undefined,
    conditionIds
  };
  const evidence = scenario.conditions.flatMap((scenarioCondition, conditionIndex): EvidencePassage[] => {
    const conditionId = conditionIds[conditionIndex];
    const prefix = `gen-ev-${String(index + 1).padStart(3, "0")}-${scenarioCondition.suffix}`;
    return [
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
        anchorId: `chart-${reviewId}-plan-${scenarioCondition.suffix}`,
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
        anchorId: `chart-${reviewId}-lab-${scenarioCondition.suffix}-0`,
        text: scenarioCondition.labResults.map((result) => `${result.component} ${result.value} ${result.unit}`.trim()).join("; "),
        exactText: scenarioCondition.labResults[0] ? `${scenarioCondition.labResults[0].component} ${scenarioCondition.labResults[0].value} ${scenarioCondition.labResults[0].unit}`.trim() : undefined,
        date: labDate,
        category: scenarioCondition.category,
        subtype: scenarioCondition.subtype,
        conditionIds: [conditionId],
        ...generatedEvidenceMeta(scenarioCondition, "labResultRow"),
        chartAnchor: { tab: "labs", itemId: `chart-${reviewId}-lab-${scenarioCondition.suffix}-0` }
      },
      {
        id: `${prefix}-claim`,
        reviewId,
        documentId: `gen-doc-${reviewId}-chart`,
        anchorId: `gen-claim-${reviewId}-${scenarioCondition.suffix}`,
        text: scenarioCondition.category === "prospective"
          ? `${priorDate} ${provider.name} annual wellness claim listed ${scenarioCondition.icd10}.`
          : `${noteDate} ${provider.name} office visit claim ${scenarioCondition.icd10 ? `listed ${scenarioCondition.icd10}` : "submitted without this diagnosis"}.`,
        date: scenarioCondition.category === "prospective" ? priorDate : noteDate,
        category: scenarioCondition.category,
        subtype: scenarioCondition.subtype,
        conditionIds: [conditionId],
        exactText: scenarioCondition.category === "prospective" ? `claim listed ${scenarioCondition.icd10}` : `claim ${scenarioCondition.icd10 ? `listed ${scenarioCondition.icd10}` : "submitted without this diagnosis"}`,
        ...generatedEvidenceMeta(scenarioCondition, "claimLine"),
        chartAnchor: { tab: "claims", itemId: `gen-claim-${reviewId}-${scenarioCondition.suffix}` }
      }
    ];
  });
  const evidenceByCondition = new Map(conditionIds.map((id) => [id, evidence.filter((item) => item.conditionIds.includes(id)).map((item) => item.id)]));
  const chartVitals = [
    vital(`chart-${reviewId}-vital-current`, noteDate, scenario.vitals, evidence.map((item) => item.id).filter((id) => id.endsWith("-hpi"))),
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
    const conditionId = conditionIds[conditionIndex];
    return {
      id: `chart-${reviewId}-problem-${scenarioCondition.suffix}`,
      diagnosis: scenarioCondition.description,
      code: scenarioCondition.icd10,
      status: scenarioCondition.problemStatus ?? "Active",
      dateAdded: `${calendarYear - 2}-02-${String(10 + conditionIndex).padStart(2, "0")}`,
      isHcc: true,
      evidenceIds: evidenceByCondition.get(conditionId)?.filter((id) => id.endsWith("-hpi")) ?? []
    };
  });
  const medications = scenario.conditions.map((scenarioCondition, conditionIndex): ChartMedication => {
    const conditionId = conditionIds[conditionIndex];
    return {
      ...scenarioCondition.medication,
      id: `chart-${reviewId}-med-${scenarioCondition.suffix}`,
      prescriber: provider.name,
      evidenceIds: evidenceByCondition.get(conditionId)?.filter((id) => id.endsWith("-hpi")) ?? []
    };
  });
  const imaging = scenario.conditions.map((scenarioCondition, conditionIndex): ChartImagingReport => {
    const conditionId = conditionIds[conditionIndex];
    return {
      ...scenarioCondition.imaging,
      id: `chart-${reviewId}-image-${scenarioCondition.suffix}`,
      date: conditionIndex === 0 ? `${calendarYear}-05-30` : `${calendarYear}-04-19`,
      evidenceIds: evidenceByCondition.get(conditionId)?.filter((id) => id.endsWith("-hpi")) ?? []
    };
  });
  const specialistNotes = scenario.conditions.map((scenarioCondition, conditionIndex): ChartSpecialistNote => {
    const conditionId = conditionIds[conditionIndex];
    return {
      ...scenarioCondition.specialist,
      id: `chart-${reviewId}-specialist-${scenarioCondition.suffix}`,
      date: conditionIndex === 0 ? `${calendarYear}-05-21` : `${calendarYear}-03-12`,
      evidenceIds: evidenceByCondition.get(conditionId)?.filter((id) => id.endsWith("-hpi")) ?? []
    };
  });
  const claims = scenario.conditions.map((scenarioCondition, conditionIndex): Claim => {
    const conditionId = conditionIds[conditionIndex];
    const workflow = conditionWorkflow(scenarioCondition.category);
    const currentYearClaim = workflow !== "prospective";
    return {
      id: `gen-claim-${reviewId}-${scenarioCondition.suffix}`,
      reviewId,
      dateOfService: currentYearClaim ? noteDate : priorDate,
      provider: provider.name,
      cptCode: currentYearClaim ? "99214" : "G0439",
      encounterType: currentYearClaim ? "Established patient office visit" : "Annual wellness visit / historical capture",
      payer: payer.name,
      supportSummary: currentYearClaim
        ? `${noteDate} office visit claim from ${provider.name}; ICD-10 codes: ${workflow === "codesNotOnClaim" ? "none for this condition" : scenarioCondition.icd10}.`
        : `${priorDate} historical claim from ${provider.name}; ICD-10 codes: ${scenarioCondition.icd10}.`,
      riskEligible: true,
      cptSourceEligible: true,
      providerTypeEligible: true,
      faceToFace: true,
      providerSignatureValid: true,
      icd10Codes: workflow === "codesNotOnClaim" ? [] : [scenarioCondition.icd10]
    };
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
        section(`chart-${reviewId}-claims`, claims.map((item) => `${item.dateOfService} ${item.provider} ${item.cptCode} ${item.icd10Codes.join(", ") || "No diagnosis on claim"}`).join("; "), evidence.filter((item) => item.id.endsWith("-claim")).map((item) => item.id))
      ]
    }
  ];
  const conditions = scenario.conditions.map((scenarioCondition, conditionIndex): Condition => {
    const conditionId = conditionIds[conditionIndex];
    const workflow = conditionWorkflow(scenarioCondition.category);
    const conditionEvidenceIds = evidenceByCondition.get(conditionId) ?? [];
    return {
      id: conditionId,
      reviewId,
      workflow,
      category: scenarioCondition.category,
      subtype: scenarioCondition.subtype,
      icd10: scenarioCondition.icd10,
      description: scenarioCondition.description,
      hcc: scenarioCondition.hcc,
      raf: scenarioCondition.raf,
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

export function appendGeneratedChartForAssignee(data: SeedData, assignedUserId: string, calendarYear: number): SeedData {
  const bundle = buildGeneratedChart(data, assignedUserId, calendarYear);
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
