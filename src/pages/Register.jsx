import { Link } from "react-router-dom";
import Logo from "../assets/Logo.png";

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
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={Logo} alt="JobLinked" className="w-9 h-9" />
            <div className="leading-none">
              <span className="text-lg font-extrabold tracking-tight text-dark-blue">JOB</span>
              <span className="text-lg font-extrabold tracking-tight text-primary">LINKED</span>
            </div>
          </Link>
          <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-16">
        <div className="w-full max-w-4xl">
          <header className="text-center mb-10 md:mb-12 animate-fade-in">
            <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">
              NEW REGISTRATION
            </p>
            <h1 className="mt-3 font-sans text-3xl md:text-4xl font-bold tracking-tight text-dark-blue">
              Create your account
            </h1>
            <p className="mt-3 text-sm md:text-base text-gray-500">
              Select your role to begin registration with the Public Employment Service Office
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {accountTypes.map((type) => (
              <div
                key={type.title}
                className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col justify-between hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
              >
                <div>
                  <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold">
                    {type.badge}
                  </span>
                  <h2 className="mt-4 text-2xl font-bold text-dark-blue">
                    {type.title}
                  </h2>
                  <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                    {type.description}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                  <Link
                    to={type.to}
                    className="w-full min-h-[44px] inline-flex items-center justify-center px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
                  >
                    {type.cta} →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-gray-400 animate-fade-in">
            Already have an account?{" "}
            <Link to="/portals" className="text-primary hover:underline underline-offset-4 font-medium">
              Log in to your portal
            </Link>
          </p>
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

export default Register;
