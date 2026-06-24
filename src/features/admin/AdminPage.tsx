import { Download, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import { useAppState } from "../../state/AppState";
import { getGeneratedExports } from "../../domain/selectors";
import { Button, Panel, StatusChip } from "../../ui/Primitives";
import type { ExportRecord, RecommendationMode } from "../../domain/types";

export function AdminPage() {
  const { data, settings, setRecommendationMode, setAuditSampleRate, setPrototypeCurrentYear } = useAppState();
  const generatedExports = useMemo<ExportRecord[]>(() => getGeneratedExports(data), [data]);
  const seededExamples = data.exports.filter((record) => record.seededExample);

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
            <small className="setting-help">Changes whether condition cards show simulated AI labels, rule-based decision support, or no recommendation assistance.</small>
          </label>
          <label>
            Audit sampling percentage
            <input type="number" min={0} max={100} value={settings.auditSampleRate} onChange={(event) => setAuditSampleRate(Number(event.target.value))} />
            <small className="setting-help">Controls the deterministic percentage of completed reviews selected for prototype audit.</small>
          </label>
          <label>
            Prototype current year
            <input type="number" min={2020} max={2035} value={settings.prototypeCurrentYear} onChange={(event) => setPrototypeCurrentYear(Number(event.target.value))} />
            <small className="setting-help">Controls current-year eligibility for prospective routing and calendar-year logic.</small>
          </label>
        </div>
        <p className="raf-note">No AI APIs, API keys, cloud model services, required local language models, EHR, payer, CMS, or scheduling integrations are used.</p>
      </Panel>

      <Panel title="Current Generated Exports">
        <ExportSection title="Current generated deletion list" records={generatedExports.filter((record) => record.type === "Deletion list")} />
        <ExportSection title="Current generated addition list" records={generatedExports.filter((record) => record.type === "Addition to claim list")} />
        <ExportSection title="Current generated payer ASM list" records={generatedExports.filter((record) => record.type === "Payer ASM export")} />
        <ExportSection title="Audit results" records={generatedExports.filter((record) => record.type === "Audit results")} />
        <p className="raf-note">Prototype CSV shapes only; these are not real CMS submission files or payer production extracts.</p>
      </Panel>

      <Panel title="Optional Seeded Example Files">
        <ExportSection title="Seeded example" records={seededExamples} seeded />
      </Panel>
    </div>
  );
}

function ExportSection({ title, records, seeded = false }: { title: string; records: ExportRecord[]; seeded?: boolean }) {
  return (
    <section className="export-section">
      <h3>{title}</h3>
      <div className="export-grid">
        {records.map((record) => (
          <article key={record.id} className="export-card">
            <header>
              <strong>{record.type}</strong>
              <StatusChip tone={seeded ? "warn" : "info"}>{seeded ? "Seeded example" : "Current export"}</StatusChip>
            </header>
            <p>{record.rows.length} row(s). CSV/JSON shape only; not a production CMS or payer submission file.</p>
            <pre>{toCsv(record.rows)}</pre>
            <Button onClick={() => download(`${record.id}.csv`, toCsv(record.rows))}>
              <Download size={15} />
              Download CSV
            </Button>
          </article>
        ))}
      </div>
    </section>
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
