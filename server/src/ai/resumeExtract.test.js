import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

const realFetch = globalThis.fetch;

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../db.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../logger.js', () => ({ default: mocks.log }));

const { validateExtract } = await import('../ai/resumeExtract.js');
const { default: aiRoutes } = await import('../routes/ai.js');
const { providerCallBudget } = await import('../aiProvider.js');

const KEY = 'sk-test-secret-key-abc123';
const BASE = 'https://provider.test/v1';
const MODEL = 'test/model';
let base;
let server;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', aiRoutes);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  providerCallBudget.reset();
  for (const fn of Object.values(mocks.log)) fn.mockClear();
  mocks.fetch.mockReset();
  vi.stubGlobal('fetch', mocks.fetch);
  process.env.OPENROUTER_API_KEY = KEY;
  process.env.OPENROUTER_MODEL = MODEL;
  process.env.OPENROUTER_BASE_URL = BASE;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validateExtract', () => {
  it('keeps known scalar fields and drops unknown keys', () => {
    const out = validateExtract({ fields: { firstName: 'Juan', bogus: 'x', lastName: 'Cruz' } });
    expect(out.firstName).toBe('Juan');
    expect(out.lastName).toBe('Cruz');
    expect(out).not.toHaveProperty('bogus');
  });
  it('clamps string lengths and trims', () => {
    const long = 'a'.repeat(200);
    const out = validateExtract({ firstName: `  ${long}  ` });
    expect(out.firstName).toBe('a'.repeat(80));
  });
  it('validates education level against EDU_ORDER', () => {
    const out = validateExtract({ education: { level: 'College', school: 'PUP', field: 'BSIT', year: '2023' } });
    expect(out.education).toEqual({ level: 'College', school: 'PUP', field: 'BSIT', year: '2023' });
    const bad = validateExtract({ education: { level: 'Foo', school: 'PUP', field: 'BSIT', year: '2023' } });
    expect(bad.education.level).toBe('');
  });
  it('caps skills at 20, length 40, 5 words', () => {
    const skills = Array.from({ length: 30 }, (_, i) => `skill ${i}`);
    skills.push('a'.repeat(50));
    skills.push('one two three four five six');
    const out = validateExtract({ skills });
    expect(out.skills.length).toBeLessThanOrEqual(20);
    expect(out.skills.every((s) => s.length <= 40 && s.split(/\s+/).length <= 5)).toBe(true);
    expect(out.skills).not.toContain('a'.repeat(50));
  });
  it('returns blanks for non-object input', () => {
    expect(validateExtract(null).firstName).toBe('');
    expect(validateExtract('{"fields":{"firstName":"X"}}').firstName).toBe('X');
  });
});

describe('POST /api/ai/resume-extract', () => {
  it('400 INVALID_INPUT when text is too short', async () => {
    const res = await realFetch(`${base}/ai/resume-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'short' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_INPUT');
  });
  it('400 INVALID_INPUT when text is not a string', async () => {
    const res = await realFetch(`${base}/ai/resume-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 42 }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_INPUT');
  });
  it('400 INVALID_INPUT when text exceeds 20000 chars', async () => {
    const res = await realFetch(`${base}/ai/resume-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(20001) }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_INPUT');
  });
  it('503 AI_NOT_CONFIGURED when key unset', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await realFetch(`${base}/ai/resume-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(120) }) });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('AI_NOT_CONFIGURED');
    process.env.OPENROUTER_API_KEY = KEY;
  });
  it('502 AI_UPSTREAM when provider returns non-JSON', async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('bad'); } });
    const res = await realFetch(`${base}/ai/resume-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(120) }) });
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('AI_UPSTREAM');
  });
  it('200 with validated fields on happy path', async () => {
    const fields = { firstName: 'Juan', lastName: 'Cruz', skills: ['typing'], education: { level: 'College', school: 'PUP', field: 'BSIT', year: '2023' } };
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ fields }) } }] }) });
    const res = await realFetch(`${base}/ai/resume-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(120) }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fields.firstName).toBe('Juan');
    expect(body.fields.lastName).toBe('Cruz');
    expect(body.fields.skills).toEqual(['typing']);
    expect(body.fields.education.level).toBe('College');
    expect(typeof body.meta.model).toBe('string');
  });
  it('drops unknown keys and clamps on happy path', async () => {
    const fields = { firstName: 'Juan', bogus: 'x', skills: ['typing'], education: { level: 'Foo', school: 'PUP' } };
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ fields }) } }] }) });
    const res = await realFetch(`${base}/ai/resume-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(120) }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fields).not.toHaveProperty('bogus');
    expect(body.fields.education.level).toBe('');
  });
});