import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', async () => {
  const h = await import('../__tests__/helpers/db.js');
  return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect };
});
vi.mock('@supabase/supabase-js', async () => {
  const h = await import('../__tests__/helpers/auth.js');
  return { createClient: () => ({ auth: h.supabaseAuth }) };
});

process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.RETENTION_DISABLE ||= '1';

const { on, reset, callsOf } = await import('../__tests__/helpers/db.js');
const { loginAs, resetAuth } = await import('../__tests__/helpers/auth.js');
const { makeApp } = await import('../__tests__/helpers/app.js');

const SEEKER = '11111111-1111-4111-8111-111111111111';
const EMPLOYER = '33333333-3333-4333-8333-333333333333';
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(32, 1)]);
const binaryParser = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const app = makeApp();

beforeEach(() => { reset(); resetAuth(); });

describe('profile images (ADR-040)', () => {
  it('stores an avatar as bytes and answers 201 with no bytes in the body', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on(/insert into profile_images/, () => ({ rows: [{ updated_at: '2026-01-01T00:00:00.000Z' }] }));

    const res = await request(app).post('/api/seekers/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ok: true, mime: 'image/png' });
    expect(JSON.stringify(res.body)).not.toContain('bytes');
    const insert = callsOf(/insert into profile_images/)[0];
    expect(insert.params[0]).toBe(SEEKER);
    expect(insert.params[1]).toBe('seeker-avatar');
    expect(Buffer.isBuffer(insert.params[3])).toBe(true);
  });

  it('rejects an EXE renamed .png before it reaches the database', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    const res = await request(app).post('/api/seekers/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('MZ\u0090\u0000', 'latin1'), { filename: 'evil.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(callsOf(/insert into profile_images/)).toHaveLength(0);
  });

  it('serves the owner avatar with private caching and no token = 401', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on(/select mime, bytes, updated_at from profile_images/, () => ({
      rows: [{ mime: 'image/png', bytes: PNG, updated_at: '2026-01-01T00:00:00.000Z' }],
    }));

    const res = await request(app).get(`/api/seekers/${SEEKER}/avatar`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toContain('private');
    expect(res.headers.vary.toLowerCase()).toContain('authorization');
    expect(Buffer.compare(res.body, PNG)).toBe(0);

    const anon = await request(app).get(`/api/seekers/${SEEKER}/avatar`);
    expect(anon.status).toBe(401);
  });

  it('does not let an unrelated employer read a seeker avatar', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });
    on(/select 1 from job_applications a join job_vacancies/, () => ({ rows: [] }));
    const res = await request(app).get(`/api/seekers/${SEEKER}/avatar`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('serves a company logo publicly with a public cache policy', async () => {
    on(/select mime, bytes, updated_at from profile_images/, () => ({
      rows: [{ mime: 'image/png', bytes: PNG, updated_at: '2026-01-01T00:00:00.000Z' }],
    }));
    const res = await request(app).get(`/api/employers/${EMPLOYER}/logo`)
      .buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(Buffer.compare(res.body, PNG)).toBe(0);
  });

  it('adds has_avatar/version to the profile GET without selecting bytes', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on(/left join profile_images i on i.owner_id/, () => ({
      rows: [{ id: SEEKER, full_name: 'Jane', has_avatar: true, avatar_updated_at: '2026-01-01T00:00:00.000Z' }],
    }));
    const res = await request(app).get('/api/seekers/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.has_avatar).toBe(true);
    expect(res.body.avatar_updated_at).toBeTruthy();
    expect(callsOf(/select mime, bytes/)).toHaveLength(0);
  });

  it('deletes only the caller own image kind', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    on(/^delete from profile_images/, () => ({ rows: [], rowCount: 1 }));
    const res = await request(app).delete('/api/seekers/me/avatar').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(callsOf(/^delete from profile_images/)[0].params).toEqual([SEEKER, 'seeker-avatar']);
  });
});
