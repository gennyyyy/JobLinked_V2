import { useState, useEffect } from "react";
import { listAllJobs, listAllApplications, listUsers, listCompanies } from "../../services/admin";
import LoadingScreen from "../../components/LoadingScreen";

function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [reportType, setReportType] = useState("applications");

  useEffect(() => {
    Promise.all([listAllJobs(), listAllApplications(), listUsers(), listCompanies()])
      .then(([j, a, u, c]) => {
        setJobs(j);
        setApplications(a);
        setUsers(u);
        setCompanies(c);
      })
      .catch((err) => setError(err.message || "Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  function exportCSV() {
    let csv = "";
    if (reportType === "applications") {
      const headers = ["Seeker", "Email", "Job", "Company", "Status", "Applied At"];
      const rows = applications.map((a) => [
        a.seeker?.full_name || "",
        a.seeker?.email || "",
        a.job?.title || "",
        a.job?.companies?.name || "",
        a.status || "",
        a.applied_at || "",
      ]);
      csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    } else if (reportType === "jobs") {
      const headers = ["Title", "Company", "Location", "Status", "Type", "Created At"];
      const rows = jobs.map((j) => [
        j.title || "",
        j.companies?.name || "",
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
        u.barangay || "",
        u.status || "",
        u.created_at || "",
      ]);
      csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    } else if (reportType === "employers") {
      const headers = ["Company", "Owner", "Email", "Status", "Registered"];
      const rows = companies.map((c) => [
        c.name || "",
        c.owner?.full_name || "",
        c.owner?.email || "",
        c.owner?.status || "",
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
  };

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
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <h2 className="text-lg font-semibold text-dark-blue mb-4">Summary by Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportType === "applications" && applications.slice(0, 50).map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{a.seeker?.full_name}</td>
                  <td className="py-3 px-4 text-gray-600">{a.job?.title}</td>
                  <td className="py-3 px-4 text-gray-500">{a.job?.companies?.name}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{a.status}</span></td>
                  <td className="py-3 px-4 text-xs text-gray-500">{new Date(a.applied_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {reportType === "jobs" && jobs.slice(0, 50).map((j) => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{j.title}</td>
                  <td className="py-3 px-4 text-gray-500">{j.companies?.name}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{j.location}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{j.status}</span></td>
                </tr>
              ))}
              {reportType === "seekers" && users.filter((u) => u.role === "job-seeker").slice(0, 50).map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{u.full_name}</td>
                  <td className="py-3 px-4 text-gray-500">{u.email}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{u.barangay}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{u.status}</span></td>
                </tr>
              ))}
              {reportType === "employers" && companies.slice(0, 50).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{c.name}</td>
                  <td className="py-3 px-4 text-gray-500">{c.owner?.full_name}</td>
                  <td className="py-3 px-4 text-gray-500">{c.owner?.email}</td>
                  <td className="py-3 px-4"><span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">{c.owner?.status}</span></td>
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
