import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BarChart3, ClipboardList, Database, FileCheck2, Settings, ShieldCheck, Users } from "lucide-react";
import { useAppState } from "./state/AppState";
import { LoginPage } from "./features/login/LoginPage";
import { QueuePage } from "./features/queue/QueuePage";
import { ReviewPage } from "./features/review/ReviewPage";
import { AuditPage } from "./features/audit/AuditPage";
import { ManagerPage } from "./features/dashboard/ManagerPage";
import { AdminPage } from "./features/admin/AdminPage";
import { Button, StatusChip } from "./ui/Primitives";

export function App() {
  const { currentUser, resetDemo } = useAppState();
  const location = useLocation();

  if (location.pathname === "/") return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark">RA</div>
          <div>
            <strong>Risk/CDI</strong>
            <span>Prototype</span>
          </div>
        </div>
        <nav>
          <NavLink to="/login">
            <ShieldCheck size={18} />
            Login
          </NavLink>
          <NavLink to="/queue">
            <ClipboardList size={18} />
            Work Queue
          </NavLink>
          <NavLink to="/audit">
            <FileCheck2 size={18} />
            Audit
          </NavLink>
          <NavLink to="/manager">
            <BarChart3 size={18} />
            Manager
          </NavLink>
          <NavLink to="/admin">
            <Settings size={18} />
            Admin
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <StatusChip tone="info">{currentUser.primaryRole}</StatusChip>
          <strong>{currentUser.name}</strong>
          <Button variant="ghost" onClick={resetDemo}>
            <Database size={16} />
            Reset demo
          </Button>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div>
            <h1>Risk Adjustment Coding/CDI Platform</h1>
            <p>Functional prototype using deterministic rules, seeded evidence, and simulated recommendations.</p>
          </div>
          <div className="topbar-meta">
            <Users size={18} />
            <span>{currentUser.name}</span>
          </div>
        </header>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/review/:reviewId" element={<ReviewPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/manager" element={<ManagerPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
