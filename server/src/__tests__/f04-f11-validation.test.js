import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

// upload.js resolves UPLOAD_DIR at import time — point it at a scratch dir
// before anything imports it, so this suite never writes into server/uploads/.
const TMP_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'joblinked-validation-'));
process.env.UPLOAD_DIR = TMP_UPLOAD_DIR;
process.env.RETENTION_DISABLE = '1';

const { on, reset, callsOf } = await import('./helpers/db.js');
const { loginAs, resetAuth } = await import('./helpers/auth.js');
const { makeApp } = await import('./helpers/app.js');
const { uploadDir } = await import('../upload.js');
const { DOC_TYPES } = await import('../routes/profiles.js');
const { DOC_TYPES: UI_DOC_TYPES } = await import('../../../src/shared/constants.js');

const app = makeApp();
const EMPLOYER = '22222222-2222-4222-8222-222222222222';
const E2 = '22222222-2222-4222-8222-222222222223';
const E3 = '22222222-2222-4222-8222-222222222224';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pdf = () => Buffer.from('%PDF-1.4\n');

const filesIn = (userId) => {
  const dir = path.join(uploadDir, 'documents', userId);
  return fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }) : [];
};
const requireJobLoad = () => on((sql) => /where j\.id = \$1/.test(sql), () => ({
  rows: [{ id: JOB, title: 'Dev', status: 'published', company_id: EMPLOYER, company_name: 'Acme', logo_path: null, tags: [], salary_min: 10000, salary_max: 20000 }],
}));

beforeEach(() => { reset(); resetAuth(); });
afterAll(() => { fs.rmSync(TMP_UPLOAD_DIR, { recursive: true, force: true }); });

// F-04: doc_type was free text and reached the admin UI and the notification
// message. Both upload paths now reject anything outside the employer screen's
// nine documents and unlink the file multer already wrote.
describe('F-04 — doc_type allow-list', () => {
  it('matches the document types the accreditation screen offers', () => {
    expect([...DOC_TYPES].sort()).toEqual([...UI_DOC_TYPES].sort());
  });

  it('POST /api/documents rejects a garbage doc_type with 400 and no orphan', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('doc_type', '<script>alert(1)</script>')
      .attach('file', pdf(), { filename: 'permit.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(filesIn(EMPLOYER)).toHaveLength(0);
    expect(callsOf(/insert into employer_documents/)).toHaveLength(0);
  });

  it('POST /api/files/documents rejects a garbage doc_type with 400 and no orphan', async () => {
    const token = loginAs({ id: E2, role: 'employer' });
    const res = await request(app).post('/api/files/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('doc_type', 'Not A Real Document')
      .attach('file', pdf(), { filename: 'permit.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(filesIn(E2)).toHaveLength(0);
    expect(callsOf(/insert into employer_documents/)).toHaveLength(0);
  });

  it('still accepts a catalogue doc_type on /files/documents', async () => {
    const token = loginAs({ id: E3, role: 'employer' });
    on(/insert into employer_documents/, () => ({ rows: [{ id: 'doc-1', doc_type: 'Business Permit' }] }));
    const res = await request(app).post('/api/files/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('doc_type', 'Business Permit')
      .attach('file', pdf(), { filename: 'permit.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.document.doc_type).toBe('Business Permit');
    expect(filesIn(E3)).toHaveLength(1);
  });
});

// F-11: salary_min/salary_max reached a numeric column uncoerced, so "abc"
// became a Postgres 22P02 -> generic 500 instead of the contract's 400.
describe('F-11 — salary fields must be numeric', () => {
  it('POST /api/jobs rejects a non-numeric salary_min with 400, no insert', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', salary_min: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/insert into job_vacancies/)).toHaveLength(0);
  });

  it('POST /api/jobs rejects a non-numeric salary_max with 400', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    const res = await request(app).post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Dev', salary_min: 100, salary_max: 'lots' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('PATCH /api/jobs/:id rejects a non-numeric salary_min with 400, no update', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad();
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ salary_min: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/update job_vacancies set/)).toHaveLength(0);
  });

  it('PATCH /api/jobs/:id still accepts a numeric salary string', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    requireJobLoad();
    const res = await request(app).patch(`/api/jobs/${JOB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ salary_min: '15000' });
    expect(res.status).toBe(200);
    expect(callsOf(/update job_vacancies set/)[0].params).toContain('15000');
  });
});
