import { useState, useEffect } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { listByCompany, updateApplicationStatus } from "../../shared/services/applications";
import LoadingScreen from "../../shared/components/LoadingScreen";

const EMPLOYEE_STATUSES = ["Accepted", "Terminated"];

function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  const active = employees.filter((e) => e.status === "Accepted").length;
  const toggleFilter = (next) => setStatusFilter((prev) => (prev === next ? "all" : next));
  const filtered = employees.filter((e) =>
    (statusFilter === "all" || (statusFilter === "active" ? e.status === "Accepted" : e.status === "Terminated")) &&
    (!search || e.seeker?.full_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">HIRING ROSTER</p>
        <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-gray-900">Employees</h1>
        <p className="mt-2 text-sm text-gray-500">Accepted applicants become employees and move out of the application tracker</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button type="button" onClick={() => toggleFilter("all")} aria-pressed={statusFilter === "all"} title="Show all employees"
          className={`p-4 rounded-lg border text-left cursor-pointer transition-all hover: active:scale-[0.98] ${statusFilter === "all" ? "bg-white border-primary ring-1 ring-primary/30" : "bg-white border-gray-200 hover:border-gray-300"}`}>
          <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Total</p>
        </button>
        <button type="button" onClick={() => toggleFilter("active")} aria-pressed={statusFilter === "active"} title="Show active employees"
          className={`p-4 rounded-lg border text-left cursor-pointer transition-all hover: active:scale-[0.98] ${statusFilter === "active" ? "bg-emerald-50/50 border-emerald-600 ring-1 ring-emerald-600/30" : "bg-emerald-50/50 border-emerald-500 hover:border-emerald-600"}`}>
          <p className="text-2xl font-bold text-emerald-700">{active}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Active</p>
        </button>
        <button type="button" onClick={() => toggleFilter("terminated")} aria-pressed={statusFilter === "terminated"} title="Show terminated employees"
          className={`p-4 rounded-lg border text-left cursor-pointer transition-all hover: active:scale-[0.98] ${statusFilter === "terminated" ? "bg-white border-primary ring-1 ring-primary/30" : "bg-white border-gray-200 hover:border-gray-300"}`}>
          <p className="text-2xl font-bold text-gray-600">{employees.length - active}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Terminated</p>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by employee name..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      <div className="bg-white border border-primary rounded-lg p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Employee Name</th>
                <th className="text-left py-3 px-4 font-medium">Position</th>
                <th className="text-left py-3 px-4 font-medium">Date Hired</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="text-gray-900 font-medium">{emp.seeker?.full_name}</p>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{emp.seeker?.email}</p>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600">{emp.job?.title}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                    {new Date(emp.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                      emp.status === "Accepted"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-gray-100 border-gray-200 text-gray-500"
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {emp.status === "Accepted" ? (
                      <button onClick={() => setStatus(emp.id, "Terminated")} className="px-3 py-1 rounded-lg text-xs font-medium bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-colors">
                        Terminate
                      </button>
                    ) : (
                      <button onClick={() => setStatus(emp.id, "Accepted")} className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              {employees.length === 0
                ? "No employees yet. Candidates you accept in the applicant tracker appear here."
                : <>No employees match this filter. <button onClick={() => { setStatusFilter("all"); setSearch(""); }} className="text-primary hover:underline underline-offset-4 font-medium">Clear filter</button></>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Employees;
