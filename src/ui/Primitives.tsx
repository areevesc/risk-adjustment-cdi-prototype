import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Bot, CheckCircle2, Circle, CircleHelp, FileText, Lock, Sparkles, X, XCircle } from "lucide-react";
import type { Category, ProspectiveSubtype, Recommendation, AppSettings } from "../domain/types";
import { categoryTokens, subtypeTokens } from "../domain/tokens";
import { decisionSupportService } from "../decisionSupport/DecisionSupportService";

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return (
    <button className={`button button-${variant}${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </button>
  );
}

export function CloseDialogButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="icon-button modal-close-button" onClick={onClick} aria-label="Close dialog" title="Close dialog">
      <X size={18} aria-hidden="true" />
    </button>
  );
}

export function Dialog({ title, ariaLabel = title, children, onClose }: { title: string; ariaLabel?: string; children: ReactNode; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    priorFocusRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const firstControl = container?.querySelector<HTMLElement>("[autofocus]")
      ?? container?.querySelector<HTMLElement>(".modal-body input:not(:disabled), .modal-body select:not(:disabled), .modal-body textarea:not(:disabled), .modal-body button:not(:disabled)")
      ?? container?.querySelector<HTMLElement>("button:not(:disabled)");
    firstControl?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const controls = Array.from(container.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      priorFocusRef.current?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={containerRef} className="modal" role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <header>
          <h2>{title}</h2>
          <CloseDialogButton onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Panel({ title, actions, children, className = "" }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-header">
          {title ? <h2>{title}</h2> : <span />}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" | "purple" }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function CategoryBadge({ category, subtype, count }: { category: Category; subtype?: ProspectiveSubtype; count?: number }) {
  const token = subtype ? subtypeTokens[subtype] : categoryTokens[category];
  return (
    <span className="category-badge" style={{ color: token.color, background: token.bg, borderColor: token.border }}>
      <Circle size={8} fill="currentColor" />
      {token.label}
      {typeof count === "number" ? <strong>{count}</strong> : null}
    </span>
  );
}

export function RecommendationBox({
  recommendation,
  settings
}: {
  recommendation: Recommendation | undefined;
  settings: AppSettings;
}) {
  if (!recommendation) return <div className="recommendation muted">Recommendation assistance is hidden or unavailable for this condition.</div>;
  const label = settings.recommendationMode === "simulated" ? `AI recommends ${recommendation.action}` : decisionSupportService.getDisplayLabel(recommendation, settings);
  const Icon = recommendation.source === "seeded" ? Sparkles : Bot;
  return (
    <div className="recommendation">
      <div className="recommendation-title">
        <Icon size={16} />
        <span>{label}</span>
        <StatusChip tone={recommendation.confidence === "High" ? "good" : recommendation.confidence === "Medium" ? "info" : "warn"}>{recommendation.confidence}</StatusChip>
      </div>
      <strong>{recommendation.action}</strong>
      {recommendation.replacementCode ? (
        <span className="mono">{recommendation.action === "Change" ? "Replacement" : "More specific option"}: {recommendation.replacementCode}</span>
      ) : null}
      <p>{recommendation.rationale}</p>
    </div>
  );
}

export function IconForStatus({ status }: { status: string }) {
  if (status.includes("Complete")) return <CheckCircle2 size={15} />;
  if (status.includes("Audit") || status.includes("Review")) return <CircleHelp size={15} />;
  if (status.includes("Pended")) return <AlertTriangle size={15} />;
  if (status.includes("Progress")) return <Lock size={15} />;
  return <FileText size={15} />;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <XCircle size={22} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
