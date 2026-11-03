import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getStats, listAllAccreditations } from "../../shared/services/admin";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { Users, Clock, Building2, Briefcase, FileText, Globe, BadgeCheck, ClipboardList, UserCheck } from "lucide-react";
import { DashboardHero, StatCard, SectionCard, InlineError } from "../../shared/components/dashboard";
import useAuth from "../../shared/hooks/useAuth";

function Dashboard() {
  const { user } = useAuth() || {};
  const [stats, setStats] = useState(null);
  const [recentAccreditations, setRecentAccreditations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getStats(), listAllAccreditations()])
      .then(([statsData, accs]) => {
        setStats(statsData);
        setRecentAccreditations(accs.data.slice(0, 5));
      })
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <InlineError message={error} />;
  if (!stats) return null;

  const statCards = [
    { label: "Job Seekers", value: stats.seekers, highlight: false, icon: <Users size={18} /> },
    { label: "Pending Accreditation", value: stats.pendingAccreditations, highlight: stats.pendingAccreditations > 0, icon: <Clock size={18} /> },
    { label: "Employers", value: stats.employers, highlight: false, icon: <Building2 size={18} /> },
    { label: "Job Posts", value: stats.jobs, highlight: false, icon: <Briefcase size={18} /> },
    { label: "Applications", value: stats.applications, highlight: false, icon: <FileText size={18} /> },
    { label: "Companies", value: stats.companies, highlight: false, icon: <Globe size={18} /> },
    // Extended GET admin/stats keys — render only keys present at runtime.
    ...[
      { label: "Accredited", value: stats.accreditedEmployers, icon: <BadgeCheck size={18} /> },
      { label: "Pending Jobs", value: stats.pendingJobs, icon: <ClipboardList size={18} /> },
      { label: "Accepted", value: stats.acceptedApplicants, icon: <UserCheck size={18} /> },
      { label: "Placed", value: stats.placedApplicants, icon: <BadgeCheck size={18} /> },
    ].filter((c) => c.value !== undefined && c.value !== null).map((c) => ({ ...c, highlight: false })),
  ];

  return (
    <div className="space-y-6 bg-muted">
      <h1 className="text-xl md:text-2xl font-bold text-dark-blue">Dashboard</h1>
      <DashboardHero
        user={user}
        fallback="Super Administrator"
        initialsFallback="SA"
        subtitle="Real-time municipal statistics, accreditations, and system activities"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} highlight={stat.highlight} icon={stat.icon} />
        ))}
      </div>

      <SectionCard
        title="Recent Employer Applications"
        subtitle="Review and act on business accreditation requests"
        action={<Link to="/super-admin/accreditation" className="text-xs font-mono text-primary hover:underline underline-offset-4">Manage all →</Link>}
      >

        {recentAccreditations.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No employer applications submitted yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {recentAccreditations.map((acc) => (
              <div key={acc.id} className="border border-primary/40 rounded-lg p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate uppercase">{acc.employers?.company_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">Barangay <span className="uppercase">{acc.employers?.barangay_district}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Applied on {new Date(acc.submitted_at).toLocaleDateString("en-PH", { dateStyle: "long" })}</p>
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border ${
                    acc.status === "pending" ? "bg-amber-50 border-amber-200 text-amber-700"
                    : acc.status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : acc.status === "rejected" ? "bg-danger/10 border-danger/20 text-danger"
                    : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {acc.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default Dashboard;
