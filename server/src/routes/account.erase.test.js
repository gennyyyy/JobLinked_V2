// T1 (RA 10173 / ADR-060): DELETE /api/account — anonymise EVERY role row in
// place, destroy credentials and files, keep placement records. Contract:
// docs/arch/specs/2026-11-26-account-compliance-api.md.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { err } from '../util.js';

const mocks = vi.hoisted(() => ({
  state: { authDeleted: false, userId: 'user-1', owned: { seeker: true, employer: false } },
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  connect: vi.fn(),
  resolveRole: vi.fn(),
  clearTokenCache: vi.fn(),
}));

vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery, connect: mocks.connect } }));
vi.mock('../auth.js', () => ({
  // A real token dies with the auth user: after erasure the next call is 401.
  tokenAuth: (req, res, next) => {
    if (mocks.state.authDeleted) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
    req.user = { id: mocks.state.userId, email: 'u@x.com' };
    next();
  },
  resolveRole: mocks.resolveRole,
}));
vi.mock('../upload.js', () => ({ uploadDir: '/uploads' }));
vi.mock('../tokenCache.js', () => ({ clearTokenCache: mocks.clearTokenCache }));

process.env.SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

const { default: accountRoutes } = await import('./account.js');

// The legacy GoTrue admin logout is an outbound call; never hit the network.
const upstream = vi.fn();
vi.stubGlobal('fetch', upstream);

const app = express();
app.use(express.json());
app.use('/api', accountRoutes);
app.use('/api', (_req, res) => err(res, 404, 'NOT_FOUND', 'Route not found'));
// eslint-disable-next-line no-unused-vars
app.use((e, _req, res, _next) => err(res, 500, 'INTERNAL', 'Something went wrong'));

const del = (body) => request(app).delete('/api/account').set('Authorization', 'Bearer t').send(body ?? {});

// Canned rows for the fake transaction client, matched by statement pattern.
let rules = [];
const on = (match, rows) => rules.push({ match, rows });
const statements = () => mocks.clientQuery.mock.calls.map(([sql, params]) => ({ sql: String(sql), params }));
const txOf = (re) => statements().filter((c) => re.test(c.sql));
let unlink;

beforeEach(() => {
  rules = [];
  mocks.state.authDeleted = false;
  mocks.state.userId = 'user-1';
  mocks.state.owned = { seeker: true, employer: false };
  mocks.poolQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
  mocks.connect.mockReset().mockImplementation(async () => ({ query: mocks.clientQuery, release: vi.fn() }));
  mocks.clientQuery.mockReset().mockImplementation(async (sql) => {
    const text = String(sql);
    if (/delete from auth\."user"/.test(text)) mocks.state.authDeleted = true;
    const rule = rules.find((r) => r.match.test(text));
    if (rule) return { rows: rule.rows, rowCount: rule.rows.length };
    // Which role rows exist for the id (ADR-060 looks at the tables directly).
    if (/exists \(select 1 from public\.job_seekers/.test(text)) {
      return { rows: [{ seeker: mocks.state.owned.seeker, employer: mocks.state.owned.employer }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  mocks.resolveRole.mockReset();
  mocks.clearTokenCache.mockReset();
  upstream.mockReset().mockResolvedValue({ ok: true, status: 200, body: { cancel: vi.fn() } });
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  unlink = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
});

afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => { vi.unstubAllGlobals(); });

describe('DELETE /api/account — guards', () => {
  it('400 CONFIRM_REQUIRED when confirm is missing', async () => {
    const r = await del({});
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('CONFIRM_REQUIRED');
    expect(mocks.resolveRole).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('400 CONFIRM_REQUIRED when confirm is wrong', async () => {
    const r = await del({ confirm: 'DELETE' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('CONFIRM_REQUIRED');
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN for super-admin, with no transaction started', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'super-admin', profile: { id: 'user-1', status: 'active' } });
    const r = await del({ confirm: 'ERASE' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND when no role row exists', async () => {
    mocks.resolveRole.mockResolvedValue(null);
    const r = await del({ confirm: 'ERASE' });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/account — job seeker', () => {
  const asSeeker = () => mocks.resolveRole.mockResolvedValue({
    role: 'job-seeker', profile: { id: 'user-1', status: 'active' },
  });

  it('scrubs the row, unlinks the resume, retains applications, audits in-transaction', async () => {
    asSeeker();
    on(/select file_path from resumes/, [{ file_path: 'resumes/user-1/cv.pdf' }]);

    const r = await del({ confirm: 'ERASE' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ erased: true, role: 'job-seeker' });

    expect(txOf(/^begin/)).toHaveLength(1);
    expect(txOf(/^commit/)).toHaveLength(1);
    expect(txOf(/^rollback/)).toHaveLength(0);

    const scrub = txOf(/update public\.job_seekers set/);
    expect(scrub).toHaveLength(1);
    expect(scrub[0].params).toEqual(['user-1', 'erased+user-1@invalid.local']);
    for (const frag of [
      "first_name = ''", "last_name = ''", 'email = $2',
      'phone = null', 'birthdate = null', 'lot = null', 'postal_code = null',
      'headline = null', 'education_summary = null', 'experience_summary = null',
      "skills = '{}'", "status = 'inactive'",
    ]) expect(scrub[0].sql).toContain(frag);
    expect(scrub[0].sql).not.toMatch(/country\s*=/); // country stays 'Philippines'

    expect(txOf(/delete from public\.education/)).toHaveLength(1);
    expect(txOf(/delete from public\.work_experience/)).toHaveLength(1);
    expect(txOf(/delete from public\.resumes/)).toHaveLength(1);
    expect(txOf(/delete from public\.profile_images/)).toHaveLength(1);

    // Placement records stay; only the free text and the file reference go.
    expect(txOf(/delete from public\.job_applications/)).toHaveLength(0);
    expect(txOf(/delete from public\.employment_history/)).toHaveLength(0);
    const apps = txOf(/update public\.job_applications/);
    expect(apps).toHaveLength(1);
    for (const frag of ['employer_notes = null', 'interview_instructions = null', 'interview_at = null', 'resume_id = null']) {
      expect(apps[0].sql).toContain(frag);
    }
    expect(txOf(/update public\.application_status_history h set remarks = null/)).toHaveLength(1);

    expect(unlink).toHaveBeenCalledWith(path.join('/uploads', 'resumes/user-1/cv.pdf'));

    expect(txOf(/delete from public\.pending_signups/)).toHaveLength(1);
    expect(txOf(/delete from public\.notifications/)).toHaveLength(1);
    expect(txOf(/delete from public\.user_preferences/)).toHaveLength(1);

    // Outstanding reset/verify tokens die with the account.
    const verifications = txOf(/delete from auth\."verification" where identifier = \$1/);
    expect(verifications).toHaveLength(1);
    expect(verifications[0].params).toEqual(['u@x.com']);

    // ADR-060: the audit marker is written on the transaction client — it
    // commits or rolls back with the scrub, never through the pool helper.
    const audit = txOf(/insert into audit_logs/);
    expect(audit).toHaveLength(1);
    expect(audit[0].params).toEqual(['user-1', 'account.erase', 'job_seekers', 'user-1', null]);
    expect(mocks.poolQuery.mock.calls.some(([sql]) => /insert into audit_logs/.test(String(sql)))).toBe(false);

    // The auth user goes last INSIDE the transaction (commit follows it).
    const all = statements();
    expect(all[all.length - 2].sql).toMatch(/delete from auth\."user" where id = \$1/);
    expect(all[all.length - 2].params).toEqual(['user-1']);
    expect(all[all.length - 1].sql).toMatch(/^commit/);

    // Dual window: the legacy logout runs and the cached principal is dropped.
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(String(upstream.mock.calls[0][0])).toBe('https://supa.test/auth/v1/admin/users/user-1/logout');
    expect(mocks.clearTokenCache).toHaveBeenCalledTimes(1);
  });

  it('logs a failed unlink and still completes the erasure', async () => {
    asSeeker();
    on(/select file_path from resumes/, [{ file_path: 'resumes/user-1/cv.pdf' }]);
    unlink.mockImplementation(() => { throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' }); });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const r = await del({ confirm: 'ERASE' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ erased: true, role: 'job-seeker' });
    expect(logged.mock.calls.flat().join(' ')).toContain('erasure_file_unlink_failed');
    expect(txOf(/^commit/)).toHaveLength(1);
  });

  it('two different seekers erase to distinct sentinel emails (no unique violation)', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: { id: 'user-1', status: 'active' } });
    expect((await del({ confirm: 'ERASE' })).status).toBe(200);

    // A different seeker arrives with a live token; the first auth user is gone.
    mocks.state.authDeleted = false;
    mocks.state.userId = 'user-2';
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: { id: 'user-2', status: 'active' } });
    expect((await del({ confirm: 'ERASE' })).status).toBe(200);

    const scrubs = txOf(/update public\.job_seekers set/);
    expect(scrubs).toHaveLength(2);
    expect(scrubs.map((c) => c.params[1])).toEqual([
      'erased+user-1@invalid.local',
      'erased+user-2@invalid.local',
    ]);
    expect(new Set(scrubs.map((c) => c.params[1])).size).toBe(2);
  });
});

describe('DELETE /api/account — employer', () => {
  const asEmployer = () => {
    mocks.state.owned = { seeker: false, employer: true };
    mocks.resolveRole.mockResolvedValue({ role: 'employer', profile: { id: 'user-1', status: 'active' } });
  };

  it('scrubs the company, clears vacancy text, rewrites employment_history, keeps accreditations', async () => {
    asEmployer();
    on(/select file_path from public\.employer_documents/, [{ file_path: 'documents/user-1/permit.pdf' }]);

    const r = await del({ confirm: 'ERASE' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ erased: true, role: 'employer' });

    const scrub = txOf(/update public\.employers set/);
    expect(scrub).toHaveLength(1);
    expect(scrub[0].params).toEqual(['user-1', 'erased+user-1@invalid.local']);
    for (const frag of [
      "company_name = ''", 'email = $2', "first_name = ''", 'phone = null',
      'company_email = null', 'industry = null', 'barangay_district = null',
      'representative_email = null', 'website = null', 'description = null',
      'logo_path = null', 'accreditation_status = null', 'accreditation_remarks = null',
      "status = 'inactive'",
    ]) expect(scrub[0].sql).toContain(frag);
    expect(scrub[0].sql).not.toMatch(/country\s*=/);

    // ADR-060: the posting body can re-identify the company, so it is cleared,
    // not merely archived — every vacancy, archived ones included.
    const vacancies = txOf(/update public\.job_vacancies set/);
    expect(vacancies).toHaveLength(1);
    for (const frag of [
      "title = 'Archived vacancy'", 'description = null', 'requirements = null', 'benefits = null',
      'instructions = null', 'remarks = null', 'office = null', 'location = null', 'field = null',
      "tags = '{}'", "skills = '{}'", "status = 'archived'", 'archived_at = now()',
    ]) expect(vacancies[0].sql).toContain(frag);
    expect(vacancies[0].sql).not.toContain("status <> 'archived'");
    expect(vacancies[0].params).toEqual(['user-1']);

    // History remarks and prohibited-flag terms came from the posting text.
    expect(txOf(/update public\.job_status_history h set remarks = null/)).toHaveLength(1);
    expect(txOf(/delete from public\.job_prohibited_flags/)).toHaveLength(1);

    const rewrite = txOf(/update public\.employment_history/);
    expect(rewrite).toHaveLength(1);
    expect(rewrite[0].sql).toContain("employer_name = 'Employer (erased)'");
    expect(rewrite[0].sql).toContain('company_id = $1'); // reached via job_applications → job_vacancies
    expect(rewrite[0].params).toEqual(['user-1']);

    // Accreditations survive as verification history with remarks nulled; the
    // remarks update must precede the scrub because the sync trigger copies
    // them back onto employers.
    const all = statements();
    const acc = all.filter((c) => /update public\.employer_accreditations set remarks = null/.test(c.sql));
    const empScrub = all.filter((c) => /update public\.employers set/.test(c.sql));
    expect(acc).toHaveLength(1);
    expect(all.indexOf(acc[0])).toBeLessThan(all.indexOf(empScrub[0]));
    expect(txOf(/delete from public\.employer_accreditations/)).toHaveLength(0);

    expect(txOf(/delete from public\.employer_documents\b/)).toHaveLength(1);
    expect(txOf(/delete from public\.employer_document_petitions/)).toHaveLength(1);
    expect(unlink).toHaveBeenCalledWith(path.join('/uploads', 'documents/user-1/permit.pdf'));

    // Other users' records survive untouched.
    expect(txOf(/delete from public\.job_applications/)).toHaveLength(0);
    expect(txOf(/delete from public\.job_vacancies/)).toHaveLength(0);
    expect(txOf(/delete from public\.employers/)).toHaveLength(0);

    expect(all[all.length - 2].sql).toMatch(/delete from auth\."user" where id = \$1/);
    expect(all[all.length - 1].sql).toMatch(/^commit/);

    const audit = txOf(/insert into audit_logs/);
    expect(audit).toHaveLength(1);
    expect(audit[0].params).toEqual(['user-1', 'account.erase', 'employers', 'user-1', null]);
  });

  it('after a role move, scrubs BOTH role rows and audits entity account', async () => {
    // resolveRole ranks the current (employer) row; the stale seeker row is
    // still the user's data and must be scrubbed too.
    mocks.state.owned = { seeker: true, employer: true };
    mocks.resolveRole.mockResolvedValue({ role: 'employer', profile: { id: 'user-1', status: 'active' } });
    on(/select file_path from resumes/, [{ file_path: 'resumes/user-1/cv.pdf' }]);
    on(/select file_path from public\.employer_documents/, [{ file_path: 'documents/user-1/permit.pdf' }]);

    const r = await del({ confirm: 'ERASE' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ erased: true, role: 'employer' });

    const seekerScrub = txOf(/update public\.job_seekers set/);
    const employerScrub = txOf(/update public\.employers set/);
    expect(seekerScrub).toHaveLength(1);
    expect(employerScrub).toHaveLength(1);
    // Same id in both tables: the per-table sentinel stays unique per table.
    expect(seekerScrub[0].params[1]).toBe('erased+user-1@invalid.local');
    expect(employerScrub[0].params[1]).toBe('erased+user-1@invalid.local');

    // Both child trees are scrubbed: seeker education/resumes AND employer docs/jobs.
    expect(txOf(/delete from public\.education/)).toHaveLength(1);
    expect(txOf(/delete from public\.resumes/)).toHaveLength(1);
    expect(txOf(/delete from public\.employer_documents\b/)).toHaveLength(1);
    expect(txOf(/update public\.job_vacancies set/)).toHaveLength(1);
    expect(unlink).toHaveBeenCalledTimes(2);

    expect(txOf(/insert into audit_logs/)[0].params[2]).toBe('account');
  });
});

describe('DELETE /api/account — after erasure', () => {
  it('a second call is unauthenticated (401) and starts no transaction', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: { id: 'user-1', status: 'active' } });

    const first = await del({ confirm: 'ERASE' });
    expect(first.status).toBe(200);

    const before = mocks.clientQuery.mock.calls.length;
    const second = await del({ confirm: 'ERASE' });
    expect(second.status).toBe(401);
    expect(second.body.error.code).toBe('UNAUTHORIZED');
    expect(mocks.clientQuery.mock.calls.length).toBe(before);
    expect(mocks.resolveRole).toHaveBeenCalledTimes(1);
  });
});
