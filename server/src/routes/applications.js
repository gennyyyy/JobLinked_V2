import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { ah, err, audit, notifyUser } from '../util.js';

const router = Router();
const SEEKER_COLS = 'id, full_name, email, phone, barangay_district, skills, employment_status, preferred_position, preferred_location';

// Single-query embeds (no PostgREST ambiguous-FK problem server-side).
const appSelect = (seekerJoin) => `select a.*,
  json_build_object('id', j.id, 'title', j.title, 'location', j.location,
    'employment_type', j.employment_type, 'company_id', j.company_id,
    'employers', json_build_object('id', e.id, 'company_name', e.company_name)) as job,
  ${seekerJoin ? `json_build_object(${SEEKER_COLS.split(', ').map((c) => `'${c.trim()}', s.${c.trim()}`).join(', ')}) as seeker,` : ''}
  (select json_build_object('id', r.id, 'file_name', r.file_name, 'file_path', r.file_path)
   from resumes r where r.id = a.resume_id) as resume
from job_applications a
join job_vacancies j on j.id = a.job_id
join employers e on e.id = j.company_id
${seekerJoin ? 'join job_seekers s on s.id = a.seeker_id' : ''}`;

async function loadApp(id, withSeeker = true) {
  const { rows } = await pool.query(`${appSelect(withSeeker)} where a.id = $1`, [id]);
  return rows[0] || null;
}

async function loadJob(id) {
  const { rows } = await pool.query('select * from job_vacancies where id = $1', [id]);
  return rows[0] || null;
}

// Owner employer of the job, or admin.
const ownOrAdmin = async (req, res, app) => {
  if (!app) { err(res, 404, 'NOT_FOUND', 'Application not found'); return null; }
  if (req.user.role === 'super-admin') return app;
  const job = await loadJob(app.job_id);
  if (!job || job.company_id !== req.user.id) { err(res, 403, 'FORBIDDEN', 'Not your job posting'); return null; }
  return app;
};

router.post('/applications', auth, requireRole('job-seeker'), ah(async (req, res) => {
  const { job_id, resume_id = null } = req.body || {};
  if (!job_id) return err(res, 400, 'BAD_REQUEST', 'job_id is required');
  const job = await loadJob(job_id);
  if (!job) return err(res, 404, 'NOT_FOUND', 'Job not found');
  if (job.status !== 'published') return err(res, 400, 'BAD_REQUEST', 'This job is not accepting applications');
  if (resume_id) {
    const { rows } = await pool.query('select id from resumes where id = $1 and seeker_id = $2', [resume_id, req.user.id]);
    if (!rows[0]) return err(res, 400, 'BAD_REQUEST', 'The selected resume is no longer available. Please reload and try again.');
  }
  let row;
  try {
    const r = await pool.query(
      `insert into job_applications (job_id, seeker_id, resume_id) values ($1,$2,$3)
       returning id, job_id, seeker_id, resume_id, status, applied_at, updated_at`,
      [job_id, req.user.id, resume_id]);
    row = r.rows[0];
  } catch (e) {
    if (e.code === '23505') return err(res, 409, 'CONFLICT', 'You have already applied to this job.');
    throw e;
  }
  void audit(req.user.id, 'application.create', 'job_applications', row.id);
  const { rows: srows } = await pool.query('select full_name from job_seekers where id = $1', [req.user.id]);
  void notifyUser(job.company_id, { type: 'application', title: 'New applicant',
    message: `${srows[0]?.full_name || 'A job seeker'} applied for ${job.title}.`, link: '/employer/applicants' });
  res.status(201).json(row);
}));

router.get('/applications/mine', auth, requireRole('job-seeker'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `${appSelect(false)} where a.seeker_id = $1 order by a.applied_at desc`, [req.user.id]);
  res.json(rows);
}));

router.get('/applications/job/:jobId', auth, ah(async (req, res) => {
  const job = await loadJob(req.params.jobId);
  if (!job) return err(res, 404, 'NOT_FOUND', 'Job not found');
  if (req.user.role !== 'super-admin' && job.company_id !== req.user.id) {
    return err(res, 403, 'FORBIDDEN', 'Not your job posting');
  }
  const { rows } = await pool.query(
    `${appSelect(true)} where a.job_id = $1 order by a.applied_at desc`, [job.id]);
  res.json(rows);
}));

router.get('/applications/company/:companyId', auth, ah(async (req, res) => {
  if (req.user.role !== 'super-admin' && req.params.companyId !== req.user.id) {
    return err(res, 403, 'FORBIDDEN', 'Not your company');
  }
  const { rows } = await pool.query(
    `${appSelect(true)} where j.company_id = $1 order by a.applied_at desc`, [req.params.companyId]);
  void audit(req.user.id, 'application.list.view', 'job_applications', null, { companyId: req.params.companyId });
  res.json(rows);
}));

// Application + history row in one transaction; seeker notify is best-effort.
router.post('/applications/:id/status', auth, ah(async (req, res) => {
  const app = await ownOrAdmin(req, res, await loadApp(req.params.id));
  if (!app) return;
  const { status, remarks = null, employerNotes = null, interviewAt = null, interviewInstructions = null } = req.body || {};
  const valid = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Accepted', 'Rejected', 'Placed', 'Terminated'];
  if (!valid.includes(status)) return err(res, 400, 'BAD_REQUEST', `status must be one of ${valid.join(', ')}`);
  const patch = { status };
  if (remarks !== null) patch.employer_notes = remarks;
  if (employerNotes !== null) patch.employer_notes = employerNotes;
  if (interviewAt !== null) patch.interview_at = interviewAt;
  if (interviewInstructions !== null) patch.interview_instructions = interviewInstructions;
  const keys = Object.keys(patch);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update job_applications set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
      [app.id, ...keys.map((k) => patch[k])]);
    await client.query(
      'insert into application_status_history (application_id, status, remarks, changed_by) values ($1,$2,$3,$4)',
      [app.id, status, remarks, req.user.id]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  void audit(req.user.id, `application.status.${status}`, 'job_applications', app.id);
  const updated = await loadApp(app.id);
  if (updated?.seeker_id) {
    void notifyUser(updated.seeker_id, { type: 'application', title: `Application ${status}`,
      message: `Your application for "${updated.job?.title}" is now ${status}.`, link: '/job-seeker/applications' });
  }
  res.json(updated);
}));

// Addendum B: employer credential reads — same join rule as the resume-file
// exception (a job_applications row links the seeker to one of their jobs).
const credByLink = (table, order) => ah(async (req, res) => {
  const seekerId = req.params.seekerId;
  if (req.user.role !== 'super-admin' && seekerId !== req.user.id) {
    if (req.user.role !== 'employer') return err(res, 403, 'FORBIDDEN', 'Not your applicant');
    const { rows: link } = await pool.query(
      `select 1 from job_applications a join job_vacancies j on j.id = a.job_id
       where j.company_id = $1 and a.seeker_id = $2 limit 1`, [req.user.id, seekerId]);
    if (!link[0]) return err(res, 403, 'FORBIDDEN', 'Not your applicant');
  }
  const { rows } = await pool.query(`select * from ${table} where seeker_id = $1 order by ${order}`, [seekerId]);
  res.json(rows);
});
router.get('/applications/seekers/:seekerId/education', auth, credByLink('education', 'id desc'));
router.get('/applications/seekers/:seekerId/experience', auth, credByLink('work_experience', 'id desc'));
router.get('/applications/seekers/:seekerId/employment', auth, credByLink('employment_history', 'created_at desc'));

router.get('/applications/:id/history', auth, ah(async (req, res) => {
  const app = await loadApp(req.params.id, false);
  if (!app) return err(res, 404, 'NOT_FOUND', 'Application not found');
  if (req.user.role !== 'super-admin' && app.seeker_id !== req.user.id) {
    const job = await loadJob(app.job_id);
    if (!job || job.company_id !== req.user.id) return err(res, 403, 'FORBIDDEN', 'Not your application');
  }
  const { rows } = await pool.query(
    'select * from application_status_history where application_id = $1 order by changed_at desc', [app.id]);
  res.json(rows);
}));

export default router;
