import type { Claim, Condition, EvidencePassage, PatientReview, SeedData, SourceDocument } from "./types";

export interface ConditionEvidenceEligibility {
  ownedEvidence: EvidencePassage[];
  eligibleCurrentClinicalEvidence: EvidencePassage[];
  eligibleClaim?: Claim;
  hasOwnedEvidence: boolean;
  hasEligibleCurrentClinicalSupport: boolean;
  hasEligibleClaimForAction: boolean;
}

function isDocumentEligible(document: SourceDocument | undefined) {
  return Boolean(
    document &&
      document.riskEligibleSource !== false &&
      document.cptSourceEligible !== false &&
      document.providerTypeEligible !== false &&
      document.faceToFace !== false &&
      document.providerSignatureValid !== false
  );
}

/** Claim eligibility is claim-scoped. Signature validity belongs to the note. */
function isClaimEligible(claim: Claim) {
  return claim.riskEligible && claim.cptSourceEligible && claim.providerTypeEligible && claim.faceToFace;
}

function isCurrentClinicalEvidence(evidence: EvidencePassage, review: PatientReview, document: SourceDocument | undefined) {
  if (evidence.sourceType === "claimLine" || !document?.isCurrentYear) return false;
  const evidenceYear = Number(evidence.date.slice(0, 4));
  return evidenceYear === review.calendarYear && evidence.currentYearSupport === true;
}

export function getConditionEvidenceEligibility(
  condition: Condition,
  review: PatientReview,
  data: SeedData
): ConditionEvidenceEligibility {
  const ownedEvidence = condition.evidenceIds
    .map((id) => data.evidence.find((evidence) => evidence.id === id && evidence.conditionIds.includes(condition.id)))
    .filter(Boolean) as EvidencePassage[];
  const documentsById = new Map(data.documents.map((document) => [document.id, document]));
  const eligibleCurrentClinicalEvidence = ownedEvidence.filter((evidence) => {
    const document = documentsById.get(evidence.documentId);
    return isCurrentClinicalEvidence(evidence, review, document) && isDocumentEligible(document);
  });
  const eligibleClaim = data.claims.find(
    (claim) =>
      claim.reviewId === review.id &&
      Number(claim.dateOfService.slice(0, 4)) === review.calendarYear &&
      claim.icd10Codes.includes(condition.icd10) &&
      isClaimEligible(claim)
  );

  return {
    ownedEvidence,
    eligibleCurrentClinicalEvidence,
    eligibleClaim,
    hasOwnedEvidence: ownedEvidence.length > 0,
    hasEligibleCurrentClinicalSupport: eligibleCurrentClinicalEvidence.length > 0,
    hasEligibleClaimForAction: eligibleClaim !== undefined
  };
}
