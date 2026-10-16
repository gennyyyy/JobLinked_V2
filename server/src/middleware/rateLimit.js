import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// ponytail: in-memory store (single instance). Use a Redis store if the API ever runs multi-instance.
// 429s use the same { error: { code, message } } shape as the rest of the API.
const limited = (res) => res.status(429).json({
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => limited(res),
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => limited(res),
});

// Keyed by user id: this runs after `auth`, so `req.user.id` is always set for
// real traffic. The ip fallback only covers the impossible-but-defensive case.
// ipKeyGenerator is the library helper for that fallback (v8 throws on raw req.ip).
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => limited(res),
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
});

// C1: general throttle for every other /api route — 300 req/15min keyed by
// user id when available, IP for anonymous calls. The principal is attached
// app-level by attachPrincipal (auth.js) before this limiter runs, so the key
// is the authenticated user (NAT'd users get separate buckets), never the
// shared proxy IP. Auth + uploads keep their own stricter buckets: the skip
// mirrors exactly what authLimiter/uploadLimiter already cover, so those
// paths are never double-counted.
export const stricterLimiterPaths = (req) =>
  req.path.startsWith('/auth') ||
  (req.method === 'POST' && (req.path === '/documents' || req.path.startsWith('/files/')));

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => limited(res),
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  skip: stricterLimiterPaths,
});
