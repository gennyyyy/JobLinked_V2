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
        className="inline-flex items-center text-xs text-white/50 hover:text-white transition-colors"
      >
        ← Back to all jobs
      </Link>

      <article className="bg-[#272727] border border-white/[0.08] rounded-2xl p-7 md:p-10 shadow-[0_24px_64px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#0075A2]/10 border border-[#0075A2]/25 text-[#0075A2]">
              {job.location} · {job.type}
            </span>
            <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight text-white">
              {job.title}
            </h1>
            <p className="mt-1 text-sm text-white/60 font-medium">{job.company}</p>
          </div>

          <span className="inline-flex px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] font-mono text-sm text-[#0075A2] font-semibold self-start">
            {job.salary || "Negotiable"}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-white/40">Compensation</p>
            <p className="mt-1 font-mono text-sm text-white font-medium">{job.salary || "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-white/40">Location</p>
            <p className="mt-1 text-sm text-white font-medium">Brgy. {job.location}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-white/40">Date Posted</p>
            <p className="mt-1 text-sm text-white/70">{job.posted}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-white/40">Listing Status</p>
            <p className="mt-1 text-sm text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Verified Open
            </p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-3">
            Position Overview
          </h2>
          <p className="text-sm md:text-base text-white/60 leading-relaxed whitespace-pre-line">
            {job.description || "No description provided for this opening."}
          </p>
        </section>

        {job.requirements && job.requirements.length > 0 && (
          <section className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-3">
              Role Requirements
            </h2>
            <ul className="space-y-2.5">
              {job.requirements.map((requirement) => (
                <li key={requirement} className="text-sm text-white/70 flex items-start gap-3">
                  <span className="text-[#0075A2] mt-0.5">▪</span>
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            {alreadyApplied ? (
              <span className="font-mono text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                ✓ Application submitted — track updates in "My Applications"
              </span>
            ) : (
              <p className="text-xs text-white/45">
                Submitting forwards your registered JobLinked profile to the employer.
              </p>
            )}
          </div>

          {!alreadyApplied ? (
            <button
              onClick={handleApply}
              className="min-h-[44px] px-8 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.25)]"
            >
              Submit Application
            </button>
          ) : (
            <Link
              to="/job-seeker/applications"
              className="min-h-[44px] inline-flex items-center px-6 rounded-xl border border-white/[0.12] text-white text-xs font-medium hover:bg-white/[0.05] transition-colors"
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
