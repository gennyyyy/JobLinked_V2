import { Router } from 'express';
import { auth, requireRole } from '../auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { ah, err } from '../util.js';

// ponytail: one static brief is the whole knowledge base; split into its own module when it outgrows a screen.
const HELP_BRIEF = `You are the in-app help assistant for PESO JobLinked, a job-matching site run by PESO Santa Maria.

You answer "how do I..." questions about the job-seeker side of PESO JobLinked. You can explain:
- Browsing and searching jobs: open Browse Jobs, filter by keyword, location, employment type, salary, and category, then open a posting to see its full details.
- Applying to a job: open a posting and use the Apply button; your profile and active resume go with the application.
- Resumes: upload a resume from your profile. PDF files up to 2 MB and DOC/DOCX files up to 5 MB are accepted. You can replace or delete a resume, and mark one as your active resume, which is the one used when you apply.
- Autofill from resume: when you register, and from the Profile page, you can import details from your resume. The app shows a confirmation prompt and fills in only fields that are still blank.
- Editing your profile: personal information, address, skills, preferred jobs and locations, and employment status are editable on the Profile page.
- Education and experience: add, edit, and remove your education entries and your work experience entries from your profile.
- Employment history: it is synced automatically from hiring activity, so accepted jobs appear there without manual entry.
- My Applications: review every job you applied to and follow each application's status as the employer moves it along.
- Notifications: in-app notifications tell you about application updates and other activity; you can open or delete them.
- Password: change your account password from the account settings on your profile.

Answer only questions about PESO JobLinked and how to use it. You cannot see the user's account, applications, resume, or any personal data, so never claim to look something up in their account. For anything outside the app, tell the user to contact PESO Santa Maria for help.`;

const TIMEOUT_MS = 10_000;

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

router.post('/ai/help', auth, requireRole('job-seeker'), aiLimiter, ah(async (req, res) => {
  // Read per request: a missing key must not stop the API booting (see ADR-023).
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return err(res, 503, 'AI_NOT_CONFIGURED', 'AI help is not configured.');

  const messages = validate(req.body);
  if (!messages) return err(res, 400, 'BAD_REQUEST', 'Invalid messages payload');

  const base = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let reply;
  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL,
        messages: [{ role: 'system', content: HELP_BRIEF }, ...messages],
      }),
      signal: controller.signal,
    });
    if (upstream.ok) {
      const data = await upstream.json().catch(() => null);
      reply = data?.choices?.[0]?.message?.content;
    }
  } catch { /* network, abort, or timeout: fall through to 502 */ } finally {
    clearTimeout(timer);
  }

  // Non-OK response or empty reply: uniform 502 with no provider detail leaked.
  if (typeof reply !== 'string' || reply.trim() === '') {
    return err(res, 502, 'UPSTREAM_ERROR', 'AI help is unavailable right now.');
  }
  res.json({ reply });
}));

export default router;
