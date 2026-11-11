import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Contract test: POST /api/ai/job-match (spec v1.1 §4). Same harness as
// ai.test.js: a real Express app, a mocked db pool, and a stubbed global fetch.
const realFetch = globalThis.fetch;

const mocks = vi.hoisted(() => ({ role: 'job-seeker', userId: 'seeker-1', fetch: vi.fn() }));

vi.mock('../db.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../auth.js', () => ({
  auth: (req, res, next) => {
    if (!mocks.role) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing access token' } });
    }
    req.user = { id: mocks.userId, email: 'seeker-secret@example.com', role: mocks.role };
    next();
  },
  requireRole: (...roles) => (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } }),
}));

const { default: aiMatchRoutes } = await import('./aiMatch.js');
const { pool } = await import('../db.js');
const { _reset } = await import('../matching/matchCache.js');
const { rankPool } = await import('../matching/score.js');
// Same shared provider module the route calls through: its 20-calls/60s budget
// is process-wide, so every suite that can reach the provider resets it.
const { providerCallBudget } = await import('../aiProvider.js');

const KEY = 'sk-test-secret-key-abc123';
let base;
let server;
let seq = 0;
let profileRows;
let jobRows;

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const job = (n, overrides = {}) => ({
  id: uuid(n),
  title: `Welder ${n}`,
  company_name: 'Acme Welding',
  location: 'Poblacion',
  employment_type: 'Full-time',
  salary_min: '15000',
  salary_max: '20000',
  tags: ['welding'],
  description: `TIG welding and fabrication for job ${n}`,
  created_at: new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString(),
  logo_path: null,
  ...overrides,
});

const defaultProfile = () => [{
  skills: ['welding', 'fabrication'],
  barangay_district: 'Poblacion',
  preferred_position: 'Welder',
}];

const configureProvider = () => {
  process.env.OPENROUTER_API_KEY = KEY;
  process.env.OPENROUTER_MODEL = 'test/model';
  process.env.OPENROUTER_BASE_URL = 'https://provider.test/v1';
};

const okReply = (content) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
const fenced = (entries) => okReply(`\`\`\`json\n${JSON.stringify(entries)}\n\`\`\``);

const requestBody = (prompt = 'welder in poblacion', jobs = jobRows) => ({
  prompt,
  candidateIds: jobs.map((row) => row.id),
});

// jobMatchLimiter's draft-7 header: `limit=30, remaining=29, reset=...`.
const remaining = (response) => {
  const header = response.headers.get('ratelimit');
  return header === null ? null : Number(/remaining=(\d+)/.exec(header)?.[1]);
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', aiMatchRoutes);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  mocks.role = 'job-seeker';
  mocks.userId = `seeker-${++seq}`;
  providerCallBudget.reset();
  mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.OPENROUTER_BASE_URL;
  profileRows = defaultProfile();
  jobRows = [job(1), job(2), job(3)];
  pool.query.mockReset();
  pool.query.mockImplementation(async (sql) => (
    sql.includes('job_seekers') ? { rows: profileRows } : { rows: jobRows }
  ));
  _reset();
});
afterEach(() => vi.unstubAllGlobals());

async function post(body) {
  const r = await realFetch(`${base}/ai/job-match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  expect(text).not.toContain(KEY);
  return { status: r.status, body: text ? JSON.parse(text) : null, headers: r.headers };
}

describe('POST /api/ai/job-match', () => {
  it('requires a provisioned job-seeker', async () => {
    mocks.role = 'employer';
    const employer = await post(requestBody());
    expect(employer.status).toBe(403);
    expect(employer.body.error.code).toBe('FORBIDDEN');

    mocks.role = null;
    const anon = await post(requestBody());
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe('UNAUTHORIZED');

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  const bad = {
    'missing prompt': { candidateIds: [uuid(1)] },
    'non-string prompt': { prompt: 42, candidateIds: [uuid(1)] },
    'whitespace-only prompt': { prompt: ' \n\t ', candidateIds: [uuid(1)] },
    'normalized prompt over 500 chars': { prompt: ` ${'x'.repeat(501)} `, candidateIds: [uuid(1)] },
    'candidateIds not an array': { prompt: 'welder', candidateIds: uuid(1) },
    'more than 200 candidateIds': { prompt: 'welder', candidateIds: Array.from({ length: 201 }, (_, i) => uuid(i + 1)) },
    'non-uuid candidate id': { prompt: 'welder', candidateIds: ['not-a-uuid'] },
  };
  it.each(Object.entries(bad))('400 BAD_REQUEST on %s', async (_name, payload) => {
    const { status, body } = await post(payload);
    expect(status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns the complete deterministic ranking without an API key', async () => {
    const expected = rankPool(jobRows, profileRows[0]);

    const { status, body } = await post(requestBody());

    expect(status).toBe(200);
    expect(body.mode).toBe('deterministic');
    expect(body.ranking).toEqual(expected.order);
    expect(body.ranking).toHaveLength(3);
    expect(body.reasons).toEqual(expected.reasons);
    expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('responds 200 deterministic on upstream 401/403/404', async () => {
    configureProvider();
    const expected = rankPool(jobRows, profileRows[0]);

    for (const status of [401, 403, 404]) {
      mocks.fetch.mockResolvedValueOnce({ ok: false, status });
      const response = await post(requestBody(`welder ${status}`));
      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('deterministic');
      expect(response.body.ranking).toEqual(expected.order);
      expect(response.body.reasons).toEqual(expected.reasons);
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });

  // The provider budget (20 calls / 60s) is process-wide and shared with every
  // other suite that reaches the provider. Spending it here proves the
  // beforeEach reset above works: without it, the specs below would silently
  // flip to a budget failure and answer deterministic instead of ai.
  it('recovers from an exhausted provider budget once the reset runs', async () => {
    configureProvider();
    mocks.fetch.mockResolvedValue(fenced([{ jobId: uuid(1), reason: 'Best fit' }]));

    for (let i = 0; i < 20; i += 1) {
      const { status, body } = await post(requestBody(`welder run ${i}`));
      expect(status).toBe(200);
      expect(body.mode).toBe('ai');
    }
    expect(mocks.fetch).toHaveBeenCalledTimes(20);

    // A spent budget is never an error: the deterministic answer still covers
    // every live candidate.
    const starved = await post(requestBody('welder run starved'));
    expect(starved.status).toBe(200);
    expect(starved.body.mode).toBe('deterministic');
    expect(starved.body.ranking).toEqual(rankPool(jobRows, profileRows[0]).order);
    expect(mocks.fetch).toHaveBeenCalledTimes(20);

    providerCallBudget.reset();
    const recovered = await post(requestBody('welder run recovered'));
    expect(recovered.status).toBe(200);
    expect(recovered.body.mode).toBe('ai');
    expect(mocks.fetch).toHaveBeenCalledTimes(21);
  });

  it('falls back to deterministic on unparseable provider output', async () => {
    configureProvider();
    mocks.fetch.mockResolvedValueOnce(okReply('this is not a json array'));

    const { status, body } = await post(requestBody());

    expect(status).toBe(200);
    expect(body.mode).toBe('deterministic');
    expect(body.ranking).toEqual(rankPool(jobRows, profileRows[0]).order);
  });

  it('skips the provider when a custom base has no model', async () => {
    process.env.OPENROUTER_API_KEY = KEY;
    process.env.OPENROUTER_BASE_URL = 'https://provider.test/v1';

    const { status, body } = await post(requestBody());

    expect(status).toBe(200);
    expect(body.mode).toBe('deterministic');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('sanitizes model output', async () => {
    configureProvider();
    jobRows = Array.from({ length: 40 }, (_, i) => job(i + 1));
    const deterministic = rankPool(jobRows, profileRows[0]);
    const modelIds = deterministic.order.slice(0, 34).reverse();
    const entries = modelIds.map((jobId, i) => ({ jobId, reason: `Reason ${i}` }));
    entries[0] = { jobId: modelIds[0], reason: '  Matches   your welding skills  ' };
    entries[1] = { jobId: modelIds[1], reason: 'a'.repeat(250) };
    entries[2] = { jobId: modelIds[2], reason: 'good\nreason\u0007for you' };
    entries.push({ jobId: modelIds[0], reason: 'duplicate should lose' });
    entries.push({ jobId: uuid(999), reason: 'unknown job' });
    mocks.fetch.mockResolvedValueOnce(fenced(entries));

    const { status, body } = await post(requestBody('welder with the most tools', jobRows));
    const aiOrder = modelIds.slice(0, 30);
    const expected = [...aiOrder, ...deterministic.order.filter((id) => !aiOrder.includes(id))];

    expect(status).toBe(200);
    expect(body.mode).toBe('ai');
    expect(body.ranking).toEqual(expected);
    expect(body.ranking).toHaveLength(40);
    expect(body.reasons).toHaveLength(30);
    expect(body.reasons[0]).toEqual({ jobId: modelIds[0], reason: 'Matches your welding skills' });
    expect(body.reasons[1].reason).toHaveLength(200);
    expect(body.reasons[2].reason).toBe('good reason for you');
    expect(body.reasons.some((r) => r.reason === 'duplicate should lose')).toBe(false);
    expect(body.reasons.some((r) => r.jobId === uuid(999))).toBe(false);
    // Valid but beyond the 30-model cap: appended in deterministic order, no model reason.
    expect(body.reasons.some((r) => r.jobId === modelIds[30])).toBe(false);
    for (const { reason } of body.reasons) {
      expect([...reason].every((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)).toBe(true);
    }
  });

  it('drops candidates that are no longer published', async () => {
    jobRows = [job(2), job(3)];
    const expected = rankPool(jobRows, profileRows[0]);

    const { status, body } = await post({
      prompt: 'welder in poblacion',
      candidateIds: [uuid(1), uuid(2), uuid(3)],
    });

    expect(status).toBe(200);
    expect(body.mode).toBe('deterministic');
    expect(body.ranking).toEqual(expected.order);
    expect(body.ranking).not.toContain(uuid(1));
    expect(body.reasons.some((r) => r.jobId === uuid(1))).toBe(false);
  });

  it('serves a cached pool without re-calling the provider and without counting the limiter', async () => {
    configureProvider();
    mocks.fetch.mockResolvedValue(fenced([
      { jobId: uuid(3), reason: 'Best fit' },
      { jobId: uuid(2), reason: 'Also fits' },
      { jobId: uuid(1), reason: 'Backup' },
    ]));

    const body = requestBody('welder in poblacion');
    const first = await post(body);
    expect(first.status).toBe(200);
    expect(first.body.mode).toBe('ai');
    expect(remaining(first)).toBe(29);

    const second = await post(body);
    expect(second.status).toBe(200);
    expect(second.body.mode).toBe('ai');
    expect(second.body.ranking).toEqual(first.body.ranking);
    expect(second.body.reasons).toEqual(first.body.reasons);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    // A cache hit is skipped by jobMatchLimiter: no headers and no count.
    expect(remaining(second)).toBeNull();

    // A different prompt is a new miss, so the budget moved by exactly one.
    const third = await post(requestBody('welder in poblacion please'));
    expect(third.status).toBe(200);
    expect(remaining(third)).toBe(28);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it('single-flights identical cache-miss requests', async () => {
    configureProvider();
    mocks.fetch.mockImplementation(() => new Promise((resolve) => {
      resolve(fenced([{ jobId: uuid(3), reason: 'Best fit' }]));
    }));

    const body = requestBody('welder in poblacion');
    const [a, b] = await Promise.all([post(body), post(body)]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.mode).toBe('ai');
    expect(a.body.ranking).toEqual(b.body.ranking);
    expect(a.body.reasons).toEqual(b.body.reasons);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('upstream body carries only public job fields', async () => {
    configureProvider();
    profileRows = [{
      skills: ['confidential-skill'],
      barangay_district: 'Poblacion',
      preferred_position: 'Welder',
      full_name: 'Maria Secret',
      email: 'profile-secret@example.com',
    }];
    jobRows = [job(1, {
      title: 'Class A Welder',
      company_name: 'Acme Welding',
      location: 'Poblacion',
      description: `${'x'.repeat(300)}TAIL-MARKER`,
    })];
    mocks.fetch.mockResolvedValueOnce(fenced([{ jobId: uuid(1), reason: 'Fits' }]));

    const { status } = await post(requestBody('welder near poblacion'));
    expect(status).toBe(200);

    const [, init] = mocks.fetch.mock.calls[0];
    const serialized = init.body;
    expect(serialized).toContain('Class A Welder');
    expect(serialized).toContain('Acme Welding');
    expect(serialized).toContain('Poblacion');
    // PII lint: neither the auth principal nor the profile row may travel.
    expect(serialized).not.toContain('seeker-secret@example.com');
    expect(serialized).not.toContain('profile-secret@example.com');
    expect(serialized).not.toContain('Maria Secret');
    expect(serialized).not.toContain('confidential-skill');
    // Description excerpt is capped at 300 chars.
    expect(serialized).not.toContain('TAIL-MARKER');

    const payload = JSON.parse(serialized);
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[1]).toEqual({ role: 'user', content: 'welder near poblacion' });
  });

  it('empty profile works', async () => {
    profileRows = [];
    const expected = rankPool(jobRows, {});

    const { status, body } = await post(requestBody());

    expect(status).toBe(200);
    expect(body.mode).toBe('deterministic');
    expect(body.ranking).toEqual(expected.order);
    expect(body.reasons.every((r) => r.reason === 'Ranked by posting date')).toBe(true);
  });
});
