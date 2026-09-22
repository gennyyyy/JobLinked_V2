import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { getJobById, addApplication, getApplicationsBySeeker } from "../../utils/jobStore";

function JobDetail() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const job = getJobById(jobId);
  const seekerEmail = user?.email || "";
  const [alreadyApplied, setAlreadyApplied] = useState(() =>
    getApplicationsBySeeker(seekerEmail).some((app) => app.jobId === String(jobId)),
  );

  if (!job) {
    return <Navigate to="/job-seeker" replace />;
  }

  function handleApply() {
    const result = addApplication({
      jobId: String(job.id),
      jobTitle: job.title,
      company: job.company,
      companyEmail: job.companyEmail || null,
      seekerEmail,
      seekerName: user?.name || "Job Seeker",
    });
    if (result) {
      setAlreadyApplied(true);
    }
  }

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <Link
        to="/job-seeker"
        className="inline-flex items-center text-xs text-gray-500 hover:text-gray-900 transition-colors"
      >
        ← Back to all jobs
      </Link>

      <article className="bg-white border border-gray-200 rounded-2xl p-7 md:p-10 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#0057B8]/10 border border-[#0057B8]/25 text-[#0057B8]">
              {job.location} · {job.type}
            </span>
            <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
              {job.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500 font-medium">{job.company}</p>
          </div>

          <span className="inline-flex px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 font-mono text-sm text-primary font-semibold self-start">
            {job.salary || "Negotiable"}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl bg-gray-50 border border-gray-200">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Compensation</p>
            <p className="mt-1 font-mono text-sm text-gray-900 font-medium">{job.salary || "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Location</p>
            <p className="mt-1 text-sm text-gray-900 font-medium">Brgy. {job.location}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Date Posted</p>
            <p className="mt-1 text-sm text-gray-600">{job.posted}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Listing Status</p>
            <p className="mt-1 text-sm text-emerald-600 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Verified Open
            </p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">
            Position Overview
          </h2>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed whitespace-pre-line">
            {job.description || "No description provided for this opening."}
          </p>
        </section>

        {job.requirements && job.requirements.length > 0 && (
          <section className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">
              Role Requirements
            </h2>
            <ul className="space-y-2.5">
              {job.requirements.map((requirement) => (
                <li key={requirement} className="text-sm text-gray-600 flex items-start gap-3">
                  <span className="text-[#0057B8] mt-0.5">▪</span>
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            {alreadyApplied ? (
              <span className="font-mono text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                ✓ Application submitted — track updates in "My Applications"
              </span>
            ) : (
              <p className="text-xs text-gray-400">
                Submitting forwards your registered JobLinked profile to the employer.
              </p>
            )}
          </div>

          {!alreadyApplied ? (
            <button
              onClick={handleApply}
              className="min-h-[44px] px-8 rounded-xl bg-primary text-white text-sm font-medium hover:bg-[#004a9e] active:scale-[0.98] transition-all shadow-md"
            >
              Submit Application
            </button>
          ) : (
            <Link
              to="/job-seeker/applications"
              className="min-h-[44px] inline-flex items-center px-6 rounded-xl border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors"
            >
              View Application Status →
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}

export default JobDetail;
