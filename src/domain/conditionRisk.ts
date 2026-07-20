import {
  CMS_V28_HIERARCHY,
  getCmsV28Hccs,
  getCmsV28Program,
  scoreCmsV28CommunityNa,
  sortCmsV28HccsForDisplay,
  type CmsV28Hcc,
  type CmsV28ScoreBreakdown
} from "./cmsV28";
import type { Condition, DraftDisposition, Patient, PatientReview, SeedData, UserDisposition } from "./types";

const HUMAN_CAPTURE_ACTIONS = new Set(["Validate", "Add to Claim", "Change"]);

export function getConditionProgram(condition: Condition) {
  return condition.program ?? getCmsV28Program(condition.icd10);
}

export function isRiskAdjustmentCondition(condition: Condition) {
  return getConditionProgram(condition) === "risk-adjustment";
}

export function isAcuteCondition(condition: Condition) {
  return condition.persistence === "acute" || condition.acuteCondition === true || /\bacute\b/i.test(condition.description);
}

export function getConditionHccs(condition: Condition, patient?: Patient): CmsV28Hcc[] {
  const age = patient ? ageForPatient(patient) : undefined;
  return getCmsV28Hccs(getEffectiveDiagnosisCode(condition), age);
}

export function getEffectiveDiagnosisCode(condition: Condition) {
  const disposition = getEffectiveDisposition(condition);
  return disposition?.action === "Change" && disposition.replacementCode
    ? disposition.replacementCode
    : condition.icd10;
}

export function getEffectiveDisposition(condition: Condition): DraftDisposition | UserDisposition | undefined {
  return condition.draftDisposition ?? condition.disposition;
}

export function isHumanCapturedCondition(condition: Condition) {
  const disposition = getEffectiveDisposition(condition);
  return Boolean(disposition && HUMAN_CAPTURE_ACTIONS.has(disposition.action));
}

export interface HierarchySuppressionState {
  fullySuppressed: boolean;
  suppressedHccs: Array<{
    lower: CmsV28Hcc;
    higher: CmsV28Hcc;
    capturedCondition: Condition;
  }>;
}

export function getConditionHierarchySuppression(condition: Condition, review: PatientReview, data: SeedData): HierarchySuppressionState {
  const patient = data.patients.find((item) => item.id === review.patientId);
  const conditionHccs = getConditionHccs(condition, patient);
  if (conditionHccs.length === 0 || isHumanCapturedCondition(condition)) return { fullySuppressed: false, suppressedHccs: [] };

  const patientYearConditions = getPatientYearConditions(data, review)
    .filter((candidate) => candidate.id !== condition.id && isHumanCapturedCondition(candidate));
  const capturedByHcc = new Map<CmsV28Hcc, Condition>();
  patientYearConditions.forEach((candidate) => {
    getConditionHccs(candidate, patient).forEach((hcc) => capturedByHcc.set(hcc, candidate));
  });

  const suppressedHccs = conditionHccs.flatMap((lower) =>
    CMS_V28_HIERARCHY.filter((pair) => pair.lower === lower).flatMap(({ higher }) => {
      const capturedCondition = capturedByHcc.get(higher);
      return capturedCondition ? [{ lower, higher, capturedCondition }] : [];
    })
  );

  return {
    fullySuppressed: conditionHccs.every((hcc) => suppressedHccs.some(({ lower }) => lower === hcc)),
    suppressedHccs
  };
}

export function compareConditionsByHierarchy(left: Condition, right: Condition, patient?: Patient) {
  const ordered = sortCmsV28HccsForDisplay([...getConditionHccs(left, patient), ...getConditionHccs(right, patient)]);
  const leftIndex = Math.min(...getConditionHccs(left, patient).map((hcc) => ordered.indexOf(hcc)));
  const rightIndex = Math.min(...getConditionHccs(right, patient).map((hcc) => ordered.indexOf(hcc)));
  if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex) && leftIndex !== rightIndex) return leftIndex - rightIndex;
  return left.icd10.localeCompare(right.icd10);
}

export function getPatientYearRiskScores(data: SeedData, review: PatientReview) {
  const patient = data.patients.find((item) => item.id === review.patientId);
  if (!patient) return undefined;
  const conditions = getPatientYearConditions(data, review).filter(isRiskAdjustmentCondition);
  const currentDiagnosisCodes = getCurrentClaimDiagnosisCodes(conditions);
  const projectedDiagnosisCodes = applyHumanDispositions(conditions, currentDiagnosisCodes, true);
  const projectedWithoutDeletes = applyHumanDispositions(conditions, currentDiagnosisCodes, false);
  return {
    patient,
    conditions,
    currentDiagnosisCodes,
    projectedDiagnosisCodes,
    current: scorePatient(patient, currentDiagnosisCodes),
    projected: scorePatient(patient, projectedDiagnosisCodes),
    projectedWithoutDeletes: scorePatient(patient, projectedWithoutDeletes),
    demographic: scorePatient(patient, [])
  };
}

export function getConditionMarginalScore(data: SeedData, review: PatientReview, condition: Condition) {
  if (!isRiskAdjustmentCondition(condition)) return 0;
  const scores = getPatientYearRiskScores(data, review);
  if (!scores) return 0;
  const baseCodes = new Set(scores.projectedDiagnosisCodes);
  const code = getEffectiveDiagnosisCode(condition);
  const baseScore = scores.projected.total;
  if (condition.workflow === "codesOnClaim") baseCodes.delete(condition.icd10);
  else baseCodes.add(code);
  return roundToThree(Math.abs(scorePatient(scores.patient, baseCodes).total - baseScore));
}

export function getOpportunityMarginalScore(data: SeedData, review: PatientReview, condition: Condition) {
  if (!isRiskAdjustmentCondition(condition)) return 0;
  const scores = getPatientYearRiskScores(data, review);
  if (!scores) return 0;
  const candidateCodes = new Set(scores.projectedDiagnosisCodes);
  const base = scores.projected.total;
  if (condition.workflow === "codesOnClaim") candidateCodes.delete(condition.icd10);
  else candidateCodes.add(condition.icd10);
  return roundToThree(Math.abs(scorePatient(scores.patient, candidateCodes).total - base));
}

export function scorePatient(patient: Patient, diagnosisCodes: Iterable<string>): CmsV28ScoreBreakdown {
  return scoreCmsV28CommunityNa({
    dob: patient.dob,
    sex: patient.riskProfile.sex,
    diagnosisCodes: Array.from(diagnosisCodes)
  });
}

function getPatientYearConditions(data: SeedData, review: PatientReview) {
  const reviewIds = new Set(
    data.reviews
      .filter((candidate) => candidate.patientId === review.patientId && candidate.calendarYear === review.calendarYear)
      .map((candidate) => candidate.id)
  );
  return data.conditions.filter((condition) => reviewIds.has(condition.reviewId));
}

function getCurrentClaimDiagnosisCodes(conditions: Condition[]) {
  return new Set(
    conditions
      .filter((condition) => condition.currentYear && condition.claimStatus === "On claim")
      .map((condition) => condition.icd10)
  );
}

function applyHumanDispositions(conditions: Condition[], initial: Set<string>, includeDeletes: boolean) {
  const diagnosisCodes = new Set(initial);
  conditions.forEach((condition) => {
    const disposition = getEffectiveDisposition(condition);
    if (!disposition) return;
    if (disposition.action === "Delete" && includeDeletes) diagnosisCodes.delete(condition.icd10);
    if (disposition.action === "Add to Claim" || disposition.action === "Validate") diagnosisCodes.add(condition.icd10);
    if (disposition.action === "Change" && disposition.replacementCode) {
      diagnosisCodes.delete(condition.icd10);
      diagnosisCodes.add(disposition.replacementCode);
    }
  });
  return diagnosisCodes;
}

function ageForPatient(patient: Patient) {
  return scorePatient(patient, []).age;
}

function roundToThree(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
