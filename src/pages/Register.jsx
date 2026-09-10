import { Link } from "react-router-dom";

const accountTypes = [
  {
    to: "/register/job-seeker",
    title: "Job Seeker",
    badge: "FREE APPLICANT ACCOUNT",
    description:
      "Create an account to browse Santa Maria verified openings, apply in one tap without walk-ins, and track your PESO status live.",
    cta: "Register as Job Seeker",
  },
  {
    to: "/register/employer",
    title: "Employer",
    badge: "BUSINESS ACCREDITATION",
    description:
      "Post job openings, reach local barangay talent, and review applicant credentials. Requires municipal accreditation review.",
    cta: "Register as Employer",
  },
];

function Register() {
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

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-16">
        <div className="w-full max-w-4xl">
          <header className="text-center mb-10 md:mb-12 animate-fade-in">
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
              NEW REGISTRATION
            </p>
            <h1 className="mt-3 font-sans text-3xl md:text-4xl font-bold tracking-tight text-white">
              Create your account
            </h1>
            <p className="mt-3 text-sm md:text-base text-white/55">
              Select your role to begin registration with the Public Employment Service Office
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {accountTypes.map((type) => (
              <div
                key={type.title}
                className="bg-[#272727] border border-white/[0.06] rounded-2xl p-8 flex flex-col justify-between hover:border-[#0075A2]/40 hover:-translate-y-1 transition-all duration-300 shadow-[0_16px_48px_rgba(0,0,0,0.3)]"
              >
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#0075A2]/10 border border-[#0075A2]/25 text-[#0075A2]">
                    {type.badge}
                  </span>
                  <h2 className="mt-4 text-2xl font-bold text-white">
                    {type.title}
                  </h2>
                  <p className="mt-3 text-sm text-white/55 leading-relaxed">
                    {type.description}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/[0.06]">
                  <Link
                    to={type.to}
                    className="w-full min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.2)]"
                  >
                    {type.cta} →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-white/40 animate-fade-in">
            Already have an account?{" "}
            <Link to="/portals" className="text-[#0075A2] hover:underline underline-offset-4 font-medium">
              Log in to your portal
            </Link>
          </p>
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

export default Register;
