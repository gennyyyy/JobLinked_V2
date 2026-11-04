import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

// Loading placeholders that occupy the same box as the content they replace.
// `surface` / `Card` / `SectionCard` are reused so padding, borders, and radius
// match the real components exactly — that is what keeps CLS at zero.
// Reduced motion is already handled globally in index.css (`prefers-reduced-motion`
// kills every animation), so the primitives keep plain `animate-pulse`.

function Busy({ label, className, children }) {
  return (
    <div aria-busy="true" className={className}>
      {label ? <span role="status" className="sr-only">{label}</span> : null}
      {children}
    </div>
  )
}

// One job card: logo mark, company + verified line, title, meta row, salary,
// description, and the "See more" link. `label` is null when a list owns the
// single status message, so a screen reader hears one announcement, not five.
export function JobCardSkeleton({ label = 'Loading job…' }) {
  return (
    <Busy label={label} className="surface p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-32 max-w-full" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <Skeleton className="h-2.5 w-16 shrink-0" />
      </div>
      <Skeleton className="mt-4 h-5 w-3/4" />
      <div className="mt-2 flex flex-wrap gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="mt-4 h-4 w-28" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-4 h-3.5 w-20" />
    </Busy>
  )
}

export function JobListSkeleton({ count = 4 }) {
  return (
    <Busy label="Loading jobs…" className="space-y-3">
      <ul className="space-y-3">
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <JobCardSkeleton label={null} />
          </li>
        ))}
      </ul>
    </Busy>
  )
}

// One `StatCards` tile from design.jsx.
export function StatCardSkeleton() {
  return (
    <div className="surface flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-[18px] rounded-md" />
      </div>
      <div>
        <Skeleton className="h-7 w-16" />
        <Skeleton className="mt-2 h-2.5 w-24" />
      </div>
    </div>
  )
}

export function StatRowSkeleton({ count = 4, label = 'Loading summary…' }) {
  return (
    <Busy label={label} className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => <StatCardSkeleton key={index} />)}
    </Busy>
  )
}

// A `Panel` (design.jsx) with its title, description, and body lines.
export function PanelSkeleton({ title = true, lines = 4, label = 'Loading panel…', className }) {
  return (
    <Busy label={label} className={className}>
      <Card>
        <CardHeader>
          {title ? <Skeleton className="h-4 w-40 max-w-full" /> : null}
          <CardDescription><Skeleton className="h-3 w-64 max-w-full" /></CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton key={index} className={index === lines - 1 ? 'h-3 w-2/3' : 'h-3 w-full'} />
          ))}
        </CardContent>
      </Card>
    </Busy>
  )
}

// A `SectionCard` holding a table: header strip, column heads, five body rows.
export function TableSkeleton({ columns = 5, rows = 5, title = 'Loading records…' }) {
  return (
    <Busy label={title} className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex gap-4">
          {Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="h-2.5 flex-1" />)}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex gap-4">
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={column} className={column === 0 ? 'h-3 flex-[1.4]' : 'h-3 flex-1'} />
            ))}
          </div>
        ))}
      </div>
    </Busy>
  )
}

// The whole page above the fold: heading (eyebrow / title / description), an
// optional stat row, then either a table or a stack of panels.
export function PageSkeleton({ stats = 0, panels = 1, table = false, label = 'Loading page…' }) {
  return (
    <Busy label={label} className="space-y-6">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <Skeleton className="mb-2 h-2.5 w-32" />
          <Skeleton className="h-8 w-full max-w-md md:h-9" />
          <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
          <Skeleton className="mt-1.5 h-3 w-2/3 max-w-md" />
        </div>
      </div>
      {stats > 0 ? <StatRowSkeleton count={stats} label={null} /> : null}
      {table ? (
        <TableSkeleton title={null} />
      ) : (
        <div className={panels > 1 ? 'grid gap-4 lg:grid-cols-2' : ''}>
          {Array.from({ length: panels }, (_, index) => <PanelSkeleton key={index} label={null} />)}
        </div>
      )}
    </Busy>
  )
}
