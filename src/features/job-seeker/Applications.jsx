import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../shared/hooks/useAuth";
import { listBySeeker } from "../../shared/services/applications";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { PageHeader, SectionCard } from "../../shared/components/dashboard";

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
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  const acceptedCount = applications.filter((application) => ["Accepted", "Placed"].includes(application.status)).length;
  const rejectedCount = applications.filter((application) => application.status === "Rejected").length;
  const pendingCount = applications.filter((application) => ["Applied", "Under Review", "Interview"].includes(application.status)).length;
  const toggleFilter = (next) => setStatusFilter((prev) => (prev === next ? "all" : next));
  const filtered = applications.filter((application) =>
    statusFilter === "all" ||
    (statusFilter === "accepted" ? ["Accepted", "Placed"].includes(application.status) : statusFilter === "pending" ? ["Applied", "Under Review", "Interview"].includes(application.status) : application.status === "Rejected")
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="APPLICATION TRACKER"
        title="My Applications"
        subtitle="Live status of your submitted job applications with Santa Maria employers"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { id: "all", label: "Total", value: applications.length, hint: "All submitted applications", title: "Show all applications" },
          { id: "accepted", label: "Accepted", value: acceptedCount, hint: "Accepted or placed applications", title: "Show accepted applications" },
          { id: "pending", label: "Pending", value: pendingCount, hint: "Awaiting employer review", title: "Show pending applications" },
          { id: "rejected", label: "Rejected", value: rejectedCount, hint: "Applications not selected", title: "Show rejected applications" },
        ].map((tile) => (
          <button key={tile.id} type="button" onClick={() => toggleFilter(tile.id)} aria-pressed={statusFilter === tile.id} title={tile.title}
            className={`rounded-lg p-4 text-left cursor-pointer transition-all hover: active:scale-[0.99] bg-white border ${statusFilter === tile.id ? "border-primary ring-1 ring-primary/30" : "border-primary hover:border-primary/60"}`}>
            <p className="font-sans text-2xl md:text-3xl font-bold text-primary leading-none">{tile.value}</p>
            <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-gray-500 uppercase">{tile.label}</p>
            <p className="mt-3 text-xs text-gray-400">{tile.hint}</p>
          </button>
        ))}
      </div>

      {applications.length === 0 ? (
        <SectionCard title="My Applications" subtitle="Browse verified municipal listings and apply with a single tap">
          <div className="py-8 text-center">
            <p className="text-base text-gray-600">You haven't submitted any job applications yet.</p>
            <Link to="/job-seeker/jobs" className="inline-flex mt-6 min-h-[44px] items-center px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors">
              Explore Openings →
            </Link>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="All Applications" subtitle="Latest submissions first">
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 truncate">{application.job?.title}</h2>
                  <p className="mt-1 text-xs text-gray-500 font-medium uppercase">{application.job?.employers?.company_name}</p>
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
                      application.status === "Accepted"
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
        </SectionCard>
      )}
    </div>
  );
}

export default Applications;
