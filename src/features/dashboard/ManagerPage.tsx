import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, LockKeyhole, UserCheck } from "lucide-react";
import { useAppState } from "../../state/AppState";
import { byId, canManageLocks, getActionTotals, getGeneratedExports, getPopulationRafSummary, getReviewStatusTotals, getTeamStats } from "../../domain/selectors";
import { formatRaf } from "../../domain/format";
import { Button, CloseDialogButton, Panel, StatusChip } from "../../ui/Primitives";
import type { AssignmentMode, PatientReview, User } from "../../domain/types";

const chartColors = ["#1264b3", "#087f5b", "#b42318", "#6d55d8", "#8a5a00", "#64748b"];

export function ManagerPage() {
  const { data, currentUser, actions } = useAppState();
  const [assignmentReviewId, setAssignmentReviewId] = useState<string | null>(null);
  const [overrideReviewId, setOverrideReviewId] = useState<string | null>(null);
  const maps = useMemo(() => ({ patients: byId(data.patients), users: byId(data.users), clinics: byId(data.clinics), payers: byId(data.payers) }), [data]);
  const teamStats = getTeamStats(data);
  const statusTotals = getReviewStatusTotals(data);
  const actionTotals = getActionTotals(data);
  const populationRaf = getPopulationRafSummary(data);
  const generatedExports = getGeneratedExports(data);

  return (
    <div className="page-stack">
      <div className="dashboard-grid">
        <Panel title="Reviews By Status">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusTotals} dataKey="value" nameKey="name" outerRadius={90} label>
                {statusTotals.map((_, index) => (
                  <Cell key={index} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Team Workload">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={teamStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="assigned" fill="#1264b3" />
              <Bar dataKey="completed" fill="#087f5b" />
              <Bar dataKey="pended" fill="#8a5a00" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Action Totals">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={actionTotals}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#6d55d8" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="RAF Reporting">
          <div className="stat-grid">
            <div className="stat">
              <span>Patients</span>
              <strong>{populationRaf.patientCount}</strong>
            </div>
            <div className="stat">
              <span>Reviews</span>
              <strong>{populationRaf.reviewCount}</strong>
            </div>
            <div className="stat">
              <span>Total demographic RAF</span>
              <strong>{formatRaf(populationRaf.totals.demographicRaf)}</strong>
            </div>
            <div className="stat">
              <span>Avg demographic RAF</span>
              <strong>{formatRaf(populationRaf.averages.demographicRaf)}</strong>
            </div>
            <div className="stat">
              <span>Total captured RAF</span>
              <strong>{formatRaf(populationRaf.totals.capturedRaf)}</strong>
            </div>
            <div className="stat">
              <span>Avg captured RAF</span>
              <strong>{formatRaf(populationRaf.averages.capturedRaf)}</strong>
            </div>
            <div className="stat">
              <span>Total open RAF</span>
              <strong>{formatRaf(populationRaf.totals.openRaf)}</strong>
            </div>
            <div className="stat">
              <span>Avg open RAF</span>
              <strong>{formatRaf(populationRaf.averages.openRaf)}</strong>
            </div>
            <div className="stat">
              <span>Total prospective RAF</span>
              <strong>{formatRaf(populationRaf.totals.prospectiveRaf)}</strong>
            </div>
            <div className="stat">
              <span>Avg prospective RAF</span>
              <strong>{formatRaf(populationRaf.averages.prospectiveRaf)}</strong>
            </div>
            <div className="stat">
              <span>Total deletion RAF</span>
              <strong>{formatRaf(populationRaf.totals.deletionRaf)}</strong>
            </div>
            <div className="stat">
              <span>Avg deletion RAF</span>
              <strong>{formatRaf(populationRaf.averages.deletionRaf)}</strong>
            </div>
            <div className="stat">
              <span>Total projected RAF</span>
              <strong>{formatRaf(populationRaf.totals.projectedRaf)}</strong>
            </div>
            <div className="stat">
              <span>Avg projected RAF</span>
              <strong>{formatRaf(populationRaf.averages.projectedRaf)}</strong>
            </div>
          </div>
          <p className="raf-note">RAF reporting uses predetermined synthetic values and transparent prototype calculations.</p>
        </Panel>
      </div>

      <Panel title="Export And Demo Files">
        <div className="manager-export-grid">
          <ManagerExportButton label="Export Manager Dashboard Data" filename="manager-dashboard-data.json" rows={[{ statusTotals, teamStats, actionTotals, populationRaf }]} format="json" />
          <ManagerExportButton label="Export Reviews by Status" filename="reviews-by-status.csv" rows={statusTotals} />
          <ManagerExportButton label="Export Team Workload" filename="team-workload.csv" rows={teamStats} />
          <ManagerExportButton label="Export Action Totals" filename="action-totals.csv" rows={actionTotals} />
          <ManagerExportButton label="Export RAF Reporting" filename="raf-reporting.json" rows={[populationRaf]} format="json" />
          <ManagerExportButton label="Export Potential Deletes" filename="potential-deletes.csv" rows={generatedExports.find((item) => item.type === "Deletion list")?.rows ?? []} />
          <ManagerExportButton label="Export Potential Additions" filename="potential-additions.csv" rows={generatedExports.find((item) => item.type === "Addition to claim list")?.rows ?? []} />
          <ManagerExportButton
            label="Export Prospective / Recapture / Suspect List"
            filename="prospective-recapture-suspect.csv"
            rows={data.conditions
              .filter((condition) => condition.workflow === "prospective")
              .map((condition) => ({ reviewId: condition.reviewId, icd10: condition.icd10, hcc: condition.hcc, subtype: condition.subtype ?? "suspect", raf: condition.raf }))}
          />
          <ManagerExportButton
            label="Export Outreach / No Upcoming Visit List"
            filename="outreach-no-upcoming-visit.csv"
            rows={data.reviews
              .filter((review) => !data.appointments.some((appointment) => appointment.patientId === review.patientId))
              .map((review) => ({ reviewId: review.id, patient: maps.patients.get(review.patientId)?.name ?? "", status: review.status, assignedUserId: review.assignedUserId }))}
          />
          <ManagerExportButton label="Export ASM-style File" filename="asm-style-export.json" rows={generatedExports.find((item) => item.type === "Payer ASM export")?.rows ?? []} format="json" />
        </div>
        <p className="raf-note">Exports are simulated demo files generated from synthetic prototype data.</p>
      </Panel>

      <Panel title="Assignments And Locks">
        <div className="assignment-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Clinic</th>
                <th>Status</th>
                <th>Lock</th>
                <th>Assign/Reassign</th>
              </tr>
            </thead>
            <tbody>
              {data.reviews.map((review) => (
                <tr key={review.id}>
                  <td>{maps.patients.get(review.patientId)?.name}</td>
                  <td>{maps.clinics.get(review.clinicId)?.name}</td>
                  <td>
                    <StatusChip>{review.status}</StatusChip>
                  </td>
                  <td>{review.lock ? `Being edited by ${maps.users.get(review.lock.lockedByUserId)?.name}` : "No active editor"}</td>
                  <td>
                    <div className="row-actions">
                      <Button disabled={!canManageLocks(currentUser)} onClick={() => setAssignmentReviewId(review.id)}>
                        <UserCheck size={14} />
                        Assign
                      </Button>
                      {review.lock ? (
                        <Button className="override-lock-action" disabled={!canManageLocks(currentUser)} onClick={() => setOverrideReviewId(review.id)}>
                          <LockKeyhole size={14} />
                          Override
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {assignmentReviewId ? (
        <AssignmentDialog
          review={data.reviews.find((review) => review.id === assignmentReviewId)!}
          users={data.users}
          maps={maps}
          onClose={() => setAssignmentReviewId(null)}
          onAssign={(assignedUserId, mode, reason) => {
            actions.assignReview(assignmentReviewId, assignedUserId, mode, reason);
            setAssignmentReviewId(null);
          }}
        />
      ) : null}
      {overrideReviewId ? (
        <OverrideDialog
          onClose={() => setOverrideReviewId(null)}
          onOverride={(reason) => {
            actions.overrideLock(overrideReviewId, reason);
            setOverrideReviewId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ManagerExportButton({
  label,
  filename,
  rows,
  format = "csv"
}: {
  label: string;
  filename: string;
  rows: Record<string, unknown>[];
  format?: "csv" | "json";
}) {
  return (
    <Button onClick={() => downloadFile(filename, format === "json" ? JSON.stringify(rows, null, 2) : toCsv(rows))}>
      <Download size={14} />
      {label}
    </Button>
  );
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "No rows";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(","))].join("\n");
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: filename.endsWith(".json") ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AssignmentDialog({
  review,
  users,
  maps,
  onAssign,
  onClose
}: {
  review: PatientReview;
  users: User[];
  maps: {
    users: Map<string, User>;
    clinics: Map<string, { id: string; name: string; defaultAssigneeId: string }>;
  };
  onAssign: (assignedUserId: string, mode: AssignmentMode, reason?: string) => void;
  onClose: () => void;
}) {
  const clinic = maps.clinics.get(review.clinicId);
  const [assignedUserId, setAssignedUserId] = useState(review.assignedUserId ?? users[0]?.id ?? "");
  const [mode, setMode] = useState<AssignmentMode>("Coverage");
  const [reason, setReason] = useState("");
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Assignment dialog">
      <div className="modal">
        <header>
          <h2>Assign Review</h2>
          <CloseDialogButton onClick={onClose} />
        </header>
        <div className="modal-body">
          <div className="assignment-context">
            <span>Current assignee: {maps.users.get(review.assignedUserId)?.name ?? "Unassigned"}</span>
            <span>Clinic default: {clinic ? maps.users.get(clinic.defaultAssigneeId)?.name : "None"}</span>
          </div>
          <label>
            Proposed assignee
            <select value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
              {users
                .filter((user) => user.roles.includes("CDI/Coder"))
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Assignment type
            <select value={mode} onChange={(event) => setMode(event.target.value as AssignmentMode)}>
              <option>Coverage</option>
              <option>Permanent reassignment</option>
            </select>
          </label>
          <label>
            Optional reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason recorded in activity history" />
          </label>
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => onAssign(assignedUserId, mode, reason)}>Save assignment</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverrideDialog({ onOverride, onClose }: { onOverride: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Override lock dialog">
      <div className="modal">
        <header>
          <h2>Override Lock</h2>
          <CloseDialogButton onClick={onClose} />
        </header>
        <div className="modal-body">
          <label>
            Override reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required lock override reason" />
          </label>
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!reason.trim()} onClick={() => onOverride(reason)}>Confirm override</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
