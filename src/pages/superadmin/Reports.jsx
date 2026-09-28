import { useState, useEffect } from "react";
import { listAllJobs, listAllApplications, listUsers, listCompanies, listAllAccreditations } from "../../services/admin";
import { latestAccByCompany as buildLatestAccByCompany } from "../../services/documents";
import LoadingScreen from "../../components/LoadingScreen";

function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [reportType, setReportType] = useState("applications");

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

  // accreditations are ordered submitted_at desc, so first row per company is its latest
  const latestAccByCompany = buildLatestAccByCompany(accreditations);
  const accredStatus = (companyId) => latestAccByCompany[companyId]?.status || "not applied";

  function exportCSV() {
    let csv = "";
    if (reportType === "applications") {
      const headers = ["Seeker", "Email", "Job", "Company", "Status", "Applied At"];
      const rows = applications.map((a) => [
        a.seeker?.full_name || "",
        a.seeker?.email || "",
        a.job?.title || "",
        a.job?.employers?.company_name || "",
        a.status || "",
        a.applied_at || "",
      ]);
      csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    } else if (reportType === "jobs") {
      const headers = ["Title", "Company", "Location", "Status", "Type", "Created At"];
      const rows = jobs.map((j) => [
        j.title || "",
        j.employers?.company_name || "",
        j.location || "",
        j.status || "",
        j.employment_type || "",
        j.created_at || "",
      ]);
      csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    } else if (reportType === "seekers") {
      const headers = ["Name", "Email", "Barangay", "Status", "Registered"];
      const rows = users.filter((u) => u.role === "job-seeker").map((u) => [
        u.full_name || "",
        u.email || "",
        u.barangay_district || "",
        u.status || "",
        u.created_at || "",
      ]);
      csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
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
      csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = {
    totalApplications: applications.length,
    byStatus: applications.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {}),
    totalJobs: jobs.length,
    byJobStatus: jobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {}),
    totalSeekers: users.filter((u) => u.role === "job-seeker").length,
    totalEmployers: users.filter((u) => u.role === "employer").length,
    totalCompanies: companies.length,
    placed: applications.filter((a) => a.status === "Placed").length,
    byBarangay: applications
      .filter((a) => a.status === "Placed" && a.seeker?.barangay_district)
      .reduce((acc, a) => { acc[a.seeker.barangay_district] = (acc[a.seeker.barangay_district] || 0) + 1; return acc; }, {}),
  };
  const placementRate = summary.totalApplications ? Math.round((summary.placed / summary.totalApplications) * 100) : 0;

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

      <div className="flex flex-wrap gap-3">
        {["applications", "jobs", "seekers", "employers"].map((type) => (
          <button
            key={type}
            onClick={() => setReportType(type)}
            className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
              reportType === type ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)} Report
          </button>
        ))}
        <button onClick={exportCSV} className="ml-auto px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
          Export CSV
        </button>
        <button onClick={() => window.print()} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Print
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
          <p className="font-sans text-3xl font-bold text-primary">{summary.totalApplications}</p>
          <p className="mt-2 font-mono text-[10px] tracking-widest text-gray-500 uppercase">Total Applications</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
          <p className="font-sans text-3xl font-bold text-primary">{summary.totalJobs}</p>
          <p className="mt-2 font-mono text-[10px] tracking-widest text-gray-500 uppercase">Total Jobs</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
          <p className="font-sans text-3xl font-bold text-primary">{summary.totalSeekers}</p>
          <p className="mt-2 font-mono text-[10px] tracking-widest text-gray-500 uppercase">Job Seekers</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
          <p className="font-sans text-3xl font-bold text-primary">{summary.totalEmployers}</p>
          <p className="mt-2 font-mono text-[10px] tracking-widest text-gray-500 uppercase">Employers</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-emerald-500">
          <p className="font-sans text-3xl font-bold text-emerald-600">{summary.placed}</p>
          <p className="mt-2 font-mono text-[10px] tracking-widest text-gray-500 uppercase">Placed Applicants · {placementRate}%</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <h2 className="text-lg font-semibold text-dark-blue mb-4">Summary by Status</h2>
        <div className="grid grid-cols-1 gap-4">
          {reportType === "applications" && Object.entries(summary.byStatus).map(([status, count]) => (
            <div key={status} className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center">
              <p className="text-2xl font-bold text-primary">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{status}</p>
            </div>
          ))}
          {reportType === "jobs" && Object.entries(summary.byJobStatus).map(([status, count]) => (
            <div key={status} className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center">
              <p className="text-2xl font-bold text-primary">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{status}</p>
            </div>
          ))}
          {(reportType === "seekers" || reportType === "employers") && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center col-span-2">
              <p className="text-sm text-gray-500">Use the Export CSV button to download detailed data</p>
            </div>
          )}
        </div>
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

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportType === "applications" && applications.slice(0, 50).map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{a.seeker?.full_name}</td>
                  <td className="py-3 px-4 text-gray-600">{a.job?.title}</td>
                  <td className="py-3 px-4 text-gray-500">{a.job?.employers?.company_name}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{a.status}</span></td>
                  <td className="py-3 px-4 text-xs text-gray-500">{new Date(a.applied_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {reportType === "jobs" && jobs.slice(0, 50).map((j) => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{j.title}</td>
                  <td className="py-3 px-4 text-gray-500">{j.employers?.company_name}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{j.location}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{j.status}</span></td>
                </tr>
              ))}
              {reportType === "seekers" && users.filter((u) => u.role === "job-seeker").slice(0, 50).map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{u.full_name}</td>
                  <td className="py-3 px-4 text-gray-500">{u.email}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{u.barangay_district}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{u.status}</span></td>
                </tr>
              ))}
              {reportType === "employers" && companies.slice(0, 50).map((c) => (
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Reports;
