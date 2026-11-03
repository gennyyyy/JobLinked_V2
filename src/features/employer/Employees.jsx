import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Filter,
  UserMinus,
  UserPlus,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { listByCompany, updateApplicationStatus } from "../../shared/services/applications";
import LoadingScreen from "../../shared/components/LoadingScreen";
import SeekerProfileCard from "../../shared/components/SeekerProfileCard";
import ApplicantsShell from "../../shared/components/ApplicantsShell";
import SearchBar from "../../shared/components/SearchBar";

const EMPLOYEE_STATUSES = ["Accepted", "Terminated"];

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

  // Credentials are fetched by SeekerProfileCard itself once the row expands.
  function toggleProfile(employee) {
    setExpandedId((prev) => (prev === employee.id ? null : employee.id));
  }

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-rose-100 rounded-2xl p-5 flex items-start gap-3 shadow-[0_2px_16px_-8px_rgba(16,24,40,0.08)]">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Couldn't load employees</p>
            <p className="text-sm text-rose-600 mt-0.5">{error}</p>
          </div>
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
      sidebar={
        <>
          <div className="space-y-3">
            <button type="button" data-tone="info" onClick={() => toggleFilter("all")} aria-pressed={statusFilter === "all"} title="Show all employees"
              className={`w-full text-left rounded-lg border px-4 py-3 cursor-pointer transition-all border-blue-300 bg-blue-50 text-blue-700 ${statusFilter === "all" ? "ring-1 ring-offset-0 ring-current" : ""}`}>
              <p className="text-2xl font-bold">{employees.length}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">Total</p>
            </button>
            <button type="button" data-tone="success" onClick={() => toggleFilter("active")} aria-pressed={statusFilter === "active"} title="Show active employees"
              className={`w-full text-left rounded-lg border px-4 py-3 cursor-pointer transition-all border-emerald-300 bg-emerald-50 text-emerald-700 ${statusFilter === "active" ? "ring-1 ring-offset-0 ring-current" : ""}`}>
              <p className="text-2xl font-bold">{active}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">Active</p>
            </button>
            <button type="button" data-tone="neutral" onClick={() => toggleFilter("terminated")} aria-pressed={statusFilter === "terminated"} title="Show terminated employees"
              className={`w-full text-left rounded-lg border px-4 py-3 cursor-pointer transition-all border-gray-300 bg-gray-50 text-gray-700 ${statusFilter === "terminated" ? "ring-1 ring-offset-0 ring-current" : ""}`}>
              <p className="text-2xl font-bold">{terminated}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">Terminated</p>
            </button>
          </div>
        </>
      }
      controls={
        <div className="applicant-list-controls bg-white border border-primary rounded-lg p-2 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by employee name..." ariaLabel="Search employees" />

            {/* Sort */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort employees"
                  className="px-3 py-2 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-700 font-medium focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      }>

          {/* Employee cards */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
              </div>
              <p className="font-semibold text-gray-900 mb-1">
                {employees.length === 0 ? "No employees yet" : "No employees match your filters"}
              </p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {employees.length === 0
                  ? "Candidates you accept in the applicant tracker will appear here."
                  : "Try adjusting your search or status filter to find employees."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((emp) => (
                <article key={emp.id} className="rounded-lg border border-primary/40 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-dark-blue truncate">{emp.seeker?.full_name}</p>
                      <p className="mt-0.5 text-[11px] text-gray-500 truncate">{emp.seeker?.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {emp.status === "Accepted" ? (
                        <button type="button" title="Terminate employee" onClick={() => setStatus(emp.id, "Terminated")} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer">
                          <UserMinus className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Terminate</span>
                        </button>
                      ) : (
                        <button type="button" title="Reactivate employee" onClick={() => setStatus(emp.id, "Accepted")} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                          <UserPlus className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Reactivate</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Position</p>
                      <p className="mt-0.5 text-xs font-semibold text-dark-blue truncate">{emp.job?.title}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</p>
                      <span className={`mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-full uppercase border font-semibold ${
                        emp.status === "Accepted"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-gray-100 border-gray-200 text-gray-500"
                      }`}>
                        {emp.status === "Accepted" ? "Active" : emp.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Hired</p>
                      <p className="mt-0.5 text-xs text-gray-700 truncate">
                        {new Date(emp.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button type="button" onClick={() => toggleProfile(emp)} className="inline-flex items-center gap-1 text-[11px] text-gray-500 font-medium cursor-pointer">
                      {expandedId === emp.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {expandedId === emp.id ? "Hide profile" : "View profile"}
                    </button>
                  </div>

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
