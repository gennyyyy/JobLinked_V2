// Shared building blocks for the three portal dashboards so headers, stat
// cards, and section cards stay visually identical everywhere.
import { AlertTriangle } from "lucide-react";

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="rounded-lg bg-dark-blue p-5 md:p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent">{eyebrow}</p>
        <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-white/80 max-w-2xl">{subtitle}</p> : null}
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
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 transition-colors cursor-pointer"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function StatCard({ label, value, highlight, icon, valueClassName = "text-primary" }) {
  return (
    <div className="bg-white border border-primary rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-sans text-2xl md:text-3xl font-bold leading-none ${valueClassName}`}>{value}</p>
          <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-gray-500 uppercase">{label}</p>
        </div>
        {icon ? <span className="grid place-items-center w-10 h-10 rounded-lg bg-primary-subtle text-primary">{icon}</span> : null}
      </div>
      {highlight ? <span className="inline-block mt-3 w-2 h-2 rounded-full bg-amber-400" /> : null}
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children, className = "", titleAs = "h2" }) {
  const TitleTag = titleAs;
  return (
    <section className={`bg-white border border-primary rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-1 h-6 bg-primary rounded-full shrink-0" />
          <div className="min-w-0">
            <TitleTag className="text-base font-semibold text-dark-blue truncate">{title}</TitleTag>
            {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
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
    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
      <span>Page {page} of {pages}</span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 cursor-pointer disabled:opacity-40">Previous</button>
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 cursor-pointer disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
