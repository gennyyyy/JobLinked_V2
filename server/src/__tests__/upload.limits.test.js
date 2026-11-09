import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

// upload.js resolves UPLOAD_DIR at import time — point it at a scratch dir
// BEFORE anything imports it, so this suite never writes into server/uploads/.
const TMP_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'joblinked-upload-'));
process.env.UPLOAD_DIR = TMP_UPLOAD_DIR;
process.env.RETENTION_DISABLE = '1';

const { on, reset } = await import('./helpers/db.js');
const { loginAs, resetAuth } = await import('./helpers/auth.js');
const { makeApp } = await import('./helpers/app.js');
const { uploadDir } = await import('../upload.js');

const app = makeApp();
// One user per case: multer writes uploads/<bucket>/<userId>/, so distinct ids
// keep the file assertions free of cross-test residue.
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const S3 = '33333333-3333-4333-8333-333333333333';
const S4 = '44444444-4444-4444-8444-444444444444';
const S5 = '55555555-5555-4555-8555-555555555555';

const filesIn = (userId) => {
  const dir = path.join(uploadDir, 'resumes', userId);
  return fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }) : [];
};
const stubQuota = () => on(/select count\(\*\)::int n from resumes/, () => ({ rows: [{ n: 0 }] }));

beforeEach(() => { reset(); resetAuth(); });
afterAll(() => { fs.rmSync(TMP_UPLOAD_DIR, { recursive: true, force: true }); });

// Phase 2 (docs/plan/2026-11-04-05-testing-plan.md): upload.js limits and the
// route-level orphan-file compensation, driven through the real multer stack.
describe('POST /api/files/resumes — upload limits and orphan cleanup', () => {
  it('rejects a disallowed extension before writing any file', async () => {
    const token = loginAs({ id: S1, role: 'job-seeker' });
    stubQuota();
    const res = await request(app).post('/api/files/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello'), { filename: 'notes.txt' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Only PDF, DOC, DOCX, PNG, or JPG');
    expect(filesIn(S1)).toHaveLength(0);
  });

  it('rejects a PDF larger than 2 MB and unlinks the written file', async () => {
    const token = loginAs({ id: S2, role: 'job-seeker' });
    stubQuota();
    const bigPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2 * 1024 * 1024 + 16)]);
    const res = await request(app).post('/api/files/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', bigPdf, { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('2 MB or smaller');
    expect(filesIn(S2)).toHaveLength(0);
  });

  it('rejects an oversized file through the multer 5 MB cap', async () => {
    const token = loginAs({ id: S3, role: 'job-seeker' });
    stubQuota();
    const huge = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024)]);
    const res = await request(app).post('/api/files/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', huge, { filename: 'huge.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/too large/i);
  });

  it('unlinks the uploaded file when the DB insert fails (orphan compensation)', async () => {
    const token = loginAs({ id: S4, role: 'job-seeker' });
    stubQuota();
    on(/insert into resumes/, () => { const e = new Error('duplicate key value violates unique constraint "resumes_one_active_uidx"'); e.code = '23505'; throw e; });
    const res = await request(app).post('/api/files/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4\n'), { filename: 'ok.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(500);
    expect(filesIn(S4)).toHaveLength(0);
  });

  it('keeps the file on the happy path (compensation is failure-only)', async () => {
    const token = loginAs({ id: S5, role: 'job-seeker' });
    stubQuota();
    on(/insert into resumes/, () => ({ rows: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', file_name: 'ok.pdf', file_path: 'x', is_active: true }] }));
    const res = await request(app).post('/api/files/resumes')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4\n'), { filename: 'ok.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    const files = filesIn(S5);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/ok\.pdf$/);
  });
});
