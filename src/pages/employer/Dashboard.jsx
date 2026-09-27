import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { listEmployerJobs } from "../../services/jobs";
import { listByCompany } from "../../services/applications";
import { supabase } from "../../lib/supabase";
import LoadingScreen from "../../components/LoadingScreen";

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
    supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle()
      .then(({ data, error: err }) => {
        if (err) throw err;
        setCompany(data);
        if (data) {
          return Promise.all([listEmployerJobs(data.id), listByCompany(data.id)]);
        }
        return [[], []];
      })
      .then(([jobList, applicantList]) => {
        setJobs(jobList);
        setApplicants(applicantList);
      })
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  const openPosts = jobs.filter((job) => job.status === "published");
  const newThisWeek = applicants.filter((app) => {
    const days = (today - new Date(app.applied_at).getTime()) / 86400000;
    return days <= 7;
  }).length;

  const stats = [
    { label: "Active Listings", value: openPosts.length, highlight: false },
    { label: "Total Jobs", value: jobs.length, highlight: false },
    { label: "Total Candidates", value: applicants.length, highlight: false },
    { label: "New This Week", value: newThisWeek, highlight: newThisWeek > 0 },
  ];

  const recentApplicants = [...applicants]
    .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
    .slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">EMPLOYER DASHBOARD</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">
          Overview for {company?.name || "My Company"}
        </h1>
        <p className="mt-2 text-sm text-gray-500">Real-time recruitment metrics and applicant tracking</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
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
            <h2 className="text-lg font-semibold text-dark-blue">Recent Candidate Applications</h2>
            <p className="text-xs text-gray-500 mt-0.5">Latest job seekers who applied to your verified listings</p>
          </div>
        </div>

        {recentApplicants.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No applicant submissions received yet.{" "}
            <Link to="/employer/job-posts" className="text-primary hover:underline">Post a job →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentApplicants.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
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
      </section>
    </div>
  );
}

export default Dashboard;
