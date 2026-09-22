import { Link } from "react-router-dom";
import Logo from "../assets/Logo.png";
import { portals } from "../data/portals";

function PortalSelect() {
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
        <div className="w-full max-w-5xl">
          <div className="text-center max-w-xl mx-auto mb-10 md:mb-12 animate-fade-in">
            <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">
              PORTAL SELECTION
            </p>
            <h1 className="mt-3 font-sans text-3xl md:text-4xl font-bold tracking-tight text-dark-blue">
              Choose your role
            </h1>
            <p className="mt-3 text-sm md:text-base text-gray-500">
              Access the Santa Maria PESO platform according to your account type
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {portals.map((portal) => (
              <Link
                key={portal.key}
                to={portal.path}
                className="group relative bg-white border border-gray-200 rounded-2xl p-7 hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold">
                      {portal.key.replace("-", " ")}
                    </span>
                    <span className="text-gray-300 group-hover:text-primary transition-colors text-sm">
                      ↗
                    </span>
                  </div>

                  <h2 className="text-xl font-semibold text-dark-blue group-hover:text-primary transition-colors">
                    {portal.name}
                  </h2>

                  <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                    {portal.description}
                  </p>
                </div>

                <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600 group-hover:text-primary transition-colors">
                    Log in to portal
                  </span>
                  <span className="text-xs text-primary group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center animate-fade-in">
            <p className="text-xs text-gray-400">
              Don't have an account yet?{" "}
              <Link to="/register" className="text-primary hover:underline underline-offset-4 font-medium">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-dark-blue text-white">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
          <span className="text-white/80 font-medium">
            Job<span className="text-accent">Linked</span> <span className="text-white/50">PESO</span>
          </span>
          <span className="text-white/50">Municipal Hall, Poblacion · hello@joblinked.ph</span>
          <span className="text-white/50">© 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default PortalSelect;
