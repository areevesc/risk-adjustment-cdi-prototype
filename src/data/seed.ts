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
  { id: "u-coder-1", name: "Nina Brooks", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-north", defaultClinicIds: ["clinic-river"] },
  { id: "u-coder-2", name: "Evan Hale", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-north", defaultClinicIds: ["clinic-oak"] },
  { id: "u-coder-3", name: "Grace Imani", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-south", defaultClinicIds: ["clinic-lake"] },
  { id: "u-coder-4", name: "Owen Reed", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-south", defaultClinicIds: ["clinic-canyon"] },
  { id: "u-coder-5", name: "Priya Shah", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-north", defaultClinicIds: ["clinic-river", "clinic-oak"] },
  { id: "u-cdi-1", name: "Clara Wood", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-north", defaultClinicIds: ["clinic-river"] },
  { id: "u-cdi-2", name: "Hector Ruiz", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-north", defaultClinicIds: ["clinic-oak"] },
  { id: "u-cdi-3", name: "Amina Diallo", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-south", defaultClinicIds: ["clinic-lake"] },
  { id: "u-cdi-4", name: "Noah Kim", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-south", defaultClinicIds: ["clinic-canyon"] },
  { id: "u-cdi-5", name: "Iris Stone", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-south", defaultClinicIds: ["clinic-lake", "clinic-canyon"] },
  { id: "u-coder-6", name: "Marcus Bell", primaryRole: "CDI/Coder", roles: ["CDI/Coder"], teamId: "t-north", defaultClinicIds: ["clinic-river"] }
];

export const teams: Team[] = [
  { id: "t-admin", name: "Administration", managerId: "u-admin" },
  { id: "t-north", name: "North Risk Adjustment", managerId: "u-manager-1" },
  { id: "t-south", name: "South CDI Operations", managerId: "u-manager-2" },
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
          sections: [section(`sec-${review.id}-image-1`, "Imaging shows acute bronchitis only; quality-exclusion logic keeps it out of RAF capture.", [`ev-${review.id}-imaging`])]
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
          sections: [section(`sec-${review.id}-acute-2025`, "Prior evidence is explicitly marked acute-only and resolved for future recapture review.", [`ev-${review.id}-acute-2025`])]
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
          sections: [section(`sec-${review.id}-quality`, "Payer quality file marks this item as quality-exclusion context for prototype RAF safeguards.", [`ev-${review.id}-quality`])]
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
    text: "Assessment includes diabetes, chronic kidney disease, heart failure symptoms, and medication adherence review.",
    exactText: "diabetes, chronic kidney disease",
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
    sectionId: `sec-${review.id}-note-2`,
    text: "Heart failure symptoms and medication adherence review.",
    exactText: "heart failure symptoms",
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
    sectionId: `sec-${review.id}-note-3`,
    text: "Address open risk adjustment items at upcoming encounter.",
    exactText: "address open risk adjustment items",
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
    text: "Abnormal values are pre-annotated for prototype evidence navigation.",
    exactText: "Abnormal values",
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
    sectionId: `sec-${review.id}-hist-1`,
    text: "Prior capture history, registry flags, specialist referrals, and HIE data are summarized.",
    exactText: "registry flags, specialist referrals, and HIE data",
    date: `${review.calendarYear - 1}-10-20`,
    category: "prospective",
    subtype: "recapture",
    conditionIds: review.conditionIds.slice(2, 5),
    summary: "Historical lookback evidence supports recapture or suspect review."
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
          text: "Prior evidence is explicitly marked acute-only and resolved for future recapture review.",
          exactText: "acute-only and resolved",
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
          text: "Payer quality file marks this item as quality-exclusion context for prototype RAF safeguards.",
          exactText: "quality-exclusion context",
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

export const claims: Claim[] = reviews.map((review) => ({
  id: `claim-${review.id}`,
  reviewId: review.id,
  dateOfService: `${review.calendarYear}-04-12`,
  riskEligible: true,
  cptSourceEligible: review.id !== "rev-103",
  providerTypeEligible: review.id !== "rev-106",
  faceToFace: review.id !== "rev-107",
  providerSignatureValid: review.id !== "rev-108",
  icd10Codes: review.conditionIds.slice(0, 2).map((id) => id.replace("cond-", "DX-"))
}));

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
    sdohCode: true,
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
          sdohCode: review.id === "rev-103",
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
  downstreamTasks: [],
  history,
  exports: exportsSeed
};

