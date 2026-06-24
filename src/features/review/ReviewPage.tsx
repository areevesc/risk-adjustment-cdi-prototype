import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, FileWarning, Flag, LockKeyhole, X } from "lucide-react";
import { useAppState } from "../../state/AppState";
import {
  byId,
  canEditReview,
  getClaimForReview,
  getDispositionSummary,
  getDownstreamTaskForCondition,
  getEvidenceForCondition,
  getPresentedOpportunitySummary,
  getProspectiveCounts,
  getRafSummary,
  getRecommendation,
  isPrototypeCurrentYear,
  reviewConditions
} from "../../domain/selectors";
import type { Condition, DisagreeReason, DocumentationIssue, EvidencePassage, RecommendationAction, SourceDocument } from "../../domain/types";
import { formatDate, formatDateTime, formatRaf } from "../../domain/format";
import { Button, CategoryBadge, EmptyState, Panel, RecommendationBox, StatusChip } from "../../ui/Primitives";
import { categoryTokens, dispositionTokens, subtypeTokens } from "../../domain/tokens";
import { canOverrideLock, canReleaseReviewLock, canViewReview, getFirstPermittedRoute } from "../../domain/auth";

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
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>();
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | undefined>();
  const [disagreeCondition, setDisagreeCondition] = useState<Condition | null>(null);
  const [changeCondition, setChangeCondition] = useState<Condition | null>(null);
  const [flagCondition, setFlagCondition] = useState<Condition | null>(null);
  const [overrideRequested, setOverrideRequested] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [completionWarnings, setCompletionWarnings] = useState<string[]>([]);

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
  const conditions = reviewConditions(data, activeReview);
  const documents = data.documents.filter((document) => document.reviewId === activeReview.id);
  const activeDocument = documents.find((document) => document.id === selectedDocumentId) ?? documents[0];
  const editable = canEditReview(activeReview, currentUser);
  const presentedSummary = getPresentedOpportunitySummary(data, activeReview);
  const dispositionSummary = getDispositionSummary(data, activeReview);
  const prospectiveCounts = getProspectiveCounts(data, activeReview);
  const rafSummary = getRafSummary(data, activeReview);
  const claim = getClaimForReview(data, activeReview.id);
  const lockOwner = activeReview.lock ? maps.users.get(activeReview.lock.lockedByUserId)?.name : undefined;
  const canRelease = canReleaseReviewLock(activeReview, currentUser);
  const canUseProspectiveActions = isPrototypeCurrentYear(activeReview, settings);

  function jumpToEvidence(evidence: EvidencePassage) {
    setSelectedEvidenceId(evidence.id);
    setSelectedDocumentId(evidence.documentId);
    window.setTimeout(() => {
      const target = document.getElementById(`span-${evidence.id}`) ?? document.getElementById(evidence.anchorId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 30);
  }

  function stepEvidence(direction: "prev" | "next") {
    const all = data.evidence.filter((item) => item.reviewId === activeReview.id);
    if (all.length === 0) return;
    const currentIndex = Math.max(0, all.findIndex((item) => item.id === selectedEvidenceId));
    const nextIndex = direction === "next" ? (currentIndex + 1) % all.length : (currentIndex - 1 + all.length) % all.length;
    jumpToEvidence(all[nextIndex]);
  }

  function exitAndRelease() {
    actions.releaseReview(activeReview.id);
    navigate("/queue");
  }

  function complete() {
    const unresolved = actions.completeReview(activeReview.id);
    setCompletionWarnings(unresolved);
  }

  return (
    <div className="page-stack review-page">
      <Panel
        className="patient-header"
        actions={
          <div className="header-actions">
            {review.lock ? (
              <StatusChip tone={editable ? "info" : "warn"}>Locked by {lockOwner}</StatusChip>
            ) : (
              <StatusChip>Unlocked</StatusChip>
            )}
            {!review.lock ? (
              <Button variant="secondary" onClick={() => actions.openReview(review.id)}>
                <LockKeyhole size={15} />
                Open chart
              </Button>
            ) : null}
            {review.lock && !editable && canOverrideLock(review, currentUser, "override") ? (
              <Button variant="secondary" onClick={() => setOverrideRequested(true)}>
                <LockKeyhole size={15} />
                Override Lock
              </Button>
            ) : null}
            <Button onClick={() => setSummaryExpanded((value) => !value)} variant="ghost">
              {summaryExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              Summary
            </Button>
            <Button disabled={!editable} onClick={() => actions.pendReview(review.id)}>Pend</Button>
            <Button disabled={!editable} onClick={() => actions.routeReview(review.id, "Auditor Queue")}>Send to auditor</Button>
            <Button disabled={!editable} onClick={() => actions.routeReview(review.id, "Manager Review Queue")}>Manager review</Button>
            <Button disabled={!editable} variant="primary" onClick={complete}>
              Complete review
            </Button>
            <Button disabled={!canRelease} variant="ghost" onClick={exitAndRelease}>Exit/release</Button>
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
            <span>{clinic?.name}</span>
            <span>{provider?.name}</span>
            <span>Assigned: {[review.assignedCoderId, review.assignedCdiId].map((id) => (id ? maps.users.get(id)?.name : undefined)).filter(Boolean).join(" / ")}</span>
          </div>
        </div>
        {!editable ? (
          <div className="read-only-banner">
            <AlertTriangle size={16} />
            Read-only view. {review.lock ? `Current lock owner: ${lockOwner}.` : "Open the chart to acquire an edit lock."}
          </div>
        ) : null}
        {activeReview.auditReturn ? (
          <div className="warning-banner">
            <AlertTriangle size={18} />
            Rework requested by {maps.users.get(activeReview.auditReturn.returnedByUserId)?.name}: {activeReview.auditReturn.comments}
          </div>
        ) : null}
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
              <EligibilityChip label="Risk-eligible source" ok={claim?.riskEligible !== false} />
              <EligibilityChip label="Risk-eligible CPT" ok={claim?.cptSourceEligible !== false} />
              <EligibilityChip label="Risk-eligible provider type" ok={claim?.providerTypeEligible !== false} />
              <EligibilityChip label="Face-to-face service" ok={claim?.faceToFace !== false} />
              <EligibilityChip label="Valid provider signature" ok={claim?.providerSignatureValid !== false} />
            </div>
          </>
        ) : null}
        <div className="raf-note">Synthetic prototype values — not an authoritative CMS RAF calculation.</div>
        {appointment ? (
          <StatusChip tone="good">Next visit: {formatDate(appointment.date)} - {appointment.type}</StatusChip>
        ) : (
          <StatusChip tone="warn">No upcoming visit - scheduling outreach may be needed</StatusChip>
        )}
      </Panel>

      {completionWarnings.length > 0 ? (
        <div className="warning-banner">
          <AlertTriangle size={18} />
          Cannot complete while {completionWarnings.length} actionable condition(s) have no disposition. Review highlighted cards below.
        </div>
      ) : null}

      <div className="split-workspace">
        <Panel
          title="Source Documents And Evidence"
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
          <DocumentViewer
            documents={documents}
            activeDocument={activeDocument}
            evidence={data.evidence}
            selectedEvidenceId={selectedEvidenceId}
            setSelectedDocumentId={setSelectedDocumentId}
          />
        </Panel>

        <Panel title="Conditions And Actions">
          <div className="condition-groups">
            <ConditionGroup
              title="Codes On Claim"
              conditions={conditions.filter((condition) => condition.workflow === "codesOnClaim")}
              review={review}
              editable={editable}
              canUseProspectiveActions={canUseProspectiveActions}
              warningIds={completionWarnings}
              jumpToEvidence={jumpToEvidence}
              onDisagree={setDisagreeCondition}
              onChange={setChangeCondition}
              onFlag={setFlagCondition}
            />
            <ConditionGroup
              title="Codes Not On Claim - Potential Additions"
              conditions={conditions.filter((condition) => condition.workflow === "codesNotOnClaim")}
              review={review}
              editable={editable}
              canUseProspectiveActions={canUseProspectiveActions}
              warningIds={completionWarnings}
              jumpToEvidence={jumpToEvidence}
              onDisagree={setDisagreeCondition}
              onChange={setChangeCondition}
              onFlag={setFlagCondition}
            />
            <ConditionGroup
              title="CDI Prospective Review"
              conditions={conditions.filter((condition) => condition.workflow === "prospective")}
              review={review}
              editable={editable}
              canUseProspectiveActions={canUseProspectiveActions}
              warningIds={completionWarnings}
              jumpToEvidence={jumpToEvidence}
              onDisagree={setDisagreeCondition}
              onChange={setChangeCondition}
              onFlag={setFlagCondition}
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
      {overrideRequested ? <OverrideLockModal reviewId={review.id} onClose={() => setOverrideRequested(false)} /> : null}
    </div>
  );
}

function DocumentViewer({
  documents,
  activeDocument,
  evidence,
  selectedEvidenceId,
  setSelectedDocumentId
}: {
  documents: SourceDocument[];
  activeDocument: SourceDocument;
  evidence: EvidencePassage[];
  selectedEvidenceId?: string;
  setSelectedDocumentId: (id: string) => void;
}) {
  const evidenceMap = new Map(evidence.map((item) => [item.id, item]));
  return (
    <div className="document-viewer">
      <div className="document-tabs" role="tablist">
        {documents.map((document) => (
          <button key={document.id} className={document.id === activeDocument.id ? "active" : ""} onClick={() => setSelectedDocumentId(document.id)} type="button">
            {document.type}
            <span>{formatDate(document.date)}</span>
          </button>
        ))}
      </div>
      <article className="document-page">
        <header>
          <h3>{activeDocument.title}</h3>
          <StatusChip tone={activeDocument.isCurrentYear ? "info" : "warn"}>{activeDocument.isCurrentYear ? "Current calendar year" : "Historical evidence"}</StatusChip>
        </header>
        {activeDocument.sections.map((section) => {
          const sectionEvidence = section.evidenceIds.map((id) => evidenceMap.get(id)).filter(Boolean) as EvidencePassage[];
          const firstEvidence = sectionEvidence[0];
          const isSelected = section.evidenceIds.includes(selectedEvidenceId ?? "");
          const token = firstEvidence?.subtype ? subtypeTokens[firstEvidence.subtype] : firstEvidence ? categoryTokens[firstEvidence.category] : undefined;
          return (
            <p
              id={section.id}
              key={section.id}
              className={`document-section ${section.evidenceIds.length ? "has-evidence" : ""} ${isSelected ? "selected-evidence" : ""}`}
              style={token ? { borderColor: token.border } : undefined}
            >
              {renderEvidenceSpans(section.text, sectionEvidence, selectedEvidenceId)}
            </p>
          );
        })}
      </article>
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
  warningIds,
  jumpToEvidence,
  onDisagree,
  onChange,
  onFlag
}: {
  title: string;
  conditions: Condition[];
  review: ReturnType<typeof useAppState>["data"]["reviews"][number];
  editable: boolean;
  canUseProspectiveActions: boolean;
  warningIds: string[];
  jumpToEvidence: (evidence: EvidencePassage) => void;
  onDisagree: (condition: Condition) => void;
  onChange: (condition: Condition) => void;
  onFlag: (condition: Condition) => void;
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
          isWarning={warningIds.includes(condition.id)}
          jumpToEvidence={jumpToEvidence}
          onDisagree={onDisagree}
          onChange={onChange}
          onFlag={onFlag}
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
  isWarning,
  jumpToEvidence,
  onDisagree,
  onChange,
  onFlag
}: {
  condition: Condition;
  review: ReturnType<typeof useAppState>["data"]["reviews"][number];
  editable: boolean;
  canUseProspectiveActions: boolean;
  isWarning: boolean;
  jumpToEvidence: (evidence: EvidencePassage) => void;
  onDisagree: (condition: Condition) => void;
  onChange: (condition: Condition) => void;
  onFlag: (condition: Condition) => void;
}) {
  const { data, settings, actions } = useAppState();
  const evidence = getEvidenceForCondition(data, condition);
  const recommendation = getRecommendation(condition, review, data, settings);
  const disabled = !editable || !!condition.disabledReason;
  const downstreamTask = getDownstreamTaskForCondition(data, condition.id);
  const claim = getClaimForReview(data, review.id);
  const showActionControls = !condition.disposition || review.status === "Rework Required";

  function act(action: RecommendationAction) {
    const agreed = recommendation ? recommendation.action === action : undefined;
    actions.setDisposition(review.id, condition.id, action, agreed);
  }

  return (
    <article className={`condition-card ${isWarning ? "needs-action" : ""}`}>
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
      <div className="source-eligibility-row compact">
        <EligibilityChip label="Risk source" ok={claim?.riskEligible !== false} />
        <EligibilityChip label="CPT" ok={claim?.cptSourceEligible !== false} />
        <EligibilityChip label="Provider type" ok={claim?.providerTypeEligible !== false} />
        <EligibilityChip label="F2F" ok={claim?.faceToFace !== false} />
        <EligibilityChip label="Signature" ok={claim?.providerSignatureValid !== false} />
      </div>
      <div className="condition-history">
        <span>Originally presented as: {categoryTokens[condition.originalCategory ?? condition.category].label}</span>
        <span>Recommendation: {recommendation?.action ?? condition.originalRecommendation ?? "None"} ({recommendation?.source ?? condition.recommendationSource ?? "rules"})</span>
        <span>User decision: {condition.disposition ? condition.disposition.action : "Unresolved"}</span>
        <span>Downstream task: {downstreamTask ? `${downstreamTask.type} - ${downstreamTask.status}` : "None"}</span>
        <span>Auditor decision: {condition.auditorDisposition?.outcome ?? "None"}</span>
      </div>
      <div className="evidence-list">
        {evidence.map((item) => (
          <button key={item.id} type="button" onClick={() => jumpToEvidence(item)}>
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
      {showActionControls ? (
        <div className="action-row">
          {condition.workflow === "codesOnClaim" ? (
            <>
              <Button disabled={disabled} onClick={() => act("Validate")}>Validate</Button>
              <Button variant="danger" disabled={disabled || condition.hasOtherSupportingEvidence} onClick={() => act("Delete")}>Delete</Button>
              <Button disabled={disabled || !condition.currentYear || !canUseProspectiveActions} onClick={() => act("Send to Prospective")}>Send to Prospective</Button>
            </>
          ) : null}
          {condition.workflow === "codesNotOnClaim" ? (
            <>
              <Button disabled={disabled} onClick={() => act("Add to Claim")}>Add to Claim</Button>
              <Button disabled={disabled} onClick={() => onDisagree(condition)}>Disagree</Button>
            </>
          ) : null}
          {condition.workflow === "prospective" ? (
            <>
              <Button disabled={disabled} onClick={() => act("Yes")}>Yes</Button>
              <Button disabled={disabled} onClick={() => act("No")}>No</Button>
              <Button disabled={disabled} onClick={() => onChange(condition)}>Change</Button>
            </>
          ) : null}
          <Button variant="ghost" disabled={!editable} onClick={() => onFlag(condition)}>
            <Flag size={14} />
            Flag issue
          </Button>
        </div>
      ) : null}
    </article>
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
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
