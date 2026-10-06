// Shared building blocks for the three portal dashboards so headers, stat
// cards, and section cards stay visually identical everywhere.

export function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <header className="relative overflow-hidden rounded-2xl bg-dark-blue p-6 md:p-8 text-white shadow-md animate-fade-in">
      <p className="relative font-mono text-[11px] tracking-[0.2em] uppercase text-accent">{eyebrow}</p>
      <h1 className="relative mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="relative mt-2 text-sm text-white/80 max-w-2xl">{subtitle}</p> : null}
    </header>
  );
}

export function StatCard({ label, value, highlight, icon }) {
  return (
    <div className="relative overflow-hidden bg-white border-2 border-primary rounded-2xl p-5 shadow-sm hover-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-sans text-3xl md:text-4xl font-bold text-primary leading-none">{value}</p>
          <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-gray-500 uppercase">{label}</p>
        </div>
        {icon ? <span className="grid place-items-center w-10 h-10 rounded-xl bg-primary-subtle text-primary">{icon}</span> : null}
      </div>
      {highlight ? <span className="inline-block mt-3 w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> : null}
    </div>
  );
}

export function StatGrid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{children}</div>;
}

export function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`bg-white border-2 border-primary rounded-2xl shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-1 h-6 bg-primary rounded-full shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-dark-blue truncate">{title}</h2>
            {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
