import { Link } from "react-router-dom";
import { getApplications } from "../utils/employerStore";

function StatusNode({ done, rejected, label, sub }) {
  return (
    <li className="relative pb-8 pl-8 last:pb-0">
      <div className="absolute left-0 top-1">
        {done ? (
          <span
            className={`flex items-center justify-center w-5 h-5 rounded-full ${
              rejected
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                : "bg-[#0075A2]/20 text-[#0075A2] border border-[#0075A2]/40"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${rejected ? "bg-rose-400" : "bg-[#0075A2]"}`} />
          </span>
        ) : (
          <span className="flex items-center justify-center w-5 h-5 rounded-full border border-white/20 bg-[#272727]">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
          </span>
        )}
      </div>

      <div>
        <p className={`text-sm font-medium ${done ? "text-white" : "text-white/40"}`}>
          {label}
        </p>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </li>
  );
}

function EmployerStatus() {
  const applications = getApplications();
  const application = applications[0];

  if (!application) {
    return (
      <div className="min-h-screen bg-[#272727] text-slate-100 flex flex-col font-sans">
        <header className="sticky top-0 z-20 bg-[#272727]/80 backdrop-blur border-b border-white/[0.06]">
          <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
            <Link to="/" className="text-[15px] font-semibold tracking-tight text-white">
              Job<span className="text-[#0075A2]">Linked</span>
            </Link>
            <span className="font-mono text-[11px] text-white/30">PESO · SANTA MARIA</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full text-center bg-[#272727] border border-white/[0.08] rounded-2xl p-8 shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in">
            <h1 className="text-xl font-bold text-white">No Application Found</h1>
            <p className="mt-3 text-sm text-white/55">
              You haven't submitted an employer accreditation application yet.
            </p>
            <Link
              to="/register/employer"
              className="inline-flex mt-6 min-h-[44px] items-center justify-center px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.2)]"
            >
              Register as Employer →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isApproved = application.status === "Approved";
  const isRejected = application.status === "Rejected";

  const submittedDate = new Date(application.submittedAt).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-[#272727] text-slate-100 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-[#272727]/80 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-[1280px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link to="/" className="text-[15px] font-semibold tracking-tight text-white">
            Job<span className="text-[#0075A2]">Linked</span>
          </Link>
          <span className="font-mono text-[11px] text-white/30">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg bg-[#272727] border border-white/[0.08] rounded-2xl p-7 md:p-9 shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in">
          {isRejected && application.note && (
            <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10">
              <p className="font-mono text-[10px] tracking-widest text-rose-400 uppercase font-semibold">
                Action Required
              </p>
              <p className="mt-1.5 text-xs text-rose-200/90 leading-relaxed">
                {application.note}
              </p>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 pb-6 border-b border-white/[0.06]">
            <div>
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#0075A2]">
                ACCREDITATION STATUS
              </span>
              <h1 className="mt-1 text-2xl font-bold text-white">
                {application.company}
              </h1>
              <p className="mt-1 text-xs text-white/45">
                Submitted {submittedDate}
              </p>
            </div>

            <span
              className={`shrink-0 font-mono text-[11px] tracking-wider px-3 py-1 rounded-full uppercase border ${
                isApproved
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : isRejected
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              {application.status === "Pending" ? "Under Review" : application.status}
            </span>
          </div>

          <ol className="mt-7 relative">
            <span
              className="absolute left-[9px] top-3 bottom-4 w-px bg-white/[0.08]"
              aria-hidden="true"
            />
            <StatusNode done label="Application Submitted" sub={<p className="text-xs text-white/45">Credentials and documents successfully received.</p>} />
            <StatusNode
              done
              label="Under PESO Review"
              sub={
                <p className="text-xs text-white/45">
                  Santa Maria PESO officers are evaluating business credentials and permit compliance.
                </p>
              }
            />
            {!isRejected && (
              <StatusNode
                done={isApproved}
                label="Municipal Accreditation Approved"
                sub={
                  isApproved ? (
                    <p className="text-xs text-emerald-400/90">
                      Accreditation granted. Your employer portal is active and you can now post verified job openings.
                    </p>
                  ) : undefined
                }
              />
            )}
            {isRejected && (
              <StatusNode
                done
                rejected
                label="Accreditation Rejected"
                sub={
                  <p className="text-xs text-rose-300">
                    {application.note || "Application did not meet accreditation criteria."}
                  </p>
                }
              />
            )}
          </ol>

          <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col gap-3">
            {isApproved && (
              <Link
                to="/employer/login"
                className="min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.2)]"
              >
                Access Employer Portal →
              </Link>
            )}
            {isRejected && (
              <Link
                to="/register/employer"
                className="min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.2)]"
              >
                Re-submit Documents
              </Link>
            )}
            <Link
              to="/"
              className="text-center text-xs text-white/45 hover:text-white transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
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

export default EmployerStatus;
