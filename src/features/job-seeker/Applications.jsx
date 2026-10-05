import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../shared/hooks/useAuth";
import { listBySeeker } from "../../shared/services/applications";
import LoadingScreen from "../../shared/components/LoadingScreen";

function Applications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    listBySeeker(user.id)
      .then(setApplications)
      .catch((err) => setError(err.message || "Failed to load applications"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  const acceptedCount = applications.filter((application) => ["Accepted", "Placed"].includes(application.status)).length;
  const shortlistedCount = applications.filter((application) => application.status === "Shortlisted").length;
  const rejectedCount = applications.filter((application) => application.status === "Rejected").length;
  const toggleFilter = (next) => setStatusFilter((prev) => (prev === next ? "all" : next));
  const filtered = applications.filter((application) =>
    statusFilter === "all" ||
    (statusFilter === "accepted" ? ["Accepted", "Placed"].includes(application.status) : statusFilter === "shortlisted" ? application.status === "Shortlisted" : application.status === "Rejected")
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">APPLICATION TRACKER</p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">My Applications</h1>
        <p className="mt-2 text-sm text-gray-500">Live status of your submitted job applications with Santa Maria employers</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button type="button" onClick={() => toggleFilter("all")} aria-pressed={statusFilter === "all"} title="Show all applications"
          className={`rounded-2xl p-5 text-left cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] bg-white border ${statusFilter === "all" ? "border-primary ring-1 ring-primary/30" : "border-gray-200 hover:border-gray-300"}`}>
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Total</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{applications.length}</p>
          <p className="mt-1 text-xs text-gray-400">All submitted applications</p>
        </button>
        <button type="button" onClick={() => toggleFilter("accepted")} aria-pressed={statusFilter === "accepted"} title="Show accepted applications"
          className={`rounded-2xl p-5 text-left cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] bg-emerald-50 border ${statusFilter === "accepted" ? "border-emerald-600 ring-1 ring-emerald-600/30" : "border-emerald-200 hover:border-emerald-300"}`}>
          <p className="font-mono text-[10px] tracking-widest uppercase text-emerald-700">Accepted</p>
          <p className="mt-2 text-3xl font-bold text-emerald-800">{acceptedCount}</p>
          <p className="mt-1 text-xs text-emerald-700/70">Accepted or placed applications</p>
        </button>
        <button type="button" onClick={() => toggleFilter("shortlisted")} aria-pressed={statusFilter === "shortlisted"} title="Show shortlisted applications"
          className={`rounded-2xl p-5 text-left cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] bg-amber-50 border ${statusFilter === "shortlisted" ? "border-amber-600 ring-1 ring-amber-600/30" : "border-amber-200 hover:border-amber-300"}`}>
          <p className="font-mono text-[10px] tracking-widest uppercase text-amber-700">Shortlisted</p>
          <p className="mt-2 text-3xl font-bold text-amber-800">{shortlistedCount}</p>
          <p className="mt-1 text-xs text-amber-700/70">Shortlisted applications</p>
        </button>
        <button type="button" onClick={() => toggleFilter("rejected")} aria-pressed={statusFilter === "rejected"} title="Show rejected applications"
          className={`rounded-2xl p-5 text-left cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] bg-red-50 border ${statusFilter === "rejected" ? "border-red-500 ring-1 ring-red-500/30" : "border-red-200 hover:border-red-300"}`}>
          <p className="font-mono text-[10px] tracking-widest uppercase text-red-700">Rejected</p>
          <p className="mt-2 text-3xl font-bold text-red-800">{rejectedCount}</p>
          <p className="mt-1 text-xs text-red-700/70">Applications not selected</p>
        </button>
      </div>

      {applications.length === 0 ? (
        <div className="py-16 text-center bg-white border border-gray-200 rounded-2xl p-8">
          <p className="text-base text-gray-600">You haven't submitted any job applications yet.</p>
          <p className="text-xs text-gray-400 mt-1">Browse verified municipal listings and apply with a single tap.</p>
          <Link to="/job-seeker/jobs" className="inline-flex mt-6 min-h-[44px] items-center px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors shadow-sm">
            Explore Openings →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No applications match this filter.{" "}
              <button onClick={() => setStatusFilter("all")} className="text-primary hover:underline underline-offset-4 font-medium">Clear filter</button>
            </div>
          ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((application) => (
              <div
                key={application.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId((current) => current === application.id ? null : application.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId((current) => current === application.id ? null : application.id);
                  }
                }}
                className="py-5 first:pt-0 last:pb-0 px-3 -mx-3 rounded-xl cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 truncate">{application.job?.title}</h2>
                  <p className="mt-1 text-xs text-gray-500 font-medium">{application.job?.employers?.company_name}</p>
                  <p className="mt-1 font-mono text-[11px] text-gray-400">
                    Applied on {new Date(application.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {application.interview_at && (
                    <p className="mt-1 text-xs text-primary font-medium">
                      Interview: {new Date(application.interview_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                  <span
                    className={`font-mono text-[10px] tracking-wider px-3 py-1 rounded-full uppercase border ${
                      application.status === "Shortlisted" || application.status === "Accepted"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : application.status === "Rejected" || application.status === "Terminated"
                          ? "bg-danger/10 border-danger/20 text-danger"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}
                  >
                    {application.status}
                  </span>
                </div>
                </div>
                {selectedId === application.id && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15 text-sm">
                    <div>
                      <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Interview</p>
                      <p className="mt-1 text-gray-700 font-medium">
                        {application.interview_at ? new Date(application.interview_at).toLocaleString() : "No interview scheduled yet"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Interview instructions</p>
                      <p className="mt-1 text-gray-700 whitespace-pre-line">{application.interview_instructions || "No instructions provided"}</p>
                    </div>
                    {application.employer_notes && (
                      <div className="md:col-span-2">
                        <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Employer note</p>
                        <p className="mt-1 text-gray-700 whitespace-pre-line">{application.employer_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Applications;
