import { Link } from "react-router-dom";
import Logo from "../assets/Logo.png";
import { getApplications } from "../utils/employerStore";

function StatusNode({ done, rejected, label, sub }) {
  return (
    <li className="relative pb-8 pl-8 last:pb-0">
      <div className="absolute left-0 top-1">
        {done ? (
          <span
            className={`flex items-center justify-center w-5 h-5 rounded-full ${
              rejected
                ? "bg-danger/15 text-danger border border-danger/30"
                : "bg-primary/15 text-primary border border-primary/30"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${rejected ? "bg-danger" : "bg-primary"}`} />
          </span>
        ) : (
          <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-300 bg-white">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          </span>
        )}
      </div>

      <div>
        <p className={`text-sm font-medium ${done ? "text-gray-900" : "text-gray-400"}`}>
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

  const headerLogo = (
    <Link to="/" className="flex items-center gap-2">
      <img src={Logo} alt="JobLinked" className="w-9 h-9" />
      <div className="leading-none">
        <span className="text-lg font-extrabold tracking-tight text-dark-blue">JOB</span>
        <span className="text-lg font-extrabold tracking-tight text-primary">LINKED</span>
      </div>
    </Link>
  );

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
            {headerLogo}
            <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-xl animate-fade-in">
            <h1 className="text-xl font-bold text-dark-blue">No Application Found</h1>
            <p className="mt-3 text-sm text-gray-500">
              You haven't submitted an employer accreditation application yet.
            </p>
            <Link
              to="/register/employer"
              className="inline-flex mt-6 min-h-[44px] items-center justify-center px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
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
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
          {headerLogo}
          <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-xl animate-fade-in">
          {isRejected && application.note && (
            <div className="mb-6 p-4 rounded-xl border border-danger/20 bg-danger/5">
              <p className="font-mono text-[10px] tracking-widest text-danger uppercase font-semibold">
                Action Required
              </p>
              <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
                {application.note}
              </p>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 pb-6 border-b border-gray-100">
            <div>
              <span className="font-mono text-[10px] tracking-widest uppercase text-primary font-semibold">
                ACCREDITATION STATUS
              </span>
              <h1 className="mt-1 text-2xl font-bold text-dark-blue">
                {application.company}
              </h1>
              <p className="mt-1 text-xs text-gray-400">
                Submitted {submittedDate}
              </p>
            </div>

            <span
              className={`shrink-0 font-mono text-[11px] tracking-wider px-3 py-1 rounded-full uppercase border font-semibold ${
                isApproved
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                  : isRejected
                    ? "bg-danger/5 border-danger/20 text-danger"
                    : "bg-accent/20 border-accent/40 text-dark-blue"
              }`}
            >
              {application.status === "Pending" ? "Under Review" : application.status}
            </span>
          </div>

          <ol className="mt-7 relative">
            <span className="absolute left-[9px] top-3 bottom-4 w-px bg-gray-200" aria-hidden="true" />
            <StatusNode done label="Application Submitted" sub={<p className="text-xs text-gray-400">Credentials and documents successfully received.</p>} />
            <StatusNode
              done
              label="Under PESO Review"
              sub={<p className="text-xs text-gray-400">Santa Maria PESO officers are evaluating business credentials and permit compliance.</p>}
            />
            {!isRejected && (
              <StatusNode
                done={isApproved}
                label="Municipal Accreditation Approved"
                sub={
                  isApproved ? (
                    <p className="text-xs text-emerald-600">
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
                sub={<p className="text-xs text-danger">{application.note || "Application did not meet accreditation criteria."}</p>}
              />
            )}
          </ol>

          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
            {isApproved && (
              <Link to="/employer/login" className="min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md">
                Access Employer Portal →
              </Link>
            )}
            {isRejected && (
              <Link to="/register/employer" className="min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md">
                Re-submit Documents
              </Link>
            )}
            <Link to="/" className="text-center text-xs text-gray-400 hover:text-primary transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-dark-blue text-white">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/80 font-medium">
            Job<span className="text-accent">Linked</span> <span className="text-white/50">PESO</span>
          </span>
          <span className="text-white/50">Santa Maria Municipal Hall · hello@joblinked.ph</span>
          <span className="text-white/50">© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default EmployerStatus;
