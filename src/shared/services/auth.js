import { authClient } from '../lib/auth-client';
import { api, clearApiCache, setApiIdentity } from '../lib/api';
// True when the token is valid but no profile row exists yet (contract says
// GET /api/auth/me 404s; the built middleware answers 403 'Account not
// provisioned' — accept both).
const needsProvision = (e) => e?.status === 404 || (e?.status === 403 && /not provisioned/i.test(e?.message || ''));

// Sign-in reached a valid session with no role row. Never auto-provision from
// client metadata (ADR-056 decision 8): the server merges admin_invites /
// pending_signups on the provisioning call instead.
const provisionRequired = () => Object.assign(new Error('needs provision'), { needsProvision: true });

// BA's captcha plugin reads the token from this header (ADR-056 decision 6).
// Omitted entirely when no widget is configured, so the payload is unchanged.
const captchaFetch = (token) => (token
  ? { fetchOptions: { headers: { 'x-captcha-response': token } } }
  : {});

// One friendly error surface for Better Auth failures. BA client errors carry
// `{ code, message, status }`; a network failure throws a bare TypeError.
function friendlyAuthError(error) {
  if (!error) return error;
  const message = String(error.message || '');
  const network = error.name === 'TypeError'
    || error.name === 'AuthRetryableFetchError'
    || /failed to fetch|networkerror|load failed|fetch failed/i.test(message);
  if (network) {
    const err = new Error('We can\u2019t sign you in right now. Please check your connection and try again.');
    err.detail = `Cannot reach the authentication service at ${import.meta.env.VITE_API_URL || 'the configured API URL'}.`;
    return err;
  }
  const code = String(error.code || '');
  // Tokens are single-use: the honest advice is to solve the challenge again.
  if (code === 'MISSING_RESPONSE' || /captcha/i.test(`${code} ${message}`)) {
    return new Error('Verification failed. Please complete the challenge again.');
  }
  if (code === 'EMAIL_NOT_VERIFIED') {
    // The login screen offers a resend for this one case, so keep the code.
    const err = new Error('Please verify your email address before signing in. Check your inbox for the verification link.');
    err.code = code;
    return err;
  }
  if (code === 'INVALID_TOKEN') {
    return new Error('This link is invalid or expired. Request a new one.');
  }
  if (code === 'INVALID_CODE' || code === 'INVALID_BACKUP_CODE') {
    return new Error('Invalid code. Please try again.');
  }
  // Never reveal whether an email exists: the sign-in answer stays generic.
  if (code === 'INVALID_EMAIL_OR_PASSWORD') return new Error('Invalid email or password');
  if (error.status === 429 || code === 'TOO_MANY_REQUESTS' || /too many|rate.?limit/i.test(message)) {
    return new Error('Too many attempts. Please wait a moment and try again.');
  }
  return error;
}

export async function getProfile(userId) {
  void userId; // identity comes from the session token, never params
  try {
    return await api.get('auth/me');
  } catch (e) {
    if (needsProvision(e)) return null;
    throw e;
  }
}

// Own employer row (null when missing — mirrors the old maybeSingle read).
export async function getEmployer() {
  try {
    return await api.get('employers/me');
  } catch (e) {
    if (needsProvision(e) || e?.status === 404) return null;
    throw e;
  }
}

// Replaces handle_new_user. Idempotent on (id) — 200 if the row exists.
export async function provision(payload) {
  return api.post('auth/provision', payload);
}

export async function updateProfile(userId, patch) {
  const me = await api.get('auth/me');
  const path = me.role === 'super-admin'
    ? `admin/users/${userId}`
    : me.role === 'employer' ? 'employers/me' : 'seekers/me';
  try {
    return await api.patch(path, patch);
  } catch (error) {
    // A response can fail after the database has committed the update. Verify
    // the requested values before reporting failure to the profile form — but
    // only for a lost response (5xx / unreachable). A 4xx is a refusal the
    // server made *before* writing (400 "Nothing to update", 403, 409), so
    // nothing was committed and a matching re-read must not be reported as
    // success; an empty patch has nothing to confirm either.
    const refused = error?.status >= 400 && error?.status < 500;
    if (!refused && Object.keys(patch || {}).length) {
      try {
        const saved = me.role === 'super-admin'
          ? await api.get('auth/me')
          : await api.get(path);
        const matches = Object.entries(patch).every(([key, value]) => {
          const actual = saved?.[key];
          if (Array.isArray(value)) {
            return Array.isArray(actual)
              && actual.length === value.length
              && actual.every((item, index) => String(item).trim().toLowerCase() === String(value[index]).trim().toLowerCase());
          }
          if (value == null || value === '') return actual == null || actual === '';
          if (typeof value === 'string' && typeof actual === 'string') {
            return actual.trim().toLowerCase() === value.trim().toLowerCase();
          }
          return actual === value;
        });
        if (matches) return saved;
      } catch {
        // Keep the original update error when confirmation is unavailable.
      }
    }
    throw error;
  }
}

// getSession (not the sign-in response) is the reliable user source: the
// cookie is set by then, and the 2FA path only exists on the session.
async function sessionUser() {
  const { data } = await authClient.getSession().catch(() => ({ data: null }));
  return data?.user || null;
}

// The GET cache is identity-keyed, so the identity must move BEFORE the first
// authenticated read or a previous account's profile could be served.
async function profileFor(user) {
  setApiIdentity(user.id);
  const profile = await getProfile(user.id);
  if (!profile) throw provisionRequired();
  if (profile.status === 'suspended') throw new Error('Invalid email or password');
  return { ...user, ...profile };
}

export async function signIn(email, password, captchaToken) {
  let result;
  try {
    result = await authClient.signIn.email({ email, password, ...captchaFetch(captchaToken) });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
  // TOTP accounts get no session until the code step completes.
  if (result.data?.twoFactorRedirect) return { twoFactorRedirect: true };
  const user = await sessionUser();
  if (!user) throw new Error('We couldn\u2019t finish signing you in. Please try again.');
  return profileFor(user);
}

// Second step of the login challenge: BA sets the session cookie here.
export async function completeTwoFactor(code) {
  let result;
  try {
    result = await authClient.twoFactor.verifyTotp({ code });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
  const user = (await sessionUser()) || result.data?.user;
  if (!user) throw new Error('We couldn\u2019t finish signing you in. Please try again.');
  return profileFor(user);
}

const ALLOWED_SIGNUP_ROLES = ['job-seeker', 'employer'];

export async function signUp({ email, password, role, firstName, middleName = '', lastName, suffix = '', captchaToken, extra = {} }) {
  if (!ALLOWED_SIGNUP_ROLES.includes(role)) throw new Error('Invalid role');
  const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
  const lower = (value) => typeof value === 'string' ? value.trim().toLowerCase() : value;
  const meta = {
    role,
    first_name: lower(firstName),
    middle_name: lower(middleName),
    last_name: lower(lastName),
    suffix: lower(suffix),
    full_name: lower(fullName),
    phone: extra.phone || null,
    representative_phone: extra.representativePhone || null,
    lot: lower(extra.lot) || null,
    block: lower(extra.block) || null,
    house_number_unit: lower(extra.houseNumberUnit) || null,
    street_address: lower(extra.streetAddress) || null,
    subdivision_building: lower(extra.subdivisionBuilding) || null,
    barangay_district: lower(extra.barangayDistrict) || null,
    city_municipality: lower(extra.cityMunicipality) || null,
    province_state: lower(extra.provinceState) || null,
    postal_code: lower(extra.postalCode) || null,
    country: lower(extra.country) || 'philippines',
    birthdate: extra.birthdate || null,
    employment_status: extra.employmentStatus || null,
    field: extra.field || null,
    // No client-side lowercasing: the server stores a listed skill in the
    // vocabulary's canonical casing and keeps an unlisted one as typed.
    skills: Array.isArray(extra.skills) ? extra.skills.map((skill) => String(skill).trim()).filter(Boolean) : [],
    education: extra.education ? {
      level: lower(extra.education.level),
      school: lower(extra.education.school),
      field: lower(extra.education.field) || null,
      end_year: extra.education.end_year || null,
    } : null,
    company_name: lower(extra.companyName) || null,
    industry: extra.industry || null,
    company_email: extra.companyEmail || null,
    representative_email: extra.representativeEmail || null,
    representative_position: extra.representativePosition || null,
  };
  let result;
  try {
    result = await authClient.signUp.email({
      email,
      password,
      name: fullName,
      callbackURL: `${window.location.origin}/auth/callback`,
      ...captchaFetch(captchaToken),
    });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
  const user = result.data?.user;
  if (!user?.id) throw new Error('Registration failed \u2014 please try again');

  // With requireEmailVerification BA returns no session and stores only
  // name/email. Park the form profile for provision to claim after the address
  // is verified (ADR-056 decision 8). The account already exists, so a failed
  // pending write must not fail the registration — the visitor still verifies
  // and can fill the profile at first sign-in.
  try {
    await api.post('auth/pending-signup', { userId: user.id, email, role, ...meta });
  } catch (error) {
    console.warn('pending signup profile was not stored', { status: error?.status });
  }

  return {
    ...user,
    role, first_name: firstName, middle_name: middleName, last_name: lastName,
    suffix, full_name: fullName, email, ...extra,
    // requireEmailVerification is fixed in ba.js: sign-up never signs in.
    emailConfirmationRequired: true,
  };
}

// BA rate-limits this endpoint (3/min); friendlyAuthError already turns a 429
// into the "wait a moment" wording both callers show.
export async function resendVerificationEmail(email) {
  let result;
  try {
    result = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/auth/callback`,
    });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
}

export async function signOut() {
  // Best-effort: a revoke failure must not prevent the local clear — the
  // caller always ends up logged out.
  clearApiCache();
  setApiIdentity('anon');
  try {
    await authClient.signOut();
  } catch { /* revoke failed; the local session still clears */ }
}

// BA's change-password (and the two-factor endpoints) answer INVALID_PASSWORD
// for a wrong current password; the client shows one honest line for all three.
const wrongPassword = (error) => error?.code === 'INVALID_PASSWORD'
  || /invalid password/i.test(String(error?.message || ''));

// ADR-056 decision 6: change-password verifies the current password and is not
// a captcha-protected endpoint, so no token rides along. The password policy
// stays client-side (utils/password.js); the server hook is the trust boundary.
export async function changePassword(currentPassword, newPassword) {
  let result;
  try {
    result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) {
    if (wrongPassword(result.error)) throw new Error('Current password is incorrect.');
    throw friendlyAuthError(result.error);
  }
}

// The email change needs a fresh re-auth first: our session route checks the
// password through BA, then BA emails a verification link to the NEW address.
export async function changeEmail(newEmail, currentPassword) {
  try {
    await api.post('auth/verify-password', { password: currentPassword });
  } catch (error) {
    if (error?.error?.code === 'INVALID_PASSWORD') {
      throw new Error('Current password is incorrect.', { cause: error });
    }
    throw error;
  }
  let result;
  try {
    result = await authClient.changeEmail({
      newEmail,
      callbackURL: `${window.location.origin}/auth/callback`,
    });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
}

export async function resetPassword(email, captchaToken) {
  let result;
  try {
    result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
      ...captchaFetch(captchaToken),
    });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
}

// The emailed link lands on /reset-password?token=… — the token is the credential.
export async function resetPasswordWithToken(newPassword, token) {
  let result;
  try {
    result = await authClient.resetPassword({ newPassword, token });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
}

export async function verifyEmailToken(token) {
  let result;
  try {
    result = await authClient.verifyEmail({ query: { token } });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
}

// BA's two-factor plugin keeps one TOTP factor per user; there is no factor id
// to list, only the user's twoFactorEnabled flag.
export async function listMfaFactors() {
  const { data } = await authClient.getSession().catch(() => ({ data: null }));
  return data?.user?.twoFactorEnabled
    ? [{ id: 'totp', status: 'verified', friendly_name: 'Authenticator app' }]
    : [];
}

// Enable with the current password. BA answers the otpauth URI and one-time
// backup codes — no QR image; the panel renders it.
export async function enrollMfa(password) {
  let result;
  try {
    result = await authClient.twoFactor.enable({ password });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) {
    if (wrongPassword(result.error)) throw new Error('Current password is incorrect.');
    throw friendlyAuthError(result.error);
  }
  const data = result.data || {};
  return { method: data.method, totpURI: data.totpURI, backupCodes: data.backupCodes };
}

// Second step of enrollment. BA flips twoFactorEnabled server-side; re-read the
// session so the provider and listMfaFactors see the new flag.
export async function verifyMfaEnrollment(code) {
  let result;
  try {
    result = await authClient.twoFactor.verifyTotp({ code });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) throw friendlyAuthError(result.error);
  await authClient.getSession().catch(() => null);
}

// Password-gated: BA removes the factor and the flag together.
export async function unenrollMfa(password) {
  let result;
  try {
    result = await authClient.twoFactor.disable({ password });
  } catch (error) {
    throw friendlyAuthError(error);
  }
  if (result.error) {
    if (wrongPassword(result.error)) throw new Error('Current password is incorrect.');
    throw friendlyAuthError(result.error);
  }
  await authClient.getSession().catch(() => null);
}
