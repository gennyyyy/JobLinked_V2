import { Router } from 'express';
import { pool } from '../db.js';
import { auth, optionalAuth, requireRole } from '../auth.js';
import { ah, err, audit, notifyAdmins } from '../util.js';

const router = Router();
const JOB_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'published', 'closed', 'archived'];
const ORDER_COLS = ['created_at', 'updated_at', 'salary_min', 'salary_max', 'title', 'deadline', 'published_at'];

const embed = (j) => ({ ...j, employers: j.company_id ? { id: j.company_id, company_name: j.company_name, logo_path: j.logo_path } : null });

async function loadJob(id) {
  const { rows } = await pool.query(
    `select j.*, e.company_name, e.logo_path from job_vacancies j
     left join employers e on e.id = j.company_id where j.id = $1`, [id]);
  return rows[0] || null;
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
  const page = Math.max(1, parseInt(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize) || 10));
  const status = q.status || 'published';
  const [oc, od] = String(q.order || 'created_at.desc').split('.');
  const orderCol = ORDER_COLS.includes(oc) ? oc : 'created_at';
  const orderDir = od === 'asc' ? 'asc' : 'desc';
  const where = ['j.status = $1'];
  const vals = [status];
  if (q.search) { vals.push(`%${q.search}%`, `%${q.search}%`); where.push(`(j.title ilike $${vals.length - 1} or j.description ilike $${vals.length})`); }
  if (q.location) { vals.push(`%${q.location}%`); where.push(`j.location ilike $${vals.length}`); }
  if (q.employmentType) { vals.push(q.employmentType); where.push(`j.employment_type = $${vals.length}`); }
  if (q.employer) { vals.push(`%${q.employer}%`); where.push(`e.company_name ilike $${vals.length}`); }
  if (q.salaryMin && !Number.isNaN(Number(q.salaryMin))) {
    vals.push(Number(q.salaryMin), Number(q.salaryMin));
    where.push(`(j.salary_min >= $${vals.length - 1} or j.salary_max >= $${vals.length})`);
  }
  const whereSql = `where ${where.join(' and ')}`;
  const total = (await pool.query(
    `select count(*)::int c from job_vacancies j left join employers e on e.id = j.company_id ${whereSql}`, vals)).rows[0].c;
  const { rows } = await pool.query(
    `select j.*, e.company_name, e.logo_path from job_vacancies j
     left join employers e on e.id = j.company_id ${whereSql}
     order by j.${orderCol} ${orderDir} limit $${vals.length + 1} offset $${vals.length + 2}`,
    [...vals, pageSize, (page - 1) * pageSize]);
  // Skills filter mirrors the client-side PostgREST workaround (haystack match).
  let jobs = rows.map(embed);
  if (q.skills?.trim()) {
    const terms = q.skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    jobs = jobs.filter((j) => {
      const hay = `${j.title || ''} ${j.description || ''} ${j.requirements || ''} ${(j.tags || []).join(' ')}`.toLowerCase();
      return terms.some((t) => hay.includes(t));
    });
  }
  res.json({ jobs, total, page, pageSize });
}));

router.get('/jobs/:id', optionalAuth, ah(async (req, res) => {
  const job = await loadJob(req.params.id);
  if (!job) return err(res, 404, 'NOT_FOUND', 'Job not found');
  res.json(embed(job));
}));

// applicant_count replaces the embedded job_applications(count).
router.get('/employers/:employerId/jobs', auth, ah(async (req, res) => {
  if (req.user.role !== 'super-admin' && req.params.employerId !== req.user.id) {
    return err(res, 403, 'FORBIDDEN', 'Not your company');
  }
  const vals = [req.params.employerId];
  let statusSql = '';
  if (req.query.status) { vals.push(req.query.status); statusSql = `and j.status = $${vals.length}`; }
  const { rows } = await pool.query(
    `select j.*, e.company_name, e.logo_path,
       (select count(*)::int from job_applications a where a.job_id = j.id) as applicant_count
     from job_vacancies j left join employers e on e.id = j.company_id
     where j.company_id = $1 ${statusSql} order by j.created_at desc`, vals);
  void audit(req.user.id, 'job.list.view', 'job_vacancies', null, { companyId: req.params.employerId });
  res.json(rows.map(embed));
}));

const JOB_COLS = ['title', 'office', 'location', 'employment_type', 'salary_min', 'salary_max',
  'description', 'requirements', 'benefits', 'vacancies', 'deadline', 'instructions', 'tags', 'status', 'remarks'];

// Single-transaction job + history write shared by PATCH and POST /:id/status.
async function writeStatus(client, jobId, status, remarks, changedBy) {
  const stamps = { published: 'published_at', closed: 'closed_at', archived: 'archived_at' };
  await client.query(
    `update job_vacancies set status = $2, remarks = $3, updated_at = now()${stamps[status] ? `, ${stamps[status]} = now()` : ''} where id = $1`,
    [jobId, status, remarks]);
  await client.query(
    'insert into job_status_history (job_id, status, remarks, changed_by) values ($1,$2,$3,$4)',
    [jobId, status, remarks, changedBy]);
}

router.post('/jobs', auth, requireRole('employer'), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.title) return err(res, 400, 'BAD_REQUEST', 'title is required');
  const cols = ['company_id'];
  const vals = [req.user.id];
  for (const c of JOB_COLS) {
    if (b[c] !== undefined) { cols.push(c); vals.push(c === 'tags' && !Array.isArray(b[c]) ? [] : (b[c] === '' ? null : b[c])); }
  }
  const { rows } = await pool.query(
    `insert into job_vacancies (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`, vals);
  const job = await loadJob(rows[0].id);
  void audit(req.user.id, 'job.create', 'job_vacancies', job.id);
  res.status(201).json(embed(job));
}));

router.patch('/jobs/:id', auth, ah(async (req, res) => {
  const job = await ownOrAdmin(req, res, await loadJob(req.params.id));
  if (!job) return;
  const patch = {};
  for (const c of JOB_COLS) if (req.body?.[c] !== undefined) patch[c] = req.body[c] === '' && c !== 'title' ? null : req.body[c];
  if (!Object.keys(patch).length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
  if (patch.status !== undefined) {
    if (!JOB_STATUSES.includes(patch.status)) return err(res, 400, 'BAD_REQUEST', `status must be one of ${JOB_STATUSES.join(', ')}`);
    const { status, ...rest } = patch;
    const remarks = patch.remarks !== undefined ? patch.remarks : job.remarks;
    const restKeys = Object.keys(rest).filter((k) => k !== 'remarks');
    const client = await pool.connect();
    try {
      await client.query('begin');
      if (restKeys.length) {
        await client.query(
          `update job_vacancies set ${restKeys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
          [job.id, ...restKeys.map((k) => rest[k])]);
      }
      await writeStatus(client, job.id, status, remarks, req.user.id);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
    void audit(req.user.id, 'job.update', 'job_vacancies', job.id);
    return res.json(embed(await loadJob(job.id)));
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
  const { rows } = await pool.query(
    `insert into job_vacancies (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`,
    cols.map((k) => (k === 'tags' && !Array.isArray(rest[k]) ? [] : rest[k])));
  const copy = await loadJob(rows[0].id);
  void audit(req.user.id, 'job.create', 'job_vacancies', copy.id);
  res.status(201).json(embed(copy));
}));

// Writes job + job_status_history in the SAME transaction (fixes two-write drift).
router.post('/jobs/:id/status', auth, ah(async (req, res) => {
  const job = await ownOrAdmin(req, res, await loadJob(req.params.id));
  if (!job) return;
  const { status, remarks = null } = req.body || {};
  if (!JOB_STATUSES.includes(status)) return err(res, 400, 'BAD_REQUEST', `status must be one of ${JOB_STATUSES.join(', ')}`);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await writeStatus(client, job.id, status, remarks, req.user.id);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  void audit(req.user.id, `job.status.${status}`, 'job_vacancies', job.id);
  if (status === 'published') {
    void notifyAdmins({ type: 'job', title: 'Job published',
      message: `"${job.title}" (${job.company_name}) is now live on the job board.`, link: '/super-admin/job-posts' });
  }
  res.json(embed(await loadJob(job.id)));
}));

router.get('/jobs/:id/history', auth, ah(async (req, res) => {
  const job = await ownOrAdmin(req, res, await loadJob(req.params.id));
  if (!job) return;
  const { rows } = await pool.query(
    'select * from job_status_history where job_id = $1 order by changed_at desc', [job.id]);
  res.json(rows);
}));

export default router;
