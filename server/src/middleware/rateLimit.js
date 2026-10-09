import { rateLimit } from 'express-rate-limit';

// ponytail: in-memory store (single instance). Use a Redis store if the API ever runs multi-instance.
// Auth + upload routes only ΓÇö everything else stays unthrottled by design.
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
