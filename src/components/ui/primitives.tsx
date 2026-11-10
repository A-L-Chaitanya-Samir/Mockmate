import type { ReactNode, ComponentProps } from "react";
import { Check, Info, ArrowUpRight, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/mode";
export function Panel({
  children,
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section className={cn("panel", className)} {...props}>
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "amber" | "muted";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("demo-notice", compact && "demo-compact")}>
      <Info size={14} />
      <span>
        {!DEMO_MODE ? "Phase 2 · External AI processes resume excerpts and interview text. Coding, voice, video and payments are future features." : compact
          ? "Demo workspace · simulated insights"
          : "Demo experience. Scores, feedback, AI responses, and code execution are simulated. Your media stays on your device."}
      </span>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="text-muted mt-2 max-w-2xl">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function ScoreRing({
  score,
  label = "Overall score",
  size = 140,
}: {
  score: number;
  label?: string;
  size?: number;
}) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className="score-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${score} out of 100`}
    >
      <svg viewBox="0 0 110 110" aria-hidden="true">
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="7"
        />
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
        />
      </svg>
      <div>
        <strong>
          {score}
          <span>%</span>
        </strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
export function Progress({
  value,
  label,
  tone = "blue",
}: {
  value: number;
  label: string;
  tone?: "blue" | "green";
}) {
  return (
    <div className="progress-group">
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium">{Math.round(value)}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className={tone === "green" ? "bg-success" : "bg-primary"}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
}) {
  return (
    <Panel className="metric">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted">{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="text-xs text-muted flex items-center gap-1">
        <ArrowUpRight size={13} className="text-success" />
        {note}
      </span>
    </Panel>
  );
}
export function CheckList({
  items,
  warning = false,
}: {
  items: string[];
  warning?: boolean;
}) {
  return (
    <ul className="check-list">
      {items.map((item) => (
        <li key={item}>
          {warning ? (
            <Info size={16} className="text-warning" />
          ) : (
            <Check size={16} className="text-success" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="text-muted">{hint}</small>}
      {error && (
        <small className="text-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p className="text-muted max-w-md">{description}</p>
      {action}
    </div>
  );
}
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <LoaderCircle size={16} className="animate-spin" />
      {label}
    </span>
  );
}
export function Skeleton() {
  return (
    <div
      className="space-y-5 animate-pulse"
      aria-label="Loading page"
      role="status"
    >
      <div className="h-9 w-56 rounded-lg bg-surface" />
      <div className="grid sm:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-surface" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-surface" />
    </div>
  );
}
