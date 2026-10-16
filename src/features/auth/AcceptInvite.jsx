import { useEffect, useState } from "react";
import Logo from "../../assets/TextBased Logo.png";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../shared/lib/supabase";
import { getProfile, provision } from "../../shared/services/auth";
import useAuth from "../../shared/hooks/useAuth";
import LoadingScreen from "../../shared/components/LoadingScreen";

const INVALID = "This invite link is invalid or expired.";

function AcceptInvite() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session: sess }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!sess?.user) throw new Error(INVALID);

      let current = await getProfile(sess.user.id);
      if (!current) {
        current = await provision({ ...sess.user.user_metadata, email: sess.user.email });
      }
      if (!current?.role) throw new Error(INVALID);
      if (active) { setSession(sess); setProfile(current); }
    })().catch((err) => active && setError(err.message || INVALID));
    return () => { active = false; };
  }, []);

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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await refreshUser(session.user);
      navigate(`/${profile.role}`, { replace: true });
    } catch (err) {
      setError(err.message || "Could not set your password. The invite may have expired.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-lg border border-primary bg-white p-6 text-center shadow-xl">
          <h1 className="text-xl font-bold text-dark-blue">Invite link issue</h1>
          <p className="mt-3 text-sm text-gray-600">{error}</p>
          <Link to="/portals" className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-6 text-sm font-semibold text-white">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="sticky top-0 z-20 bg-dark-blue border-b border-white/10">
        <div className="w-full px-4 h-[64px] flex items-center justify-between">
          <div className="bg-white rounded-lg px-3.5 py-1.5 flex items-center shadow-xs">
            <Link to="/"><img src={Logo} alt="JobLinked" width={480} height={160} className="h-10" /></Link>
          </div>
          <span className="hidden sm:block font-mono text-[11px] text-gray-400">PESO · SANTA MARIA</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-[3%]">
        <div className="w-full max-w-md bg-white border border-primary rounded-lg p-6 md:p-9 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <Link to="/portals" className="text-xs text-gray-500 hover:text-primary transition-colors">
              ← Portals
            </Link>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">
              Welcome
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-dark-blue">Set your password</h1>
            <p className="mt-2 text-sm text-gray-500">
              Your invite is ready. Choose a password to activate your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-3 rounded-lg">{error}</div>
            )}

            <div>
              <label htmlFor="invite-password" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                New Password
              </label>
              <input
                id="invite-password"
                name="password"
                type="password"
                placeholder="Min. 8 characters"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div>
              <label htmlFor="invite-confirm" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                Confirm Password
              </label>
              <input
                id="invite-confirm"
                name="confirm"
                type="password"
                placeholder="Re-enter password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
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

export default AcceptInvite;
