import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LockKeyhole, UserCheck } from "lucide-react";
import { useAppState } from "../../state/AppState";
import { byId, canManageLocks, getActionTotals, getReviewStatusTotals, getTeamStats } from "../../domain/selectors";
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
  const rafAverage = data.reviews.length
    ? data.reviews.reduce((sum, review) => {
        const patient = maps.patients.get(review.patientId);
        return sum + (patient?.demographicRaf ?? 0);
      }, 0) / data.reviews.length
    : 0;

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
              <span>Average demographic RAF</span>
              <strong>{formatRaf(rafAverage)}</strong>
            </div>
            <div className="stat">
              <span>Open reviews</span>
              <strong>{data.reviews.filter((review) => ["Available", "In Progress", "Pended", "Awaiting Review"].includes(review.status)).length}</strong>
            </div>
            <div className="stat">
              <span>Audit agreement rate</span>
              <strong>
                {Math.round((data.audits.filter((audit) => audit.outcome === "Agree").length / Math.max(1, data.audits.filter((audit) => audit.outcome).length)) * 100)}%
              </strong>
            </div>
          </div>
          <p className="raf-note">RAF reporting uses predetermined synthetic values and transparent prototype calculations.</p>
        </Panel>
      </div>

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
                  <td>{review.lock ? `Locked by ${maps.users.get(review.lock.lockedByUserId)?.name}` : "Unlocked"}</td>
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
    clinics: Map<string, { id: string; name: string; defaultCoderId: string; defaultCdiId: string }>;
  };
  onAssign: (assignedUserId: string, mode: AssignmentMode, reason?: string) => void;
  onClose: () => void;
}) {
  const clinic = maps.clinics.get(review.clinicId);
  const [assignedUserId, setAssignedUserId] = useState(review.assignedCoderId ?? review.assignedCdiId ?? users[0]?.id ?? "");
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
            <span>Current coder: {review.assignedCoderId ? maps.users.get(review.assignedCoderId)?.name : "Unassigned"}</span>
            <span>Current CDI specialist: {review.assignedCdiId ? maps.users.get(review.assignedCdiId)?.name : "Unassigned"}</span>
            <span>Clinic defaults: {clinic ? `${maps.users.get(clinic.defaultCoderId)?.name} / ${maps.users.get(clinic.defaultCdiId)?.name}` : "None"}</span>
          </div>
          <label>
            Proposed assignee
            <select value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
              {users
                .filter((user) => user.roles.includes("Coder") || user.roles.includes("CDI Specialist"))
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
