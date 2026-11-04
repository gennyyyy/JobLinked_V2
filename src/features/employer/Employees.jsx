import { Button } from "../../components/ui/button";
import { useState, useEffect, useMemo } from "react";
import {
  UserMinus,
  UserPlus,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { listByCompany, updateApplicationStatus } from "../../shared/services/applications";
import { PageSkeleton } from '../../shared/components/Skeletons';
import SeekerProfileCard from "../../shared/components/SeekerProfileCard";
import ApplicantsShell from "../../shared/components/ApplicantsShell";
import { EmptyState } from "../../shared/components/design";

const EMPLOYEE_STATUSES = ["Accepted", "Terminated"];

const TILES = [
  { key: "all", label: "Total", title: "Show all employees", tone: "border-border bg-blue-soft text-primary" },
  { key: "active", label: "Active", title: "Show active employees", tone: "border-border bg-success-soft text-success" },
  { key: "terminated", label: "Terminated", title: "Show terminated employees", tone: "border-border bg-secondary text-muted-foreground" },
];

function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!user) return;
    // user.id IS the employers row id — no separate lookup needed
    listByCompany(user.id)
      .then((list) => setEmployees((list || []).filter((a) => EMPLOYEE_STATUSES.includes(a.status))))
      .catch((err) => setError(err.message || "Failed to load employees"))
      .finally(() => setLoading(false));
  }, [user]);

  async function setStatus(id, status) {
    try {
      const updated = await updateApplicationStatus(id, status);
      if (updated) {
        // Re-apply the employee filter so Terminate/Reactivate updates the list correctly
        setEmployees((prev) =>
          prev.map((e) => (e.id === id ? { ...e, ...updated, status } : e))
            .filter((e) => EMPLOYEE_STATUSES.includes(e.status))
        );
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const active = useMemo(() => employees.filter((e) => e.status === "Accepted").length, [employees]);
  const terminated = useMemo(() => employees.filter((e) => e.status === "Terminated").length, [employees]);
  const totals = { all: employees.length, active, terminated };

  // Credentials are fetched by SeekerProfileCard itself once the row expands.
  function toggleProfile(employee) {
    setExpandedId((prev) => (prev === employee.id ? null : employee.id));
  }

  if (loading) return <PageSkeleton stats={0} panels={2} />;

  if (error) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger-soft p-4 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">Couldn't load employees</p>
          <p className="mt-0.5 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  const toggleFilter = (next) => setStatusFilter((prev) => (prev === next ? "all" : next));
  const filtered = employees
    .filter((e) =>
      (statusFilter === "all" || (statusFilter === "active" ? e.status === "Accepted" : e.status === "Terminated")) &&
      (!search || e.seeker?.full_name?.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.updated_at) - new Date(b.updated_at);
      if (sortBy === "name") return (a.seeker?.full_name || "").localeCompare(b.seeker?.full_name || "");
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

  const hasActiveFilters = statusFilter !== "all" || search.trim() !== "";
  const clearFilters = () => { setStatusFilter("all"); setSearch(""); };

  return (
    <ApplicantsShell
      title="Employees"
      subtitle="Accepted applicants become employees and move out of the application tracker"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by employee name..."
      searchAriaLabel="Search employees"
      sort={sortBy}
      onSortChange={setSortBy}
      sortAriaLabel="Sort employees"
      sortOptions={[
        { value: "newest", label: "Newest First" },
        { value: "oldest", label: "Oldest First" },
        { value: "name", label: "Name (A-Z)" },
      ]}
      sidebar={
        <div className="space-y-3">
          {TILES.map((tile) => (
            <Button
              key={tile.key}
              type="button"
              data-tone={tile.key === "active" ? "success" : tile.key === "terminated" ? "neutral" : "info"}
              onClick={() => toggleFilter(tile.key)}
              aria-pressed={statusFilter === tile.key}
              title={tile.title}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-all ${tile.tone} ${statusFilter === tile.key ? "ring-1 ring-current ring-offset-0" : ""}`}
            >
              <p className="text-2xl font-bold">{totals[tile.key]}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">{tile.label}</p>
            </Button>
          ))}
        </div>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          title={employees.length === 0 ? "No employees yet" : "No employees match your filters"}
          description={
            employees.length === 0
              ? "Candidates you accept in the applicant tracker will appear here."
              : "Try adjusting your search or status filter to find employees."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters} className="text-xs">
                Clear all filters
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((emp) => (
            <article key={emp.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{emp.seeker?.full_name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{emp.seeker?.email}</p>
                </div>
                {emp.status === "Accepted" ? (
                  <Button variant="outline" title="Terminate employee" onClick={() => setStatus(emp.id, "Terminated")} className="shrink-0 gap-1.5 border-danger/20 bg-danger-soft text-xs text-destructive">
                    <UserMinus className="size-3.5" />
                    Terminate
                  </Button>
                ) : (
                  <Button variant="outline" title="Reactivate employee" onClick={() => setStatus(emp.id, "Accepted")} className="shrink-0 gap-1.5 border-success/20 bg-success-soft text-xs text-success">
                    <UserPlus className="size-3.5" />
                    Reactivate
                  </Button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Position</p>
                  <p className="mt-1 truncate text-xs font-medium text-navy">{emp.job?.title}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Status</p>
                  <p className="mt-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${emp.status === "Accepted" ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground"}`}>
                      {emp.status === "Accepted" ? "Active" : emp.status}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Hired</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {new Date(emp.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>

              <button type="button" aria-expanded={expandedId === emp.id} onClick={() => toggleProfile(emp)} className="text-link mt-3 text-xs">
                {expandedId === emp.id ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {expandedId === emp.id ? "Hide profile" : "View profile"}
              </button>

              {expandedId === emp.id && (
                <div className="mt-3"><SeekerProfileCard applicant={emp} /></div>
              )}
            </article>
          ))}
        </div>
      )}
    </ApplicantsShell>
  );
}

export default Employees;
