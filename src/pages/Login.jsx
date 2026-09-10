import { Link, Navigate, useNavigate } from "react-router-dom";
import { getPortal } from "../data/portals";
import useAuth from "../hooks/useAuth";

function Login({ portalKey }) {
  const portal = getPortal(portalKey);
  const navigate = useNavigate();
  const { login } = useAuth();

  if (!portal) {
    return <Navigate to="/" replace />;
  }

  function handleSubmit(event) {
    event.preventDefault();

    let user = null;
    if (portal.key === "job-seeker") {
      user = { email: "seeker@gmail.com", name: "John Doe" };
    } else if (portal.key === "employer") {
      user = { email: "employer@company.com", name: "Company HR" };
    } else if (portal.key === "super-admin") {
      user = { email: "admin@peso.gov.ph", name: "Super Admin" };
    }

    login(portal.key, user);
    if (portal.homePath) {
      navigate(portal.homePath);
    }
  }

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
        <div className="w-full max-w-md bg-[#272727] border border-white/[0.08] rounded-2xl p-7 md:p-9 shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/portals"
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              ← Portals
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#0075A2]/10 border border-[#0075A2]/25 text-[#0075A2]">
              {portal.key.replace("-", " ")}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {portal.name}
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Sign in with your credentials to access your portal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {portal.fields.map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={`login-${field.name}`}
                  className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5"
                >
                  {field.label}
                </label>
                <input
                  id={`login-${field.name}`}
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  required
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>
            ))}

            <button
              type="submit"
              className="w-full mt-6 min-h-[44px] px-6 rounded-xl bg-[#0075A2] text-white text-sm font-medium hover:bg-[#005a7d] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.25)]"
            >
              Sign In
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/40">
            <span>Don't have an account?</span>
            <Link
              to="/register"
              className="text-[#0075A2] hover:underline underline-offset-4 font-medium"
            >
              Register here
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

export default Login;
