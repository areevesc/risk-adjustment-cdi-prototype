import type {
  Category,
  Claim,
  Condition,
  EvidencePassage,
  Patient,
  PatientReview,
  SeedData,
  SourceDocument,
  UpcomingAppointment
} from "./types";

interface GeneratedChartBundle {
  patient: Patient;
  review: PatientReview;
  documents: SourceDocument[];
  evidence: EvidencePassage[];
  claim: Claim;
  conditions: Condition[];
  appointment?: UpcomingAppointment;
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

const scenarios = [
  {
    key: "diabetes-ckd",
    condition: ["E11.22", "Type 2 DM with diabetic chronic kidney disease", "HCC 328", 0.299, "potentialAddition" as Category],
    support: "A1c 8.4%, eGFR 41, urine albumin/creatinine ratio 186 mg/g, and metformin dose adjustment reviewed.",
    plan: "Continue renal-dose medication review, repeat microalbumin in 3 months, and reinforce sick-day guidance.",
    meds: "Metformin ER 500 mg daily, lisinopril 20 mg daily, atorvastatin 40 mg nightly.",
    problem: "Type 2 diabetes mellitus with chronic kidney disease",
    lab: "HbA1c 8.4%; creatinine 1.42 mg/dL; eGFR 41 mL/min; UACR 186 mg/g.",
    imaging: "Renal ultrasound: chronic medical renal disease without hydronephrosis."
  },
  {
    key: "heart-failure",
    condition: ["I50.32", "Chronic diastolic heart failure", "HCC 222", 0.323, "prospective" as Category],
    support: "Cardiology note documents HFpEF, BNP 412 pg/mL, ankle edema, and furosemide titration.",
    plan: "Monitor daily weights, continue beta blocker, adjust diuretic for edema, and request provider assessment at visit.",
    meds: "Furosemide 40 mg daily, carvedilol 12.5 mg twice daily, potassium chloride 10 mEq daily.",
    problem: "Chronic diastolic heart failure",
    lab: "BNP 412 pg/mL; potassium 4.1 mmol/L; creatinine 1.18 mg/dL.",
    imaging: "Echo: EF 58%, grade II diastolic dysfunction, mild left atrial enlargement."
  },
  {
    key: "copd",
    condition: ["J44.9", "Chronic obstructive pulmonary disease", "HCC 280", 0.214, "prospective" as Category],
    support: "Pulmonology note documents COPD with exertional dyspnea, albuterol use, and prior spirometry obstruction.",
    plan: "Continue LAMA/LABA inhaler, review rescue inhaler use, and confirm active COPD status during upcoming visit.",
    meds: "Tiotropium-olodaterol inhaler daily, albuterol HFA as needed.",
    problem: "Chronic obstructive pulmonary disease",
    lab: "Oxygen saturation 93% on room air; CO2 31 mmol/L.",
    imaging: "Chest CT: hyperinflation and emphysematous change; no acute infiltrate."
  },
  {
    key: "depression",
    condition: ["F33.1", "Major depressive disorder, recurrent, moderate", "HCC 155", 0.291, "potentialAddition" as Category],
    support: "Behavioral health note documents recurrent MDD with PHQ-9 score 15 and sertraline dose increase.",
    plan: "Continue SSRI titration, safety plan reviewed, follow up with integrated behavioral health in 4 weeks.",
    meds: "Sertraline 100 mg daily, trazodone 50 mg at bedtime as needed.",
    problem: "Major depressive disorder, recurrent, moderate",
    lab: "TSH 2.8 uIU/mL; vitamin B12 402 pg/mL; CMP without acute metabolic driver.",
    imaging: "No acute neuroimaging in current year."
  }
] as const;

function section(id: string, text: string, evidenceIds: string[] = []) {
  return { id, text, evidenceIds };
}

function nextGeneratedIndex(data: SeedData) {
  return data.reviews.filter((review) => review.id.startsWith("gen-rev-")).length;
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
  const conditionId = `gen-cond-${String(index + 1).padStart(3, "0")}`;
  const evidenceId = `gen-ev-${String(index + 1).padStart(3, "0")}`;
  const hasVisit = index % 4 !== 3;
  const visitDate = `${calendarYear}-08-${String(8 + (index % 12)).padStart(2, "0")}`;
  const patient: Patient = {
    id: patientId,
    name: `${first} ${last}`,
    dob: `${1942 + (index % 12)}-${String((index % 9) + 1).padStart(2, "0")}-14`,
    memberId: `${payer.id.slice(6, 8).toUpperCase()}-${820000 + index}`,
    payerId: payer.id,
    demographicRaf: Number((0.33 + (index % 5) * 0.041).toFixed(3))
  };
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
    conditionIds: [conditionId]
  };
  const category = scenario.condition[4];
  const workflow = category === "potentialAddition" ? "codesNotOnClaim" : "prospective";
  const documents: SourceDocument[] = [
    {
      id: `gen-doc-${reviewId}-progress`,
      reviewId,
      type: "Progress Note",
      title: `${calendarYear} primary care progress note`,
      date: `${calendarYear}-06-18`,
      isCurrentYear: true,
      cptSourceEligible: true,
      providerTypeEligible: true,
      faceToFace: true,
      providerSignatureValid: true,
      sections: [
        section(`gen-sec-${reviewId}-cc`, "Chief complaint: chronic care follow-up before scheduled risk adjustment review."),
        section(`gen-sec-${reviewId}-hpi`, `HPI: ${patient.name} returns for longitudinal review. ${scenario.support}`, [evidenceId]),
        section(`gen-sec-${reviewId}-ros`, "Review of systems: denies fever; reports stable appetite; symptoms reviewed by organ system."),
        section(`gen-sec-${reviewId}-exam`, "Physical exam: alert, no acute distress, cardiopulmonary and extremity findings documented."),
        section(`gen-sec-${reviewId}-ap`, `Assessment and plan: ${scenario.plan}`, [evidenceId])
      ]
    },
    {
      id: `gen-doc-${reviewId}-labs`,
      reviewId,
      type: "Lab",
      title: `${calendarYear} laboratory results`,
      date: `${calendarYear}-06-10`,
      isCurrentYear: true,
      sections: [section(`gen-sec-${reviewId}-lab`, scenario.lab, [evidenceId])]
    },
    {
      id: `gen-doc-${reviewId}-chart`,
      reviewId,
      type: "Registry",
      title: "Problem list, PMH, medications, imaging, and claims snapshot",
      date: `${calendarYear}-06-18`,
      isCurrentYear: true,
      sections: [
        section(`gen-sec-${reviewId}-problem`, `Problem list: ${scenario.problem}; hypertension; hyperlipidemia.`),
        section(`gen-sec-${reviewId}-pmh`, "Past medical history: Medicare Advantage member with chronic disease follow-up and prior specialty care."),
        section(`gen-sec-${reviewId}-meds`, `Medications: ${scenario.meds}`, [evidenceId]),
        section(`gen-sec-${reviewId}-imaging`, `Imaging: ${scenario.imaging}`),
        section(`gen-sec-${reviewId}-claims`, `Claims: ${calendarYear}-06-18 ${provider.name} CPT 99214 with diagnosis support reviewed for ${payer.name}.`, [evidenceId])
      ]
    }
  ];
  const evidence: EvidencePassage[] = [
    {
      id: evidenceId,
      reviewId,
      documentId: `gen-doc-${reviewId}-progress`,
      anchorId: `gen-sec-${reviewId}-hpi`,
      sectionId: `gen-sec-${reviewId}-hpi`,
      text: scenario.support,
      exactText: scenario.support,
      date: `${calendarYear}-06-18`,
      category,
      subtype: workflow === "prospective" ? "recapture" : undefined,
      conditionIds: [conditionId],
      summary: `${scenario.condition[1]} support in generated chart`
    }
  ];
  const claim: Claim = {
    id: `gen-claim-${reviewId}`,
    reviewId,
    dateOfService: `${calendarYear}-06-18`,
    provider: provider.name,
    cptCode: "99214",
    encounterType: "Established patient office visit",
    payer: payer.name,
    supportSummary: scenario.support,
    riskEligible: true,
    cptSourceEligible: true,
    providerTypeEligible: true,
    faceToFace: true,
    providerSignatureValid: true,
    icd10Codes: workflow === "codesNotOnClaim" ? [] : [scenario.condition[0]]
  };
  const condition: Condition = {
    id: conditionId,
    reviewId,
    workflow,
    category,
    subtype: workflow === "prospective" ? "recapture" : undefined,
    icd10: scenario.condition[0],
    description: scenario.condition[1],
    hcc: scenario.condition[2],
    raf: scenario.condition[3],
    claimStatus: workflow === "codesNotOnClaim" ? "Not on claim" : "Historical",
    sourceDate: `${calendarYear}-06-18`,
    evidenceIds: [evidenceId],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: workflow === "codesNotOnClaim",
    hasOtherSupportingEvidence: true,
    hadPriorCapture: workflow === "prospective",
    hasCurrentYearCapture: workflow !== "prospective",
    hasClinicalIndicators: true,
    seededRecommendation: {
      action: workflow === "codesNotOnClaim" ? "Add to Claim" : "Yes",
      confidence: "Medium",
      source: "seeded",
      rationale: "Generated synthetic EMR evidence supports reviewer action in this demo chart."
    },
    documentationIssues: []
  };
  const appointment: UpcomingAppointment | undefined = hasVisit
    ? { id: review.appointmentId!, patientId, providerId: provider.id, date: visitDate, type: "Pre-visit chronic care review" }
    : undefined;

  return { patient, review, documents, evidence, claim, conditions: [condition], appointment };
}

export function appendGeneratedChartForAssignee(data: SeedData, assignedUserId: string, calendarYear: number): SeedData {
  const bundle = buildGeneratedChart(data, assignedUserId, calendarYear);
  return {
    ...data,
    patients: [...data.patients, bundle.patient],
    reviews: [...data.reviews, bundle.review],
    documents: [...data.documents, ...bundle.documents],
    evidence: [...data.evidence, ...bundle.evidence],
    claims: [...data.claims, bundle.claim],
    conditions: [...data.conditions, ...bundle.conditions],
    appointments: bundle.appointment ? [...data.appointments, bundle.appointment] : data.appointments
  };
}
