import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => { const h = await import('./helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('./helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { reset, on } from './helpers/db.js';
import { loginAs, resetAuth } from './helpers/auth.js';
import { makeApp } from './helpers/app.js';
import { seedRoleTable } from './helpers/db.js';

describe('staff permission gate (Task 3)', () => {
  beforeEach(() => { reset(); resetAuth(); });

  it('super-admin without custom role passes admin/jobs', async () => {
    const token = loginAs({ id: 'sa-plain', role: 'super-admin', status: 'active' });
    on((sql) => /from job_vacancies/i.test(String(sql)) && /count\(\*\)/i.test(String(sql)), async () => ({ rows: [{ c: 0 }], rowCount: 1 }));
    on((sql) => /from job_vacancies/i.test(String(sql)) && !/count\(\*\)/i.test(String(sql)), async () => ({ rows: [], rowCount: 0 }));
    const app = makeApp();
    const r = await request(app).get('/api/admin/jobs').set('Authorization', `Bearer ${token}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  });

  it('super-admin with custom role limited to jobs passes jobs, 403s users', async () => {
    const token = loginAs({ id: 'sa-staff', role: 'super-admin', status: 'active' });
    seedRoleTable('sa-staff', 'super_admins', { id: 'sa-staff', status: 'active', custom_role_id: 7 });
    on((sql) => /reference_data/i.test(String(sql)), async () => ({ rows: [{ perms: ['jobs'] }], rowCount: 1 }));
    on((sql) => /from job_vacancies/i.test(String(sql)) && /count\(\*\)/i.test(String(sql)), async () => ({ rows: [{ c: 0 }], rowCount: 1 }));
    on((sql) => /from job_vacancies/i.test(String(sql)) && !/count\(\*\)/i.test(String(sql)), async () => ({ rows: [], rowCount: 0 }));
    const app = makeApp();
    const ok = await request(app).get('/api/admin/jobs').set('Authorization', `Bearer ${token}`);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const no = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(no.status).toBe(403);
    expect(no.body).toEqual({ error: { code: 'FORBIDDEN', message: 'Missing permission: roles' } });
  });

  it('admin/stats is unpermissioned for any active admin', async () => {
    const token = loginAs({ id: 'sa-stats', role: 'super-admin', status: 'active' });
    seedRoleTable('sa-stats', 'super_admins', { id: 'sa-stats', status: 'active', custom_role_id: 7 });
    on((sql) => /reference_data/i.test(String(sql)), async () => ({ rows: [{ perms: [] }], rowCount: 1 }));
    on((sql) => /from employers\b/i.test(String(sql)) && /accredited/i.test(String(sql)), async () => ({ rows: [{ employers: 0, accredited: 0 }], rowCount: 1 }));
    on((sql) => /from job_vacancies\b/i.test(String(sql)), async () => ({ rows: [{ jobs: 0, pending: 0, approved: 0, closed: 0, expired: 0 }], rowCount: 1 }));
    on((sql) => /from job_applications\b/i.test(String(sql)), async () => ({ rows: [{ applications: 0, accepted: 0, placed: 0 }], rowCount: 1 }));
    on((sql) => /count\(\*\)/i.test(String(sql)), async () => ({ rows: [{ c: 0 }], rowCount: 1 }));
    const app = makeApp();
    const r = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  });
});
