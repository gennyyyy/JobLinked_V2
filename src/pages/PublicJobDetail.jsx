import { Link, Navigate, useParams } from "react-router-dom";
import { getJobById } from "../utils/jobStore";

function PublicJobDetail() {
  const { jobId } = useParams();
  const job = getJobById(jobId);

  if (!job) {
    return <Navigate to="/jobs" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link to="/" className="text-[15px] font-semibold tracking-tight text-gray-900">
            Job<span className="text-[#0057B8]">Linked</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/register"
              className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              Register
            </Link>
            <Link
              to="/portals"
              className="min-h-[36px] inline-flex items-center px-4 rounded-xl bg-[#0057B8] text-white text-xs font-medium hover:bg-[#004a9e] transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1000px] w-full mx-auto px-6 py-10 md:py-14 animate-fade-in">
        <Link
          to="/jobs"
          className="inline-flex items-center text-xs text-gray-500 hover:text-gray-900 transition-colors mb-6"
        >
          ← Back to all postings
        </Link>

        <article className="bg-white border border-gray-200 rounded-2xl p-7 md:p-10 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-gray-200">
            <div>
              <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">
                {job.location} · {job.type}
              </span>
              <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">
                {job.title}
              </h1>
              <p className="mt-1 text-sm text-gray-500 font-medium">
                {job.company}
              </p>
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
              <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">PESO Verification</p>
              <p className="mt-1 text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Verified Active
              </p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">
              Job Description
            </h2>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed whitespace-pre-line">
              {job.description || "No description provided for this opening."}
            </p>
          </section>

          {job.requirements && job.requirements.length > 0 && (
            <section className="mt-8">
              <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">
                Key Requirements & Qualifications
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
              <p className="text-sm font-medium text-gray-900">Interested in this position?</p>
              <p className="text-xs text-gray-400 mt-0.5">Apply online through your PESO Job Seeker account.</p>
            </div>

            <Link
              to="/job-seeker/login"
              className="min-h-[44px] inline-flex items-center px-7 rounded-xl bg-[#0057B8] text-white text-sm font-medium hover:bg-[#004a9e] active:scale-[0.98] transition-all shadow-sm"
            >
              Log in to Apply →
            </Link>
          </div>
        </article>
      </main>

      <footer className="border-t border-gray-200 bg-dark-blue text-white/30">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/60 font-medium">
            Job<span className="text-[#0057B8]">Linked</span> <span className="text-white/40">PESO</span>
          </span>
          <span>Santa Maria Municipal Hall · hello@joblinked.ph</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default PublicJobDetail;
