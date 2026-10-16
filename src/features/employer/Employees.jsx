import { useState, useEffect, useMemo, Fragment } from "react";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
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

const EMPLOYEE_STATUSES = ["Accepted", "Terminated"];

function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
  const filtered = employees.filter((e) =>
    (statusFilter === "all" || (statusFilter === "active" ? e.status === "Accepted" : e.status === "Terminated")) &&
    (!search || e.seeker?.full_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const hasActiveFilters = statusFilter !== "all" || search.trim() !== "";
  const clearFilters = () => { setStatusFilter("all"); setSearch(""); };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">
              HIRING ROSTER
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs text-gray-500 font-medium">Santa Maria PESO</span>
          </div>
          <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-gray-900">
            Employees
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Accepted applicants become employees and move out of the application tracker
          </p>
        </div>
      </header>

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        {[
          { value: "all", label: "Total", count: employees.length, icon: Users },
          { value: "active", label: "Active", count: active, icon: CheckCircle2 },
          { value: "terminated", label: "Terminated", count: terminated, icon: XCircle },
        ].map((c) => {
          const MetricIcon = c.icon;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleFilter(c.value)}
              aria-pressed={statusFilter === c.value}
              title={c.value === "all" ? "Show all employees" : `Show ${c.label.toLowerCase()} employees`}
              className={`p-4 rounded-lg border text-left cursor-pointer transition-all ${statusFilter === c.value ? "bg-white border-gray-900 ring-1 ring-gray-900/20" : "bg-white border-gray-200 hover:border-gray-300"}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-gray-900">{c.count}</p>
                <MetricIcon className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">{c.label}</p>
            </button>
          );
        })}
      </div>

      {/* Main Container: Search, Filter & Employees Table */}
      <div className="bg-white border border-primary rounded-lg p-5 md:p-5 shadow-xs space-y-5">
        {/* Controls: Search & Status Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-700 font-medium focus:outline-none focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">All Statuses ({employees.length})</option>
                <option value="active">Active ({active})</option>
                <option value="terminated">Terminated ({terminated})</option>
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
        {/* Employees Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-wider text-gray-500 uppercase bg-gray-50/70">
                <th scope="col" className="text-left py-3 px-4 font-semibold rounded-l-xl">Employee</th>
                <th scope="col" className="text-left py-3 px-4 font-semibold">Position</th>
                <th scope="col" className="text-left py-3 px-4 font-semibold">Date Hired</th>
                <th scope="col" className="text-left py-3 px-4 font-semibold">Status</th>
                <th scope="col" className="text-right py-3 px-4 font-semibold rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => (
                <Fragment key={emp.id}>
                <tr className="hover:bg-gray-50/80 transition-colors group">
                  <th scope="row" className="py-4 px-4 text-left font-normal">
                    <button type="button" onClick={() => toggleProfile(emp)} className="text-left group/btn cursor-pointer">
                      <span className="block font-semibold text-gray-900 group-hover/btn:text-primary transition-colors text-sm line-clamp-1 uppercase">
                        {emp.seeker?.full_name}
                      </span>
                      <span className="block text-[11px] text-gray-500 mt-0.5 break-all">{emp.seeker?.email}</span>
                      <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-gray-500 font-medium">
                        {expandedId === emp.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {expandedId === emp.id ? "Hide profile" : "View profile"}
                      </span>
                    </button>
                  </th>
                  <td className="py-4 px-4 text-gray-600">{emp.job?.title}</td>
                  <td className="py-4 px-4 font-mono text-xs text-gray-500">
                    {new Date(emp.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border font-semibold ${
                      emp.status === "Accepted"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-gray-100 border-gray-200 text-gray-500"
                    }`}>
                      {emp.status === "Accepted" ? "Active" : emp.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap justify-end gap-1.5">
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
                  </td>
                </tr>
                {expandedId === emp.id && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={5} className="py-5 px-4">
                      <SeekerProfileCard applicant={emp} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
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
          )}
        </div>
      </div>
    </div>
  );
}

export default Employees;
