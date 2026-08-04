import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions actions-row">{actions}</div>}
    </header>
  );
}

export function SectionCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card section-card ${className}`.trim()}>
      {(eyebrow || title || description || actions) && (
        <div className="section-card-header">
          <div>
            {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="section-description">{description}</p>}
          </div>
          {actions && <div className="actions-row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  meta,
  icon = "activity",
  tone = "primary",
  href,
}: {
  label: string;
  value: string | number;
  meta?: string;
  icon?: IconName;
  tone?: "primary" | "teal" | "amber" | "violet";
  href?: string;
}) {
  const content = (
    <>
      <div className="stat-card-top">
        <span className={`stat-icon stat-icon-${tone}`}><Icon name={icon} size={17} /></span>
        {href && <Icon name="arrow-right" size={16} className="stat-arrow" />}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {meta && <p className="stat-meta">{meta}</p>}
    </>
  );

  return href ? <Link href={href} className="stat-card stat-card-link">{content}</Link> : <div className="stat-card">{content}</div>;
}

export function ProgressDisplay({
  label,
  value,
  max = 100,
  valueLabel,
  tone = "primary",
}: {
  label: string;
  value: number;
  max?: number;
  valueLabel?: string;
  tone?: "primary" | "teal" | "amber";
}) {
  const safeMax = Math.max(max, 1);
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return (
    <div className="progress-display">
      <div className="progress-label-row">
        <span>{label}</span>
        <strong>{valueLabel ?? `${Math.round(percentage)}%`}</strong>
      </div>
      <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={value}>
        <span className={`progress-fill progress-fill-${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "layers",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Icon name={icon} size={22} /></span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="actions-row empty-state-action">{action}</div>}
    </div>
  );
}

export function WorkflowStepper({
  steps,
}: {
  steps: Array<{ label: string; description: string; href: string; complete?: boolean; active?: boolean }>;
}) {
  return (
    <ol className="workflow-stepper">
      {steps.map((step, index) => (
        <li key={step.label} className={`workflow-step${step.complete ? " is-complete" : ""}${step.active ? " is-active" : ""}`}>
          <Link href={step.href} className="workflow-step-link">
            <span className="workflow-step-marker">{step.complete ? <Icon name="check" size={15} /> : index + 1}</span>
            <span className="workflow-step-copy"><strong>{step.label}</strong><small>{step.description}</small></span>
            <Icon name="chevron-right" size={16} className="workflow-step-arrow" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "ai" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
