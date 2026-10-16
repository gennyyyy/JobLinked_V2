import { Router } from 'express';
import { pool } from '../db.js';
import { auth, optionalAuth, requireRole } from '../auth.js';
import { ah, err, audit, notifyAdmins, isUuid, likeEscape, pageParams, withTransaction } from '../util.js';

const router = Router();
const JOB_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'published', 'closed', 'archived'];
// Employer writes must not set the PESO review statuses — pending/approved/
// rejected belong to the admin review flow (audit noise + a job that can jump
// the accreditation gate). Owners get this set; super-admins keep the full
// enum. No employer UI sends the review values (JobPosts: draft/published/
// closed/archived only).
const EMPLOYER_JOB_STATUSES = ['draft', 'published', 'closed', 'archived'];
const jobStatusesFor = (user) => (user?.role === 'super-admin' ? JOB_STATUSES : EMPLOYER_JOB_STATUSES);
const JOB_ARRANGEMENTS = ['On-site', 'Remote / Work from home', 'Hybrid'];
const ORDER_COLS = ['created_at', 'updated_at', 'salary_min', 'salary_max', 'title', 'deadline', 'published_at'];

const embed = (j) => ({ ...j, employers: j.company_id ? { id: j.company_id, company_name: j.company_name, logo_path: j.logo_path } : null });

async function loadJob(id) {
  if (!isUuid(id)) return null; // S1: 404, not a 22P02 500
  const { rows } = await pool.query(
    `select j.*, e.company_name, e.logo_path from job_vacancies j
     left join employers e on e.id = j.company_id where j.id = $1`, [id]);
  return rows[0] || null;
}

// Public job visibility: only 'published' posts are readable by everyone;
// drafts/pending/rejected stay with their owner or a super-admin.
export function canViewJob(job, user) {
  if (!job) return false;
  if (job.status === 'published') return true;
  return Boolean(user && (user.role === 'super-admin' || job.company_id === user.id));
}

// The public list only ever shows 'published'. A caller-supplied status is
// honoured only for a super-admin — everyone else (anon included) is pinned
// to 'published', so drafts/pending/rejected can't be enumerated.
export function listStatusFor(requestedStatus, user) {
  return user?.role === 'super-admin' ? (requestedStatus || 'published') : 'published';
}

const ownOrAdmin = async (req, res, job) => {
  if (!job) { err(res, 404, 'NOT_FOUND', 'Job not found'); return null; }
  if (req.user.role !== 'super-admin' && job.company_id !== req.user.id) {
    err(res, 403, 'FORBIDDEN', 'Not your job posting');
    return null;
  }
  return job;
};

router.get('/jobs', optionalAuth, ah(async (req, res) => {
  const q = req.query;
  // B7: the shared pageParams guard — Number() (not parseInt — '1e21' must not
  // silently parse), junk → 400, then clamped so an absurd page cannot
  // overflow the SQL OFFSET. Public list keeps its 10/100 defaults.
  const pg = pageParams(res, q, 10);
  if (!pg) return;
  // B6: an enum-valued status (super-admin only; everyone else is pinned to
  // 'published') must be a real job_status, not a 22P02 500.
  if (req.user?.role === 'super-admin' && q.status && !JOB_STATUSES.includes(q.status)) {
    return err(res, 400, 'BAD_REQUEST', `status must be one of ${JOB_STATUSES.join(', ')}`);
  }
  const safePage = pg.page;
  const safeSize = pg.pageSize;
  const status = listStatusFor(q.status, req.user);
  const [oc, od] = String(q.order || 'created_at.desc').split('.');
  const orderCol = ORDER_COLS.includes(oc) ? oc : 'created_at';
  const orderDir = od === 'asc' ? 'asc' : 'desc';
  const where = ['j.status = $1'];
  const vals = [status];
  if (q.search) { vals.push(`%${likeEscape(q.search)}%`, `%${likeEscape(q.search)}%`); where.push(`(j.title ilike $${vals.length - 1} or j.description ilike $${vals.length})`); }
  if (q.location) { vals.push(`%${likeEscape(q.location)}%`); where.push(`j.location ilike $${vals.length}`); }
  if (q.employmentType) { vals.push(q.employmentType); where.push(`j.employment_type = $${vals.length}`); }
  if (q.workArrangement) {
    if (!JOB_ARRANGEMENTS.includes(q.workArrangement)) return err(res, 400, 'BAD_REQUEST', `workArrangement must be one of ${JOB_ARRANGEMENTS.join(', ')}`);
    vals.push(q.workArrangement);
    where.push(`j.work_arrangement = $${vals.length}`);
  }
  const employers = String(q.employer || '').split(',').map((name) => name.trim()).filter(Boolean);
  if (employers.length) {
    const employerConditions = employers.map((name) => {
      vals.push(`%${likeEscape(name)}%`);
      return `e.company_name ilike $${vals.length}`;
    });
    where.push(`(${employerConditions.join(' or ')})`);
  }
  if (q.salaryMin && !Number.isNaN(Number(q.salaryMin))) {
    vals.push(Number(q.salaryMin), Number(q.salaryMin));
    where.push(`(j.salary_min >= $${vals.length - 1} or j.salary_max >= $${vals.length})`);
  }
  // Skills match runs in SQL (same where clause as the count) so `total` and
  // the page agree; mirrors the old JS haystack: title + description +
  // requirements + tags, any term, case-insensitive substring.
  // B8: a repeated ?skills= key arrives as an ARRAY — String() first so the
  // trim/split cannot throw a TypeError.
  const skills = String(q.skills ?? '');
  if (skills.trim()) {
    const terms = skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (terms.length) {
      vals.push(terms.map((t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`)); // escape LIKE wildcards — JS matched them literally
      where.push(`(j.title || ' ' || coalesce(j.description,'') || ' ' || coalesce(j.requirements,'') || ' ' || array_to_string(j.tags,' ')) ilike any($${vals.length}::text[])`);
    }
  }
  const whereSql = `where ${where.join(' and ')}`;
  const total = (await pool.query(
    `select count(*)::int c from job_vacancies j left join employers e on e.id = j.company_id ${whereSql}`, vals)).rows[0].c;
  const { rows } = await pool.query(
    `select j.*, e.company_name, e.logo_path from job_vacancies j
     left join employers e on e.id = j.company_id ${whereSql}
     order by j.${orderCol} ${orderDir} limit $${vals.length + 1} offset $${vals.length + 2}`,
    [...vals, safeSize, (safePage - 1) * safeSize]);
  const jobs = rows.map(embed);
  res.json({ jobs, total, page: safePage, pageSize: safeSize });
}));

router.get('/jobs/:id', optionalAuth, ah(async (req, res) => {
  const job = await loadJob(req.params.id);
  if (!job) return err(res, 404, 'NOT_FOUND', 'Job not found');
  if (!canViewJob(job, req.user)) return err(res, 404, 'NOT_FOUND', 'Job not found');
  res.json(embed(job));
}));

// applicant_count replaces the embedded job_applications(count). Same
// { data, total, page, pageSize } envelope as the public list (M1): count +
// SQL LIMIT/OFFSET, default pageSize 25 / max 500 so a long-tenured employer's
// listing is one screen by default and never unbounded.
router.get('/employers/:employerId/jobs', auth, ah(async (req, res) => {
  if (!isUuid(req.params.employerId)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  if (req.user.role !== 'super-admin' && req.params.employerId !== req.user.id) {
    return err(res, 403, 'FORBIDDEN', 'Not your company');
  }
  const pg = pageParams(res, req.query, 25, 500);
  if (!pg) return;
  const vals = [req.params.employerId];
  let statusSql = '';
  if (req.query.status) {
    if (!JOB_STATUSES.includes(req.query.status)) {
      return err(res, 400, 'BAD_REQUEST', `status must be one of ${JOB_STATUSES.join(', ')}`);
    }
    vals.push(req.query.status); statusSql = `and j.status = $${vals.length}`;
  }
  const base = `from job_vacancies j left join employers e on e.id = j.company_id
      where j.company_id = $1 ${statusSql}`;
  const total = (await pool.query(`select count(*)::int c ${base}`, vals)).rows[0].c;
  const { rows } = await pool.query(
    `select j.*, e.company_name, e.logo_path,
       (select count(*)::int from job_applications a where a.job_id = j.id) as applicant_count ${base}
      order by j.created_at desc limit $${vals.length + 1} offset $${vals.length + 2}`,
    [...vals, pg.pageSize, (pg.page - 1) * pg.pageSize]);
  void audit(req.user.id, 'job.list.view', 'job_vacancies', null, { companyId: req.params.employerId });
  res.json({ data: rows.map(embed), total, page: pg.page, pageSize: pg.pageSize });
}));

const JOB_COLS = ['title', 'office', 'location', 'employment_type', 'work_arrangement', 'salary_min', 'salary_max',
  'description', 'requirements', 'benefits', 'vacancies', 'deadline', 'instructions', 'tags', 'status', 'remarks'];

// Best-effort seeker matching on publish (skills overlap or location match).
// Exported so the admin review-approve path (admin.js, sibling-owned) can call it too.
// ponytail: naive fan-out, no queue/dedup — proper matcher/queue if publish gets noisy.
export async function notifyMatchingSeekers(job) {
  try {
    const tags = Array.isArray(job?.tags) ? job.tags.filter(Boolean) : [];
    const loc = (job?.location || '').trim();
    if (!tags.length && !loc) return;
    const conds = [];
    const vals = [];
    if (tags.length) { vals.push(tags); conds.push(`skills && $${vals.length}::text[]`); }
    if (loc) { vals.push(`%${likeEscape(loc)}%`); conds.push(`preferred_location ilike $${vals.length}`); }
    const title = 'New job for you';
    const message = `"${job.title}" matches your profile.`;
    const link = `/job-seeker/jobs/${job.id}`;
    // One multi-row insert (same fan-out shape as admin.js system-broadcast)
    // instead of a per-seeker INSERT loop. Matching SQL + limit 100 unchanged.
    await pool.query(
      `insert into notifications (user_id, type, title, message, link)
       select id, 'job', $${vals.length + 1}, $${vals.length + 2}, $${vals.length + 3}
       from (select id from job_seekers where status = 'active' and (${conds.join(' or ')}) limit 100) m`,
      [...vals, title, message, link]);
  } catch { /* ponytail: publish succeeds even when matching/notify fails */ }
}

// Single-transaction job + history write shared by PATCH and POST /:id/status.
export async function writeStatus(client, jobId, status, remarks, changedBy) {
  const stamps = { published: 'published_at', closed: 'closed_at', archived: 'archived_at' };
  await client.query(
    `update job_vacancies set status = $2, remarks = $3, updated_at = now()${stamps[status] ? `, ${stamps[status]} = now()` : ''} where id = $1`,
    [jobId, status, remarks]);
  await client.query(
    'insert into job_status_history (job_id, status, remarks, changed_by) values ($1,$2,$3,$4)',
    [jobId, status, remarks, changedBy]);
}

// ADR-022 keeps "must be accredited before posting" but enforced it only in the
// JobPosts client guard. A UI check is not enforcement at the trust boundary —
// any employer could POST directly and harvest citizen resumes. Same rule, now
// also enforced here. Non-approved employers may still save drafts.
async function employerMayPublish(companyId) {
  const { rows } = await pool.query(
    'select accreditation_status from employers where id = $1', [companyId]);
  return rows[0]?.accreditation_status === 'approved';
}

// Returns true when the caller may move/create a job in `published`.
// Sends the 403 and returns false otherwise.
async function canPublish(req, res, companyId) {
  if (req.user?.role === 'super-admin') return true;
  if (await employerMayPublish(companyId)) return true;
  err(res, 403, 'FORBIDDEN',
    'Your company must be accredited by PESO before it can publish job posts. Save this as a draft and submit your accreditation documents.');
  return false;
}

router.post('/jobs', auth, requireRole('employer'), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.title) return err(res, 400, 'BAD_REQUEST', 'title is required');
  if (b.work_arrangement !== undefined && !JOB_ARRANGEMENTS.includes(b.work_arrangement)) {
    return err(res, 400, 'BAD_REQUEST', `work_arrangement must be one of ${JOB_ARRANGEMENTS.join(', ')}`);
  }
  const cols = ['company_id'];
  const vals = [req.user.id];
  for (const c of JOB_COLS) {
    if (c === 'status') continue; // client status ignored except draft — see below
    if (b[c] !== undefined) { cols.push(c); vals.push(c === 'tags' && !Array.isArray(b[c]) ? [] : (b[c] === '' ? null : b[c])); }
  }
  // Employers publish directly (ADR-000): a non-draft create goes live now, no PESO review gate.
  const status = b.status === 'draft' ? 'draft' : 'published';
  if (status === 'published' && !(await canPublish(req, res, req.user.id))) return;
  cols.push('status'); vals.push(status);
  let jobId;
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into job_vacancies (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning id`, vals);
    jobId = rows[0].id;
    await writeStatus(client, jobId, status, b.remarks ?? null, req.user.id);
  });
  const job = await loadJob(jobId);
  void audit(req.user.id, 'job.create', 'job_vacancies', job.id);
  if (status === 'published') {
    void notifyAdmins({ type: 'job', title: 'Job published',
      message: `"${job.title}" (${job.company_name}) is now live on the job board.`, link: '/super-admin/job-posts' });
    void notifyMatchingSeekers(job);
  }
  res.status(201).json(embed(job));
}));

router.patch('/jobs/:id', auth, ah(async (req, res) => {
  const job = await ownOrAdmin(req, res, await loadJob(req.params.id));
  if (!job) return;
  const patch = {};
  for (const c of JOB_COLS) if (req.body?.[c] !== undefined) patch[c] = req.body[c] === '' && c !== 'title' ? null : req.body[c];
  if (patch.work_arrangement !== undefined && !JOB_ARRANGEMENTS.includes(patch.work_arrangement)) {
    return err(res, 400, 'BAD_REQUEST', `work_arrangement must be one of ${JOB_ARRANGEMENTS.join(', ')}`);
  }
  // '' is coerced to null above, and `vacancies int not null` (schema.sql:190)
  // cannot store null — an emptied or non-integer value must answer 400 here
  // instead of raising 23502 on the UPDATE.
  if (patch.vacancies !== undefined && (patch.vacancies === null || !Number.isInteger(Number(patch.vacancies)))) {
    return err(res, 400, 'BAD_REQUEST', 'vacancies must be a whole number');
  }
  if (!Object.keys(patch).length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
  if (patch.status !== undefined) {
    const allowed = jobStatusesFor(req.user);
    if (!allowed.includes(patch.status)) return err(res, 400, 'BAD_REQUEST', `status must be one of ${allowed.join(', ')}`);
    if (patch.status === 'published' && !(await canPublish(req, res, req.user.id))) return;
    const { status, ...rest } = patch;
    const remarks = patch.remarks !== undefined ? patch.remarks : job.remarks;
    const restKeys = Object.keys(rest).filter((k) => k !== 'remarks');
    await withTransaction(async (client) => {
      if (restKeys.length) {
        await client.query(
          `update job_vacancies set ${restKeys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
          [job.id, ...restKeys.map((k) => rest[k])]);
      }
      await writeStatus(client, job.id, status, remarks, req.user.id);
    });
    void audit(req.user.id, 'job.update', 'job_vacancies', job.id);
    const patched = await loadJob(job.id);
    if (status === 'published') void notifyMatchingSeekers(patched);
    return res.json(embed(patched));
  }
  const keys = Object.keys(patch);
  await pool.query(
    `update job_vacancies set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
    [job.id, ...keys.map((k) => patch[k])]);
  void audit(req.user.id, 'job.update', 'job_vacancies', job.id);
  res.json(embed(await loadJob(job.id)));
}));

router.post('/jobs/:id/duplicate', auth, ah(async (req, res) => {
  const job = await ownOrAdmin(req, res, await loadJob(req.params.id));
  if (!job) return;
  const strip = new Set(['id', 'created_at', 'updated_at', 'published_at', 'closed_at', 'archived_at', 'status', 'remarks', 'company_name', 'logo_path']);
  const rest = Object.fromEntries(Object.entries(job).filter(([k, v]) => !strip.has(k) && v !== undefined));
  rest.title = `${job.title} (Copy)`;
  rest.status = 'draft';
  rest.deadline = null;
  const cols = Object.keys(rest);
  const vals = cols.map((k) => (k === 'tags' && !Array.isArray(rest[k]) ? [] : rest[k]));
  let copyId;
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into job_vacancies (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`,
      vals);
    copyId = rows[0].id;
    await client.query(
      'insert into job_status_history (job_id, status, remarks, changed_by) values ($1,$2,$3,$4)',
      [copyId, 'draft', null, req.user.id]);
  });
  const copy = await loadJob(copyId);
  void audit(req.user.id, 'job.create', 'job_vacancies', copy.id);
  res.status(201).json(embed(copy));
}));

// Writes job + job_status_history in the SAME transaction (fixes two-write drift).
router.post('/jobs/:id/status', auth, ah(async (req, res) => {
  const job = await ownOrAdmin(req, res, await loadJob(req.params.id));
  if (!job) return;
  const { status, remarks } = req.body || {};
  const allowed = jobStatusesFor(req.user);
  if (!allowed.includes(status)) return err(res, 400, 'BAD_REQUEST', `status must be one of ${allowed.join(', ')}`);
  if (status === 'published' && !(await canPublish(req, res, req.user.id))) return;
  await withTransaction(async (client) => {
    await writeStatus(client, job.id, status, remarks ?? job.remarks, req.user.id);
  });
  void audit(req.user.id, `job.status.${status}`, 'job_vacancies', job.id);
  const fresh = await loadJob(job.id);
  if (status === 'published') {
    void notifyAdmins({ type: 'job', title: 'Job published',
      message: `"${fresh.title}" (${fresh.company_name}) is now live on the job board.`, link: '/super-admin/job-posts' });
    void notifyMatchingSeekers(fresh);
  }
  res.json(embed(fresh));
}));

// ADR-013: unconditional hard delete. Cascades to job_status_history and
// job_applications (→ application_status_history, employment_history).
// ponytail: destructive by design; the client confirms the application
// count with the employer before calling this.
router.delete('/jobs/:id', auth, ah(async (req, res) => {
  const job = await ownOrAdmin(req, res, await loadJob(req.params.id));
  if (!job) return;
  const { rows } = await pool.query('select count(*)::int c from job_applications where job_id = $1', [job.id]);
  await pool.query('delete from job_vacancies where id = $1', [job.id]);
  void audit(req.user.id, 'job.delete', 'job_vacancies', job.id, { applications: rows[0].c });
  res.json({ deleted: true, applications: rows[0].c });
}));

router.get('/jobs/:id/history', auth, ah(async (req, res) => {
  const job = await ownOrAdmin(req, res, await loadJob(req.params.id));
  if (!job) return;
  const { rows } = await pool.query(
    'select * from job_status_history where job_id = $1 order by changed_at desc', [job.id]);
  res.json(rows);
}));

export default router;
