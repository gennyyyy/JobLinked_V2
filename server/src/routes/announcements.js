import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole, requirePermission } from '../auth.js';
import { ah, err, isUuid, notifyAllActiveUsers } from '../util.js';

const router = Router();

const shape = (r) => ({
  id: r.id,
  title: r.title,
  body: r.body,
  category: r.category,
  status: r.status,
  published_at: r.published_at,
  created_at: r.created_at,
  author_name: r.author_name ?? null,
});

router.get('/announcements', auth, ah(async (req, res) => {
  const { rows } = await pool.query(
    `select a.*, sa.full_name as author_name from announcements a
     left join super_admins sa on sa.id = a.author_id
     where a.status = 'published' order by a.published_at desc nulls last, a.created_at desc`);
  res.json({ data: rows.map(shape) });
}));

router.get('/admin/announcements', auth, requireRole('super-admin'), requirePermission('announcements'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `select a.*, sa.full_name as author_name from announcements a
     left join super_admins sa on sa.id = a.author_id
     order by a.created_at desc`);
  res.json({ data: rows.map(shape) });
}));

router.post('/admin/announcements', auth, requireRole('super-admin'), requirePermission('announcements'), ah(async (req, res) => {
  const { title, body, category = 'General', publish = false } = req.body || {};
  if (!title || typeof title !== 'string') return err(res, 400, 'BAD_REQUEST', 'title is required');
  if (!body || typeof body !== 'string') return err(res, 400, 'BAD_REQUEST', 'body is required');
  let status = 'draft';
  let publishedAt = null;
  if (publish) { status = 'published'; publishedAt = new Date().toISOString(); }
  const { rows } = await pool.query(
    `insert into announcements (title, body, category, status, author_id, published_at)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [title.trim(), body, category, status, req.user.id, publishedAt]);
  const row = rows[0];
  if (publish) {
    void notifyAllActiveUsers({ type: 'announcement', title: row.title, message: row.body, link: '/announcements' });
  }
  res.status(201).json(shape({ ...row, author_name: null }));
}));

router.patch('/admin/announcements/:id', auth, requireRole('super-admin'), requirePermission('announcements'), ah(async (req, res) => {
  if (!isUuid(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const { rows: existing } = await pool.query('select * from announcements where id = $1', [req.params.id]);
  if (!existing[0]) return err(res, 404, 'NOT_FOUND', 'Announcement not found');
  const prev = existing[0];
  const { title, body, category, status } = req.body || {};
  const nextStatus = status === 'published' ? 'published' : (status === 'draft' ? 'draft' : prev.status);
  const shouldPublish = nextStatus === 'published' && !prev.published_at;
  const { rows } = await pool.query(
    `update announcements set
       title = coalesce($2, title),
       body = coalesce($3, body),
       category = coalesce($4, category),
       status = $5,
       published_at = case when $6 then now() else published_at end,
       updated_at = now()
     where id = $1 returning *`,
    [req.params.id,
     title !== undefined ? String(title).trim() : null,
     body !== undefined ? body : null,
     category !== undefined ? category : null,
     nextStatus, shouldPublish]);
  const row = rows[0];
  if (shouldPublish) {
    void notifyAllActiveUsers({ type: 'announcement', title: row.title, message: row.body, link: '/announcements' });
  }
  res.json(shape({ ...row, author_name: null }));
}));

router.delete('/admin/announcements/:id', auth, requireRole('super-admin'), requirePermission('announcements'), ah(async (req, res) => {
  if (!isUuid(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const r = await pool.query('delete from announcements where id = $1', [req.params.id]);
  if (!r.rowCount) return err(res, 404, 'NOT_FOUND', 'Announcement not found');
  res.json({ deleted: true });
}));

export default router;
