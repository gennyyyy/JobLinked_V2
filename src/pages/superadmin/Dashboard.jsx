import { Link } from "react-router-dom";
import { getApplications, getStats } from "../../utils/employerStore";

function Dashboard() {
  const applications = getApplications();
  const statsData = getStats();

  const stats = [
    { label: "Total Employers", value: statsData.total, highlight: false },
    { label: "Pending Verification", value: statsData.pending, highlight: true },
    { label: "Accredited Employers", value: statsData.approved, highlight: false },
    { label: "Job Seekers Enrolled", value: statsData.total + 1284, highlight: false },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          ADMINISTRATION OVERVIEW
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          PESO Operations Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Real-time municipal statistics, accreditations, and system activities
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#272727] border border-white/[0.06] rounded-2xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.2)] hover:border-white/[0.12] transition-colors"
          >
            <p className="font-sans text-3xl md:text-4xl font-bold text-white leading-none">
              {stat.value}
            </p>
            <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-white/40 uppercase">
              {stat.label}
            </p>
            {stat.highlight && (
              <span className="inline-block mt-3 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      {/* Recent Applications */}
      <section className="bg-[#272727] border border-white/[0.06] rounded-2xl p-6 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Recent Employer Applications
            </h2>
            <p className="text-xs text-white/45 mt-0.5">
              Review and act on business accreditation requests
            </p>
          </div>
          <Link
            to="/super-admin/employers"
            className="text-xs font-mono text-[#0075A2] hover:underline underline-offset-4"
          >
            Manage all →
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="py-12 text-center text-sm text-white/40">
            No employer applications submitted yet.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {applications.slice(0, 5).map((application) => (
              <div
                key={application.id}
                className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {application.company}
                  </p>
                  <p className="mt-1 text-xs text-white/45 truncate">
                    {application.repFullName} · Barangay {application.barangay} ·{" "}
                    {new Date(application.submittedAt).toLocaleDateString("en-PH", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border ${
                    application.status === "Pending"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : application.status === "Approved"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
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
