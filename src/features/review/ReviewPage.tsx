import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileClock,
  FileText,
  FileWarning,
  Flag,
  FlaskConical,
  HeartPulse,
  Image as ImageIcon,
  LockKeyhole,
  Pill,
  Play,
  ReceiptText,
  Search,
  Stethoscope
} from "lucide-react";
import { useAppState } from "../../state/AppState";
import {
  byId,
  canEditReview,
  getClaimForReview,
  getDispositionSummary,
  getActiveConditionEvidence,
  getDownstreamTaskForCondition,
  getDownstreamTasksForCondition,
  getIncomingProspectiveHandoffs,
  getEvidenceCycleTarget,
  getEvidenceForCondition,
  getOutreachStatusForReview,
  getPresentedOpportunitySummary,
  getProspectiveCounts,
  getRafSummary,
  getRecommendation,
  getRuleResult,
  reviewConditions
} from "../../domain/selectors";
import type { ChartTab, ClinicalChart, Condition, ConditionDecision, DisagreeReason, DocumentationIssue, EvidencePassage, Patient, RecommendationAction, RoutingOutcome, RuleResult } from "../../domain/types";
import { evidenceStrengthLabel } from "../../domain/mockClinicalContent";
import { buildChartSearchResults, normalizeChartSearchQuery } from "../../domain/chartSearch";
import type { ChartSearchResult } from "../../domain/chartSearch";
import { formatDate, formatDateTime, formatRaf } from "../../domain/format";
import { Button, CategoryBadge, CloseDialogButton, EmptyState, Panel, StatusChip } from "../../ui/Primitives";
import { categoryTokens, dispositionTokens, subtypeTokens } from "../../domain/tokens";
import { canOpenReview, canOverrideLock, canReleaseReviewLock, canTakeCoverage, canViewReview, getFirstPermittedRoute, isFinalReviewStatus } from "../../domain/auth";
import {
  compareConditionsByHierarchy,
  getConditionClinicalFamily,
  getConditionHierarchySuppression,
  getConditionMarginalScore,
  isRiskAdjustmentCondition
} from "../../domain/conditionRisk";
import { CMS_V28_MODEL } from "../../domain/cmsV28";
import { deriveConditionReviewModel, deriveReviewContext } from "../../domain/conditionReviewModel";

const disagreeReasons: DisagreeReason[] = ["Not Enough MEAT", "Condition Resolved", "Conflicting Evidence", "Other"];
const documentationIssues: DocumentationIssue[] = [
  "Not risk eligible CPT source",
  "Not risk eligible provider type",
  "Not a face-to-face service",
  "Invalid or missing provider signature",
  "Provider education",
  "Other documentation issue"
];

const validationToken = { color: "#075e45", bg: "#e8f7ee", border: "#2bb673" };
const mentionToken = { color: "#7a4b00", bg: "#fff5db", border: "#d79b1e" };
const indicatorToken = { color: "#0f4d78", bg: "#e8f4ff", border: "#5aa4d8" };
const historyToken = { color: "#5b3a96", bg: "#f1ecff", border: "#9a7bd8" };
const suspectToken = { color: "#8a3d00", bg: "#fff0e3", border: "#e18a35" };
const clinicalContextToken = { color: "#475467", bg: "#f2f4f7", border: "#98a2b3" };

const strengthTokens = {
  strongCurrentYearMEAT: { color: "#075e45", bg: "#e8f7ee", border: "#2bb673" },
  assessmentWithPlan: validationToken,
  assessmentWithoutPlan: mentionToken,
  treatmentEvidence: validationToken,
  monitoringEvidence: validationToken,
  evaluationEvidence: indicatorToken,
  weakMentionOnly: { color: "#7a4b00", bg: "#fff5db", border: "#d79b1e" },
  problemListOnly: mentionToken,
  pmhOnly: mentionToken,
  historicalClaimOnly: historyToken,
  clinicalIndicatorOnly: { color: "#0f4d78", bg: "#e8f4ff", border: "#5aa4d8" },
  labIndicatorOnly: indicatorToken,
  imagingIndicatorOnly: indicatorToken,
  specialistHistoricalOnly: historyToken,
  historicalOnly: { color: "#5b3a96", bg: "#f1ecff", border: "#9a7bd8" },
  recapture: historyToken,
  suspect: { color: "#8a3d00", bg: "#fff0e3", border: "#e18a35" },
  conflicting: { color: "#991b1b", bg: "#fee2e2", border: "#ef4444" },
  unsupported: { color: "#475569", bg: "#f1f5f9", border: "#94a3b8" }
} satisfies Record<NonNullable<EvidencePassage["evidenceStrength"]>, { color: string; bg: string; border: string }>;

function tokenForEvidence(evidence: EvidencePassage) {
  if (evidence.evidenceStrength) return strengthTokens[evidence.evidenceStrength];
  return evidence.subtype ? subtypeTokens[evidence.subtype] : categoryTokens[evidence.category];
}

export function ReviewPage() {
  const { reviewId } = useParams();
  const { data, currentUser, settings, actions } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const review = data.reviews.find((item) => item.id === reviewId);
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>("encounters");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | undefined>();
  const [activeConditionId, setActiveConditionId] = useState<string | undefined>();
  const [disagreeCondition, setDisagreeCondition] = useState<Condition | null>(null);
  const [changeCondition, setChangeCondition] = useState<Condition | null>(null);
  const [flagCondition, setFlagCondition] = useState<Condition | null>(null);
  const [overrideRequested, setOverrideRequested] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [completionWarnings, setCompletionWarnings] = useState<string[]>([]);
  const [nextPatientMessage, setNextPatientMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [deleteSafetyCondition, setDeleteSafetyCondition] = useState<Condition | null>(null);

  useEffect(() => {
    const requestedEvidenceId = (location.state as { evidenceId?: string } | null)?.evidenceId;
    const requestedEvidence = requestedEvidenceId
      ? data.evidence.find((evidence) => evidence.id === requestedEvidenceId && evidence.reviewId === reviewId)
      : undefined;
    const requestedConditionId = requestedEvidence?.conditionIds.find((conditionId) =>
      data.conditions.some((condition) => condition.id === conditionId && condition.reviewId === reviewId)
    );
    setActiveChartTab(requestedEvidence?.chartAnchor?.tab ?? "encounters");
    setSelectedEvidenceId(requestedEvidence?.id);
    setActiveConditionId(requestedConditionId);
  }, [reviewId]);

  const maps = useMemo(
    () => ({
      patients: byId(data.patients),
      payers: byId(data.payers),
      clinics: byId(data.clinics),
      providers: byId(data.providers),
      users: byId(data.users),
      evidence: byId(data.evidence),
      appointments: byId(data.appointments)
    }),
    [data]
  );

  if (!review) return <EmptyState title="Review not found" body="The selected patient review does not exist in the prototype data." />;
  if (!canViewReview(data, review, currentUser)) {
    return <Navigate to={getFirstPermittedRoute(currentUser)} replace state={{ authMessage: "That patient review is not available to your simulated role." }} />;
  }

  const activeReview = review;

  const patient = maps.patients.get(activeReview.patientId)!;
  const payer = maps.payers.get(patient.payerId);
  const clinic = maps.clinics.get(activeReview.clinicId);
  const provider = maps.providers.get(activeReview.providerId);
  const appointment = activeReview.appointmentId ? maps.appointments.get(activeReview.appointmentId) : undefined;
  const outreachStatus = getOutreachStatusForReview(data, activeReview);
  const incomingProspectiveHandoffs = getIncomingProspectiveHandoffs(data, activeReview);
  const displayAppointment = outreachStatus.appointment ?? appointment;
  const conditions = reviewConditions(data, activeReview);
  const reviewContext = deriveReviewContext(activeReview, data, settings);
  const riskConditions = conditions.filter(isRiskAdjustmentCondition).sort((left, right) => compareConditionsByHierarchy(left, right, patient));
  const visibleRiskConditions = riskConditions;
  const conditionFamilies = groupRelatedRiskConditions(visibleRiskConditions, patient);
  const familyConditionIds = new Set(conditionFamilies.flatMap((family) => family.conditions.map((condition) => condition.id)));
  const standaloneRiskConditions = visibleRiskConditions.filter((condition) => !familyConditionIds.has(condition.id));
  const nonRiskConditions = conditions.filter((condition) => !isRiskAdjustmentCondition(condition));
  const relatedReviewIds = new Set(
    data.reviews
      .filter((item) => item.patientId === patient.id && item.calendarYear >= activeReview.calendarYear - 3 && item.calendarYear <= activeReview.calendarYear)
      .map((item) => item.id)
  );
  const documents = data.documents.filter((document) => relatedReviewIds.has(document.reviewId));
  const relatedEvidence = data.evidence.filter((item) => relatedReviewIds.has(item.reviewId));
  const navigableEvidenceIds = new Set(
    conditions.flatMap((condition) => [
      ...condition.evidenceIds,
      ...(condition.supportingEvidenceIds ?? []),
      ...(condition.conflictingEvidenceIds ?? []),
      ...(condition.lookbackEvidenceIds ?? [])
    ])
  );
  const navigableEvidence = relatedEvidence.filter((item) => navigableEvidenceIds.has(item.id));
  const activeEvidence = getActiveConditionEvidence(data, navigableEvidence, activeConditionId);
  const chart = data.charts.find((item) => item.reviewId === activeReview.id);
  const finalReview = isFinalReviewStatus(activeReview);
  const editable = canEditReview(activeReview, currentUser);
  const presentedSummary = getPresentedOpportunitySummary(data, activeReview);
  const dispositionSummary = getDispositionSummary(data, activeReview);
  const prospectiveCounts = getProspectiveCounts(data, activeReview);
  const rafSummary = getRafSummary(data, activeReview);
  const claim = getClaimForReview(data, activeReview.id);
  const lockOwner = activeReview.lock ? maps.users.get(activeReview.lock.lockedByUserId)?.name : undefined;
  const canRelease = canReleaseReviewLock(activeReview, currentUser);
  const readOnlyTitle = !editable ? (activeReview.lock ? `Read-only while being edited by ${lockOwner}` : "Open the chart to acquire an edit lock") : undefined;
  const selectedEvidenceIndex = selectedEvidenceId ? activeEvidence.findIndex((item) => item.id === selectedEvidenceId) : -1;

  function jumpToEvidence(evidence: EvidencePassage) {
    if (evidence.reviewId !== activeReview.id) {
      navigate(`/review/${evidence.reviewId}`, { state: { evidenceId: evidence.id } });
      return;
    }
    if (evidence.conditionIds.length) {
      setActiveConditionId((current) => (current && evidence.conditionIds.includes(current) ? current : evidence.conditionIds[0]));
    }
    setSelectedEvidenceId(evidence.id);
    if (evidence.chartAnchor) setActiveChartTab(evidence.chartAnchor.tab);
  }

  function stepEvidence(direction: "prev" | "next") {
    const target = getEvidenceCycleTarget(activeEvidence, selectedEvidenceId, direction);
    if (target) jumpToEvidence(target);
  }

  function clearReviewLocalState() {
    setActiveChartTab("encounters");
    setSelectedEvidenceId(undefined);
    setActiveConditionId(undefined);
    setCompletionWarnings([]);
    setNextPatientMessage("");
  }

  function returnToQueue() {
    if (canRelease) actions.releaseReview(activeReview.id);
    navigate("/queue");
  }

  function pend() {
    actions.pendReview(activeReview.id);
    setActionMessage("Chart pended. The edit lock was released; Return to Queue and Next Patient remain available.");
  }

  function route(queue: "Auditor Queue" | "Manager Review Queue") {
    actions.routeReview(activeReview.id, queue);
    setActionMessage(queue === "Auditor Queue" ? "Chart sent to the auditor queue. The CDI/Coder edit lock was released." : "Chart sent for manager review. The edit lock was released.");
  }

  function openNextPatientChart() {
    if (editable && activeReview.lock) {
      const confirmed = window.confirm("This chart is still actively being edited. Moving to the next patient will release your current edit lock. Continue?");
      if (!confirmed) return;
    }
    const nextReviewId = actions.openNextEligibleReview(activeReview.id);
    if (!nextReviewId) {
      window.alert("No available or pended next patient chart is currently eligible for your role. Returning to the queue.");
      navigate("/queue");
      return;
    }
    clearReviewLocalState();
    navigate(`/review/${nextReviewId}`);
  }

  function complete() {
    const unresolved = actions.completeReview(activeReview.id);
    setCompletionWarnings(unresolved);
    if (!unresolved.length) setActionMessage("Review completed. The edit lock was released; Return to Queue and Next Patient remain available.");
  }

  return (
    <div className={`page-stack review-page${!editable ? " review-read-only" : ""}`}>
      <Panel
        className="patient-header"
        actions={
          <div className="header-actions patient-header-actions">
            {review.lock ? (
              <StatusChip tone={editable ? "info" : "warn"}>Being edited by {lockOwner}</StatusChip>
            ) : (
              <StatusChip>No active editor</StatusChip>
            )}
            {!review.lock && canOpenReview(data, review, currentUser) ? (
              <Button variant="secondary" onClick={() => actions.openReview(review.id)}>
                <LockKeyhole size={15} />
                Open chart
              </Button>
            ) : null}
            {!review.lock && canTakeCoverage(data, review, currentUser) ? (
              <Button variant="secondary" onClick={() => actions.takeCoverage(review.id)}>
                <LockKeyhole size={15} />
                Take Coverage
              </Button>
            ) : null}
            {review.lock && !editable && canOverrideLock(review, currentUser, "override") ? (
              <Button className="override-lock-action" variant="secondary" onClick={() => setOverrideRequested(true)}>
                <LockKeyhole size={15} />
                Override Lock
              </Button>
            ) : null}
            <Button onClick={() => setSummaryExpanded((value) => !value)} variant="ghost">
              {summaryExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              Summary
            </Button>
            {!finalReview ? (
              <div className="review-action-group" aria-label="Workflow actions">
                <Button disabled={!editable} title={readOnlyTitle} onClick={pend}>Pend</Button>
                <Button disabled={!editable} title={readOnlyTitle} onClick={() => route("Auditor Queue")}>Send to Auditor</Button>
                <Button disabled={!editable} title={readOnlyTitle} onClick={() => route("Manager Review Queue")}>Manager Review</Button>
                <Button disabled={!editable} title={readOnlyTitle} variant="primary" onClick={complete}>Complete Review</Button>
              </div>
            ) : null}
            <div className="review-action-group" aria-label="Navigation actions">
              <Button variant="ghost" onClick={returnToQueue}>Return to Queue</Button>
              <Button variant="secondary" onClick={openNextPatientChart}>
                <Play size={15} />
                Next Patient
              </Button>
            </div>
          </div>
        }
      >
        <div className="patient-title-row">
          <div className="patient-title-block">
            <button type="button" className="patient-back-link" onClick={returnToQueue}>
              <ArrowLeft size={15} />
              Back to Work Queue
            </button>
            <h2>{patient.name}</h2>
            <div className="patient-header-meta-strip">
              <span><small>DOB</small>{formatDate(patient.dob)}</span>
              <span><small>Member ID</small>{patient.memberId}</span>
              <span><small>Plan / Payer</small>{payer?.name}</span>
              <span><small>DOS / Visit</small>{displayAppointment ? formatDate(displayAppointment.date) : "No upcoming visit"}</span>
              <span><small>Provider</small>{provider?.name}</span>
            </div>
          </div>
          <div className="patient-meta">
            <span>CY {review.calendarYear}</span>
            <span>{review.reviewType}</span>
            {summaryExpanded ? (
              <>
                <span>{clinic?.name}</span>
                <span>{provider?.name}</span>
                <span>Assigned to: {maps.users.get(review.assignedUserId)?.name ?? "Unassigned"}</span>
                <span>Workflow status: {review.status}</span>
                <span>Editing status: {review.lock ? `Being edited by ${lockOwner}` : "No active editor"}</span>
              </>
            ) : null}
          </div>
        </div>
        {activeReview.auditReturn ? (
          <div className="warning-banner rework-banner">
            <AlertTriangle size={18} />
            Correction requested by {maps.users.get(activeReview.auditReturn.returnedByUserId)?.name}: {activeReview.auditReturn.comments}
          </div>
        ) : null}
        {nextPatientMessage ? (
          <div className="warning-banner rework-banner">
            <AlertTriangle size={18} />
            {nextPatientMessage}
          </div>
        ) : null}
        {actionMessage ? (
          <div className="success-banner">
            <Check size={16} />
            {actionMessage}
          </div>
        ) : null}
        {incomingProspectiveHandoffs.length ? (
          <div className="incoming-prospective-handoffs">
            <div>
              <strong>Prospective holds for this review</strong>
              <p>Internal CDI notes waiting for the patient's next review.</p>
            </div>
            <div className="incoming-handoff-list">
              {incomingProspectiveHandoffs.map(({ task, sourceReview, condition }) => (
                <div key={task.id} className="incoming-handoff-card">
                  <span className="mono">{condition.icd10}</span>
                  <strong>{condition.description}</strong>
                  <small>From CY {sourceReview.calendarYear} · {task.status}</small>
                  <p>{task.comments ?? "No additional reviewer note."}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {!editable ? (
          <div className="read-only-banner">
            <AlertTriangle size={16} />
            Read-only view. {finalReview ? `${review.status} reviews cannot be edited or completed again.` : review.lock ? `Current editor: ${lockOwner}.` : "Open the chart to acquire an edit lock."}
          </div>
        ) : null}
        <CompactReviewSummary
          dispositionSummary={dispositionSummary}
          projectedRaf={rafSummary.projectedRaf}
          unresolvedRaf={rafSummary.unresolvedPotentialRaf}
          hasDrafts={conditions.some((condition) => Boolean(condition.draftDecision || condition.draftRoutingOutcome || condition.draftDisposition || condition.draftProspectiveHandoff || condition.draftRuleOutcome))}
          summaryExpanded={summaryExpanded}
        />
        {summaryExpanded ? (
          <>
            <div className="summary-label">
              Review decisions and routes
              {conditions.some((condition) => Boolean(condition.draftDecision || condition.draftRoutingOutcome || condition.draftDisposition || condition.draftProspectiveHandoff || condition.draftRuleOutcome)) ? <StatusChip tone="info">Draft</StatusChip> : null}
            </div>
            <div className="summary-grid disposition-summary-grid">
              {Object.entries(dispositionSummary).map(([label, summary]) => {
                const token = dispositionTokens[label as keyof typeof dispositionTokens];
                return (
                  <div className="summary-card" key={label} style={{ color: token.color, background: token.bg, borderColor: token.border }}>
                    <span>{token.label}</span>
                    <strong>{summary.count}</strong>
                    <small>RAF {formatRaf(summary.raf)}</small>
                  </div>
                );
              })}
              <div className="summary-card strong">
                <span>Projected RAF</span>
                <strong>{formatRaf(rafSummary.projectedRaf)}</strong>
                <small>Demo {formatRaf(rafSummary.demographicRaf)} + captured {formatRaf(rafSummary.validatedCapturedRaf)}</small>
              </div>
            </div>
            <div className="summary-label">Originally presented opportunities</div>
            <div className="presented-summary">
              {Object.entries(presentedSummary).map(([category, summary]) => (
                <CategoryBadge key={category} category={category as keyof typeof categoryTokens} count={summary.count} />
              ))}
              <StatusChip tone="purple">Recapture {prospectiveCounts.recapture}</StatusChip>
              <StatusChip tone="warn">Suspect {prospectiveCounts.suspect}</StatusChip>
            </div>
            <div className="raf-metric-grid">
              <span>Unresolved potential RAF {formatRaf(rafSummary.unresolvedPotentialRaf)}</span>
              <span>Potential addition RAF {formatRaf(rafSummary.potentialAdditionRaf)}</span>
              <span>Potential deletion RAF {formatRaf(rafSummary.potentialDeletionRaf)}</span>
              <span>Prospective Recapture RAF {formatRaf(rafSummary.prospectiveRecaptureRaf)}</span>
              <span>Prospective Suspect RAF {formatRaf(rafSummary.prospectiveSuspectRaf)}</span>
            </div>
            <div className="source-eligibility-row">
              <EligibilityChip label="Eligible CPT / encounter type" ok={claim?.cptSourceEligible !== false} />
              <EligibilityChip label="Acceptable provider type" ok={claim?.providerTypeEligible !== false} />
              <EligibilityChip label="Face-to-face visit" ok={claim?.faceToFace !== false} />
              <EligibilityChip label={claim?.providerSignatureValid === false ? "Invalid provider signature" : "Valid provider signature"} ok={claim?.providerSignatureValid !== false} />
            </div>
            {claim ? (
              <div className="claim-detail-row">
                <span>DOS {formatDate(claim.dateOfService)}</span>
                <span>{claim.provider ?? provider?.name}</span>
                <span>{claim.cptCode ?? "CPT"} {claim.encounterType ?? "Encounter"}</span>
                <span>{claim.payer ?? payer?.name}</span>
                <span>{claim.icd10Codes.length ? claim.icd10Codes.join(", ") : "No claim diagnoses"}</span>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="raf-note">
          2026 CMS-HCC V28 - {CMS_V28_MODEL.segmentLabel} assumption. Raw synthetic model score only; not a payment, normalization, or coding-intensity calculation.
        </div>
        {displayAppointment ? (
          <StatusChip tone="good">Next visit: {formatDate(displayAppointment.date)} - {displayAppointment.type}</StatusChip>
        ) : (
          <StatusChip tone="warn">No upcoming visit - scheduling outreach may be needed</StatusChip>
        )}
        <div className="outreach-status-row">
          <StatusChip tone={outreachStatus.status === "Scheduled" || outreachStatus.status === "Completed" ? "good" : outreachStatus.status === "Not Needed" ? "info" : "warn"}>
            Outreach: {outreachStatus.label}
          </StatusChip>
          <span>{outreachStatus.reason}</span>
          {outreachStatus.task && editable && outreachStatus.task.status === "Open" ? (
            <Button variant="secondary" onClick={() => actions.updateDownstreamTaskStatus(outreachStatus.task!.id, "In Progress")}>Start outreach</Button>
          ) : null}
          {outreachStatus.task && editable && outreachStatus.task.status === "In Progress" ? (
            <Button variant="secondary" onClick={() => actions.updateDownstreamTaskStatus(outreachStatus.task!.id, "Completed", "Scheduling outreach completed in the prototype workflow.")}>
              Mark outreach complete
            </Button>
          ) : null}
        </div>
      </Panel>

      {completionWarnings.length > 0 ? (
        <div className="warning-banner">
          <AlertTriangle size={18} />
          Cannot complete while {completionWarnings.length} actionable condition(s) have no disposition. Review highlighted cards below.
        </div>
      ) : null}

      <div className="split-workspace">
        <Panel
          className="chart-evidence-panel"
          title="Patient Chart & Evidence"
          actions={
            <div className="header-actions">
              <span role="status" aria-live="polite" aria-atomic="true">
                <StatusChip tone={activeEvidence.length ? "info" : undefined}>
                  Evidence {selectedEvidenceIndex >= 0 ? selectedEvidenceIndex + 1 : 0} of {activeEvidence.length}
                </StatusChip>
              </span>
              <Button variant="secondary" disabled={activeEvidence.length === 0} onClick={() => stepEvidence("prev")}>
                <ArrowLeft size={15} />
                Previous Evidence
              </Button>
              <Button variant="secondary" disabled={activeEvidence.length === 0} onClick={() => stepEvidence("next")}>
                Next Evidence
                <ArrowRight size={15} />
              </Button>
            </div>
          }
        >
          {chart ? (
          <ChartViewer
            chart={chart}
            documents={documents}
            activeTab={activeChartTab}
            evidence={activeEvidence}
            selectedEvidenceId={selectedEvidenceId}
            activeConditionId={activeConditionId}
            setActiveTab={setActiveChartTab}
          />
          ) : (
            <EmptyState title="Chart unavailable" body="No embedded chart model exists for this review." />
          )}
        </Panel>

        <Panel className="conditions-panel" title="Conditions & Actions">
          <div className="condition-groups">
            {conditionFamilies.map((family) => (
              <ConditionFamilyGroup
                key={family.key}
                family={family}
                review={review}
                editable={editable}
                readOnlyTitle={readOnlyTitle}
                warningIds={completionWarnings}
                jumpToEvidence={jumpToEvidence}
                activeConditionId={activeConditionId}
                setActiveConditionId={setActiveConditionId}
                onDisagree={setDisagreeCondition}
                onChange={setChangeCondition}
                onFlag={setFlagCondition}
                onDeleteSafety={setDeleteSafetyCondition}
              />
            ))}
            <ConditionGroup
              title="Codes On Claim"
              conditions={standaloneRiskConditions.filter((condition) => condition.workflow === "codesOnClaim")}
              review={review}
              editable={editable}
              readOnlyTitle={readOnlyTitle}
              warningIds={completionWarnings}
              jumpToEvidence={jumpToEvidence}
              activeConditionId={activeConditionId}
              setActiveConditionId={setActiveConditionId}
              onDisagree={setDisagreeCondition}
              onChange={setChangeCondition}
              onFlag={setFlagCondition}
              onDeleteSafety={setDeleteSafetyCondition}
            />
            <ConditionGroup
              title="Codes Not On Claim - Potential Additions"
              conditions={standaloneRiskConditions.filter((condition) => condition.workflow === "codesNotOnClaim")}
              review={review}
              editable={editable}
              readOnlyTitle={readOnlyTitle}
              warningIds={completionWarnings}
              jumpToEvidence={jumpToEvidence}
              activeConditionId={activeConditionId}
              setActiveConditionId={setActiveConditionId}
              onDisagree={setDisagreeCondition}
              onChange={setChangeCondition}
              onFlag={setFlagCondition}
              onDeleteSafety={setDeleteSafetyCondition}
            />
            <ConditionGroup
              title={reviewContext === "scheduledUpcomingVisit" ? "Upcoming Visit Opportunities" : reviewContext === "noUpcomingVisit" ? "Prospective Holds" : "Prior-Year Reconciliation Opportunities"}
              conditions={standaloneRiskConditions.filter((condition) => condition.workflow === "prospective")}
              review={review}
              editable={editable}
              readOnlyTitle={readOnlyTitle}
              warningIds={completionWarnings}
              jumpToEvidence={jumpToEvidence}
              activeConditionId={activeConditionId}
              setActiveConditionId={setActiveConditionId}
              onDisagree={setDisagreeCondition}
              onChange={setChangeCondition}
              onFlag={setFlagCondition}
              onDeleteSafety={setDeleteSafetyCondition}
            />
            <ConditionGroup
              title="Quality / Non-HCC"
              conditions={nonRiskConditions}
              review={review}
              editable={editable}
              readOnlyTitle={readOnlyTitle}
              warningIds={completionWarnings}
              jumpToEvidence={jumpToEvidence}
              activeConditionId={activeConditionId}
              setActiveConditionId={setActiveConditionId}
              onDisagree={setDisagreeCondition}
              onChange={setChangeCondition}
              onFlag={setFlagCondition}
              onDeleteSafety={setDeleteSafetyCondition}
            />
          </div>
        </Panel>
      </div>

      <Panel title="Activity History">
        <div className="timeline">
          {data.history
            .filter((item) => item.reviewId === review.id)
            .map((item) => (
              <div key={item.id} className="timeline-item">
                <strong>{item.event}</strong>
                <span>{item.detail}</span>
                <small>
                  {maps.users.get(item.userId)?.name} - {formatDateTime(item.at)}
                </small>
              </div>
            ))}
        </div>
      </Panel>

      {disagreeCondition ? <DisagreeModal condition={disagreeCondition} reviewId={review.id} onClose={() => setDisagreeCondition(null)} /> : null}
      {changeCondition ? <ChangeModal condition={changeCondition} reviewId={review.id} onClose={() => setChangeCondition(null)} /> : null}
      {flagCondition ? <FlagModal condition={flagCondition} reviewId={review.id} onClose={() => setFlagCondition(null)} /> : null}
      {deleteSafetyCondition ? <DeleteSafetyModal condition={deleteSafetyCondition} reviewId={review.id} onClose={() => setDeleteSafetyCondition(null)} jumpToEvidence={jumpToEvidence} /> : null}
      {overrideRequested ? <OverrideLockModal reviewId={review.id} onClose={() => setOverrideRequested(false)} /> : null}
    </div>
  );
}

function CompactReviewSummary({
  dispositionSummary,
  projectedRaf,
  unresolvedRaf,
  hasDrafts,
  summaryExpanded
}: {
  dispositionSummary: ReturnType<typeof getDispositionSummary>;
  projectedRaf: number;
  unresolvedRaf: number;
  hasDrafts: boolean;
  summaryExpanded: boolean;
}) {
  if (summaryExpanded) return null;
  const prospectiveDecisions = ["Prospective Yes", "Prospective No", "Changed"] as const;
  const prospectiveCount = prospectiveDecisions.reduce((sum, label) => sum + dispositionSummary[label].count, 0);
  const prospectiveRaf = prospectiveDecisions.reduce((sum, label) => sum + dispositionSummary[label].raf, 0);
  return (
    <div className="compact-review-summary" aria-label="Compact review summary">
      {hasDrafts ? <StatusChip tone="info">Draft</StatusChip> : null}
      <ReviewSummaryCard category="validated" label="Validated" value={dispositionSummary.Validated.count} raf={dispositionSummary.Validated.raf} />
      <ReviewSummaryCard category="potentialDelete" label="Selected Delete" value={dispositionSummary.Deleted.count} raf={dispositionSummary.Deleted.raf} />
      <ReviewSummaryCard category="potentialAddition" label="Selected Addition" value={dispositionSummary["Added to Claim"].count} raf={dispositionSummary["Added to Claim"].raf} />
      <ReviewSummaryCard category="prospective" label="Opportunity Outcomes" value={prospectiveCount} raf={prospectiveRaf} />
      <div className="review-summary-card total-raf-card">
        <span>Total RAF</span>
        <strong>{formatRaf(projectedRaf)}</strong>
        <small>Open RAF {formatRaf(unresolvedRaf)}</small>
      </div>
    </div>
  );
}

function ReviewSummaryCard({ category, label, value, raf }: { category: keyof typeof categoryTokens; label: string; value: number; raf: number }) {
  const token = categoryTokens[category];
  return (
    <div className="review-summary-card" style={{ color: token.color, background: token.bg, borderColor: token.border }}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>RAF {formatRaf(raf)}</small>
    </div>
  );
}

const chartTabs: Array<{
  value: ChartTab;
  label: string;
  icon: typeof Stethoscope;
  count: (chart: ClinicalChart) => number;
  countLabel: string;
}> = [
  { value: "encounters", label: "Encounters", icon: Stethoscope, count: (chart) => chart.encounters.length, countLabel: "notes" },
  { value: "problem-list", label: "Problem List", icon: ClipboardList, count: (chart) => chart.problems.length, countLabel: "items" },
  { value: "pmh", label: "Past Medical Hx", icon: FileClock, count: (chart) => chart.pastMedicalHistory.length, countLabel: "items" },
  { value: "medications", label: "Medications", icon: Pill, count: (chart) => chart.medications.length, countLabel: "medications" },
  { value: "labs", label: "Labs", icon: FlaskConical, count: (chart) => chart.labs.length, countLabel: "panels" },
  { value: "vitals", label: "Vitals", icon: HeartPulse, count: (chart) => chart.vitals.length, countLabel: "records" },
  { value: "imaging", label: "Imaging", icon: ImageIcon, count: (chart) => chart.imaging.length, countLabel: "reports" },
  { value: "specialist-notes", label: "Specialist Notes", icon: FileText, count: (chart) => chart.specialistNotes.length, countLabel: "notes" },
  { value: "claims", label: "Claims", icon: ReceiptText, count: (chart) => chart.claims.length, countLabel: "claims" }
];

function chartElementId(tab: ChartTab, itemId: string, sectionId?: string) {
  return `chart-${tab}-${itemId}${sectionId ? `-${sectionId}` : ""}`;
}

function withExpandedItem(current: Set<string>, itemId: string, open: boolean) {
  const hasItem = current.has(itemId);
  if (hasItem === open) return current;
  const next = new Set(current);
  if (open) next.add(itemId);
  else next.delete(itemId);
  return next;
}

function scrollToRenderedTarget(root: HTMLElement, resolveTarget: () => HTMLElement | null) {
  let observer: MutationObserver | undefined;
  let timeoutId: number | undefined;

  const cleanup = () => {
    observer?.disconnect();
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  };
  const scrollIfReady = () => {
    const target = resolveTarget();
    if (!target || target.closest("details:not([open])")) return false;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    cleanup();
    return true;
  };

  if (scrollIfReady()) return cleanup;
  observer = new MutationObserver(scrollIfReady);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
  timeoutId = window.setTimeout(cleanup, 500);
  return cleanup;
}

function accordionParentForEvidence(chart: ClinicalChart, evidenceId: string, passage?: EvidencePassage) {
  const tab = passage?.chartAnchor?.tab;
  if (tab === "encounters") {
    return chart.encounters.find(
      (encounter) =>
        encounter.evidenceIds.includes(evidenceId) ||
        Object.values(encounter.sectionEvidenceIds).some((ids) => ids?.includes(evidenceId)) ||
        encounter.vitals.evidenceIds.includes(evidenceId) ||
        encounter.assessmentPlan.some((plan) => plan.evidenceIds.includes(evidenceId))
    )?.id;
  }
  if (tab === "labs") return chart.labs.find((panel) => panel.results.some((result) => result.evidenceIds.includes(evidenceId)))?.id;
  if (tab === "imaging") return chart.imaging.find((report) => report.evidenceIds.includes(evidenceId))?.id ?? passage?.chartAnchor?.itemId;
  if (tab === "specialist-notes") return chart.specialistNotes.find((note) => note.evidenceIds.includes(evidenceId))?.id ?? passage?.chartAnchor?.itemId;
  if (tab === "claims") return passage?.chartAnchor?.itemId;
  return undefined;
}

export function targetForEvidence(chart: ClinicalChart, evidenceId: string, passage?: EvidencePassage) {
  const anchor = passage?.chartAnchor;
  if (anchor?.tab === "encounters") {
    for (const encounter of chart.encounters) {
      const matchingPlan = encounter.assessmentPlan.find((plan) => plan.evidenceIds.includes(evidenceId));
      if (matchingPlan) return chartElementId("encounters", matchingPlan.id, "assessmentPlan");
      const matchingSection = Object.entries(encounter.sectionEvidenceIds).find(([, ids]) => ids?.includes(evidenceId));
      if (matchingSection) return chartElementId("encounters", encounter.id, matchingSection[0]);
      if (encounter.vitals.evidenceIds.includes(evidenceId)) return chartElementId("encounters", encounter.vitals.id, "vitals");
    }
  }
  if (anchor?.tab === "labs") {
    for (const panel of chart.labs) {
      const result = panel.results.find((item) => item.evidenceIds.includes(evidenceId));
      if (result) return chartElementId("labs", result.id);
    }
  }
  if (anchor?.tab === "problem-list") {
    const problem = chart.problems.find((item) => item.evidenceIds.includes(evidenceId));
    if (problem) return chartElementId("problem-list", problem.id);
  }
  if (anchor?.tab === "medications") {
    const medication = chart.medications.find((item) => item.evidenceIds.includes(evidenceId));
    if (medication) return chartElementId("medications", medication.id);
  }
  if (anchor?.tab === "vitals") {
    const vital = chart.vitals.find((item) => item.evidenceIds.includes(evidenceId));
    if (vital) return chartElementId("vitals", vital.id);
  }
  if (anchor?.tab === "imaging") {
    const report = chart.imaging.find((item) => item.evidenceIds.includes(evidenceId));
    if (report) return chartElementId("imaging", report.id, "findings");
  }
  if (anchor?.tab === "pmh") {
    const history = chart.pastMedicalHistory.find((item) => item.evidenceIds.includes(evidenceId));
    if (history) return chartElementId("pmh", history.id);
  }
  if (anchor?.tab === "specialist-notes") {
    const specialist = chart.specialistNotes.find((item) => item.evidenceIds.includes(evidenceId));
    if (specialist) return chartElementId("specialist-notes", specialist.id, "note");
  }
  return anchor ? chartElementId(anchor.tab, anchor.itemId, anchor.sectionId) : undefined;
}

function ChartViewer({
  chart,
  documents,
  activeTab,
  evidence,
  selectedEvidenceId,
  activeConditionId,
  setActiveTab
}: {
  chart: ClinicalChart;
  documents: Array<{ id: string }>;
  activeTab: ChartTab;
  evidence: EvidencePassage[];
  selectedEvidenceId?: string;
  activeConditionId?: string;
  setActiveTab: (tab: ChartTab) => void;
}) {
  const chartViewerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedSearchResult, setFocusedSearchResult] = useState<ChartSearchResult | null>(null);
  const [openEncounterIds, setOpenEncounterIds] = useState<Set<string>>(() => new Set());
  const [openLabIds, setOpenLabIds] = useState<Set<string>>(() => new Set());
  const [openImagingIds, setOpenImagingIds] = useState<Set<string>>(() => new Set());
  const [openSpecialistIds, setOpenSpecialistIds] = useState<Set<string>>(() => new Set());
  const [openClaimIds, setOpenClaimIds] = useState<Set<string>>(() => new Set());
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = normalizeChartSearchQuery(deferredSearchQuery);
  const searchResults = useMemo(() => buildChartSearchResults(chart, normalizedSearchQuery), [chart, normalizedSearchQuery]);
  const visibleSearchResults = searchResults.slice(0, 12);
  const evidenceMap = useMemo(() => new Map(evidence.map((item) => [item.id, item])), [evidence]);
  const evidenceForIds = (ids: string[] = []) => ids.map((id) => evidenceMap.get(id)).filter(Boolean) as EvidencePassage[];
  const rowClass = (ids: string[] = []) => {
    const scoped = ids.some((id) => evidenceMap.has(id));
    const selected = ids.includes(selectedEvidenceId ?? "");
    return `chart-row ${scoped ? "has-evidence" : ""} ${selected ? "selected-evidence" : ""}`;
  };
  const evidenceStyle = (items: EvidencePassage[]) => {
    const firstEvidence = items[0];
    const token = firstEvidence ? tokenForEvidence(firstEvidence) : undefined;
    return token ? { borderColor: token.border } : undefined;
  };

  function setAccordionOpen(tab: ChartTab, itemId: string, open: boolean) {
    if (tab === "encounters") setOpenEncounterIds((current) => withExpandedItem(current, itemId, open));
    if (tab === "labs") setOpenLabIds((current) => withExpandedItem(current, itemId, open));
    if (tab === "imaging") setOpenImagingIds((current) => withExpandedItem(current, itemId, open));
    if (tab === "specialist-notes") setOpenSpecialistIds((current) => withExpandedItem(current, itemId, open));
    if (tab === "claims") setOpenClaimIds((current) => withExpandedItem(current, itemId, open));
  }

  function focusSearchResult(result: ChartSearchResult) {
    setFocusedSearchResult(result);
    setActiveTab(result.tab);
    if (result.parentId) setAccordionOpen(result.tab, result.parentId, true);
    window.setTimeout(() => {
      document.getElementById(chartElementId(result.tab, result.itemId, result.sectionId))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  useEffect(() => {
    setSearchQuery("");
    setFocusedSearchResult(null);
    setOpenEncounterIds(new Set());
    setOpenLabIds(new Set());
    setOpenImagingIds(new Set());
    setOpenSpecialistIds(new Set());
    setOpenClaimIds(new Set());
  }, [chart.reviewId]);

  useEffect(() => {
    if (!selectedEvidenceId) return;
    const passage = evidenceMap.get(selectedEvidenceId);
    const root = chartViewerRef.current;
    if (!passage || !root) return;
    if (passage.chartAnchor) {
      const parentId = accordionParentForEvidence(chart, selectedEvidenceId, passage);
      if (parentId) setAccordionOpen(passage.chartAnchor.tab, parentId, true);
    }
    const targetId = targetForEvidence(chart, selectedEvidenceId, passage);
    return scrollToRenderedTarget(root, () => {
      const target = document.getElementById(`span-${selectedEvidenceId}`) ??
        (targetId ? document.getElementById(targetId) : null) ??
        document.getElementById(passage.anchorId);
      return target instanceof HTMLElement && root.contains(target) ? target : null;
    });
  }, [activeTab, chart, evidenceMap, selectedEvidenceId]);

  const isFocused = (tab: ChartTab, itemId: string, sectionId?: string) =>
    focusedSearchResult?.tab === tab &&
    focusedSearchResult.itemId === itemId &&
    (focusedSearchResult.sectionId ?? "") === (sectionId ?? "");

  function handleChartTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % chartTabs.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + chartTabs.length) % chartTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = chartTabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextTab = chartTabs[nextIndex].value;
    setActiveTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`chart-tab-${nextTab}`)?.focus());
  }

  return (
    <div ref={chartViewerRef} className="chart-viewer">
      <section className="chart-search-card" aria-label="Chart search">
        <div className="chart-search-copy">
          <span>Chart Search</span>
          <p>Find diagnoses and evidence across notes, results, specialist records, and claims.</p>
        </div>
        <div className="chart-search-input">
          <Search size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="full-chart-search">Search the full patient chart</label>
          <input
            id="full-chart-search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setFocusedSearchResult(null);
            }}
            placeholder="Search the full patient chart"
          />
          {searchQuery ? <button type="button" onClick={() => { setSearchQuery(""); setFocusedSearchResult(null); }}>Clear</button> : null}
        </div>
        {normalizedSearchQuery ? (
          <div className="chart-search-results" aria-live="polite">
            <div className="chart-search-results-heading">
              <strong>{searchResults.length} match{searchResults.length === 1 ? "" : "es"}</strong>
              <span>for “{normalizedSearchQuery}”</span>
            </div>
            {visibleSearchResults.length ? (
              <div className="chart-search-result-list">
                {visibleSearchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className={focusedSearchResult?.id === result.id ? "active" : ""}
                    onClick={() => focusSearchResult(result)}
                  >
                    <span><strong>{result.sourceLabel}</strong><small>{result.sectionLabel}</small></span>
                    <span>{renderSearchText(result.preview, normalizedSearchQuery, `${result.id}-preview`)}</span>
                    <StatusChip tone="info">{result.matchCount}</StatusChip>
                  </button>
                ))}
              </div>
            ) : (
              <p className="chart-search-empty">No matching chart records.</p>
            )}
            {searchResults.length > visibleSearchResults.length ? <small>Showing the first 12 results. Refine the search to narrow the list.</small> : null}
          </div>
        ) : null}
      </section>

      <div className="chart-tabs-scroll">
        <div className="document-tabs chart-tabs" role="tablist" aria-label="Patient chart sections" aria-orientation="horizontal">
          {chartTabs.map((tab, index) => {
            const Icon = tab.icon;
            const count = tab.count(chart);
            return (
              <button
                id={`chart-tab-${tab.value}`}
                key={tab.value}
                className={tab.value === activeTab ? "active" : ""}
                data-chart-tab={tab.value}
                role="tab"
                aria-controls={`chart-panel-${tab.value}`}
                aria-selected={tab.value === activeTab}
                tabIndex={tab.value === activeTab ? 0 : -1}
                onClick={() => setActiveTab(tab.value)}
                onKeyDown={(event) => handleChartTabKeyDown(event, index)}
                type="button"
              >
                <Icon size={16} aria-hidden="true" />
                <span className="chart-tab-copy"><strong>{tab.label}</strong><small>{count} {tab.countLabel}</small></span>
              </button>
            );
          })}
        </div>
      </div>

      <article
        id={`chart-panel-${activeTab}`}
        className="document-page chart-page"
        role="tabpanel"
        aria-labelledby={`chart-tab-${activeTab}`}
      >
        <header>
          <div>
            <span className="eyebrow">Clinical Record</span>
            <h3>Longitudinal Patient Chart</h3>
          </div>
          <div className="document-header-chips">
            <StatusChip tone="info">{documents.length} source record(s)</StatusChip>
            <StatusChip tone={activeConditionId ? "purple" : "info"}>{activeConditionId ? "Condition-scoped evidence" : "All evidence visible"}</StatusChip>
          </div>
        </header>
        {activeTab === "encounters" ? (
          <div className="chart-accordion-list">
            {chart.encounters.map((encounter) => {
              const hpiEvidence = evidenceForIds(encounter.sectionEvidenceIds.hpi);
              const planEvidence = evidenceForIds(encounter.sectionEvidenceIds.assessmentPlan);
              return (
                <details
                  key={encounter.id}
                  className={`chart-accordion ${focusedSearchResult?.parentId === encounter.id ? "search-focus" : ""}`}
                  open={openEncounterIds.has(encounter.id)}
                  onToggle={(event) => setAccordionOpen("encounters", encounter.id, event.currentTarget.open)}
                >
                  <summary className="chart-accordion-summary">
                    <div>
                      <strong>{formatDate(encounter.date)}</strong>
                      <span>{renderSearchText(`${encounter.type} · ${encounter.provider}`, normalizedSearchQuery, `${encounter.id}-summary`)}</span>
                    </div>
                    <StatusChip>{encounter.billingCode}</StatusChip>
                  </summary>
                  <section className="chart-note chart-accordion-content">
                    <ChartSection title="Chief Complaint" id={chartElementId("encounters", encounter.id, "chiefComplaint")} className={isFocused("encounters", encounter.id, "chiefComplaint") ? "search-focus" : ""}>
                      {renderSearchText(encounter.chiefComplaint, normalizedSearchQuery, `${encounter.id}-chief`)}
                    </ChartSection>
                    <ChartSection
                      title="History of Present Illness"
                      id={chartElementId("encounters", encounter.id, "hpi")}
                      className={`${rowClass(encounter.sectionEvidenceIds.hpi)} ${isFocused("encounters", encounter.id, "hpi") ? "search-focus" : ""}`}
                      style={evidenceStyle(hpiEvidence)}
                    >
                      {renderEvidenceSpans(encounter.hpi, hpiEvidence, selectedEvidenceId, normalizedSearchQuery)}
                    </ChartSection>
                    <ChartSection title="Review Of Systems" id={chartElementId("encounters", encounter.id, "ros")} className={isFocused("encounters", encounter.id, "ros") ? "search-focus" : ""}>
                      <ul>{encounter.reviewOfSystems.map((item) => <li key={item}>{renderSearchText(item, normalizedSearchQuery, `${encounter.id}-ros-${item}`)}</li>)}</ul>
                    </ChartSection>
                    <ChartSection title="Vitals" id={chartElementId("encounters", encounter.vitals.id, "vitals")} className={isFocused("encounters", encounter.vitals.id, "vitals") ? "search-focus" : ""}>
                      <div id={chartElementId("vitals", encounter.vitals.id)} className={`encounter-vitals ${rowClass(encounter.vitals.evidenceIds)}`}>
                        <span>BP {encounter.vitals.systolic}/{encounter.vitals.diastolic}</span><span>HR {encounter.vitals.heartRate}</span><span>Temp {encounter.vitals.temperature}F</span><span>Wt {encounter.vitals.weight} lb</span><span>BMI {encounter.vitals.bmi}</span><span>O2 {encounter.vitals.oxygenSaturation}%</span>
                      </div>
                    </ChartSection>
                    <ChartSection title="Physical Exam" id={chartElementId("encounters", encounter.id, "physicalExam")} className={isFocused("encounters", encounter.id, "physicalExam") ? "search-focus" : ""}>
                      <div className="exam-grid">
                        {encounter.physicalExam.map((item, index) => (
                          <div key={`${encounter.id}-${item.system}-${index}`}><strong>{renderSearchText(item.system, normalizedSearchQuery, `${encounter.id}-exam-system-${index}`)}</strong><span>{renderSearchText(item.text, normalizedSearchQuery, `${encounter.id}-exam-${index}`)}</span></div>
                        ))}
                      </div>
                    </ChartSection>
                    <ChartSection
                      title="Assessment And Plan"
                      id={chartElementId("encounters", encounter.id, "assessmentPlan")}
                      className={`${rowClass(encounter.sectionEvidenceIds.assessmentPlan)} ${isFocused("encounters", encounter.id, "assessmentPlan") ? "search-focus" : ""}`}
                      style={evidenceStyle(planEvidence)}
                    >
                      <ol className="plan-list">
                        {encounter.assessmentPlan.map((plan, index) => {
                          const itemEvidence = evidenceForIds(plan.evidenceIds);
                          return (
                            <li
                              key={plan.id}
                              id={chartElementId("encounters", plan.id, "assessmentPlan")}
                              className={`${rowClass(plan.evidenceIds)} ${isFocused("encounters", plan.id, "assessmentPlan") ? "search-focus" : ""}`}
                              style={evidenceStyle(itemEvidence)}
                            >
                              <strong>{index + 1}. {renderSearchText(plan.problem, normalizedSearchQuery, `${plan.id}-problem`)}</strong>
                              <span>{renderEvidenceSpans(plan.detail, itemEvidence, selectedEvidenceId, normalizedSearchQuery)}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </ChartSection>
                    <footer id={chartElementId("encounters", encounter.id, "billing")} className={isFocused("encounters", encounter.id, "billing") ? "search-focus" : ""}>
                      Electronically signed by {encounter.provider} on {formatDate(encounter.date)} at {encounter.signatureTime}. Billing code {encounter.billingCode}.
                    </footer>
                  </section>
                </details>
              );
            })}
          </div>
        ) : null}
        {activeTab === "problem-list" ? (
          <ChartTable headers={["Diagnosis", "ICD-10", "Status", "Date Added", "HCC"]}>
            {chart.problems.map((problem) => (
              <tr key={problem.id} id={chartElementId("problem-list", problem.id)} className={`${rowClass(problem.evidenceIds)} ${isFocused("problem-list", problem.id) ? "search-focus" : ""}`} style={evidenceStyle(evidenceForIds(problem.evidenceIds))}>
                <td>{renderSearchText(problem.diagnosis, normalizedSearchQuery, `${problem.id}-diagnosis`)}</td>
                <td className="mono">{renderSearchText(problem.code, normalizedSearchQuery, `${problem.id}-code`)}</td>
                <td>{problem.status}</td>
                <td>{formatDate(problem.dateAdded)}</td>
                <td>{problem.isHcc ? "Yes" : "No"}</td>
              </tr>
            ))}
          </ChartTable>
        ) : null}
        {activeTab === "pmh" ? (
          <div className="chart-stack">
            {chart.pastMedicalHistory.map((item) => (
              <div key={item.id} id={chartElementId("pmh", item.id)} className={`chart-list-row ${rowClass(item.evidenceIds)} ${isFocused("pmh", item.id) ? "search-focus" : ""}`}>{renderSearchText(item.text, normalizedSearchQuery, `${item.id}-pmh`)}</div>
            ))}
          </div>
        ) : null}
        {activeTab === "medications" ? (
          <ChartTable headers={["Medication", "Dose", "Frequency", "Route", "Prescriber"]}>
            {chart.medications.map((medication) => (
              <tr key={medication.id} id={chartElementId("medications", medication.id)} className={`${rowClass(medication.evidenceIds)} ${isFocused("medications", medication.id) ? "search-focus" : ""}`} style={evidenceStyle(evidenceForIds(medication.evidenceIds))}>
                <td>{renderSearchText(medication.name, normalizedSearchQuery, `${medication.id}-name`)}</td>
                <td>{renderSearchText(medication.dose, normalizedSearchQuery, `${medication.id}-dose`)}</td>
                <td>{renderSearchText(medication.frequency, normalizedSearchQuery, `${medication.id}-frequency`)}</td>
                <td>{renderSearchText(medication.route, normalizedSearchQuery, `${medication.id}-route`)}</td>
                <td>{renderSearchText(medication.prescriber, normalizedSearchQuery, `${medication.id}-prescriber`)}</td>
              </tr>
            ))}
          </ChartTable>
        ) : null}
        {activeTab === "labs" ? (
          <div className="chart-accordion-list">
            {chart.labs.map((panel) => (
              <details
                key={panel.id}
                id={chartElementId("labs", panel.id)}
                className={`chart-accordion ${focusedSearchResult?.parentId === panel.id ? "search-focus" : ""}`}
                open={openLabIds.has(panel.id)}
                onToggle={(event) => setAccordionOpen("labs", panel.id, event.currentTarget.open)}
              >
                <summary className="chart-accordion-summary">
                  <div><strong>{renderSearchText(panel.name, normalizedSearchQuery, `${panel.id}-name`)}</strong><span>{formatDate(panel.date)}</span></div>
                  <FlaskConical size={17} aria-hidden="true" />
                </summary>
                <div className="chart-accordion-content chart-table-section">
                  <ChartTable headers={["Component", "Value", "Unit", "Reference", "Flag"]}>
                    {panel.results.map((result) => (
                      <tr key={result.id} id={chartElementId("labs", result.id)} className={`${rowClass(result.evidenceIds)} ${isFocused("labs", result.id) ? "search-focus" : ""}`} style={evidenceStyle(evidenceForIds(result.evidenceIds))}>
                        <td>{renderSearchText(result.component, normalizedSearchQuery, `${result.id}-component`)}</td>
                        <td className={`lab-${result.flag}`}>{renderSearchText(result.value, normalizedSearchQuery, `${result.id}-value`)}</td>
                        <td>{result.unit}</td>
                        <td>{result.referenceRange}</td>
                        <td><span className={`lab-flag lab-flag-${result.flag}`}>{result.flag}</span></td>
                      </tr>
                    ))}
                  </ChartTable>
                </div>
              </details>
            ))}
          </div>
        ) : null}
        {activeTab === "vitals" ? (
          <ChartTable headers={["Date", "BP", "HR", "Temp", "Weight", "Height", "BMI", "O2 Sat"]}>
            {chart.vitals.map((vital) => (
              <tr key={vital.id} id={chartElementId("vitals", vital.id)} className={`${rowClass(vital.evidenceIds)} ${isFocused("vitals", vital.id) ? "search-focus" : ""}`} style={evidenceStyle(evidenceForIds(vital.evidenceIds))}>
                <td>{formatDate(vital.date)}</td>
                <td>{vital.systolic}/{vital.diastolic}</td>
                <td>{vital.heartRate}</td>
                <td>{vital.temperature}F</td>
                <td>{vital.weight} lb</td>
                <td>{vital.height} in</td>
                <td>{vital.bmi}</td>
                <td>{vital.oxygenSaturation}%</td>
              </tr>
            ))}
          </ChartTable>
        ) : null}
        {activeTab === "imaging" ? (
          <div className="chart-accordion-list">
            {chart.imaging.map((report) => {
              const reportEvidence = evidenceForIds(report.evidenceIds);
              return (
                <details key={report.id} className={`chart-accordion ${focusedSearchResult?.parentId === report.id ? "search-focus" : ""}`} open={openImagingIds.has(report.id)} onToggle={(event) => setAccordionOpen("imaging", report.id, event.currentTarget.open)}>
                  <summary id={chartElementId("imaging", report.id, "indication")} className="chart-accordion-summary"><div><strong>{renderSearchText(report.type, normalizedSearchQuery, `${report.id}-type`)}</strong><span>{formatDate(report.date)} · {renderSearchText(report.indication, normalizedSearchQuery, `${report.id}-indication`)}</span></div><ImageIcon size={17} aria-hidden="true" /></summary>
                  <section className={`chart-note chart-accordion-content ${rowClass(report.evidenceIds)}`} style={evidenceStyle(reportEvidence)}>
                    <ChartSection title="Findings" id={chartElementId("imaging", report.id, "findings")} className={isFocused("imaging", report.id, "findings") ? "search-focus" : ""}>{renderEvidenceSpans(report.findings, reportEvidence, selectedEvidenceId, normalizedSearchQuery)}</ChartSection>
                    <ChartSection title="Impression" id={chartElementId("imaging", report.id, "impression")} className={isFocused("imaging", report.id, "impression") ? "search-focus" : ""}><ol>{report.impression.map((line) => <li key={line}>{renderSearchText(line, normalizedSearchQuery, `${report.id}-impression-${line}`)}</li>)}</ol></ChartSection>
                  </section>
                </details>
              );
            })}
          </div>
        ) : null}
        {activeTab === "specialist-notes" ? (
          <div className="chart-accordion-list">
            {chart.specialistNotes.map((note) => {
              const noteEvidence = evidenceForIds(note.evidenceIds);
              return (
                <details key={note.id} className={`chart-accordion ${focusedSearchResult?.parentId === note.id ? "search-focus" : ""}`} open={openSpecialistIds.has(note.id)} onToggle={(event) => setAccordionOpen("specialist-notes", note.id, event.currentTarget.open)}>
                  <summary className="chart-accordion-summary"><div><strong>{renderSearchText(note.title, normalizedSearchQuery, `${note.id}-title`)}</strong><span>{note.specialty} · {note.provider} · {formatDate(note.date)}</span></div><FileText size={17} aria-hidden="true" /></summary>
                  <section id={chartElementId("specialist-notes", note.id, "note")} className={`chart-note chart-accordion-content ${rowClass(note.evidenceIds)} ${isFocused("specialist-notes", note.id, "note") ? "search-focus" : ""}`} style={evidenceStyle(noteEvidence)}>
                    <ChartSection title="Consult Note">{renderEvidenceSpans(note.note, noteEvidence, selectedEvidenceId, normalizedSearchQuery)}</ChartSection>
                    <ChartSection title="Assessment" id={chartElementId("specialist-notes", note.id, "assessment")} className={isFocused("specialist-notes", note.id, "assessment") ? "search-focus" : ""}><ol>{note.assessment.map((line) => <li key={line}>{renderSearchText(line, normalizedSearchQuery, `${note.id}-assessment-${line}`)}</li>)}</ol></ChartSection>
                  </section>
                </details>
              );
            })}
          </div>
        ) : null}
        {activeTab === "claims" ? (
          <div className="chart-accordion-list claim-list">
            {chart.claims.map((claim) => {
              const claimEvidence = evidence.filter((item) => item.chartAnchor?.tab === "claims" && item.chartAnchor.itemId === claim.id);
              return (
                <details key={claim.id} id={chartElementId("claims", claim.id)} className={`chart-accordion ${rowClass(claimEvidence.map((item) => item.id))} ${focusedSearchResult?.parentId === claim.id ? "search-focus" : ""}`} style={evidenceStyle(claimEvidence)} open={openClaimIds.has(claim.id)} onToggle={(event) => setAccordionOpen("claims", claim.id, event.currentTarget.open)}>
                  <summary className="chart-accordion-summary claim-summary">
                    <div><strong>{formatDate(claim.dateOfService)} · {claim.provider ?? "Rendering provider"}</strong><span>{claim.payer ?? "Payer not listed"} · {claim.cptCode ?? "CPT pending"} · {claim.encounterType ?? "Encounter type pending"}</span></div>
                  </summary>
                  <div className="chart-accordion-content claim-detail-card">
                    <div className="claim-detail-grid"><div><span>Date of service</span><strong>{formatDate(claim.dateOfService)}</strong></div><div><span>Provider</span><strong>{claim.provider ?? "Not listed"}</strong></div><div><span>CPT / visit type</span><strong>{claim.cptCode ?? "Pending"} · {claim.encounterType ?? "Not listed"}</strong></div><div><span>Payer</span><strong>{claim.payer ?? "Not listed"}</strong></div><div><span>Diagnosis codes</span><strong>{claim.icd10Codes.length ? renderEvidenceSpans(claim.icd10Codes.join(", "), claimEvidence, selectedEvidenceId, normalizedSearchQuery) : "No diagnosis codes"}</strong></div></div>
                  </div>
                </details>
              );
            })}
          </div>
        ) : null}
      </article>
    </div>
  );
}

function ChartSection({ title, children, id, className = "", style }: { title: string; children: ReactNode; id?: string; className?: string; style?: CSSProperties }) {
  return (
    <section id={id} className={`chart-section ${className}`} style={style}>
      <h4>{title}</h4>
      <div>{children}</div>
    </section>
  );
}

function ChartTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="chart-table-wrap">
      <table className="chart-table">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function renderSearchText(text: string, normalizedQuery: string, keyPrefix: string): ReactNode {
  if (!normalizedQuery) return text;

  const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(${escapedQuery})`, "gi");
  const pieces = text.split(matcher);

  return pieces.map((piece, index) =>
    piece.toLocaleLowerCase() === normalizedQuery ? (
      <mark key={`${keyPrefix}-match-${index}`} className="chart-search-highlight">
        {piece}
      </mark>
    ) : (
      <Fragment key={`${keyPrefix}-text-${index}`}>{piece}</Fragment>
    )
  );
}

function renderEvidenceSpans(sectionText: string, evidence: EvidencePassage[], selectedEvidenceId?: string, normalizedSearchQuery = "") {
  const spans = evidence
    .map((item) => {
      const exactText = item.exactText ?? item.text;
      const start = typeof item.startOffset === "number" ? item.startOffset : sectionText.toLowerCase().indexOf(exactText.toLowerCase());
      const end = typeof item.endOffset === "number" ? item.endOffset : start + exactText.length;
      return start >= 0 && end > start ? { item, start, end } : undefined;
    })
    .filter(Boolean)
    .sort((a, b) => a!.start - b!.start) as { item: EvidencePassage; start: number; end: number }[];
  const pieces: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span) => {
    if (span.start < cursor) return;
    const token = tokenForEvidence(span.item);
    if (span.start > cursor) {
      pieces.push(renderSearchText(sectionText.slice(cursor, span.start), normalizedSearchQuery, `${span.item.id}-before`));
    }
    pieces.push(
      <mark
        id={`span-${span.item.id}`}
        key={span.item.id}
        className={`evidence-span ${selectedEvidenceId === span.item.id ? "selected" : ""}`}
        style={{ color: token.color, background: token.bg, borderColor: token.border }}
      >
        {renderSearchText(sectionText.slice(span.start, span.end), normalizedSearchQuery, `${span.item.id}-evidence`)}
      </mark>
    );
    cursor = span.end;
  });
  if (cursor < sectionText.length) {
    pieces.push(renderSearchText(sectionText.slice(cursor), normalizedSearchQuery, "section-tail"));
  }
  return pieces.length ? pieces : renderSearchText(sectionText, normalizedSearchQuery, "section");
}

interface RelatedConditionFamily {
  key: string;
  label: string;
  hccPath: string;
  conditions: Condition[];
}

export function groupRelatedRiskConditions(conditions: Condition[], patient?: Patient): RelatedConditionFamily[] {
  const grouped = new Map<string, { key: string; label: string; conditions: Condition[] }>();
  conditions.forEach((condition) => {
    const family = getConditionClinicalFamily(condition);
    if (!family) return;
    const existing = grouped.get(family.key);
    if (existing) existing.conditions.push(condition);
    else grouped.set(family.key, { ...family, conditions: [condition] });
  });

  return Array.from(grouped.values())
    .filter((family) => family.conditions.length > 1)
    .map((family) => {
      const sorted = [...family.conditions].sort((left, right) => compareConditionsByHierarchy(left, right, patient));
      const hccPath = Array.from(new Set(sorted.flatMap((condition) => condition.hcc.split(" + ").filter(Boolean)))).join(" → ");
      return { ...family, hccPath, conditions: sorted };
    })
    .sort((left, right) => compareConditionsByHierarchy(left.conditions[0], right.conditions[0], patient));
}

type ConditionCardProps = {
  condition: Condition;
  review: ReturnType<typeof useAppState>["data"]["reviews"][number];
  editable: boolean;
  readOnlyTitle?: string;
  isWarning: boolean;
  jumpToEvidence: (evidence: EvidencePassage) => void;
  isActive: boolean;
  setActiveConditionId: (conditionId: string) => void;
  onDisagree: (condition: Condition) => void;
  onChange: (condition: Condition) => void;
  onFlag: (condition: Condition) => void;
  onDeleteSafety: (condition: Condition) => void;
};

type ConditionGroupProps = {
  title: string;
  conditions: Condition[];
  review: ReturnType<typeof useAppState>["data"]["reviews"][number];
  editable: boolean;
  readOnlyTitle?: string;
  warningIds: string[];
  jumpToEvidence: (evidence: EvidencePassage) => void;
  activeConditionId?: string;
  setActiveConditionId: (conditionId: string) => void;
  onDisagree: (condition: Condition) => void;
  onChange: (condition: Condition) => void;
  onFlag: (condition: Condition) => void;
  onDeleteSafety: (condition: Condition) => void;
};

function HierarchyAwareConditionCard(props: ConditionCardProps) {
  const { data } = useAppState();
  const hierarchy = getConditionHierarchySuppression(props.condition, props.review, data);
  if (!hierarchy.fullySuppressed) return <ConditionCard {...props} />;

  const suppression = hierarchy.suppressedHccs[0];
  return (
    <details className="trumped-condition-card">
      <summary onClick={() => props.setActiveConditionId(props.condition.id)}>
        <span className="condition-marker trumped-condition-marker">T</span>
        <span className="trumped-condition-copy">
          <span><strong className="mono">{props.condition.icd10}</strong> {props.condition.description}</span>
          <small>{suppression.lower} is below selected {suppression.higher} ({suppression.capturedCondition.icd10}).</small>
        </span>
        <StatusChip tone="warn">Trumped · review</StatusChip>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <ConditionCard {...props} />
    </details>
  );
}

function ConditionFamilyGroup({
  family,
  review,
  editable,
  readOnlyTitle,
  warningIds,
  jumpToEvidence,
  activeConditionId,
  setActiveConditionId,
  onDisagree,
  onChange,
  onFlag,
  onDeleteSafety
}: Omit<ConditionGroupProps, "title" | "conditions"> & { family: RelatedConditionFamily }) {
  return (
    <section className="condition-group condition-family-group" aria-label={`${family.label} hierarchy group`}>
      <header className="condition-group-heading condition-family-heading">
        <div>
          <h3><span className="condition-group-dot" />{family.label} hierarchy</h3>
          <p>Related diagnoses ordered by HCC hierarchy and documentation specificity. Each condition remains independently reviewable.</p>
        </div>
        <span className="condition-family-path">{family.hccPath}</span>
      </header>
      {family.conditions.map((condition) => (
        <div className="condition-family-item" data-condition-code={condition.icd10} key={condition.id}>
          <HierarchyAwareConditionCard
            condition={condition}
            review={review}
            editable={editable}
            readOnlyTitle={readOnlyTitle}
            isWarning={warningIds.includes(condition.id)}
            jumpToEvidence={jumpToEvidence}
            isActive={activeConditionId === condition.id}
            setActiveConditionId={setActiveConditionId}
            onDisagree={onDisagree}
            onChange={onChange}
            onFlag={onFlag}
            onDeleteSafety={onDeleteSafety}
          />
        </div>
      ))}
    </section>
  );
}

function ConditionGroup({
  title,
  conditions,
  review,
  editable,
  readOnlyTitle,
  warningIds,
  jumpToEvidence,
  activeConditionId,
  setActiveConditionId,
  onDisagree,
  onChange,
  onFlag,
  onDeleteSafety
}: ConditionGroupProps) {
  if (!conditions.length) return null;
  const presentation = getConditionGroupPresentation(title);
  return (
    <section className={`condition-group condition-group-${presentation.tone}`}>
      <header className="condition-group-heading">
        <div>
          <h3><span className="condition-group-dot" />{title}</h3>
          <p>{presentation.subtitle}</p>
        </div>
      </header>
      {conditions.map((condition) => (
        <HierarchyAwareConditionCard
          key={condition.id}
          condition={condition}
          review={review}
          editable={editable}
          readOnlyTitle={readOnlyTitle}
          isWarning={warningIds.includes(condition.id)}
          jumpToEvidence={jumpToEvidence}
          isActive={activeConditionId === condition.id}
          setActiveConditionId={setActiveConditionId}
          onDisagree={onDisagree}
          onChange={onChange}
          onFlag={onFlag}
          onDeleteSafety={onDeleteSafety}
        />
      ))}
    </section>
  );
}

function getConditionGroupPresentation(title: string) {
  if (title.includes("Quality")) {
    return { tone: "quality", subtitle: "Clinical and quality context shown separately; these diagnoses do not contribute an HCC or RAF action." };
  }
  if (title.includes("Not On Claim")) {
    return { tone: "addition", subtitle: "Documented HCCs that may need to be added to the claim." };
  }
  if (title.includes("Upcoming Visit")) {
    return { tone: "prospective", subtitle: "Opportunities that can be prepared for the attached appointment." };
  }
  if (title.includes("Prospective Holds")) {
    return { tone: "prospective", subtitle: "Opportunities held until a future visit becomes available." };
  }
  if (title.includes("Prior-Year Reconciliation")) {
    return { tone: "prospective", subtitle: "Historical opportunities shown without a future-year handoff." };
  }
  return { tone: "validated", subtitle: "Claim-captured HCCs requiring a validate or delete decision." };
}

const conditionDecisionLabels: Record<ConditionDecision, string> = {
  validate: "Validate",
  delete: "Delete",
  addToClaim: "Add to Claim",
  dismiss: "Dismiss",
  changeCode: "Change Code",
  prepareProviderQuery: "Prepare Provider Query"
};

const routeLabels: Record<Exclude<RoutingOutcome, "none">, string> = {
  providerQueryTask: "Prepare Provider Query",
  prospectiveHold: "Send to Prospective",
  additionExport: "Addition Export",
  deletionExport: "Deletion Export",
  exceptionRouting: "Exception Routing"
};

function ConditionCard({
  condition,
  review,
  editable,
  readOnlyTitle,
  isWarning,
  jumpToEvidence,
  isActive,
  setActiveConditionId,
  onDisagree,
  onChange,
  onFlag,
  onDeleteSafety
}: ConditionCardProps) {
  const { data, settings, actions } = useAppState();
  const evidence = getEvidenceForCondition(data, condition);
  const legacyRecommendation = getRecommendation(condition, review, data, settings);
  const reviewModel = deriveConditionReviewModel(condition, review, data, settings);
  const ruleResult = getRuleResult(condition, review, data, settings);
  const disabled = !editable;
  const downstreamTask = getDownstreamTaskForCondition(data, condition.id);
  const downstreamTasks = getDownstreamTasksForCondition(data, condition.id);
  const prospectiveHandoffTasks = downstreamTasks.filter((task) => task.type === "Prospective CDI Review" || task.type === "Provider Query");
  const claim = getClaimForReview(data, review.id);
  const riskAdjustment = isRiskAdjustmentCondition(condition);
  const hierarchy = getConditionHierarchySuppression(condition, review, data);
  const marginalRaf = getConditionMarginalScore(data, review, condition);
  const failedEligibilityChecks = [
    { label: "Ineligible CPT / encounter type", ok: claim?.cptSourceEligible !== false },
    { label: "Ineligible provider type", ok: claim?.providerTypeEligible !== false },
    { label: "Non-face-to-face source", ok: claim?.faceToFace !== false },
    { label: "Invalid provider signature", ok: claim?.providerSignatureValid !== false }
  ].filter((item) => !item.ok);
  const showActionControls =
    riskAdjustment &&
    reviewModel.resolutionState !== "resolved";

  function act(action: RecommendationAction) {
    if (action === "Delete" && hasDeleteSafetyWarning(ruleResult)) {
      onDeleteSafety(condition);
      return;
    }
    const agreed = legacyRecommendation ? legacyRecommendation.action === action : undefined;
    actions.setDisposition(review.id, condition.id, action, agreed);
  }

  function actDecision(decision: ConditionDecision) {
    if (decision === "validate") return act("Validate");
    if (decision === "delete") return act("Delete");
    if (decision === "addToClaim") return act("Add to Claim");
    if (decision === "prepareProviderQuery") return act("Yes");
    if (decision === "changeCode") return onChange(condition);
    if (condition.workflow === "prospective") return act("No");
    return onDisagree(condition);
  }

  function actRoute(route: Exclude<RoutingOutcome, "none">) {
    if (route === "prospectiveHold") return act(condition.workflow === "codesOnClaim" ? "Send to Prospective" : "Yes");
    if (route === "providerQueryTask") return act("Yes");
  }

  function disabledRule(action: RecommendationAction) {
    return ruleResult.disabledActions.find((item) => item.action === action);
  }

  function isDisabled(action: RecommendationAction) {
    return disabled || Boolean(disabledRule(action)) || (condition.draftRuleOutcome?.source === "rule-suppressed" && condition.draftRuleOutcome.action === action);
  }

  function actionTitle(action: RecommendationAction) {
    if (!editable) return readOnlyTitle;
    if (condition.draftRuleOutcome?.source === "rule-suppressed" && condition.draftRuleOutcome.action === action) return condition.draftRuleOutcome.explanation;
    return disabledRule(action)?.reason;
  }

  function legacyActionForDecision(decision: ConditionDecision): RecommendationAction {
    if (decision === "validate") return "Validate";
    if (decision === "delete") return "Delete";
    if (decision === "addToClaim") return "Add to Claim";
    if (decision === "prepareProviderQuery") return "Yes";
    if (decision === "changeCode") return "Change";
    return condition.workflow === "prospective" ? "No" : "Disagree";
  }

  const token = riskAdjustment
    ? condition.subtype
      ? subtypeTokens[condition.subtype]
      : categoryTokens[condition.category]
    : clinicalContextToken;
  const marker =
    !riskAdjustment
      ? "Q"
      : condition.subtype === "recapture"
      ? "R"
      : condition.subtype === "suspect"
        ? "S"
        : condition.category === "potentialDelete"
          ? "D"
          : condition.category === "potentialAddition"
            ? "A"
            : "V";
  const evidenceSummary = evidence[0]?.summary ?? "No evidence found.";

  return (
    <article className={`condition-card ${riskAdjustment ? `condition-${condition.category}` : "condition-context"} ${condition.workflow === "prospective" ? "prospective-condition" : ""} ${isWarning ? "needs-action" : ""} ${isActive ? "active-condition" : ""}`} onClick={() => setActiveConditionId(condition.id)}>
      <div className="condition-card-header">
        <div className="condition-marker" style={{ color: token.color, background: token.bg, borderColor: token.border }}>{marker}</div>
        <div>
          <div className="condition-code">
            <span className="mono">{condition.icd10}</span>
            <strong>{condition.description}</strong>
          </div>
          <div className="condition-pill-row">
            {riskAdjustment ? <span>{condition.hcc}</span> : <span>No payment HCC</span>}
            {riskAdjustment ? <span>Marginal RAF {formatRaf(marginalRaf)}</span> : null}
            <span>{condition.claimStatus}</span>
            <span>Source {formatDate(condition.sourceDate)}</span>
          </div>
          <p className="condition-meat-line">{riskAdjustment ? "MEAT" : "Evidence"}: {evidenceSummary}</p>
        </div>
        {riskAdjustment ? <CategoryBadge category={condition.category} subtype={condition.subtype} /> : <StatusChip tone="info">Non-HCC context</StatusChip>}
      </div>
      {riskAdjustment && !hierarchy.fullySuppressed && reviewModel.resolutionState !== "resolved" && reviewModel.recommendation ? (
        <div className="recommendation">
          <div className="recommendation-title">
            <ClipboardList size={16} />
            <strong>
              AI recommendation: {reviewModel.recommendation.decision
                ? conditionDecisionLabels[reviewModel.recommendation.decision]
                : routeLabels[reviewModel.recommendation.route!]}
              {` · ${reviewModel.recommendation.confidence} confidence`}
            </strong>
          </div>
          <p>{reviewModel.recommendation.rationale}</p>
        </div>
      ) : null}
      {hierarchy.fullySuppressed ? (
        <div className="disabled-reason">
          <LockKeyhole size={15} />
          {hierarchy.suppressedHccs.map(({ lower, higher }) => `${lower} locked by captured ${higher}`).join("; ")}
        </div>
      ) : null}
      {riskAdjustment ? <RuleMessages ruleResult={ruleResult} jumpToEvidence={jumpToEvidence} /> : null}
      {riskAdjustment && failedEligibilityChecks.length ? (
        <div className="source-eligibility-row compact eligibility-issues" aria-label="Source eligibility issues">
          {failedEligibilityChecks.map((item) => <EligibilityChip key={item.label} label={item.label} ok={false} />)}
        </div>
      ) : null}
      <details className="condition-history-details">
        <summary>Review details</summary>
        <div className="condition-history">
          <span>{riskAdjustment ? `Originally presented as: ${categoryTokens[condition.originalCategory ?? condition.category].label}` : "Original context: Non-payment clinical context"}</span>
          <span>Recommendation: {reviewModel.recommendation?.decision ? conditionDecisionLabels[reviewModel.recommendation.decision] : reviewModel.recommendation?.route ? routeLabels[reviewModel.recommendation.route] : "None"}</span>
          <span>Draft decision: {condition.draftDecision ? conditionDecisionLabels[condition.draftDecision.decision] : condition.draftDisposition?.action ?? "None"}</span>
          <span>Committed decision: {condition.decision ? conditionDecisionLabels[condition.decision.decision] : condition.disposition?.action ?? "None"}</span>
          <span>Routing: {condition.draftRoutingOutcome ? `Draft ${routeLabels[condition.draftRoutingOutcome.outcome as Exclude<RoutingOutcome, "none">]}` : reviewModel.downstreamRoute !== "none" ? routeLabels[reviewModel.downstreamRoute] : "None"}</span>
          <span>Rule outcome: {condition.draftRuleOutcome ? `Draft ${condition.draftRuleOutcome.source} - ${condition.draftRuleOutcome.action ?? "No action"}` : condition.ruleOutcome ? `${condition.ruleOutcome.source} - ${condition.ruleOutcome.action ?? "No action"}` : "None"}</span>
          <span>Downstream task: {downstreamTasks.length ? downstreamTasks.map((task) => `${task.type} - ${task.status}`).join("; ") : downstreamTask ? `${downstreamTask.type} - ${downstreamTask.status}` : "None"}</span>
          <span>Auditor decision: {condition.auditorDisposition?.outcome ?? "None"}</span>
        </div>
      </details>
      <div className="evidence-list">
        {evidence.map((item) => (
          <button key={item.id} type="button" onClick={() => {
            setActiveConditionId(condition.id);
            jumpToEvidence(item);
          }}>
            <span className="evidence-list-main">
              <EvidenceStrengthBadge evidence={item} />
              <span>{item.summary}</span>
            </span>
            <small>{item.sourceLocation ?? "Chart source"} - {formatDate(item.date)}</small>
            {item.reviewerExplanation ? <small>{item.reviewerExplanation}</small> : null}
          </button>
        ))}
        {!evidence.length ? <div className="empty-inline">No evidence found.</div> : null}
      </div>
      {condition.documentationIssues.length ? (
        <div className="issue-list">
          {condition.documentationIssues.map((issue, index) => (
            <StatusChip key={`${issue.issue}-${index}`} tone="warn">
              <FileWarning size={14} />
              {issue.issue}
            </StatusChip>
          ))}
        </div>
      ) : null}
      {condition.disabledReason ? <div className="disabled-reason">{condition.disabledReason}</div> : null}
      {condition.draftDisposition || condition.draftDecision ? (
        <div className="disposition-row draft-disposition-row">
          <StatusChip tone="info">
            <Check size={14} />
            Draft: {condition.draftDecision ? conditionDecisionLabels[condition.draftDecision.decision] : condition.draftDisposition?.action}
          </StatusChip>
          {(condition.draftDecision?.reason ?? condition.draftDisposition?.reason) ? <span>{condition.draftDecision?.reason ?? condition.draftDisposition?.reason}</span> : null}
          {(condition.draftDecision?.replacementCode ?? condition.draftDisposition?.replacementCode) ? <span className="mono">{condition.draftDecision?.replacementCode ?? condition.draftDisposition?.replacementCode}</span> : null}
          <small>{formatDateTime(condition.draftDecision?.stagedAt ?? condition.draftDisposition!.stagedAt)}</small>
          <Button
            variant="ghost"
            disabled={!editable}
            title={!editable ? readOnlyTitle : "Undo the staged decision"}
            onClick={() => actions.clearDispositionDraft(review.id, condition.id)}
          >
            Undo
          </Button>
        </div>
      ) : null}
      {condition.draftRoutingOutcome && condition.draftRoutingOutcome.outcome !== "none" ? (
        <div className="disposition-row draft-disposition-row prospective-handoff-ledger-row">
          <StatusChip tone="info">
            <Check size={14} />
            Draft route: {routeLabels[condition.draftRoutingOutcome.outcome]}
          </StatusChip>
          <span>{condition.draftRoutingOutcome.comments ?? "No additional reviewer note."}</span>
          <small>{formatDateTime(condition.draftRoutingOutcome.stagedAt)}</small>
          <Button
            variant="ghost"
            disabled={!editable}
            title={!editable ? readOnlyTitle : "Undo the staged route"}
            onClick={() => actions.clearProspectiveHandoffDraft(review.id, condition.id)}
          >
            Undo route
          </Button>
        </div>
      ) : null}
      {reviewModel.resolutionState === "resolved" ? (
        <div className="disposition-row">
          <StatusChip tone="good">
            <Check size={14} />
            {reviewModel.resolvedLabel ?? "Resolved"}
          </StatusChip>
          {(condition.decision?.reason ?? condition.disposition?.reason) ? <span>{condition.decision?.reason ?? condition.disposition?.reason}</span> : null}
          {(condition.decision?.replacementCode ?? condition.disposition?.replacementCode) ? <span className="mono">{condition.decision?.replacementCode ?? condition.disposition?.replacementCode}</span> : null}
          {(condition.decision?.decidedAt ?? condition.disposition?.decidedAt) ? <small>{formatDateTime(condition.decision?.decidedAt ?? condition.disposition!.decidedAt)}</small> : null}
        </div>
      ) : null}
      {condition.ruleOutcome ? (
        <div className="disposition-row">
          <StatusChip tone={condition.ruleOutcome.source === "rule-resolved" ? "good" : "purple"}>
            <Check size={14} />
            {condition.ruleOutcome.source === "rule-resolved" ? "Rule-resolved" : "Rule-suppressed"}
          </StatusChip>
          {condition.ruleOutcome.action ? <span>{condition.ruleOutcome.action}</span> : null}
          <span>{condition.ruleOutcome.explanation}</span>
          <small>{formatDateTime(condition.ruleOutcome.createdAt)}</small>
        </div>
      ) : null}
      {condition.draftRuleOutcome ? (
        <div className="disposition-row draft-disposition-row">
          <StatusChip tone="info">
            <Check size={14} />
            Draft rule outcome
          </StatusChip>
          <span>{condition.draftRuleOutcome.explanation}</span>
        </div>
      ) : null}
      {prospectiveHandoffTasks.map((task) => (
        <div key={task.id} className="disposition-row prospective-handoff-ledger-row">
          <StatusChip tone="purple">{task.type === "Provider Query" ? "Provider Query" : "Prospective Hold"}</StatusChip>
          <span>{task.type === "Provider Query" && task.appointmentId ? `Appointment ${task.appointmentId}` : "Shared queue"} · {task.status}</span>
          <span>{task.comments ?? "No additional reviewer note."}</span>
          <small>{formatDateTime(task.updatedAt ?? task.createdAt)}</small>
        </div>
      ))}
      {showActionControls ? (
        <div className="condition-decision-controls">
          <strong className="decision-year-label">
            {reviewModel.reviewContext === "retrospective"
              ? `CY ${review.calendarYear} reconciliation`
              : reviewModel.reviewContext === "scheduledUpcomingVisit"
                ? "Upcoming visit action"
                : "Prospective hold action"}
          </strong>
          <div className="action-row">
            {reviewModel.availableRoutes.includes("prospectiveHold") ? (
              <Button
                variant="primary"
                className={`action-prospective${condition.draftRoutingOutcome?.outcome === "prospectiveHold" ? " action-selected" : ""}`}
                aria-label="Send to Prospective"
                aria-pressed={condition.draftRoutingOutcome?.outcome === "prospectiveHold"}
                disabled={isDisabled(condition.workflow === "codesOnClaim" ? "Send to Prospective" : "Yes")}
                title={actionTitle(condition.workflow === "codesOnClaim" ? "Send to Prospective" : "Yes")}
                onClick={() => actRoute("prospectiveHold")}
              >
                Send to Prospective
              </Button>
            ) : null}
            {reviewModel.availableDecisions.map((decision) => {
              const action = legacyActionForDecision(decision);
              const selected = condition.draftDecision?.decision === decision;
              const className = `${decision === "validate" || decision === "prepareProviderQuery" ? "action-validate" : decision === "delete" ? "action-delete" : decision === "addToClaim" ? "action-add" : decision === "dismiss" ? "action-disagree" : "action-prospective"}${selected ? " action-selected" : ""}`;
              return (
                <Button
                  key={decision}
                  className={className}
                  aria-label={conditionDecisionLabels[decision]}
                  aria-pressed={selected}
                  variant={decision === "delete" ? "danger" : decision === "prepareProviderQuery" ? "primary" : undefined}
                  disabled={isDisabled(action)}
                  title={actionTitle(action)}
                  onClick={() => actDecision(decision)}
                >
                  {conditionDecisionLabels[decision]}
                </Button>
              );
            })}
            <Button variant="ghost" disabled={!editable} title={!editable ? readOnlyTitle : undefined} onClick={() => onFlag(condition)}>
              <Flag size={14} />
              Flag issue
            </Button>
          </div>
        </div>
      ) : null}
      {!riskAdjustment ? (
        <div className="condition-decision-controls condition-context-controls">
          <strong className="decision-year-label">Non-HCC clinical context</strong>
          <div className="action-row">
            <span className="condition-context-note">Evidence remains available for review; this diagnosis does not change HCC or RAF.</span>
            <Button variant="ghost" disabled={!editable} title={!editable ? readOnlyTitle : undefined} onClick={() => onFlag(condition)}>
              <Flag size={14} />
              Flag issue
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function hasDeleteSafetyWarning(ruleResult: RuleResult) {
  return ruleResult.warnings.some((warning) => warning.message.includes("Possible current-year supporting evidence") && warning.evidenceIds?.length);
}

function RuleMessages({ ruleResult, jumpToEvidence }: { ruleResult: RuleResult; jumpToEvidence: (evidence: EvidencePassage) => void }) {
  const { data } = useAppState();
  const evidenceMap = byId(data.evidence);
  const visibleWarnings = ruleResult.warnings.filter((warning) => !warning.message.includes("Possible current-year supporting evidence"));
  const visibleDisabledActions = ruleResult.disabledActions;
  const evidenceIds = Array.from(
    new Set([
      ...ruleResult.supportingEvidenceIds,
      ...ruleResult.conflictingEvidenceIds,
      ...visibleDisabledActions.flatMap((item) => [...(item.supportingEvidenceIds ?? []), ...(item.conflictingEvidenceIds ?? [])]),
      ...visibleWarnings.flatMap((item) => item.evidenceIds ?? [])
    ])
  );
  const showLookbackEvidence = ruleResult.ruleId === "three-year-lookback-recapture" && evidenceIds.length > 0;
  if (!visibleDisabledActions.length && !visibleWarnings.length && !showLookbackEvidence) return null;
  return (
    <div className="rule-message-list">
      {showLookbackEvidence ? <div className="rule-info">Three-year lookback evidence used for this prototype recommendation.</div> : null}
      {visibleDisabledActions.map((item) => (
        <div key={`${item.ruleId}-${item.action}`} className="disabled-reason">
          {item.reason}
        </div>
      ))}
      {visibleWarnings.map((item, index) => (
        <div key={`${item.message}-${index}`} className="warning-banner compact-warning">
          <AlertTriangle size={16} />
          {item.message}
        </div>
      ))}
      {evidenceIds.length ? (
        <div className="rule-evidence-links">
          {evidenceIds.map((id) => {
            const evidence = evidenceMap.get(id);
            return evidence ? (
              <button key={id} type="button" onClick={() => jumpToEvidence(evidence)}>
                {evidence.summary}
              </button>
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

function DisagreeModal({ condition, reviewId, onClose }: { condition: Condition; reviewId: string; onClose: () => void }) {
  const { data, settings, actions } = useAppState();
  const review = data.reviews.find((item) => item.id === reviewId)!;
  const recommendation = getRecommendation(condition, review, data, settings);
  const [reason, setReason] = useState<DisagreeReason>("Not Enough MEAT");
  const [comments, setComments] = useState("");
  return (
    <Modal title="Disagree Reason" onClose={onClose}>
      <label>
        Reason code
        <select value={reason} onChange={(event) => setReason(event.target.value as DisagreeReason)}>
          {disagreeReasons.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        Comments
        <textarea value={comments} onChange={(event) => setComments(event.target.value)} placeholder={reason === "Other" ? "Required for Other in the prototype workflow" : "Optional comments"} />
      </label>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={reason === "Other" && !comments.trim()}
          onClick={() => {
            actions.setDisposition(reviewId, condition.id, "Disagree", recommendation ? recommendation.action === "Disagree" : undefined, reason, comments);
            onClose();
          }}
        >
          Stage disagreement
        </Button>
      </div>
    </Modal>
  );
}

function ChangeModal({ condition, reviewId, onClose }: { condition: Condition; reviewId: string; onClose: () => void }) {
  const { data, settings, actions } = useAppState();
  const review = data.reviews.find((item) => item.id === reviewId)!;
  const recommendation = getRecommendation(condition, review, data, settings);
  const [replacementCode, setReplacementCode] = useState(recommendation?.replacementCode ?? "");
  const [comments, setComments] = useState("");
  return (
    <Modal title="Change Proposed Code" onClose={onClose}>
      <p>
        Original proposed code: <span className="mono">{condition.icd10}</span>
      </p>
      <label>
        Replacement ICD-10-CM code
        <input value={replacementCode} onChange={(event) => setReplacementCode(event.target.value.toUpperCase())} placeholder="Enter replacement code" />
      </label>
      <label>
        Comments
        <textarea value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Reason for changing the proposed code" />
      </label>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!replacementCode.trim()}
          onClick={() => {
            actions.setDisposition(reviewId, condition.id, "Change", recommendation ? recommendation.action === "Change" : undefined, undefined, comments, replacementCode);
            onClose();
          }}
        >
          Stage change
        </Button>
      </div>
    </Modal>
  );
}

function FlagModal({ condition, reviewId, onClose }: { condition: Condition; reviewId: string; onClose: () => void }) {
  const { actions } = useAppState();
  const [issue, setIssue] = useState<DocumentationIssue>("Not risk eligible CPT source");
  const [comments, setComments] = useState("");
  const commentsRequired = issue === "Provider education" || issue === "Other documentation issue";
  return (
    <Modal title="Flag Documentation Issue" onClose={onClose}>
      <label>
        Issue
        <select value={issue} onChange={(event) => setIssue(event.target.value as DocumentationIssue)}>
          {documentationIssues.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        Comments
        <textarea value={comments} onChange={(event) => setComments(event.target.value)} placeholder={commentsRequired ? "Describe the issue" : "Optional comments"} />
      </label>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={commentsRequired && !comments.trim()}
          onClick={() => {
            actions.flagDocumentationIssue(reviewId, condition.id, issue, comments);
            onClose();
          }}
        >
          Route issue
        </Button>
      </div>
    </Modal>
  );
}

function DeleteSafetyModal({
  condition,
  reviewId,
  onClose,
  jumpToEvidence
}: {
  condition: Condition;
  reviewId: string;
  onClose: () => void;
  jumpToEvidence: (evidence: EvidencePassage) => void;
}) {
  const { data, settings, actions } = useAppState();
  const review = data.reviews.find((item) => item.id === reviewId)!;
  const ruleResult = getRuleResult(condition, review, data, settings);
  const evidenceMap = byId(data.evidence);
  const documentMap = byId(data.documents);
  const conditionMap = byId(data.conditions);
  const supportIds = Array.from(new Set(ruleResult.warnings.filter((warning) => warning.message.includes("Possible current-year supporting evidence")).flatMap((warning) => warning.evidenceIds ?? [])));
  const supportEvidence = supportIds.map((id) => evidenceMap.get(id)).filter(Boolean) as EvidencePassage[];
  const recommendation = getRecommendation(condition, review, data, settings);
  const [explanation, setExplanation] = useState("");

  function routeForSafety(queue: "Auditor Queue" | "Manager Review Queue") {
    actions.routeReview(reviewId, queue);
    onClose();
  }

  return (
    <Modal title="Deletion Safety Review" onClose={onClose}>
      <p className="modal-copy">
        This prototype treats Delete as patient-year HCC deletion, not claim-line-only deletion. The system found possible supporting evidence, but this is advisory. Review the evidence and record your deletion rationale if you proceed.
      </p>
      <div className="safety-evidence-list">
        {supportEvidence.map((evidence) => {
          const document = documentMap.get(evidence.documentId);
          const linkedConditions = evidence.conditionIds.map((id) => conditionMap.get(id)).filter(Boolean) as Condition[];
          return (
            <button
              key={evidence.id}
              type="button"
              onClick={() => {
                jumpToEvidence(evidence);
                onClose();
              }}
            >
              <strong>{evidence.summary}</strong>
              <span>{document?.title ?? "Source document"} - {formatDate(evidence.date)}</span>
              <span>{evidence.exactText ?? evidence.text}</span>
              <small>
                Supports {linkedConditions.map((item) => `${item.icd10} / ${item.hcc}`).join(", ") || `${condition.icd10} / ${condition.hcc}`} - MEAT support:{" "}
                {linkedConditions.some((item) => item.hasSufficientMeat || item.hasOtherSupportingEvidence) || condition.hasSufficientMeat || condition.hasOtherSupportingEvidence ? "met in prototype data" : "not met"}
              </small>
            </button>
          );
        })}
      </div>
      <label>
        Deletion rationale
        <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Required rationale when deleting despite possible current-year support" />
      </label>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" onClick={() => routeForSafety("Auditor Queue")}>Route to Auditor Review</Button>
        <Button variant="secondary" onClick={() => routeForSafety("Manager Review Queue")}>Route to Manager Review</Button>
        <Button
          variant="danger"
          disabled={!explanation.trim()}
          onClick={() => {
            actions.setDisposition(reviewId, condition.id, "Delete", recommendation ? recommendation.action === "Delete" : undefined, undefined, explanation);
            onClose();
          }}
        >
          Stage Delete for {review.calendarYear}
        </Button>
      </div>
    </Modal>
  );
}

function OverrideLockModal({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const { actions } = useAppState();
  const [reason, setReason] = useState("");
  return (
    <Modal title="Override Lock" onClose={onClose}>
      <p className="modal-copy">This will transfer the active chart lock to you and record the prior owner, time, and reason in activity history.</p>
      <label>
        Override reason
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason for manager/admin lock override" />
      </label>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!reason.trim()}
          onClick={() => {
            actions.overrideLock(reviewId, reason);
            onClose();
          }}
        >
          Confirm override
        </Button>
      </div>
    </Modal>
  );
}

function EvidenceStrengthBadge({ evidence }: { evidence: EvidencePassage }) {
  const token = tokenForEvidence(evidence);
  return (
    <span className="evidence-strength-badge" style={{ color: token.color, background: token.bg, borderColor: token.border }}>
      {evidenceStrengthLabel(evidence.evidenceStrength)}
    </span>
  );
}

function EligibilityChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <StatusChip tone={ok ? "good" : "bad"}>
      {ok ? <Check size={13} /> : <AlertTriangle size={13} />}
      {label}
    </StatusChip>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <header>
          <h2>{title}</h2>
          <CloseDialogButton onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
