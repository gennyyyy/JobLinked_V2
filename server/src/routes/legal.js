import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { ah, err, audit } from '../util.js';

const router = Router();
const VALID_KEYS = new Set(['privacy', 'terms']);

router.get('/legal/:key', ah(async (req, res) => {
  const key = req.params.key;
  if (!VALID_KEYS.has(key)) return err(res, 400, 'BAD_REQUEST', 'Unknown document');
  const { rows } = await pool.query(
    'select key, body, updated_at from legal_documents where key = $1', [key]);
  if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Document not found');
  res.json({ key: rows[0].key, body: rows[0].body, updated_at: rows[0].updated_at });
}));

const admin = [auth, requireRole('super-admin'), requirePermission('settings.manage')];

router.patch('/admin/legal/:key', ...admin, ah(async (req, res) => {
  const key = req.params.key;
  if (!VALID_KEYS.has(key)) return err(res, 400, 'BAD_REQUEST', 'Unknown document');
  const raw = (req.body || {}).body;
  if (typeof raw !== 'string') return err(res, 400, 'BAD_REQUEST', 'Document body cannot be empty.');
  const body = raw.trim();
  if (body === '') return err(res, 400, 'BAD_REQUEST', 'Document body cannot be empty.');
  if (body.length > 50000) return err(res, 400, 'BAD_REQUEST', 'Document body is too long.');
  const { rows } = await pool.query(
    'update legal_documents set body = $1, updated_at = now(), updated_by = $2 where key = $3 returning key, body, updated_at',
    [body, req.user.id, key]);
  if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Document not found');
  void audit(req.user.id, 'settings.legal.update', 'legal_documents', key, { key });
  res.json({ key: rows[0].key, body: rows[0].body, updated_at: rows[0].updated_at });
}));

export default router;
