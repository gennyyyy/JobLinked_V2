import { Button } from "../../components/ui/button";
// Shared building blocks for the three portal dashboards so headers, stat
// cards, and section cards stay visually identical everywhere.
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

// The one load-error treatment (role=alert + danger token); replaces three
// different variants across the portals.
export function InlineError({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger-soft p-4 text-sm text-destructive">
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
export function Pager({ page, pageSize, total, onChange, align = 'between' }) {
  // Reference list pagination: "1–8 of 26 records" plus icon prev/next.
  const pages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)))
  const current = Math.min(page || 1, pages)
  return (
    <div className={`flex flex-wrap items-center ${align === 'center' ? 'justify-center' : 'justify-between'} gap-3 pt-4 text-xs text-muted-foreground`}>
      <p aria-live="polite">
        {total ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, total)} of ${total} records` : 'No records'}
      </p>
      <nav aria-label="Results pagination" className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous page" disabled={current <= 1} onClick={() => onChange(current - 1)}>
          <ChevronLeft />
        </Button>
        <span className="px-2">{current} / {pages}</span>
        <Button variant="outline" size="icon" aria-label="Next page" disabled={current >= pages} onClick={() => onChange(current + 1)}>
          <ChevronRight />
        </Button>
      </nav>
    </div>
  )
}
