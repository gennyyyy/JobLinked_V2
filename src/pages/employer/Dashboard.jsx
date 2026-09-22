import { useState } from "react";
import useAuth from "../../hooks/useAuth";
import {
  getJobsByEmployer,
  getApplicationsByEmployer,
} from "../../utils/jobStore";

function Dashboard() {
  const { user } = useAuth();
  const companyEmail = user?.email || "";
  const companyName = user?.name || "My Company";

  const myJobs = getJobsByEmployer(companyEmail);
  const openPosts = myJobs.filter((job) => job.status === "Open");
  const applicants = getApplicationsByEmployer(companyEmail);
  const [today] = useState(() => Date.now());
  const newThisWeek = applicants.filter((app) => {
    const days = (today - new Date(app.appliedAt).getTime()) / 86400000;
    return days <= 7;
  }).length;

  const stats = [
    { label: "Active Listings", value: openPosts.length, highlight: false },
    { label: "Total Openings", value: myJobs.length, highlight: false },
    { label: "Total Candidates", value: applicants.length, highlight: false },
    { label: "New This Week", value: newThisWeek, highlight: newThisWeek > 0 },
  ];

  const recentApplicants = [...applicants]
    .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
    .slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
          EMPLOYER DASHBOARD
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          Overview for {companyName}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Real-time recruitment metrics and applicant tracking
        </p>
      </header>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-gray-300 transition-colors"
          >
            <p className="font-sans text-3xl md:text-4xl font-bold text-gray-900 leading-none">
              {stat.value}
            </p>
            <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-gray-400 uppercase">
              {stat.label}
            </p>
            {stat.highlight && (
              <span className="inline-block mt-3 w-2 h-2 rounded-full bg-[#0057B8] animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Recent Applicants Section */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Candidate Applications
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Latest job seekers who applied to your verified listings
            </p>
          </div>
        </div>

        {recentApplicants.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No applicant submissions received yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentApplicants.map((item) => (
              <div
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.seekerName}</p>
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    Applied for <span className="text-gray-600">{item.jobTitle}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-xs text-gray-400">{item.applied}</span>
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
