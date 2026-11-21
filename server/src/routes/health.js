import { pool } from '../db.js';

// Shallow (default): the database answers `select 1`. `?deep=true` additionally
// checks that Better Auth's tables exist (ADR-056). to_regclass is a local
// catalog lookup — no Supabase round-trip and no auth token needed, so a
// missing `auth` schema (migration 017 not applied) reads as unavailable while
// the app tables still answer. A null result IS the failure: to_regclass returns
// null instead of raising when the relation is absent.
export default async function health(req, res) {
  try {
    await pool.query('select 1');
  } catch {
    return res.status(503).json({ ok: false, db: 'unavailable' });
  }
  if (req.query.deep === 'true') {
    try {
      const { rows } = await pool.query(`select to_regclass('auth."user"') as t`);
      if (!rows[0]?.t) return res.status(503).json({ ok: false, db: 'ok', auth: 'unavailable' });
    } catch {
      return res.status(503).json({ ok: false, db: 'ok', auth: 'unavailable' });
    }
    return res.json({ ok: true, db: 'ok', auth: 'ok' });
  }
  res.json({ ok: true, db: 'ok' });
}
