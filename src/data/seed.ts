import type {
  ActionHistory,
  Audit,
  Claim,
  Clinic,
  Condition,
  EvidencePassage,
  ExportRecord,
  Patient,
  PatientReview,
  PayerPlan,
  Provider,
  SeedData,
  SourceDocument,
  Team,
  UpcomingAppointment,
  User
} from "../domain/types";

const now = "2026-06-24T09:00:00.000Z";

export const users: User[] = [
  { id: "u-admin", name: "Jordan Avery", primaryRole: "Administrator", roles: ["Administrator", "Manager"], teamId: "t-admin", defaultClinicIds: [] },
  { id: "u-manager-1", name: "Maya Chen", primaryRole: "Manager", roles: ["Manager"], teamId: "t-north", defaultClinicIds: ["clinic-river", "clinic-oak"] },
  { id: "u-manager-2", name: "Samir Patel", primaryRole: "Manager", roles: ["Manager"], teamId: "t-south", defaultClinicIds: ["clinic-lake", "clinic-canyon"] },
  { id: "u-auditor-1", name: "Tessa Morgan", primaryRole: "Auditor", roles: ["Auditor"], teamId: "t-audit", defaultClinicIds: [] },
  { id: "u-auditor-2", name: "Leo Vargas", primaryRole: "Auditor", roles: ["Auditor"], teamId: "t-audit", defaultClinicIds: [] },
  { id: "u-coder-1", name: "Nina Brooks", primaryRole: "Coder", roles: ["Coder"], teamId: "t-north", defaultClinicIds: ["clinic-river"] },
  { id: "u-coder-2", name: "Evan Hale", primaryRole: "Coder", roles: ["Coder"], teamId: "t-north", defaultClinicIds: ["clinic-oak"] },
  { id: "u-coder-3", name: "Grace Imani", primaryRole: "Coder", roles: ["Coder"], teamId: "t-south", defaultClinicIds: ["clinic-lake"] },
  { id: "u-coder-4", name: "Owen Reed", primaryRole: "Coder", roles: ["Coder"], teamId: "t-south", defaultClinicIds: ["clinic-canyon"] },
  { id: "u-coder-5", name: "Priya Shah", primaryRole: "Coder", roles: ["Coder", "CDI Specialist"], teamId: "t-north", defaultClinicIds: ["clinic-river", "clinic-oak"] },
  { id: "u-cdi-1", name: "Clara Wood", primaryRole: "CDI Specialist", roles: ["CDI Specialist"], teamId: "t-north", defaultClinicIds: ["clinic-river"] },
  { id: "u-cdi-2", name: "Hector Ruiz", primaryRole: "CDI Specialist", roles: ["CDI Specialist"], teamId: "t-north", defaultClinicIds: ["clinic-oak"] },
  { id: "u-cdi-3", name: "Amina Diallo", primaryRole: "CDI Specialist", roles: ["CDI Specialist"], teamId: "t-south", defaultClinicIds: ["clinic-lake"] },
  { id: "u-cdi-4", name: "Noah Kim", primaryRole: "CDI Specialist", roles: ["CDI Specialist"], teamId: "t-south", defaultClinicIds: ["clinic-canyon"] },
  { id: "u-cdi-5", name: "Iris Stone", primaryRole: "CDI Specialist", roles: ["CDI Specialist", "Coder"], teamId: "t-south", defaultClinicIds: ["clinic-lake", "clinic-canyon"] },
  { id: "u-coder-6", name: "Marcus Bell", primaryRole: "Coder", roles: ["Coder"], teamId: "t-north", defaultClinicIds: ["clinic-river"] }
];

export const teams: Team[] = [
  { id: "t-admin", name: "Administration", managerId: "u-admin" },
  { id: "t-north", name: "North Risk Adjustment", managerId: "u-manager-1" },
  { id: "t-south", name: "South CDI Operations", managerId: "u-manager-2" },
  { id: "t-audit", name: "Quality Audit", managerId: "u-admin" }
];

export const clinics: Clinic[] = [
  { id: "clinic-river", name: "Riverbend Primary Care", defaultCoderId: "u-coder-1", defaultCdiId: "u-cdi-1" },
  { id: "clinic-oak", name: "Oak Valley Internal Medicine", defaultCoderId: "u-coder-2", defaultCdiId: "u-cdi-2" },
  { id: "clinic-lake", name: "Lakeview Senior Health", defaultCoderId: "u-coder-3", defaultCdiId: "u-cdi-3" },
  { id: "clinic-canyon", name: "Canyon Family Clinic", defaultCoderId: "u-coder-4", defaultCdiId: "u-cdi-4" }
];

export const providers: Provider[] = [
  { id: "prov-ana", name: "Ana Moretti, MD", clinicId: "clinic-river", specialty: "Internal Medicine" },
  { id: "prov-lane", name: "Peter Lane, DO", clinicId: "clinic-oak", specialty: "Family Medicine" },
  { id: "prov-singh", name: "Ravi Singh, MD", clinicId: "clinic-lake", specialty: "Geriatrics" },
  { id: "prov-hill", name: "Elaine Hill, NP", clinicId: "clinic-canyon", specialty: "Primary Care" },
  { id: "prov-kline", name: "Rachel Kline, MD", clinicId: "clinic-river", specialty: "Cardiology" }
];

export const payers: PayerPlan[] = [
  { id: "payer-summit", name: "Summit Medicare Advantage", asmProfile: "SUMMIT-ASM-V2" },
  { id: "payer-harbor", name: "Harbor Health MA", asmProfile: "HARBOR-ASM-CSV" },
  { id: "payer-civic", name: "CivicCare Secure", asmProfile: "CIVIC-ASM-PIPE" },
  { id: "payer-nova", name: "Nova Senior Choice", asmProfile: "NOVA-ASM-DEMO" }
];

export const patients: Patient[] = [
  { id: "pat-100", name: "Evelyn Hart", dob: "1947-02-11", memberId: "SM-884102", payerId: "payer-summit", demographicRaf: 0.421 },
  { id: "pat-101", name: "Robert Nunez", dob: "1951-08-23", memberId: "HB-440198", payerId: "payer-harbor", demographicRaf: 0.337 },
  { id: "pat-102", name: "Patricia Bell", dob: "1942-05-04", memberId: "CC-120456", payerId: "payer-civic", demographicRaf: 0.512 },
  { id: "pat-103", name: "Thomas Okafor", dob: "1955-10-19", memberId: "NV-772903", payerId: "payer-nova", demographicRaf: 0.293 },
  { id: "pat-104", name: "Maria Jensen", dob: "1949-04-08", memberId: "SM-117302", payerId: "payer-summit", demographicRaf: 0.466 },
  { id: "pat-105", name: "Henry Wallace", dob: "1944-12-31", memberId: "HB-204481", payerId: "payer-harbor", demographicRaf: 0.389 },
  { id: "pat-106", name: "Linda Park", dob: "1950-01-15", memberId: "CC-902311", payerId: "payer-civic", demographicRaf: 0.356 },
  { id: "pat-107", name: "George Miller", dob: "1946-07-22", memberId: "NV-600742", payerId: "payer-nova", demographicRaf: 0.601 },
  { id: "pat-108", name: "Angela Rossi", dob: "1953-09-12", memberId: "SM-390114", payerId: "payer-summit", demographicRaf: 0.318 },
  { id: "pat-109", name: "Victor Coleman", dob: "1941-11-02", memberId: "HB-772140", payerId: "payer-harbor", demographicRaf: 0.557 }
];

export const appointments: UpcomingAppointment[] = [
  { id: "appt-100", patientId: "pat-100", providerId: "prov-ana", date: "2026-07-08", type: "Primary care follow-up" },
  { id: "appt-101", patientId: "pat-101", providerId: "prov-lane", date: "2026-07-15", type: "Annual wellness visit" },
  { id: "appt-102", patientId: "pat-102", providerId: "prov-singh", date: "2026-07-02", type: "Chronic care visit" },
  { id: "appt-104", patientId: "pat-104", providerId: "prov-kline", date: "2026-08-01", type: "Cardiology follow-up" },
  { id: "appt-106", patientId: "pat-106", providerId: "prov-singh", date: "2026-06-30", type: "Medication review" },
  { id: "appt-108", patientId: "pat-108", providerId: "prov-ana", date: "2026-07-18", type: "Diabetes follow-up" }
];

export const reviews: PatientReview[] = [
  {
    id: "rev-100",
    patientId: "pat-100",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-river",
    providerId: "prov-ana",
    status: "Available",
    queue: "Assigned Coder",
    assignedCoderId: "u-coder-1",
    assignedCdiId: "u-cdi-1",
    appointmentId: "appt-100",
    conditionIds: ["cond-100-a", "cond-100-b", "cond-100-c", "cond-100-d", "cond-100-e", "cond-100-f"]
  },
  {
    id: "rev-101",
    patientId: "pat-101",
    calendarYear: 2026,
    reviewType: "Prospective",
    clinicId: "clinic-oak",
    providerId: "prov-lane",
    status: "In Progress",
    queue: "Prospective Review Queue",
    assignedCoderId: "u-coder-2",
    assignedCdiId: "u-cdi-2",
    lock: { lockedByUserId: "u-cdi-2", lockedAt: "2026-06-24T08:20:00.000Z" },
    appointmentId: "appt-101",
    conditionIds: ["cond-101-a", "cond-101-b", "cond-101-c"]
  },
  {
    id: "rev-102",
    patientId: "pat-102",
    calendarYear: 2025,
    reviewType: "Retrospective",
    clinicId: "clinic-lake",
    providerId: "prov-singh",
    status: "Pended",
    queue: "Assigned Coder",
    assignedCoderId: "u-coder-3",
    assignedCdiId: "u-cdi-3",
    appointmentId: "appt-102",
    conditionIds: ["cond-102-a", "cond-102-b"]
  },
  {
    id: "rev-103",
    patientId: "pat-103",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-canyon",
    providerId: "prov-hill",
    status: "Awaiting Review",
    queue: "Manager Review Queue",
    assignedCoderId: "u-coder-4",
    assignedCdiId: "u-cdi-4",
    conditionIds: ["cond-103-a", "cond-103-b"]
  },
  {
    id: "rev-104",
    patientId: "pat-104",
    calendarYear: 2026,
    reviewType: "Prospective",
    clinicId: "clinic-river",
    providerId: "prov-kline",
    status: "Completed",
    queue: "Assigned CDI Specialist",
    assignedCoderId: "u-coder-5",
    assignedCdiId: "u-cdi-1",
    appointmentId: "appt-104",
    conditionIds: ["cond-104-a", "cond-104-b"]
  },
  {
    id: "rev-105",
    patientId: "pat-105",
    calendarYear: 2026,
    reviewType: "Retrospective",
    clinicId: "clinic-oak",
    providerId: "prov-lane",
    status: "Under Audit",
    queue: "Auditor Queue",
    assignedCoderId: "u-coder-2",
    assignedCdiId: "u-cdi-2",
    assignedAuditorId: "u-auditor-1",
    conditionIds: ["cond-105-a", "cond-105-b"]
  },
  {
    id: "rev-106",
    patientId: "pat-106",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-lake",
    providerId: "prov-singh",
    status: "Available",
    queue: "Unassigned Team Queue",
    assignedCdiId: "u-cdi-3",
    appointmentId: "appt-106",
    conditionIds: ["cond-106-a", "cond-106-b"]
  },
  {
    id: "rev-107",
    patientId: "pat-107",
    calendarYear: 2026,
    reviewType: "Prospective",
    clinicId: "clinic-canyon",
    providerId: "prov-hill",
    status: "Available",
    queue: "Prospective Review Queue",
    assignedCoderId: "u-coder-4",
    assignedCdiId: "u-cdi-4",
    conditionIds: ["cond-107-a", "cond-107-b"]
  },
  {
    id: "rev-108",
    patientId: "pat-108",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-river",
    providerId: "prov-ana",
    status: "Completed",
    queue: "Assigned Coder",
    assignedCoderId: "u-coder-6",
    assignedCdiId: "u-cdi-1",
    appointmentId: "appt-108",
    conditionIds: ["cond-108-a", "cond-108-b", "cond-108-c"]
  },
  {
    id: "rev-109",
    patientId: "pat-109",
    calendarYear: 2025,
    reviewType: "Retrospective",
    clinicId: "clinic-oak",
    providerId: "prov-lane",
    status: "Audit Complete",
    queue: "Auditor Queue",
    assignedCoderId: "u-coder-2",
    assignedCdiId: "u-cdi-2",
    assignedAuditorId: "u-auditor-2",
    conditionIds: ["cond-109-a", "cond-109-b"]
  }
];

function section(id: string, text: string, evidenceIds: string[] = []) {
  return { id, text, evidenceIds };
}

export const documents: SourceDocument[] = reviews.flatMap((review) => [
  {
    id: `doc-${review.id}-note`,
    reviewId: review.id,
    type: "Progress Note",
    title: `${review.calendarYear} primary care progress note`,
    date: `${review.calendarYear}-04-12`,
    isCurrentYear: true,
    sections: [
      section(`sec-${review.id}-note-1`, "Chief concern: chronic condition follow-up and medication review.", []),
      section(`sec-${review.id}-note-2`, "Assessment includes diabetes, chronic kidney disease, heart failure symptoms, and medication adherence review.", [`ev-${review.id}-a`, `ev-${review.id}-b`]),
      section(`sec-${review.id}-note-3`, "Plan: continue disease monitoring, reconcile specialist notes, and address open risk adjustment items.", [`ev-${review.id}-c`])
    ]
  },
  {
    id: `doc-${review.id}-lab`,
    reviewId: review.id,
    type: "Lab",
    title: `${review.calendarYear} laboratory findings`,
    date: `${review.calendarYear}-03-05`,
    isCurrentYear: true,
    sections: [
      section(`sec-${review.id}-lab-1`, "A1c, kidney function, lipid panel, and urine microalbumin were reviewed.", [`ev-${review.id}-d`]),
      section(`sec-${review.id}-lab-2`, "Abnormal values are pre-annotated for prototype evidence navigation.", [`ev-${review.id}-e`])
    ]
  },
  {
    id: `doc-${review.id}-history`,
    reviewId: review.id,
    type: "Claims",
    title: "Prior-year claims and registry lookback",
    date: `${review.calendarYear - 1}-10-20`,
    isCurrentYear: false,
    sections: [
      section(`sec-${review.id}-hist-1`, "Prior capture history, registry flags, specialist referrals, and HIE data are summarized for three-year lookback review.", [`ev-${review.id}-f`]),
      section(`sec-${review.id}-hist-2`, "Historical evidence is shown separately from current-calendar-year documentation.", [])
    ]
  }
]);

export const evidence: EvidencePassage[] = reviews.flatMap((review) => [
  {
    id: `ev-${review.id}-a`,
    reviewId: review.id,
    documentId: `doc-${review.id}-note`,
    anchorId: `sec-${review.id}-note-2`,
    text: "Assessment includes diabetes, chronic kidney disease, heart failure symptoms, and medication adherence review.",
    date: `${review.calendarYear}-04-12`,
    category: "validated",
    conditionIds: review.conditionIds.slice(0, 2),
    summary: "Current-year progress note documents active chronic condition management."
  },
  {
    id: `ev-${review.id}-b`,
    reviewId: review.id,
    documentId: `doc-${review.id}-note`,
    anchorId: `sec-${review.id}-note-2`,
    text: "Heart failure symptoms and medication adherence review.",
    date: `${review.calendarYear}-04-12`,
    category: "prospective",
    subtype: "recapture",
    conditionIds: review.conditionIds.slice(2, 3),
    summary: "Clinical note references a condition requiring prospective confirmation."
  },
  {
    id: `ev-${review.id}-c`,
    reviewId: review.id,
    documentId: `doc-${review.id}-note`,
    anchorId: `sec-${review.id}-note-3`,
    text: "Address open risk adjustment items at upcoming encounter.",
    date: `${review.calendarYear}-04-12`,
    category: "prospective",
    subtype: "suspect",
    conditionIds: review.conditionIds.slice(3, 4),
    summary: "Provider plan leaves a prospective risk adjustment opportunity open."
  },
  {
    id: `ev-${review.id}-d`,
    reviewId: review.id,
    documentId: `doc-${review.id}-lab`,
    anchorId: `sec-${review.id}-lab-1`,
    text: "A1c, kidney function, lipid panel, and urine microalbumin were reviewed.",
    date: `${review.calendarYear}-03-05`,
    category: "potentialAddition",
    conditionIds: review.conditionIds.slice(1, 4),
    summary: "Lab panel supports an uncaptured condition in the current year."
  },
  {
    id: `ev-${review.id}-e`,
    reviewId: review.id,
    documentId: `doc-${review.id}-lab`,
    anchorId: `sec-${review.id}-lab-2`,
    text: "Abnormal values are pre-annotated for prototype evidence navigation.",
    date: `${review.calendarYear}-03-05`,
    category: "potentialDelete",
    conditionIds: review.conditionIds.slice(0, 1),
    summary: "Structured lab evidence creates a validation or deletion conflict."
  },
  {
    id: `ev-${review.id}-f`,
    reviewId: review.id,
    documentId: `doc-${review.id}-history`,
    anchorId: `sec-${review.id}-hist-1`,
    text: "Prior capture history, registry flags, specialist referrals, and HIE data are summarized.",
    date: `${review.calendarYear - 1}-10-20`,
    category: "prospective",
    subtype: "recapture",
    conditionIds: review.conditionIds.slice(2, 5),
    summary: "Historical lookback evidence supports recapture or suspect review."
  }
]);

export const claims: Claim[] = reviews.map((review) => ({
  id: `claim-${review.id}`,
  reviewId: review.id,
  dateOfService: `${review.calendarYear}-04-12`,
  riskEligible: true,
  cptSourceEligible: review.id !== "rev-103",
  providerTypeEligible: review.id !== "rev-106",
  faceToFace: review.id !== "rev-107",
  icd10Codes: review.conditionIds.slice(0, 2).map((id) => id.replace("cond-", "DX-"))
}));

const disposed = (action: "Validate" | "Add to Claim" | "Yes" | "Delete", userId = "u-coder-2") => ({
  action,
  userId,
  decidedAt: "2026-06-22T14:15:00.000Z",
  agreedWithRecommendation: true
});

export const conditions: Condition[] = [
  {
    id: "cond-100-a",
    reviewId: "rev-100",
    workflow: "codesOnClaim",
    category: "validated",
    icd10: "E11.65",
    description: "Type 2 DM with hyperglycemia",
    hcc: "HCC 37",
    raf: 0.318,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-100-a", "ev-rev-100-e"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: true,
    hasOtherSupportingEvidence: true,
    hadPriorCapture: true,
    hasCurrentYearCapture: true,
    hasClinicalIndicators: true,
    documentationIssues: []
  },
  {
    id: "cond-100-b",
    reviewId: "rev-100",
    workflow: "codesOnClaim",
    category: "potentialDelete",
    icd10: "I10",
    description: "Essential hypertension",
    hcc: "HCC 226",
    raf: 0.121,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-100-e"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: false,
    hadPriorCapture: true,
    hasCurrentYearCapture: true,
    hasClinicalIndicators: false,
    documentationIssues: []
  },
  {
    id: "cond-100-c",
    reviewId: "rev-100",
    workflow: "codesOnClaim",
    category: "prospective",
    subtype: "recapture",
    icd10: "I50.33",
    description: "Acute-on-chronic diastolic heart failure",
    hcc: "HCC 222",
    raf: 0.323,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-100-b", "ev-rev-100-f"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: true,
    hadPriorCapture: true,
    hasCurrentYearCapture: true,
    hasClinicalIndicators: true,
    seededRecommendation: {
      action: "Send to Prospective",
      confidence: "Medium",
      source: "seeded",
      rationale: "Documentation is suggestive but MEAT is incomplete while the current-year opportunity remains open."
    },
    documentationIssues: []
  },
  {
    id: "cond-100-d",
    reviewId: "rev-100",
    workflow: "codesNotOnClaim",
    category: "potentialAddition",
    icd10: "E11.40",
    description: "Type 2 DM with diabetic neuropathy",
    hcc: "HCC 37",
    raf: 0.318,
    claimStatus: "Not on claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-100-d"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: true,
    hasOtherSupportingEvidence: true,
    hadPriorCapture: false,
    hasCurrentYearCapture: false,
    hasClinicalIndicators: true,
    documentationIssues: []
  },
  {
    id: "cond-100-e",
    reviewId: "rev-100",
    workflow: "codesNotOnClaim",
    category: "potentialAddition",
    icd10: "E11.42",
    description: "Type 2 DM with diabetic polyneuropathy",
    hcc: "HCC 37",
    raf: 0.309,
    claimStatus: "Not on claim",
    sourceDate: "2026-03-05",
    evidenceIds: ["ev-rev-100-f"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: false,
    hadPriorCapture: false,
    hasCurrentYearCapture: false,
    hasClinicalIndicators: true,
    conflictingEvidence: true,
    seededRecommendation: {
      action: "Disagree",
      confidence: "Low",
      source: "seeded",
      rationale: "Conflicting behavioral health documentation requires human review before claim action."
    },
    documentationIssues: []
  },
  {
    id: "cond-100-f",
    reviewId: "rev-100",
    workflow: "prospective",
    category: "prospective",
    subtype: "suspect",
    icd10: "E11.51",
    description: "Type 2 DM with diabetic macular edema, right eye",
    hcc: "HCC 37",
    raf: 0.318,
    claimStatus: "Registry",
    sourceDate: "2026-02-14",
    evidenceIds: ["ev-rev-100-c", "ev-rev-100-f"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: true,
    hadPriorCapture: false,
    hasCurrentYearCapture: false,
    hasClinicalIndicators: true,
    seededRecommendation: {
      action: "Change",
      confidence: "Medium",
      source: "seeded",
      replacementCode: "E11.311",
      rationale: "Specialist evidence suggests a more specific diabetes eye complication code."
    },
    documentationIssues: []
  },
  ...reviews
    .filter((review) => review.id !== "rev-100")
    .flatMap((review, index) => {
      const base: Condition[] = [
        {
          id: review.conditionIds[0],
          reviewId: review.id,
          workflow: "codesOnClaim",
          category: index % 3 === 0 ? "potentialDelete" : "validated",
          icd10: index % 2 === 0 ? "N18.4" : "E11.22",
          description: index % 2 === 0 ? "Chronic kidney disease, stage 4" : "Type 2 DM with diabetic chronic kidney disease",
          hcc: "HCC 328",
          raf: 0.289 + index * 0.01,
          claimStatus: "On claim",
          sourceDate: `${review.calendarYear}-04-12`,
          evidenceIds: [`ev-${review.id}-a`, `ev-${review.id}-e`],
          actionable: true,
          currentYear: review.calendarYear === 2026,
          hasSufficientMeat: index % 3 !== 0,
          hasOtherSupportingEvidence: index % 4 !== 0,
          hadPriorCapture: true,
          hasCurrentYearCapture: true,
          hasClinicalIndicators: true,
          disposition: review.status === "Completed" || review.status === "Under Audit" || review.status === "Audit Complete" ? disposed(index % 3 === 0 ? "Delete" : "Validate") : undefined,
          documentationIssues: []
        },
        {
          id: review.conditionIds[1],
          reviewId: review.id,
          workflow: index % 2 === 0 ? "codesNotOnClaim" : "prospective",
          category: index % 2 === 0 ? "potentialAddition" : "prospective",
          subtype: index % 2 === 0 ? undefined : index % 3 === 0 ? "suspect" : "recapture",
          icd10: index % 2 === 0 ? "E66.01" : "I50.32",
          description: index % 2 === 0 ? "Morbid obesity due to excess calories" : "Chronic diastolic heart failure",
          hcc: index % 2 === 0 ? "HCC 48" : "HCC 222",
          raf: 0.186 + index * 0.012,
          claimStatus: index % 2 === 0 ? "Not on claim" : "Historical",
          sourceDate: `${review.calendarYear}-03-05`,
          evidenceIds: [`ev-${review.id}-d`, `ev-${review.id}-f`],
          actionable: true,
          currentYear: review.calendarYear === 2026,
          hasSufficientMeat: index % 5 !== 0,
          hasOtherSupportingEvidence: true,
          hadPriorCapture: index % 2 !== 0,
          hasCurrentYearCapture: false,
          hasClinicalIndicators: true,
          resolvedFlag: review.id === "rev-103",
          disposition: review.status === "Completed" || review.status === "Under Audit" || review.status === "Audit Complete" ? disposed(index % 2 === 0 ? "Add to Claim" : "Yes", "u-cdi-1") : undefined,
          documentationIssues: review.id === "rev-103" ? [{ issue: "Provider education", comments: "Clarify specificity for future encounter.", userId: "u-cdi-4", createdAt: now }] : []
        }
      ];
      const extraIds = review.conditionIds.slice(2);
      return [
        ...base,
        ...extraIds.map((id, extraIndex): Condition => ({
          id,
          reviewId: review.id,
          workflow: "prospective",
          category: "prospective",
          subtype: extraIndex % 2 === 0 ? "recapture" : "suspect",
          icd10: extraIndex % 2 === 0 ? "J44.9" : "E11.621",
          description: extraIndex % 2 === 0 ? "Chronic obstructive pulmonary disease" : "Type 2 DM with foot ulcer",
          hcc: extraIndex % 2 === 0 ? "HCC 280" : "HCC 37",
          raf: 0.214 + extraIndex * 0.06,
          claimStatus: extraIndex % 2 === 0 ? "Historical" : "Registry",
          sourceDate: `${review.calendarYear - 1}-10-20`,
          evidenceIds: [`ev-${review.id}-b`, `ev-${review.id}-f`],
          actionable: true,
          currentYear: review.calendarYear === 2026,
          hasSufficientMeat: false,
          hasOtherSupportingEvidence: true,
          hadPriorCapture: extraIndex % 2 === 0,
          hasCurrentYearCapture: false,
          hasClinicalIndicators: true,
          seededRecommendation: extraIndex % 2 === 1
            ? { action: "Yes", confidence: "Medium", source: "seeded", rationale: "Registry and specialist pattern support physician-facing suspect review." }
            : undefined,
          documentationIssues: []
        }))
      ];
    })
];

export const audits: Audit[] = [
  { id: "audit-105", reviewId: "rev-105", auditorId: "u-auditor-1", status: "In Progress" },
  { id: "audit-109", reviewId: "rev-109", auditorId: "u-auditor-2", status: "Complete", outcome: "Agree", comments: "Audit complete with agreement.", completedAt: "2026-06-20T16:00:00.000Z" }
];

export const history: ActionHistory[] = [
  { id: "hist-1", reviewId: "rev-101", userId: "u-cdi-2", at: "2026-06-24T08:20:00.000Z", event: "Lock acquired", detail: "Chart opened for prospective review." },
  { id: "hist-2", reviewId: "rev-102", userId: "u-coder-3", at: "2026-06-23T13:05:00.000Z", event: "Review pended", detail: "Awaiting additional documentation." },
  { id: "hist-3", reviewId: "rev-105", userId: "u-auditor-1", at: "2026-06-22T09:30:00.000Z", event: "Audit started", detail: "Random sample selected across completed retrospective work." }
];

export const exportsSeed: ExportRecord[] = [
  {
    id: "export-delete-demo",
    type: "Deletion list",
    createdAt: "2026-06-22T15:00:00.000Z",
    rows: [{ memberId: "HB-204481", icd10: "N18.4", hcc: "HCC 328", note: "Simulated delete-file row" }]
  },
  {
    id: "export-asm-demo",
    type: "Payer ASM export",
    createdAt: "2026-06-22T15:05:00.000Z",
    rows: [{ memberId: "SM-390114", icd10: "E66.01", payer: "Summit Medicare Advantage", profile: "SUMMIT-ASM-V2" }]
  }
];

export const seedData: SeedData = {
  users,
  teams,
  clinics,
  providers,
  payers,
  patients,
  reviews,
  documents,
  evidence,
  claims,
  conditions,
  appointments,
  audits,
  history,
  exports: exportsSeed
};
