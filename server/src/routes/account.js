import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { pool } from '../db.js';
import { tokenAuth, resolveRole } from '../auth.js';
import { ah, err, audit, withTransaction } from '../util.js';
import { uploadDir } from '../upload.js';
import { clearTokenCache } from '../tokenCache.js';
import logger from '../logger.js';

const ROLE_TABLE = { 'super-admin': 'super_admins', employer: 'employers', 'job-seeker': 'job_seekers' };

const router = Router();

// Dual window: the legacy GoTrue logout is best-effort and only when configured.
async function gotrueLogout(userId) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  const url = `${String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(userId)}/logout`;
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      try { await upstream.body?.cancel?.(); } catch { /* already gone */ }
      logger.error('revoke_all_sessions_failed', { status: upstream.status });
    }
  } catch (e) {
    logger.error('revoke_all_sessions_failed', { reason: e?.name === 'TimeoutError' ? 'timeout' : 'network' });
  }
}

router.get('/account/preferences', tokenAuth, ah(async (req, res) => {
  const { rows } = await pool.query(
    'select application_updates, community_announcements from user_preferences where user_id = $1',
    [req.user.id]);
  const row = rows[0];
  res.json({
    application_updates: row ? row.application_updates : true,
    community_announcements: row ? row.community_announcements : true,
  });
}));

router.patch('/account/preferences', tokenAuth, ah(async (req, res) => {
  const body = req.body || {};
  const hasApp = Object.prototype.hasOwnProperty.call(body, 'application_updates');
  const hasComm = Object.prototype.hasOwnProperty.call(body, 'community_announcements');
  if (!hasApp && !hasComm) return err(res, 400, 'INVALID_PREFERENCES', 'At least one preference key is required');
  if (hasApp && typeof body.application_updates !== 'boolean') return err(res, 400, 'INVALID_PREFERENCES', 'application_updates must be a boolean');
  if (hasComm && typeof body.community_announcements !== 'boolean') return err(res, 400, 'INVALID_PREFERENCES', 'community_announcements must be a boolean');

  const changed = {};
  if (hasApp) changed.application_updates = body.application_updates;
  if (hasComm) changed.community_announcements = body.community_announcements;

  const { rows } = await pool.query(
    `insert into user_preferences (user_id, application_updates, community_announcements)
     values ($1, coalesce($2::boolean, true), coalesce($3::boolean, true))
     on conflict (user_id) do update set
       application_updates = coalesce($2::boolean, user_preferences.application_updates),
       community_announcements = coalesce($3::boolean, user_preferences.community_announcements),
       updated_at = now()
     returning application_updates, community_announcements`,
    [req.user.id, hasApp ? body.application_updates : null, hasComm ? body.community_announcements : null]);
  const row = rows[0];
  void audit(req.user.id, 'account.preferences.update', 'user_preferences', req.user.id, changed);
  res.json({ application_updates: row.application_updates, community_announcements: row.community_announcements });
}));

router.post('/account/sessions/revoke-all', tokenAuth, ah(async (req, res) => {
  // Better Auth owns sessions (ADR-056): deleting the rows signs the user out
  // on every device. Dual window only — the legacy logout below is best-effort.
  await pool.query('delete from auth."session" where "userId" = $1', [req.user.id]);
  // Close the cached-principal window before the upstream call is in flight; a
  // cleared cache costs at most one Supabase round-trip.
  clearTokenCache();
  await gotrueLogout(req.user.id);

  void audit(req.user.id, 'account.sessions.revoke', 'user_preferences', req.user.id);
  res.json({ revoked: true });
}));

// ADR-060 (RA 10173 erasure): anonymise in place, keep placement records.
// Files are captured before their rows go and unlinked best-effort inside the
// same transaction; a failed unlink is logged, never thrown. The Better Auth
// user goes last, which is what makes a repeat call 401.
router.delete('/account', tokenAuth, ah(async (req, res) => {
  if ((req.body || {}).confirm !== 'ERASE') {
    return err(res, 400, 'CONFIRM_REQUIRED', 'Confirmation required');
  }
  const found = await resolveRole(req.user.id);
  const table = found ? ROLE_TABLE[found.role] : null;
  if (!table) return err(res, 404, 'NOT_FOUND', 'Account not found');
  if (found.role === 'super-admin') {
    return err(res, 403, 'FORBIDDEN', 'Super-admin accounts cannot be erased');
  }

  const unlink = (rel) => {
    try { fs.unlinkSync(path.join(uploadDir, rel)); } catch (e) {
      logger.error('erasure_file_unlink_failed', { path: rel, reason: e?.code || 'unknown' });
    }
  };
  // ADR-060: a unique sentinel, not '' — role tables have plain unique email
  // indexes, so two erased rows can coexist only if each keeps a distinct value.
  const erasedEmail = `erased+${req.user.id}@invalid.local`;

  await withTransaction(async (client) => {
    // ADR-060: scrub EVERY role row for the id, not just the one resolveRole()
    // ranks — a role move leaves the old row behind, and it is still the user's
    // data. A single user can own both rows, so both paths can run.
    const { rows: [owned] } = await client.query(
      `select exists (select 1 from public.job_seekers where id = $1) as seeker,
              exists (select 1 from public.employers where id = $1) as employer`, [req.user.id]);
    const scrubbed = [];

    if (owned?.seeker) {
      const { rows: resumes } = await client.query('select file_path from resumes where seeker_id = $1', [req.user.id]);
      await client.query(
        `update public.job_seekers set
           first_name = '', middle_name = '', last_name = '', suffix = '', full_name = '', email = $2,
           phone = null, birthdate = null,
           lot = null, block = null, house_number_unit = null, street_address = null,
           subdivision_building = null, barangay_district = null, city_municipality = null,
           province_state = null, postal_code = null,
           headline = null, education_summary = null, experience_summary = null,
           employment_status = null, preferred_position = null, field = null,
           preferred_location = null,
           skills = '{}',
           status = 'inactive', updated_at = now()
         where id = $1`, [req.user.id, erasedEmail]);
      await client.query('delete from public.education where seeker_id = $1', [req.user.id]);
      await client.query('delete from public.work_experience where seeker_id = $1', [req.user.id]);
      // Placement records survive (RA 8759/10691); only free text and the file ref go.
      await client.query(
        `update public.job_applications
            set employer_notes = null, interview_instructions = null, interview_at = null,
                resume_id = null, updated_at = now()
          where seeker_id = $1`, [req.user.id]);
      await client.query(
        `update public.application_status_history h set remarks = null
           from public.job_applications a
          where a.id = h.application_id and a.seeker_id = $1`, [req.user.id]);
      await client.query('delete from public.resumes where seeker_id = $1', [req.user.id]);
      for (const r of resumes) unlink(r.file_path);
      scrubbed.push('job_seekers');
    }

    if (owned?.employer) {
      const { rows: docs } = await client.query(
        'select file_path from public.employer_documents where company_id = $1', [req.user.id]);
      // Remarks first: the sync trigger copies them onto employers, which the
      // scrub below then blanks.
      await client.query(
        'update public.employer_accreditations set remarks = null where company_id = $1', [req.user.id]);
      await client.query(
        `update public.employers set
           first_name = '', middle_name = '', last_name = '', suffix = '', full_name = '', email = $2,
           phone = null, company_name = '', company_email = null, industry = null,
           house_number_unit = null, street_address = null, subdivision_building = null,
           barangay_district = null, city_municipality = null, province_state = null, postal_code = null,
           representative_email = null, representative_position = null, representative_phone = null,
           website = null, description = null, logo_path = null,
           accreditation_status = null, accreditation_remarks = null,
           status = 'inactive', updated_at = now()
         where id = $1`, [req.user.id, erasedEmail]);
      // The posting body can re-identify the company: archive AND clear the text.
      await client.query(
        `update public.job_vacancies set
           title = 'Archived vacancy', description = null, requirements = null, benefits = null,
           instructions = null, remarks = null, office = null, location = null, field = null,
           tags = '{}', skills = '{}', status = 'archived', archived_at = now(), updated_at = now()
         where company_id = $1`, [req.user.id]);
      await client.query(
        `update public.job_status_history h set remarks = null
           from public.job_vacancies j
          where j.id = h.job_id and j.company_id = $1`, [req.user.id]);
      // Matched terms are extracted from the posting text; they go with it.
      await client.query(
        `delete from public.job_prohibited_flags
          where job_id in (select id from public.job_vacancies where company_id = $1)`, [req.user.id]);
      // The denormalised employer name must not outlive the employer row.
      await client.query(
        `update public.employment_history set employer_name = 'Employer (erased)'
          where application_id in (
            select a.id from public.job_applications a
            join public.job_vacancies j on j.id = a.job_id
            where j.company_id = $1)`, [req.user.id]);
      await client.query('delete from public.employer_documents where company_id = $1', [req.user.id]);
      await client.query('delete from public.employer_document_petitions where company_id = $1', [req.user.id]);
      for (const d of docs) unlink(d.file_path);
      scrubbed.push('employers');
    }

    await client.query('delete from public.pending_signups where user_id = $1', [req.user.id]);
    await client.query('delete from public.notifications where user_id = $1', [req.user.id]);
    await client.query('delete from public.user_preferences where user_id = $1', [req.user.id]);
    await client.query('delete from public.profile_images where owner_id = $1', [req.user.id]);
    // Outstanding reset/verify tokens must not outlive the account.
    await client.query('delete from auth."verification" where identifier = $1', [req.user.email]);
    // ADR-060: the marker commits with the scrub or not at all — transaction
    // client, never the best-effort pool helper.
    const entity = scrubbed.length > 1 ? 'account' : (scrubbed[0] ?? table);
    await client.query(
      'insert into audit_logs (user_id, action, entity, entity_id, details) values ($1,$2,$3,$4,$5)',
      [req.user.id, 'account.erase', entity, String(req.user.id), null]);
    // Last: cascades auth sessions/accounts/2FA and frees the email.
    await client.query('delete from auth."user" where id = $1', [req.user.id]);
  });

  // Dual window: drop the cached principal first (or a repeat call answers 200
  // from the 60s token memo instead of 401), then revoke the legacy session.
  clearTokenCache();
  await gotrueLogout(req.user.id);

  res.json({ erased: true, role: found.role });
}));

// T2 (RA 10173 access right): GET /account/export — the caller's own data as a
// JSON download. Read-only. Never includes sessions/password material, audit
// rows, or any other user's identity; employer exports contain no applicant rows.
router.get('/account/export', tokenAuth, ah(async (req, res) => {
  const found = await resolveRole(req.user.id);
  if (!found) return err(res, 404, 'NOT_FOUND', 'Account not found');
  const role = found.role;
  // Data-subject route (spec: "Seeker and employer"): staff accounts export
  // nothing — the same refusal erasure gives.
  if (role !== 'job-seeker' && role !== 'employer') {
    return err(res, 403, 'FORBIDDEN', 'Export is available to job-seeker and employer accounts');
  }

  const profile = found.profile;
  const consents = {
    terms_accepted_at: profile.terms_accepted_at ?? null,
    terms_version: profile.terms_version ?? null,
  };

  let body;
  if (role === 'job-seeker') {
    const notifications = (await pool.query(
      'select type, title, message, created_at from notifications where user_id = $1 order by created_at desc',
      [req.user.id])).rows;
    const applications = (await pool.query(
      `select a.id, j.title as job_title, e.company_name, a.status, a.applied_at,
              a.interview_at, a.employer_notes, a.interview_instructions,
              coalesce((select json_agg(
                          json_build_object('status', h.status, 'remarks', h.remarks, 'changed_at', h.changed_at)
                          order by h.changed_at)
                          from application_status_history h
                         where h.application_id = a.id), '[]'::json) as status_history
         from job_applications a
         join job_vacancies j on j.id = a.job_id
         join employers e on e.id = j.company_id
        where a.seeker_id = $1
        order by a.applied_at desc`, [req.user.id])).rows;
    const resumes = (await pool.query(
      'select file_name, uploaded_at from resumes where seeker_id = $1 order by uploaded_at desc',
      [req.user.id])).rows;
    body = {
      exported_at: new Date().toISOString(),
      role,
      profile,
      consents,
      applications,
      notifications,
      documents: { resumes },
    };
  } else {
    // ADR-060: notifications are operational records that can name applicants
    // or carry PESO remarks, so the employer envelope omits them entirely; the
    // internal accreditation remarks never leave the app either.
    const employerProfile = { ...profile };
    delete employerProfile.accreditation_remarks;
    const jobVacancies = (await pool.query(
      'select title, status, created_at, deadline from job_vacancies where company_id = $1 order by created_at desc',
      [req.user.id])).rows;
    const accreditations = (await pool.query(
      'select status, submitted_at, decided_at from employer_accreditations where company_id = $1 order by submitted_at desc',
      [req.user.id])).rows;
    const accreditationDocuments = (await pool.query(
      `select doc_type, file_name, status, uploaded_at from employer_documents
        where company_id = $1 order by uploaded_at desc`, [req.user.id])).rows;
    body = {
      exported_at: new Date().toISOString(),
      role,
      profile: employerProfile,
      consents,
      job_vacancies: jobVacancies,
      accreditations,
      documents: { accreditation_documents: accreditationDocuments },
    };
  }

  res.set('Content-Disposition', 'attachment; filename="joblinked-export.json"').json(body);
}));

export default router;
