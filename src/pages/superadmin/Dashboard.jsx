import { Link } from "react-router-dom";
import { getApplications, getStats } from "../../utils/employerStore";
import { getAllUsers } from "../../data/users";
import { getJobs } from "../../utils/jobStore";

function Dashboard() {
  const applications = getApplications();
  const statsData = getStats();
  const users = getAllUsers();
  const jobs = getJobs();

  const totalJobSeekers = users.filter((u) => u.roleId === "job-seeker").length;
  const totalEmployers = users.filter((u) => u.roleId === "employer").length;
  const activeJobs = jobs.filter((j) => j.status === "Open").length;
  const totalApplications = jobs.reduce((sum, j) => sum + (j.applicantCount || 0), 0);

  const stats = [
    { label: "Job Seekers", value: totalJobSeekers, highlight: false },
    { label: "Pending Accreditation", value: statsData.pending, highlight: statsData.pending > 0 },
    { label: "Accredited Employers", value: statsData.approved, highlight: false },
    { label: "Active Job Posts", value: activeJobs, highlight: false },
    { label: "Total Employers", value: totalEmployers, highlight: false },
    { label: "Total Applications", value: totalApplications, highlight: false },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
          ADMINISTRATION OVERVIEW
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          PESO Operations Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Real-time municipal statistics, accreditations, and system activities
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
              <span className="inline-block mt-3 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Recent Applications */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Employer Applications
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Review and act on business accreditation requests
            </p>
          </div>
          <Link
            to="/super-admin/accreditation"
            className="text-xs font-mono text-[#0057B8] hover:underline underline-offset-4"
          >
            Manage all →
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No employer applications submitted yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {applications.slice(0, 5).map((application) => (
              <div
                key={application.id}
                className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {application.company}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 truncate">
                    {application.repFullName} · Barangay {application.barangay} ·{" "}
                    {new Date(application.submittedAt).toLocaleDateString("en-PH", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border ${
                    application.status === "Pending"
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : application.status === "Approved"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-danger/10 border-danger/20 text-danger"
                  }`}
                >
                  {application.status}
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
