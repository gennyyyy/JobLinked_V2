import { useState, useEffect } from "react";
import { listUsers, updateUser, listAllEmployees, listReferrals } from "../../services/admin";
import LoadingScreen from "../../components/LoadingScreen";

// ─── Job Seekers Registry ────────────────────────────────────────────────────

function JobSeekersSection() {
  const [jobSeekers, setJobSeekers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    listUsers({ role: "job-seeker" })
      .then(setJobSeekers)
      .catch((err) => setError(err.message || "Failed to load job seekers"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleStatus(seeker) {
    const newStatus = seeker.status === "active" ? "suspended" : "active";
    await updateUser(seeker.id, { status: newStatus });
    setJobSeekers((prev) => prev.map((e) => (e.id === seeker.id ? { ...e, status: newStatus } : e)));
  }

  const filtered = jobSeekers.filter((e) => {
    const matchesSearch = !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="border-l-4 border-primary pl-4 mb-6">
          <h2 className="text-lg font-semibold text-dark-blue">Job Seekers ({filtered.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Full Name</th>
                <th className="text-left py-3 px-4 font-medium">Email Address</th>
                <th className="text-left py-3 px-4 font-medium">Date Registered</th>
                <th className="text-left py-3 px-4 font-medium">Account Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-primary/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-900 font-medium">{emp.full_name}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{emp.email}</td>
                  <td className="py-3.5 px-4 text-xs text-gray-500">
                    {new Date(emp.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                      emp.status === "active" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : emp.status === "suspended" ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-gray-100 border-gray-200 text-gray-500"
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => toggleStatus(emp)}
                      className={`text-xs font-mono transition-colors ${
                        emp.status === "active" ? "text-danger hover:text-danger/80" : "text-primary hover:text-gray-900"
                      }`}
                    >
                      {emp.status === "active" ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No job seekers found.</div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Employees by Company ────────────────────────────────────────────────────

function CompanyEmployeeTable({ companyName, employees, search }) {
  const filtered = employees.filter(
    (e) => !search || e.seeker?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (filtered.length === 0) return null;

  const active = filtered.filter((e) => e.status === "Accepted").length;
  const placementRate = filtered.length ? Math.round((active / filtered.length) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Company header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-sm text-primary">
            {companyName?.[0] || "?"}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{companyName}</h3>
            <p className="font-mono text-[10px] tracking-wider text-gray-400 uppercase mt-0.5">
              {filtered.length} employee{filtered.length !== 1 ? "s" : ""} · {active} active · {placementRate}% placement
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase">
            {active} Active
          </span>
          {filtered.length - active > 0 && (
            <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500 uppercase">
              {filtered.length - active} Terminated
            </span>
          )}
        </div>
      </div>

      {/* Employee rows */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 font-mono text-[10px] tracking-widest text-gray-400 uppercase">
              <th className="text-left py-2.5 px-6 font-medium">Employee</th>
              <th className="text-left py-2.5 px-4 font-medium">Position</th>
              <th className="text-left py-2.5 px-4 font-medium">Barangay</th>
              <th className="text-left py-2.5 px-4 font-medium">Date Hired</th>
              <th className="text-left py-2.5 px-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((emp) => (
              <tr key={emp.id} className="hover:bg-primary/5 transition-colors">
                <td className="py-3 px-6">
                  <p className="text-gray-900 font-medium text-sm">{emp.seeker?.full_name}</p>
                  <p className="font-mono text-[10px] text-gray-400 mt-0.5">{emp.seeker?.email}</p>
                </td>
                <td className="py-3 px-4 text-gray-600 text-xs">{emp.job?.title || "—"}</td>
                <td className="py-3 px-4 font-mono text-xs text-gray-500">{emp.seeker?.barangay_district || "—"}</td>
                <td className="py-3 px-4 font-mono text-xs text-gray-500">
                  {new Date(emp.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="py-3 px-4">
                  <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                    emp.status === "Accepted"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-gray-100 border-gray-200 text-gray-500"
                  }`}>
                    {emp.status === "Accepted" ? "Active" : "Terminated"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeesByCompanySection() {
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    listAllEmployees()
      .then(setAllEmployees)
      .catch((err) => setError(err.message || "Failed to load employees"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  // Apply status filter before grouping
  const statusFiltered = statusFilter === "all"
    ? allEmployees
    : allEmployees.filter((e) =>
        statusFilter === "active" ? e.status === "Accepted" : e.status === "Terminated"
      );

  // Group by company
  const byCompany = {};
  statusFiltered.forEach((emp) => {
    const companyId = emp.job?.employers?.id || emp.job?.company_id || "unknown";
    const companyName = emp.job?.employers?.company_name || "Unknown Company";
    if (!byCompany[companyId]) byCompany[companyId] = { companyName, employees: [] };
    byCompany[companyId].employees.push(emp);
  });

  const companies = Object.entries(byCompany).sort(([, a], [, b]) =>
    a.companyName.localeCompare(b.companyName)
  );

  const totalActive = allEmployees.filter((e) => e.status === "Accepted").length;
  const totalTerminated = allEmployees.filter((e) => e.status === "Terminated").length;

  return (
    <section className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border bg-white border-gray-200 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{allEmployees.length}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Total Placed</p>
        </div>
        <div className="p-4 rounded-2xl border bg-emerald-50/50 border-emerald-300 shadow-sm">
          <p className="text-2xl font-bold text-emerald-700">{totalActive}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Active</p>
        </div>
        <div className="p-4 rounded-2xl border bg-white border-gray-200 shadow-sm">
          <p className="text-2xl font-bold text-gray-500">{totalTerminated}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Terminated</p>
        </div>
        <div className="p-4 rounded-2xl border bg-white border-gray-200 shadow-sm">
          <p className="text-2xl font-bold text-primary">{companies.length}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Companies</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by employee name..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="terminated">Terminated Only</option>
        </select>
      </div>

      {/* Per-company tables */}
      {companies.length === 0 ? (
        <div className="py-16 text-center bg-white border border-gray-200 rounded-2xl shadow-sm text-sm text-gray-400">
          No placed employees found.
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map(([companyId, { companyName, employees }]) => (
            <CompanyEmployeeTable
              key={companyId}
              companyName={companyName}
              employees={employees}
              search={search}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Referral History ────────────────────────────────────────────────────────

function ReferralsSection() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listReferrals()
      .then(setReferrals)
      .catch((err) => setError(err.message || "Failed to load referrals"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return (
    <div className="py-8 text-center text-sm text-gray-500">
      Referral history is unavailable — run migration:{" "}
      <code className="font-mono text-xs bg-gray-100 px-1 rounded">alter table job_applications add column referred_by uuid references job_seekers(id);</code>
      <p className="mt-1 font-mono text-[11px] text-gray-400">{error}</p>
    </div>
  );

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
      <div className="border-l-4 border-primary pl-4 mb-6">
        <h2 className="text-lg font-semibold text-dark-blue">Referral History ({referrals.length})</h2>
      </div>
      {referrals.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">No referred applications yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Seeker</th>
                <th className="text-left py-3 px-4 font-medium">Job</th>
                <th className="text-left py-3 px-4 font-medium">Company</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {referrals.map((r) => (
                <tr key={r.id} className="hover:bg-primary/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-900 font-medium">{r.seeker?.full_name}</td>
                  <td className="py-3.5 px-4 text-gray-600">{r.job?.title}</td>
                  <td className="py-3.5 px-4 text-gray-500">{r.job?.employers?.company_name}</td>
                  <td className="py-3.5 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function Employees() {
  const [tab, setTab] = useState("employees");

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">MUNICIPAL REGISTRY</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">People Registry</h1>
        <p className="mt-2 text-sm text-gray-500">Registered job seekers and placed employees across all accredited companies</p>
      </header>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-xl w-fit shadow-sm">
        {[
          { key: "employees", label: "Employees by Company" },
          { key: "seekers", label: "Registered Job Seekers" },
          { key: "referrals", label: "Referral History" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key
                ? "bg-primary text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "employees" ? <EmployeesByCompanySection /> : tab === "seekers" ? <JobSeekersSection /> : <ReferralsSection />}
    </div>
  );
}

export default Employees;
