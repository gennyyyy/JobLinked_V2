import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Loader2 } from 'lucide-react';
import { provision } from '@/shared/services/auth';
import { takeApplyIntent } from '@/shared/lib/applyIntent';
import useAuth from '@/shared/hooks/useAuth';
import { PORTALS } from '@/shared/constants';
import LoadingScreen from '@/shared/components/LoadingScreen';
import PublicShell from '@/shared/components/PublicShell';
import AuthFrame from './AuthFrame';
import FormSelect from '@/shared/components/FormSelect';

// Cold-recovery page for unprovisioned accounts: a valid session exists but no
// local profile row has been created yet. Provisioning is attempted once on
// mount with an empty body — the server merges admin_invites (admin invite) or
// pending_signups (self-signup) — and the form is only the fallback for an
// account with neither (ADR-056 decisions 7/8). The session is kept alive
// throughout: no sign-out, no new account.
export default function CompleteRegistration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, needsProvisioning, sessionUser, loading, refreshUser } = useAuth();
  const initialRole = searchParams.get('role') === 'employer' ? 'employer' : 'job-seeker';
  const [role, setRole] = useState(initialRole);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canAutoProvision = Boolean(needsProvisioning || sessionUser) && !user;
  const [autoBusy, setAutoBusy] = useState(canAutoProvision);
  // One attempt per mount, whatever React's effect double-invoke does.
  const attempted = useRef(false);

  useEffect(() => {
    if (!canAutoProvision || attempted.current) return;
    attempted.current = true;
    let active = true;
    (async () => {
      try {
        const result = await provision({});
        if (!active) return;
        await refreshUser({ id: sessionUser?.id, email: sessionUser?.email });
        const homePath = PORTALS.find((p) => p.key === result.role)?.homePath || '/';
        const applyPath = takeApplyIntent();
        navigate(result.role === 'job-seeker' && applyPath ? applyPath : homePath, { replace: true });
      } catch (err) {
        if (!active) return;
        // 400 = no pending invite/signup for this account: the form is the
        // only way to finish. Anything else is surfaced above the form.
        if (err?.status !== 400) setError(err.message || 'Failed to complete registration');
        setAutoBusy(false);
      }
    })();
    return () => { active = false; };
  }, [canAutoProvision, navigate, refreshUser, sessionUser]);

  // No session at all → sign-in page.
  if (loading) return <LoadingScreen />;
  if (!needsProvisioning && !sessionUser && !user) {
    return <Navigate to="/login" replace />;
  }
  // Already provisioned → route to the portal.
  if (user) {
    const homePath = PORTALS.find((p) => p.key === user.role)?.homePath || '/';
    return <Navigate to={homePath} replace />;
  }
  // The automatic merge is in flight: never flash the fallback form.
  if (autoBusy) return <LoadingScreen />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    // ADR-059: the fallback form is also a self-signup, so the server needs the
    // same consent flag the registration form parks.
    if (!termsAccepted) {
      setError('You must agree to the Terms of Use to continue.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        role,
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        suffix: suffix.trim(),
        email: sessionUser?.email,
        terms_accepted: true,
      };
      if (role === 'employer') {
        payload.company_name = companyName.trim();
        payload.company_email = companyEmail.trim() || null;
      }
      const result = await provision(payload);
      // Refresh the profile so AuthProvider picks up the new role.
      await refreshUser({ id: sessionUser?.id, email: sessionUser?.email });
      const homePath = PORTALS.find((p) => p.key === result.role)?.homePath || '/';
      const applyPath = takeApplyIntent();
      navigate(result.role === 'job-seeker' && applyPath ? applyPath : homePath, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to complete registration');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <AuthFrame title="Complete your registration." subtitle="Finish setting up your JobLinked account.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="role">Registration path</FieldLabel>
              <FormSelect
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="form-field"
              >
                <option value="job-seeker">Job seeker</option>
                <option value="employer">Employer</option>
              </FormSelect>
            </Field>
          </FieldGroup>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="first-name">First name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="first-name"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="middle-name">Middle name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="middle-name"
                  type="text"
                  autoComplete="additional-name"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="last-name">Last name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="last-name"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="suffix">Suffix</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="suffix"
                  type="text"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder="Jr., Sr., III, etc."
                />
              </InputGroup>
            </Field>
          </FieldGroup>

          {role === 'employer' && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="company-name">Company name</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="company-name"
                    type="text"
                    autoComplete="organization"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="company-email">Company email</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="company-email"
                    type="email"
                    autoComplete="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                  />
                </InputGroup>
              </Field>
            </FieldGroup>
          )}

          <label htmlFor="terms-accepted" className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <input
              id="terms-accepted"
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (e.target.checked) setError('');
              }}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline underline-offset-4">
                Terms of Use
              </Link>{' '}
              and the Privacy Notice.
            </span>
          </label>

          {error && <p role="alert" className="text-xs leading-6 text-destructive">{error}</p>}

          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            {busy ? 'Completing…' : 'Complete registration'}
          </Button>
        </form>
      </AuthFrame>
    </PublicShell>
  );
}
