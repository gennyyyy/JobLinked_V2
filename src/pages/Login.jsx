import { useState } from "react";
import Logo from "../assets/Logo.png";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getPortal } from "../data/portals";
import { findAccountByEmail } from "../utils/userStore";
import useAuth from "../hooks/useAuth";

function Login({ portalKey }) {
  const portal = getPortal(portalKey);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!portal) {
    return <Navigate to="/" replace />;
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const account = findAccountByEmail(email);
    if (!account || account.password !== password) {
      setError("Invalid email or password");
      return;
    }
    if (account.role !== portal.key) {
      setError("This account does not belong to this portal");
      return;
    }

    login(portal.key, {
      email: account.email,
      name: account.name || `${account.firstName || ""} ${account.lastName || ""}`.trim() || account.email,
    });
    if (portal.homePath) {
      navigate(portal.homePath);
    }
  }

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

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <Link to="/portals" className="text-xs text-gray-400 hover:text-primary transition-colors">
              ← Portals
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">
              {portal.key.replace("-", " ")}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">
              {portal.name}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Sign in with your credentials to access your portal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {portal.fields.map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={`login-${field.name}`}
                  className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5"
                >
                  {field.label}
                </label>
                <input
                  id={`login-${field.name}`}
                  name={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  required
                  value={field.name === "email" ? email : password}
                  onChange={(e) =>
                    field.name === "email"
                      ? setEmail(e.target.value)
                      : setPassword(e.target.value)
                  }
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
            ))}

            <button
              type="submit"
              className="w-full mt-6 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md"
            >
              Sign In
            </button>
          </form>

          {portal.key !== "super-admin" && (
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>Don't have an account?</span>
              <Link
                to="/register"
                className="text-primary hover:underline underline-offset-4 font-medium"
              >
                Register here
              </Link>
            </div>
          )}
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

export default Login;
