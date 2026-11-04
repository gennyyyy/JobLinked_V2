import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import useAuth from "@/shared/hooks/useAuth";
import { PageSkeleton } from '@/shared/components/Skeletons';
import { listEmployment } from "@/shared/services/seekers";
import { SectionCard } from "@/shared/components/dashboard";
import { EmptyState } from "@/shared/components/design";
import ApplicantsShell from "@/shared/components/ApplicantsShell";

const TILE_TONES = {
  all: "border-primary/15 bg-blue-soft text-primary",
  current: "border-success/20 bg-success-soft text-success",
  past: "border-border bg-muted text-muted-foreground",
};

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

  if (loading) return <PageSkeleton stats={0} panels={1} />;
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
    { id: "all", label: "Total", value: employments.length, hint: "All employment records", title: "Show all employment records" },
    { id: "current", label: "Current", value: currentCount, hint: "Currently employed", title: "Show current employment" },
    { id: "past", label: "Past", value: employments.length - currentCount, hint: "Past employment", title: "Show past employment" },
  ];

  return (
    <ApplicantsShell
      eyebrow="Beyond the hiring journey"
      title="Employment Tracking"
      subtitle="Linked employment records, recorded milestones, and accountable updates. Separate from recruitment."
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
        <>
          {summaryTiles.map((tile) => {
            const selected = statusFilter === tile.id;
            return (
              <Button
                key={tile.id}
                type="button"
                onClick={() => toggleFilter(tile.id)}
                aria-pressed={selected}
                title={tile.title}
                className={`w-full justify-start rounded-xl px-4 py-3 text-left ${TILE_TONES[tile.id]} ${selected ? "ring-2 ring-current" : ""}`}
              >
                <span className="flex min-w-0 flex-col items-start">
                  <span className="text-3xl font-semibold leading-none">{tile.value}</span>
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-[.08em]">{tile.label}</span>
                  <span className="mt-1 text-[10px] font-normal opacity-80">{tile.hint}</span>
                </span>
              </Button>
            );
          })}
        </>
      }
    >
      {employments.length === 0 ? (
        <SectionCard title="Employment record" subtitle="Accepted applications and employment records will appear here">
          <EmptyState
            title="No employment records yet."
            description="When a verified employer confirms a hire, the linked employment record appears here."
          />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard title="Employment record" subtitle="No records match this filter">
          <EmptyState
            title="No employment records match this filter."
            description="Try another search or clear the filter to see every record."
            action={<Button type="button" variant="outline" onClick={() => setStatusFilter("all")}>Clear filter</Button>}
          />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {filtered.map((employment) => (
            <SectionCard
              key={employment.id}
              title={employment.employer_name}
              subtitle={employment.position}
              action={
                <Badge variant="secondary" className={employment.is_current ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}>
                  {employment.is_current ? "Current" : "Past"}
                </Badge>
              }
            >
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
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
