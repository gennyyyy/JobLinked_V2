import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../shared/hooks/useAuth";
import { listBySeeker } from "../../shared/services/applications";
import { listJobs } from "../../shared/services/jobs";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { FileText, XCircle, TrendingUp, CheckCircle } from "lucide-react";
import { PageHeader, StatCard, SectionCard, InlineError } from "../../shared/components/dashboard";
import { titleCase } from "../../shared/utils/titleCase";

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
  if (error) return <InlineError message={error} />;

  const activeApplications = applications.length;
  const rejected = applications.filter((app) => app.status === "Rejected").length;
  const accepted = applications.filter(app => app.status === "Accepted").length;
  const newThisWeek = applications.filter((app) => {
    const days = (today - new Date(app.applied_at).getTime()) / 86400000;
    return days <= 7;
  }).length;

  const stats = [
    { label: "Active Applications", value: activeApplications, highlight: false, icon: <FileText size={18} /> },
    { label: "Accepted", value: accepted, highlight: accepted > 0, icon: <CheckCircle size={18} /> },
    { label: "Rejected", value: rejected, highlight: false, icon: <XCircle size={18} /> },
    { label: "New This Week", value: newThisWeek, highlight: newThisWeek > 0, icon: <TrendingUp size={18} /> },
  ];

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
    .slice(0, 5);

  const completion = profileCompletion(user);

  return (
    <>
      <PageHeader
        eyebrow="JOB SEEKER DASHBOARD"
        title="My Dashboard"
        subtitle="Track your applications and recruitment activity"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} highlight={stat.highlight} icon={stat.icon} />
        ))}
      </div>

      <SectionCard
        title="Profile Completion"
        subtitle="Complete profiles get seen by more employers"
        action={<span className="font-mono text-2xl font-bold text-primary">{completion}%</span>}
      >
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
        </div>
        {completion < 100 && (
          <Link to="/job-seeker/profile" className="inline-block mt-3 text-xs font-medium text-primary hover:underline">
            Complete my profile →
          </Link>
        )}
      </SectionCard>

      <SectionCard
        title="Recommended For You"
        subtitle="Matched against your skills, preferred jobs, and location"
        action={<Link to="/job-seeker/jobs" className="text-xs font-medium text-primary hover:underline shrink-0">View all →</Link>}
      >
        {recommended.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            No recommendations yet.{" "}
            <Link to="/job-seeker/profile" className="text-primary hover:underline">Add skills and preferences →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommended.map((job) => (
              <Link
                key={job.id}
                to={`/job-seeker/jobs/${job.id}`}
                className="group border border-gray-200 rounded-xl p-4 hover:border-primary/40 transition-all"
              >
                <span className="font-mono text-[10px] tracking-widest text-gray-400 uppercase">{job.location} · {job.employment_type}</span>
                <h3 className="mt-1.5 text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2">{job.title}</h3>
                <p className="mt-1 text-xs text-gray-500">{titleCase(job.employers?.company_name)}</p>
                <span className="inline-block mt-3 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 font-mono text-xs text-primary">
                  {job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "Negotiable"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent Applications" subtitle="Latest jobs you've applied to with Santa Maria employers">

        {recentApps.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            You haven't applied to any jobs yet.{" "}
            <Link to="/job-seeker/jobs" className="text-primary hover:underline">Browse openings →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentApps.map((item) => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.job?.title}</p>
                  <p className="mt-1 text-xs text-gray-500 truncate">{titleCase(item.job?.employers?.company_name)}</p>
                  <p className="mt-1 font-mono text-[11px] text-gray-500">
                    Applied on {new Date(item.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-mono text-[10px] tracking-wider px-3 py-1 rounded-full uppercase border ${
                      item.status === "Rejected" || item.status === "Terminated"
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
      </SectionCard>
    </>
  );
}

export default Dashboard;
