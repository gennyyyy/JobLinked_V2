// T2 (RA 10173 access right): GET /api/account/export — the caller's own data
// as a JSON download. Contract:
// docs/arch/specs/2026-11-26-account-compliance-api.md §2.
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { err } from '../util.js';

const mocks = vi.hoisted(() => ({
  state: { unauthorized: false },
  poolQuery: vi.fn(),
  resolveRole: vi.fn(),
}));

vi.mock('../db.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../auth.js', () => ({
  tokenAuth: (req, res, next) => {
    if (mocks.state.unauthorized) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
    req.user = { id: 'user-1', email: 'u@x.com' };
    next();
  },
  resolveRole: mocks.resolveRole,
}));
// Nothing on the export path touches the disk; the import just needs to resolve.
vi.mock('../upload.js', () => ({ uploadDir: '/uploads' }));

const { default: accountRoutes } = await import('./account.js');

const app = express();
app.use(express.json());
app.use('/api', accountRoutes);
app.use('/api', (_req, res) => err(res, 404, 'NOT_FOUND', 'Route not found'));
// eslint-disable-next-line no-unused-vars
app.use((e, _req, res, _next) => err(res, 500, 'INTERNAL', 'Something went wrong'));

const getExport = () => request(app).get('/api/account/export').set('Authorization', 'Bearer t');

// Canned rows per statement pattern (an unregistered query gets []).
const on = (match, rows) => mocks.state.rules.push({ match, rows });
const queries = () => mocks.poolQuery.mock.calls.map(([sql, params]) => ({ sql: String(sql), params }));

beforeEach(() => {
  mocks.state.rules = [];
  mocks.state.unauthorized = false;
  mocks.poolQuery.mockReset().mockImplementation(async (sql) => {
    const text = String(sql);
    const rule = mocks.state.rules.find((r) => r.match.test(text));
    return { rows: rule ? rule.rows : [], rowCount: rule ? rule.rows.length : 0 };
  });
  mocks.resolveRole.mockReset();
});

const SEEKER_PROFILE = {
  id: 'user-1', first_name: 'Ana', last_name: 'Cruz', email: 'ana@example.com',
  terms_accepted_at: '2026-11-20T02:11:00.000Z', terms_version: '2026-11-01T00:00:00.000Z',
  status: 'active',
};
const EMPLOYER_PROFILE = {
  id: 'user-1', company_name: 'Acme Store', email: 'hr@acme.example',
  terms_accepted_at: '2026-11-20T02:11:00.000Z', terms_version: '2026-11-01T00:00:00.000Z',
  accreditation_remarks: 'internal PESO note', status: 'active',
};

describe('GET /api/account/export — job seeker', () => {
  it('returns the seeker envelope with applications, status history and resumes', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: SEEKER_PROFILE });
    on(/from notifications/, [{ type: 'application', title: 'Shortlisted', message: 'You were shortlisted', created_at: '2026-11-22T00:00:00.000Z' }]);
    on(/from job_applications a/, [{
      id: 'app-1', job_title: 'Sales Associate', company_name: 'Acme Store', status: 'Interview',
      applied_at: '2026-11-21T00:00:00.000Z', interview_at: null,
      employer_notes: null, interview_instructions: null,
      status_history: [{ status: 'Applied', remarks: null, changed_at: '2026-11-21T00:00:00.000Z' }],
    }]);
    on(/from resumes/, [{ file_name: 'cv.pdf', uploaded_at: '2026-11-20T00:00:00.000Z' }]);

    const r = await getExport();
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toBe('attachment; filename="joblinked-export.json"');
    expect(r.body.role).toBe('job-seeker');
    expect(r.body.profile).toEqual(SEEKER_PROFILE);
    expect(new Date(r.body.exported_at).toISOString()).toBe(r.body.exported_at);
    expect(r.body.consents).toEqual({
      terms_accepted_at: '2026-11-20T02:11:00.000Z',
      terms_version: '2026-11-01T00:00:00.000Z',
    });
    expect(r.body.applications).toEqual([{
      id: 'app-1', job_title: 'Sales Associate', company_name: 'Acme Store', status: 'Interview',
      applied_at: '2026-11-21T00:00:00.000Z', interview_at: null,
      employer_notes: null, interview_instructions: null,
      status_history: [{ status: 'Applied', remarks: null, changed_at: '2026-11-21T00:00:00.000Z' }],
    }]);
    expect(r.body.notifications).toEqual([
      { type: 'application', title: 'Shortlisted', message: 'You were shortlisted', created_at: '2026-11-22T00:00:00.000Z' },
    ]);
    expect(r.body.documents).toEqual({ resumes: [{ file_name: 'cv.pdf', uploaded_at: '2026-11-20T00:00:00.000Z' }] });
  });

  it("scopes every query to the caller — another user's rows are never read", async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'job-seeker', profile: SEEKER_PROFILE });
    await getExport();

    const appQuery = queries().find((q) => /from job_applications a/.test(q.sql));
    expect(appQuery.sql).toContain('a.seeker_id = $1');
    expect(appQuery.params).toEqual(['user-1']);
    // No query is unfiltered: each carries exactly the caller's id.
    for (const q of queries()) expect(q.params).toEqual(['user-1']);
    // Nothing exportable comes from auth/audit tables.
    for (const q of queries()) {
      expect(q.sql).not.toMatch(/auth\.|password|audit_logs|"session"/);
    }
  });
});

describe('GET /api/account/export — employer', () => {
  it('returns the employer envelope and no applicant data or reviewer UUIDs', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'employer', profile: EMPLOYER_PROFILE });
    on(/from job_vacancies/, [{ title: 'Sales Associate', status: 'published', created_at: '2026-11-21T00:00:00.000Z', deadline: '2026-12-31' }]);
    on(/from employer_accreditations/, [{ status: 'approved', submitted_at: '2026-11-20T00:00:00.000Z', decided_at: '2026-11-21T00:00:00.000Z' }]);
    on(/from employer_documents/, [{ doc_type: 'bir', file_name: '2303.pdf', status: 'verified', uploaded_at: '2026-11-20T00:00:00.000Z' }]);

    const r = await getExport();
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toBe('attachment; filename="joblinked-export.json"');
    expect(r.body.role).toBe('employer');
    // ADR-060: the internal accreditation remarks never leave the app.
    expect(r.body.profile).toEqual({
      id: 'user-1', company_name: 'Acme Store', email: 'hr@acme.example',
      terms_accepted_at: '2026-11-20T02:11:00.000Z', terms_version: '2026-11-01T00:00:00.000Z',
      status: 'active',
    });
    expect(r.body.profile).not.toHaveProperty('accreditation_remarks');
    // Destructured, not mutated: the role row itself is untouched.
    expect(EMPLOYER_PROFILE.accreditation_remarks).toBe('internal PESO note');
    expect(r.body.consents).toEqual({
      terms_accepted_at: '2026-11-20T02:11:00.000Z',
      terms_version: '2026-11-01T00:00:00.000Z',
    });
    expect(r.body.job_vacancies).toEqual([
      { title: 'Sales Associate', status: 'published', created_at: '2026-11-21T00:00:00.000Z', deadline: '2026-12-31' },
    ]);
    expect(r.body.accreditations).toEqual([
      { status: 'approved', submitted_at: '2026-11-20T00:00:00.000Z', decided_at: '2026-11-21T00:00:00.000Z' },
    ]);
    expect(r.body.documents).toEqual({
      accreditation_documents: [
        { doc_type: 'bir', file_name: '2303.pdf', status: 'verified', uploaded_at: '2026-11-20T00:00:00.000Z' },
      ],
    });

    // No applicant envelope, no notifications, and no reviewer/decider ids or
    // internal remarks.
    expect(r.body).not.toHaveProperty('applications');
    expect(r.body).not.toHaveProperty('notifications');
    for (const q of queries()) {
      expect(q.sql).not.toMatch(/job_applications|job_seekers|resumes|notifications|decided_by|reviewed_by|remarks/);
      expect(q.params).toEqual(['user-1']);
    }
    expect(JSON.stringify(r.body)).not.toContain('decided_by');
    expect(JSON.stringify(r.body)).not.toContain('internal PESO note');
  });
});

describe('GET /api/account/export — guards', () => {
  it('401 when the token is missing/invalid', async () => {
    mocks.state.unauthorized = true;
    const r = await getExport();
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('UNAUTHORIZED');
    expect(mocks.resolveRole).not.toHaveBeenCalled();
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND when no role row exists', async () => {
    mocks.resolveRole.mockResolvedValue(null);
    const r = await getExport();
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN for a super-admin (data-subject route)', async () => {
    mocks.resolveRole.mockResolvedValue({ role: 'super-admin', profile: { id: 'user-1', status: 'active' } });
    const r = await getExport();
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });
});
