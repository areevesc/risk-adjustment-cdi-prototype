import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, FileWarning, Flag, LockKeyhole, Play } from "lucide-react";
import { useAppState } from "../../state/AppState";
import {
  byId,
  canEditReview,
  getClaimForReview,
  getDispositionSummary,
  getActiveConditionEvidence,
  getDownstreamTaskForCondition,
  getDownstreamTasksForCondition,
  getEvidenceCycleTarget,
  getEvidenceForCondition,
  getOutreachStatusForReview,
  getPresentedOpportunitySummary,
  getProspectiveCounts,
  getRafSummary,
  getRecommendation,
  getRuleResult,
  isPrototypeCurrentYear,
  reviewConditions
} from "../../domain/selectors";
import type { ChartTab, ClinicalChart, Condition, DisagreeReason, DocumentationIssue, EvidencePassage, RecommendationAction, RuleResult } from "../../domain/types";
import { formatDate, formatDateTime, formatRaf } from "../../domain/format";
import { Button, CategoryBadge, CloseDialogButton, EmptyState, Panel, RecommendationBox, StatusChip } from "../../ui/Primitives";
import { categoryTokens, dispositionTokens, subtypeTokens } from "../../domain/tokens";
import { canOpenReview, canOverrideLock, canReleaseReviewLock, canTakeCoverage, canViewReview, getFirstPermittedRoute } from "../../domain/auth";

const disagreeReasons: DisagreeReason[] = ["Not Enough MEAT", "Condition Resolved", "Conflicting Evidence", "Other"];
const documentationIssues: DocumentationIssue[] = [
  "Not risk eligible CPT source",
  "Not risk eligible provider type",
  "Not a face-to-face service",
  "Invalid or missing provider signature",
  "Provider education"
];

export function ReviewPage() {
  const { reviewId } = useParams();
  const { data, currentUser, settings, actions } = useAppState();
  const navigate = useNavigate();
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
  const displayAppointment = outreachStatus.appointment ?? appointment;
  const conditions = reviewConditions(data, activeReview);
  const relatedReviewIds = new Set(
    data.reviews
      .filter((item) => item.patientId === patient.id && item.calendarYear >= activeReview.calendarYear - 3 && item.calendarYear <= activeReview.calendarYear)
      .map((item) => item.id)
  );
  const documents = data.documents.filter((document) => relatedReviewIds.has(document.reviewId));
  const relatedEvidence = data.evidence.filter((item) => relatedReviewIds.has(item.reviewId));
  const activeEvidence = getActiveConditionEvidence(data, relatedEvidence, activeConditionId);
  const chart = data.charts.find((item) => item.reviewId === activeReview.id);
  const editable = canEditReview(activeReview, currentUser);
  const presentedSummary = getPresentedOpportunitySummary(data, activeReview);
  const dispositionSummary = getDispositionSummary(data, activeReview);
  const prospectiveCounts = getProspectiveCounts(data, activeReview);
  const rafSummary = getRafSummary(data, activeReview);
  const claim = getClaimForReview(data, activeReview.id);
  const lockOwner = activeReview.lock ? maps.users.get(activeReview.lock.lockedByUserId)?.name : undefined;
  const canRelease = canReleaseReviewLock(activeReview, currentUser);
  const canUseProspectiveActions = isPrototypeCurrentYear(activeReview, settings);
  const readOnlyTitle = !editable ? (activeReview.lock ? `Read-only while being edited by ${lockOwner}` : "Open the chart to acquire an edit lock") : undefined;

  function jumpToEvidence(evidence: EvidencePassage) {
    if (evidence.conditionIds.length) setActiveConditionId(evidence.conditionIds[0]);
    setSelectedEvidenceId(evidence.id);
    if (evidence.chartAnchor) setActiveChartTab(evidence.chartAnchor.tab);
    window.setTimeout(() => {
      const target = evidence.chartAnchor
        ? document.getElementById(chartElementId(evidence.chartAnchor.tab, evidence.chartAnchor.itemId, evidence.chartAnchor.sectionId)) ??
          document.getElementById(`span-${evidence.id}`)
        : document.getElementById(`span-${evidence.id}`) ?? document.getElementById(evidence.anchorId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 30);
  }

  function stepEvidence(direction: "prev" | "next") {
    const target = getEvidenceCycleTarget(activeEvidence, selectedEvidenceId, direction);
    if (target) jumpToEvidence(target);
  }

  function clearReviewLocalState() {
    setActiveChartTab("encounters");
    setSelectedEvidenceId(undefined);
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
            <div className="review-action-group" aria-label="Workflow actions">
              <Button disabled={!editable} title={readOnlyTitle} onClick={pend}>Pend</Button>
              <Button disabled={!editable} title={readOnlyTitle} onClick={() => route("Auditor Queue")}>Send to Auditor</Button>
              <Button disabled={!editable} title={readOnlyTitle} onClick={() => route("Manager Review Queue")}>Manager Review</Button>
              <Button disabled={!editable} title={readOnlyTitle} variant="primary" onClick={complete}>Complete Review</Button>
            </div>
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
          <div>
            <h2>{patient.name}</h2>
            <p>
              DOB {formatDate(patient.dob)} - Member {patient.memberId} - {payer?.name}
            </p>
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
        {!editable ? (
          <div className="read-only-banner">
            <AlertTriangle size={16} />
            Read-only view. {review.lock ? `Current editor: ${lockOwner}.` : "Open the chart to acquire an edit lock."}
          </div>
        ) : null}
        <CompactReviewSummary
          dispositionSummary={dispositionSummary}
          presentedSummary={presentedSummary}
          projectedRaf={rafSummary.projectedRaf}
          unresolvedRaf={rafSummary.unresolvedPotentialRaf}
          summaryExpanded={summaryExpanded}
        />
        {summaryExpanded ? (
          <>
            <div className="summary-label">Current dispositions</div>
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
              <EligibilityChip label="Valid provider signature" ok={claim?.providerSignatureValid !== false} />
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
        <div className="raf-note">Synthetic prototype values — not an authoritative CMS RAF calculation.</div>
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
          title="Embedded Chart And Evidence"
          actions={
            <div className="header-actions">
              <Button variant="secondary" onClick={() => stepEvidence("prev")}>
                <ArrowLeft size={15} />
                Previous Evidence
              </Button>
              <Button variant="secondary" onClick={() => stepEvidence("next")}>
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

        <Panel title="Conditions And Actions">
          <div className="condition-groups">
            <ConditionGroup
              title="Codes On Claim"
              conditions={conditions.filter((condition) => condition.workflow === "codesOnClaim")}
              review={review}
              editable={editable}
              canUseProspectiveActions={canUseProspectiveActions}
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
              conditions={conditions.filter((condition) => condition.workflow === "codesNotOnClaim")}
              review={review}
              editable={editable}
              canUseProspectiveActions={canUseProspectiveActions}
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
              title="CDI Prospective Review"
              conditions={conditions.filter((condition) => condition.workflow === "prospective")}
              review={review}
              editable={editable}
              canUseProspectiveActions={canUseProspectiveActions}
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
  presentedSummary,
  projectedRaf,
  unresolvedRaf,
  summaryExpanded
}: {
  dispositionSummary: ReturnType<typeof getDispositionSummary>;
  presentedSummary: ReturnType<typeof getPresentedOpportunitySummary>;
  projectedRaf: number;
  unresolvedRaf: number;
  summaryExpanded: boolean;
}) {
  if (summaryExpanded) return null;
  const prospectiveOpen = dispositionSummary["Sent to Prospective"].count + dispositionSummary["Prospective Yes"].count + dispositionSummary["Prospective No"].count;
  return (
    <div className="compact-review-summary" aria-label="Compact review summary">
      <span>
        Validated <strong>{dispositionSummary.Validated.count}</strong>
      </span>
      <span>
        Deleted <strong>{dispositionSummary.Deleted.count}</strong>
      </span>
      <span>
        Added <strong>{dispositionSummary["Added to Claim"].count}</strong>
      </span>
      <span>
        Prospective <strong>{prospectiveOpen}</strong>
      </span>
      <span>
        Unresolved <strong>{dispositionSummary.Unresolved.count}</strong>
      </span>
      <span>
        Projected RAF <strong>{formatRaf(projectedRaf)}</strong>
      </span>
      <span>
        Open RAF <strong>{formatRaf(unresolvedRaf)}</strong>
      </span>
      <div className="compact-presented-summary">
        {Object.entries(presentedSummary).map(([category, summary]) => (
          <CategoryBadge key={category} category={category as keyof typeof categoryTokens} count={summary.count} />
        ))}
      </div>
    </div>
  );
}

const chartTabs: Array<{ value: ChartTab; label: string }> = [
  { value: "encounters", label: "Encounters" },
  { value: "problem-list", label: "Problem List" },
  { value: "pmh", label: "PMH" },
  { value: "medications", label: "Medications" },
  { value: "labs", label: "Labs" },
  { value: "vitals", label: "Vitals" },
  { value: "imaging", label: "Imaging" },
  { value: "specialist-notes", label: "Specialist Notes" },
  { value: "claims", label: "Claims" }
];

function chartElementId(tab: ChartTab, itemId: string, sectionId?: string) {
  return `chart-${tab}-${itemId}${sectionId ? `-${sectionId}` : ""}`;
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
  const evidenceMap = new Map(evidence.map((item) => [item.id, item]));
  const evidenceForIds = (ids: string[] = []) => ids.map((id) => evidenceMap.get(id)).filter(Boolean) as EvidencePassage[];
  const rowClass = (ids: string[] = []) => {
    const scoped = ids.some((id) => evidenceMap.has(id));
    const selected = ids.includes(selectedEvidenceId ?? "");
    return `chart-row ${scoped ? "has-evidence" : ""} ${selected ? "selected-evidence" : ""}`;
  };
  const evidenceStyle = (items: EvidencePassage[]) => {
    const firstEvidence = items[0];
    const token = firstEvidence?.subtype ? subtypeTokens[firstEvidence.subtype] : firstEvidence ? categoryTokens[firstEvidence.category] : undefined;
    return token ? { borderColor: token.border } : undefined;
  };
  return (
    <div className="chart-viewer">
      <div className="document-tabs chart-tabs" role="tablist" aria-label="Embedded chart sections">
        {chartTabs.map((tab) => (
          <button
            key={tab.value}
            className={tab.value === activeTab ? "active" : ""}
            data-chart-tab={tab.value}
            role="tab"
            aria-selected={tab.value === activeTab}
            onClick={() => setActiveTab(tab.value)}
            type="button"
          >
            {tab.label}
            <span>{tab.value === "encounters" ? `${chart.encounters.length} note(s)` : tab.value === "labs" ? `${chart.labs.length} panel(s)` : ""}</span>
          </button>
        ))}
      </div>
      <article className="document-page chart-page">
        <header>
          <h3>Embedded Mock EMR Chart</h3>
          <div className="document-header-chips">
            <StatusChip tone="info">{documents.length} source record(s)</StatusChip>
            <StatusChip tone={activeConditionId ? "purple" : "info"}>{activeConditionId ? "Condition-scoped evidence" : "All evidence visible"}</StatusChip>
          </div>
        </header>
        {activeTab === "encounters" ? (
          <div className="chart-stack">
            {chart.encounters.map((encounter) => {
              const hpiEvidence = evidenceForIds(encounter.sectionEvidenceIds.hpi);
              const planEvidence = evidenceForIds(encounter.sectionEvidenceIds.assessmentPlan);
              return (
                <section key={encounter.id} className="chart-note">
                  <div className="chart-note-header">
                    <div>
                      <strong>{formatDate(encounter.date)} - {encounter.type}</strong>
                      <span>{encounter.provider}</span>
                    </div>
                    <StatusChip>{encounter.billingCode}</StatusChip>
                  </div>
                  <ChartSection title="Chief Complaint" id={chartElementId("encounters", encounter.id, "chiefComplaint")}>
                    {encounter.chiefComplaint}
                  </ChartSection>
                  <ChartSection
                    title="HPI"
                    id={chartElementId("encounters", encounter.id, "hpi")}
                    className={rowClass(encounter.sectionEvidenceIds.hpi)}
                    style={evidenceStyle(hpiEvidence)}
                  >
                    {renderEvidenceSpans(encounter.hpi, hpiEvidence, selectedEvidenceId)}
                  </ChartSection>
                  <ChartSection title="Review Of Systems" id={chartElementId("encounters", encounter.id, "ros")}>
                    <ul>{encounter.reviewOfSystems.map((item) => <li key={item}>{item}</li>)}</ul>
                  </ChartSection>
                  <ChartSection title="Vitals" id={chartElementId("vitals", encounter.vitals.id)}>
                    <div className={rowClass(encounter.vitals.evidenceIds)}>
                      BP {encounter.vitals.systolic}/{encounter.vitals.diastolic} - HR {encounter.vitals.heartRate} - Temp {encounter.vitals.temperature}F - Wt {encounter.vitals.weight} lb - BMI {encounter.vitals.bmi} - O2 {encounter.vitals.oxygenSaturation}%
                    </div>
                  </ChartSection>
                  <ChartSection title="Physical Exam" id={chartElementId("encounters", encounter.id, "physicalExam")}>
                    <div className="exam-grid">
                      {encounter.physicalExam.map((item) => (
                        <div key={`${encounter.id}-${item.system}`}><strong>{item.system}</strong><span>{item.text}</span></div>
                      ))}
                    </div>
                  </ChartSection>
                  <ChartSection
                    title="Assessment And Plan"
                    id={chartElementId("encounters", encounter.id, "assessmentPlan")}
                    className={rowClass(encounter.sectionEvidenceIds.assessmentPlan)}
                    style={evidenceStyle(planEvidence)}
                  >
                    <ol className="plan-list">
                      {encounter.assessmentPlan.map((plan, index) => {
                        const itemEvidence = evidenceForIds(plan.evidenceIds);
                        return (
                          <li
                            key={plan.id}
                            id={chartElementId("encounters", plan.id, "assessmentPlan")}
                            className={rowClass(plan.evidenceIds)}
                            style={evidenceStyle(itemEvidence)}
                          >
                            <strong>{index + 1}. {plan.problem}</strong>
                            <span>{renderEvidenceSpans(plan.detail, itemEvidence, selectedEvidenceId)}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </ChartSection>
                  <footer>
                    Electronically signed by {encounter.provider} on {formatDate(encounter.date)} at {encounter.signatureTime}. Billing code {encounter.billingCode}.
                  </footer>
                </section>
              );
            })}
          </div>
        ) : null}
        {activeTab === "problem-list" ? (
          <ChartTable headers={["Diagnosis", "ICD-10", "Status", "Date Added", "HCC"]}>
            {chart.problems.map((problem) => (
              <tr key={problem.id} id={chartElementId("problem-list", problem.id)} className={rowClass(problem.evidenceIds)} style={evidenceStyle(evidenceForIds(problem.evidenceIds))}>
                <td>{problem.diagnosis}</td>
                <td className="mono">{problem.code}</td>
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
              <div key={item.id} id={chartElementId("pmh", item.id)} className={rowClass(item.evidenceIds)}>{item.text}</div>
            ))}
          </div>
        ) : null}
        {activeTab === "medications" ? (
          <ChartTable headers={["Medication", "Dose", "Frequency", "Route", "Prescriber"]}>
            {chart.medications.map((medication) => (
              <tr key={medication.id} id={chartElementId("medications", medication.id)} className={rowClass(medication.evidenceIds)} style={evidenceStyle(evidenceForIds(medication.evidenceIds))}>
                <td>{medication.name}</td>
                <td>{medication.dose}</td>
                <td>{medication.frequency}</td>
                <td>{medication.route}</td>
                <td>{medication.prescriber}</td>
              </tr>
            ))}
          </ChartTable>
        ) : null}
        {activeTab === "labs" ? (
          <div className="chart-stack">
            {chart.labs.map((panel) => (
              <section key={panel.id} className="chart-table-section">
                <h4>{panel.name} <span>{formatDate(panel.date)}</span></h4>
                <ChartTable headers={["Component", "Value", "Unit", "Reference", "Flag"]}>
                  {panel.results.map((result) => (
                    <tr key={result.id} id={chartElementId("labs", result.id)} className={rowClass(result.evidenceIds)} style={evidenceStyle(evidenceForIds(result.evidenceIds))}>
                      <td>{result.component}</td>
                      <td className={`lab-${result.flag}`}>{result.value}</td>
                      <td>{result.unit}</td>
                      <td>{result.referenceRange}</td>
                      <td>{result.flag}</td>
                    </tr>
                  ))}
                </ChartTable>
              </section>
            ))}
          </div>
        ) : null}
        {activeTab === "vitals" ? (
          <ChartTable headers={["Date", "BP", "HR", "Temp", "Weight", "Height", "BMI", "O2 Sat"]}>
            {chart.vitals.map((vital) => (
              <tr key={vital.id} id={chartElementId("vitals", vital.id)} className={rowClass(vital.evidenceIds)} style={evidenceStyle(evidenceForIds(vital.evidenceIds))}>
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
          <div className="chart-stack">
            {chart.imaging.map((report) => {
              const reportEvidence = evidenceForIds(report.evidenceIds);
              return (
                <section key={report.id} id={chartElementId("imaging", report.id, "findings")} className={`chart-note ${rowClass(report.evidenceIds)}`} style={evidenceStyle(reportEvidence)}>
                  <div className="chart-note-header"><strong>{report.type}</strong><span>{formatDate(report.date)} - {report.indication}</span></div>
                  <ChartSection title="Findings">{renderEvidenceSpans(report.findings, reportEvidence, selectedEvidenceId)}</ChartSection>
                  <ChartSection title="Impression"><ol>{report.impression.map((line) => <li key={line}>{line}</li>)}</ol></ChartSection>
                </section>
              );
            })}
          </div>
        ) : null}
        {activeTab === "specialist-notes" ? (
          <div className="chart-stack">
            {chart.specialistNotes.map((note) => {
              const noteEvidence = evidenceForIds(note.evidenceIds);
              return (
                <section key={note.id} id={chartElementId("specialist-notes", note.id, "note")} className={`chart-note ${rowClass(note.evidenceIds)}`} style={evidenceStyle(noteEvidence)}>
                  <div className="chart-note-header"><strong>{note.title}</strong><span>{note.specialty} - {note.provider} - {formatDate(note.date)}</span></div>
                  <p>{renderEvidenceSpans(note.note, noteEvidence, selectedEvidenceId)}</p>
                  <ol>{note.assessment.map((line) => <li key={line}>{line}</li>)}</ol>
                </section>
              );
            })}
          </div>
        ) : null}
        {activeTab === "claims" ? (
          <ChartTable headers={["DOS", "Provider", "Payer", "CPT / Type", "ICD-10 Codes", "Eligibility", "Support"]}>
            {chart.claims.map((claim) => {
              const claimEvidence = evidence.filter((item) => item.chartAnchor?.tab === "claims" && item.chartAnchor.itemId === claim.id);
              return (
                <tr key={claim.id} id={chartElementId("claims", claim.id)} className={rowClass(claimEvidence.map((item) => item.id))} style={evidenceStyle(claimEvidence)}>
                  <td>{formatDate(claim.dateOfService)}</td>
                  <td>{claim.provider}</td>
                  <td>{claim.payer}</td>
                  <td>{claim.cptCode} / {claim.encounterType}</td>
                  <td>{claim.icd10Codes.length ? claim.icd10Codes.join(", ") : "No diagnosis on claim"}</td>
                  <td>{claim.providerTypeEligible ? "Eligible provider" : "Provider issue"}; {claim.faceToFace ? "Face-to-face" : "Non-face-to-face"}; {claim.providerSignatureValid ? "Signed" : "Signature issue"}</td>
                  <td>{renderEvidenceSpans(claim.supportSummary ?? "Claim support and eligibility reviewed.", claimEvidence, selectedEvidenceId)}</td>
                </tr>
              );
            })}
          </ChartTable>
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

function renderEvidenceSpans(sectionText: string, evidence: EvidencePassage[], selectedEvidenceId?: string) {
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
    const token = span.item.subtype ? subtypeTokens[span.item.subtype] : categoryTokens[span.item.category];
    if (span.start > cursor) pieces.push(sectionText.slice(cursor, span.start));
    pieces.push(
      <mark
        id={`span-${span.item.id}`}
        key={span.item.id}
        className={`evidence-span ${selectedEvidenceId === span.item.id ? "selected" : ""}`}
        style={{ color: token.color, background: token.bg, borderColor: token.border }}
      >
        {sectionText.slice(span.start, span.end)}
      </mark>
    );
    cursor = span.end;
  });
  if (cursor < sectionText.length) pieces.push(sectionText.slice(cursor));
  return pieces.length ? pieces : sectionText;
}

function ConditionGroup({
  title,
  conditions,
  review,
  editable,
  canUseProspectiveActions,
  readOnlyTitle,
  warningIds,
  jumpToEvidence,
  activeConditionId,
  setActiveConditionId,
  onDisagree,
  onChange,
  onFlag,
  onDeleteSafety
}: {
  title: string;
  conditions: Condition[];
  review: ReturnType<typeof useAppState>["data"]["reviews"][number];
  editable: boolean;
  canUseProspectiveActions: boolean;
  readOnlyTitle?: string;
  warningIds: string[];
  jumpToEvidence: (evidence: EvidencePassage) => void;
  activeConditionId?: string;
  setActiveConditionId: (conditionId: string) => void;
  onDisagree: (condition: Condition) => void;
  onChange: (condition: Condition) => void;
  onFlag: (condition: Condition) => void;
  onDeleteSafety: (condition: Condition) => void;
}) {
  if (!conditions.length) return null;
  return (
    <section className="condition-group">
      <h3>{title}</h3>
      {conditions.map((condition) => (
        <ConditionCard
          key={condition.id}
          condition={condition}
          review={review}
          editable={editable}
          canUseProspectiveActions={canUseProspectiveActions}
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

function ConditionCard({
  condition,
  review,
  editable,
  canUseProspectiveActions,
  readOnlyTitle,
  isWarning,
  jumpToEvidence,
  isActive,
  setActiveConditionId,
  onDisagree,
  onChange,
  onFlag,
  onDeleteSafety
}: {
  condition: Condition;
  review: ReturnType<typeof useAppState>["data"]["reviews"][number];
  editable: boolean;
  canUseProspectiveActions: boolean;
  readOnlyTitle?: string;
  isWarning: boolean;
  jumpToEvidence: (evidence: EvidencePassage) => void;
  isActive: boolean;
  setActiveConditionId: (conditionId: string) => void;
  onDisagree: (condition: Condition) => void;
  onChange: (condition: Condition) => void;
  onFlag: (condition: Condition) => void;
  onDeleteSafety: (condition: Condition) => void;
}) {
  const { data, settings, actions } = useAppState();
  const evidence = getEvidenceForCondition(data, condition);
  const recommendation = getRecommendation(condition, review, data, settings);
  const ruleResult = getRuleResult(condition, review, data, settings);
  const disabled = !editable;
  const downstreamTask = getDownstreamTaskForCondition(data, condition.id);
  const downstreamTasks = getDownstreamTasksForCondition(data, condition.id);
  const claim = getClaimForReview(data, review.id);
  const showActionControls = !condition.disposition || review.status === "Rework Required";

  function act(action: RecommendationAction) {
    if (action === "Delete" && hasDeleteSafetyWarning(ruleResult)) {
      onDeleteSafety(condition);
      return;
    }
    const agreed = recommendation ? recommendation.action === action : undefined;
    actions.setDisposition(review.id, condition.id, action, agreed);
  }

  function disabledRule(action: RecommendationAction) {
    return ruleResult.disabledActions.find((item) => item.action === action);
  }

  function isDisabled(action: RecommendationAction) {
    return disabled || Boolean(disabledRule(action));
  }

  function actionTitle(action: RecommendationAction) {
    if (!editable) return readOnlyTitle;
    return disabledRule(action)?.reason;
  }

  return (
    <article className={`condition-card ${isWarning ? "needs-action" : ""} ${isActive ? "active-condition" : ""}`} onClick={() => setActiveConditionId(condition.id)}>
      <div className="condition-card-header">
        <div>
          <div className="condition-code">
            <span className="mono">{condition.icd10}</span>
            <strong>{condition.description}</strong>
          </div>
          <p>
            {condition.hcc} - RAF {formatRaf(condition.raf)} - {condition.claimStatus} - Source {formatDate(condition.sourceDate)}
          </p>
        </div>
        <CategoryBadge category={condition.category} subtype={condition.subtype} />
      </div>
      <RecommendationBox recommendation={recommendation} settings={settings} />
      <RuleMessages ruleResult={ruleResult} jumpToEvidence={jumpToEvidence} />
      <div className="source-eligibility-row compact">
        <EligibilityChip label="Eligible CPT / encounter type" ok={claim?.cptSourceEligible !== false} />
        <EligibilityChip label="Acceptable provider type" ok={claim?.providerTypeEligible !== false} />
        <EligibilityChip label="Face-to-face visit" ok={claim?.faceToFace !== false} />
        <EligibilityChip label="Valid provider signature" ok={claim?.providerSignatureValid !== false} />
      </div>
      <div className="condition-history">
        <span>Originally presented as: {categoryTokens[condition.originalCategory ?? condition.category].label}</span>
        <span>Recommendation: {recommendation?.action ?? condition.originalRecommendation ?? "None"} ({recommendation?.source ?? condition.recommendationSource ?? "rules"})</span>
        <span>User decision: {condition.disposition ? condition.disposition.action : "Unresolved"}</span>
        <span>Rule outcome: {condition.ruleOutcome ? `${condition.ruleOutcome.source} - ${condition.ruleOutcome.action ?? "No action"}` : "None"}</span>
        <span>Downstream task: {downstreamTasks.length ? downstreamTasks.map((task) => `${task.type} - ${task.status}`).join("; ") : downstreamTask ? `${downstreamTask.type} - ${downstreamTask.status}` : "None"}</span>
        <span>Auditor decision: {condition.auditorDisposition?.outcome ?? "None"}</span>
      </div>
      <div className="evidence-list">
        {evidence.map((item) => (
          <button key={item.id} type="button" onClick={() => {
            setActiveConditionId(condition.id);
            jumpToEvidence(item);
          }}>
            <span>{item.summary}</span>
            <small>{formatDate(item.date)}</small>
          </button>
        ))}
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
      {condition.disposition ? (
        <div className="disposition-row">
          <StatusChip tone="good">
            <Check size={14} />
            {condition.disposition.action}
          </StatusChip>
          {condition.disposition.reason ? <span>{condition.disposition.reason}</span> : null}
          {condition.disposition.replacementCode ? <span className="mono">{condition.disposition.replacementCode}</span> : null}
          <small>{formatDateTime(condition.disposition.decidedAt)}</small>
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
      {showActionControls ? (
        <div className="action-row">
          {condition.workflow === "codesOnClaim" ? (
            <>
              <Button disabled={isDisabled("Validate")} title={actionTitle("Validate")} onClick={() => act("Validate")}>Validate</Button>
              <Button variant="danger" disabled={isDisabled("Delete")} title={actionTitle("Delete")} onClick={() => act("Delete")}>Delete</Button>
              <Button disabled={isDisabled("Send to Prospective")} title={actionTitle("Send to Prospective")} onClick={() => act("Send to Prospective")}>Send to Prospective</Button>
            </>
          ) : null}
          {condition.workflow === "codesNotOnClaim" ? (
            <>
              <Button disabled={isDisabled("Add to Claim")} title={actionTitle("Add to Claim")} onClick={() => act("Add to Claim")}>Add to Claim</Button>
              <Button disabled={isDisabled("Disagree")} title={actionTitle("Disagree")} onClick={() => onDisagree(condition)}>Disagree</Button>
            </>
          ) : null}
          {condition.workflow === "prospective" ? (
            <>
              <Button disabled={isDisabled("Yes")} title={actionTitle("Yes")} onClick={() => act("Yes")}>Yes</Button>
              <Button disabled={isDisabled("No")} title={actionTitle("No")} onClick={() => act("No")}>No</Button>
              <Button disabled={isDisabled("Change")} title={actionTitle("Change")} onClick={() => onChange(condition)}>Change</Button>
            </>
          ) : null}
          <Button variant="ghost" disabled={!editable} title={!editable ? readOnlyTitle : undefined} onClick={() => onFlag(condition)}>
            <Flag size={14} />
            Flag issue
          </Button>
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
  const evidenceIds = Array.from(
    new Set([
      ...ruleResult.supportingEvidenceIds,
      ...ruleResult.conflictingEvidenceIds,
      ...ruleResult.disabledActions.flatMap((item) => [...(item.supportingEvidenceIds ?? []), ...(item.conflictingEvidenceIds ?? [])]),
      ...ruleResult.warnings.flatMap((item) => item.evidenceIds ?? [])
    ])
  );
  const showLookbackEvidence = ruleResult.ruleId === "three-year-lookback-recapture" && evidenceIds.length > 0;
  if (!ruleResult.disabledActions.length && !ruleResult.warnings.length && !showLookbackEvidence) return null;
  return (
    <div className="rule-message-list">
      {showLookbackEvidence ? <div className="rule-info">Three-year lookback evidence used for this prototype recommendation.</div> : null}
      {ruleResult.disabledActions.map((item) => (
        <div key={`${item.ruleId}-${item.action}`} className="disabled-reason">
          {item.reason}
        </div>
      ))}
      {ruleResult.warnings.map((item, index) => (
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
          Save disagreement
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
          Save change
        </Button>
      </div>
    </Modal>
  );
}

function FlagModal({ condition, reviewId, onClose }: { condition: Condition; reviewId: string; onClose: () => void }) {
  const { actions } = useAppState();
  const [issue, setIssue] = useState<DocumentationIssue>("Not risk eligible CPT source");
  const [comments, setComments] = useState("");
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
        <textarea value={comments} onChange={(event) => setComments(event.target.value)} placeholder={issue === "Provider education" ? "Provider education comments" : "Optional comments"} />
      </label>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={issue === "Provider education" && !comments.trim()}
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
  const { data, currentUser, settings, actions } = useAppState();
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
          Save Delete
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
