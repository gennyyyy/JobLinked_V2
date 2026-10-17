import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../shared/lib/supabase";
import SkipLink from "../../shared/components/SkipLink";
import PublicHeader from "../../shared/components/PublicHeader";
import PublicFooter from "../../shared/components/PublicFooter";

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate("/portals");
    } catch (err) {
      setError(err.message || "Could not reset password. The link may have expired.");
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
            <Link to="/portals" className="text-xs text-gray-600 hover:text-primary transition-colors">
              ← Portals
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">
              Reset Password
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">Set a New Password</h1>
            <p className="mt-2 text-sm text-gray-500">Enter your new password below</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-3 rounded-lg">{error}</div>
            )}

            <div>
              <label htmlFor="reset-password" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                New Password
              </label>
              <input
                id="reset-password"
                name="password"
                type="password"
                placeholder="Min. 8 characters"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                Confirm Password
              </label>
              <input
                id="reset-confirm"
                name="confirm"
                type="password"
                placeholder="Re-enter password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full mt-6 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save New Password"}
            </button>
          </form>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default ResetPassword;
