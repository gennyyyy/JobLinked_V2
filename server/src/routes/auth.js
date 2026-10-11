import { Router } from 'express';
import { pool } from '../db.js';
import { resolveRole, tokenAuth } from '../auth.js';
import { ah, err, audit } from '../util.js';

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
  const existing = await resolveRole(req.user.id);
  if (existing) {
    if (existing.profile.status === 'suspended') return err(res, 403, 'FORBIDDEN', 'This account has been suspended. Contact PESO.');
    return res.status(200).json({ ...existing.profile, role: existing.role });
  }

  const email = req.user.email || b.email || '';
  const person = {};
  for (const k of PERSON) {
    const value = b[k] ?? (k === 'country' ? 'Philippines' : null);
    person[k] = LOWERCASE_PERSON.has(k) && typeof value === 'string' ? value.trim().toLowerCase() : value;
  }
  if (!person.full_name) {
    person.full_name = [person.first_name, person.middle_name, person.last_name, person.suffix].filter(Boolean).join(' ');
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

  const client = await pool.connect();
  try {
    await client.query('begin');
    let row;
    if (role === 'job-seeker') {
      const r = await client.query(
        `insert into job_seekers (id, email, first_name, middle_name, last_name, suffix, full_name, phone,
          lot, block, street_address, house_number_unit, subdivision_building, barangay_district, city_municipality,
          province_state, postal_code, country, birthdate, employment_status, skills)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning *`,
        [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix,
          person.full_name, person.phone,
          typeof b.lot === 'string' ? b.lot.trim().toLowerCase() : null,
          typeof b.block === 'string' ? b.block.trim().toLowerCase() : null, person.street_address,
          person.house_number_unit, person.subdivision_building, person.barangay_district,
          person.city_municipality, person.province_state, person.postal_code,
          person.country ?? 'Philippines', person.birthdate, person.employment_status, skills]
      );
      row = r.rows[0];
      if (education) {
        await client.query(
          `insert into education (seeker_id, level, school, field, end_year) values ($1,$2,$3,$4,$5)`,
          [req.user.id, education.level.trim().toLowerCase(), education.school.trim().toLowerCase(),
            typeof education.field === 'string' ? education.field.trim().toLowerCase() || null : null,
            education.end_year ? Number(education.end_year) : null]
        );
      }
    } else if (role === 'employer') {
      const r = await client.query(
        `insert into employers (id, email, first_name, middle_name, last_name, suffix, full_name, phone,
          company_name, company_email, industry, house_number_unit, street_address, subdivision_building,
          barangay_district, city_municipality, province_state, postal_code, country,
          representative_email, representative_position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning *`,
        [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix,
          person.full_name, person.phone,
          typeof b.company_name === 'string' ? b.company_name.trim().toLowerCase() : '', b.company_email ?? null,
          b.industry ?? null, person.house_number_unit, person.street_address, person.subdivision_building,
          person.barangay_district, person.city_municipality, person.province_state, person.postal_code,
          person.country ?? 'Philippines', b.representative_email ?? null,
          b.representative_position ?? null]
      );
      row = r.rows[0];
      // Mirror handle_new_user: employer signup opens a pending accreditation row.
      await client.query(`insert into employer_accreditations (company_id) values ($1)`, [req.user.id]);
    } else {
      const r = await client.query(
        `insert into super_admins (id, email, first_name, middle_name, last_name, suffix, full_name)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix, person.full_name]
      );
      row = r.rows[0];
    }
    await client.query('commit');
    void audit(req.user.id, 'auth.register', role === 'job-seeker' ? 'job_seekers' : role === 'employer' ? 'employers' : 'super_admins', req.user.id, { role });
    res.status(201).json({ ...row, role });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}));

// Client-observed events only; server-side data auditing stays in the handlers.
router.post('/audit', tokenAuth, ah(async (req, res) => {
  const { action, entity, entity_id, details } = req.body || {};
  if (typeof action !== 'string' || !action.trim() || action.length > 100) {
    return err(res, 400, 'BAD_REQUEST', 'action must be a short non-empty string');
  }
  await audit(req.user.id, action.trim(), entity ?? null, entity_id ?? null, details ?? null);
  res.status(204).end();
}));

// Replaces the getProfile fan-out. Valid token + no row → 404 (needs provision);
// suspended row → 403.
router.get('/auth/me', tokenAuth, ah(async (req, res) => {
  const found = await resolveRole(req.user.id);
  if (!found) return err(res, 404, 'NOT_FOUND', 'Profile not found for this account');
  if (found.profile.status === 'suspended') return err(res, 403, 'FORBIDDEN', 'This account has been suspended. Contact PESO.');
  res.json({ ...found.profile, role: found.role });
}));

export default router;
