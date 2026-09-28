import { supabase } from '../lib/supabase';
import { logAudit } from './audit';

export async function getProfile(userId) {
  const tables = ['job_seekers', 'employers', 'super_admins'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) return { ...data, role: table === 'job_seekers' ? 'job-seeker' : table === 'super_admins' ? 'super-admin' : 'employer' };
  }
  return null;
}

export async function updateProfile(userId, patch) {
  const profile = await getProfile(userId);
  if (!profile?.role) throw new Error('Profile not found for this account');
  const table = profile.role === 'job-seeker' ? 'job_seekers' : profile.role === 'super-admin' ? 'super_admins' : 'employers';
  const { data, error } = await supabase
    .from(table)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Could not update ${table}. Check the account row and permissions.`);
  await logAudit('profile.update', table, userId, { fields: Object.keys(patch) });
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await logAudit('auth.login.failed', 'auth.users', null, { email });
    throw error;
  }
  const profile = data.user ? await getProfile(data.user.id) : null;
  if (!profile) throw new Error('Profile not found for this account');
  if (profile.status === 'suspended') throw new Error('This account has been suspended. Contact PESO.');
  await logAudit('auth.login', 'auth.users', data.user.id);
  return { ...data.user, ...profile };
}

export async function signUp({ email, password, role, firstName, middleName = '', lastName, suffix = '', extra = {} }) {
  const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix,
        full_name: fullName,
        phone: extra.phone || null,
        house_number_unit: extra.houseNumberUnit || null,
        street_address: extra.streetAddress || null,
        subdivision_building: extra.subdivisionBuilding || null,
        barangay_district: extra.barangayDistrict || null,
        city_municipality: extra.cityMunicipality || null,
        province_state: extra.provinceState || null,
        postal_code: extra.postalCode || null,
        country: extra.country || 'Philippines',
        birthdate: extra.birthdate || null,
        company_name: extra.companyName || null,
        industry: extra.industry || null,
        company_phone: extra.companyPhone || null,
        company_email: extra.companyEmail || null,
        representative_email: extra.representativeEmail || null,
        representative_position: extra.representativePosition || null,
      },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Registration failed — please try again');

  await logAudit('auth.register', 'auth.users', data.user.id, { role });
  // session is null when Supabase requires email confirmation — caller must not
  // run authenticated writes until the user clicks the link
  return {
    ...data.user,
    role, first_name: firstName, middle_name: middleName, last_name: lastName,
    suffix, full_name: fullName, email, ...extra,
    emailConfirmationRequired: !data.session,
  };
}

export async function signOut() {
  const { data: { user } } = await supabase.auth.getUser();
  await logAudit('auth.logout', 'auth.users', user?.id || null);
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function changePassword(currentPassword, newPassword) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('No active account found.');

  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (verifyError) throw new Error('Current password is incorrect.');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  await logAudit('auth.password.change', 'auth.users', user.id);
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  });
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
