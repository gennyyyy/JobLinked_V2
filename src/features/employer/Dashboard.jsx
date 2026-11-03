import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../shared/hooks/useAuth";
import { getEmployerDashboard } from "../../shared/services/applications";
import { getEmployer } from "../../shared/services/auth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { InlineError } from "../../shared/components/dashboard";
import { titleCase } from "../../shared/utils/titleCase";

function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [summaryStats, setSummaryStats] = useState({});
  const [recent, setRecent] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    // user.id IS the employers row id — the summary endpoint scopes everything to it server-side.
    getEmployer()
      .then((data) => {
        setCompany(data);
        return getEmployerDashboard();
      })
      .then((summary) => {
        setJobs(summary.jobs || []);
        setSummaryStats(summary.stats || {});
        setRecent(summary.recent || []);
      })
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <InlineError message={error} />;

  const totalCandidates = summaryStats.total_candidates || 0;
  const newThisWeek = summaryStats.new_this_week || 0;

  const stats = [
    { label: "Active Listings", value: jobs.filter((job) => job.status === "published").length },
    { label: "Total Jobs", value: jobs.length },
    { label: "Total Candidates", value: totalCandidates },
    { label: "New This Week", value: newThisWeek },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning!" : hour < 18 ? "Good Afternoon!" : "Good Evening!";

  const companyName = company?.company_name || "My Company";
  const monogram =
    companyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?";
  const logo = !logoFailed && typeof company?.logo_path === "string" && company.logo_path ? company.logo_path : null;

  return (
    <div className="space-y-6 bg-muted">
      <h1 className="text-xl md:text-2xl font-bold text-dark-blue">Dashboard</h1>

      <section className="flex items-center gap-4 rounded-xl bg-navy p-5 md:p-6 shadow-md">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-card shadow-md md:h-20 md:w-20">
          {logo ? (
            <img src={logo} alt="" className="w-full h-full object-cover" onError={() => setLogoFailed(true)} />
          ) : (
            <span className="text-2xl font-bold text-primary">{monogram}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm md:text-base font-semibold text-white/85">{greeting}</p>
          <h2 className="truncate text-xl md:text-2xl font-bold text-white">{companyName}</h2>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-5">
            <p className="text-3xl font-bold text-primary">{stat.value}</p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-primary">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-primary/40 bg-card p-5">
        <h2 className="text-sm font-bold text-dark-blue">Recent Candidate Applications</h2>
        <p className="mt-0.5 text-xs italic text-muted-foreground">Latest job seekers who applied to your verified listings</p>

        {recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No applicant submissions received yet.{" "}
            <Link to="/employer/job-posts" className="text-primary hover:underline">Post a job →</Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.map((item) => (
              <div key={item.id} className="rounded-lg border border-primary/40 bg-card px-4 py-3">
                <p className="text-sm font-bold text-dark-blue truncate">{titleCase(item.seeker_full_name)}</p>
                <p className="mt-1 text-xs italic text-muted-foreground truncate">
                  Applied for <span className="text-muted-foreground">{item.job_title}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Applied on {new Date(item.applied_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
