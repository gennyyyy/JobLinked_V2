import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase';
import { getProfile, provision } from '../../shared/services/auth';
import useAuth from '../../shared/hooks/useAuth';
import LoadingScreen from '../../shared/components/LoadingScreen';
import { PORTALS } from '../../shared/constants';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!session?.user) throw new Error('The verification link is invalid or expired.');

      let profile = await getProfile(session.user.id);
      if (!profile) {
        const meta = session.user.user_metadata || {};
        if (!meta.role) throw new Error('Your account details could not be loaded. Please sign in.');
        await provision({ ...meta, email: session.user.email });
        profile = await getProfile(session.user.id);
      }
      // Email confirmation is shared by every portal's signup, so the resolved
      // role — not the link — decides the destination. Never hardcode one path.
      const homePath = PORTALS.find((p) => p.key === profile?.role)?.homePath;
      if (!homePath) throw new Error('Your account role could not be determined. Please sign in.');
      await refreshUser(session.user);
      if (active) navigate(homePath, { replace: true });
    })().catch((err) => active && setError(err.message || 'Email verification failed.'));
    return () => { active = false; };
  }, [navigate, refreshUser]);

  if (!error) return <LoadingScreen />;
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md rounded-lg border border-primary bg-white p-6 text-center shadow-xl">
        <h1 className="text-xl font-bold text-dark-blue">Verification link issue</h1>
        <p className="mt-3 text-sm text-gray-600">{error}</p>
        <Link to="/job-seeker/login" className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-6 text-sm font-semibold text-white">Go to sign in</Link>
      </div>
    </main>
  );
}
