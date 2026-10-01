import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { listBySeeker } from "../../services/applications";
import { listJobs } from "../../services/jobs";
import LoadingScreen from "../../components/LoadingScreen";

function splitPref(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
}

function scoreJob(job, user) {
  const skills = user?.skills || [];
  const jobText = `${job.title || ""} ${job.description || ""} ${job.requirements || ""}`.toLowerCase();
  const skillHits = skills.filter((s) => jobText.includes(String(s).toLowerCase())).length;
  let score = skillHits;
  const title = (job.title || "").toLowerCase();
  const location = (job.location || "").toLowerCase();
  if (splitPref(user?.preferred_position).some((tag) => title.includes(tag))) score += 2;
  if (splitPref(user?.preferred_location).some((tag) => location.includes(tag))) score += 1;
  if (user?.barangay_district && location.includes(user.barangay_district.toLowerCase())) score += 1;
  return score;
}

function profileCompletion(user) {
  const checks = [
    user?.first_name, user?.last_name, user?.phone, user?.barangay_district, user?.birthdate,
    user?.employment_status, user?.preferred_position, user?.preferred_location,
    user?.skills?.length, user?.street_address || user?.subdivision_building,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function Dashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    Promise.all([
      listBySeeker(user.id),
      listJobs({ page: 1, pageSize: 50 }),
    ])
      .then(([apps, { jobs }]) => {
        setApplications(apps);
        const appliedJobIds = new Set(apps.map((a) => a.job_id));
        setRecommended(
          jobs
            .filter((job) => !appliedJobIds.has(job.id))
            .map((job) => ({ ...job, score: scoreJob(job, user) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
        );
      })
      .catch((err) => setError(err.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  const activeApplications = applications.length;
  const shortlisted = applications.filter((app) => app.status === "Shortlisted").length;
  const rejected = applications.filter((app) => app.status === "Rejected").length;
  const newThisWeek = applications.filter((app) => {
    const days = (today - new Date(app.applied_at).getTime()) / 86400000;
    return days <= 7;
  }).length;

  const stats = [
    { label: "Active Applications", value: activeApplications, highlight: false },
    { label: "Shortlisted", value: shortlisted, highlight: shortlisted > 0 },
    { label: "Rejected", value: rejected, highlight: false },
    { label: "New This Week", value: newThisWeek, highlight: newThisWeek > 0 },
  ];

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
    .slice(0, 5);

  const completion = profileCompletion(user);

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">JOB SEEKER DASHBOARD</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">My Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">Track your applications and recruitment activity</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div className="flex items-center justify-between gap-4 mb-4 border-l-4 border-primary pl-4">
          <div>
            <h2 className="text-lg font-semibold text-dark-blue">Profile Completion</h2>
            <p className="text-xs text-gray-500 mt-0.5">Complete profiles get seen by more employers</p>
          </div>
          <span className="font-mono text-2xl font-bold text-primary">{completion}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
        </div>
        {completion < 100 && (
          <Link to="/job-seeker/profile" className="inline-block mt-3 text-xs font-medium text-primary hover:underline">
            Complete my profile →
          </Link>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="flex items-center justify-between gap-4 mb-6 border-l-4 border-primary pl-4">
          <div>
            <h2 className="text-lg font-semibold text-dark-blue">Recommended For You</h2>
            <p className="text-xs text-gray-500 mt-0.5">Matched against your skills, preferred jobs, and location</p>
          </div>
          <Link to="/job-seeker/jobs" className="text-xs font-medium text-primary hover:underline shrink-0">View all →</Link>
        </div>
        {recommended.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            No recommendations yet.{" "}
            <Link to="/job-seeker/profile" className="text-primary hover:underline">Add skills and preferences →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            {recommended.map((job) => (
              <Link
                key={job.id}
                to={`/job-seeker/jobs/${job.id}`}
                className="group border border-gray-200 rounded-xl p-4 hover:border-primary/40 transition-all"
              >
                <span className="font-mono text-[10px] tracking-widest text-gray-400 uppercase">{job.location} · {job.employment_type}</span>
                <h3 className="mt-1.5 text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2">{job.title}</h3>
                <p className="mt-1 text-xs text-gray-500">{job.employers?.company_name}</p>
                <span className="inline-block mt-3 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 font-mono text-xs text-primary">
                  {job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "Negotiable"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="flex items-center gap-3 mb-6 border-l-4 border-primary pl-4">
          <div>
            <h2 className="text-lg font-semibold text-dark-blue">Recent Applications</h2>
            <p className="text-xs text-gray-500 mt-0.5">Latest jobs you've applied to with Santa Maria employers</p>
          </div>
        </div>

        {recentApps.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            You haven't applied to any jobs yet.{" "}
            <Link to="/job-seeker/jobs" className="text-primary hover:underline">Browse openings →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentApps.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.job?.title}</p>
                  <p className="mt-1 text-xs text-gray-500 truncate">{item.job?.employers?.company_name}</p>
                  <p className="mt-1 font-mono text-[11px] text-gray-500">
                    Applied on {new Date(item.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-mono text-[10px] tracking-wider px-3 py-1 rounded-full uppercase border ${
                      item.status === "Shortlisted"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : item.status === "Rejected" || item.status === "Terminated"
                          ? "bg-danger/10 border-danger/20 text-danger"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}
                  >
                    {item.status}
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
