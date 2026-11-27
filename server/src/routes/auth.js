import express, { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { pool } from '../db.js';
import { auth, resolveRole, tokenAuth } from '../auth.js';
import { auth as baAuth } from '../ba.js';
import { ah, err, audit, buildFullName, isNumericId, isUuid, withTransaction } from '../util.js';
import { loadVocabulary, canonicalizeField } from '../vocabulary.js';
import logger from '../logger.js';

const router = Router();

const PERSON = ['first_name', 'middle_name', 'last_name', 'suffix', 'full_name', 'phone',
  'house_number_unit', 'street_address', 'subdivision_building', 'barangay_district',
  'city_municipality', 'province_state', 'postal_code', 'country', 'nationality', 'birthdate', 'employment_status'];
const LOWERCASE_PERSON = new Set(['first_name', 'middle_name', 'last_name', 'suffix', 'full_name',
  'house_number_unit', 'street_address', 'subdivision_building', 'barangay_district',
  'city_municipality', 'province_state', 'postal_code', 'country']);
const EMPLOYMENT_STATUSES = ['Employed', 'Unemployed', 'Underemployed', 'Fresh Graduate', 'Student'];

// ADR-056 decision 8 / Review Focus 5: BA's requireEmailVerification returns no
// session at sign-up and stores only name/email, so the registration form's
// role/profile would be lost until the first verified sign-in. This pre-auth,
// rate-limited write parks it on public.pending_signups against an existing
// UNVERIFIED auth."user" row (id and lower(email) must match). It never writes
// auth.*, never creates a session or role row, and never accepts super-admin or
// a custom-role tag — those are admin-invite only. Unknown body keys are
// harmless: provision reads only its allowlist.
router.post('/auth/pending-signup', express.json(), ah(async (req, res) => {
  const b = req.body || {};
  if (!isUuid(b.userId) || typeof b.email !== 'string' || !b.email.trim()) {
    return err(res, 400, 'BAD_REQUEST', 'userId (uuid) and email are required');
  }
  if (!['job-seeker', 'employer'].includes(b.role)) {
    return err(res, 400, 'BAD_REQUEST', 'role must be job-seeker or employer');
  }
  if ('custom_role_id' in b) {
    return err(res, 400, 'BAD_REQUEST', 'custom_role_id cannot be set at signup');
  }
  const { rows } = await pool.query(
    `select id from auth."user"
      where id = $1 and lower(email) = lower($2) and "emailVerified" = false`,
    [b.userId, b.email]);
  if (!rows[0]) return err(res, 400, 'BAD_REQUEST', 'No unverified account matches this id and email');
  const profile = { ...b };
  for (const k of ['userId', 'email', 'role', 'custom_role_id']) delete profile[k];
  await pool.query(
    `insert into public.pending_signups (user_id, role, profile) values ($1,$2,$3)
     on conflict (user_id) do update set role = excluded.role, profile = excluded.profile`,
    [b.userId, b.role, profile]);
  // Counts/ids only: the body is PII and must never reach the log line.
  logger.info('pending signup saved', { userId: b.userId, profileFields: Object.keys(profile).length });
  res.json({ saved: true });
}));

// Replaces handle_new_user. Idempotent on (id) — 200 if the row already exists.
// Addendum B: token-only auth, NO provisioned-row gate (fresh sessions have no row).
// ADR-056: the BA catch-all owns /api/auth/* before the global express.json(),
// so this route parses its own body (a no-op when a parser already ran).
router.post('/auth/provision', tokenAuth, express.json(), ah(async (req, res) => {
  const b = req.body || {};

  // ADR-056 decision 7: the pending grant lives in public.admin_invites, which
  // only the server invite route writes. When a row exists for this session user
  // it is the sole source of the role AND of the custom-role tag; the body may
  // add or correct ordinary profile fields and nothing else (Review Focus 6).
  // Read it first so the super-admin gate judges the role actually written.
  // With no invite, a self-signup's pending_signups row supplies the role and
  // profile fallback (decision 8) — never the custom-role tag.
  const { rows: [invite] } = await pool.query(
    'select * from public.admin_invites where user_id = $1', [req.user.id]);
  // ADR-056 decision 8: a self-signup parked its role/profile before email
  // verification. Read it only when no invite exists — the invite is the
  // stronger signal (and the pending row is still consumed below). Aliased so
  // the columns never collide with the role-union query.
  let pending = null;
  if (!invite) {
    const { rows } = await pool.query(
      'select p.role, p.profile from public.pending_signups p where p.user_id = $1', [req.user.id]);
    pending = rows[0] ?? null;
  }
  const role = invite ? invite.role : (b.role ?? pending?.role);
  if (!['job-seeker', 'employer', 'super-admin'].includes(role)) {
    return err(res, 400, 'BAD_REQUEST', 'role must be job-seeker, employer, or super-admin');
  }
  // super-admin comes only from a provider-side signal the client cannot write:
  // BA's admin-plugin user.role, or app_metadata (service-role only) during the
  // dual window. The body (and user_metadata) are client-writable, so a body
  // role alone must never create a super_admins row: fail closed when the
  // unforgeable signal is missing or says otherwise.
  const providerRole = req.user.source === 'ba' ? req.user.role : req.user.app_metadata?.role;
  if (role === 'super-admin' && providerRole !== 'super-admin') {
    return err(res, 403, 'FORBIDDEN', 'Super-admin accounts can only be provisioned from an admin invite.');
  }
  // G-01: a legacy invite written before custom_role_id moved into app_metadata
  // has no such key. Absent is NOT "no tag" (which would be break-glass) —
  // refuse and make the admin re-send. A present 0 is the full-admin sentinel
  // (R10-02: GoTrue strips JSON null, so the grant needs a value it keeps);
  // seekers and employers self-signup without a key. A BA invite carries its
  // grant in the admin_invites row instead, where null means "no custom role".
  if (!invite && !pending && role === 'super-admin' && !('custom_role_id' in (req.user.app_metadata || {}))) {
    return err(res, 403, 'INVITE_INCOMPLETE', 'Invite is incomplete. Re-send the invite.');
  }
  // Existing behavior first: an already-provisioned user keeps their row, and a
  // pending invite (if any) is never consumed.
  const existing = await resolveRole(req.user.id);
  if (existing) {
    if (existing.profile.status !== 'active') return err(res, 403, 'FORBIDDEN', 'This account has been suspended or deactivated. Contact PESO.');
    return res.status(200).json({ ...existing.profile, role: existing.role });
  }

  // An invited user may send {}: the pending profile fills the gaps and the body
  // may add/correct ordinary fields. Role and tag never come from it. A
  // self-signup's pending row works the same way, one signal weaker than an
  // invite.
  const p = invite ? { ...(invite.profile || {}), ...b }
    : pending ? { ...(pending.profile || {}), ...b }
    : b;
  const email = req.user.email || p.email || '';
  const person = {};
  for (const k of PERSON) {
    const value = p[k] ?? (k === 'country' ? 'Philippines' : null);
    person[k] = LOWERCASE_PERSON.has(k) && typeof value === 'string' ? value.trim().toLowerCase() : value;
  }
  // Fixed service scope: Santa Maria, Bulacan only (ADR-062). Lowercase to
  // match the LOWERCASE_PERSON convention these two keys already follow.
  person.city_municipality = 'santa maria';
  person.province_state = 'bulacan';
  person.postal_code = '3022';
  // first/middle/last/suffix are `not null default ''` in all three role tables
  // (schema.sql). An omitted field inserted as an explicit NULL raises 23502 and
  // 500s the provision — the schema default only applies to ABSENT columns, and
  // the column list here is always full. '' is also what the UI sends for blank
  // fields, so absent === blank for every caller.
  for (const k of ['first_name', 'middle_name', 'last_name', 'suffix']) person[k] ??= '';
  if (!person.full_name) {
    person.full_name = buildFullName(person.first_name, person.middle_name, person.last_name, person.suffix);
  }
  const employmentStatus = p.employment_status ?? null;
  if (employmentStatus !== null && employmentStatus !== '' && !EMPLOYMENT_STATUSES.includes(employmentStatus)) {
    return err(res, 400, 'BAD_REQUEST', 'employment_status must be Employed, Unemployed, Underemployed, Fresh Graduate, or Student');
  }
  person.employment_status = employmentStatus || null;
  // `field` mirrors the profile PATCH: optional, null clears it, and a value
  // outside job_field is a 400 rather than a silent blank.
  let field = null;
  if (role === 'job-seeker' && p.field != null) {
    const resolved = await canonicalizeField(p.field);
    if (!resolved.ok) return err(res, 400, 'BAD_REQUEST', 'field must be a listed job field');
    field = resolved.value;
  }
  // A listed skill is stored in the vocabulary's canonical casing, so signup and
  // the profile PATCH agree ("MS Excel", never "ms excel"). A skill outside the
  // vocabulary is kept exactly as typed rather than rejecting the signup — no
  // value is dropped, and matching compares case-insensitively.
  // ponytail: keep legacy free text at signup; reject unknowns once no legacy rows exist.
  let skills = [];
  if (role === 'job-seeker' && Array.isArray(p.skills) && p.skills.length) {
    const vocab = await loadVocabulary();
    const seen = new Set();
    for (const raw of p.skills) {
      if (typeof raw !== 'string') continue;
      const typed = raw.trim();
      const key = typed.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      skills.push(vocab.skill.get(key) ?? typed);
    }
  }
  const education = role === 'job-seeker' ? p.education : null;
  if (education && (
    typeof education.level !== 'string' || !education.level.trim() ||
    typeof education.school !== 'string' || !education.school.trim() ||
    (education.end_year !== null && education.end_year !== undefined && !Number.isInteger(Number(education.end_year)))
  )) {
    return err(res, 400, 'BAD_REQUEST', 'education requires a level and school, with an optional graduation year');
  }

  // G-01: the legacy invite tag comes ONLY from service-role app_metadata — the
  // same unforgeable signal as `role`. The request body is client-writable, so
  // it is ignored outright. Resolve it fail-closed (R10-01): 0 (or "0") is the
  // full-admin sentinel; a numeric id must still resolve to a custom_role row;
  // anything else present is a stale/unknown grant and is refused, never widened
  // to break-glass. A present null is tolerated defensively (the platform strips
  // it), and self-signup has no tag at all. A BA session never reads
  // app_metadata: its grant is the admin_invites row claimed below.
  let customRoleId = null;
  if (!invite) {
    const rawTag = req.user.source === 'ba' ? undefined : (req.user.app_metadata || {}).custom_role_id;
    if (rawTag != null) {
      if (isNumericId(rawTag) && Number(rawTag) === 0) {
        customRoleId = null;
      } else if (isNumericId(rawTag)) {
        const { rows } = await pool.query(
          `select id from reference_data where id = $1 and category = 'custom_role'`, [rawTag]);
        if (!rows[0]) return err(res, 403, 'INVITE_INCOMPLETE', 'Invite is incomplete. Re-send the invite.');
        customRoleId = rows[0].id;
      } else {
        return err(res, 403, 'INVITE_INCOMPLETE', 'Invite is incomplete. Re-send the invite.');
      }
    }
  }

  // ADR-059: a self-signup must affirm the Terms, and only the server stamps the
  // record — a client timestamp/version is never trusted. Checked last so every
  // ordinary validation error keeps its specific code; no write happens before
  // this point. Admin invites are exempt (staff consent is an HR/onboarding act),
  // so their rows stay exactly as before.
  const selfSignup = !invite && (role === 'job-seeker' || role === 'employer');
  // ADR-059: the flag may arrive in the body or in the registration form parked
  // by /auth/pending-signup (the /complete-registration flow sends {}).
  const termsAccepted = b.terms_accepted === true || pending?.profile?.terms_accepted === true;
  if (selfSignup && !termsAccepted) {
    return err(res, 400, 'CONSENT_REQUIRED', 'Terms must be accepted to register');
  }
  let termsVersion = null;
  if (selfSignup) {
    const { rows: terms } = await pool.query(
      `select updated_at from public.legal_documents where key = 'terms'`);
    termsVersion = terms[0]?.updated_at ? new Date(terms[0].updated_at).toISOString() : 'unknown';
  }

  let row;
  try {
    const result = await withTransaction(async (client) => {
      let tag = customRoleId;
      if (invite) {
        // The invite's grant must still resolve; null is "no custom role" (the
        // old 0 sentinel was a GoTrue JSON artifact). Fail closed, and do it
        // before the claim so a bad grant does not burn the invite.
        if (invite.custom_role_id != null) {
          const grant = await client.query(
            `select id from reference_data where id = $1 and category = 'custom_role'`, [invite.custom_role_id]);
          if (!grant.rows[0]) return { incomplete: true };
          tag = grant.rows[0].id;
        }
        // Claim AND delete the invite in the SAME transaction as the role-row
        // insert: a concurrent (or replayed) provision finds no row here and
        // inserts nothing, and a rollback restores the invite.
        const claimed = await client.query(
          'delete from public.admin_invites where user_id = $1 returning *', [req.user.id]);
        if (!claimed.rows[0]) return { raced: true };
      }
      // The self-signup row is always consumed here — after a successful invite
      // claim too, so an invited user's stale pending row cannot outlive the
      // role insert. A pre-read row another provision claimed first is the same
      // race as an invite: insert nothing and re-resolve.
      const claimedPending = await client.query(
        'delete from public.pending_signups where user_id = $1 returning *', [req.user.id]);
      if (pending && !claimedPending.rows[0]) return { raced: true };
      let created;
      if (role === 'job-seeker') {
        const r = await client.query(
          `insert into job_seekers (id, email, first_name, middle_name, last_name, suffix, full_name, phone,
            lot, block, street_address, house_number_unit, subdivision_building, barangay_district, city_municipality,
            province_state, postal_code, country, nationality, birthdate, employment_status, field, skills, custom_role_id,
            terms_accepted_at, terms_version)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
                   case when $25 then now() end, $26) returning *`,
          [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix,
            person.full_name, person.phone,
            typeof p.lot === 'string' ? p.lot.trim().toLowerCase() : null,
            typeof p.block === 'string' ? p.block.trim().toLowerCase() : null, person.street_address,
            person.house_number_unit, person.subdivision_building, person.barangay_district,
            person.city_municipality, person.province_state, person.postal_code,
            person.country ?? 'Philippines', person.nationality || 'Filipino', person.birthdate,
            person.employment_status, field, skills, tag, selfSignup, termsVersion]
        );
        created = r.rows[0];
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
            representative_email, representative_position, custom_role_id, representative_phone,
            terms_accepted_at, terms_version)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
                   case when $24 then now() end, $25) returning *`,
          [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix,
            person.full_name, person.phone,
            typeof p.company_name === 'string' ? p.company_name.trim().toLowerCase() : '', p.company_email ?? null,
            p.industry ?? null, person.house_number_unit, person.street_address, person.subdivision_building,
            person.barangay_district, person.city_municipality, person.province_state, person.postal_code,
            person.country ?? 'Philippines', p.representative_email ?? null,
            p.representative_position ?? null, tag, p.representative_phone ?? null,
            selfSignup, termsVersion]
        );
        created = r.rows[0];
        // Mirror handle_new_user: employer signup opens a pending accreditation row.
        await client.query(`insert into employer_accreditations (company_id) values ($1)`, [req.user.id]);
      } else {
        const r = await client.query(
          `insert into super_admins (id, email, first_name, middle_name, last_name, suffix, full_name, custom_role_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
          [req.user.id, email, person.first_name, person.middle_name, person.last_name, person.suffix, person.full_name, tag]
        );
        created = r.rows[0];
      }
      return { row: created, tag };
    });
    if (result.incomplete) return err(res, 403, 'INVITE_INCOMPLETE', 'Invite is incomplete. Re-send the invite.');
    if (result.raced) {
      // A concurrent provision consumed the invite between our read and the
      // claim. Re-resolve: the documented 200 if the row appeared, else fail.
      const again = await resolveRole(req.user.id);
      if (!again) return err(res, 403, 'FORBIDDEN', 'Invite already used. Contact PESO.');
      if (again.profile.status !== 'active') return err(res, 403, 'FORBIDDEN', 'This account has been suspended or deactivated. Contact PESO.');
      return res.status(200).json({ ...again.profile, role: again.role });
    }
    row = result.row;
    customRoleId = result.tag;
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
  void audit(req.user.id, 'auth.register', role === 'job-seeker' ? 'job_seekers' : role === 'employer' ? 'employers' : 'super_admins', req.user.id, { role, custom_role_id: customRoleId });
  res.status(201).json({ ...row, role });
}));

// ADR-056: the client's change-email panel re-authenticates before BA starts the
// address change. BA's verifyPassword reads the session cookie (its own API, not
// a client-supplied identity) and answers { status: true } or throws
// INVALID_PASSWORD. Translate that to the app contract; a BA error body never
// reaches the client. Route-level parser: BA's catch-all owns /api/auth/* before
// the global express.json(), exactly like provision.
router.post('/auth/verify-password', auth, express.json(), ah(async (req, res) => {
  const password = req.body?.password;
  if (typeof password !== 'string' || !password) {
    return err(res, 400, 'BAD_REQUEST', 'password is required');
  }
  try {
    await baAuth.api.verifyPassword({ body: { password }, headers: fromNodeHeaders(req.headers) });
  } catch (e) {
    // Only the failed check becomes our 401; the message stays neutral.
    if (e?.body?.code === 'INVALID_PASSWORD') {
      return err(res, 401, 'INVALID_PASSWORD', 'Current password is incorrect');
    }
    // A legacy Supabase bearer has no BA session to verify against.
    if (e?.status === 'UNAUTHORIZED') return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    throw e;
  }
  res.json({ valid: true });
}));

// Replaces the getProfile fan-out. Valid token + no row → 404 (needs provision);
// non-active row → 403.
router.get('/auth/me', tokenAuth, ah(async (req, res) => {
  const found = await resolveRole(req.user.id);
  if (!found) return err(res, 404, 'NOT_FOUND', 'Profile not found for this account');
  if (found.profile.status !== 'active') return err(res, 403, 'FORBIDDEN', 'This account has been suspended or deactivated. Contact PESO.');
  // Role-table email sync (Phase 2, Task 2.2): Supabase is identity; the role
  // row's email lags until the next /auth/me. Sync idempotently on a mismatch.
  const tokenEmail = req.user.email;
  if (typeof tokenEmail === 'string' && tokenEmail.length > 0 && tokenEmail !== found.profile.email) {
    const table = found.role === 'job-seeker' ? 'job_seekers'
      : found.role === 'employer' ? 'employers'
      : found.role === 'super-admin' ? 'super_admins' : null;
    if (table) {
      await pool.query(`update ${table} set email = $2 where id = $1`, [found.profile.id, tokenEmail]);
      void audit(req.user.id, 'account.email.sync', table, found.profile.id, { from: found.profile.email, to: tokenEmail });
      found.profile.email = tokenEmail;
    }
  }
  // Phase 4, Task 4.1: surface the permission bundle (null = full admin), the
  // custom role id, and the authenticator assurance level. ADR-056: a BA session
  // is aal2 iff the signed-in user has a TOTP factor — BA issues no session
  // before the factor step completes, so the user flag is the whole signal. The
  // legacy Supabase bearer keeps the JWT `aal` claim decode.
  const permissions = found.role === 'super-admin'
    ? (found.custom_role_id == null ? null : (Array.isArray(found.permissions) ? found.permissions : []))
    : [];
  const customRoleId = found.custom_role_id ?? null;
  let aal = 'aal1';
  if (req.user.source === 'ba') {
    aal = req.user.twoFactorEnabled ? 'aal2' : 'aal1';
  } else {
    const token = (req.headers.authorization || '').replace(/^bearer\\s+/i, '');
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
      if (payload?.aal === 'aal2') aal = 'aal2';
    } catch {
      aal = 'aal1';
    }
  }
  // ADR-040: tell the client whether an avatar exists so a photo-less profile
  // makes no image request at all (and a removed photo does not 404 on reload).
  if (found.role === 'job-seeker') {
    const { rows: [img] } = await pool.query(
      `select updated_at from profile_images where owner_id = $1 and kind = 'seeker-avatar'`,
      [req.user.id]);
    return res.json({ ...found.profile, role: found.role, has_avatar: Boolean(img), avatar_updated_at: img?.updated_at || null, permissions, custom_role_id: customRoleId, aal });
  }
  // The employer's account picture is the company logo; same rule as ADR-040:
  // report existence and version, never the bytes.
  if (found.role === 'employer') {
    const { rows: [img] } = await pool.query(
      `select updated_at from profile_images where owner_id = $1 and kind = 'employer-logo'`,
      [req.user.id]);
    return res.json({ ...found.profile, role: found.role, has_logo: Boolean(img), logo_updated_at: img?.updated_at || null, permissions, custom_role_id: customRoleId, aal });
  }
  res.json({ ...found.profile, role: found.role, permissions, custom_role_id: customRoleId, aal });
}));

export default router;
