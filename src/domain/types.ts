export type Role = "Administrator" | "Manager" | "Auditor" | "Coder" | "CDI Specialist";
export type ReviewType = "Retrospective" | "Concurrent" | "Prospective";
export type WorkflowStatus =
  | "Available"
  | "In Progress"
  | "Pended"
  | "Awaiting Review"
  | "Rework Required"
  | "Completed"
  | "Under Audit"
  | "Audit Complete";
export type QueueType =
  | "Assigned Coder"
  | "Assigned CDI Specialist"
  | "Auditor Queue"
  | "Manager Review Queue"
  | "Prospective Review Queue"
  | "Unassigned Team Queue";
export type Category = "validated" | "potentialDelete" | "potentialAddition" | "prospective";
export type ProspectiveSubtype = "recapture" | "suspect";
export type ConditionWorkflow = "codesOnClaim" | "codesNotOnClaim" | "prospective";
export type RecommendationMode = "simulated" | "rules" | "hidden";
export type RecommendationSource = "rules" | "seeded";
export type RecommendationAction =
  | "Validate"
  | "Delete"
  | "Send to Prospective"
  | "Add to Claim"
  | "Disagree"
  | "Yes"
  | "No"
  | "Change";
export type DisagreeReason =
  | "Not Enough MEAT"
  | "Condition Resolved"
  | "Conflicting Evidence"
  | "Other";
export type DocumentationIssue =
  | "Not risk eligible CPT source"
  | "Not risk eligible provider type"
  | "Not a face-to-face service"
  | "Invalid or missing provider signature"
  | "Provider education";
export type DownstreamTaskType =
  | "Prospective CDI Review"
  | "Addition to Claim"
  | "Deletion"
  | "Auditor Exception"
  | "Manager Exception"
  | "Provider Education";
export type DownstreamTaskStatus = "Open" | "In Progress" | "Completed" | "Cancelled";
export type DownstreamTaskQueue =
  | "Prospective Review Queue"
  | "Auditor Queue"
  | "Manager Review Queue"
  | "Provider Education Queue"
  | "Export List";
export type AssignmentMode = "Coverage" | "Permanent reassignment";

export interface User {
  id: string;
  name: string;
  roles: Role[];
  primaryRole: Role;
  teamId: string;
  defaultClinicIds: string[];
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
}

export interface Clinic {
  id: string;
  name: string;
  defaultCoderId: string;
  defaultCdiId: string;
}

export interface Provider {
  id: string;
  name: string;
  clinicId: string;
  specialty: string;
}

export interface PayerPlan {
  id: string;
  name: string;
  asmProfile: string;
}

export interface Patient {
  id: string;
  name: string;
  dob: string;
  memberId: string;
  payerId: string;
  demographicRaf: number;
}

export interface Lock {
  lockedByUserId: string;
  lockedAt: string;
}

export interface PatientReview {
  id: string;
  patientId: string;
  calendarYear: number;
  reviewType: ReviewType;
  clinicId: string;
  providerId: string;
  status: WorkflowStatus;
  queue: QueueType;
  assignedCoderId?: string;
  assignedCdiId?: string;
  assignedAuditorId?: string;
  lock?: Lock;
  appointmentId?: string;
  conditionIds: string[];
  auditReturn?: {
    auditId: string;
    returnedByUserId: string;
    returnedAt: string;
    comments: string;
  };
}

export interface SourceDocument {
  id: string;
  reviewId: string;
  type: "Progress Note" | "Lab" | "Pathology" | "Imaging" | "Claims" | "MOR" | "Payer Data" | "Registry" | "HIE" | "Specialist Note";
  title: string;
  date: string;
  isCurrentYear: boolean;
  riskEligibleSource?: boolean;
  cptSourceEligible?: boolean;
  providerTypeEligible?: boolean;
  faceToFace?: boolean;
  providerSignatureValid?: boolean;
  sections: DocumentSection[];
}

export interface DocumentSection {
  id: string;
  text: string;
  evidenceIds: string[];
}

export interface EvidencePassage {
  id: string;
  reviewId: string;
  documentId: string;
  anchorId: string;
  sectionId?: string;
  stableSpanId?: string;
  text: string;
  exactText?: string;
  startOffset?: number;
  endOffset?: number;
  date: string;
  category: Category;
  subtype?: ProspectiveSubtype;
  conditionIds: string[];
  summary: string;
}

export interface Claim {
  id: string;
  reviewId: string;
  dateOfService: string;
  riskEligible: boolean;
  cptSourceEligible: boolean;
  providerTypeEligible: boolean;
  faceToFace: boolean;
  providerSignatureValid: boolean;
  icd10Codes: string[];
}

export interface Recommendation {
  action: RecommendationAction;
  rationale: string;
  confidence: "High" | "Medium" | "Low";
  source: RecommendationSource;
  replacementCode?: string;
}

export interface UserDisposition {
  action: RecommendationAction;
  reason?: DisagreeReason;
  replacementCode?: string;
  comments?: string;
  userId: string;
  decidedAt: string;
  agreedWithRecommendation?: boolean;
}

export interface AuditorDisposition {
  outcome: "Agree" | "Disagree" | "Return for Correction";
  comments?: string;
  auditorId: string;
  decidedAt: string;
  agreedWithUser?: boolean;
}

export interface Condition {
  id: string;
  reviewId: string;
  workflow: ConditionWorkflow;
  category: Category;
  subtype?: ProspectiveSubtype;
  originalWorkflowClassification?: ConditionWorkflow;
  originalCategory?: Category;
  originalSubtype?: ProspectiveSubtype;
  originalRecommendation?: RecommendationAction;
  recommendationSource?: RecommendationSource;
  icd10: string;
  description: string;
  hcc: string;
  raf: number;
  claimStatus: "On claim" | "Not on claim" | "Historical" | "Registry";
  sourceDate: string;
  evidenceIds: string[];
  actionable: boolean;
  currentYear: boolean;
  hasSufficientMeat: boolean;
  hasOtherSupportingEvidence: boolean;
  hadPriorCapture: boolean;
  hasCurrentYearCapture: boolean;
  hasClinicalIndicators: boolean;
  resolvedFlag?: boolean;
  conflictingEvidence?: boolean;
  acuteCondition?: boolean;
  trumpedByCode?: string;
  sdohCode?: boolean;
  qualityExclusionCode?: boolean;
  seededRecommendation?: Recommendation;
  disposition?: UserDisposition;
  auditorDisposition?: AuditorDisposition;
  agreementWithAuditor?: boolean;
  documentationIssues: DocumentationFlag[];
  disabledReason?: string;
}

export interface DocumentationFlag {
  issue: DocumentationIssue;
  comments?: string;
  userId: string;
  createdAt: string;
}

export interface UpcomingAppointment {
  id: string;
  patientId: string;
  providerId: string;
  date: string;
  type: string;
}

export interface Audit {
  id: string;
  reviewId: string;
  auditorId: string;
  status: "Not Started" | "In Progress" | "Returned" | "Complete";
  outcome?: "Agree" | "Disagree" | "Return for Correction";
  comments?: string;
  completedAt?: string;
  reopenedAt?: string;
}

export interface ActionHistory {
  id: string;
  reviewId: string;
  conditionId?: string;
  userId: string;
  at: string;
  event: string;
  detail: string;
}

export interface ExportRecord {
  id: string;
  type: "Deletion list" | "Addition to claim list" | "Payer ASM export" | "Audit results";
  createdAt: string;
  seededExample?: boolean;
  rows: Record<string, string | number>[];
}

export interface AppSettings {
  recommendationMode: RecommendationMode;
  auditSampleRate: number;
  prototypeCurrentYear: number;
}

export interface DownstreamTask {
  id: string;
  reviewId: string;
  conditionId: string;
  type: DownstreamTaskType;
  status: DownstreamTaskStatus;
  queue: DownstreamTaskQueue;
  assignedUserId?: string;
  createdByUserId: string;
  createdAt: string;
  comments?: string;
}

export interface SeedData {
  users: User[];
  teams: Team[];
  clinics: Clinic[];
  providers: Provider[];
  payers: PayerPlan[];
  patients: Patient[];
  reviews: PatientReview[];
  documents: SourceDocument[];
  evidence: EvidencePassage[];
  claims: Claim[];
  conditions: Condition[];
  appointments: UpcomingAppointment[];
  audits: Audit[];
  downstreamTasks: DownstreamTask[];
  history: ActionHistory[];
  exports: ExportRecord[];
}
