// ADR-058: one displayed-name change per rolling 30 days, every role.
export const NAME_FIELDS = ['first_name', 'middle_name', 'last_name', 'suffix'];
export const NAME_GUARD_SQL = " and (name_changed_at is null or name_changed_at <= now() - interval '30 days')";
export const NAME_STAMP_SQL = ', name_changed_at = now()';

const norm = (value) => String(value ?? '').trim().toLowerCase();

// True when this patch would change the displayed name. Components win when
// both are sent (profiles.js derives full_name from them); a lone full_name
// still counts so super-admins and the legacy contract are covered.
export function isNameChange(patch, prior) {
  const componentChanged = NAME_FIELDS.some(
    (field) => patch[field] !== undefined && norm(patch[field]) !== norm(prior[field]),
  );
  const nextFullName = patch.full_name !== undefined ? patch.full_name : prior.full_name;
  return componentChanged || norm(nextFullName) !== norm(prior.full_name);
}

export function nameLimitMessage(nameChangedAt) {
  const next = new Date(new Date(nameChangedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
  return `You can change your name again on ${next.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
  })}.`;
}
