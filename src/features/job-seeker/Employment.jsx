import { useEffect, useState } from "react";
import useAuth from "../../shared/hooks/useAuth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { listEmployment } from "../../shared/services/seekers";

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
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  const currentCount = employments.filter((e) => e.is_current).length;
  const toggleFilter = (next) => setStatusFilter((prev) => (prev === next ? "all" : next));
  const filtered = employments.filter((e) =>
    statusFilter === "all" || (statusFilter === "current" ? e.is_current : !e.is_current)
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">EMPLOYMENT RECORD</p>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Employment</h1>
        <p className="mt-2 text-sm text-gray-500">Your current and past employment records</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button type="button" onClick={() => toggleFilter("all")} aria-pressed={statusFilter === "all"} title="Show all employment records"
          className={`rounded-2xl p-5 text-left cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] bg-white border ${statusFilter === "all" ? "border-primary ring-1 ring-primary/30" : "border-gray-200 hover:border-gray-300"}`}>
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Total</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{employments.length}</p>
          <p className="mt-1 text-xs text-gray-400">All employment records</p>
        </button>
        <button type="button" onClick={() => toggleFilter("current")} aria-pressed={statusFilter === "current"} title="Show current employment"
          className={`rounded-2xl p-5 text-left cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] bg-emerald-50 border ${statusFilter === "current" ? "border-emerald-600 ring-1 ring-emerald-600/30" : "border-emerald-200 hover:border-emerald-300"}`}>
          <p className="font-mono text-[10px] tracking-widest uppercase text-emerald-700">Current</p>
          <p className="mt-2 text-3xl font-bold text-emerald-800">{currentCount}</p>
          <p className="mt-1 text-xs text-emerald-700/70">Currently employed</p>
        </button>
        <button type="button" onClick={() => toggleFilter("past")} aria-pressed={statusFilter === "past"} title="Show past employment"
          className={`rounded-2xl p-5 text-left cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] bg-white border ${statusFilter === "past" ? "border-primary ring-1 ring-primary/30" : "border-gray-200 hover:border-gray-300"}`}>
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Past</p>
          <p className="mt-2 text-3xl font-bold text-gray-600">{employments.length - currentCount}</p>
          <p className="mt-1 text-xs text-gray-400">Past employment</p>
        </button>
      </div>

      {employments.length === 0 ? (
        <div className="py-16 text-center bg-white border-2 border-primary rounded-2xl p-8">
          <p className="text-base text-gray-600">No employment records yet.</p>
          <p className="mt-1 text-xs text-gray-400">Accepted applications and employment records will appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center bg-white border-2 border-primary rounded-2xl p-8 text-sm text-gray-400">
          No employment records match this filter.{" "}
          <button onClick={() => setStatusFilter("all")} className="text-primary hover:underline underline-offset-4 font-medium">Clear filter</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((employment) => (
            <article key={employment.id} className="bg-white border-2 border-primary rounded-2xl p-6 shadow-sm">
              <p className={`font-mono text-[10px] tracking-widest uppercase ${employment.is_current ? "text-emerald-700" : "text-gray-500"}`}>{employment.is_current ? "Currently employed" : "Past employment"}</p>
              <h2 className="mt-2 text-xl font-bold text-gray-900">{employment.employer_name}</h2>
              <p className="mt-1 text-sm font-medium text-gray-700">{employment.position}</p>
              <div className="mt-5 space-y-2 text-xs text-gray-500">
                {employment.start_date && <p>Started: {new Date(employment.start_date).toLocaleDateString()}</p>}
                {employment.end_date && <p>Ended: {new Date(employment.end_date).toLocaleDateString()}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default Employment;
