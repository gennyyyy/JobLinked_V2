import { useState, useEffect } from "react";
import { listAllJobs, listAllApplications, listUsers, listCompanies, listAllAccreditations, exportReport } from "../../shared/services/admin";
import { latestAccByCompany } from "../../shared/services/documents";
import LoadingScreen from "../../shared/components/LoadingScreen";

function BarChart({ data, color = "primary" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-32 text-xs text-gray-600 truncate">{label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
            <div className={`h-full bg-${color} rounded-full`} style={{ width: `${(value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-xs font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 10;

function toCSV(headers, rows) {
  return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [reportType, setReportType] = useState("applications");
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportError, setExportError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([listAllJobs(), listAllApplications(), listUsers(), listCompanies(), listAllAccreditations()])
      .then(([j, a, u, c, accs]) => {
        setJobs(j);
        setApplications(a);
        setUsers(u);
        setCompanies(c);
        setAccreditations(accs);
      })
      .catch((err) => setError(err.message || "Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  const latestByCompany = latestAccByCompany(accreditations);
  const accredStatus = (companyId) => latestByCompany[companyId]?.status || "not applied";

  const inRange = (dateStr) => {
    if (!dateStr) return true;
    if (dateFrom && dateStr < dateFrom) return false;
    if (dateTo && dateStr > dateTo) return false;
    return true;
  };

  const filteredApplications = applications.filter(a => inRange(a.applied_at));
  const filteredJobs = jobs.filter(j => inRange(j.created_at));
  const filteredUsers = users.filter(u => inRange(u.created_at));

  function exportCSV() {
    let csv = "";
    if (reportType === "applications") {
      const headers = ["Seeker", "Email", "Job", "Company", "Status", "Applied At"];
      const rows = filteredApplications.map((a) => [
        a.seeker?.full_name || "",
        a.seeker?.email || "",
        a.job?.title || "",
        a.job?.employers?.company_name || "",
        a.status || "",
        a.applied_at || "",
      ]);
      csv = toCSV(headers, rows);
    } else if (reportType === "jobs") {
      const headers = ["Title", "Company", "Location", "Status", "Type", "Created At"];
      const rows = filteredJobs.map((j) => [
        j.title || "",
        j.employers?.company_name || "",
        j.location || "",
        j.status || "",
        j.employment_type || "",
        j.created_at || "",
      ]);
      csv = toCSV(headers, rows);
    } else if (reportType === "seekers") {
      const headers = ["Name", "Email", "Barangay", "Status", "Registered"];
      const rows = filteredUsers.filter((u) => u.role === "job-seeker").map((u) => [
        u.full_name || "",
        u.email || "",
        u.barangay_district || "",
        u.status || "",
        u.created_at || "",
      ]);
      csv = toCSV(headers, rows);
    } else if (reportType === "employers") {
      const headers = ["Company", "Owner", "Email", "Status", "Accreditation", "Registered"];
      const rows = companies.map((c) => [
        c.company_name || "",
        c.full_name || "",
        c.email || "",
        c.status || "",
        accredStatus(c.id),
        c.created_at || "",
      ]);
      csv = toCSV(headers, rows);
    } else if (reportType === "barangay") {
      const headers = ["Barangay", "Placements"];
      const rows = Object.entries(summary.byBarangay).map(([brgy, count]) => [brgy, count]);
      csv = toCSV(headers, rows);
    } else if (reportType === "monthly") {
      const headers = ["Month", "Applications", "Jobs", "Seekers"];
      const rows = Object.entries(monthlyData).sort().map(([m, d]) => [m, d.applications, d.jobs, d.seekers]);
      csv = toCSV(headers, rows);
    }
    downloadBlob(new Blob([csv], { type: "text/csv" }), `${reportType}-report.csv`);
  }

  // Server-rendered export (GET admin/reports/:type/export?format=). 404 =
  // backend item missing → fall back to the client-side CSV builder above.
  async function exportServer() {
    setExportError("");
    try {
      const blob = await exportReport(reportType, exportFormat);
      downloadBlob(blob, `${reportType}-report.${exportFormat === "excel" ? "xlsx" : exportFormat}`);
    } catch (err) {
      if (err.status === 404 || err.status === 400) {
        exportCSV();
      } else {
        setExportError(err.message || "Export failed");
      }
    }
  }

  const summary = {
    totalApplications: filteredApplications.length,
    byStatus: filteredApplications.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {}),
    totalJobs: filteredJobs.length,
    byJobStatus: filteredJobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {}),
    totalSeekers: filteredUsers.filter((u) => u.role === "job-seeker").length,
    totalEmployers: users.filter((u) => u.role === "employer").length,
    totalCompanies: companies.length,
    placed: filteredApplications.filter((a) => a.status === "Placed").length,
    byBarangay: filteredApplications
      .filter((a) => a.status === "Placed" && a.seeker?.barangay_district)
      .reduce((acc, a) => { acc[a.seeker.barangay_district] = (acc[a.seeker.barangay_district] || 0) + 1; return acc; }, {}),
  };
  const placementRate = summary.totalApplications ? Math.round((summary.placed / summary.totalApplications) * 100) : 0;

  const monthlyData = {};
  filteredApplications.forEach(a => {
    const m = a.applied_at ? a.applied_at.slice(0, 7) : null;
    if (m) {
      if (!monthlyData[m]) monthlyData[m] = { applications: 0, jobs: 0, seekers: 0 };
      monthlyData[m].applications++;
    }
  });
  filteredJobs.forEach(j => {
    const m = j.created_at ? j.created_at.slice(0, 7) : null;
    if (m) {
      if (!monthlyData[m]) monthlyData[m] = { applications: 0, jobs: 0, seekers: 0 };
      monthlyData[m].jobs++;
    }
  });
  filteredUsers.filter(u => u.role === "job-seeker").forEach(u => {
    const m = u.created_at ? u.created_at.slice(0, 7) : null;
    if (m) {
      if (!monthlyData[m]) monthlyData[m] = { applications: 0, jobs: 0, seekers: 0 };
      monthlyData[m].seekers++;
    }
  });

  const paginate = (arr) => arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = (arr) => Math.max(1, Math.ceil(arr.length / PAGE_SIZE));

  const tableData = {
    applications: filteredApplications,
    jobs: filteredJobs,
    seekers: filteredUsers.filter((u) => u.role === "job-seeker"),
    employers: companies,
    barangay: Object.entries(summary.byBarangay).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
    monthly: Object.entries(monthlyData).sort().map(([label, value]) => ({ label, ...value })),
  };
  const currentTableData = tableData[reportType] || [];
  const currentTotalPages = totalPages(currentTableData);

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">REPORTS & ANALYTICS</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">Reports</h1>
        <p className="mt-2 text-sm text-gray-500">Export municipal employment data and analytics</p>
      </header>

      <div className="flex flex-wrap gap-3 items-center">
        {["applications", "jobs", "seekers", "employers", "barangay", "monthly"].map((type) => (
          <button
            key={type}
            onClick={() => { setReportType(type); setPage(1); }}
            className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
              reportType === type ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)} Report
          </button>
        ))}
        <div className="flex items-center gap-2">
          <label htmlFor="date-from" className="text-xs text-gray-500">From</label>
          <input id="date-from" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white" />
          <label htmlFor="date-to" className="text-xs text-gray-500">To</label>
          <input id="date-to" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white" />
        </div>
        <button onClick={exportCSV} className="ml-auto px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
          Export CSV
        </button>
        <div className="flex items-center gap-2">
          <label htmlFor="export-format" className="text-xs text-gray-500">Format</label>
          <select id="export-format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white">
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
          </select>
          <button onClick={exportServer} className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">
            Export {reportType}
          </button>
        </div>
        {exportError && <p className="w-full text-xs text-danger">{exportError}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white border-2 border-primary rounded-2xl p-4 shadow-sm">
          <p className="font-sans text-2xl font-bold text-primary">{summary.totalApplications}</p>
          <p className="mt-1 font-mono text-[9px] tracking-widest text-gray-500 uppercase">Total Applications</p>
        </div>
        <div className="bg-white border-2 border-primary rounded-2xl p-4 shadow-sm">
          <p className="font-sans text-2xl font-bold text-primary">{summary.totalJobs}</p>
          <p className="mt-1 font-mono text-[9px] tracking-widest text-gray-500 uppercase">Total Jobs</p>
        </div>
        <div className="bg-white border-2 border-primary rounded-2xl p-4 shadow-sm">
          <p className="font-sans text-2xl font-bold text-primary">{summary.totalSeekers}</p>
          <p className="mt-1 font-mono text-[9px] tracking-widest text-gray-500 uppercase">Job Seekers</p>
        </div>
        <div className="bg-white border-2 border-primary rounded-2xl p-4 shadow-sm">
          <p className="font-sans text-2xl font-bold text-primary">{summary.totalEmployers}</p>
          <p className="mt-1 font-mono text-[9px] tracking-widest text-gray-500 uppercase">Employers</p>
        </div>
        <div className="bg-white border-2 border-primary rounded-2xl p-4 shadow-sm">
          <p className="font-sans text-2xl font-bold text-emerald-600">{summary.placed}</p>
          <p className="mt-1 font-mono text-[9px] tracking-widest text-gray-500 uppercase">Placed · {placementRate}%</p>
        </div>
      </div>

      <div className="bg-white border-2 border-primary rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-dark-blue mb-4">
          {reportType === "barangay" ? "Placements by Barangay" : reportType === "monthly" ? "Monthly Trends" : "Summary by Status"}
        </h2>
        {reportType === "applications" && (
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(summary.byStatus).map(([status, count]) => (
              <div key={status} className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-primary">{count}</p>
                <p className="text-xs text-gray-500 mt-1">{status}</p>
              </div>
            ))}
          </div>
        )}
        {reportType === "jobs" && (
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(summary.byJobStatus).map(([status, count]) => (
              <div key={status} className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center">
                <p className="text-2xl font-bold text-primary">{count}</p>
                <p className="text-xs text-gray-500 mt-1">{status}</p>
              </div>
            ))}
          </div>
        )}
        {(reportType === "seekers" || reportType === "employers") && (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center col-span-2">
            <p className="text-sm text-gray-500">Use the Export CSV button to download detailed data</p>
          </div>
        )}
        {reportType === "barangay" && (
          Object.keys(summary.byBarangay).length ? (
            <BarChart data={Object.entries(summary.byBarangay).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} color="emerald-600" />
          ) : (
            <p className="text-xs text-gray-400">No placements recorded yet.</p>
          )
        )}
        {reportType === "monthly" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-mono text-[11px] tracking-[0.2em] text-gray-500 uppercase mb-3">Applications by Month</h3>
              <BarChart data={Object.entries(monthlyData).sort().map(([m, d]) => ({ label: m, value: d.applications }))} color="primary" />
            </div>
            <div>
              <h3 className="font-mono text-[11px] tracking-[0.2em] text-gray-500 uppercase mb-3">Jobs by Month</h3>
              <BarChart data={Object.entries(monthlyData).sort().map(([m, d]) => ({ label: m, value: d.jobs }))} color="accent" />
            </div>
            <div>
              <h3 className="font-mono text-[11px] tracking-[0.2em] text-gray-500 uppercase mb-3">Seekers by Month</h3>
              <BarChart data={Object.entries(monthlyData).sort().map(([m, d]) => ({ label: m, value: d.seekers }))} color="dark-blue" />
            </div>
          </div>
        )}
        {reportType === "applications" && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="font-mono text-[11px] tracking-[0.2em] text-gray-500 uppercase mb-3">Placements by Barangay</h3>
            {Object.keys(summary.byBarangay).length ? (
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(summary.byBarangay).sort((a, b) => b[1] - a[1]).map(([brgy, count]) => (
                  <div key={brgy} className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{count}</p>
                    <p className="text-xs text-gray-600 mt-1">{brgy}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No placements recorded yet. Mark accepted applicants as Placed in the employer portal.</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border-2 border-primary rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-dark-blue mb-4">Detailed Data</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                {reportType === "applications" && (
                  <>
                    <th className="text-left py-3 px-4 font-medium">Seeker</th>
                    <th className="text-left py-3 px-4 font-medium">Job</th>
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Applied</th>
                  </>
                )}
                {reportType === "jobs" && (
                  <>
                    <th className="text-left py-3 px-4 font-medium">Title</th>
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </>
                )}
                {reportType === "seekers" && (
                  <>
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Barangay</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                  </>
                )}
                {reportType === "employers" && (
                  <>
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Owner</th>
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Accreditation</th>
                  </>
                )}
                {reportType === "barangay" && (
                  <>
                    <th className="text-left py-3 px-4 font-medium">Barangay</th>
                    <th className="text-left py-3 px-4 font-medium">Placements</th>
                  </>
                )}
                {reportType === "monthly" && (
                  <>
                    <th className="text-left py-3 px-4 font-medium">Month</th>
                    <th className="text-left py-3 px-4 font-medium">Applications</th>
                    <th className="text-left py-3 px-4 font-medium">Jobs</th>
                    <th className="text-left py-3 px-4 font-medium">Seekers</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportType === "applications" && paginate(currentTableData).map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{a.seeker?.full_name}</td>
                  <td className="py-3 px-4 text-gray-600">{a.job?.title}</td>
                  <td className="py-3 px-4 text-gray-500">{a.job?.employers?.company_name}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{a.status}</span></td>
                  <td className="py-3 px-4 text-xs text-gray-500">{new Date(a.applied_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {reportType === "jobs" && paginate(currentTableData).map((j) => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{j.title}</td>
                  <td className="py-3 px-4 text-gray-500">{j.employers?.company_name}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{j.location}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{j.status}</span></td>
                </tr>
              ))}
              {reportType === "seekers" && paginate(currentTableData).map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{u.full_name}</td>
                  <td className="py-3 px-4 text-gray-500">{u.email}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{u.barangay_district}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{u.status}</span></td>
                </tr>
              ))}
              {reportType === "employers" && paginate(currentTableData).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{c.company_name}</td>
                  <td className="py-3 px-4 text-gray-500">{c.full_name}</td>
                  <td className="py-3 px-4 text-gray-500">{c.email}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{c.status}</span></td>
                  <td className="py-3 px-4">
                    {(() => {
                      const status = accredStatus(c.id);
                      const styles = status === "approved"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : status === "pending"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : status === "rejected" || status === "revoked"
                            ? "bg-danger/10 border-danger/20 text-danger"
                            : "bg-gray-100 border-gray-200 text-gray-500";
                      return <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${styles}`}>{status}</span>;
                    })()}
                  </td>
                </tr>
              ))}
              {reportType === "barangay" && paginate(currentTableData).map((row) => (
                <tr key={row.label} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{row.label}</td>
                  <td className="py-3 px-4 text-gray-600">{row.value}</td>
                </tr>
              ))}
              {reportType === "monthly" && paginate(currentTableData).map((row) => (
                <tr key={row.label} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{row.label}</td>
                  <td className="py-3 px-4 text-gray-600">{row.applications}</td>
                  <td className="py-3 px-4 text-gray-600">{row.jobs}</td>
                  <td className="py-3 px-4 text-gray-600">{row.seekers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {currentTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {currentTotalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(currentTotalPages, p + 1))}
                disabled={page === currentTotalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;
