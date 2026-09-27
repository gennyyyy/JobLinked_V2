import { supabase } from '../lib/supabase';
import { logAudit } from './audit';

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  await logAudit('profile.update', 'profiles', userId, { fields: Object.keys(patch) });
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, first_name: firstName, middle_name: middleName, last_name: lastName, suffix },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Registration failed — please try again');

  const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
  await logAudit('auth.register', 'auth.users', data.user.id, { role });
  return { ...data.user, role, first_name: firstName, middle_name: middleName, last_name: lastName, suffix, full_name: fullName, email, ...extra };
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
