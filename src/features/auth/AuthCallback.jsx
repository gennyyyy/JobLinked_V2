import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '@/shared/lib/auth-client';
import { setApiIdentity } from '@/shared/lib/api';
import { getProfile, verifyEmailToken } from '@/shared/services/auth';
import useAuth from '@/shared/hooks/useAuth';
import LoadingScreen from '@/shared/components/LoadingScreen';
import PublicShell from '@/shared/components/PublicShell';
import { PORTALS } from '@/shared/constants';
import AuthFrame from './AuthFrame';

// The emailed link is BA's /api/auth/verify-email?token=…&callbackURL=… — BA
// verifies server-side and redirects here (no session; sign-up never signs in).
// A token can also arrive directly on this route, in which case we verify it
// here. Either way the visitor then signs in, where pending_signups is claimed.
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState(false);
  const errorParam = searchParams.get('error');
  const token = searchParams.get('token');

  useEffect(() => {
    let active = true;
    (async () => {
      // BA's redirect appends ?error=INVALID_TOKEN (or TOKEN_EXPIRED) when the
      // link no longer verifies.
      if (errorParam) {
        if (active) setError(true);
        return;
      }
      if (token) await verifyEmailToken(token);

      const { data } = await authClient.getSession().catch(() => ({ data: null }));
      const sessionUser = data?.user;
      if (!sessionUser) {
        if (active) setVerified(true);
        return;
      }

      // A session here means a signed-in visitor re-verified (or a change-email
      // confirmation). Route by the resolved role; an unprovisioned account
      // finishes on the recovery page, which claims the pending profile.
      setApiIdentity(sessionUser.id);
      const profile = await getProfile(sessionUser.id);
      await refreshUser(sessionUser);
      const homePath = PORTALS.find((p) => p.key === profile?.role)?.homePath;
      if (active) navigate(homePath || '/complete-registration', { replace: true });
    })().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [navigate, refreshUser, errorParam, token]);

  if (!error && !verified) return <LoadingScreen />

  if (error) return <Navigate to="/link-expired?type=verify" replace />

  return (
    <PublicShell>
      <AuthFrame title="Email verified." subtitle="Your address is confirmed.">
        <div className="flex flex-col gap-5">
          <p role="status" className="text-xs leading-6 text-muted-foreground">
            You can now sign in to finish setting up your account.
          </p>
          <Link to="/login" className="text-xs font-medium text-primary">Go to sign in</Link>
        </div>
      </AuthFrame>
    </PublicShell>
  )
}
