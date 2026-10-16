import express from 'express';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// ADR-022 removed the accreditation *gate* but kept the posting rule
// ("must be accredited before you can post jobs"), which the client enforced
// alone in handleOpenCreate. A UI check is not enforcement at the trust
// boundary: an employer could POST directly and harvest citizen resumes.
// These tests pin the server-side version of the same rule on every write
// path that can produce a `published` job.
const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  role: 'employer',
  userId: 'emp-1',
  accreditation: null, // employers.accreditation_status for the caller
  job: null,
}));

vi.mock('../db.js', () => ({
  pool: {
    query: mocks.poolQuery,
    connect: async () => ({ query: mocks.clientQuery, release: () => {} }),
  },
}));

vi.mock('../auth.js', () => ({
  auth: (req, _res, next) => { req.user = { id: mocks.userId, email: 'e@x.com', role: mocks.role }; next(); },
  optionalAuth: (_req, _res, next) => next(),
  requireRole: (...roles) => (req, res, next) =>
    (roles.includes(mocks.role) ? next() : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } })),
}));

const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();

const ACCRED_SELECT = 'select accreditation_status from employers where id = $1';

// Real uuid: the load helper now guards the :id format (S1), and the create
// path reloads the job by the id the INSERT returned.
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEW_JOB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const respond = (sql) => {
  const s = norm(sql);
  if (s === ACCRED_SELECT) {
    return { rows: mocks.accreditation === null ? [] : [{ accreditation_status: mocks.accreditation }] };
  }
  if (s.startsWith('select j.*, e.company_name')) return { rows: [mocks.job] };
  return { rows: [] };
};

const respondClient = (sql, params) => {
  const s = norm(sql);
  if (s.startsWith('insert into job_vacancies')) {
    mocks.lastInsert = { sql: s, params };
    return { rows: [{ id: NEW_JOB }] };
  }
  return { rows: [] };
};

mocks.poolQuery.mockImplementation(async (sql) => respond(sql));
mocks.clientQuery.mockImplementation(async (sql, params) => respondClient(sql, params));

const { default: jobRoutes } = await import('./jobs.js');

let base, server;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', jobRoutes);
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => new Promise((r) => server.close(r)));

beforeEach(() => {
  mocks.role = 'employer';
  mocks.userId = 'emp-1';
  mocks.accreditation = null; // no employers row / not approved
  mocks.job = {
    id: JOB, company_id: 'emp-1', title: 'Welder needed', status: 'published',
    remarks: null, company_name: 'Acme', logo_path: null,
  };
  mocks.lastInsert = undefined;
  mocks.poolQuery.mockClear();
  mocks.clientQuery.mockClear();
});

const insertCalls = () => mocks.clientQuery.mock.calls.filter(([sql]) => norm(sql).startsWith('insert into job_vacancies'));
const publishedWrites = () => mocks.clientQuery.mock.calls.filter(([sql]) => /update job_vacancies set status = \$2/.test(norm(sql)));

const post = (path, body) => fetch(`${base}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const patch = (path, body) => fetch(`${base}${path}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /jobs accreditation gate', () => {
  it('403 when a non-approved employer publishes (no status defaults to published)', async () => {
    const r = await post('/jobs', { title: 'Welder needed' });
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.error).toMatchObject({ code: 'FORBIDDEN' });
    expect(body.error.message).toContain('accredited by PESO');
    // Fail before the transaction: nothing was inserted.
    expect(mocks.clientQuery).not.toHaveBeenCalled();
    expect(insertCalls()).toHaveLength(0);
  });

  it('403 when a non-approved employer explicitly asks for published', async () => {
    const r = await post('/jobs', { title: 'Welder needed', status: 'published' });
    expect(r.status).toBe(403);
    expect(mocks.clientQuery).not.toHaveBeenCalled();
  });

  it('201 when a non-approved employer saves a draft', async () => {
    const r = await post('/jobs', { title: 'Welder needed', status: 'draft' });
    expect(r.status).toBe(201);
    expect(insertCalls()).toHaveLength(1);
    // Draft needs no accreditation lookup at all.
    expect(mocks.poolQuery.mock.calls.filter(([sql]) => norm(sql) === ACCRED_SELECT)).toHaveLength(0);
  });

  it('201 and publishes for an approved employer, exactly as before', async () => {
    mocks.accreditation = 'approved';
    const r = await post('/jobs', { title: 'Welder needed' });
    expect(r.status).toBe(201);
    expect(insertCalls()).toHaveLength(1);
    expect(mocks.lastInsert.params).toContain('published'); // company_id, title, ..., status
  });

  it('201 when the employer row has no accreditation status at all (still a draft)', async () => {
    mocks.accreditation = null;
    const r = await post('/jobs', { title: 'Welder needed', status: 'draft' });
    expect(r.status).toBe(201);
  });
});

describe('POST /jobs/:id/status accreditation gate', () => {
  it('403 on the publish transition for a non-approved employer', async () => {
    const r = await post(`/jobs/${JOB}/status`, { status: 'published' });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
    expect(mocks.clientQuery).not.toHaveBeenCalled();
    expect(publishedWrites()).toHaveLength(0);
  });

  it('200 closed/archived/draft transitions are unaffected', async () => {
    for (const status of ['closed', 'archived', 'draft']) {
      mocks.clientQuery.mockClear();
      const r = await post(`/jobs/${JOB}/status`, { status });
      expect(r.status).toBe(200);
      await r.json();
    }
  });

  it('400 when an employer tries a PESO review status (pending/approved/rejected)', async () => {
    // The review statuses belong to the admin flow — see jobs.status.test.js.
    for (const status of ['rejected', 'pending', 'approved']) {
      mocks.clientQuery.mockClear();
      const r = await post(`/jobs/${JOB}/status`, { status });
      expect(r.status).toBe(400);
      expect(mocks.clientQuery).not.toHaveBeenCalled();
    }
  });

  it('400 for an unknown status before any accreditation work', async () => {
    const r = await post(`/jobs/${JOB}/status`, { status: 'bogus' });
    expect(r.status).toBe(400);
    expect(mocks.poolQuery.mock.calls.filter(([sql]) => norm(sql) === ACCRED_SELECT)).toHaveLength(0);
  });
});

describe('PATCH /jobs/:id accreditation gate', () => {
  it('403 when a non-approved employer patches status to published', async () => {
    const r = await patch(`/jobs/${JOB}`, { status: 'published' });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe('FORBIDDEN');
    expect(mocks.clientQuery).not.toHaveBeenCalled();
    expect(publishedWrites()).toHaveLength(0);
  });

  it('200 for a non-approved employer patching ordinary fields', async () => {
    const r = await patch(`/jobs/${JOB}`, { title: 'Renamed' });
    expect(r.status).toBe(200);
    await r.json();
  });

  it('200 when a non-approved employer patches status to closed', async () => {
    const r = await patch(`/jobs/${JOB}`, { status: 'closed' });
    expect(r.status).toBe(200);
    await r.json();
  });
});

describe('super-admin publishing on an employer behalf', () => {
  it('may move a non-approved employer job to published via /status', async () => {
    mocks.role = 'super-admin';
    mocks.userId = 'admin-1';
    const r = await post(`/jobs/${JOB}/status`, { status: 'published' });
    expect(r.status).toBe(200);
    // Super-admin short-circuits: the accreditation row is never read.
    expect(mocks.poolQuery.mock.calls.filter(([sql]) => norm(sql) === ACCRED_SELECT)).toHaveLength(0);
  });

  it('may patch a non-approved employer job to published', async () => {
    mocks.role = 'super-admin';
    mocks.userId = 'admin-1';
    const r = await patch(`/jobs/${JOB}`, { status: 'published' });
    expect(r.status).toBe(200);
  });
});

describe('accreditation lookup shape', () => {
  it('reads the employers row for the signed-in company id', async () => {
    const r = await post('/jobs', { title: 'Welder needed' });
    expect(r.status).toBe(403);
    expect(mocks.poolQuery).toHaveBeenCalledWith(ACCRED_SELECT, ['emp-1']);
  });

  it('403 when the employers row is missing entirely (fail closed)', async () => {
    mocks.accreditation = null; // no row
    const r = await post('/jobs', { title: 'Welder needed' });
    expect(r.status).toBe(403);
  });
});

