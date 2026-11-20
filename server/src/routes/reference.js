import { Router } from 'express';
import { pool } from '../db.js';
import { ah, err } from '../util.js';

const router = Router();

// Only the two public vocabularies. `custom_role` rows are permission bundles
// and stay behind the authenticated /admin/roles endpoints — never allowlist
// by "anything that is not admin".
const PUBLIC_CATEGORIES = new Set(['job_field', 'skill']);

router.get(['/reference', '/reference/:category'], ah(async (req, res) => {
  const category = String(req.params.category || '').trim();
  if (!PUBLIC_CATEGORIES.has(category)) {
    return err(res, 400, 'UNKNOWN_CATEGORY', 'Unknown reference category');
  }
  const { rows } = await pool.query(
    'select value from reference_data where category = $1 order by sort_order, value', [category]);
  res.json({ values: rows.map((row) => row.value) });
}));

export default router;
