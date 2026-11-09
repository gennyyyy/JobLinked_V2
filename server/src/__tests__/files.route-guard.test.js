import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { reset } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';
import { uploadDir } from '../upload.js';

const ADMIN = '44444444-4444-4444-4444-444444444444';
const SEEKER = '11111111-1111-1111-1111-111111111111';

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

// Phase 2 (docs/plan/2026-11-04-05-testing-plan.md): direct behavioral
// coverage of the traversal guard at profiles.js:402-409 — the old suites only
// read the source text.
describe('GET /api/files/:bucket/* — traversal guard', () => {
  // server/package.json sits above the bucket root: a working traversal read
  // would return it. Nothing else in the repo layout has a better smell test.
  const leakTarget = path.join(uploadDir, '..', 'package.json');

  it('sanity: the traversal target exists, so a 4xx really means the guard blocked', () => {
    expect(fs.existsSync(leakTarget)).toBe(true);
    expect(fs.readFileSync(leakTarget, 'utf8')).toContain('joblinked-api');
  });

  it('rejects encoded ..%2F traversal with 400 and never serves the file', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/files/resumes/..%2F..%2Fpackage.json').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid path');
    expect(res.text).not.toContain('joblinked-api');
  });

  it('rejects %2e%2e-encoded traversal for a seeker too (guard runs before ownership)', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).get('/api/files/resumes/%2e%2e%2f%2e%2e%2fpackage.json').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid path');
    expect(res.text).not.toContain('joblinked-api');
  });

  it('never serves outside the bucket for a backslash traversal vector', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/files/resumes/..%5C..%5Cpackage.json').set('Authorization', `Bearer ${token}`);
    // Windows normalises `\` as a separator (400); POSIX treats it as one file
    // name inside the bucket (then 404). Either way nothing outside is served.
    expect([400, 404]).toContain(res.status);
    expect(res.text).not.toContain('joblinked-api');
  });

  it('absolute-looking paths stay inside the bucket (404, never a host file)', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/files/resumes/%2Fserver%2Fpackage.json').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('joblinked-api');
  });

  it('unknown bucket names are 404 before any path math', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    const res = await request(app).get('/api/files/..%2Fresumes/x.pdf').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Unknown bucket');
  });
});
