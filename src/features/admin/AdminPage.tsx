import { Download, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import { useAppState } from "../../state/AppState";
import { byId } from "../../domain/selectors";
import { Button, Panel, StatusChip } from "../../ui/Primitives";
import type { ExportRecord, RecommendationMode } from "../../domain/types";

export function AdminPage() {
  const { data, settings, setRecommendationMode, setAuditSampleRate } = useAppState();
  const maps = useMemo(() => ({ patients: byId(data.patients), payers: byId(data.payers) }), [data]);
  const generatedExports = useMemo<ExportRecord[]>(() => {
    const deletionRows = data.conditions
      .filter((condition) => condition.disposition?.action === "Delete")
      .map((condition) => {
        const review = data.reviews.find((item) => item.id === condition.reviewId)!;
        const patient = maps.patients.get(review.patientId)!;
        return { memberId: patient.memberId, icd10: condition.icd10, hcc: condition.hcc, raf: condition.raf, note: "Simulated deletion list row" };
      });
    const additionRows = data.conditions
      .filter((condition) => condition.disposition?.action === "Add to Claim")
      .map((condition) => {
        const review = data.reviews.find((item) => item.id === condition.reviewId)!;
        const patient = maps.patients.get(review.patientId)!;
        const payer = maps.payers.get(patient.payerId)!;
        return { memberId: patient.memberId, icd10: condition.icd10, hcc: condition.hcc, payer: payer.name, profile: payer.asmProfile };
      });
    const auditRows = data.audits.map((audit) => ({ reviewId: audit.reviewId, auditorId: audit.auditorId, outcome: audit.outcome ?? "Open", note: "Simulated audit result row" }));
    return [
      ...data.exports,
      { id: "generated-delete", type: "Deletion list", createdAt: new Date().toISOString(), rows: deletionRows },
      { id: "generated-addition", type: "Addition to claim list", createdAt: new Date().toISOString(), rows: additionRows },
      { id: "generated-audit", type: "Audit results", createdAt: new Date().toISOString(), rows: auditRows }
    ];
  }, [data, maps]);

  return (
    <div className="page-stack">
      <Panel title="Prototype Settings" actions={<SlidersHorizontal size={18} />}>
        <div className="settings-grid">
          <label>
            Recommendation assistance display
            <select value={settings.recommendationMode} onChange={(event) => setRecommendationMode(event.target.value as RecommendationMode)}>
              <option value="simulated">Simulated AI recommendations</option>
              <option value="rules">Rule-based decision support</option>
              <option value="hidden">Hidden/disabled</option>
            </select>
          </label>
          <label>
            Audit sampling percentage
            <input type="number" min={0} max={100} value={settings.auditSampleRate} onChange={(event) => setAuditSampleRate(Number(event.target.value))} />
          </label>
        </div>
        <p className="raf-note">No AI APIs, API keys, cloud model services, required local language models, EHR, payer, CMS, or scheduling integrations are used.</p>
      </Panel>

      <Panel title="Simulated Exports">
        <div className="export-grid">
          {generatedExports.map((record) => (
            <article key={record.id} className="export-card">
              <header>
                <strong>{record.type}</strong>
                <StatusChip tone="info">Prototype export</StatusChip>
              </header>
              <p>{record.rows.length} row(s). CSV/JSON shape only; not a production CMS or payer submission file.</p>
              <pre>{toCsv(record.rows)}</pre>
              <Button onClick={() => download(`${record.type.toLowerCase().replace(/\s+/g, "-")}.csv`, toCsv(record.rows))}>
                <Download size={15} />
                Download CSV
              </Button>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return "No rows";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(","))].join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
