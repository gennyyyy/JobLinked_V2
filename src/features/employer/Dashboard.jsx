import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../shared/hooks/useAuth";
import { getEmployerDashboard } from "../../shared/services/applications";
import { getEmployer } from "../../shared/services/auth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { Briefcase, Layers, Users, TrendingUp } from "lucide-react";
import { PageHeader, StatCard, SectionCard, InlineError } from "../../shared/components/dashboard";
import { titleCase } from "../../shared/utils/titleCase";

function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [summaryStats, setSummaryStats] = useState({});
  const [recent, setRecent] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    { label: "Active Listings", value: jobs.filter((job) => job.status === "published").length, highlight: false, icon: <Briefcase size={18} /> },
    { label: "Total Jobs", value: jobs.length, highlight: false, icon: <Layers size={18} /> },
    { label: "Total Candidates", value: totalCandidates, highlight: false, icon: <Users size={18} /> },
    { label: "New This Week", value: newThisWeek, highlight: newThisWeek > 0, icon: <TrendingUp size={18} /> },
  ];

  return (
    <div className="space-y-6 bg-gray-50">
      <PageHeader
        eyebrow="EMPLOYER DASHBOARD"
        title={`Overview for ${company?.company_name || "My Company"}`}
        subtitle="Real-time recruitment metrics and applicant tracking"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} highlight={false} icon={stat.icon} valueClassName="text-gray-900" />
        ))}
      </div>

      <SectionCard title="Recent Candidate Applications" subtitle="Latest job seekers who applied to your verified listings">

        {recent.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No applicant submissions received yet.{" "}
            <Link to="/employer/job-posts" className="text-primary hover:underline">Post a job →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{titleCase(item.seeker_full_name)}</p>
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    Applied for <span className="text-gray-600">{item.job_title}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-xs text-gray-500">
                    {new Date(item.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default Dashboard;
