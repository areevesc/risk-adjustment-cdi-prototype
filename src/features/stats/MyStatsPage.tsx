import type { ReactNode } from "react";
import { getPersonalStats } from "../../domain/selectors";
import { useAppState } from "../../state/AppState";
import { Panel } from "../../ui/Primitives";

export function MyStatsPage() {
  const { data, currentUser } = useAppState();
  const personalStats = getPersonalStats(data, currentUser);

  return (
    <div className="page-stack">
      <Panel title="My Stats">
        <div className="metric-sections">
          <MetricSection title="Workload">
            <Stat label="Assigned Reviews" value={personalStats.assignedReviews} />
            <Stat label="Completed" value={personalStats.completedReviews} />
            <Stat label="Pended" value={personalStats.pendedReviews} />
          </MetricSection>
          <MetricSection title="Coder decisions">
            <Stat label="Validations" value={personalStats.validations} />
            <Stat label="Deletions" value={personalStats.deletions} />
            <Stat label="Additions" value={personalStats.additions} />
            <Stat label="Prospective Decisions" value={personalStats.prospectiveDecisions} />
            <Stat label="Recapture Decisions" value={personalStats.recaptureDecisions} />
            <Stat label="Suspect Decisions" value={personalStats.suspectDecisions} />
          </MetricSection>
          <MetricSection title="Quality and agreement">
            <Stat label="Recommendation Agreement" value={personalStats.recommendationAgreement} suffix="%" />
            <Stat label="Audit Agreement" value={personalStats.auditAgreement} suffix="%" />
          </MetricSection>
        </div>
      </Panel>
    </div>
  );
}

function MetricSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="metric-section"><h3>{title}</h3><div className="stat-grid">{children}</div></section>;
}

function Stat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {value}
        {suffix}
      </strong>
    </div>
  );
}
