export type Role = "Administrator" | "Manager" | "Auditor" | "CDI/Coder";
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
  | "CDI/Coder Queue"
  | "Auditor Queue"
  | "Manager Review Queue"
  | "Prospective Review Queue";
export type Category = "validated" | "potentialDelete" | "potentialAddition" | "prospective";
export type ProspectiveSubtype = "recapture" | "suspect";
export type ConditionWorkflow = "codesOnClaim" | "codesNotOnClaim" | "prospective";
export type ConditionPersistence = "chronic" | "acute" | "resolved" | "historical" | "unknown";
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
export type RuleOutcomeSource = "user-selected" | "rule-resolved" | "rule-suppressed" | "auditor-selected";
export type RuleGeneratedOutcomeSource = Extract<RuleOutcomeSource, "rule-resolved" | "rule-suppressed">;
export type RuleSeverity = "info" | "warning" | "blocking";
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
  | "Provider Education"
  | "Scheduling Outreach";
export type DownstreamTaskStatus = "Open" | "In Progress" | "Completed" | "Cancelled";
export type DownstreamTaskQueue =
  | "Prospective Review Queue"
  | "Auditor Queue"
  | "Manager Review Queue"
  | "Provider Education Queue"
  | "Scheduling Outreach Queue"
  | "Export List";
export type AssignmentMode = "Coverage" | "Permanent reassignment";
export type AuditSelectionSource = "manual" | "deterministic-sample";
export type OutreachStatus = "Scheduled" | "Needed" | "Open" | "In Progress" | "Completed" | "Not Needed";

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
  defaultAssigneeId: string;
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
  assignedUserId: string;
  assignedAuditorId?: string;
  coverage?: {
    originalAssignedUserId: string;
    coveringUserId: string;
    startedAt: string;
    initiatedByUserId: string;
  };
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

export type EvidenceStrength =
  | "strongCurrentYearMEAT"
  | "weakMentionOnly"
  | "clinicalIndicatorOnly"
  | "historicalOnly"
  | "suspect"
  | "conflicting"
  | "unsupported";

export type MeatType = "Monitoring" | "Evaluation" | "Assessment" | "Treatment";

export type EvidenceSourceType =
  | "assessmentHeading"
  | "planSentence"
  | "hpiSentence"
  | "medicationRow"
  | "labResultRow"
  | "vitalRow"
  | "imagingImpression"
  | "specialistAssessment"
  | "problemListItem"
  | "pmhItem"
  | "claimLine"
  | "morPayerRegistryHie";

export type ChartTab =
  | "encounters"
  | "problem-list"
  | "pmh"
  | "medications"
  | "labs"
  | "vitals"
  | "imaging"
  | "specialist-notes"
  | "claims";

export type LabFlag = "normal" | "abnormal" | "critical";
export type ProblemStatus = "Active" | "Chronic" | "Resolved";
export type EncounterQuality = "good" | "fair" | "poor";

export interface ChartProblem {
  id: string;
  diagnosis: string;
  code: string;
  status: ProblemStatus;
  dateAdded: string;
  isHcc: boolean;
  evidenceIds: string[];
}

export interface ChartMedication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
  prescriber: string;
  evidenceIds: string[];
}

export interface ChartLabResult {
  id: string;
  component: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: LabFlag;
  evidenceIds: string[];
}

export interface ChartLabPanel {
  id: string;
  name: string;
  date: string;
  results: ChartLabResult[];
}

export interface ChartVital {
  id: string;
  date: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperature: number;
  weight: number;
  height: number;
  bmi: number;
  oxygenSaturation: number;
  evidenceIds: string[];
}

export interface ChartImagingReport {
  id: string;
  type: string;
  date: string;
  indication: string;
  findings: string;
  impression: string[];
  evidenceIds: string[];
}

export interface ChartAssessmentPlanItem {
  id: string;
  problem: string;
  code?: string;
  detail: string;
  evidenceIds: string[];
}

export interface ChartEncounter {
  id: string;
  date: string;
  type: string;
  provider: string;
  quality: EncounterQuality;
  chiefComplaint: string;
  hpi: string;
  reviewOfSystems: string[];
  physicalExam: Array<{ system: string; text: string }>;
  vitals: ChartVital;
  assessmentPlan: ChartAssessmentPlanItem[];
  signatureTime: string;
  billingCode: string;
  evidenceIds: string[];
  sectionEvidenceIds: Partial<Record<"chiefComplaint" | "hpi" | "ros" | "physicalExam" | "assessmentPlan" | "billing", string[]>>;
}

export interface ChartSpecialistNote {
  id: string;
  date: string;
  specialty: string;
  provider: string;
  title: string;
  note: string;
  assessment: string[];
  evidenceIds: string[];
}

export interface ClinicalChart {
  reviewId: string;
  problems: ChartProblem[];
  encounters: ChartEncounter[];
  medications: ChartMedication[];
  labs: ChartLabPanel[];
  vitals: ChartVital[];
  imaging: ChartImagingReport[];
  pastMedicalHistory: Array<{ id: string; text: string; evidenceIds: string[] }>;
  specialistNotes: ChartSpecialistNote[];
  claims: Claim[];
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
  sourceType?: EvidenceSourceType;
  sourceLocation?: string;
  evidenceStrength?: EvidenceStrength;
  meatType?: MeatType[];
  currentYearSupport?: boolean;
  historicalOnly?: boolean;
  suspectOnly?: boolean;
  recaptureOnly?: boolean;
  reviewerExplanation?: string;
  chartAnchor?: {
    tab: ChartTab;
    itemId: string;
    sectionId?: string;
  };
}

export interface Claim {
  id: string;
  reviewId: string;
  dateOfService: string;
  provider?: string;
  cptCode?: string;
  encounterType?: string;
  payer?: string;
  supportSummary?: string;
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

export interface RuleActionSuppression {
  action: RecommendationAction;
  reason: string;
  ruleId: string;
  source: RuleGeneratedOutcomeSource;
  supportingEvidenceIds?: string[];
  conflictingEvidenceIds?: string[];
}

export interface RuleWarning {
  message: string;
  severity: RuleSeverity;
  evidenceIds?: string[];
}

export interface RuleResult {
  ruleId: string;
  recommendedAction?: RecommendationAction;
  explanation: string;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  disabledActions: RuleActionSuppression[];
  warnings: RuleWarning[];
  outcomeSource?: RuleOutcomeSource;
}

export interface UserDisposition {
  action: RecommendationAction;
  reason?: DisagreeReason;
  replacementCode?: string;
  comments?: string;
  userId: string;
  decidedAt: string;
  agreedWithRecommendation?: boolean;
  source?: Extract<RuleOutcomeSource, "user-selected">;
  ruleId?: string;
}

export interface AuditorDisposition {
  outcome: "Agree" | "Disagree" | "Return for Correction";
  comments?: string;
  auditorId: string;
  decidedAt: string;
  agreedWithUser?: boolean;
  source?: Extract<RuleOutcomeSource, "auditor-selected">;
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
  supportingEvidenceIds?: string[];
  conflictingEvidenceIds?: string[];
  lookbackEvidenceIds?: string[];
  persistence?: ConditionPersistence;
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
  trustedCodeMetadata?: boolean;
  seededRecommendation?: Recommendation;
  disposition?: UserDisposition;
  ruleOutcome?: RuleGeneratedOutcome;
  auditorDisposition?: AuditorDisposition;
  agreementWithAuditor?: boolean;
  documentationIssues: DocumentationFlag[];
  disabledReason?: string;
}

export interface RuleGeneratedOutcome {
  source: RuleGeneratedOutcomeSource;
  action?: RecommendationAction;
  ruleId: string;
  explanation: string;
  selectedConditionId?: string;
  supportingEvidenceIds?: string[];
  conflictingEvidenceIds?: string[];
  createdAt: string;
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
  selectionSource?: AuditSelectionSource;
  sampledAt?: string;
  sampleRate?: number;
  sampleBucket?: number;
  sampleCategories?: Category[];
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
  sameHccValidationThreshold: number;
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
  charts: ClinicalChart[];
  conditions: Condition[];
  appointments: UpcomingAppointment[];
  audits: Audit[];
  downstreamTasks: DownstreamTask[];
  history: ActionHistory[];
  exports: ExportRecord[];
}
