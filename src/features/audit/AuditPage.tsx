import { useEffect, useMemo, useState } from "react";
import { FileCheck2, RotateCcw } from "lucide-react";
import { useAppState } from "../../state/AppState";
import { byId, getAuditForReview, getEvidenceForCondition, getRecommendation, reviewConditions } from "../../domain/selectors";
import { formatDate, formatDateTime } from "../../domain/format";
import { Button, EmptyState, Panel, RecommendationBox, StatusChip } from "../../ui/Primitives";

export function AuditPage() {
  const { data, currentUser, settings, actions } = useAppState();
  const [selectedReviewId, setSelectedReviewId] = useState(data.reviews.find((review) => review.queue === "Auditor Queue" || review.status === "Under Audit")?.id);
  const [comments, setComments] = useState("");
  const [returnMessage, setReturnMessage] = useState("");
  const maps = useMemo(() => ({ patients: byId(data.patients), users: byId(data.users) }), [data]);
  const auditReviews = useMemo(() => data.reviews.filter((review) => review.queue === "Auditor Queue" || review.status === "Under Audit" || review.status === "Audit Complete"), [data.reviews]);
  const selected = auditReviews.find((review) => review.id === selectedReviewId) ?? auditReviews[0];

  useEffect(() => {
    if (auditReviews.length && !auditReviews.some((review) => review.id === selectedReviewId)) {
      setSelectedReviewId(auditReviews[0].id);
    }
  }, [auditReviews, selectedReviewId]);

  if (!selected) {
    return (
      <div className="page-stack">
        {returnMessage ? <AuditReturnConfirmation message={returnMessage} /> : null}
        <EmptyState title="No audit reviews" body="No reviews are currently in the auditor queue." />
      </div>
    );
  }

  const patient = maps.patients.get(selected.patientId)!;
  const audit = getAuditForReview(data, selected.id);
  const conditions = reviewConditions(data, selected);
  const auditComplete = audit?.status === "Complete";
  const canAct = selected.status === "Under Audit" && !auditComplete;

  function returnForCorrection() {
    if (!comments.trim()) return;
    const recipientId = selected.assignedUserId;
    const recipientName = recipientId ? maps.users.get(recipientId)?.name : undefined;
    const message = `Review ${selected.id} was returned to ${recipientName ?? "the assigned reviewer"} for correction and is now Rework Required.`;
    const nextReview = auditReviews.find((review) => review.id !== selected.id);
    actions.completeAudit(selected.id, "Return for Correction", comments);
    setComments("");
    setReturnMessage(message);
    setSelectedReviewId(nextReview?.id);
  }

  return (
    <div className="page-stack">
      {returnMessage ? <AuditReturnConfirmation message={returnMessage} /> : null}
      <Panel title="Audit Queue">
        <div className="audit-layout">
          <div className="audit-list">
            {auditReviews.map((review) => {
              const itemPatient = maps.patients.get(review.patientId)!;
              const itemAudit = getAuditForReview(data, review.id);
              return (
                <button key={review.id} type="button" className={selected.id === review.id ? "active" : ""} onClick={() => setSelectedReviewId(review.id)}>
                  <strong>{itemPatient.name}</strong>
                  <span>
                    CY {review.calendarYear} - {review.reviewType}
                  </span>
                  <StatusChip tone={review.status.includes("Complete") ? "good" : "purple"}>{itemAudit?.status ?? review.status}</StatusChip>
                  {itemAudit?.selectionSource ? <small>{itemAudit.selectionSource === "deterministic-sample" ? "Sampled" : "Manual"}</small> : null}
                </button>
              );
            })}
          </div>
          <div className="audit-detail">
            <div className="audit-heading">
              <div>
                <h2>{patient.name}</h2>
                <p>
                  Member {patient.memberId} - Audit status {audit?.status ?? "Not Started"}
                </p>
                {audit?.selectionSource ? (
                  <p>
                    {audit.selectionSource === "deterministic-sample" ? "Deterministic sample" : "Manual audit"}{" "}
                    {audit.sampleRate !== undefined ? `- rate ${audit.sampleRate}% - bucket ${audit.sampleBucket}` : ""}
                    {audit.sampleCategories?.length ? ` - categories ${audit.sampleCategories.join(", ")}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="header-actions">
                <Button disabled={auditComplete} onClick={() => actions.startAudit(selected.id)}>
                  <FileCheck2 size={15} />
                  Start audit
                </Button>
                {auditComplete ? (
                  <Button onClick={() => actions.reopenAudit(selected.id)}>
                    <RotateCcw size={15} />
                    Reopen audit
                  </Button>
                ) : null}
                <Button disabled={!canAct || !comments.trim()} onClick={returnForCorrection}>
                  <RotateCcw size={15} />
                  Return
                </Button>
                <Button disabled={!canAct} variant="primary" onClick={() => actions.completeAudit(selected.id, "Agree", comments)}>Agree complete</Button>
                <Button disabled={!canAct} variant="danger" onClick={() => actions.completeAudit(selected.id, "Disagree", comments)}>Disagree complete</Button>
              </div>
            </div>
            {auditComplete ? <div className="read-only-banner">Audit complete. Use Reopen audit before making another audit decision.</div> : null}
            {selected.auditReturn ? <div className="warning-banner">Returned for correction: {selected.auditReturn.comments}</div> : null}
            <label>
              Auditor comments
              <textarea
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                placeholder={`Record audit rationale, correction request, or agreement notes as ${currentUser.name}`}
              />
            </label>
            <div className="audit-condition-list">
              {conditions.map((condition) => {
                const recommendation = getRecommendation(condition, selected, data, settings);
                return (
                  <article key={condition.id} className="audit-condition">
                    <header>
                      <strong>
                        {condition.icd10} - {condition.description}
                      </strong>
                      <StatusChip tone={condition.disposition || condition.ruleOutcome?.source === "rule-resolved" ? "good" : condition.ruleOutcome ? "purple" : "warn"}>
                        {condition.disposition?.action ??
                          (condition.ruleOutcome
                            ? `${condition.ruleOutcome.source === "rule-resolved" ? "Rule-resolved" : "Rule-suppressed"}${condition.ruleOutcome.action ? ` - ${condition.ruleOutcome.action}` : ""}`
                            : "No disposition")}
                      </StatusChip>
                    </header>
                    <RecommendationBox recommendation={recommendation} settings={settings} />
                    <div className="compact-list">
                      {getEvidenceForCondition(data, condition).map((item) => (
                        <span key={item.id}>
                          {formatDate(item.date)} - {item.summary}
                        </span>
                      ))}
                    </div>
                    {condition.disposition ? (
                      <p>
                        User decision by {maps.users.get(condition.disposition.userId)?.name}: {condition.disposition.action}
                        {condition.disposition.reason ? ` - ${condition.disposition.reason}` : ""} at {formatDateTime(condition.disposition.decidedAt)}
                      </p>
                    ) : null}
                    {condition.ruleOutcome ? (
                      <p>
                        Rule outcome: {condition.ruleOutcome.source === "rule-resolved" ? "Rule-resolved" : "Rule-suppressed"}
                        {condition.ruleOutcome.action ? ` - ${condition.ruleOutcome.action}` : ""} at {formatDateTime(condition.ruleOutcome.createdAt)}. {condition.ruleOutcome.explanation}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function AuditReturnConfirmation({ message }: { message: string }) {
  return (
    <div className="success-banner" role="status" aria-live="polite">
      <FileCheck2 size={18} />
      {message}
    </div>
  );
}
