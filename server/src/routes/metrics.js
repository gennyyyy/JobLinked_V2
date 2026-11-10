import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { metricsSnapshot } from '../middleware/metrics.js';

// G15 (ADR-043): the scrape endpoint for the counters in middleware/metrics.js.
//
// Gated by METRICS_TOKEN, not by a session: a scraper has no user account, and
// this process is single-tenant. Unset token = the route does not exist (404, not
// 401) so a disabled endpoint is indistinguishable from a missing one. The token
// compare is constant-time, and the payload carries route *counts* only — no
// query strings, no user ids, no bodies.
const router = Router();

function tokenMatches(provided) {
  const expected = process.env.METRICS_TOKEN;
  if (!expected || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.get('/metrics', (req, res) => {
  if (!tokenMatches(req.headers['x-metrics-token'])) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  res.json(metricsSnapshot());
});

export default router;
