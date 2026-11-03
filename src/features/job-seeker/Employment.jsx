import { useEffect, useState } from "react";
import useAuth from "../../shared/hooks/useAuth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { listEmployment } from "../../shared/services/seekers";
import { SectionCard } from "../../shared/components/dashboard";
import ApplicantsShell from "../../shared/components/ApplicantsShell";

function Employment() {
  const { user } = useAuth();
  const [employments, setEmployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

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
    (statusFilter === "all" || (statusFilter === "current" ? e.is_current : !e.is_current)) &&
    (!search || (e.employer_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.position || "").toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    if (sortBy === "oldest") return new Date(a.updated_at || a.start_date) - new Date(b.updated_at || b.start_date);
    if (sortBy === "name") return (a.employer_name || "").localeCompare(b.employer_name || "");
    return new Date(b.updated_at || b.start_date) - new Date(a.updated_at || a.start_date);
  });

  const summaryTiles = [
    { id: "all", label: "Total", value: employments.length, hint: "All employment records", title: "Show all employment records", tone: "bg-primary/5 border-primary/40 text-primary" },
    { id: "current", label: "Current", value: currentCount, hint: "Currently employed", title: "Show current employment", tone: "bg-emerald-100 border-emerald-400 text-emerald-900" },
    { id: "past", label: "Past", value: employments.length - currentCount, hint: "Past employment", title: "Show past employment", tone: "bg-purple-100 border-purple-400 text-purple-900" },
  ];

  return (
    <ApplicantsShell
      title="Employment"
      subtitle="Your current and past employment records"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by employer or position..."
      searchAriaLabel="Search employment"
      sort={sortBy}
      onSortChange={setSortBy}
      sortOptions={[
        { value: "newest", label: "Newest First" },
        { value: "oldest", label: "Oldest First" },
        { value: "name", label: "Name (A-Z)" },
      ]}
      sortAriaLabel="Sort employment"
      sidebar={
        <div className="space-y-3">
          {summaryTiles.map((tile) => (
            <button key={tile.id} type="button" data-tone={tile.id === "current" ? "success" : tile.id === "past" ? "purple" : "info"} onClick={() => toggleFilter(tile.id)} aria-pressed={statusFilter === tile.id} title={tile.title}
              className={`w-full text-left rounded-lg border px-4 py-3 cursor-pointer transition-all ${tile.tone} ${statusFilter === tile.id ? "ring-1 ring-offset-0 ring-current" : ""}`}>
              <p className="text-2xl md:text-3xl font-bold leading-none">{tile.value}</p>
              <p className="mt-2 font-mono text-[11px] tracking-widest uppercase font-bold">{tile.label}</p>
              <p className="mt-1 text-xs italic opacity-80">{tile.hint}</p>
            </button>
          ))}
        </div>
      }
    >
      {employments.length === 0 ? (
        <SectionCard title="Employment Record" subtitle="Accepted applications and employment records will appear here">
          <div className="py-8 text-center">
            <p className="text-base text-muted-foreground">No employment records yet.</p>
          </div>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard title="Employment Record" subtitle="No records match this filter">
          <div className="py-8 text-center text-sm text-muted-foreground">
            No employment records match this filter.{" "}
            <button onClick={() => setStatusFilter("all")} className="text-primary hover:underline underline-offset-4 font-medium">Clear filter</button>
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((employment) => (
            <SectionCard
              key={employment.id}
              title={employment.employer_name}
              subtitle={employment.position}
              action={
                <span className={`shrink-0 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border ${
                  employment.is_current ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-muted border-border text-muted-foreground"
                }`}>
                  {employment.is_current ? "Current" : "Past"}
                </span>
              }
            >
              <div className="space-y-2 text-xs text-muted-foreground italic">
                {employment.start_date && <p>Started on {new Date(employment.start_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>}
                {employment.end_date && <p>Ended on {new Date(employment.end_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </ApplicantsShell>
  );
}

export default Employment;
