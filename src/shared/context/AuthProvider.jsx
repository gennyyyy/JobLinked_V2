import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getProfile, signOut as apiSignOut } from '../services/auth';

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Distinguish "no session" from "session exists but no local profile row yet".
  // The recovery page (/complete-registration) needs to know both: there IS a
  // Supabase session (don't sign out) but there is no profile (can't route to a
  // portal). `needsProvisioning` is true only in that exact gap.
  const [needsProvisioning, setNeedsProvisioning] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const signedInId = useRef(null);
  // Every profile load takes a ticket. When the ticket no longer matches, a
  // newer load (or a sign-out) already decided the state — the late response
  // is stale and must not overwrite it (user A's slow reply vs. user B).
  const loadSeq = useRef(0);

  const loadProfile = useCallback(async (sessUser) => {
    if (!sessUser) {
      setUser(null);
      setNeedsProvisioning(false);
      setSessionUser(null);
      return;
    }
    // Bail unless this load targets the currently signed-in user, so a stale
    // session object can't overwrite a newer sign-in (Task 9).
    if (signedInId.current && sessUser.id !== signedInId.current) return;
    const seq = ++loadSeq.current;
    try {
      const profile = await getProfile(sessUser.id);
      if (seq !== loadSeq.current) return;
      // A refetch that returns identical data must not mint a new `user`
      // object: ~16 pages fetch from `useEffect(..., [user])`, so every
      // `refreshUser()` after a save would re-run those fetches and rebuild
      // every form for data nobody changed (keystrokes in that window are
      // lost). Compare the fetched values against the ones we already hold
      // and keep the current object when nothing moved.
      // JSON.stringify covers non-primitive fields (`skills` is an array)
      // without a deep-equal helper; a mere key-order difference just falls
      // through to the normal update below.
      if (!profile) {
        // Session is valid but no local profile row yet — surface that to
        // ProtectedRoute and Login so they can route to /complete-registration
        // instead of bouncing the visitor to /login or signing them out.
        setNeedsProvisioning(true);
        setSessionUser({ id: sessUser.id, email: sessUser.email });
        setUser(null);
        return;
      }
      setNeedsProvisioning(false);
      setSessionUser(null);
      setUser((current) => {
        const unchanged = current && profile
          && Object.keys(profile).every((key) => JSON.stringify(profile[key]) === JSON.stringify(current[key]));
        if (unchanged) return current;
        return { ...sessUser, ...profile };
      });
    } catch (e) {
      if (seq !== loadSeq.current) return;
      signedInId.current = null;
      // Clear the user on auth failures so a revoked/expired session can't
      // linger (Task 9 / Task 42).
      if (e?.status === 401 || e?.status === 403) {
        setUser(null);
        setNeedsProvisioning(false);
        setSessionUser(null);
        return;
      }
      setUser((current) => (current ? current : null));
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Session is not persisted — no localStorage restore needed.
    // onAuthStateChange fires INITIAL_SESSION on mount with null when there
    // is no active session, so loading is driven entirely from there.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        signedInId.current = null;
        // Supersede any in-flight profile fetch so a late response can't
        // resurrect the signed-out user.
        loadSeq.current += 1;
        setUser(null);
        setNeedsProvisioning(false);
        setSessionUser(null);
        setLoading(false);
        return;
      }
      // Supabase re-emits SIGNED_IN on every tab focus. When the signed-in user
      // is unchanged we already have the profile: skip it. Emitting a new `user`
      // object would restart every page's `useEffect([user])` refetch and flash
      // the loading screen for data that is already on screen.
      if (signedInId.current === session.user.id) return;
      signedInId.current = session.user.id;
      // Hold guards on the loading screen until the profile arrives. Without
      // this, a fresh sign-in leaves `loading` false (it was settled by the
      // initial anonymous session), so ProtectedRoute sees user=null and
      // bounces straight back to the login page before /auth/me resolves.
      setLoading(true);
      loadProfile(session.user).finally(() => active && setLoading(false));
    });
    return () => { active = false; signedInId.current = null; subscription.unsubscribe(); };
  }, [loadProfile]);

  // Seed the provider with a profile the caller already resolved (signIn).
  // Supersedes any in-flight SIGNED_IN fetch so a stale null cannot win, and
  // avoids a second /auth/me round-trip on the critical login path.
  const authenticate = useCallback((nextUser) => {
    loadSeq.current += 1;
    signedInId.current = nextUser?.id || null;
    setUser(nextUser || null);
    // A seeded profile means provisioning is complete (or was never needed).
    setNeedsProvisioning(false);
    setSessionUser(null);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      // Supersede any in-flight profile fetch so a late response can't
      // resurrect the signed-out user (Task 3).
      loadSeq.current += 1;
      signedInId.current = null;
      setUser(null);
      setNeedsProvisioning(false);
      setSessionUser(null);
    }
  }, []);

  const value = {
    user,
    role: user?.role || null,
    loading,
    logout,
    refreshUser: loadProfile,
    authenticate,
    needsProvisioning,
    sessionUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
