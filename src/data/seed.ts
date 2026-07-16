import type {
  ActionHistory,
  Audit,
  Claim,
  ClinicalChart,
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
import {
  assessmentPlanTextForCondition,
  clinicalExactTextForSource,
  clinicalProfileForCondition,
  evidenceStrengthLabel,
  inferEvidenceStrength,
  meatTypesForSource,
  reviewerExplanationForEvidence,
  sourceTypeForEvidence,
  sourceLocationFor
} from "../domain/mockClinicalContent";

const now = "2026-06-24T09:00:00.000Z";

export const users: User[] = [
  { id: "u-admin", name: "Jordan Avery", primaryRole: "Administrator", roles: ["Administrator"], teamId: "t-admin", defaultClinicIds: [] },
  { id: "u-manager-1", name: "Maya Chen", primaryRole: "Manager", roles: ["Manager"], teamId: "t-north", defaultClinicIds: ["clinic-river", "clinic-oak"] },
  { id: "u-auditor-1", name: "Tessa Morgan", primaryRole: "Auditor", roles: ["Auditor"], teamId: "t-audit", defaultClinicIds: [] },
  { id: "u-coder-1", name: "Nina Brooks", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-north", defaultClinicIds: ["clinic-river"] },
  { id: "u-coder-2", name: "Evan Hale", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-north", defaultClinicIds: ["clinic-oak"] },
  { id: "u-coder-3", name: "Grace Imani", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-south", defaultClinicIds: ["clinic-lake"] },
  { id: "u-coder-4", name: "Owen Reed", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-south", defaultClinicIds: ["clinic-canyon"] }
];

export const teams: Team[] = [
  { id: "t-admin", name: "Administration", managerId: "u-admin" },
  { id: "t-north", name: "North Risk Adjustment", managerId: "u-manager-1" },
  { id: "t-south", name: "South CDI Operations", managerId: "u-manager-1" },
  { id: "t-audit", name: "Quality Audit", managerId: "u-admin" }
];

export const clinics: Clinic[] = [
  { id: "clinic-river", name: "Riverbend Primary Care", defaultAssigneeId: "u-coder-1" },
  { id: "clinic-oak", name: "Oak Valley Internal Medicine", defaultAssigneeId: "u-coder-2" },
  { id: "clinic-lake", name: "Lakeview Senior Health", defaultAssigneeId: "u-coder-3" },
  { id: "clinic-canyon", name: "Canyon Family Clinic", defaultAssigneeId: "u-coder-4" }
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
  { id: "pat-109", name: "Victor Coleman", dob: "1941-11-02", memberId: "HB-772140", payerId: "payer-harbor", demographicRaf: 0.557 },
  { id: "pat-110", name: "Denise Brooks", dob: "1948-03-18", memberId: "SM-550110", payerId: "payer-summit", demographicRaf: 0.402 },
  { id: "pat-111", name: "Marlene Cole", dob: "1952-06-09", memberId: "HB-771111", payerId: "payer-harbor", demographicRaf: 0.371 },
  { id: "pat-112", name: "Arthur Lane", dob: "1945-09-27", memberId: "CC-661112", payerId: "payer-civic", demographicRaf: 0.488 },
  { id: "pat-113", name: "Helen Carver", dob: "1950-12-02", memberId: "NV-801113", payerId: "payer-nova", demographicRaf: 0.344 },
  { id: "pat-114", name: "Irene Moss", dob: "1949-01-30", memberId: "SM-661114", payerId: "payer-summit", demographicRaf: 0.376 },
  { id: "pat-115", name: "Calvin Price", dob: "1954-04-16", memberId: "HB-551115", payerId: "payer-harbor", demographicRaf: 0.329 },
  { id: "pat-116", name: "Nora Fields", dob: "1946-10-05", memberId: "CC-771116", payerId: "payer-civic", demographicRaf: 0.417 }
];

export const appointments: UpcomingAppointment[] = [
  { id: "appt-100", patientId: "pat-100", providerId: "prov-ana", date: "2026-07-08", type: "Primary care follow-up" },
  { id: "appt-101", patientId: "pat-101", providerId: "prov-lane", date: "2026-07-15", type: "Annual wellness visit" },
  { id: "appt-102", patientId: "pat-102", providerId: "prov-singh", date: "2026-07-02", type: "Chronic care visit" },
  { id: "appt-104", patientId: "pat-104", providerId: "prov-kline", date: "2026-08-01", type: "Cardiology follow-up" },
  { id: "appt-106", patientId: "pat-106", providerId: "prov-singh", date: "2026-06-30", type: "Medication review" },
  { id: "appt-108", patientId: "pat-108", providerId: "prov-ana", date: "2026-07-18", type: "Diabetes follow-up" },
  { id: "appt-110", patientId: "pat-110", providerId: "prov-ana", date: "2026-07-22", type: "Threshold validation follow-up" },
  { id: "appt-111", patientId: "pat-111", providerId: "prov-lane", date: "2026-07-29", type: "Delete safety review" },
  { id: "appt-113", patientId: "pat-113", providerId: "prov-hill", date: "2026-07-10", type: "COPD follow-up" },
  { id: "appt-114", patientId: "pat-114", providerId: "prov-ana", date: "2026-07-12", type: "Post-acute follow-up" },
  { id: "appt-115", patientId: "pat-115", providerId: "prov-lane", date: "2026-07-16", type: "Quality review follow-up" },
  { id: "appt-116", patientId: "pat-116", providerId: "prov-singh", date: "2026-07-20", type: "Diabetes complication follow-up" }
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
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-1",
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
    assignedUserId: "u-coder-2",
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
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-3",
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
    assignedUserId: "u-coder-4",
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
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-5",
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
    assignedUserId: "u-coder-2",
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
    queue: "CDI/Coder Queue",
    assignedUserId: "u-cdi-3",
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
    assignedUserId: "u-coder-4",
    conditionIds: ["cond-107-a", "cond-107-b", "cond-107-c"]
  },
  {
    id: "rev-108",
    patientId: "pat-108",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-river",
    providerId: "prov-ana",
    status: "Completed",
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-6",
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
    assignedUserId: "u-coder-2",
    assignedAuditorId: "u-auditor-2",
    conditionIds: ["cond-109-a", "cond-109-b"]
  },
  {
    id: "rev-110",
    patientId: "pat-110",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-river",
    providerId: "prov-ana",
    status: "Available",
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-1",
    appointmentId: "appt-110",
    conditionIds: ["cond-110-a", "cond-110-b", "cond-110-c", "cond-110-d"]
  },
  {
    id: "rev-111",
    patientId: "pat-111",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-oak",
    providerId: "prov-lane",
    status: "Available",
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-2",
    appointmentId: "appt-111",
    conditionIds: ["cond-111-a"]
  },
  {
    id: "rev-111-support",
    patientId: "pat-111",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-oak",
    providerId: "prov-lane",
    status: "Completed",
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-2",
    appointmentId: "appt-111",
    conditionIds: ["cond-111-b"]
  },
  {
    id: "rev-112",
    patientId: "pat-112",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-lake",
    providerId: "prov-singh",
    status: "Available",
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-3",
    conditionIds: ["cond-112-a"]
  },
  {
    id: "rev-113",
    patientId: "pat-113",
    calendarYear: 2026,
    reviewType: "Prospective",
    clinicId: "clinic-canyon",
    providerId: "prov-hill",
    status: "Available",
    queue: "Prospective Review Queue",
    assignedUserId: "u-coder-4",
    appointmentId: "appt-113",
    conditionIds: ["cond-113-a"]
  },
  {
    id: "rev-114",
    patientId: "pat-114",
    calendarYear: 2026,
    reviewType: "Prospective",
    clinicId: "clinic-river",
    providerId: "prov-ana",
    status: "Available",
    queue: "Prospective Review Queue",
    assignedUserId: "u-coder-1",
    appointmentId: "appt-114",
    conditionIds: ["cond-114-a"]
  },
  {
    id: "rev-115",
    patientId: "pat-115",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-oak",
    providerId: "prov-lane",
    status: "Available",
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-2",
    appointmentId: "appt-115",
    conditionIds: ["cond-115-a"]
  },
  {
    id: "rev-116",
    patientId: "pat-116",
    calendarYear: 2026,
    reviewType: "Concurrent",
    clinicId: "clinic-lake",
    providerId: "prov-singh",
    status: "Available",
    queue: "CDI/Coder Queue",
    assignedUserId: "u-coder-3",
    appointmentId: "appt-116",
    conditionIds: ["cond-116-a", "cond-116-b"]
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
      section(`sec-${review.id}-note-2`, "Assessment and Plan: diabetes and kidney function addressed with glucose log review, renal-dose medication review, repeat labs, and follow-up plan.", [`ev-${review.id}-a`, `ev-${review.id}-b`]),
      section(`sec-${review.id}-note-3`, "Plan: continue disease monitoring, reconcile specialist notes, adjust medications when clinically indicated, and schedule follow-up.", [`ev-${review.id}-c`])
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
      section(`sec-${review.id}-lab-2`, "Selected abnormal values: HbA1c 8.4%, eGFR 41 mL/min, BNP 412 pg/mL, and urine albumin/creatinine ratio 186 mg/g.", [`ev-${review.id}-e`])
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
      section(`sec-${review.id}-hist-1`, "Prior-year claims, registry entries, specialist referrals, and HIE records list chronic diagnoses for comparison with the current encounter.", [`ev-${review.id}-f`]),
      section(`sec-${review.id}-hist-2`, "Historical records are shown separately from the current encounter note.", [])
    ]
  },
  ...(review.id === "rev-100"
    ? [
        {
          id: `doc-${review.id}-mor`,
          reviewId: review.id,
          type: "MOR" as const,
          title: "CMS MOR and payer return file indicators",
          date: `${review.calendarYear}-01-18`,
          isCurrentYear: true,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [
            section(`sec-${review.id}-mor-1`, "MOR lists prior HCC 222 recapture and payer data lists a diabetes suspect opportunity.", [
              `ev-${review.id}-mor`,
              `ev-${review.id}-payer`
            ])
          ]
        },
        {
          id: `doc-${review.id}-specialist`,
          reviewId: review.id,
          type: "Specialist Note" as const,
          title: "Cardiology specialist note",
          date: `${review.calendarYear}-02-09`,
          isCurrentYear: true,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-spec-1`, "Cardiology documents stable chronic diastolic heart failure with medication monitoring.", [`ev-${review.id}-specialist`])]
        },
        {
          id: `doc-${review.id}-hie`,
          reviewId: review.id,
          type: "HIE" as const,
          title: "HIE registry and external data",
          date: `${review.calendarYear}-02-22`,
          isCurrentYear: true,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-hie-1`, "HIE payload includes registry diabetic eye disease history and an SDoH transportation code.", [`ev-${review.id}-hie`])]
        },
        {
          id: `doc-${review.id}-pathology`,
          reviewId: review.id,
          type: "Pathology" as const,
          title: "Pathology report",
          date: `${review.calendarYear}-05-04`,
          isCurrentYear: true,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-path-1`, "Pathology confirms no active malignancy and should not trump chronic condition capture.", [`ev-${review.id}-pathology`])]
        },
        {
          id: `doc-${review.id}-imaging`,
          reviewId: review.id,
          type: "Imaging" as const,
          title: "Imaging report",
          date: `${review.calendarYear}-05-11`,
          isCurrentYear: true,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-image-1`, "Chest imaging shows acute bronchitis only, with airway thickening and no chronic emphysema or focal pneumonia.", [`ev-${review.id}-imaging`])]
        }
      ]
    : []),
  ...(review.id === "rev-113"
    ? [
        {
          id: `doc-${review.id}-claim-2025`,
          reviewId: review.id,
          type: "Claims" as const,
          title: "2025 claim lookback for COPD",
          date: "2025-10-20",
          isCurrentYear: false,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-claim-2025`, "Prior-year claim listed HCC 280 for COPD recapture review.", [`ev-${review.id}-lookback-2025`])]
        },
        {
          id: `doc-${review.id}-specialist-2024`,
          reviewId: review.id,
          type: "Specialist Note" as const,
          title: "2024 pulmonary specialist note",
          date: "2024-09-12",
          isCurrentYear: false,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-specialist-2024`, "Pulmonary specialist note carried forward a COPD history for lookback review.", [`ev-${review.id}-lookback-2024`])]
        },
        {
          id: `doc-${review.id}-mor-2023`,
          reviewId: review.id,
          type: "MOR" as const,
          title: "2023 MOR lookback entry",
          date: "2023-12-01",
          isCurrentYear: false,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-mor-2023`, "MOR lookback entry includes prior HCC 280 recapture context.", [`ev-${review.id}-lookback-2023`])]
        }
      ]
    : []),
  ...(review.id === "rev-114"
    ? [
        {
          id: `doc-${review.id}-acute-2025`,
          reviewId: review.id,
          type: "Imaging" as const,
          title: "2025 acute-only imaging lookback",
          date: "2025-11-03",
          isCurrentYear: false,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-acute-2025`, "Prior note documents acute respiratory failure during hospitalization with discharge summary stating the episode resolved before outpatient follow-up.", [`ev-${review.id}-acute-2025`])]
        }
      ]
    : []),
  ...(review.id === "rev-115"
    ? [
        {
          id: `doc-${review.id}-quality`,
          reviewId: review.id,
          type: "Payer Data" as const,
          title: "Quality-exclusion payer context",
          date: "2026-04-18",
          isCurrentYear: true,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [section(`sec-${review.id}-quality`, "Payer quality file lists Z55.0 for social context reporting; no HCC diagnosis is attached to this item.", [`ev-${review.id}-quality`])]
        }
      ]
    : []),
  ...(review.id === "rev-116"
    ? [
        {
          id: `doc-${review.id}-hierarchy`,
          reviewId: review.id,
          type: "Specialist Note" as const,
          title: "Hierarchy example specialist note",
          date: "2026-04-22",
          isCurrentYear: true,
          riskEligibleSource: true,
          cptSourceEligible: true,
          providerTypeEligible: true,
          faceToFace: true,
          providerSignatureValid: true,
          sections: [
            section(`sec-${review.id}-hierarchy`, "Specialist documentation supports E11.311 as the more specific diabetes eye complication code while the lower opportunity remains visible.", [
              `ev-${review.id}-hierarchy-lower`,
              `ev-${review.id}-hierarchy-higher`
            ])
          ]
        }
      ]
    : [])
]);

export const evidence: EvidencePassage[] = reviews.flatMap((review) => [
  {
    id: `ev-${review.id}-a`,
    reviewId: review.id,
    documentId: `doc-${review.id}-note`,
    anchorId: `sec-${review.id}-note-2`,
    sectionId: `sec-${review.id}-note-2`,
    text: "A1c 8.4%, eGFR 41, creatinine 1.42, and urine albumin/creatinine ratio 186 mg/g reviewed. Continue metformin ER 500 mg daily given renal function, increase basal insulin to 18 units nightly, continue lisinopril for renal protection, avoid NSAIDs, repeat A1c/BMP/urine microalbumin in 3 months, and review glucose log at follow-up.",
    exactText: "repeat A1c/BMP/urine microalbumin in 3 months",
    date: `${review.calendarYear}-04-12`,
    category: "validated",
    conditionIds: review.conditionIds.slice(0, 2),
    summary: "Assessment and plan includes diagnosis-specific monitoring and treatment."
  },
  {
    id: `ev-${review.id}-b`,
    reviewId: review.id,
    documentId: `doc-${review.id}-note`,
    anchorId: `sec-${review.id}-note-2`,
    sectionId: `sec-${review.id}-note-2`,
    text: "Patient reports dyspnea on exertion and intermittent ankle edema. Daily weights fluctuate by 2 to 3 lb with higher sodium intake; no chest pain reported today.",
    exactText: "dyspnea on exertion and intermittent ankle edema",
    date: `${review.calendarYear}-04-12`,
    category: "prospective",
    subtype: "recapture",
    conditionIds: review.conditionIds.slice(2, 3),
    summary: "HPI mentions symptoms/history without a complete current A&P plan."
  },
  {
    id: `ev-${review.id}-c`,
    reviewId: review.id,
    documentId: `doc-${review.id}-note`,
    anchorId: `sec-${review.id}-note-3`,
    sectionId: `sec-${review.id}-note-3`,
    text: "Diabetes eye complication appears in outside ophthalmology records; current primary care note requests the most recent ophthalmology note before confirming active retinal treatment status.",
    exactText: "requests the most recent ophthalmology note",
    date: `${review.calendarYear}-04-12`,
    category: "prospective",
    subtype: "suspect",
    conditionIds: review.conditionIds.slice(3, 4),
    summary: "Outside-source condition needs provider confirmation before capture."
  },
  {
    id: `ev-${review.id}-d`,
    reviewId: review.id,
    documentId: `doc-${review.id}-lab`,
    anchorId: `sec-${review.id}-lab-1`,
    sectionId: `sec-${review.id}-lab-1`,
    text: "A1c, kidney function, lipid panel, and urine microalbumin were reviewed.",
    exactText: "kidney function, lipid panel, and urine microalbumin",
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
    sectionId: `sec-${review.id}-lab-2`,
    text: "HbA1c 8.4%; Estimated GFR 41 mL/min; BNP 412 pg/mL; Urine Albumin/Creatinine Ratio 186 mg/g.",
    exactText: "Estimated GFR 41 mL/min",
    date: `${review.calendarYear}-03-05`,
    category: "potentialDelete",
    conditionIds: review.conditionIds.slice(0, 1),
    summary: "Lab indicator supports clinical review but is not standalone diagnosis validation."
  },
  {
    id: `ev-${review.id}-f`,
    reviewId: review.id,
    documentId: `doc-${review.id}-history`,
    anchorId: `sec-${review.id}-hist-1`,
    sectionId: `sec-${review.id}-hist-1`,
    text: "Prior-year claim and outside specialty notes list chronic HCC diagnoses; current primary care note does not assess every listed diagnosis.",
    exactText: "Prior-year claim and outside specialty notes",
    date: `${review.calendarYear - 1}-10-20`,
    category: "prospective",
    subtype: "recapture",
    conditionIds: review.conditionIds.slice(2, 5),
    summary: "Historical lookback evidence supports recapture review."
  },
  ...(review.id === "rev-100"
    ? [
        {
          id: `ev-${review.id}-mor`,
          reviewId: review.id,
          documentId: `doc-${review.id}-mor`,
          anchorId: `sec-${review.id}-mor-1`,
          sectionId: `sec-${review.id}-mor-1`,
          text: "MOR lists prior HCC 222 recapture.",
          exactText: "MOR lists prior HCC 222 recapture",
          date: `${review.calendarYear}-01-18`,
          category: "prospective" as const,
          subtype: "recapture" as const,
          conditionIds: ["cond-100-c"],
          summary: "MOR recapture example for prior HCC 222."
        },
        {
          id: `ev-${review.id}-payer`,
          reviewId: review.id,
          documentId: `doc-${review.id}-mor`,
          anchorId: `sec-${review.id}-mor-1`,
          sectionId: `sec-${review.id}-mor-1`,
          text: "Payer data lists a diabetes suspect opportunity.",
          exactText: "payer data lists a diabetes suspect opportunity",
          date: `${review.calendarYear}-01-18`,
          category: "prospective" as const,
          subtype: "suspect" as const,
          conditionIds: ["cond-100-f"],
          summary: "Payer data suspect example."
        },
        {
          id: `ev-${review.id}-specialist`,
          reviewId: review.id,
          documentId: `doc-${review.id}-specialist`,
          anchorId: `sec-${review.id}-spec-1`,
          sectionId: `sec-${review.id}-spec-1`,
          text: "Cardiology documents stable chronic diastolic heart failure.",
          exactText: "stable chronic diastolic heart failure",
          date: `${review.calendarYear}-02-09`,
          category: "validated" as const,
          conditionIds: ["cond-100-c"],
          summary: "Specialist note supports a chronic heart failure example."
        },
        {
          id: `ev-${review.id}-hie`,
          reviewId: review.id,
          documentId: `doc-${review.id}-hie`,
          anchorId: `sec-${review.id}-hie-1`,
          sectionId: `sec-${review.id}-hie-1`,
          text: "HIE payload includes registry diabetic eye disease history and an SDoH transportation code.",
          exactText: "SDoH transportation code",
          date: `${review.calendarYear}-02-22`,
          category: "prospective" as const,
          subtype: "suspect" as const,
          conditionIds: ["cond-100-f"],
          summary: "HIE and SDoH source example."
        },
        {
          id: `ev-${review.id}-pathology`,
          reviewId: review.id,
          documentId: `doc-${review.id}-pathology`,
          anchorId: `sec-${review.id}-path-1`,
          sectionId: `sec-${review.id}-path-1`,
          text: "Pathology confirms no active malignancy.",
          exactText: "no active malignancy",
          date: `${review.calendarYear}-05-04`,
          category: "potentialDelete" as const,
          conditionIds: ["cond-100-e"],
          summary: "Pathology source and trumping-control example."
        },
        {
          id: `ev-${review.id}-imaging`,
          reviewId: review.id,
          documentId: `doc-${review.id}-imaging`,
          anchorId: `sec-${review.id}-image-1`,
          sectionId: `sec-${review.id}-image-1`,
          text: "Imaging shows acute bronchitis only.",
          exactText: "acute bronchitis only",
          date: `${review.calendarYear}-05-11`,
          category: "potentialDelete" as const,
          conditionIds: ["cond-100-b"],
          summary: "Imaging acute-condition and quality-exclusion example."
        }
      ]
    : []),
  ...(review.id === "rev-113"
    ? [
        {
          id: `ev-${review.id}-lookback-2025`,
          reviewId: review.id,
          documentId: `doc-${review.id}-claim-2025`,
          anchorId: `sec-${review.id}-claim-2025`,
          sectionId: `sec-${review.id}-claim-2025`,
          text: "Prior-year claim listed HCC 280 for COPD recapture review.",
          exactText: "HCC 280 for COPD",
          date: "2025-10-20",
          category: "prospective" as const,
          subtype: "recapture" as const,
          conditionIds: ["cond-113-a"],
          summary: "2025 claim lookback evidence for HCC 280."
        },
        {
          id: `ev-${review.id}-lookback-2024`,
          reviewId: review.id,
          documentId: `doc-${review.id}-specialist-2024`,
          anchorId: `sec-${review.id}-specialist-2024`,
          sectionId: `sec-${review.id}-specialist-2024`,
          text: "Pulmonary specialist note carried forward a COPD history for lookback review.",
          exactText: "COPD history",
          date: "2024-09-12",
          category: "prospective" as const,
          subtype: "recapture" as const,
          conditionIds: ["cond-113-a"],
          summary: "2024 specialist lookback evidence for COPD."
        },
        {
          id: `ev-${review.id}-lookback-2023`,
          reviewId: review.id,
          documentId: `doc-${review.id}-mor-2023`,
          anchorId: `sec-${review.id}-mor-2023`,
          sectionId: `sec-${review.id}-mor-2023`,
          text: "MOR lookback entry includes prior HCC 280 recapture context.",
          exactText: "prior HCC 280",
          date: "2023-12-01",
          category: "prospective" as const,
          subtype: "recapture" as const,
          conditionIds: ["cond-113-a"],
          summary: "2023 MOR lookback evidence for HCC 280."
        }
      ]
    : []),
  ...(review.id === "rev-114"
    ? [
        {
          id: `ev-${review.id}-acute-2025`,
          reviewId: review.id,
          documentId: `doc-${review.id}-acute-2025`,
          anchorId: `sec-${review.id}-acute-2025`,
          sectionId: `sec-${review.id}-acute-2025`,
          text: "Discharge summary documents acute respiratory failure during hospitalization, resolved before outpatient follow-up.",
          exactText: "resolved before outpatient follow-up",
          date: "2025-11-03",
          category: "prospective" as const,
          subtype: "recapture" as const,
          conditionIds: ["cond-114-a"],
          summary: "2025 acute-only lookback evidence excluded from recapture."
        }
      ]
    : []),
  ...(review.id === "rev-115"
    ? [
        {
          id: `ev-${review.id}-quality`,
          reviewId: review.id,
          documentId: `doc-${review.id}-quality`,
          anchorId: `sec-${review.id}-quality`,
          sectionId: `sec-${review.id}-quality`,
          text: "Payer quality file lists Z55.0 for social context reporting with no HCC diagnosis attached.",
          exactText: "Z55.0 for social context reporting",
          date: "2026-04-18",
          category: "potentialDelete" as const,
          conditionIds: ["cond-115-a"],
          summary: "Current-year payer quality-exclusion context."
        }
      ]
    : []),
  ...(review.id === "rev-116"
    ? [
        {
          id: `ev-${review.id}-hierarchy-lower`,
          reviewId: review.id,
          documentId: `doc-${review.id}-hierarchy`,
          anchorId: `sec-${review.id}-hierarchy`,
          sectionId: `sec-${review.id}-hierarchy`,
          text: "Specialist documentation supports E11.311 as the more specific diabetes eye complication code while the lower opportunity remains visible.",
          exactText: "lower opportunity remains visible",
          date: "2026-04-22",
          category: "potentialAddition" as const,
          conditionIds: ["cond-116-a"],
          summary: "Lower diabetes eye complication opportunity kept visible."
        },
        {
          id: `ev-${review.id}-hierarchy-higher`,
          reviewId: review.id,
          documentId: `doc-${review.id}-hierarchy`,
          anchorId: `sec-${review.id}-hierarchy`,
          sectionId: `sec-${review.id}-hierarchy`,
          text: "Specialist documentation supports E11.311 as the more specific diabetes eye complication code while the lower opportunity remains visible.",
          exactText: "E11.311 as the more specific diabetes eye complication code",
          date: "2026-04-22",
          category: "validated" as const,
          conditionIds: ["cond-116-b"],
          summary: "Higher-specificity diabetes eye complication evidence."
        }
      ]
    : [])
]);

const disposed = (action: "Validate" | "Add to Claim" | "Yes" | "Delete", userId = "u-coder-2") => ({
  action,
  userId,
  decidedAt: "2026-06-22T14:15:00.000Z",
  agreedWithRecommendation: true,
  source: "user-selected" as const
});

const explicitConditionReviewIds = new Set(["rev-100", "rev-110", "rev-111", "rev-111-support", "rev-112", "rev-113", "rev-114", "rev-115", "rev-116"]);

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
    trumpedByCode: "E11.311",
    seededRecommendation: {
      action: "Change",
      confidence: "Medium",
      source: "seeded",
      replacementCode: "E11.311",
      rationale: "Specialist evidence suggests a more specific diabetes eye complication code."
    },
    documentationIssues: []
  },
  {
    id: "cond-110-a",
    reviewId: "rev-110",
    workflow: "codesOnClaim",
    category: "validated",
    icd10: "N18.4",
    description: "Chronic kidney disease, stage 4",
    hcc: "HCC 328",
    raf: 0.289,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-110-a"],
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
    id: "cond-110-b",
    reviewId: "rev-110",
    workflow: "codesOnClaim",
    category: "validated",
    icd10: "E11.22",
    description: "Type 2 DM with diabetic chronic kidney disease",
    hcc: "HCC 328",
    raf: 0.299,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-110-a", "ev-rev-110-d"],
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
    id: "cond-110-c",
    reviewId: "rev-110",
    workflow: "codesOnClaim",
    category: "validated",
    icd10: "N18.32",
    description: "Chronic kidney disease, stage 3b",
    hcc: "HCC 328",
    raf: 0.244,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-110-b", "ev-rev-110-f"],
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
    id: "cond-110-d",
    reviewId: "rev-110",
    workflow: "codesOnClaim",
    category: "potentialDelete",
    icd10: "N18.9",
    description: "Chronic kidney disease, unspecified",
    hcc: "HCC 328",
    raf: 0.186,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-110-e"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: false,
    hadPriorCapture: true,
    hasCurrentYearCapture: true,
    hasClinicalIndicators: true,
    documentationIssues: []
  },
  {
    id: "cond-111-a",
    reviewId: "rev-111",
    workflow: "codesOnClaim",
    category: "potentialDelete",
    icd10: "I50.32",
    description: "Chronic diastolic heart failure",
    hcc: "HCC 222",
    raf: 0.323,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-111-e"],
    supportingEvidenceIds: ["ev-rev-111-support-a"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: false,
    hadPriorCapture: true,
    hasCurrentYearCapture: true,
    hasClinicalIndicators: true,
    documentationIssues: []
  },
  {
    id: "cond-111-b",
    reviewId: "rev-111-support",
    workflow: "codesOnClaim",
    category: "validated",
    icd10: "I50.33",
    description: "Acute-on-chronic diastolic heart failure",
    hcc: "HCC 222",
    raf: 0.323,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-111-support-a"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: true,
    hasOtherSupportingEvidence: true,
    hadPriorCapture: true,
    hasCurrentYearCapture: true,
    hasClinicalIndicators: true,
    disposition: disposed("Validate"),
    documentationIssues: []
  },
  {
    id: "cond-112-a",
    reviewId: "rev-112",
    workflow: "codesOnClaim",
    category: "potentialDelete",
    icd10: "E66.01",
    description: "Morbid obesity due to excess calories",
    hcc: "HCC 48",
    raf: 0.186,
    claimStatus: "On claim",
    sourceDate: "2026-04-12",
    evidenceIds: ["ev-rev-112-e"],
    conflictingEvidenceIds: ["ev-rev-112-d"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: false,
    hadPriorCapture: true,
    hasCurrentYearCapture: true,
    hasClinicalIndicators: true,
    conflictingEvidence: true,
    documentationIssues: []
  },
  {
    id: "cond-113-a",
    reviewId: "rev-113",
    workflow: "prospective",
    category: "prospective",
    subtype: "recapture",
    icd10: "J44.9",
    description: "Chronic obstructive pulmonary disease",
    hcc: "HCC 280",
    raf: 0.214,
    claimStatus: "Historical",
    sourceDate: "2025-10-20",
    evidenceIds: ["ev-rev-113-lookback-2025", "ev-rev-113-lookback-2024", "ev-rev-113-lookback-2023"],
    lookbackEvidenceIds: ["ev-rev-113-lookback-2025", "ev-rev-113-lookback-2024", "ev-rev-113-lookback-2023"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: true,
    hadPriorCapture: true,
    hasCurrentYearCapture: false,
    hasClinicalIndicators: true,
    documentationIssues: []
  },
  {
    id: "cond-114-a",
    reviewId: "rev-114",
    workflow: "prospective",
    category: "prospective",
    subtype: "recapture",
    icd10: "J20.9",
    description: "Acute bronchitis, acute-only lookback",
    hcc: "HCC 280",
    raf: 0.214,
    claimStatus: "Historical",
    sourceDate: "2025-11-03",
    evidenceIds: ["ev-rev-114-acute-2025"],
    lookbackEvidenceIds: ["ev-rev-114-acute-2025"],
    persistence: "acute",
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: false,
    hadPriorCapture: true,
    hasCurrentYearCapture: false,
    hasClinicalIndicators: false,
    acuteCondition: true,
    documentationIssues: []
  },
  {
    id: "cond-115-a",
    reviewId: "rev-115",
    workflow: "codesOnClaim",
    category: "potentialDelete",
    icd10: "Z13.89",
    description: "Quality-exclusion screening context",
    hcc: "HCC 48",
    raf: 0.186,
    claimStatus: "On claim",
    sourceDate: "2026-04-18",
    evidenceIds: ["ev-rev-115-quality"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: false,
    hasOtherSupportingEvidence: false,
    hadPriorCapture: false,
    hasCurrentYearCapture: false,
    hasClinicalIndicators: false,
    qualityExclusionCode: true,
    trustedCodeMetadata: true,
    documentationIssues: []
  },
  {
    id: "cond-116-a",
    reviewId: "rev-116",
    workflow: "codesNotOnClaim",
    category: "potentialAddition",
    icd10: "E11.51",
    description: "Type 2 DM with diabetic peripheral angiopathy",
    hcc: "HCC 37",
    raf: 0.318,
    claimStatus: "Not on claim",
    sourceDate: "2026-04-22",
    evidenceIds: ["ev-rev-116-hierarchy-lower"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: true,
    hasOtherSupportingEvidence: true,
    hadPriorCapture: false,
    hasCurrentYearCapture: false,
    hasClinicalIndicators: true,
    trumpedByCode: "E11.311",
    documentationIssues: []
  },
  {
    id: "cond-116-b",
    reviewId: "rev-116",
    workflow: "codesOnClaim",
    category: "validated",
    icd10: "E11.311",
    description: "Type 2 DM with unspecified diabetic retinopathy with macular edema",
    hcc: "HCC 37",
    raf: 0.318,
    claimStatus: "On claim",
    sourceDate: "2026-04-22",
    evidenceIds: ["ev-rev-116-hierarchy-higher"],
    actionable: true,
    currentYear: true,
    hasSufficientMeat: true,
    hasOtherSupportingEvidence: true,
    hadPriorCapture: true,
    hasCurrentYearCapture: true,
    hasClinicalIndicators: true,
    disposition: disposed("Validate", "u-coder-3"),
    documentationIssues: []
  },
  ...reviews
    .filter((review) => !explicitConditionReviewIds.has(review.id))
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
          acuteCondition: review.id === "rev-107",
          qualityExclusionCode: review.id === "rev-109",
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
          trumpedByCode: review.id === "rev-106" ? "J44.89" : undefined,
          seededRecommendation: extraIndex % 2 === 1
            ? { action: "Yes", confidence: "Medium", source: "seeded", rationale: "Registry and specialist pattern support physician-facing suspect review." }
            : undefined,
          documentationIssues: []
        }))
      ];
    })
];

export const claims: Claim[] = reviews.map((review) => ({
  id: `claim-${review.id}`,
  reviewId: review.id,
  dateOfService: `${review.calendarYear}-04-12`,
  riskEligible: true,
  cptSourceEligible: review.id !== "rev-103",
  providerTypeEligible: review.id !== "rev-106",
  faceToFace: review.id !== "rev-107",
  providerSignatureValid: review.id !== "rev-108",
  icd10Codes: review.conditionIds
    .slice(0, 2)
    .map((id) => conditions.find((condition) => condition.id === id)?.icd10)
    .filter((code): code is string => Boolean(code))
}));

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
    seededExample: true,
    rows: [{ memberId: "HB-204481", icd10: "N18.4", hcc: "HCC 328", note: "Simulated delete-file row" }]
  },
  {
    id: "export-asm-demo",
    type: "Payer ASM export",
    createdAt: "2026-06-22T15:05:00.000Z",
    seededExample: true,
    rows: [{ memberId: "SM-390114", icd10: "E66.01", payer: "Summit Medicare Advantage", profile: "SUMMIT-ASM-V2" }]
  }
];

const seedUserIdMap: Record<string, string> = {
  "u-admin": "u-admin",
  "u-manager-1": "u-manager-1",
  "u-manager-2": "u-manager-1",
  "u-auditor-1": "u-auditor-1",
  "u-auditor-2": "u-auditor-1",
  "u-coder-1": "u-coder-1",
  "u-coder-2": "u-coder-2",
  "u-coder-3": "u-coder-3",
  "u-coder-4": "u-coder-4",
  "u-coder-5": "u-coder-1",
  "u-coder-6": "u-coder-1",
  "u-cdi-1": "u-coder-1",
  "u-cdi-2": "u-coder-2",
  "u-cdi-3": "u-coder-3",
  "u-cdi-4": "u-coder-4",
  "u-cdi-5": "u-coder-4"
};

function seedUserId(id: string | undefined) {
  return id ? seedUserIdMap[id] ?? id : id;
}

function richDocumentsFor(review: PatientReview): SourceDocument[] {
  const noteDate = `${review.calendarYear}-04-12`;
  const labDate = `${review.calendarYear}-03-05`;
  const patientName = patients.find((patient) => patient.id === review.patientId)?.name ?? "the member";
  const reviewConditions = review.conditionIds.map((id) => clinicalSeedConditions.find((condition) => condition.id === id)).filter(Boolean) as Condition[];
  const reviewEvidence = enrichedEvidence.filter((item) => item.reviewId === review.id);
  const hpiEvidenceIds = reviewEvidence.filter((item) => item.chartAnchor?.tab === "encounters" && item.chartAnchor.sectionId === "hpi").map((item) => item.id);
  const planEvidenceIds = reviewEvidence.filter((item) => item.chartAnchor?.tab === "encounters" && item.chartAnchor.sectionId === "assessmentPlan").map((item) => item.id);
  const firstLabEvidenceIds = reviewEvidence.filter((item) => item.chartAnchor?.tab === "labs" && item.anchorId.endsWith("lab-1")).map((item) => item.id);
  const secondLabEvidenceIds = reviewEvidence.filter((item) => item.chartAnchor?.tab === "labs" && item.anchorId.endsWith("lab-2")).map((item) => item.id);
  const historyEvidence = reviewEvidence.filter((item) => item.chartAnchor?.tab === "claims");
  const currentVitals = clinicalVitalsForConditions(reviewConditions);
  const hpi = clinicalHpi(patientName, reviewConditions);
  const assessment = reviewConditions
    .slice(0, 6)
    .map((condition, index) => `${index + 1}. ${condition.description} (${condition.icd10}) - ${assessmentPlanTextForCondition(condition)}`)
    .join(" ");
  const labSummary = reviewConditions
    .slice(0, 4)
    .flatMap((condition) => clinicalProfileForCondition(condition).labResults)
    .map((result) => `${result.component} ${result.value} ${result.unit}`.trim())
    .join("; ");
  return [
    {
      id: `doc-${review.id}-note`,
      reviewId: review.id,
      type: "Progress Note",
      title: `${review.calendarYear} embedded EMR progress note`,
      date: noteDate,
      isCurrentYear: true,
      cptSourceEligible: true,
      providerTypeEligible: true,
      faceToFace: true,
      providerSignatureValid: true,
      sections: [
        section(`sec-${review.id}-note-1`, "Chief complaint: chronic condition follow-up and medication reconciliation.", []),
        section(
          `sec-${review.id}-note-2`,
          hpi,
          hpiEvidenceIds
        ),
        section(`sec-${review.id}-note-ros`, clinicalReviewOfSystems(reviewConditions).join(" "), []),
        section(`sec-${review.id}-note-exam`, clinicalPhysicalExam(reviewConditions).map((item) => `${item.system}: ${item.text}`).join(" "), []),
        section(
          `sec-${review.id}-note-3`,
          `Assessment and plan: ${assessment}`,
          planEvidenceIds
        )
      ]
    },
    {
      id: `doc-${review.id}-lab`,
      reviewId: review.id,
      type: "Lab",
      title: `${review.calendarYear} labs and vitals`,
      date: labDate,
      isCurrentYear: true,
      sections: [
        section(`sec-${review.id}-lab-1`, `Vitals: BP 138/76, HR 72, BMI ${currentVitals.bmi}, O2 saturation 95%. Labs: ${labSummary || "CBC and CMP reviewed."}`, firstLabEvidenceIds),
        section(`sec-${review.id}-lab-2`, `Abnormal values requiring clinical interpretation: ${labSummary || "none flagged in this synthetic chart."}`, secondLabEvidenceIds)
      ]
    },
    {
      id: `doc-${review.id}-history`,
      reviewId: review.id,
      type: "Claims",
      title: "Claims, MOR, payer registry, and HIE lookback",
      date: `${review.calendarYear - 1}-10-20`,
      isCurrentYear: false,
      sections: [
        section(
          `sec-${review.id}-hist-1`,
          `Prior-year claims, registry entries, specialist referrals, and HIE records are listed with date of service, provider, CPT 99214 or G0439, diagnosis codes, payer, eligible encounter type, provider type, face-to-face status, and signature status. ${historyEvidence.map((item) => item.exactText ?? item.text).join(" ")}`.trim(),
          historyEvidence.map((item) => item.id)
        ),
        section(`sec-${review.id}-hist-2`, "MOR / payer data: prior HCCs, registry entries, and HIE records are listed separately from the current encounter note.", [])
      ]
    },
    {
      id: `doc-${review.id}-meds`,
      reviewId: review.id,
      type: "Registry",
      title: "Medication list, problem list, PMH, imaging, and specialist notes",
      date: `${review.calendarYear}-04-01`,
      isCurrentYear: true,
      sections: [
        section(`sec-${review.id}-problem`, "Problem list: diabetes with complication, chronic kidney disease, heart failure history, hypertension, hyperlipidemia, and depression screening where applicable.", []),
        section(`sec-${review.id}-pmh`, "Past medical history: Medicare Advantage member with chronic disease management, specialist involvement, and prior chronic diagnoses.", []),
        section(`sec-${review.id}-medications`, "Medications: metformin, lisinopril, atorvastatin, carvedilol, furosemide, inhalers, and condition-specific therapy were reconciled during the visit.", []),
        section(`sec-${review.id}-imaging`, "Imaging / specialist notes: echo, renal ultrasound, chest imaging, nephrology, cardiology, pulmonology, and behavioral health snippets appear when relevant.", [])
      ]
    }
  ];
}

function enrichDocuments(seedDocuments: SourceDocument[]) {
  const baseDocumentIds = new Set(reviews.flatMap((review) => [`doc-${review.id}-note`, `doc-${review.id}-lab`, `doc-${review.id}-history`]));
  const preservedSpecialDocuments = seedDocuments.filter((document) => !baseDocumentIds.has(document.id));
  const generatedBase = reviews.flatMap(richDocumentsFor);
  return [...generatedBase, ...preservedSpecialDocuments];
}

function enrichClaims(seedClaims: Claim[], seedEvidence: EvidencePassage[]): Claim[] {
  return seedClaims.map((claim) => {
    const review = reviews.find((item) => item.id === claim.reviewId);
    const provider = review ? providers.find((item) => item.id === review.providerId) : undefined;
    const patient = review ? patients.find((item) => item.id === review.patientId) : undefined;
    const payer = patient ? payers.find((item) => item.id === patient.payerId) : undefined;
    const claimEvidenceText = seedEvidence
      .filter((item) => item.reviewId === claim.reviewId && item.chartAnchor?.tab === "claims")
      .map((item) => item.exactText ?? item.text)
      .filter(Boolean);
    return {
      ...claim,
      provider: provider?.name,
      cptCode: claim.cptSourceEligible ? "99214" : "99490",
      encounterType: claim.cptSourceEligible ? "Established patient office visit" : "Care management/non-face-to-face review",
      payer: payer?.name,
      supportSummary: claimEvidenceText.length
        ? claimEvidenceText.join(" ")
        : `${claim.dateOfService} claim from ${provider?.name ?? "rendering provider"}; ICD-10 codes: ${claim.icd10Codes.length ? claim.icd10Codes.join(", ") : "none listed"}.`
    };
  });
}

function chartAnchorForEvidence(evidence: EvidencePassage): NonNullable<EvidencePassage["chartAnchor"]> {
  if (evidence.id.includes("specialist") || evidence.id.includes("hierarchy")) {
    return { tab: "specialist-notes", itemId: `chart-${evidence.reviewId}-specialist`, sectionId: "note" };
  }
  if (evidence.id.includes("imaging") || evidence.id.includes("pathology") || evidence.id.includes("acute")) {
    return { tab: "imaging", itemId: `chart-${evidence.reviewId}-imaging`, sectionId: "findings" };
  }
  if (evidence.id.includes("claim") || evidence.id.includes("mor") || evidence.id.includes("payer") || evidence.id.includes("registry") || evidence.id.includes("hie") || evidence.id.includes("lookback") || evidence.id.includes("quality") || evidence.id.endsWith("-f")) {
    return { tab: "claims", itemId: `claim-${evidence.reviewId}` };
  }
  if (evidence.id.endsWith("-d") || evidence.id.endsWith("-e")) {
    return { tab: "labs", itemId: `chart-${evidence.reviewId}-panel-risk` };
  }
  if (evidence.id.endsWith("-a")) {
    return { tab: "encounters", itemId: `chart-${evidence.reviewId}-encounter-current`, sectionId: "assessmentPlan" };
  }
  if (evidence.id.endsWith("-c")) {
    return { tab: "encounters", itemId: `chart-${evidence.reviewId}-encounter-current`, sectionId: "hpi" };
  }
  return { tab: "encounters", itemId: `chart-${evidence.reviewId}-encounter-current`, sectionId: "hpi" };
}

function enrichEvidence(seedEvidence: EvidencePassage[]): EvidencePassage[] {
  const conditionMap = new Map(conditions.map((condition) => [condition.id, condition]));
  return seedEvidence.map((item) => {
    const chartAnchor = item.chartAnchor ?? chartAnchorForEvidence(item);
    const evidenceConditions = item.conditionIds.map((id) => conditionMap.get(id)).filter(Boolean) as Condition[];
    const condition = evidenceConditions.find((candidate) => candidate.reviewId === item.reviewId) ?? evidenceConditions[0];
    if (!condition) return { ...item, chartAnchor };

    const sourceType = item.sourceType ?? sourceTypeForEvidence({ ...item, chartAnchor });
    const evidenceStrength = item.evidenceStrength ?? inferEvidenceStrength(condition, item.category, sourceType);
    const generatedClinicalEvidence = /-rev-\d+(?:-support)?-(a|b|c|d|e|f)$/.test(item.id);
    const exactText = generatedClinicalEvidence ? clinicalExactTextForSource(condition, sourceType) : (item.exactText ?? clinicalExactTextForSource(condition, sourceType));
    const sourceLocation = item.sourceLocation ?? sourceLocationFor(sourceType);
    const documentSectionId = generatedClinicalEvidence
      ? chartAnchor.tab === "encounters"
        ? `sec-${item.reviewId}-note-${chartAnchor.sectionId === "assessmentPlan" ? "3" : "2"}`
        : chartAnchor.tab === "labs"
          ? `sec-${item.reviewId}-lab-${item.id.endsWith("-e") ? "2" : "1"}`
          : chartAnchor.tab === "claims"
            ? `sec-${item.reviewId}-hist-1`
            : item.sectionId ?? item.anchorId
      : item.sectionId ?? item.anchorId;
    return {
      ...item,
      anchorId: documentSectionId,
      sectionId: documentSectionId,
      chartAnchor,
      text: generatedClinicalEvidence ? exactText : item.text,
      exactText,
      sourceType,
      sourceLocation,
      evidenceStrength,
      meatType: item.meatType ?? meatTypesForSource(sourceType, evidenceStrength),
      currentYearSupport: item.currentYearSupport ?? ["strongCurrentYearMEAT", "assessmentWithPlan", "treatmentEvidence", "monitoringEvidence"].includes(evidenceStrength),
      historicalOnly: item.historicalOnly ?? ["historicalOnly", "historicalClaimOnly", "specialistHistoricalOnly", "recapture"].includes(evidenceStrength),
      suspectOnly: item.suspectOnly ?? (evidenceStrength === "suspect" || item.subtype === "suspect"),
      recaptureOnly: item.recaptureOnly ?? (item.subtype === "recapture" && !["strongCurrentYearMEAT", "assessmentWithPlan"].includes(evidenceStrength)),
      reviewerExplanation: item.reviewerExplanation ?? reviewerExplanationForEvidence(condition, sourceType, evidenceStrength),
      summary: generatedClinicalEvidence ? `${evidenceStrengthLabel(evidenceStrength)} - ${sourceLocation}` : item.summary
    };
  });
}

function allDeclaredEvidenceIds(condition: Condition) {
  return uniqueStrings([
    ...condition.evidenceIds,
    ...(condition.supportingEvidenceIds ?? []),
    ...(condition.conflictingEvidenceIds ?? []),
    ...(condition.lookbackEvidenceIds ?? [])
  ]);
}

function alignEvidenceOwners(seedEvidence: EvidencePassage[], seedConditions: Condition[], allowUndeclaredReviewIds: Set<string>) {
  const declaredByCondition = new Map(seedConditions.map((condition) => [condition.id, new Set(allDeclaredEvidenceIds(condition))]));
  return seedEvidence.map((item) => {
    const declaredOwners = seedConditions
      .filter((condition) => declaredByCondition.get(condition.id)?.has(item.id))
      .map((condition) => condition.id);
    return {
      ...item,
      conditionIds: declaredOwners.length
        ? declaredOwners
        : allowUndeclaredReviewIds.has(item.reviewId) || !/-rev-\d+(?:-support)?-(a|b|c|d|e|f)$/.test(item.id)
          ? uniqueStrings(item.conditionIds)
          : []
    };
  });
}

function alignConditionEvidence(seedConditions: Condition[], seedEvidence: EvidencePassage[]) {
  return seedConditions.map((condition) => ({
    ...condition,
    evidenceIds: seedEvidence.filter((item) => item.conditionIds.includes(condition.id)).map((item) => item.id)
  }));
}

function generatedEvidenceForCondition(condition: Condition): EvidencePassage[] {
  const review = reviews.find((item) => item.id === condition.reviewId);
  if (!review) return [];
  const profile = clinicalProfileForCondition(condition);
  const primarySourceType = condition.hasSufficientMeat ? "planSentence" : "hpiSentence";
  const primaryText = clinicalExactTextForSource(condition, primarySourceType);
  const primarySection = condition.hasSufficientMeat ? "assessmentPlan" : "hpi";
  const primaryDocumentSection = `sec-${review.id}-note-${condition.hasSufficientMeat ? "3" : "2"}`;
  const primary: EvidencePassage = {
    id: `ev-${condition.id}-${condition.hasSufficientMeat ? "plan" : "hpi"}`,
    reviewId: review.id,
    documentId: `doc-${review.id}-note`,
    anchorId: primaryDocumentSection,
    sectionId: primaryDocumentSection,
    text: primaryText,
    exactText: primaryText,
    date: `${review.calendarYear}-04-12`,
    category: condition.category,
    subtype: condition.subtype,
    conditionIds: [condition.id],
    summary: condition.hasSufficientMeat ? "Current assessment and plan documentation." : "Current interval history documentation.",
    sourceType: primarySourceType,
    chartAnchor: { tab: "encounters", itemId: `chart-${review.id}-encounter-current`, sectionId: primarySection }
  };
  const firstLab = profile.labResults[0];
  const labText = firstLab ? `${firstLab.component} ${firstLab.value} ${firstLab.unit}`.trim() : profile.hpi;
  const lab: EvidencePassage = {
    id: `ev-${condition.id}-lab-1`,
    reviewId: review.id,
    documentId: `doc-${review.id}-lab`,
    anchorId: `sec-${review.id}-lab-1`,
    sectionId: `sec-${review.id}-lab-1`,
    text: labText,
    exactText: labText,
    date: `${review.calendarYear}-03-05`,
    category: condition.category,
    subtype: condition.subtype,
    conditionIds: [condition.id],
    summary: "Condition-specific clinical measurement.",
    sourceType: "labResultRow",
    chartAnchor: { tab: "labs", itemId: `chart-${review.id}-panel-risk` }
  };
  const claimText = clinicalExactTextForSource(condition, "claimLine");
  const claim: EvidencePassage = {
    id: `ev-${condition.id}-claim`,
    reviewId: review.id,
    documentId: `doc-${review.id}-history`,
    anchorId: `sec-${review.id}-hist-1`,
    sectionId: `sec-${review.id}-hist-1`,
    text: claimText,
    exactText: claimText,
    date: `${review.calendarYear - 1}-10-20`,
    category: condition.category,
    subtype: condition.subtype,
    conditionIds: [condition.id],
    summary: "Claim-line context for the selected condition.",
    sourceType: "claimLine",
    chartAnchor: { tab: "claims", itemId: `claim-${review.id}`, sectionId: "support" }
  };
  return [primary, lab, claim];
}

function medicationForCondition(condition: Condition, providerName: string, evidenceIds: string[]) {
  const medication = clinicalProfileForCondition(condition).medication;
  return { ...medication, id: `chart-${condition.reviewId}-med-${condition.id}`, prescriber: providerName, evidenceIds };
}

function riskLabRows(reviewId: string, reviewEvidence: EvidencePassage[], reviewConditions: Condition[]) {
  const rows = reviewConditions.flatMap((condition) => {
    return clinicalProfileForCondition(condition).labResults.map((result, index) => ({
      ...result,
      id: `chart-${reviewId}-lab-${condition.id}-${index}`,
      evidenceIds: reviewEvidence
        .filter(
          (item) =>
            item.conditionIds.includes(condition.id) &&
            item.chartAnchor?.tab === "labs" &&
            (item.exactText ?? item.text).includes(`${result.component} ${result.value}`)
        )
        .map((item) => item.id)
    }));
  });
  const rowsByFact = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.component}-${row.value}-${row.unit}`;
    const existing = rowsByFact.get(key);
    if (existing) existing.evidenceIds = uniqueStrings([...existing.evidenceIds, ...row.evidenceIds]);
    else rowsByFact.set(key, { ...row, evidenceIds: [...row.evidenceIds] });
  }
  return [...rowsByFact.values()];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function bmiForWeight(weightPounds: number, heightInches: number) {
  return Math.round(((703 * weightPounds) / heightInches ** 2) * 10) / 10;
}

function clinicalVitalsForConditions(reviewConditions: Condition[]) {
  const configured = reviewConditions
    .map((condition) => clinicalProfileForCondition(condition).currentVitals)
    .find((value) => value !== undefined);
  const weight = configured?.weightPounds ?? 189;
  const height = configured?.heightInches ?? 65;
  return { weight, height, bmi: bmiForWeight(weight, height) };
}

function clinicalHpi(patientName: string, reviewConditions: Condition[]) {
  const conditionHpies = reviewConditions.slice(0, 6).map((condition) => clinicalProfileForCondition(condition).hpi);
  return [
    `HPI: ${patientName} presents for chronic condition follow-up and medication reconciliation.`,
    ...uniqueStrings(conditionHpies)
  ].join(" ");
}

function clinicalReviewOfSystems(reviewConditions: Condition[]) {
  const rows = reviewConditions.flatMap((condition) => clinicalProfileForCondition(condition).ros);
  return uniqueStrings(rows).slice(0, 7);
}

function clinicalPhysicalExam(reviewConditions: Condition[]) {
  const rows = reviewConditions.flatMap((condition) => clinicalProfileForCondition(condition).exam);
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.system}-${row.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 7);
}

function buildClinicalCharts(seedReviews: PatientReview[], seedEvidence: EvidencePassage[], seedClaims: Claim[]): ClinicalChart[] {
  return seedReviews.map((review) => {
    const provider = providers.find((item) => item.id === review.providerId);
    const providerName = provider?.name ?? "Primary Care Provider";
    const patient = patients.find((item) => item.id === review.patientId);
    const patientName = patient?.name ?? "the member";
    const reviewEvidence = seedEvidence.filter((item) => item.reviewId === review.id);
    const conditionMap = new Map(clinicalSeedConditions.map((condition) => [condition.id, condition]));
    const reviewConditions = review.conditionIds.map((id) => conditionMap.get(id)).filter(Boolean) as Condition[];
    const clinicalVitals = clinicalVitalsForConditions(reviewConditions);
    const currentCreatinine = reviewConditions
      .flatMap((condition) => clinicalProfileForCondition(condition).labResults)
      .find((result) => result.component === "Creatinine");
    const primaryProfile = clinicalProfileForCondition(reviewConditions[0] ?? clinicalSeedConditions[0]);
    const imagingEvidence = reviewEvidence.filter((item) => item.chartAnchor?.tab === "imaging");
    const conditionEvidenceIds = (condition: Condition) => reviewEvidence.filter((item) => item.conditionIds.includes(condition.id)).map((item) => item.id);
    const hpiEvidenceIds = reviewEvidence.filter((item) => item.chartAnchor?.tab === "encounters" && item.chartAnchor.sectionId === "hpi").map((item) => item.id);
    const planEvidenceIds = reviewEvidence.filter((item) => item.chartAnchor?.tab === "encounters" && item.chartAnchor.sectionId === "assessmentPlan").map((item) => item.id);
    const claimEvidenceIds = reviewEvidence.filter((item) => item.chartAnchor?.tab === "claims").map((item) => item.id);
    const currentVital = {
      id: `chart-${review.id}-vital-current`,
      date: `${review.calendarYear}-04-12`,
      systolic: 138,
      diastolic: 76,
      heartRate: 72,
      temperature: 98.4,
      weight: clinicalVitals.weight,
      height: clinicalVitals.height,
      bmi: clinicalVitals.bmi,
      oxygenSaturation: 95,
      evidenceIds: reviewEvidence.filter((item) => item.chartAnchor?.tab === "vitals").map((item) => item.id)
    };
    const priorVital = {
      ...currentVital,
      id: `chart-${review.id}-vital-prior`,
      date: `${review.calendarYear - 1}-10-20`,
      systolic: 146,
      diastolic: 82,
      heartRate: 78,
      weight: clinicalVitals.weight + 8,
      bmi: bmiForWeight(clinicalVitals.weight + 8, clinicalVitals.height),
      evidenceIds: []
    };
    const preventiveVital = {
      ...currentVital,
      id: `chart-${review.id}-vital-preventive`,
      date: `${review.calendarYear}-02-08`,
      systolic: 132,
      diastolic: 74,
      heartRate: 70,
      weight: clinicalVitals.weight + 3,
      bmi: bmiForWeight(clinicalVitals.weight + 3, clinicalVitals.height),
      oxygenSaturation: 96,
      evidenceIds: []
    };
    const intervalVital = {
      ...currentVital,
      id: `chart-${review.id}-vital-interval`,
      date: `${review.calendarYear - 1}-07-16`,
      systolic: 142,
      diastolic: 80,
      heartRate: 76,
      temperature: 98.1,
      weight: clinicalVitals.weight + 11,
      bmi: bmiForWeight(clinicalVitals.weight + 11, clinicalVitals.height),
      oxygenSaturation: 95,
      evidenceIds: []
    };
    const baselineVital = {
      ...currentVital,
      id: `chart-${review.id}-vital-baseline`,
      date: `${review.calendarYear - 2}-11-04`,
      systolic: 150,
      diastolic: 84,
      heartRate: 80,
      temperature: 98.6,
      weight: clinicalVitals.weight + 18,
      bmi: bmiForWeight(clinicalVitals.weight + 18, clinicalVitals.height),
      oxygenSaturation: 94,
      evidenceIds: []
    };
    const assessmentPlanConditions = reviewConditions.filter((condition) => condition.hasSufficientMeat).slice(0, 6);
    const assessmentPlan = assessmentPlanConditions.map((condition) => ({
      id: condition.id === "cond-100-c" ? `chart-${review.id}-plan-open-items` : `chart-${review.id}-plan-${condition.id}`,
      problem: `${condition.description} (${condition.icd10})`,
      code: condition.icd10,
      detail: assessmentPlanTextForCondition(condition),
      evidenceIds: condition.evidenceIds.filter((id) => planEvidenceIds.includes(id))
    }));
    const historicalAssessmentPlan = (suffix: string, direction: string, evidenceIds: string[] = []) =>
      assessmentPlan.map((item) => ({
        ...item,
        id: `${item.id}-${suffix}`,
        detail: `${direction} ${item.problem}. Medication adherence and follow-up precautions were reviewed with the patient.`,
        evidenceIds
      }));
    const encounters = [
      {
        id: `chart-${review.id}-encounter-current`,
        date: `${review.calendarYear}-04-12`,
        type: "Established patient chronic care follow-up",
        provider: providerName,
        quality: "good" as const,
        chiefComplaint: "Chronic condition follow-up and medication reconciliation.",
        hpi: clinicalHpi(patientName, reviewConditions),
        reviewOfSystems: clinicalReviewOfSystems(reviewConditions),
        physicalExam: clinicalPhysicalExam(reviewConditions),
        vitals: currentVital,
        assessmentPlan,
        signatureTime: "4:15 PM",
        billingCode: "99214",
        evidenceIds: [...hpiEvidenceIds, ...planEvidenceIds],
        sectionEvidenceIds: { hpi: hpiEvidenceIds, assessmentPlan: planEvidenceIds, billing: claimEvidenceIds }
      },
      {
        id: `chart-${review.id}-encounter-preventive`,
        date: `${review.calendarYear}-02-08`,
        type: "Annual wellness and preventive care visit",
        provider: providerName,
        quality: "good" as const,
        chiefComplaint: "Annual wellness visit with preventive screening and chronic-care review.",
        hpi: `${patientName} completed an annual wellness evaluation. Functional status, fall risk, medication access, preventive screening gaps, and chronic disease self-management were reviewed. No acute cardiopulmonary complaints were reported.`,
        reviewOfSystems: ["Constitutional: No fever, chills, or unintentional weight loss.", "Cardiovascular: No chest pain or new edema.", "Respiratory: No new cough or dyspnea.", "Neurologic: No dizziness, syncope, or focal weakness."],
        physicalExam: clinicalPhysicalExam(reviewConditions).slice(0, 5),
        vitals: preventiveVital,
        assessmentPlan: historicalAssessmentPlan("preventive", "Continue longitudinal monitoring for"),
        signatureTime: "11:42 AM",
        billingCode: "G0439",
        evidenceIds: [],
        sectionEvidenceIds: {}
      },
      {
        id: `chart-${review.id}-encounter-lookback`,
        date: `${review.calendarYear - 1}-10-20`,
        type: "Prior-year chronic care follow-up",
        provider: providerName,
        quality: "fair" as const,
        chiefComplaint: "Prior-year chronic condition follow-up.",
        hpi: `${patientName} was seen for chronic disease follow-up. Medication adherence, interval symptoms, outside specialist follow-up, and recent lab results were discussed.`,
        reviewOfSystems: clinicalReviewOfSystems(reviewConditions).slice(0, 4),
        physicalExam: clinicalPhysicalExam(reviewConditions).slice(0, 4),
        vitals: priorVital,
        assessmentPlan: assessmentPlan.map((item) => ({ ...item, id: `${item.id}-lookback`, detail: `Continue existing chronic-care regimen for ${item.problem}. Follow up with primary care and specialists as scheduled.`, evidenceIds: claimEvidenceIds })),
        signatureTime: "2:08 PM",
        billingCode: "G0439",
        evidenceIds: claimEvidenceIds,
        sectionEvidenceIds: { hpi: claimEvidenceIds, assessmentPlan: claimEvidenceIds, billing: claimEvidenceIds }
      },
      {
        id: `chart-${review.id}-encounter-interval`,
        date: `${review.calendarYear - 1}-07-16`,
        type: "Medication and laboratory follow-up",
        provider: providerName,
        quality: "fair" as const,
        chiefComplaint: "Interval medication check and review of laboratory trends.",
        hpi: `${patientName} returned for an interval medication review. Home readings, tolerance of prescribed therapy, specialist recommendations, diet, activity, and recent laboratory trends were discussed.`,
        reviewOfSystems: clinicalReviewOfSystems(reviewConditions).slice(0, 5),
        physicalExam: clinicalPhysicalExam(reviewConditions).slice(0, 5),
        vitals: intervalVital,
        assessmentPlan: historicalAssessmentPlan("interval", "Maintain the documented treatment plan for"),
        signatureTime: "9:36 AM",
        billingCode: "99214",
        evidenceIds: [],
        sectionEvidenceIds: {}
      },
      {
        id: `chart-${review.id}-encounter-baseline`,
        date: `${review.calendarYear - 2}-11-04`,
        type: "New patient history and chronic-care baseline",
        provider: providerName,
        quality: "poor" as const,
        chiefComplaint: "Establish care and reconcile chronic medical history.",
        hpi: `${patientName} established primary care and reviewed available outside records. Chronic diagnoses, prior procedures, medication history, social supports, and recommended surveillance were reconciled.`,
        reviewOfSystems: clinicalReviewOfSystems(reviewConditions).slice(0, 4),
        physicalExam: clinicalPhysicalExam(reviewConditions).slice(0, 4),
        vitals: baselineVital,
        assessmentPlan: historicalAssessmentPlan("baseline", "Establish baseline monitoring for"),
        signatureTime: "3:18 PM",
        billingCode: "99204",
        evidenceIds: [],
        sectionEvidenceIds: {}
      }
    ];
    const chartClaims = seedClaims.filter((claim) => claim.reviewId === review.id);
    return {
      reviewId: review.id,
      problems: reviewConditions.map((condition) => ({
        id: `chart-${review.id}-problem-${condition.id}`,
        diagnosis: condition.description,
        code: condition.icd10,
        status: condition.resolvedFlag ? "Resolved" : condition.persistence === "chronic" || condition.workflow !== "prospective" ? "Active" : "Chronic",
        dateAdded: `${review.calendarYear - 2}-02-14`,
        isHcc: !condition.sdohCode && !condition.qualityExclusionCode,
        evidenceIds: conditionEvidenceIds(condition)
      })),
      encounters,
      medications: reviewConditions.slice(0, 6).map((condition) => medicationForCondition(condition, providerName, conditionEvidenceIds(condition))),
      labs: [
        { id: `chart-${review.id}-panel-risk`, name: "Chronic Disease Monitoring Panel", date: `${review.calendarYear}-03-05`, results: riskLabRows(review.id, reviewEvidence, reviewConditions) },
        {
          id: `chart-${review.id}-panel-cmp`,
          name: "Comprehensive Metabolic Panel",
          date: `${review.calendarYear}-03-05`,
          results: [
            { id: `chart-${review.id}-lab-na`, component: "Sodium", value: "139", unit: "mmol/L", referenceRange: "136-145", flag: "normal", evidenceIds: [] },
            { id: `chart-${review.id}-lab-k`, component: "Potassium", value: "4.2", unit: "mmol/L", referenceRange: "3.5-5.1", flag: "normal", evidenceIds: [] },
            {
              id: `chart-${review.id}-lab-cr`,
              component: "Creatinine",
              value: currentCreatinine?.value ?? "1.36",
              unit: currentCreatinine?.unit ?? "mg/dL",
              referenceRange: currentCreatinine?.referenceRange ?? "0.60-1.20",
              flag: currentCreatinine?.flag ?? "abnormal",
              evidenceIds: []
            }
          ]
        },
        {
          id: `chart-${review.id}-panel-cbc`,
          name: "Complete Blood Count",
          date: `${review.calendarYear}-01-18`,
          results: [
            { id: `chart-${review.id}-lab-wbc`, component: "White Blood Cells", value: "7.2", unit: "K/uL", referenceRange: "4.0-11.0", flag: "normal", evidenceIds: [] },
            { id: `chart-${review.id}-lab-hgb`, component: "Hemoglobin", value: "12.8", unit: "g/dL", referenceRange: "12.0-16.0", flag: "normal", evidenceIds: [] },
            { id: `chart-${review.id}-lab-plt`, component: "Platelets", value: "248", unit: "K/uL", referenceRange: "150-400", flag: "normal", evidenceIds: [] }
          ]
        },
        {
          id: `chart-${review.id}-panel-lipid`,
          name: "Lipid Panel",
          date: `${review.calendarYear - 1}-10-12`,
          results: [
            { id: `chart-${review.id}-lab-chol`, component: "Total Cholesterol", value: "186", unit: "mg/dL", referenceRange: "<200", flag: "normal", evidenceIds: [] },
            { id: `chart-${review.id}-lab-ldl`, component: "LDL Cholesterol", value: "112", unit: "mg/dL", referenceRange: "<100", flag: "abnormal", evidenceIds: [] },
            { id: `chart-${review.id}-lab-hdl`, component: "HDL Cholesterol", value: "48", unit: "mg/dL", referenceRange: ">=40", flag: "normal", evidenceIds: [] }
          ]
        },
        {
          id: `chart-${review.id}-panel-urine`,
          name: "Urine Albumin Monitoring",
          date: `${review.calendarYear - 1}-07-10`,
          results: [
            { id: `chart-${review.id}-lab-uacr`, component: "Albumin/Creatinine Ratio", value: "42", unit: "mg/g", referenceRange: "<30", flag: "abnormal", evidenceIds: [] },
            { id: `chart-${review.id}-lab-urine-cr`, component: "Urine Creatinine", value: "96", unit: "mg/dL", referenceRange: "20-275", flag: "normal", evidenceIds: [] }
          ]
        }
      ],
      vitals: [currentVital, preventiveVital, priorVital, intervalVital, baselineVital],
      imaging: [
        {
          id: `chart-${review.id}-imaging`,
          type: primaryProfile.imaging.type,
          date: `${review.calendarYear}-05-11`,
          indication: primaryProfile.imaging.indication,
          findings: uniqueStrings([primaryProfile.imaging.findings, ...imagingEvidence.map((item) => item.text)]).join(" "),
          impression: primaryProfile.imaging.impression,
          evidenceIds: imagingEvidence.map((item) => item.id)
        },
        ...reviewConditions.slice(1, 4).map((condition, index) => {
          const imaging = clinicalProfileForCondition(condition).imaging;
          return {
            id: `chart-${review.id}-imaging-${index + 2}`,
            type: imaging.type,
            date: `${review.calendarYear}-05-${String(10 + index).padStart(2, "0")}`,
            indication: imaging.indication,
            findings: imaging.findings,
            impression: imaging.impression,
            evidenceIds: []
          };
        })
      ],
      pastMedicalHistory: [
        { id: `chart-${review.id}-pmh-1`, text: "Medicare Advantage member with longitudinal chronic disease management.", evidenceIds: [] },
        ...reviewConditions.slice(0, 6).map((condition, index) => ({
          id: `chart-${review.id}-pmh-${index + 2}`,
          text: clinicalProfileForCondition(condition).pmh,
          evidenceIds: reviewEvidence.filter((item) => item.conditionIds.includes(condition.id) && item.chartAnchor?.tab === "claims").map((item) => item.id)
        }))
      ],
      specialistNotes: reviewConditions.slice(0, 4).map((condition, index) => {
        const specialist = clinicalProfileForCondition(condition).specialist;
        const specialistEvidence = index === 0
          ? reviewEvidence.filter((item) => item.chartAnchor?.tab === "specialist-notes")
          : reviewEvidence.filter((item) => item.conditionIds.includes(condition.id) && item.chartAnchor?.tab === "specialist-notes");
        return {
          id: index === 0 ? `chart-${review.id}-specialist` : `chart-${review.id}-specialist-${index + 1}`,
          date: `${review.calendarYear}-02-${String(9 + index).padStart(2, "0")}`,
          specialty: specialist.specialty,
          provider: specialist.provider || providerName,
          title: specialist.title,
          note: uniqueStrings([specialist.note, ...specialistEvidence.map((item) => item.text)]).join(" "),
          assessment: specialist.assessment,
          evidenceIds: specialistEvidence.map((item) => item.id)
        };
      }),
      claims: chartClaims
    };
  });
}

function simplifySeedUsers(data: SeedData): SeedData {
  const simplifiedUsers: User[] = users
    .filter((user) => ["u-admin", "u-manager-1", "u-auditor-1", "u-coder-1", "u-coder-2", "u-coder-3", "u-coder-4"].includes(user.id))
    .map((user): User => (user.id === "u-admin" ? { ...user, roles: ["Administrator"], primaryRole: "Administrator" } : user));
  return {
    ...data,
    users: simplifiedUsers,
    teams: teams.map((team) => ({ ...team, managerId: seedUserId(team.managerId) ?? team.managerId })),
    clinics: clinics.map((clinic, index) => ({ ...clinic, defaultAssigneeId: `u-coder-${(index % 4) + 1}` })),
    reviews: data.reviews.map((review) => ({
      ...review,
      assignedUserId: seedUserId(review.assignedUserId) ?? "u-coder-1",
      assignedAuditorId: seedUserId(review.assignedAuditorId),
      lock: review.lock ? { ...review.lock, lockedByUserId: seedUserId(review.lock.lockedByUserId) ?? "u-coder-1" } : undefined,
      coverage: review.coverage
        ? {
            ...review.coverage,
            originalAssignedUserId: seedUserId(review.coverage.originalAssignedUserId) ?? review.assignedUserId,
            coveringUserId: seedUserId(review.coverage.coveringUserId) ?? review.coverage.coveringUserId,
            initiatedByUserId: seedUserId(review.coverage.initiatedByUserId) ?? review.coverage.initiatedByUserId
          }
        : undefined
    })),
    audits: data.audits.map((audit) => ({ ...audit, auditorId: seedUserId(audit.auditorId) ?? "u-auditor-1" })),
    conditions: data.conditions.map((condition) => ({
      ...condition,
      disposition: condition.disposition ? { ...condition.disposition, userId: seedUserId(condition.disposition.userId) ?? "u-coder-1" } : undefined,
      auditorDisposition: condition.auditorDisposition ? { ...condition.auditorDisposition, auditorId: seedUserId(condition.auditorDisposition.auditorId) ?? "u-auditor-1" } : undefined,
      documentationIssues: condition.documentationIssues.map((issue) => ({ ...issue, userId: seedUserId(issue.userId) ?? "u-coder-1" }))
    })),
    history: data.history.map((entry) => ({ ...entry, userId: seedUserId(entry.userId) ?? "u-coder-1" }))
  };
}

const generatedClinicalReviewIds = new Set(reviews.filter((review) => !explicitConditionReviewIds.has(review.id)).map((review) => review.id));
const conditionScopedEvidence = conditions
  .filter((condition) => generatedClinicalReviewIds.has(condition.reviewId))
  .flatMap(generatedEvidenceForCondition);
const retainedEvidence = evidence.filter(
  (item) => !(generatedClinicalReviewIds.has(item.reviewId) && /^ev-rev-\d+-(a|b|c|d|e|f)$/.test(item.id))
);
const canonicalEvidence = alignEvidenceOwners([...retainedEvidence, ...conditionScopedEvidence], conditions, generatedClinicalReviewIds);
const enrichedEvidence = enrichEvidence(canonicalEvidence);
const clinicalSeedConditions = alignConditionEvidence(conditions, enrichedEvidence);
const enrichedClaims = enrichClaims(claims, enrichedEvidence);

const rawSeedData: SeedData = {
  users,
  teams,
  clinics,
  providers,
  payers,
  patients,
  reviews,
  documents: enrichDocuments(documents),
  evidence: enrichedEvidence,
  claims: enrichedClaims,
  charts: buildClinicalCharts(reviews, enrichedEvidence, enrichedClaims),
  conditions: clinicalSeedConditions,
  appointments,
  audits,
  downstreamTasks: [],
  history,
  exports: exportsSeed
};

export const seedData: SeedData = simplifySeedUsers(rawSeedData);
export const demoSeedData: SeedData = seedData;

