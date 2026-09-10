import { Link } from "react-router-dom";
import { portals } from "../data/portals";

function PortalSelect() {
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
        <div className="w-full max-w-5xl">
          <div className="text-center max-w-xl mx-auto mb-10 md:mb-12 animate-fade-in">
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
              PORTAL SELECTION
            </p>
            <h1 className="mt-3 font-sans text-3xl md:text-4xl font-bold tracking-tight text-white">
              Choose your role
            </h1>
            <p className="mt-3 text-sm md:text-base text-white/55">
              Access the Santa Maria PESO platform according to your account type
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {portals.map((portal) => (
              <Link
                key={portal.key}
                to={portal.path}
                className="group relative bg-[#272727] border border-white/[0.06] rounded-2xl p-7 hover:border-[#0075A2]/40 hover:-translate-y-1 transition-all duration-300 shadow-[0_12px_32px_rgba(0,0,0,0.3)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#0075A2]/10 border border-[#0075A2]/25 text-[#0075A2]">
                      {portal.key.replace("-", " ")}
                    </span>
                    <span className="text-white/20 group-hover:text-[#0075A2] transition-colors text-sm">
                      ↗
                    </span>
                  </div>

                  <h2 className="text-xl font-semibold text-white group-hover:text-[#0075A2] transition-colors">
                    {portal.name}
                  </h2>

                  <p className="mt-3 text-sm text-white/55 leading-relaxed">
                    {portal.description}
                  </p>
                </div>

                <div className="mt-8 pt-5 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs font-medium text-white/80 group-hover:text-[#0075A2] transition-colors">
                    Log in to portal
                  </span>
                  <span className="text-xs text-[#0075A2] group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center animate-fade-in">
            <p className="text-xs text-white/40">
              Don't have an account yet?{" "}
              <Link to="/register" className="text-[#0075A2] hover:underline underline-offset-4">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#060608] text-white/30">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/60 font-medium">
            Job<span className="text-[#0075A2]">Linked</span> <span className="text-white/40">PESO</span>
          </span>
          <span>Municipal Hall, Poblacion · hello@joblinked.ph</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default PortalSelect;
