import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole, requirePermission } from '../auth.js';
import { ah, err, isUuid, notifyUser } from '../util.js';

const router = Router();

router.post('/seekers/me/employment/:employmentId/corrections', auth, requireRole('job-seeker'), ah(async (req, res) => {
  if (!isUuid(req.params.employmentId)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const { message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) return err(res, 400, 'BAD_REQUEST', 'message is required');
  if (message.trim().length > 1000) return err(res, 400, 'BAD_REQUEST', 'message must be at most 1000 characters');
  const { rows: empRows } = await pool.query(
    'select id, seeker_id, employer_name, position from employment_history where id = $1', [req.params.employmentId]);
  const emp = empRows[0];
  if (!emp || emp.seeker_id !== req.user.id) return err(res, 404, 'NOT_FOUND', 'Employment record not found');
  const { rows } = await pool.query(
    `insert into employment_corrections (employment_id, seeker_id, message)
     values ($1,$2,$3) returning *`,
    [req.params.employmentId, req.user.id, message.trim()]);
  res.status(201).json({ ...rows[0], employment: { employer_name: emp.employer_name, position: emp.position } });
}));

router.get('/seekers/me/corrections', auth, requireRole('job-seeker'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `select c.*, json_build_object('employer_name', e.employer_name, 'position', e.position) as employment
     from employment_corrections c
     join employment_history e on e.id = c.employment_id
     where c.seeker_id = $1
     order by c.created_at desc`, [req.user.id]);
  res.json({ data: rows });
}));

router.get('/admin/employment-corrections', auth, requireRole('super-admin'), requirePermission('employees'), ah(async (req, res) => {
  const status = req.query.status;
  const vals = [];
  const where = status ? (vals.push(status), 'where c.status = $1') : '';
  const { rows } = await pool.query(
    `select c.*,
       json_build_object('full_name', s.full_name, 'email', s.email) as seeker,
       json_build_object('employer_name', e.employer_name, 'position', e.position) as employment
     from employment_corrections c
     join job_seekers s on s.id = c.seeker_id
     join employment_history e on e.id = c.employment_id
     ${where}
     order by c.created_at desc`, vals);
  res.json({ data: rows });
}));

router.patch('/admin/employment-corrections/:id', auth, requireRole('super-admin'), requirePermission('employees'), ah(async (req, res) => {
  if (!isUuid(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const { status = 'Reviewed', resolution = null } = req.body || {};
  if (!['Pending', 'Reviewed'].includes(status)) return err(res, 400, 'BAD_REQUEST', 'status must be Pending or Reviewed');
  const { rows: existing } = await pool.query('select * from employment_corrections where id = $1', [req.params.id]);
  if (!existing[0]) return err(res, 404, 'NOT_FOUND', 'Correction not found');
  const prev = existing[0];
  const reviewedAt = status === 'Reviewed' ? new Date().toISOString() : prev.reviewed_at;
  const { rows } = await pool.query(
    `update employment_corrections set status = $2, resolution = coalesce($3, resolution), reviewed_by = $4, reviewed_at = $5
     where id = $1 returning *`,
    [req.params.id, status, resolution, req.user.id, reviewedAt]);
  if (status === 'Reviewed') {
    void notifyUser(prev.seeker_id, { type: 'correction', title: 'Employment correction reviewed',
      message: resolution || 'Your employment correction request has been reviewed.', link: '/jobseeker/employment-tracking' });
  }
  res.json(rows[0]);
}));

export default router;
