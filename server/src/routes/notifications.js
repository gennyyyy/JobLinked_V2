import { Router } from 'express';
import { pool } from '../db.js';
import { auth } from '../auth.js';
import { ah, err, isNumericId } from '../util.js';

const router = Router();

// user_id always comes from the token, never params.
router.get('/notifications/mine', auth, ah(async (req, res) => {
  const vals = [req.user.id];
  const unread = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1'
    ? (vals.push(false), `and is_read = $2`) : '';
  const { rows } = await pool.query(
    `select * from notifications where user_id = $1 ${unread} order by created_at desc limit 50`, vals);
  res.json(rows);
}));

router.post('/notifications/:id/read', auth, ah(async (req, res) => {
  if (!isNumericId(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid notification id');
  // Addendum C: match DELETE — another user's id answers 404, not a
  // non-informative 200 (the update is scoped, but the response must not
  // imply the caller's row was touched).
  const { rows } = await pool.query(
    'update notifications set is_read = true where id = $1 and user_id = $2 returning id',
    [req.params.id, req.user.id]);
  if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Notification not found');
  res.json({ read: true });
}));

router.post('/notifications/read-all', auth, ah(async (req, res) => {
  await pool.query('update notifications set is_read = true where user_id = $1 and is_read = false', [req.user.id]);
  res.json({ read: true });
}));

router.delete('/notifications/:id', auth, ah(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid notification id');
  const { rowCount } = await pool.query('delete from notifications where id = $1 and user_id = $2', [req.params.id, req.user.id]);
  if (!rowCount) return err(res, 404, 'NOT_FOUND', 'Notification not found');
  res.json({ deleted: true });
}));

export default router;
