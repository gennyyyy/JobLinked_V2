import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Loader2 } from 'lucide-react';
import { provision } from '@/shared/services/auth';
import useAuth from '@/shared/hooks/useAuth';
import { PORTALS } from '@/shared/constants';
import LoadingScreen from '@/shared/components/LoadingScreen';
import PublicShell from '@/shared/components/PublicShell';
import AuthFrame from './AuthFrame';

// Cold-recovery page for unprovisioned accounts: a valid Supabase session
// exists but no local profile row has been created yet. The visitor picks a
// role, fills the minimum fields the provision endpoint requires, and the
// session is kept alive — no sign-out, no new account.
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        role,
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        suffix: suffix.trim(),
        email: sessionUser?.email,
      };
      if (role === 'employer') {
        payload.company_name = companyName.trim();
        payload.company_email = companyEmail.trim() || null;
      }
      const result = await provision(payload);
      // Refresh the profile so AuthProvider picks up the new role.
      await refreshUser({ id: sessionUser?.id, email: sessionUser?.email });
      const homePath = PORTALS.find((p) => p.key === result.role)?.homePath || '/';
      navigate(homePath, { replace: true });
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
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
              >
                <option value="job-seeker">Job seeker</option>
                <option value="employer">Employer</option>
              </select>
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
