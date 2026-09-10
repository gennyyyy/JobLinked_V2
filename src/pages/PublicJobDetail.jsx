import { Link, Navigate, useParams } from "react-router-dom";
import { getJobById } from "../utils/jobStore";

function PublicJobDetail() {
  const { jobId } = useParams();
  const job = getJobById(jobId);

  if (!job) {
    return <Navigate to="/jobs" replace />;
  }

  return (
    <div className="min-h-screen bg-[#272727] text-slate-100 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-[#272727]/80 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link to="/" className="text-[15px] font-semibold tracking-tight text-white">
            Job<span className="text-[#0075A2]">Linked</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/register"
              className="text-xs text-white/60 hover:text-white transition-colors"
            >
              Register
            </Link>
            <Link
              to="/portals"
              className="min-h-[36px] inline-flex items-center px-4 rounded-xl bg-[#0075A2] text-white text-xs font-medium hover:bg-[#005a7d] transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1000px] w-full mx-auto px-6 py-10 md:py-14 animate-fade-in">
        <Link
          to="/jobs"
          className="inline-flex items-center text-xs text-white/50 hover:text-white transition-colors mb-6"
        >
          ← Back to all postings
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
              <p className="mt-1 text-sm text-white/60 font-medium">
                {job.company}
              </p>
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
              <p className="font-mono text-[10px] tracking-widest uppercase text-white/40">PESO Verification</p>
              <p className="mt-1 text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Verified Active
              </p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-3">
              Job Description
            </h2>
            <p className="text-sm md:text-base text-white/60 leading-relaxed whitespace-pre-line">
              {job.description || "No description provided for this opening."}
            </p>
          </section>

          {job.requirements && job.requirements.length > 0 && (
            <section className="mt-8">
              <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-3">
                Key Requirements & Qualifications
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
              <p className="text-sm font-medium text-white">Interested in this position?</p>
              <p className="text-xs text-white/40 mt-0.5">Apply online through your PESO Job Seeker account.</p>
            </div>

            <Link
              to="/job-seeker/login"
              className="min-h-[44px] inline-flex items-center px-7 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.25)]"
            >
              Log in to Apply →
            </Link>
          </div>
        </article>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#060608] text-white/30">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/60 font-medium">
            Job<span className="text-[#0075A2]">Linked</span> <span className="text-white/40">PESO</span>
          </span>
          <span>Santa Maria Municipal Hall · hello@joblinked.ph</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default PublicJobDetail;
