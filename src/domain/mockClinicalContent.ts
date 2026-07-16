import type { Category, ChartImagingReport, ChartLabResult, ChartMedication, Condition, EvidencePassage, EvidenceSourceType, EvidenceStrength, MeatType } from "./types";

export interface ClinicalConditionProfile {
  hpi: string;
  plan: string;
  weakMention: string;
  currentVitals?: { weightPounds: number; heightInches: number };
  labResults: Omit<ChartLabResult, "id" | "evidenceIds">[];
  medication: Omit<ChartMedication, "id" | "evidenceIds">;
  imaging: Omit<ChartImagingReport, "id" | "date" | "evidenceIds">;
  specialist: {
    specialty: string;
    provider: string;
    title: string;
    note: string;
    assessment: string[];
  };
  pmh: string;
  ros: string[];
  exam: Array<{ system: string; text: string }>;
}

export interface EvidenceClinicalProfile {
  text: string;
  exactText: string;
  summary: string;
  sourceType: EvidenceSourceType;
  sourceLocation: string;
  evidenceStrength: EvidenceStrength;
  meatType?: MeatType[];
  currentYearSupport: boolean;
  historicalOnly?: boolean;
  suspectOnly?: boolean;
  recaptureOnly?: boolean;
  reviewerExplanation: string;
  chartAnchor?: EvidencePassage["chartAnchor"];
}

const defaultLabs: Omit<ChartLabResult, "id" | "evidenceIds">[] = [
  { component: "Glucose", value: "128", unit: "mg/dL", referenceRange: "70-99", flag: "abnormal" },
  { component: "Creatinine", value: "1.18", unit: "mg/dL", referenceRange: "0.60-1.20", flag: "normal" }
];

function defaultProfile(condition: Condition): ClinicalConditionProfile {
  return {
    hpi: "Patient returns for follow-up of chronic medical conditions. Medication list, interval symptoms, and outside-office updates were discussed with the patient.",
    plan: "Medication list reconciled. Continue current chronic medications, request outside records when needed, and schedule routine follow-up.",
    weakMention: `${condition.description} remains on the medical history. Outside records were requested for reconciliation, and no medication changes were made today.`,
    labResults: defaultLabs,
    medication: { name: "Atorvastatin", dose: "40 mg", route: "PO", frequency: "nightly", prescriber: "" },
    imaging: {
      type: "Longitudinal imaging summary",
      indication: "Chronic condition surveillance",
      findings: "No acute imaging finding is documented for this diagnosis in the current encounter.",
      impression: ["No acute imaging abnormality identified for this diagnosis."]
    },
    specialist: {
      specialty: "External chart",
      provider: "Consulting Specialist",
      title: "External documentation note",
      note: `Older outside records list ${condition.description}. Interval status was not discussed at today's primary care visit.`,
      assessment: ["Diagnosis listed in outside records", "Interval status pending record reconciliation"]
    },
    pmh: `${condition.description} in past medical history.`,
    ros: ["Constitutional: no fever or acute weight loss.", "Cardiovascular: no syncope.", "Respiratory: no acute distress."],
    exam: [
      { system: "General", text: "Alert, conversant, no acute distress." },
      { system: "Cardiovascular", text: "Regular rhythm without acute decompensation." },
      { system: "Respiratory", text: "No accessory muscle use." }
    ]
  };
}

export function clinicalProfileForCondition(condition: Condition): ClinicalConditionProfile {
  const text = `${condition.icd10} ${condition.description}`.toLowerCase();
  const diabetesText = text.includes("diabetes") || text.includes("diabetic") || text.includes("dm");
  if (diabetesText && (text.includes("kidney") || text.includes("ckd"))) {
    return {
      hpi: "Home glucose logs remain variable. Patient reports taking metformin ER daily but misses evening insulin about twice weekly; renal labs were reviewed during the visit.",
      plan: "A1c 8.4%, eGFR 41, creatinine 1.42, and urine albumin/creatinine ratio 186 mg/g reviewed. Continue metformin ER 500 mg daily given renal function, increase basal insulin to 18 units nightly, continue lisinopril for renal protection, avoid NSAIDs, repeat A1c/BMP/urine microalbumin in 3 months, and review glucose log at follow-up.",
      weakMention: "Type 2 diabetes with kidney disease appears on the active problem list.",
      labResults: [
        { component: "HbA1c", value: "8.4", unit: "%", referenceRange: "4.0-5.6", flag: "abnormal" },
        { component: "Estimated GFR", value: "41", unit: "mL/min", referenceRange: ">60", flag: "abnormal" },
        { component: "Creatinine", value: "1.42", unit: "mg/dL", referenceRange: "0.60-1.20", flag: "abnormal" },
        { component: "Urine Albumin/Creatinine Ratio", value: "186", unit: "mg/g", referenceRange: "<30", flag: "abnormal" }
      ],
      medication: { name: "Metformin ER", dose: "500 mg", route: "PO", frequency: "daily", prescriber: "" },
      imaging: {
        type: "Renal Ultrasound",
        indication: "Diabetic kidney disease surveillance",
        findings: "Mild bilateral cortical thinning with increased echogenicity is present, compatible with chronic medical renal disease. No hydronephrosis.",
        impression: ["Bilateral cortical echogenicity consistent with chronic kidney disease.", "No obstruction."]
      },
      specialist: {
        specialty: "Nephrology",
        provider: "Renee Cole, MD",
        title: "Nephrology follow-up",
        note: "Diabetic chronic kidney disease stage 3b reviewed with persistent albuminuria despite ACE inhibitor therapy.",
        assessment: ["Type 2 diabetes with chronic kidney disease", "Continue renal-protective therapy and repeat labs"]
      },
      pmh: "Type 2 diabetes mellitus with diabetic kidney disease for more than 10 years.",
      ros: ["Endocrine: variable home glucose readings without severe hypoglycemia.", "Genitourinary: no dysuria or obstruction symptoms.", "Neurologic: chronic foot sensory symptoms reviewed."],
      exam: [
        { system: "General", text: "Alert, no acute distress." },
        { system: "Extremities", text: "No foot ulceration; diminished monofilament sensation at plantar feet." },
        { system: "Cardiovascular", text: "Trace ankle edema, pulses palpable." }
      ]
    };
  }
  if (diabetesText && (text.includes("neuropathy") || text.includes("polyneuropathy"))) {
    return {
      hpi: "Patient reports burning and numbness in both feet, worse at night. Monofilament testing is reduced bilaterally and patient denies new foot ulceration.",
      plan: "Burning and numbness in both feet remain active. Continue gabapentin 300 mg three times daily, reinforce daily foot inspection, order podiatry follow-up, review fall precautions, and optimize glycemic control with repeat A1c in 3 months.",
      weakMention: "Diabetic neuropathy appears on the problem list and in prior podiatry records.",
      labResults: [
        { component: "HbA1c", value: "8.1", unit: "%", referenceRange: "4.0-5.6", flag: "abnormal" },
        { component: "Vitamin B12", value: "388", unit: "pg/mL", referenceRange: "232-1245", flag: "normal" }
      ],
      medication: { name: "Gabapentin", dose: "300 mg", route: "PO", frequency: "TID", prescriber: "" },
      imaging: {
        type: "Foot exam documentation",
        indication: "Diabetic neuropathy surveillance",
        findings: "No active ulceration. Protective sensation reduced at bilateral plantar feet.",
        impression: ["Peripheral sensory loss consistent with diabetic neuropathy."]
      },
      specialist: {
        specialty: "Podiatry",
        provider: "Mira Santos, DPM",
        title: "Podiatry diabetic foot visit",
        note: "Protective sensation reduced bilaterally; nail care performed and diabetic footwear reviewed.",
        assessment: ["Diabetic peripheral neuropathy", "Continue foot surveillance"]
      },
      pmh: "Type 2 diabetes with neuropathic symptoms in both feet.",
      ros: ["Neurologic: numbness and burning in both feet.", "Skin: no new ulcer or drainage.", "Endocrine: glucose variability reviewed."],
      exam: [
        { system: "Neurologic", text: "Diminished sensation to monofilament testing at bilateral plantar feet." },
        { system: "Skin", text: "Feet intact without ulceration." },
        { system: "Extremities", text: "No acute edema or cellulitis." }
      ]
    };
  }
  if (condition.icd10 === "E11.51") {
    return {
      hpi: "Patient reports exertional calf discomfort without rest pain. Pedal pulses are diminished bilaterally; no gangrene or active ulcer is present.",
      plan: "Diabetic peripheral angiopathy without gangrene remains active. Continue statin and antiplatelet therapy, reinforce foot protection, obtain ankle-brachial indices, and follow vascular medicine.",
      weakMention: "Diabetic peripheral angiopathy appears in the vascular problem list.",
      labResults: [],
      medication: { name: "Aspirin", dose: "81 mg", route: "PO", frequency: "daily", prescriber: "" },
      imaging: {
        type: "Lower-extremity arterial duplex",
        indication: "Diabetic peripheral angiopathy assessment",
        findings: "Reduced distal arterial flow without occlusion; ankle-brachial indices are abnormal bilaterally.",
        impression: ["Peripheral arterial disease without gangrene."]
      },
      specialist: {
        specialty: "Vascular Medicine",
        provider: "Rina Shah, MD",
        title: "Vascular follow-up",
        note: "Diabetic peripheral angiopathy without gangrene reviewed with abnormal pedal pulses and ABI results.",
        assessment: ["Diabetic peripheral angiopathy without gangrene", "Continue vascular risk reduction"]
      },
      pmh: "Type 2 diabetes with peripheral angiopathy without gangrene.",
      ros: ["Vascular: exertional calf discomfort without rest pain.", "Skin: no ulcer or gangrene."],
      exam: [
        { system: "Vascular", text: "Dorsalis pedis pulses diminished bilaterally; feet remain warm." },
        { system: "Skin", text: "No gangrene or active ulcer." }
      ]
    };
  }
  if (condition.icd10 === "E11.621") {
    return {
      hpi: "Patient has an active plantar foot ulcer managed by wound care. Drainage and off-loading adherence were reviewed; no fever is reported.",
      plan: "Type 2 diabetes with foot ulcer remains active. Continue wound dressings and off-loading, optimize glycemic control, and return to podiatry and wound care within one week.",
      weakMention: "Diabetic foot ulcer appears in the wound-care problem list.",
      labResults: [{ component: "HbA1c", value: "8.2", unit: "%", referenceRange: "4.0-5.6", flag: "abnormal" }],
      medication: { name: "Collagen wound dressing", dose: "Apply to ulcer", route: "Topical", frequency: "daily", prescriber: "" },
      imaging: {
        type: "Foot radiograph",
        indication: "Active diabetic plantar ulcer",
        findings: "Soft-tissue ulcer is present without radiographic osteomyelitis.",
        impression: ["Plantar soft-tissue ulcer; no acute osseous destruction."]
      },
      specialist: {
        specialty: "Podiatry",
        provider: "Mira Santos, DPM",
        title: "Wound-care follow-up",
        note: "Active diabetic plantar ulcer was measured, dressed, and off-loaded.",
        assessment: ["Type 2 diabetes with foot ulcer", "Continue weekly wound care"]
      },
      pmh: "Type 2 diabetes with recurrent foot ulcer.",
      ros: ["Skin: active plantar ulcer with limited drainage.", "Constitutional: no fever."],
      exam: [
        { system: "Skin", text: "Plantar ulcer with clean base; no spreading cellulitis." },
        { system: "Neurologic", text: "Protective sensation is reduced." }
      ]
    };
  }
  if (diabetesText && !text.includes("macular") && !text.includes("retinopathy") && !text.includes("eye")) {
    return {
      hpi: "Home glucose logs remain above goal with several fasting readings in the 160-190 mg/dL range. Patient reports taking metformin consistently but occasionally misses evening insulin.",
      plan: "A1c is 8.4%, above goal. Continue metformin ER 500 mg daily, increase basal insulin to 18 units nightly, review hypoglycemia precautions, repeat A1c in 3 months, and bring glucose log to follow-up.",
      weakMention: "Type 2 diabetes appears on the active problem list without a complete management plan.",
      labResults: [
        { component: "HbA1c", value: "8.4", unit: "%", referenceRange: "4.0-5.6", flag: "abnormal" },
        { component: "Glucose", value: "182", unit: "mg/dL", referenceRange: "70-99", flag: "abnormal" }
      ],
      medication: { name: "Metformin ER", dose: "500 mg", route: "PO", frequency: "daily", prescriber: "" },
      imaging: {
        type: "Diabetes foot exam",
        indication: "Diabetes surveillance",
        findings: "No active foot ulceration. Skin intact with palpable pulses.",
        impression: ["Diabetes surveillance exam without acute ulceration."]
      },
      specialist: {
        specialty: "Endocrinology",
        provider: "Nora Wells, MD",
        title: "Endocrinology interval note",
        note: "Type 2 diabetes remains above glycemic goal with insulin titration and glucose-log review.",
        assessment: ["Type 2 diabetes mellitus with hyperglycemia", "Continue medication titration and A1c monitoring"]
      },
      pmh: "Type 2 diabetes mellitus treated with oral medication and basal insulin.",
      ros: ["Endocrine: glucose readings remain above goal without severe hypoglycemia.", "Neurologic: no acute focal weakness.", "Skin: no new foot ulceration."],
      exam: [
        { system: "General", text: "Alert, no acute distress." },
        { system: "Skin", text: "Feet intact without ulceration." },
        { system: "Neurologic", text: "No acute focal deficit." }
      ]
    };
  }
  if (text.includes("macular") || text.includes("eye")) {
    return {
      hpi: "Patient reports no acute vision loss today. Diabetes follow-up continues in primary care, and outside ophthalmology records were requested for interval retinal treatment history.",
      plan: "No acute visual change is reported today. Continue glucose management, request the most recent ophthalmology note, and defer retinal treatment decisions to ophthalmology.",
      weakMention: "Registry lists diabetic eye disease history without current primary care assessment.",
      labResults: [{ component: "HbA1c", value: "8.1", unit: "%", referenceRange: "4.0-5.6", flag: "abnormal" }],
      medication: { name: "Insulin glargine", dose: "18 units", route: "SC", frequency: "nightly", prescriber: "" },
      imaging: {
        type: "Ophthalmology retinal imaging",
        indication: "Diabetic retinopathy surveillance",
        findings: "Retinal imaging from prior ophthalmology visit showed macular thickening in the right eye.",
        impression: ["Prior diabetic macular edema documented by ophthalmology.", "Primary care note does not document current retinal treatment status."]
      },
      specialist: {
        specialty: "Ophthalmology",
        provider: "Lena Wu, MD",
        title: "Ophthalmology note",
        note: "Diabetic macular edema present OD in prior documentation; anti-VEGF injection administered at previous visit.",
        assessment: ["Diabetic macular edema, right eye", "Need current status confirmation"]
      },
      pmh: "Diabetic eye disease history in external ophthalmology records.",
      ros: ["Eyes: no acute vision loss reported to primary care.", "Endocrine: diabetes follow-up continues."],
      exam: [
        { system: "Eyes", text: "No acute conjunctival injection; detailed retinal exam deferred to ophthalmology." },
        { system: "General", text: "Alert and cooperative." }
      ]
    };
  }
  if (text.includes("chronic kidney") || text.includes("end stage renal") || text.includes("ckd")) {
    const stage4 = text.includes("stage 4") || text.includes("n18.4");
    const egfr = stage4 ? "24" : "38";
    const creatinine = stage4 ? "2.31" : "1.56";
    return {
      hpi: "Renal function trend reviewed. Patient avoids NSAIDs and reports no urinary obstruction symptoms; medication dosing was reviewed against most recent eGFR.",
      plan: `eGFR ${egfr}, creatinine ${creatinine}, and urine albumin/creatinine ratio 212 mg/g reviewed. Continue ACE inhibitor, avoid nephrotoxins, renal-dose medications, repeat BMP and urine microalbumin in 3 months, and continue nephrology co-management.`,
      weakMention: "CKD appears on past medical history and problem list.",
      labResults: [
        { component: "Estimated GFR", value: egfr, unit: "mL/min", referenceRange: ">60", flag: "abnormal" },
        { component: "Creatinine", value: creatinine, unit: "mg/dL", referenceRange: "0.60-1.20", flag: "abnormal" },
        { component: "Urine Albumin/Creatinine Ratio", value: "212", unit: "mg/g", referenceRange: "<30", flag: "abnormal" }
      ],
      medication: { name: "Lisinopril", dose: "20 mg", route: "PO", frequency: "daily", prescriber: "" },
      imaging: {
        type: "Renal Ultrasound",
        indication: "Chronic kidney disease surveillance",
        findings: "Mild diffuse increased renal cortical echogenicity without hydronephrosis or mass.",
        impression: ["Chronic medical renal disease.", "No obstructive uropathy."]
      },
      specialist: {
        specialty: "Nephrology",
        provider: "Renee Cole, MD",
        title: "Nephrology interval note",
        note: "CKD stage and albuminuria reviewed; renal-dose medications and avoidance of NSAIDs reinforced.",
        assessment: [stage4 ? "Chronic kidney disease, stage 4" : "Chronic kidney disease", "Continue renal monitoring"]
      },
      pmh: "Chronic kidney disease followed by nephrology.",
      ros: ["Genitourinary: no dysuria or flank pain.", "Constitutional: fatigue stable.", "Cardiovascular: edema reviewed."],
      exam: [
        { system: "Cardiovascular", text: "Trace ankle edema." },
        { system: "Abdomen", text: "Soft and nontender without flank tenderness." },
        { system: "General", text: "No acute distress." }
      ]
    };
  }
  if (text.includes("heart failure") || text.includes("hfpef") || text.includes("hfr")) {
    return {
      hpi: "Patient reports dyspnea on exertion and intermittent ankle edema. Daily weights fluctuate by 2 to 3 lb with higher sodium intake; no chest pain reported today.",
      plan: "Exertional dyspnea and intermittent ankle edema remain stable. Continue carvedilol and furosemide, reinforce sodium restriction and daily weights, check BMP/BNP, review echo, adjust diuretic for edema, and continue cardiology follow-up in 3 months.",
      weakMention: "Heart failure appears in prior-year claim history and cardiology problem list.",
      labResults: [
        { component: "BNP", value: "412", unit: "pg/mL", referenceRange: "<100", flag: "abnormal" },
        { component: "Potassium", value: "4.2", unit: "mmol/L", referenceRange: "3.5-5.1", flag: "normal" }
      ],
      medication: { name: "Furosemide", dose: "40 mg", route: "PO", frequency: "daily", prescriber: "" },
      imaging: {
        type: "Echocardiogram",
        indication: "Dyspnea and edema",
        findings: "EF 58% with grade II diastolic dysfunction and mild left atrial enlargement. No pericardial effusion.",
        impression: ["Preserved systolic function.", "Diastolic dysfunction consistent with HFpEF history."]
      },
      specialist: {
        specialty: "Cardiology",
        provider: "Caleb Morris, MD",
        title: "Cardiology follow-up",
        note: "Chronic diastolic heart failure remains stable with intermittent edema responsive to diuretic titration.",
        assessment: ["HFpEF, chronic", "Continue carvedilol, furosemide, sodium restriction, and daily weights"]
      },
      pmh: "Heart failure followed by cardiology.",
      ros: ["Cardiovascular: intermittent edema and exertional dyspnea.", "Respiratory: no acute cough or hemoptysis.", "Constitutional: weight trend reviewed."],
      exam: [
        { system: "Cardiovascular", text: "Regular rhythm; trace bilateral ankle edema." },
        { system: "Respiratory", text: "Faint bibasilar crackles without respiratory distress." },
        { system: "Extremities", text: "Warm, perfused, no calf tenderness." }
      ]
    };
  }
  if (text.includes("copd") || text.includes("obstructive pulmonary")) {
    return {
      hpi: "Patient reports chronic exertional dyspnea and uses albuterol several times weekly. No fever or hemoptysis; inhaler technique reviewed.",
      plan: "Chronic exertional dyspnea is unchanged, with albuterol use several times weekly. Continue LAMA/LABA maintenance inhaler, refill albuterol rescue inhaler, review inhaler technique, update pneumococcal/influenza vaccines, monitor oxygen saturation, and follow pulmonology if dyspnea worsens.",
      weakMention: "COPD appears in prior-year pulmonary note and claims history.",
      labResults: [{ component: "CO2", value: "31", unit: "mmol/L", referenceRange: "22-30", flag: "abnormal" }],
      medication: { name: "Tiotropium-olodaterol", dose: "2 inhalations", route: "Inhaled", frequency: "daily", prescriber: "" },
      imaging: {
        type: "CT Chest",
        indication: "COPD follow-up",
        findings: "Moderate upper-lobe predominant centrilobular emphysema with mild diffuse bronchial wall thickening. No focal consolidation.",
        impression: ["COPD/emphysematous change.", "No acute pneumonia."]
      },
      specialist: {
        specialty: "Pulmonology",
        provider: "Ira Nash, DO",
        title: "Pulmonology follow-up",
        note: "COPD remains active with dyspnea on exertion and rescue inhaler use several times weekly.",
        assessment: ["COPD, active", "Continue maintenance inhaler and rescue inhaler plan"]
      },
      pmh: "COPD with prior spirometry obstruction.",
      ros: ["Respiratory: exertional dyspnea and intermittent wheeze.", "Constitutional: no fever.", "Cardiovascular: no syncope."],
      exam: [
        { system: "Respiratory", text: "Mildly diminished breath sounds without accessory muscle use." },
        { system: "General", text: "Speaking in full sentences." },
        { system: "Cardiovascular", text: "Regular rhythm." }
      ]
    };
  }
  if (text.includes("depress") || text.includes("mdd")) {
    return {
      hpi: "Patient reports low mood, poor sleep, low motivation, and social withdrawal over the last two months. PHQ-9 score is 15; denies active suicidal ideation.",
      plan: "PHQ-9 is 15 with persistent low mood, poor sleep, and low motivation. Increase sertraline to 100 mg daily, continue counseling, review safety plan and crisis resources, check TSH/B12/Vitamin D, and follow up with integrated behavioral health in 4 weeks.",
      weakMention: "Depression appears in behavioral health history.",
      labResults: [
        { component: "PHQ-9", value: "15", unit: "score", referenceRange: "0-4 minimal", flag: "abnormal" },
        { component: "TSH", value: "2.8", unit: "uIU/mL", referenceRange: "0.45-4.50", flag: "normal" }
      ],
      medication: { name: "Sertraline", dose: "100 mg", route: "PO", frequency: "daily", prescriber: "" },
      imaging: {
        type: "Behavioral Health Assessment",
        indication: "Depression monitoring",
        findings: "PHQ-9 score of 15 with sleep disruption, low motivation, and no active suicidal ideation.",
        impression: ["Moderate recurrent depressive symptoms.", "No acute safety concern documented."]
      },
      specialist: {
        specialty: "Behavioral Health",
        provider: "Lana Price, LCSW",
        title: "Behavioral health note",
        note: "Recurrent moderate depression documented with PHQ-9 score 15, reduced motivation, and medication titration.",
        assessment: ["Major depressive disorder, recurrent, moderate", "Continue medication and counseling"]
      },
      pmh: "Major depressive disorder with behavioral health follow-up.",
      ros: ["Psychiatric: low mood, poor sleep, low motivation.", "Constitutional: energy decreased.", "Neurologic: no acute focal deficit."],
      exam: [
        { system: "Psychiatric", text: "Affect constricted but cooperative; thought process linear." },
        { system: "General", text: "Alert and oriented." },
        { system: "Neurologic", text: "No acute focal deficit." }
      ]
    };
  }
  if (text.includes("obesity") || text.includes("bmi")) {
    const historicalOnlyMeasurement = Boolean(condition.conflictingEvidence || condition.resolvedFlag);
    const weightPounds = historicalOnlyMeasurement ? 189 : 260;
    const bmi = historicalOnlyMeasurement ? "31.4" : "43.3";
    return {
      hpi: historicalOnlyMeasurement
        ? "Current weight is 189 lb at 65 in (BMI 31.4). The prior record listing morbid obesity was reviewed for reconciliation."
        : "Weight remains elevated with limited activity from knee pain and poor stamina. Nutrition adherence and medication tolerance reviewed.",
      plan: `BMI is ${bmi} today. Continue structured nutrition counseling, review activity plan, discuss medication tolerance, and follow the weight trend in 8 weeks.`,
      weakMention: historicalOnlyMeasurement
        ? "Prior records list morbid obesity; current measurements are 189 lb at 65 in (BMI 31.4)."
        : "Obesity appears in PMH and vitals show elevated BMI.",
      currentVitals: { weightPounds, heightInches: 65 },
      labResults: [],
      medication: { name: "Semaglutide", dose: "0.5 mg", route: "SC", frequency: "weekly", prescriber: "" },
      imaging: {
        type: "Sleep Study",
        indication: "Obesity and daytime somnolence",
        findings: "Apnea-hypopnea index 38 events per hour with oxygen nadir 82%.",
        impression: ["Severe obstructive sleep apnea."]
      },
      specialist: {
        specialty: "Nutrition",
        provider: "Erin Knox, RD",
        title: "Nutrition counseling note",
        note: "Portion control, protein goals, sodium intake, and gradual activity plan reviewed.",
        assessment: ["Morbid obesity", "Continue structured weight-management plan"]
      },
      pmh: "Morbid obesity with sleep apnea and cardiometabolic comorbidities.",
      ros: ["Constitutional: fatigue and poor stamina.", "Respiratory: daytime somnolence with CPAP inconsistency.", "Musculoskeletal: knee pain limits walking."],
      exam: [
        { system: "General", text: "Body habitus notable for central obesity." },
        { system: "Respiratory", text: "No acute distress." },
        { system: "Musculoskeletal", text: "Bilateral knee crepitus without acute effusion." }
      ]
    };
  }
  if (text.includes("hypertension") || text.includes("i10")) {
    return {
      ...defaultProfile(condition),
      hpi: "Blood pressure readings were reviewed. Patient reports taking lisinopril but does not bring a home log.",
      plan: "Blood pressure 128/78 in office. Continue lisinopril, reinforce low-sodium diet, and ask patient to bring home BP readings to next visit.",
      weakMention: "Essential hypertension appears on the active problem list.",
      labResults: [],
      medication: { name: "Lisinopril", dose: "20 mg", route: "PO", frequency: "daily", prescriber: "" },
      pmh: "Essential hypertension."
    };
  }
  return defaultProfile(condition);
}

export function evidenceStrengthLabel(strength?: EvidenceStrength) {
  switch (strength) {
    case "strongCurrentYearMEAT":
      return "Strong current-year MEAT";
    case "assessmentWithPlan":
      return "Assessment with plan";
    case "assessmentWithoutPlan":
      return "Assessment without plan";
    case "treatmentEvidence":
      return "Treatment evidence";
    case "monitoringEvidence":
      return "Monitoring evidence";
    case "evaluationEvidence":
      return "Evaluation evidence";
    case "weakMentionOnly":
      return "Mention only";
    case "problemListOnly":
      return "Problem list only";
    case "pmhOnly":
      return "PMH only";
    case "historicalClaimOnly":
      return "Historical claim only";
    case "clinicalIndicatorOnly":
      return "Clinical indicator only";
    case "labIndicatorOnly":
      return "Lab indicator only";
    case "imagingIndicatorOnly":
      return "Imaging indicator only";
    case "specialistHistoricalOnly":
      return "Specialist historical only";
    case "historicalOnly":
      return "Historical only";
    case "suspect":
      return "Suspect";
    case "recapture":
      return "Recapture";
    case "conflicting":
      return "Conflicting";
    case "unsupported":
      return "Unsupported";
    default:
      return "Evidence";
  }
}

export function sourceLocationFor(sourceType?: EvidenceSourceType) {
  switch (sourceType) {
    case "assessmentHeading":
      return "Assessment and Plan diagnosis heading";
    case "planSentence":
      return "Assessment and Plan treatment sentence";
    case "hpiSentence":
      return "HPI sentence";
    case "medicationRow":
      return "Medication row";
    case "labResultRow":
      return "Lab result row";
    case "vitalRow":
      return "Vital sign row";
    case "imagingImpression":
      return "Imaging impression";
    case "specialistAssessment":
      return "Specialist note assessment";
    case "problemListItem":
      return "Problem-list item";
    case "pmhItem":
      return "Past medical history item";
    case "claimLine":
      return "Claim line";
    case "morPayerRegistryHie":
      return "MOR / payer / registry / HIE item";
    default:
      return "Chart source";
  }
}

export function sourceTypeForEvidence(evidence: Pick<EvidencePassage, "id" | "chartAnchor" | "subtype">): EvidenceSourceType {
  if (evidence.chartAnchor?.tab === "labs") return "labResultRow";
  if (evidence.chartAnchor?.tab === "imaging") return "imagingImpression";
  if (evidence.chartAnchor?.tab === "specialist-notes") return "specialistAssessment";
  if (evidence.chartAnchor?.tab === "claims") {
    if (evidence.id.includes("mor") || evidence.id.includes("payer") || evidence.id.includes("registry") || evidence.id.includes("hie")) {
      return "morPayerRegistryHie";
    }
    return "claimLine";
  }
  if (evidence.chartAnchor?.tab === "problem-list") return "problemListItem";
  if (evidence.chartAnchor?.tab === "pmh") return "pmhItem";
  if (evidence.chartAnchor?.tab === "medications") return "medicationRow";
  if (evidence.chartAnchor?.sectionId === "assessmentPlan") {
    return evidence.id.includes("heading") ? "assessmentHeading" : "planSentence";
  }
  if (evidence.chartAnchor?.sectionId === "hpi") return "hpiSentence";
  return evidence.subtype ? "morPayerRegistryHie" : "hpiSentence";
}

export function assessmentPlanTextForCondition(condition: Condition) {
  const profile = clinicalProfileForCondition(condition);
  if (condition.resolvedFlag) {
    return `${condition.description} is documented as resolved; no active medication, monitoring, or follow-up plan is continued for this diagnosis today.`;
  }
  if (condition.conflictingEvidence) {
    return `${profile.weakMention} Prior records list a different status; reconciliation with the outside source is pending.`;
  }
  if (!condition.hasSufficientMeat) {
    if (condition.hasClinicalIndicators || condition.hasOtherSupportingEvidence) {
      return `${condition.description}: interval symptoms and the medication list were reviewed. No disease-specific therapy was changed today.`;
    }
    return profile.weakMention;
  }
  return profile.plan;
}

export function meatTypesForSource(sourceType: EvidenceSourceType, strength: EvidenceStrength): MeatType[] | undefined {
  if (!["strongCurrentYearMEAT", "assessmentWithPlan", "treatmentEvidence", "monitoringEvidence", "evaluationEvidence", "clinicalIndicatorOnly", "labIndicatorOnly", "imagingIndicatorOnly"].includes(strength)) return undefined;
  switch (sourceType) {
    case "assessmentHeading":
      return ["Assessment"];
    case "planSentence":
      return ["Monitoring", "Evaluation", "Assessment", "Treatment"];
    case "hpiSentence":
      return ["Evaluation"];
    case "medicationRow":
      return ["Treatment"];
    case "labResultRow":
    case "imagingImpression":
      return ["Evaluation"];
    case "vitalRow":
      return ["Monitoring"];
    case "specialistAssessment":
      return ["Assessment", "Treatment"];
    default:
      return undefined;
  }
}

export function clinicalExactTextForSource(condition: Condition, sourceType: EvidenceSourceType) {
  const profile = clinicalProfileForCondition(condition);
  switch (sourceType) {
    case "assessmentHeading":
      return condition.description;
    case "planSentence":
      return assessmentPlanTextForCondition(condition);
    case "hpiSentence":
      return profile.hpi;
    case "medicationRow":
      return `${profile.medication.name} ${profile.medication.dose}`.trim();
    case "labResultRow": {
      const result = profile.labResults[0];
      return result ? `${result.component} ${result.value} ${result.unit}`.trim() : profile.hpi;
    }
    case "vitalRow": {
      const vitals = profile.currentVitals;
      const bmi = vitals ? Math.round(((703 * vitals.weightPounds) / vitals.heightInches ** 2) * 10) / 10 : undefined;
      return bmi ? `BMI ${bmi}` : "BMI";
    }
    case "imagingImpression":
      return profile.imaging.impression[0] ?? profile.imaging.findings;
    case "specialistAssessment":
      return profile.specialist.assessment[0] ?? profile.specialist.note;
    case "problemListItem":
      return profile.weakMention;
    case "pmhItem":
      return profile.pmh;
    case "claimLine":
      return condition.icd10;
    case "morPayerRegistryHie":
      return condition.subtype === "suspect"
        ? `${condition.description} appears in payer, registry, or HIE data`
        : `Prior claim or MOR record lists ${condition.description}`;
  }
}

export function reviewerExplanationForEvidence(condition: Condition, sourceType: EvidenceSourceType, strength: EvidenceStrength) {
  const source = sourceLocationFor(sourceType);
  switch (strength) {
    case "strongCurrentYearMEAT":
    case "assessmentWithPlan":
    case "treatmentEvidence":
    case "monitoringEvidence":
      return `${source} contains current-year MEAT support for ${condition.description}.`;
    case "clinicalIndicatorOnly":
    case "labIndicatorOnly":
    case "imagingIndicatorOnly":
    case "evaluationEvidence":
      return `${source} is a clinical indicator for ${condition.description}, but it is not enough by itself without provider assessment or management.`;
    case "problemListOnly":
    case "pmhOnly":
    case "weakMentionOnly":
      return `${source} mentions ${condition.description} without a current-year assessment and plan.`;
    case "historicalClaimOnly":
    case "specialistHistoricalOnly":
    case "historicalOnly":
      return `${source} is lookback or prior-capture context and should not be treated as standalone current-year validation.`;
    case "recapture":
      return `${source} supports recapture review for ${condition.description}; provider confirmation is still needed.`;
    case "suspect":
      return `${source} supports a suspect or prospective opportunity for ${condition.description}; provider confirmation is still needed.`;
    case "conflicting":
      return `${source} conflicts with active support for ${condition.description} and requires reviewer judgment.`;
    case "unsupported":
      return `${source} indicates the condition is unsupported or resolved for current capture.`;
  }
}

export function inferEvidenceStrength(condition: Condition, category: Category, sourceType: EvidenceSourceType): EvidenceStrength {
  if (condition.conflictingEvidence) return "conflicting";
  if (condition.resolvedFlag) return "unsupported";
  if (sourceType === "labResultRow") return "labIndicatorOnly";
  if (sourceType === "vitalRow") return "clinicalIndicatorOnly";
  if (sourceType === "imagingImpression") return "imagingIndicatorOnly";
  if (sourceType === "hpiSentence") return condition.subtype === "suspect" ? "suspect" : "weakMentionOnly";
  if (sourceType === "problemListItem") return "problemListOnly";
  if (sourceType === "pmhItem") return "pmhOnly";
  if (sourceType === "claimLine") return condition.hadPriorCapture && !condition.hasCurrentYearCapture ? "historicalClaimOnly" : "weakMentionOnly";
  if (sourceType === "specialistAssessment") return condition.hasSufficientMeat ? "assessmentWithPlan" : "specialistHistoricalOnly";
  if (sourceType === "morPayerRegistryHie") return condition.subtype === "suspect" ? "suspect" : "recapture";
  if (condition.hasSufficientMeat && sourceType === "planSentence") return "assessmentWithPlan";
  if (condition.workflow === "prospective" || category === "prospective") return condition.subtype === "recapture" ? "historicalOnly" : "suspect";
  return condition.hasSufficientMeat ? "strongCurrentYearMEAT" : "weakMentionOnly";
}
