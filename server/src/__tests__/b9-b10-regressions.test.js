import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';

const ADMIN = '44444444-4444-4444-4444-444444444444';
const SEEKER = '11111111-1111-1111-1111-111111111111';

// admin.js starts a 24h retention timer at import; skip it in tests.
process.env.RETENTION_DISABLE = '1';
const { runRetentionPurge } = await import('../routes/admin.js');

const app = makeApp();
beforeEach(() => { reset(); resetAuth(); });

// B9 — the CSV export wrapped every cell in quotes but never doubled embedded
// quotes, so a company name like `SA "Best" Co` produced `"SA "Best" Co"` — a
// malformed row that shifts every column after it in Excel/Sheets.
describe('B9 — CSV export escapes cells per RFC 4180', () => {
  const stubVacancies = (rows) => on(/from job_vacancies j left join employers/, () => ({ rows }));

  it('doubles embedded quotes instead of breaking the row', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    stubVacancies([{ title: 'SA "Best" Co', employers: { company_name: 'Acme' }, location: 'Manila', status: 'published', employment_type: 'Full-time', created_at: '2026-01-01' }]);
    const res = await request(app).get('/api/admin/reports/vacancies/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('"SA ""Best"" Co"');
    expect(res.text).not.toContain('"SA "Best" Co"');
  });

  it('keeps an embedded comma inside the quoted cell', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    stubVacancies([{ title: 'Dev', employers: { company_name: 'Acme, Inc.' }, location: 'Manila', status: 'published', employment_type: 'Full-time', created_at: '2026-01-01' }]);
    const res = await request(app).get('/api/admin/reports/vacancies/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('"Acme, Inc."');
  });

  it('keeps an embedded newline inside the quoted cell', async () => {
    const token = loginAs({ id: ADMIN, role: 'super-admin' });
    stubVacancies([{ title: 'Line one\nLine two', employers: { company_name: 'Acme' }, location: 'Manila', status: 'published', employment_type: 'Full-time', created_at: '2026-01-01' }]);
    const res = await request(app).get('/api/admin/reports/vacancies/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('"Line one\nLine two"');
  });

  it('403 FORBIDDEN for a non-admin caller', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).get('/api/admin/reports/vacancies/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// B10 — the retention purge computed the 12-month cutoff with JS setMonth,
// which overflows short months (Jan 31 - 12mo lands in early March) and
// deleted applications inside the Terms §4 window on those dates. The cutoff
// is now Postgres interval arithmetic — no JS timestamp to drift.
describe('B10 — retention purge cutoff comes from Postgres interval arithmetic', () => {
  it('bounds the delete with now() - make_interval(months => $1)', async () => {
    on(/delete from job_applications/, () => ({ rowCount: 7 }));
    expect(await runRetentionPurge()).toBe(7);
    const call = callsOf(/delete from job_applications/)[0];
    expect(call.sql).toContain('applied_at < now() - make_interval(months => $1)');
    expect(call.params).toEqual([12]); // RETENTION_MONTHS, parameterized — never a JS date
    expect(call.sql).not.toContain('applied_at < $1');
  });
});
