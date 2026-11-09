import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import applicationsRoutes from './routes/applications.js';
import profilesRoutes from './routes/profiles.js';
import adminRoutes from './routes/admin.js';
import adminUsersRoutes from './routes/admin-users.js';
import adminJobsRoutes from './routes/admin-jobs.js';
import adminReferenceRoutes from './routes/admin-reference.js';
import notificationsRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';
import aiMatchRoutes from './routes/aiMatch.js';
import health from './routes/health.js';
import { authLimiter, uploadLimiter, apiLimiter } from './middleware/rateLimit.js';
import requestId from './middleware/requestId.js';
import requestLog from './middleware/requestLog.js';
import logger from './logger.js';
import { err } from './util.js';
import { attachPrincipal } from './auth.js';

// The whole Express stack, wired once here and reused by the test harness
// (server/src/__tests__/helpers/app.js) so the tests drive the real middleware
// order instead of a mirror that can drift.
export function createApp() {
  const app = express();
  // F5 (docs/arch/audit/phase4-loadtest.md): TRUST_PROXY defaults to 0 — FAIL
  // SAFE. Behind one proxy the operator must set it explicitly (nginx / Caddy /
  // Cloudflare → 1); the old default of 1 let a directly-exposed instance have
  // its whole rate-limit scheme rotated away, because any client could then
  // mint fresh buckets by rotating a client-set X-Forwarded-For. With 0,
  // req.ip is the socket address, which a client cannot forge. A number is hop
  // count; NaN/other spellings trust nothing (same fail-closed behaviour as 0).
  // Local dev (npm run dev:api) has no proxy in front, so it now keys on the
  // real socket address — the F-01/F-02 limiter tests that need per-worker
  // buckets must send X-Forwarded-For themselves, exactly like the load
  // harness does under --xff. To measure per-worker throughput locally, start
  // the API with TRUST_PROXY=1 to reproduce the documented single-proxy
  // deployment; the harness sends X-Forwarded-For under --xff either way.
  const trustHops = Number(process.env.TRUST_PROXY ?? 0);
  app.set('trust proxy', Number.isFinite(trustHops) ? trustHops : false);
  // C3: security headers, default set. crossOriginResourcePolicy must be
  // cross-origin — the SPA on another origin fetches /api/files/*, and
  // same-origin would block those cross-origin reads.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // H1: gzip/deflate the JSON payloads (compression's own 1kb threshold keeps
  // tiny responses like /api/health untouched).
  app.use(compression());
  // Fail closed in production: a forgotten CORS_ORIGIN must not reflect every
  // origin. In local dev, accept any localhost port *on top of* the configured
  // list — Vite falls back to 5174/5175 when 5173 is taken, and a CORS_ORIGIN
  // pinned to 5173 would otherwise lock the API out (204 with no ACAO, which
  // reads as a CORS failure in the console).
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  const devOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
  const allowOrigin = process.env.NODE_ENV === 'production'
    ? (corsOrigins?.length ? corsOrigins : ['http://localhost:5173'])
    : [...(corsOrigins || []), devOrigin];
  // Boot-time, not per request: a silent localhost-only lock-out makes every
  // app fetch fail with no ACAO while the pages still render chrome.
  if (!corsOrigins?.length && process.env.NODE_ENV === 'production') {
    logger.warn('CORS_ORIGIN unset in production — failing closed to localhost only');
  }
  // F5 follow-up: behind a reverse proxy with TRUST_PROXY at its fail-closed
  // default of 0, every request appears to come from the proxy's socket IP —
  // so every IP-keyed limiter (login/signup/anonymous auth) collapses into
  // one site-wide bucket. The user-keyed path (authKeyGenerator, apiLimiter)
  // is unaffected, but anonymous login from a corporate NAT would still
  // self-DDoS. Mirror the CORS warning style so the operator sees it once.
  if (process.env.NODE_ENV === 'production' && Number(process.env.TRUST_PROXY ?? 0) === 0) {
    logger.warn('TRUST_PROXY unset in production — all requests appear from the proxy IP; IP-keyed limiters become site-wide. Set TRUST_PROXY to the hop count.');
  }
  // L2: cache the preflight for a day so browsers stop re-OPTIONSing.
  app.use(cors({ origin: allowOrigin, maxAge: 86400 }));
  // L3: before the limiters so even 429 answers carry the correlation id.
  app.use(requestId);
  // H5: one JSON access line per request, wrapped around everything below.
  app.use(requestLog);
  // F-01 (launch fix): attach the principal app-wide BEFORE every limiter so
  // authLimiter's keyGenerator can bucket by user id — one noisy authenticated
  // caller on /api/auth/* no longer exhausts the shared IP bucket and locks
  // out the building. Anonymous login/signup still share one IP bucket
  // (authKeyGenerator's fallback), so brute-force defences stay intact.
  // attachPrincipal is best-effort: no bearer token -> returns with no
  // Supabase round-trip, so anonymous health probes and unauthenticated reads
  // pay nothing.
  app.use('/api', attachPrincipal);
  app.use('/api/auth', authLimiter);
  app.post('/api/documents', uploadLimiter);
  app.post('/api/files/*', uploadLimiter);

  app.get('/api/health', health);
  // C1: general throttle for everything else under /api. Mounted after the
  // auth/upload limiters (which keep their stricter buckets via apiLimiter's
  // skip) and after /api/health so load balancer probes stay unlimited.
  // attachPrincipal already populated req.user app-wide above, so the
  // keyGenerator resolves to the authenticated user id here too.
  app.use('/api', apiLimiter);
  // The body parser runs AFTER every throttle. Before this, an anonymous
  // caller could force up to 1 MB of JSON.parse on the single event loop with
  // no limiter ever seeing the request — measured live: /api/health p50 8.6 s
  // under a 900 KB-body flood from one client. Limiters key on headers/path
  // only (attachPrincipal reads Authorization), so nothing above needs a body.
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', authRoutes, jobsRoutes, applicationsRoutes, profilesRoutes, adminRoutes, adminUsersRoutes, adminJobsRoutes, adminReferenceRoutes, notificationsRoutes, reportsRoutes, aiRoutes, aiMatchRoutes);

  app.use('/api', (_req, res) => err(res, 404, 'NOT_FOUND', 'Route not found'));
  // eslint-disable-next-line no-unused-vars
  app.use((e, _req, res, _next) => {
    if (e.status === 400 || e.status === 413) {
      // body-parser client faults. Never log e.message: V8's parse error
      // quotes the offending body snippet. The request line (requestLog)
      // already records the 400 with its correlation id; e.type is all the
      // detail worth keeping ('entity.parse.failed' / 'entity.too.large').
      logger.error('bad_request', { id: _req.id, method: _req.method, path: _req.path, type: e.type });
      // Honor the parser status: an oversized body is HTTP 413 (`PAYLOAD_TOO_LARGE`),
      // a malformed one plain 400. Same shape either way; the client keys on `error.code`.
      return err(res, e.status, e.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        e.status === 413 ? 'Payload too large' : 'Invalid request body');
    }
    // Pool saturation / Postgres going away is BACKPRESSURE, not an application
    // fault. A 2,000-concurrent burst produced 1,991 `timeout exceeded when
    // trying to connect` answers as 500s; clients and the proxy should retry
    // those, so answer 503 with Retry-After. pg's pool-connect timeout carries
    // no SQLSTATE, hence the message match.
    if (e?.code === 'ECONNREFUSED' || e?.code === '57P01' || e?.code === '57P03' || e?.code === '53300' || e?.code === '57014'
      || /timeout exceeded when trying to connect|connection terminated due to connection timeout|timeout expired|due to statement timeout|due to idle-in-transaction timeout/i.test(e?.message || '')) {
      logger.error('db_unavailable', { id: _req.id, method: _req.method, path: _req.path, code: e?.code });
      res.setHeader('Retry-After', '5');
      return err(res, 503, 'SERVICE_UNAVAILABLE', 'The service is busy. Please retry shortly.');
    }
    // Never log e itself: pg DatabaseError carries .query/.parameters — the
    // citizen record. Diagnostics only: code/SQLSTATE/message + method/path,
    // with the L3 request id (and the user id when the route is authenticated)
    // so a client report can be traced to the log.
    logger.error('unhandled_error', {
      id: _req.id, userId: _req.user?.id, method: _req.method, path: _req.path,
      code: e?.code, sqlState: e?.sqlState, message: e?.message,
    });
    err(res, 500, 'INTERNAL', 'Something went wrong');
  });

  return app;
}
