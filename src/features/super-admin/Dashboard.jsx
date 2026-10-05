import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getStats, listAllAccreditations } from "../../shared/services/admin";
import LoadingScreen from "../../shared/components/LoadingScreen";

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentAccreditations, setRecentAccreditations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getStats(), listAllAccreditations()])
      .then(([statsData, accs]) => {
        setStats(statsData);
        setRecentAccreditations(accs.slice(0, 5));
      })
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;
  if (!stats) return null;

  const statCards = [
    { label: "Job Seekers", value: stats.seekers, highlight: false },
    { label: "Pending Accreditation", value: stats.pendingAccreditations, highlight: stats.pendingAccreditations > 0 },
    { label: "Employers", value: stats.employers, highlight: false },
    { label: "Job Posts", value: stats.jobs, highlight: false },
    { label: "Applications", value: stats.applications, highlight: false },
    { label: "Companies", value: stats.companies, highlight: false },
  ];

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">ADMINISTRATION OVERVIEW</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">PESO Operations Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">Real-time municipal statistics, accreditations, and system activities</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-gray-300 transition-colors ${stat.highlight ? 'border-t-4 border-amber-400' : 'border-t-4 border-primary'}`}
          >
            <p className="font-sans text-3xl md:text-4xl font-bold text-primary leading-none">{stat.value}</p>
            <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-gray-500 uppercase">{stat.label}</p>
            {stat.highlight && <span className="inline-block mt-3 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
          </div>
        ))}
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="flex items-center gap-3 mb-6 border-l-4 border-primary pl-4">
          <div>
            <h2 className="text-lg font-semibold text-dark-blue">Recent Employer Applications</h2>
            <p className="text-xs text-gray-500 mt-0.5">Review and act on business accreditation requests</p>
          </div>
          <Link to="/super-admin/accreditation" className="text-xs font-mono text-primary hover:underline underline-offset-4">Manage all →</Link>
        </div>

        {recentAccreditations.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No employer applications submitted yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentAccreditations.map((acc) => (
              <div key={acc.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{acc.employers?.company_name}</p>
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    Barangay {acc.employers?.barangay_district} · {new Date(acc.submitted_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border ${
                    acc.status === "pending" ? "bg-amber-50 border-amber-200 text-amber-700"
                    : acc.status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : acc.status === "rejected" ? "bg-danger/10 border-danger/20 text-danger"
                    : "bg-gray-100 border-gray-200 text-gray-500"
                  }`}
                >
                  {acc.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
