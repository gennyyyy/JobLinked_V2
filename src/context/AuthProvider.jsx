import { useState, useEffect, useCallback } from 'react';
import AuthContext from './AuthContext';
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        loadProfile(session.user).finally(() => active && setLoading(false));
      } else {
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); return; }
      if (session?.user) loadProfile(session.user);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [loadProfile]);

  const logout = useCallback(async () => {
    await apiSignOut();
    setUser(null);
  }, []);

  const value = { user, role: user?.role || null, loading, logout, refreshUser: loadProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
