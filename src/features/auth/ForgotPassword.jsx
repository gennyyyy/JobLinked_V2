import { useState } from "react";
import { Link } from "react-router-dom";
import { resetPassword } from "../../shared/services/auth";
import SkipLink from "../../shared/components/SkipLink";
import PublicHeader from "../../shared/components/PublicHeader";
import PublicFooter from "../../shared/components/PublicFooter";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Could not send reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <SkipLink />
      <PublicHeader />

      <main id="main-content" tabIndex={-1}
        className="flex-1 flex items-center justify-center p-[5%]">
        <div className="w-full max-w-md bg-white border border-primary rounded-lg p-6 md:p-9 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <Link to="/portals" className="text-xs text-gray-500 hover:text-primary transition-colors">
              ← Back to Portals
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">
              Forgot Password
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">Reset Your Password</h1>
            <p className="mt-2 text-sm text-gray-500">Enter your email and we'll send you a reset link</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-3 rounded-lg">{error}</div>
            )}

            {success && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg">
                Check your email for reset instructions
              </div>
            )}

            <div>
              <label htmlFor="forgot-email" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                Email
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full mt-6 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default ForgotPassword;
