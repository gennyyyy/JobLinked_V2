import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { ah, err, audit, notifyUser, isUuid, pageParams, withTransaction } from '../util.js';
import { notifyMatchingSeekers } from './jobs.js';

const router = Router();
const admin = [auth, requireRole('super-admin'), requirePermission('jobs.manage')];

router.get('/admin/jobs', ...admin, ah(async (req, res) => {
  const pg = pageParams(res, req.query, 25, 500);
  if (!pg) return;
  const vals = [];
  if (req.query.status && !ADMIN_JOB_STATUSES.includes(req.query.status)) {
    return err(res, 400, 'BAD_REQUEST', `status must be one of ${ADMIN_JOB_STATUSES.join(', ')}`);
  }
  const cond = req.query.status ? (vals.push(req.query.status), `where j.status = $1`) : '';
  const base = `from job_vacancies j left join employers e on e.id = j.company_id ${cond}`;
  const total = (await pool.query(`select count(*)::int c ${base}`, vals)).rows[0].c;
  const { rows } = await pool.query(
    `select j.*, json_build_object('id', e.id, 'company_name', e.company_name, 'accreditation_status', e.accreditation_status) as employers ${base}
     order by j.created_at desc limit $${vals.length + 1} offset $${vals.length + 2}`,
    [...vals, pg.pageSize, (pg.page - 1) * pg.pageSize]);
  res.json({ data: rows, total, page: pg.page, pageSize: pg.pageSize });
}));

// Same JOB_COLS allowlist as employer PATCH /jobs/:id in jobs.js
// (replicated so all edits stay in this file); status goes through the same
// single-transaction job + history write as jobs.js writeStatus.
const ADMIN_JOB_COLS = ['title', 'office', 'location', 'employment_type', 'work_arrangement', 'salary_min', 'salary_max',
  'description', 'requirements', 'benefits', 'vacancies', 'deadline', 'instructions', 'tags', 'status', 'remarks'];
const ADMIN_JOB_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'published', 'closed', 'archived'];
const ADMIN_JOB_ARRANGEMENTS = ['On-site', 'Remote / Work from home', 'Hybrid'];

async function adminWriteStatus(client, jobId, status, remarks, changedBy) {
  const stamps = { published: 'published_at', closed: 'closed_at', archived: 'archived_at' };
  await client.query(
    `update job_vacancies set status = $2, remarks = $3, updated_at = now()${stamps[status] ? `, ${stamps[status]} = now()` : ''} where id = $1`,
    [jobId, status, remarks]);
  await client.query(
    'insert into job_status_history (job_id, status, remarks, changed_by) values ($1,$2,$3,$4)',
    [jobId, status, remarks, changedBy]);
}

router.patch('/admin/jobs/:id', ...admin, ah(async (req, res) => {
  if (!isUuid(req.params.id)) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const { rows: jrows } = await pool.query('select * from job_vacancies where id = $1', [req.params.id]);
  if (!jrows[0]) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const job = jrows[0];
  const patch = {};
  for (const c of ADMIN_JOB_COLS) if (req.body?.[c] !== undefined) patch[c] = req.body[c] === '' && c !== 'title' ? null : req.body[c];
  if (!Object.keys(patch).length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
  if (patch.status !== undefined && !ADMIN_JOB_STATUSES.includes(patch.status)) {
    return err(res, 400, 'BAD_REQUEST', `status must be one of ${ADMIN_JOB_STATUSES.join(', ')}`);
  }
  if (patch.work_arrangement !== undefined && !ADMIN_JOB_ARRANGEMENTS.includes(patch.work_arrangement)) {
    return err(res, 400, 'BAD_REQUEST', `work_arrangement must be one of ${ADMIN_JOB_ARRANGEMENTS.join(', ')}`);
  }
  // '' is coerced to null above, and `vacancies int not null` (schema.sql:190)
  // cannot store null — an emptied or non-integer value must answer 400 here
  // instead of raising 23502 on the UPDATE.
  if (patch.vacancies !== undefined && (patch.vacancies === null || !Number.isInteger(Number(patch.vacancies)))) {
    return err(res, 400, 'BAD_REQUEST', 'vacancies must be a whole number');
  }
  await withTransaction(async (client) => {
    if (patch.status !== undefined) {
      const { status, ...rest } = patch;
      const restKeys = Object.keys(rest).filter((k) => k !== 'remarks');
      if (restKeys.length) {
        await client.query(
          `update job_vacancies set ${restKeys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
          [job.id, ...restKeys.map((k) => rest[k])]);
      }
      await adminWriteStatus(client, job.id, status, patch.remarks !== undefined ? patch.remarks : job.remarks, req.user.id);
    } else {
      const keys = Object.keys(patch);
      await client.query(
        `update job_vacancies set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
        [job.id, ...keys.map((k) => patch[k])]);
    }
  });
  void audit(req.user.id, 'job.update', 'job_vacancies', job.id);
  const { rows } = await pool.query('select * from job_vacancies where id = $1', [job.id]);
  // Review-approve (admin PATCH) → same seeker fan-out as the publish endpoint.
  if (patch.status === 'approved' || patch.status === 'published') void notifyMatchingSeekers(rows[0]);
  res.json(rows[0]);
}));

// Thin adminWriteStatus wrappers: publish → published (+published_at),
// unpublish → draft, each with history row + company notify.
const adminJobPublish = (status, title) => ah(async (req, res) => {
  if (!isUuid(req.params.id)) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const { rows: jrows } = await pool.query('select * from job_vacancies where id = $1', [req.params.id]);
  if (!jrows[0]) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const job = jrows[0];
  await withTransaction(async (client) => {
    await adminWriteStatus(client, job.id, status, job.remarks, req.user.id);
  });
  void audit(req.user.id, `job.${status === 'published' ? 'publish' : 'unpublish'}`, 'job_vacancies', job.id);
  void notifyUser(job.company_id, { type: 'job', title, message: `"${job.title}" ${status === 'published' ? 'is now live on the job board.' : 'was unpublished by PESO.'}`, link: '/employer/job-posts' });
  const { rows } = await pool.query('select * from job_vacancies where id = $1', [job.id]);
  if (status === 'published') void notifyMatchingSeekers(rows[0]);
  res.json(rows[0]);
});
router.post('/admin/jobs/:id/publish', ...admin, adminJobPublish('published', 'Job published'));
router.post('/admin/jobs/:id/unpublish', ...admin, adminJobPublish('draft', 'Job unpublished'));

export default router;
