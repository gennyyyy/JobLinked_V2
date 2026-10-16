import { Router } from 'express';
import { pool } from '../db.js';
import { resolveRole, tokenAuth } from '../auth.js';
import { ah, err, audit, buildFullName, isNumericId, withTransaction } from '../util.js';

const router = Router();

const PERSON = ['first_name', 'middle_name', 'last_name', 'suffix', 'full_name', 'phone',
  'house_number_unit', 'street_address', 'subdivision_building', 'barangay_district',
  'city_municipality', 'province_state', 'postal_code', 'country', 'birthdate', 'employment_status'];
const LOWERCASE_PERSON = new Set(['first_name', 'middle_name', 'last_name', 'suffix', 'full_name',
  'house_number_unit', 'street_address', 'subdivision_building', 'barangay_district',
  'city_municipality', 'province_state', 'postal_code', 'country']);
const EMPLOYMENT_STATUSES = ['Employed', 'Unemployed', 'Underemployed', 'Fresh Graduate', 'Student'];

// Replaces handle_new_user. Idempotent on (id) — 200 if the row already exists.
// Addendum B: token-only auth, NO provisioned-row gate (fresh sessions have no row).
router.post('/auth/provision', tokenAuth, ah(async (req, res) => {
  const b = req.body || {};
  const role = b.role;
  if (!['job-seeker', 'employer', 'super-admin'].includes(role)) {
    return err(res, 400, 'BAD_REQUEST', 'role must be job-seeker, employer, or super-admin');
  }
  // super-admin comes only from app_metadata — written by the service role in
  // the invite flow. The body (and user_metadata) are client-writable, so a
  // body role alone must never create a super_admins row: fail closed when the
  // unforgeable signal is missing or says otherwise.
  if (role === 'super-admin' && req.user.app_metadata?.role !== 'super-admin') {
    return err(res, 403, 'FORBIDDEN', 'Super-admin accounts can only be provisioned from an admin invite.');
  }
  const existing = await resolveRole(req.user.id);
  if (existing) {
    if (existing.profile.status !== 'active') return err(res, 403, 'FORBIDDEN', 'This account has been suspended or deactivated. Contact PESO.');
    return res.status(200).json({ ...existing.profile, role: existing.role });
  }

  const email = req.user.email || b.email || '';
  const person = {};
  for (const k of PERSON) {
    const value = b[k] ?? (k === 'country' ? 'Philippines' : null);
    person[k] = LOWERCASE_PERSON.has(k) && typeof value === 'string' ? value.trim().toLowerCase() : value;
  }
  // first/middle/last/suffix are `not null default ''` in all three role tables
  // (schema.sql). An omitted field inserted as an explicit NULL raises 23502 and
  // 500s the provision — the schema default only applies to ABSENT columns, and
  // the column list here is always full. '' is also what the UI sends for blank
  // fields, so absent === blank for every caller.
  for (const k of ['first_name', 'middle_name', 'last_name', 'suffix']) person[k] ??= '';
  if (!person.full_name) {
    person.full_name = buildFullName(person.first_name, person.middle_name, person.last_name, person.suffix);
  }
  const employmentStatus = b.employment_status ?? null;
  if (employmentStatus !== null && employmentStatus !== '' && !EMPLOYMENT_STATUSES.includes(employmentStatus)) {
    return err(res, 400, 'BAD_REQUEST', 'employment_status must be Employed, Unemployed, Underemployed, Fresh Graduate, or Student');
  }
  person.employment_status = employmentStatus || null;
  const skills = Array.isArray(b.skills)
    ? [...new Set(b.skills.filter((skill) => typeof skill === 'string').map((skill) => skill.trim().toLowerCase()).filter(Boolean))]
    : [];
  const education = role === 'job-seeker' ? b.education : null;
  if (education && (
    typeof education.level !== 'string' || !education.level.trim() ||
    typeof education.school !== 'string' || !education.school.trim() ||
    (education.end_year !== null && education.end_year !== undefined && !Number.isInteger(Number(education.end_year)))
  )) {
    return err(res, 400, 'BAD_REQUEST', 'education requires a level and school, with an optional graduation year');
  }

  // Optional invite tag: resolve against the custom_role catalog once. A stale
  // or unknown id is ignored (null), never a 400 — the invite may be old. A
  // non-numeric id is ignored the same way (never a 22P02 500).
  let customRoleId = null;
  if (b.custom_role_id != null && isNumericId(b.custom_role_id)) {
    const { rows } = await pool.query(
      `select id from reference_data where id = $1 and category = 'custom_role'`, [b.custom_role_id]);
    if (rows[0]) customRoleId = rows[0].id;
  }

  let row;
  try {
    row = await withTransaction(async (client) => {
      if (role === 'job-seeker') {
        const r = await client.query(
          `insert into job_seekers (id, email, first_name, middle_name, last_name, suffix, full_name, phone,
            lot, block, street_address, house_number_unit, subdivision_building, barangay_district, city_municipality,
            province_state, postal_code, country, birthdate, employment_status, skills, custom_role_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning *`,
          [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix,
            person.full_name, person.phone,
            typeof b.lot === 'string' ? b.lot.trim().toLowerCase() : null,
            typeof b.block === 'string' ? b.block.trim().toLowerCase() : null, person.street_address,
            person.house_number_unit, person.subdivision_building, person.barangay_district,
            person.city_municipality, person.province_state, person.postal_code,
            person.country ?? 'Philippines', person.birthdate, person.employment_status, skills, customRoleId]
        );
        const created = r.rows[0];
        if (education) {
          await client.query(
            `insert into education (seeker_id, level, school, field, end_year) values ($1,$2,$3,$4,$5)`,
            [req.user.id, education.level.trim().toLowerCase(), education.school.trim().toLowerCase(),
              typeof education.field === 'string' ? education.field.trim().toLowerCase() || null : null,
              education.end_year ? Number(education.end_year) : null]
          );
        }
        return created;
      } else if (role === 'employer') {
        const r = await client.query(
          `insert into employers (id, email, first_name, middle_name, last_name, suffix, full_name, phone,
            company_name, company_email, industry, house_number_unit, street_address, subdivision_building,
            barangay_district, city_municipality, province_state, postal_code, country,
            representative_email, representative_position, custom_role_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning *`,
          [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix,
            person.full_name, person.phone,
            typeof b.company_name === 'string' ? b.company_name.trim().toLowerCase() : '', b.company_email ?? null,
            b.industry ?? null, person.house_number_unit, person.street_address, person.subdivision_building,
            person.barangay_district, person.city_municipality, person.province_state, person.postal_code,
            person.country ?? 'Philippines', b.representative_email ?? null,
            b.representative_position ?? null, customRoleId]
        );
        const created = r.rows[0];
        // Mirror handle_new_user: employer signup opens a pending accreditation row.
        await client.query(`insert into employer_accreditations (company_id) values ($1)`, [req.user.id]);
        return created;
      } else {
        const r = await client.query(
          `insert into super_admins (id, email, first_name, middle_name, last_name, suffix, full_name, custom_role_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
          [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix, person.full_name, customRoleId]
        );
        return r.rows[0];
      }
    });
  } catch (e) {
    // B11: the route is idempotent by design, but the check-then-act above
    // races a double-submit (both pass the check; the loser 23505s). Answer
    // the documented 200 with the existing row instead of a 500.
    if (e.code !== '23505') throw e;
    const existing = await resolveRole(req.user.id);
    if (!existing) throw e;
    if (existing.profile.status !== 'active') return err(res, 403, 'FORBIDDEN', 'This account has been suspended or deactivated. Contact PESO.');
    return res.status(200).json({ ...existing.profile, role: existing.role });
  }
  void audit(req.user.id, 'auth.register', role === 'job-seeker' ? 'job_seekers' : role === 'employer' ? 'employers' : 'super_admins', req.user.id, { role });
  res.status(201).json({ ...row, role });
}));

// Client-observed events only; server-side data auditing stays in the handlers.
// F-03: the action names are allow-listed to exactly what the SPA posts
// (shared/services/auth.js) — without the list, any authenticated user could
// forge server action names (admin.login, user.role.change, …) into the admin
// Audit-Logs view. An unknown action is a 400: a deliberate, documented
// exception to "never 4xxs the caller" (the contract line covers best-effort
// WRITES, not request validation — see 02-api-contract.md).
const CLIENT_AUDIT_ACTIONS = [
  'auth.login',
  'auth.logout',
  'auth.password.change',
  'auth.password.reset.request',
];
router.post('/audit', tokenAuth, ah(async (req, res) => {
  const { action, entity, entity_id, details } = req.body || {};
  if (!CLIENT_AUDIT_ACTIONS.includes(action)) {
    return err(res, 400, 'BAD_REQUEST', `action must be one of ${CLIENT_AUDIT_ACTIONS.join(', ')}`);
  }
  await audit(req.user.id, action, entity ?? null, entity_id ?? null, details ?? null);
  res.status(204).end();
}));

// Replaces the getProfile fan-out. Valid token + no row → 404 (needs provision);
// non-active row → 403.
router.get('/auth/me', tokenAuth, ah(async (req, res) => {
  const found = await resolveRole(req.user.id);
  if (!found) return err(res, 404, 'NOT_FOUND', 'Profile not found for this account');
  if (found.profile.status !== 'active') return err(res, 403, 'FORBIDDEN', 'This account has been suspended or deactivated. Contact PESO.');
  res.json({ ...found.profile, role: found.role });
}));

export default router;
