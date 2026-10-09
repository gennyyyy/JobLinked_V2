// Shared building blocks for the three portal dashboards so headers, stat
// cards, and section cards stay visually identical everywhere.

export function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <header className="rounded-lg bg-dark-blue p-5 md:p-6 text-white">
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent">{eyebrow}</p>
      <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-white/80 max-w-2xl">{subtitle}</p> : null}
    </header>
  );
}

export function StatCard({ label, value, highlight, icon }) {
  return (
    <div className="bg-white border border-primary rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-2xl md:text-3xl font-bold text-primary leading-none">{value}</p>
          <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-gray-500 uppercase">{label}</p>
        </div>
        {icon ? <span className="grid place-items-center w-10 h-10 rounded-lg bg-primary-subtle text-primary">{icon}</span> : null}
      </div>
      {highlight ? <span className="inline-block mt-3 w-2 h-2 rounded-full bg-amber-400" /> : null}
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`bg-white border border-primary rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-1 h-6 bg-primary rounded-full shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-dark-blue truncate">{title}</h2>
            {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
