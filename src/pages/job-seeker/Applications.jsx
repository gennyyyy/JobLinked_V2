import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { getApplicationsBySeeker } from "../../utils/jobStore";

function Applications() {
  const { user } = useAuth();
  const seekerEmail = user?.email || "";
  const applications = getApplicationsBySeeker(seekerEmail);

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          APPLICATION TRACKER
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          My Applications
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Live status of your submitted job applications with Santa Maria employers
        </p>
      </header>

      {applications.length === 0 ? (
        <div className="py-16 text-center bg-[#272727] border border-white/[0.06] rounded-2xl p-8">
          <p className="text-base text-white/70">You haven't submitted any job applications yet.</p>
          <p className="text-xs text-white/40 mt-1">Browse verified municipal listings and apply with a single tap.</p>
          <Link
            to="/job-seeker"
            className="inline-flex mt-6 min-h-[44px] items-center px-6 rounded-xl bg-[#0075A2] text-white text-xs font-medium hover:bg-[#005a7d] transition-colors shadow-[0_4px_16px_rgba(0,117,162,0.2)]"
          >
            Explore Openings →
          </Link>
        </div>
      ) : (
        <div className="bg-[#272727] border border-white/[0.06] rounded-2xl p-6 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
          <div className="divide-y divide-white/[0.04]">
            {applications.map((application) => (
              <div
                key={application.id}
                className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-white truncate">
                    {application.jobTitle}
                  </h2>
                  <p className="mt-1 text-xs text-white/60 font-medium">
                    {application.company}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-white/40">
                    Applied on {application.applied}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                  <span
                    className={`font-mono text-[10px] tracking-wider px-3 py-1 rounded-full uppercase border ${
                      application.status === "Shortlisted"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : application.status === "Rejected"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    }`}
                  >
                    {application.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Applications;
