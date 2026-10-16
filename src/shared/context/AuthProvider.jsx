import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getProfile, signOut as apiSignOut } from '../services/auth';

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const signedInId = useRef(null);
  // Every profile load takes a ticket. When the ticket no longer matches, a
  // newer load (or a sign-out) already decided the state — the late response
  // is stale and must not overwrite it (user A's slow reply vs. user B).
  const loadSeq = useRef(0);

  const loadProfile = useCallback(async (sessionUser) => {
    if (!sessionUser) { setUser(null); return; }
    const seq = ++loadSeq.current;
    try {
      const profile = await getProfile(sessionUser.id);
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
      setUser((current) => {
        const unchanged = current && profile
          && Object.keys(profile).every((key) => JSON.stringify(profile[key]) === JSON.stringify(current[key]));
        if (unchanged) return current;
        return profile ? { ...sessionUser, ...profile } : null;
      });
    } catch {
      // A failed refetch is not a logout — the Supabase session is still valid.
      // Only clear when we never had a user; otherwise keep the session alive so
      // a dropped packet after a save can't bounce the user to the login page.
      if (seq !== loadSeq.current) return;
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
        setLoading(false);
        return;
      }
      // Supabase re-emits SIGNED_IN on every tab focus. When the signed-in user
      // is unchanged we already have the profile: skip it. Emitting a new `user`
      // object would restart every page's `useEffect([user])` refetch and flash
      // the loading screen for data that is already on screen.
      if (signedInId.current === session.user.id) return;
      signedInId.current = session.user.id;
      loadProfile(session.user).finally(() => active && setLoading(false));
    });
    return () => { active = false; signedInId.current = null; subscription.unsubscribe(); };
  }, [loadProfile]);

  const logout = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      setUser(null);
    }
  }, []);

  const value = { user, role: user?.role || null, loading, logout, refreshUser: loadProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
