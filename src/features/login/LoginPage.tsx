import { LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../state/AppState";
import { Button, Panel, StatusChip } from "../../ui/Primitives";
import type { Role } from "../../domain/types";

const roleTone: Record<Role, "neutral" | "good" | "warn" | "bad" | "info" | "purple"> = {
  Administrator: "purple",
  Manager: "info",
  Auditor: "warn",
  "CDI/Coder": "good"
};

export function LoginPage() {
  const { data, currentUserId, setCurrentUserId } = useAppState();
  const navigate = useNavigate();

  return (
    <div className="page-stack">
      <Panel
        title="Simulated Login"
        actions={
          <Button variant="primary" onClick={() => navigate("/queue")}>
            <LogIn size={16} />
            Continue to queue
          </Button>
        }
      >
        <div className="login-grid">
          {data.users.map((user) => (
            <button
              key={user.id}
              className={`login-card ${currentUserId === user.id ? "selected" : ""}`}
              onClick={() => setCurrentUserId(user.id)}
              type="button"
            >
              <div>
                <strong>{user.name}</strong>
                <span>{data.teams.find((team) => team.id === user.teamId)?.name}</span>
              </div>
              <div className="chip-row">
                {user.roles.map((role) => (
                  <StatusChip key={role} tone={roleTone[role]}>
                    {role}
                  </StatusChip>
                ))}
              </div>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Prototype Boundaries">
        <div className="note-grid">
          <div>
            <strong>No production authentication</strong>
            <p>Switching users changes visible permissions and workflow behavior only inside this local prototype.</p>
          </div>
          <div>
            <strong>No clinical AI dependency</strong>
            <p>Recommendations come from centralized TypeScript rules and pre-seeded synthetic examples.</p>
          </div>
          <div>
            <strong>No PHI</strong>
            <p>All patients, payers, providers, claims, and evidence passages are deterministic synthetic data.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
