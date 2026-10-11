import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { logAudit } from './audit';

// True when the token is valid but no profile row exists yet (contract says
// GET /api/auth/me 404s; the built middleware answers 403 'Account not
// provisioned' — accept both).
const needsProvision = (e) => e?.status === 404 || (e?.status === 403 && /not provisioned/i.test(e?.message || ''));

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
  if (me.role === 'super-admin') return api.patch(`admin/users/${userId}`, patch);
  return api.patch(me.role === 'employer' ? 'employers/me' : 'seekers/me', patch);
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  let profile = data.user ? await getProfile(data.user.id) : null;
  if (!profile) {
    // First login after email-confirm: provision from the signup metadata, then retry.
    const meta = data.user?.user_metadata || {};
    if (!meta.role) throw new Error('needs provision');
    await provision({ ...meta, email: data.user.email });
    profile = await getProfile(data.user.id);
  }
  if (!profile || profile.status === 'suspended') throw new Error('Invalid email or password');
  logAudit('auth.login');
  return { ...data.user, ...profile };
}

const ALLOWED_SIGNUP_ROLES = ['job-seeker', 'employer'];

export async function signUp({ email, password, role, firstName, middleName = '', lastName, suffix = '', extra = {} }) {
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
    skills: Array.isArray(extra.skills) ? extra.skills.map((skill) => String(skill).trim().toLowerCase()).filter(Boolean) : [],
    education: extra.education ? {
      level: lower(extra.education.level),
      school: lower(extra.education.school),
      field: lower(extra.education.field) || null,
      end_year: extra.education.end_year || null,
    } : null,
    company_name: lower(extra.companyName) || null,
    industry: extra.industry || null,
    company_phone: extra.companyPhone || null,
    company_email: extra.companyEmail || null,
    representative_email: extra.representativeEmail || null,
    representative_position: extra.representativePosition || null,
  };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: meta,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Registration failed — please try again');

  // Session is null when Supabase requires email confirmation — first login
  // provisions instead (see signIn). Otherwise provision immediately.
  if (data.session) await provision({ ...meta, email });
  return {
    ...data.user,
    role, first_name: firstName, middle_name: middleName, last_name: lastName,
    suffix, full_name: fullName, email, ...extra,
    emailConfirmationRequired: !data.session,
  };
}

export async function signOut() {
  logAudit('auth.logout'); // posted before the session token is cleared
  // Best-effort: a revoke failure on a dead token (e.g. server 403) must not
  // prevent local session clear — the caller always ends up logged out.
  try {
    await supabase.auth.signOut();
  } catch { /* revoke failed; local session still clears via SIGNED_OUT */ }
}

export async function changePassword(currentPassword, newPassword) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('No active account found.');

  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (verifyError) throw new Error('Current password is incorrect.');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  logAudit('auth.password.change');
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  logAudit('auth.password.reset.request');
}
