import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LockKeyhole, UserCheck } from "lucide-react";
import { useAppState } from "../../state/AppState";
import { byId, canManageLocks, getActionTotals, getReviewStatusTotals, getTeamStats } from "../../domain/selectors";
import { formatRaf } from "../../domain/format";
import { Button, Panel, StatusChip } from "../../ui/Primitives";

const chartColors = ["#1264b3", "#087f5b", "#b42318", "#6d55d8", "#8a5a00", "#64748b"];

export function ManagerPage() {
  const { data, currentUser, actions } = useAppState();
  const [selectedAssignee, setSelectedAssignee] = useState("u-coder-1");
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
                      <select value={selectedAssignee} onChange={(event) => setSelectedAssignee(event.target.value)} aria-label="Assignee">
                        {data.users
                          .filter((user) => user.roles.includes("Coder") || user.roles.includes("CDI Specialist"))
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                      </select>
                      <Button disabled={!canManageLocks(currentUser)} onClick={() => actions.assignReview(review.id, selectedAssignee)}>
                        <UserCheck size={14} />
                        Assign
                      </Button>
                      {review.lock ? (
                        <Button disabled={!canManageLocks(currentUser)} onClick={() => actions.overrideLock(review.id, "Manager override from assignment dashboard.")}>
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
    </div>
  );
}
