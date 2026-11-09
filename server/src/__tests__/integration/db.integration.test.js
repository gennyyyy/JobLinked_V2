import { describe, it, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import { setupIntegrationDb } from './db.bootstrap.js';

// Supabase is the only mocked boundary (token validation, no network). Roles,
// SQL, constraints and triggers all run against real Postgres through the real
// db.js pool.
vi.mock('@supabase/supabase-js', async () => {
  const h = await import('../helpers/auth.js');
  return { createClient: () => ({ auth: h.supabaseAuth }) };
});

const ctx = await setupIntegrationDb();

// Plan gate: runs only under `INTEGRATION_TEST=1` (server `npm run
// test:integration`); a machine without local Postgres skips every case.
const d = it.skipIf(process.env.INTEGRATION_TEST !== '1' || !ctx.ready);
if (process.env.INTEGRATION_TEST === '1' && !ctx.ready) console.warn(`[integration] ${ctx.reason}`);

let pool, makeApp, loginAs, resolveRole, runRetentionPurge;
if (ctx.ready) {
  ({ pool } = await import('../../db.js'));
  ({ makeApp } = await import('../helpers/app.js'));
  ({ loginAs } = await import('../helpers/auth.js'));
  ({ resolveRole } = await import('../../auth.js'));
  ({ runRetentionPurge } = await import('../../routes/admin.js'));
}

const app = ctx.ready ? makeApp() : null;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const addSeeker = (n, email, status = 'active') => pool.query(
  `insert into job_seekers (id, full_name, email, status) values ($1, 'Test Seeker', $2, $3)`,
  [id(n), email, status]);
const addEmployer = (n, company, email, status = 'active') => pool.query(
  `insert into employers (id, company_name, email, status) values ($1, $2, $3, $4)`,
  [id(n), company, email, status]);
const addJob = (n, employerN, title, status, deadline) => pool.query(
  `insert into job_vacancies (id, company_id, title, status, deadline) values ($1, $2, $3, $4, $5)`,
  [id(n), id(employerN), title, status, deadline]);

afterAll(async () => { if (pool) await pool.end(); });

describe('integration slice — real Postgres', () => {
  // Phase 1, law 1 (auth.js:23): find the single winning role row. The mocked
  // pool simulates this ORDER BY; here Postgres evaluates it for real:
  // non-stale first, then active, then table precedence.
  d('resolveRole precedence: stale loses to current, active beats suspended, table order breaks ties', async () => {
    // moved user: employer active + stale job-seeker row (role move) -> employer
    await addEmployer(101, 'Acme', 'moved@it.local');
    await addSeeker(101, 'moved-s@it.local', 'inactive');
    // suspended employer + active seeker -> the active row must win
    await addEmployer(102, 'Paused Co', 'paused@it.local', 'suspended');
    await addSeeker(102, 'paused-s@it.local', 'active');
    // both active -> super-admin outranks employer
    await pool.query(`insert into super_admins (id, full_name, email, status) values ($1, 'Root', $2, 'active')`, [id(103), 'root@it.local']);
    await addEmployer(103, 'Second Co', 'second@it.local');

    await expect(resolveRole(id(101))).resolves.toMatchObject({ role: 'employer', profile: { status: 'active' } });
    await expect(resolveRole(id(102))).resolves.toMatchObject({ role: 'job-seeker', profile: { status: 'active' } });
    await expect(resolveRole(id(103))).resolves.toMatchObject({ role: 'super-admin' });
  });

  // Phase 1, law 2 (applications.js:66): the deadline is enforced inside the
  // INSERT…SELECT — a post-deadline apply must 400, an extended deadline must
  // 201, and the real unique(job_id, seeker_id) must 409 a duplicate.
  d('apply: post-deadline INSERT rejected (400), accepted after extension, duplicate 409', async () => {
    await addEmployer(201, 'Deadline Co', 'deadline-co@it.local');
    await addSeeker(202, 'dana@it.local');
    await addJob(203, 201, 'Seasonal Clerk', 'published', null);
    await pool.query(`update job_vacancies set deadline = current_date - 1 where id = $1`, [id(203)]);
    const token = loginAs({ id: id(202), role: 'job-seeker' });

    const late = await request(app).post('/api/applications').set('Authorization', `Bearer ${token}`).send({ job_id: id(203) });
    expect(late.status).toBe(400);
    expect(late.body.error.message).toMatch(/deadline/i);

    await pool.query(`update job_vacancies set deadline = current_date + 7 where id = $1`, [id(203)]);
    const ok = await request(app).post('/api/applications').set('Authorization', `Bearer ${token}`).send({ job_id: id(203) });
    expect(ok.status).toBe(201);

    const dup = await request(app).post('/api/applications').set('Authorization', `Bearer ${token}`).send({ job_id: id(203) });
    expect(dup.status).toBe(409);
  });

  // Phase 1, law 3 (schema.sql:424): resumes_one_active_uidx partial index.
  d('at most one active resume per seeker (partial unique index)', async () => {
    await addSeeker(301, 'resumes@it.local');
    await pool.query(`insert into resumes (seeker_id, file_path, file_name, is_active) values ($1, 'resumes/a.pdf', 'a.pdf', true)`, [id(301)]);
    await expect(pool.query(
      `insert into resumes (seeker_id, file_path, file_name, is_active) values ($1, 'resumes/b.pdf', 'b.pdf', true)`, [id(301)]))
      .rejects.toMatchObject({ code: '23505' });

    await pool.query(`update resumes set is_active = false where seeker_id = $1`, [id(301)]);
    await pool.query(`insert into resumes (seeker_id, file_path, file_name, is_active) values ($1, 'resumes/b.pdf', 'b.pdf', true)`, [id(301)]);
    const { rows } = await pool.query('select count(*)::int n from resumes where seeker_id = $1', [id(301)]);
    expect(rows[0].n).toBe(2);
  });

  // Phase 1, law 4 (schema.sql:431): one pending accreditation per company —
  // and the status trigger keeps employers.accreditation_status in sync.
  d('one pending accreditation per company; deciding it frees the next', async () => {
    await addEmployer(401, 'Accredited Co', 'acc-co@it.local');
    await pool.query(`insert into employer_accreditations (company_id, status) values ($1, 'pending')`, [id(401)]);
    const after = await pool.query('select accreditation_status from employers where id = $1', [id(401)]);
    expect(after.rows[0].accreditation_status).toBe('pending');

    await expect(pool.query(
      `insert into employer_accreditations (company_id, status) values ($1, 'pending')`, [id(401)]))
      .rejects.toMatchObject({ code: '23505' });

    await pool.query(`update employer_accreditations set status = 'approved', decided_at = now() where company_id = $1 and status = 'pending'`, [id(401)]);
    await pool.query(`insert into employer_accreditations (company_id, status) values ($1, 'pending')`, [id(401)]);
    const all = await pool.query('select count(*)::int n from employer_accreditations where company_id = $1', [id(401)]);
    expect(all.rows[0].n).toBe(2);
  });

  // Phase 1, law 5 (admin.js:144): purge deletes stale non-employment rows and
  // keeps Accepted / Placed / Terminated (lawful employment records) + recent.
  d('retention purge deletes only stale non-employment applications', async () => {
    await addEmployer(501, 'Retention Co', 'retention-co@it.local');
    await addJob(502, 501, 'Clerk', 'closed', null);
    const seekers = [];
    const seedApp = (n, status, age) => {
      seekers.push(n);
      return pool.query(
        `insert into job_applications (job_id, seeker_id, status, applied_at) values ($1, $2, $3, now() - $4::interval)`,
        [id(502), id(n), status, age]);
    };
    await addSeeker(511, 'purged-1@it.local');
    await addSeeker(512, 'purged-2@it.local');
    await addSeeker(513, 'kept-1@it.local');
    await addSeeker(514, 'kept-2@it.local');
    await addSeeker(515, 'kept-3@it.local');
    await addSeeker(516, 'kept-4@it.local');
    await seedApp(511, 'Applied', '13 months');   // stale -> purged
    await seedApp(512, 'Rejected', '13 months');  // stale -> purged
    await seedApp(513, 'Accepted', '400 days');   // retained
    await seedApp(514, 'Placed', '400 days');     // retained
    await seedApp(515, 'Terminated', '400 days'); // retained
    await seedApp(516, 'Applied', '1 month');     // inside the window -> kept

    expect(await runRetentionPurge()).toBe(2);
    const { rows } = await pool.query(
      `select status::text as status from job_applications where seeker_id = any($1::uuid[]) order by seeker_id`,
      [seekers.map(id)]);
    expect(rows.map((r) => r.status)).toEqual(['Accepted', 'Placed', 'Terminated', 'Applied']);
  });

  // Phase 1, law 6 (schema.sql:484, migration 002): unique email per account.
  d('unique-email indexes reject a duplicate role account', async () => {
    await addSeeker(601, 'dup-seeker@it.local');
    await expect(addSeeker(602, 'dup-seeker@it.local'))
      .rejects.toMatchObject({ code: '23505', constraint: 'job_seekers_email_uidx' });

    await addEmployer(603, 'First Co', 'dup-emp@it.local');
    await expect(addEmployer(604, 'Second Co', 'dup-emp@it.local'))
      .rejects.toMatchObject({ code: '23505', constraint: 'employers_email_uidx' });
  });
});
