import { Router } from 'express';
import { auth } from '../auth.js';
import { BRIEFS } from '../ai/briefs.js';
import { callChat, resolveConfig } from '../aiProvider.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { ah, err } from '../util.js';

// Returns the validated messages array, or null when the payload breaks the contract.
function validate(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) return null;
  const { messages } = body;
  if (messages.length < 1 || messages.length > 10) return null;
  for (const m of messages) {
    if (!m || typeof m !== 'object') return null;
    if (m.role !== 'user' && m.role !== 'assistant') return null;
    if (typeof m.content !== 'string' || m.content.length > 1000 || m.content.trim().length === 0) return null;
  }
  if (messages[messages.length - 1].role !== 'user') return null;
  return messages;
}

const router = Router();

// Serves every provisioned portal role: the brief is picked server-side from
// the authenticated role, so a client can never select or see another role's.
router.post('/ai/help', auth, aiLimiter, ah(async (req, res) => {
  // Unknown/unserved role first — Object.hasOwn, not a plain lookup, so names
  // such as `constructor` or `__proto__` never resolve to a brief.
  const role = req.user?.role;
  if (!Object.hasOwn(BRIEFS, role)) return err(res, 403, 'FORBIDDEN', 'Insufficient role');

  // Read per request: a missing key (or a custom base with no model) must not
  // stop the API booting (see ADR-023) and must fail before any provider call.
  const cfg = resolveConfig();
  if (!cfg.key || !cfg.model) return err(res, 503, 'AI_NOT_CONFIGURED', 'AI help is not configured.');

  const messages = validate(req.body);
  if (!messages) return err(res, 400, 'BAD_REQUEST', 'Invalid messages payload');

  const result = await callChat({
    messages: [{ role: 'system', content: BRIEFS[role] }, ...messages],
    timeoutMs: 10_000,
  });

  // Non-OK response or empty reply: uniform 502 with no provider detail leaked.
  if (result.kind !== 'OK' || !result.reply.trim()) {
    return err(res, 502, 'UPSTREAM_ERROR', 'AI help is unavailable right now.');
  }
  res.json({ reply: result.reply });
}));

export default router;
