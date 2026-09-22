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
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
          APPLICATION TRACKER
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          My Applications
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Live status of your submitted job applications with Santa Maria employers
        </p>
      </header>

      {applications.length === 0 ? (
        <div className="py-16 text-center bg-white border border-gray-200 rounded-2xl p-8">
          <p className="text-base text-gray-600">You haven't submitted any job applications yet.</p>
          <p className="text-xs text-gray-400 mt-1">Browse verified municipal listings and apply with a single tap.</p>
          <Link
            to="/job-seeker"
            className="inline-flex mt-6 min-h-[44px] items-center px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-[#004a9e] transition-colors shadow-sm"
          >
            Explore Openings →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="divide-y divide-gray-100">
            {applications.map((application) => (
              <div
                key={application.id}
                className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 truncate">
                    {application.jobTitle}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 font-medium">
                    {application.company}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-gray-400">
                    Applied on {application.applied}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                  <span
                    className={`font-mono text-[10px] tracking-wider px-3 py-1 rounded-full uppercase border ${
                      application.status === "Shortlisted"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : application.status === "Rejected"
                          ? "bg-danger/10 border-danger/20 text-danger"
                          : "bg-amber-50 border-amber-200 text-amber-700"
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
