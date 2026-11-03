import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import applicationsRoutes from './routes/applications.js';
import profilesRoutes from './routes/profiles.js';
import adminRoutes from './routes/admin.js';
import reportsRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';
import health from './routes/health.js';
import { authLimiter, uploadLimiter, apiLimiter, stricterLimiterPaths } from './middleware/rateLimit.js';
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
  // Fail closed: a forgotten CORS_ORIGIN must not reflect every origin.
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').filter(Boolean);
  // L2: cache the preflight for a day so browsers stop re-OPTIONSing.
  app.use(cors({ origin: corsOrigins?.length ? corsOrigins : ['http://localhost:5173'], maxAge: 86400 }));
  // L3: before the limiters so even 429 answers carry the correlation id.
  app.use(requestId);
  // H5: one JSON access line per request, wrapped around everything below.
  app.use(requestLog);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/auth', authLimiter);
  app.post('/api/documents', uploadLimiter);
  app.post('/api/files/*', uploadLimiter);

  app.get('/api/health', health);
  // F-01: attach the principal BEFORE the general limiter so its keyGenerator
  // can key on the authenticated user (req.user.id) instead of the IP — NAT'd
  // users no longer share one 300/15min bucket. The per-request caches in
  // auth.js keep this from adding any Supabase round-trip. The skip mirrors
  // apiLimiter's exactly, so nothing runs where the limiter does not count.
  app.use('/api', (req, res, next) => (stricterLimiterPaths(req) ? next() : attachPrincipal(req, res, next)));
  // C1: general throttle for everything else under /api. Mounted after the
  // auth/upload limiters (which keep their stricter buckets via apiLimiter's
  // skip) and after /api/health so load balancer probes stay unlimited.
  app.use('/api', apiLimiter);
  app.use('/api', authRoutes, jobsRoutes, applicationsRoutes, profilesRoutes, adminRoutes, reportsRoutes, aiRoutes);

  app.use('/api', (_req, res) => err(res, 404, 'NOT_FOUND', 'Route not found'));
  // eslint-disable-next-line no-unused-vars
  app.use((e, _req, res, _next) => {
    if (e.status === 400 || e.status === 413) {
      // body-parser client faults. Never log e.message: V8's parse error
      // quotes the offending body snippet. The request line (requestLog)
      // already records the 400 with its correlation id; e.type is all the
      // detail worth keeping ('entity.parse.failed' / 'entity.too.large').
      logger.error('bad_request', { id: _req.id, method: _req.method, path: _req.path, type: e.type });
      return err(res, 400, e.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        e.status === 413 ? 'Payload too large' : 'Invalid request body');
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
