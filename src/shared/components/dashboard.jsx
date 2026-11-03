import { Button } from "../../components/ui/button";
// Shared building blocks for the three portal dashboards so headers, stat
// cards, and section cards stay visually identical everywhere.
import { AlertTriangle } from "lucide-react";
import { displayName, initialsOf } from "../utils/accountName";

export function PageHeader({ eyebrow, title, subtitle, action, logo, className = "" }) {
  return (
    <header className={`rounded-lg bg-navy p-5 md:p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0 flex items-center gap-4">
        {logo ? <div className="shrink-0">{logo}</div> : null}
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent">{eyebrow}</p>
          <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-white/80 max-w-2xl">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </header>
  );
}

// The one load-error treatment (role=alert + danger token); replaces three
// different variants across the portals.
export function InlineError({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger-subtle p-4 text-sm text-danger">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 transition-colors cursor-pointer"
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}

// Optional semantic tone (ADR-033 §1). Leaving `tone` unset renders the plain
// white card exactly as before, so the employer and super-admin portals are
// unaffected.
const STAT_TONES = {
  info: { card: "bg-blue-soft border-border", text: "text-primary" },
  success: { card: "bg-success-soft border-border", text: "text-success" },
  danger: { card: "bg-danger-soft border-border", text: "text-destructive" },
  warn: { card: "bg-warning-soft border-border", text: "text-warning" },
};

export function StatCard({ label, value, highlight, icon, valueClassName = "text-navy", tone }) {
  const themed = STAT_TONES[tone];
  const valueText = themed ? themed.text : valueClassName;
  const iconText = themed ? themed.text : "text-primary";
  return (
    <div className={`${themed ? themed.card : "surface"} rounded-xl border p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon ? <span className={`grid place-items-center ${iconText}`}>{icon}</span> : null}
      </div>
      <p className={`mt-3 text-[29px] font-semibold leading-none tracking-tight ${valueText}`}>{value}</p>
      {highlight ? <span className="mt-3 inline-block size-2 rounded-full bg-warning" /> : null}
    </div>
  );
}

// Time-based greeting banner with an initials avatar (ADR-033 §2, ADR-032 §5:
// the avatar is initials because no avatar column exists and browser-side
// storage is prohibited).
export function DashboardHero({ user, fallback = "Job Seeker", initialsFallback = "U", subtitle }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning!" : hour < 18 ? "Good Afternoon!" : "Good Evening!";
  return (
    <section className="flex items-center gap-4 rounded-xl bg-navy p-5 md:p-6 shadow-md">
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-white bg-card shadow-md md:h-20 md:w-20">
        <span className="text-2xl font-bold text-primary">{initialsOf(user, initialsFallback)}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm md:text-base font-semibold text-white/85">{greeting}</p>
        <h2 className="truncate text-xl md:text-2xl font-bold text-white uppercase">{displayName(user, fallback).toUpperCase()}</h2>
        {subtitle ? <p className="mt-1 text-xs text-white/70">{subtitle}</p> : null}
      </div>
    </section>
  );
}

export function SectionCard({ title, subtitle, action, children, className = "", titleAs = "h2" }) {
  const TitleTag = titleAs;
  return (
    <section className={`surface overflow-hidden rounded-2xl ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <TitleTag className="truncate text-base font-semibold text-navy">{title}</TitleTag>
            {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// Prev/next footer for the paginated admin lists ({ data, total, page,
// pageSize } envelopes). Renders nothing while everything fits on one page —
// so small datasets (and tests with short fixtures) see no UI change.
export function Pager({ page, pageSize, total, onChange }) {
  if (!total || !pageSize || total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-2">
        <Button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-xl border border-border bg-card px-3 py-1.5 cursor-pointer disabled:opacity-40">Previous</Button>
        <Button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-xl border border-border bg-card px-3 py-1.5 cursor-pointer disabled:opacity-40">Next</Button>
      </div>
    </div>
  );
}
