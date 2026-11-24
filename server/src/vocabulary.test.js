import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('./db.js', () => ({ pool: { query: mocks.query } }));

import {
  MAX_SKILLS,
  canonicalizeField,
  canonicalizeSkills,
  loadVocabulary,
  resetVocabularyCache,
  validateJobVocabulary,
} from './vocabulary.js';

const FIELDS = ['Administrative & Office', 'Information Technology'];
const SKILLS = ['MS Excel', 'Teamwork', 'Driving'];

beforeEach(() => {
  resetVocabularyCache();
  mocks.query.mockReset().mockImplementation(async (_sql, [category]) => ({
    rows: (category === 'job_field' ? FIELDS : SKILLS).map((value) => ({ value })),
  }));
});

describe('loadVocabulary', () => {
  it('reads the two reference_data categories once per TTL and keys them lowercased', async () => {
    const vocab = await loadVocabulary();
    await loadVocabulary();

    expect(mocks.query).toHaveBeenCalledTimes(2); // one row set per category, then cached
    expect(mocks.query.mock.calls.map(([, params]) => params[0])).toEqual(['job_field', 'skill']);
    expect(vocab.field.get('information technology')).toBe('Information Technology');
    expect(vocab.skill.get('ms excel')).toBe('MS Excel');

    resetVocabularyCache();
    await loadVocabulary();
    expect(mocks.query).toHaveBeenCalledTimes(4);
  });

  it('re-reads after 60 s', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      await loadVocabulary();
      await loadVocabulary();
      expect(mocks.query).toHaveBeenCalledTimes(2);
      vi.setSystemTime(61_000);
      await loadVocabulary();
      expect(mocks.query).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('canonicalizeField', () => {
  it('treats null/empty as unset, without reading the vocabulary', async () => {
    expect(await canonicalizeField(null)).toEqual({ ok: true, value: null });
    expect(await canonicalizeField(undefined)).toEqual({ ok: true, value: null });
    expect(await canonicalizeField('   ')).toEqual({ ok: true, value: null });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('returns the canonical casing for any casing', async () => {
    expect(await canonicalizeField('information technology')).toEqual({ ok: true, value: 'Information Technology' });
    expect(await canonicalizeField(' Administrative & Office ')).toEqual({ ok: true, value: 'Administrative & Office' });
  });

  it('reports the raw value it did not find', async () => {
    expect(await canonicalizeField('Astrology')).toEqual({ ok: false, invalid: 'Astrology' });
  });
});

describe('canonicalizeSkills', () => {
  it('canonicalizes case-insensitively and dedupes', async () => {
    expect(await canonicalizeSkills(['ms excel', 'TEAMWORK', 'MS Excel'])).toEqual({
      ok: true,
      value: ['MS Excel', 'Teamwork'],
    });
  });

  it('keeps a backfilled legacy skill valid under the vocabulary casing', async () => {
    // Migration 016 inserts legacy free text as-is (lowercased), so the list can
    // hold "arc welding". A seeker row still carrying "Arc Welding" must save.
    mocks.query.mockImplementation(async (_sql, [category]) => ({
      rows: (category === 'job_field' ? FIELDS : ['arc welding', 'MS Excel']).map((value) => ({ value })),
    }));

    expect(await canonicalizeSkills(['Arc Welding', 'ms excel'])).toEqual({
      ok: true,
      value: ['arc welding', 'MS Excel'],
    });
  });

  it('returns an empty list without reading the vocabulary', async () => {
    expect(await canonicalizeSkills([])).toEqual({ ok: true, value: [] });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('ignores blank entries and keeps unlisted values as typed', async () => {
    expect(await canonicalizeSkills(['', null, 'driving', '  '])).toEqual({ ok: true, value: ['Driving'] });
    expect(await canonicalizeSkills(['MS Excel', 'Underwater Basket Weaving'])).toEqual({
      ok: true,
      value: ['MS Excel', 'Underwater Basket Weaving'],
    });
  });

  it(`rejects more than ${MAX_SKILLS} values after dedupe`, async () => {
    const many = Array.from({ length: MAX_SKILLS + 1 }, (_, i) => `Skill ${i + 1}`);
    mocks.query.mockImplementation(async (_sql, [category]) => ({
      rows: (category === 'job_field' ? FIELDS : many).map((value) => ({ value })),
    }));

    const full = many.slice(0, MAX_SKILLS);
    expect(await canonicalizeSkills(full)).toEqual({ ok: true, value: full });
    expect(await canonicalizeSkills([...full, 'Skill 1'])).toEqual({ ok: true, value: full }); // dedupe first
    expect(await canonicalizeSkills(many)).toEqual({ ok: false, tooMany: true }); // 21 distinct
  });
});

describe('validateJobVocabulary', () => {
  it('leaves absent keys out and reads nothing', async () => {
    expect(await validateJobVocabulary({ title: 'Dev' })).toEqual({ ok: true, values: {} });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('returns only the keys the body sent, canonically cased', async () => {
    expect(await validateJobVocabulary({ field: 'information technology', skills: ['ms excel'] })).toEqual({
      ok: true,
      values: { field: 'Information Technology', skills: ['MS Excel'] },
    });
    expect(await validateJobVocabulary({ field: '' })).toEqual({ ok: true, values: { field: null } });
    expect(await validateJobVocabulary({ skills: null })).toEqual({ ok: true, values: { skills: [] } });
  });

  it('names the contract failures for the route to answer', async () => {
    expect((await validateJobVocabulary({ field: 'Astrology' })).message).toBe('field must be a listed job field');
    expect(await validateJobVocabulary({ skills: ['Astrology'] })).toEqual({ ok: true, values: { skills: ['Astrology'] } });
    expect((await validateJobVocabulary({ skills: 'MS Excel' })).message).toBe('skills must be an array');
  });
});
