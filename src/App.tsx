import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef } from "react";
import type { ElementType, ReactNode } from "react";
import { BarChart3, ClipboardList, Database, FileCheck2, LineChart, Settings, ShieldCheck, Users } from "lucide-react";
import { useAppState } from "./state/AppState";
import { Button, StatusChip } from "./ui/Primitives";
import { canAccessRoute, getFirstPermittedRoute, getRouteDenialMessage, routePathByKey, type AppRouteKey } from "./domain/auth";

const LoginPage = lazy(() => import("./features/login/LoginPage").then((module) => ({ default: module.LoginPage })));
const QueuePage = lazy(() => import("./features/queue/QueuePage").then((module) => ({ default: module.QueuePage })));
const MyStatsPage = lazy(() => import("./features/stats/MyStatsPage").then((module) => ({ default: module.MyStatsPage })));
const ReviewPage = lazy(() => import("./features/review/ReviewPage").then((module) => ({ default: module.ReviewPage })));
const AuditPage = lazy(() => import("./features/audit/AuditPage").then((module) => ({ default: module.AuditPage })));
const ManagerPage = lazy(() => import("./features/dashboard/ManagerPage").then((module) => ({ default: module.ManagerPage })));
const AdminPage = lazy(() => import("./features/admin/AdminPage").then((module) => ({ default: module.AdminPage })));

const navItems: { route: AppRouteKey; label: string; icon: ElementType }[] = [
  { route: "login", label: "Login", icon: ShieldCheck },
  { route: "queue", label: "Work Queue", icon: ClipboardList },
  { route: "stats", label: "My Stats", icon: LineChart },
  { route: "audit", label: "Audit", icon: FileCheck2 },
  { route: "manager", label: "Manager", icon: BarChart3 },
  { route: "admin", label: "Admin", icon: Settings }
];

export function App() {
  const { currentUser, resetDemo } = useAppState();
  const location = useLocation();
  const state = location.state as { authMessage?: string } | null;
  const lastPathname = useRef(location.pathname);

  useEffect(() => {
    if (lastPathname.current !== location.pathname) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      lastPathname.current = location.pathname;
    }
  }, [location.pathname]);

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
          {navItems
            .filter((item) => canAccessRoute(currentUser, item.route))
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.route} to={routePathByKey[item.route]}>
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
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
          <h1>Risk Adjustment Coding/CDI</h1>
          <div className="topbar-meta">
            <Users size={18} />
            <span>{currentUser.name}</span>
          </div>
        </header>
        {state?.authMessage ? <div className="auth-banner">{state.authMessage}</div> : null}
        <Suspense fallback={<div className="route-loading" role="status">Loading workspace…</div>}>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/queue"
            element={
              <ProtectedRoute route="queue">
                <QueuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review/:reviewId"
            element={
              <ProtectedRoute route="review">
                <ReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute route="stats">
                <MyStatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <ProtectedRoute route="audit">
                <AuditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ProtectedRoute route="manager">
                <ManagerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute route="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function ProtectedRoute({ route, children }: { route: AppRouteKey; children: ReactNode }) {
  const { currentUser } = useAppState();
  if (!canAccessRoute(currentUser, route)) {
    return <Navigate to={getFirstPermittedRoute(currentUser)} replace state={{ authMessage: getRouteDenialMessage(route) }} />;
  }
  return <>{children}</>;
}
