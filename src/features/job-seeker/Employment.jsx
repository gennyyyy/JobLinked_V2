import { useEffect, useState } from "react";
import useAuth from "../../shared/hooks/useAuth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { listEmployment } from "../../shared/services/seekers";
import { PageHeader, SectionCard } from "../../shared/components/dashboard";

function Employment() {
  const { user } = useAuth();
  const [employments, setEmployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    listEmployment()
      .then((rows) => setEmployments(rows || []))
      .catch((err) => setError(err.message || "Failed to load employment information"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  const currentCount = employments.filter((e) => e.is_current).length;
  const toggleFilter = (next) => setStatusFilter((prev) => (prev === next ? "all" : next));
  const filtered = employments.filter((e) =>
    statusFilter === "all" || (statusFilter === "current" ? e.is_current : !e.is_current)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EMPLOYMENT RECORD"
        title="Employment"
        subtitle="Your current and past employment records"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { id: "all", label: "Total", value: employments.length, hint: "All employment records", title: "Show all employment records" },
          { id: "current", label: "Current", value: currentCount, hint: "Currently employed", title: "Show current employment" },
          { id: "past", label: "Past", value: employments.length - currentCount, hint: "Past employment", title: "Show past employment" },
        ].map((tile) => (
          <button key={tile.id} type="button" onClick={() => toggleFilter(tile.id)} aria-pressed={statusFilter === tile.id} title={tile.title}
            className={`rounded-lg p-4 text-left cursor-pointer transition-all hover: active:scale-[0.99] bg-white border ${statusFilter === tile.id ? "border-primary ring-1 ring-primary/30" : "border-primary hover:border-primary/60"}`}>
            <p className="font-sans text-2xl md:text-3xl font-bold text-primary leading-none">{tile.value}</p>
            <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-gray-500 uppercase">{tile.label}</p>
            <p className="mt-3 text-xs text-gray-400">{tile.hint}</p>
          </button>
        ))}
      </div>

      {employments.length === 0 ? (
        <SectionCard title="Employment Record" subtitle="Accepted applications and employment records will appear here">
          <div className="py-8 text-center">
            <p className="text-base text-gray-600">No employment records yet.</p>
          </div>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard title="Employment Record" subtitle="No records match this filter">
          <div className="py-8 text-center text-sm text-gray-400">
            No employment records match this filter.{" "}
            <button onClick={() => setStatusFilter("all")} className="text-primary hover:underline underline-offset-4 font-medium">Clear filter</button>
          </div>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((employment) => (
            <SectionCard
              key={employment.id}
              title={employment.employer_name}
              subtitle={employment.position}
              action={
                <span className={`shrink-0 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border ${
                  employment.is_current ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-100 border-gray-200 text-gray-500"
                }`}>
                  {employment.is_current ? "Current" : "Past"}
                </span>
              }
            >
              <div className="space-y-2 text-xs text-gray-500">
                {employment.start_date && <p>Started: {new Date(employment.start_date).toLocaleDateString()}</p>}
                {employment.end_date && <p>Ended: {new Date(employment.end_date).toLocaleDateString()}</p>}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}

export default Employment;
