import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../shared/hooks/useAuth";
import { listEmployerJobs } from "../../shared/services/jobs";
import { listByCompany } from "../../shared/services/applications";
import { getEmployer } from "../../shared/services/auth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { Briefcase, Layers, Users, TrendingUp } from "lucide-react";
import { PageHeader, StatCard, SectionCard } from "../../shared/components/dashboard";

function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    // user.id IS the employers row id — no separate lookup needed
    getEmployer()
      .then((data) => {
        setCompany(data);
        return Promise.all([listEmployerJobs(user.id), listByCompany(user.id)]);
      })
      .then(([jobList, applicantList]) => {
        setJobs(jobList);
        setApplicants(applicantList);
      })
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  const openPosts = jobs.filter((job) => job.status === "published");
  const newThisWeek = applicants.filter((app) => {
    const days = (today - new Date(app.applied_at).getTime()) / 86400000;
    return days <= 7;
  }).length;

  const stats = [
    { label: "Active Listings", value: openPosts.length, highlight: false, icon: <Briefcase size={18} /> },
    { label: "Total Jobs", value: jobs.length, highlight: false, icon: <Layers size={18} /> },
    { label: "Total Candidates", value: applicants.length, highlight: false, icon: <Users size={18} /> },
    { label: "New This Week", value: newThisWeek, highlight: newThisWeek > 0, icon: <TrendingUp size={18} /> },
  ];

  const recentApplicants = [...applicants]
    .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
    .slice(0, 5);

  return (
    <div className="space-y-6 bg-gray-50">
      <PageHeader
        eyebrow="EMPLOYER DASHBOARD"
        title={`Overview for ${company?.company_name || "My Company"}`}
        subtitle="Real-time recruitment metrics and applicant tracking"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} highlight={stat.highlight} icon={stat.icon} />
        ))}
      </div>

      <SectionCard title="Recent Candidate Applications" subtitle="Latest job seekers who applied to your verified listings">

        {recentApplicants.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No applicant submissions received yet.{" "}
            <Link to="/employer/job-posts" className="text-primary hover:underline">Post a job →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentApplicants.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.seeker?.full_name}</p>
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    Applied for <span className="text-gray-600">{item.job?.title}</span>
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
