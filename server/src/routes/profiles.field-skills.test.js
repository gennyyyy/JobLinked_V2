import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Task 4: the seeker profile takes `field` (job_field vocabulary) and stores
// skills in the vocabulary's canonical casing — Review Focus 2 (no lowercasing
// on write) and 3 (legacy backfilled skills still save). Migration 016 backfills
// legacy free text lowercased, so the vocabulary itself may hold "arc welding".
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('@supabase/supabase-js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { createClient: () => ({ auth: h.supabaseAuth }) }; });

import { on, reset, callsOf } from '../__tests__/helpers/db.js';
import { loginAs, resetAuth } from '../__tests__/helpers/auth.js';
import { makeApp } from '../__tests__/helpers/app.js';
import { resetVocabularyCache } from '../vocabulary.js';

const SEEKER = '11111111-1111-1111-1111-111111111111';
const EMPLOYER = '22222222-2222-2222-2222-222222222222';

const FIELDS = ['Administrative & Office', 'Information Technology'];
const SKILLS = ['MS Excel', 'Teamwork', 'arc welding'];

let vocabFields = FIELDS;
let vocabSkills = SKILLS;

const app = makeApp();

const patchMe = (token, body) => request(app).patch('/api/seekers/me')
  .set('Authorization', `Bearer ${token}`).send(body);
const updateReturns = (row = { id: SEEKER }) => on(/update job_seekers set/, () => ({ rows: [row] }));

beforeEach(() => {
  reset();
  resetAuth();
  resetVocabularyCache();
  vocabFields = FIELDS;
  vocabSkills = SKILLS;
  on(/from reference_data where category = \$1/, ([category]) => ({
    rows: (category === 'job_field' ? vocabFields : vocabSkills).map((value) => ({ value })),
  }));
});

describe('PATCH /api/seekers/me skills', () => {
  it('stores canonical casing and dedupes case-insensitively', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    updateReturns();

    const res = await patchMe(token, { skills: ['ms excel', 'TEAMWORK', 'MS Excel', '  '] });

    expect(res.status).toBe(200);
    const update = callsOf(/update job_seekers set/)[0];
    expect(update.sql).toContain('skills = $2');
    expect(update.params).toEqual([SEEKER, ['MS Excel', 'Teamwork']]);
  });

  it('keeps a legacy backfilled skill valid and stores the vocabulary casing', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    updateReturns();

    const res = await patchMe(token, { skills: ['Arc Welding'] });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_seekers set/)[0].params).toEqual([SEEKER, ['arc welding']]);
  });

  it('400s an unknown skill, naming the raw value, before writing', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });

    const res = await patchMe(token, { skills: ['MS Excel', 'Underwater Basket Weaving'] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'skills contains an unknown value: Underwater Basket Weaving' },
    });
    expect(callsOf(/update job_seekers set/)).toHaveLength(0);
  });

  it('400s more than 20 skills with the cap in the message', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    vocabSkills = Array.from({ length: 21 }, (_, i) => `Skill ${i + 1}`);

    const res = await patchMe(token, { skills: vocabSkills });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('skills must contain at most 20 values');
    expect(callsOf(/update job_seekers set/)).toHaveLength(0);
  });

  it('400s skills that are not an array', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });

    const res = await patchMe(token, { skills: 'MS Excel' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('skills must be an array');
  });

  it('clears skills with null', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    updateReturns();

    const res = await patchMe(token, { skills: null });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_seekers set/)[0].params).toEqual([SEEKER, []]);
  });
});

describe('PATCH /api/seekers/me field', () => {
  it('stores the canonical field casing', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    updateReturns();

    const res = await patchMe(token, { field: 'information technology' });

    expect(res.status).toBe(200);
    const update = callsOf(/update job_seekers set/)[0];
    expect(update.sql).toContain('field = $2');
    expect(update.params).toEqual([SEEKER, 'Information Technology']);
  });

  it('clears the field with "" (unset)', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    updateReturns();

    const res = await patchMe(token, { field: '' });

    expect(res.status).toBe(200);
    expect(callsOf(/update job_seekers set/)[0].params).toEqual([SEEKER, null]);
  });

  it('400s a field that is not in job_field', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });

    const res = await patchMe(token, { field: 'Astrology' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'field must be a listed job field' } });
    expect(callsOf(/update job_seekers set/)).toHaveLength(0);
  });

  it('is not writable on the employer profile', async () => {
    const token = loginAs({ id: EMPLOYER, role: 'employer' });

    const res = await request(app).patch('/api/employers/me')
      .set('Authorization', `Bearer ${token}`).send({ field: 'Information Technology' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Nothing to update');
    expect(callsOf(/update employers set/)).toHaveLength(0);
  });
});

describe('PATCH /api/seekers/me — surrounding behavior', () => {
  it('leaves the lowercase behavior of the other columns alone', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    updateReturns();

    const res = await patchMe(token, {
      field: 'information technology', skills: ['ms excel'], city_municipality: 'Cebu City',
    });

    expect(res.status).toBe(200);
    const update = callsOf(/update job_seekers set/)[0];
    expect(update.sql).toContain('city_municipality = $2');
    expect(update.sql).toContain('skills = $3');
    expect(update.sql).toContain('field = $4');
    expect(update.params).toEqual([SEEKER, 'cebu city', ['MS Excel'], 'Information Technology']);
  });

  it('does not read the vocabulary when the patch sends neither field nor skills', async () => {
    const token = loginAs({ id: SEEKER, role: 'job-seeker' });
    updateReturns();

    const res = await patchMe(token, { phone: '0917000000' });

    expect(res.status).toBe(200);
    expect(callsOf(/from reference_data/)).toHaveLength(0);
  });
});
