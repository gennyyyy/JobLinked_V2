import { pool } from '../db.js';
import { supa } from '../auth.js';

// Shallow (default): the database answers `select 1`. `?deep=true` additionally
// probes the Supabase auth service with a dummy token — the cheapest real
// round-trip. auth-js resolves with an AuthError for ANY HTTP answer (see
// auth-js lib/fetch.js: a transport failure becomes AuthRetryableFetchError
// with status 0, a healthy rejection a 4xx), so: answered = up.
export default async function health(req, res) {
  try {
    await pool.query('select 1');
  } catch {
    return res.status(503).json({ ok: false, db: 'unavailable' });
  }
  if (req.query.deep === 'true') {
    try {
      const { error } = await supa().auth.getUser('health-check');
      if (error && (!error.status || error.status >= 500)) {
        return res.status(503).json({ ok: false, db: 'ok', auth: 'unavailable' });
      }
    } catch {
      return res.status(503).json({ ok: false, db: 'ok', auth: 'unavailable' });
    }
    return res.json({ ok: true, db: 'ok', auth: 'ok' });
  }
  res.json({ ok: true, db: 'ok' });
}
