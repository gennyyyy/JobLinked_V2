import { useState } from "react";
import Logo from "../assets/TextBased Logo.png";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { signIn } from "../services/auth";
import { PORTALS } from "../constants";
import useAuth from "../hooks/useAuth";

function Login({ portalKey }) {
  const portal = PORTALS.find((p) => p.key === portalKey);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!portal) return <Navigate to="/" replace />;
  if (user) return <Navigate to={portal.homePath} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const loggedIn = await signIn(email.trim(), password);
      navigate(PORTALS.find((p) => p.key === loggedIn.role)?.homePath || "/");
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-dark-blue border-b border-white/10 shadow-sm">
        <div className="w-full px-4 h-[64px] flex items-center justify-between">
<div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
              <Link to="/"><img src={Logo} alt="JobLinked" className="h-10" /></Link>
            </div>
          <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-[3%]">
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
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">{portal.name}</h1>
            <p className="mt-2 text-sm text-gray-500">Sign in with your credentials to access your portal</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-3 rounded-lg">{error}</div>
            )}

            <div>
              <label htmlFor="login-email" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="Your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full mt-6 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {portal.key !== "super-admin" && (
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>Don't have an account?</span>
              <Link to={`/register/${portal.key}`} className="text-primary hover:underline underline-offset-4 font-medium">
                Register here
              </Link>
            </div>
          )}

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline underline-offset-4 font-medium">
              Forgot password?
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-dark-blue text-white">
        <div className="w-full px-4 py-3 flex flex-col sm:flex-row justify-between gap-2 text-xs font-mono">
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
