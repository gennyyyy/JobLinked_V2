import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { ah, err, isUuid } from '../util.js';

const router = Router();

router.get('/seekers/me/saved-jobs', auth, requireRole('job-seeker'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `select s.id, s.job_id, s.created_at,
       json_build_object('id', j.id, 'title', j.title, 'status', j.status,
         'employers', json_build_object('id', e.id, 'company_name', e.company_name)) as job
     from saved_jobs s
     join job_vacancies j on j.id = s.job_id
     left join employers e on e.id = j.company_id
     where s.seeker_id = $1
     order by s.created_at desc`, [req.user.id]);
  res.json({ data: rows });
}));

router.post('/seekers/me/saved-jobs', auth, requireRole('job-seeker'), ah(async (req, res) => {
  const { job_id } = req.body || {};
  if (!job_id || !isUuid(job_id)) return err(res, 400, 'BAD_REQUEST', 'job_id must be a valid uuid');
  const { rows: jrows } = await pool.query('select id, status from job_vacancies where id = $1', [job_id]);
  const job = jrows[0];
  if (!job || job.status !== 'published') return err(res, 400, 'BAD_REQUEST', 'Job not visible');
  const r = await pool.query(
    `insert into saved_jobs (seeker_id, job_id) values ($1, $2)
     on conflict (seeker_id, job_id) do nothing returning id`,
    [req.user.id, job_id]);
  if (r.rows[0]) {
    res.status(201).json({ saved: true });
  } else {
    res.status(200).json({ saved: true });
  }
}));

router.delete('/seekers/me/saved-jobs/:jobId', auth, requireRole('job-seeker'), ah(async (req, res) => {
  if (!isUuid(req.params.jobId)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const r = await pool.query(
    'delete from saved_jobs where seeker_id = $1 and job_id = $2', [req.user.id, req.params.jobId]);
  if (!r.rowCount) return err(res, 404, 'NOT_FOUND', 'Saved job not found');
  res.json({ deleted: true });
}));

export default router;
