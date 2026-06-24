import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileWarning, Flag, Send, X } from "lucide-react";
import { useAppState } from "../../state/AppState";
import { byId, canEditReview, getCategorySummary, getEvidenceForCondition, getProspectiveCounts, getRafSummary, getRecommendation, getUnresolvedConditions, reviewConditions } from "../../domain/selectors";
import type { Condition, DisagreeReason, DocumentationIssue, EvidencePassage, RecommendationAction, SourceDocument } from "../../domain/types";
import { formatDate, formatDateTime, formatRaf } from "../../domain/format";
import { Button, CategoryBadge, EmptyState, Panel, RecommendationBox, StatusChip } from "../../ui/Primitives";
import { categoryTokens, subtypeTokens } from "../../domain/tokens";

const disagreeReasons: DisagreeReason[] = ["Not Enough MEAT", "Condition Resolved", "Conflicting Evidence", "Other"];
const documentationIssues: DocumentationIssue[] = ["Not risk eligible CPT source", "Not risk eligible provider type", "Not a face-to-face service", "Provider education"];

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
  const categorySummary = getCategorySummary(data, activeReview);
  const prospectiveCounts = getProspectiveCounts(data, activeReview);
  const rafSummary = getRafSummary(data, activeReview);
  const lockOwner = activeReview.lock ? maps.users.get(activeReview.lock.lockedByUserId)?.name : undefined;

  function jumpToEvidence(evidence: EvidencePassage) {
    setSelectedEvidenceId(evidence.id);
    setSelectedDocumentId(evidence.documentId);
    window.setTimeout(() => document.getElementById(evidence.anchorId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
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
            {!editable && (
              <Button variant="secondary" onClick={() => actions.overrideLock(review.id, "Manager/admin override from patient workspace.")}>
                Override lock
              </Button>
            )}
            <Button onClick={() => actions.pendReview(review.id)}>Pend</Button>
            <Button onClick={() => actions.routeReview(review.id, "Auditor Queue")}>Send to auditor</Button>
            <Button onClick={() => actions.routeReview(review.id, "Manager Review Queue")}>Manager review</Button>
            <Button variant="primary" onClick={complete}>
              Complete review
            </Button>
            <Button variant="ghost" onClick={exitAndRelease}>Exit/release</Button>
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
        <div className="summary-grid">
          {Object.entries(categorySummary).map(([category, summary]) => (
            <div className="summary-card" key={category}>
              <span>{categoryTokens[category as keyof typeof categoryTokens].label}</span>
              <strong>{summary.count}</strong>
              <small>RAF {formatRaf(summary.raf)}</small>
            </div>
          ))}
          <div className="summary-card">
            <span>Recapture / Suspect</span>
            <strong>
              {prospectiveCounts.recapture} / {prospectiveCounts.suspect}
            </strong>
            <small>Prospective RAF {formatRaf(rafSummary.prospectiveRaf)}</small>
          </div>
          <div className="summary-card strong">
            <span>Total Demo RAF</span>
            <strong>{formatRaf(rafSummary.totalRaf)}</strong>
            <small>Includes demographic RAF {formatRaf(rafSummary.demographicRaf)}</small>
          </div>
        </div>
        <div className="raf-note">RAF values are fixed synthetic prototype values and are not an authoritative CMS risk calculation.</div>
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
          const firstEvidence = section.evidenceIds[0];
          const isSelected = section.evidenceIds.includes(selectedEvidenceId ?? "");
          const sectionEvidence = firstEvidence ? evidenceMap.get(firstEvidence) : undefined;
          const token = sectionEvidence?.subtype ? subtypeTokens[sectionEvidence.subtype] : sectionEvidence ? categoryTokens[sectionEvidence.category] : undefined;
          return (
            <p
              id={section.id}
              key={section.id}
              className={`document-section ${section.evidenceIds.length ? "has-evidence" : ""} ${isSelected ? "selected-evidence" : ""}`}
              style={token ? { borderColor: token.border, background: token.bg } : undefined}
            >
              {section.text}
            </p>
          );
        })}
      </article>
    </div>
  );
}

function ConditionGroup({
  title,
  conditions,
  review,
  editable,
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
  isWarning,
  jumpToEvidence,
  onDisagree,
  onChange,
  onFlag
}: {
  condition: Condition;
  review: ReturnType<typeof useAppState>["data"]["reviews"][number];
  editable: boolean;
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
      ) : (
        <div className="action-row">
          {condition.workflow === "codesOnClaim" ? (
            <>
              <Button disabled={disabled} onClick={() => act("Validate")}>Validate</Button>
              <Button variant="danger" disabled={disabled || condition.hasOtherSupportingEvidence} onClick={() => act("Delete")}>Delete</Button>
              <Button disabled={disabled || !condition.currentYear} onClick={() => act("Send to Prospective")}>Send to Prospective</Button>
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
      )}
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

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
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
