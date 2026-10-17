import { Link } from "react-router-dom";
import { PORTALS } from "../../shared/constants";
import SkipLink from "../../shared/components/SkipLink";
import PublicHeader from "../../shared/components/PublicHeader";
import PublicFooter from "../../shared/components/PublicFooter";

function PortalSelect() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <SkipLink />
      <PublicHeader />

      <main id="main-content" tabIndex={-1}
        className="flex-1 flex flex-col items-center justify-center p-[5%]">
        <div className="w-full">
          <div className="text-center max-w-xl mx-auto mb-10 md:mb-12">
            <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">PORTAL SELECTION</p>
            <h1 className="mt-3 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">Choose your role</h1>
            <p className="mt-3 text-sm md:text-base text-gray-500">Access the Santa Maria PESO platform according to your account type</p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {PORTALS.map((portal) => (
              <Link
                key={portal.key}
                to={portal.path}
                className="group relative bg-white border border-primary rounded-lg p-6 hover:border-primary/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary font-semibold">
                      {portal.key.replace("-", " ")}
                    </span>
                    <span className="text-gray-300 group-hover:text-primary transition-colors text-sm">↗</span>
                  </div>
                  <h2 className="text-xl font-semibold text-dark-blue group-hover:text-primary transition-colors">{portal.name}</h2>
                  <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                    {portal.key === "super-admin" && "Full system administration: manage employers, accreditations, jobs, users, and settings."}
                    {portal.key === "employer" && "Post jobs, manage applicants, submit accreditation documents for PESO verification."}
                    {portal.key === "job-seeker" && "Browse verified job openings, manage your profile, and track applications."}
                  </p>
                </div>
                <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600 group-hover:text-primary transition-colors">Log in to portal</span>
                  <span className="text-xs text-primary group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-xs text-gray-500">
              Don't have an account yet?{" "}
              <Link to="/register" className="text-primary hover:underline underline-offset-4 font-medium">Register here</Link>
            </p>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default PortalSelect;
