import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getProfile, signOut as apiSignOut } from '../services/auth';

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (sessionUser) => {
    if (!sessionUser) { setUser(null); return; }
    try {
      const profile = await getProfile(sessionUser.id);
      setUser(profile ? { ...sessionUser, ...profile } : null);
    } catch {
      setUser(null);
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
        setUser(null);
        setLoading(false);
        return;
      }
      loadProfile(session.user).finally(() => active && setLoading(false));
    });
    return () => { active = false; subscription.unsubscribe(); };
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
