import { readFileSync } from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract test: 016_job_field_and_skills migration guards. Reads the SQL text
// directly so no database is needed to run it.
const mig = readFileSync(
  path.join(process.cwd(), 'db', 'migrations', '016_job_field_and_skills.sql'),
  'utf8',
);
// db/seed.sql is the fresh-install source of the same vocabulary; if the two
// lists drift, migrated and freshly built databases disagree.
const seed = readFileSync(path.join(process.cwd(), 'db', 'seed.sql'), 'utf8');

// Statements only: the rollback recipe lives in comments and never executes.
const code = mig.replace(/--[^\n]*/g, '');

// Every ('<category>', '<value>' tuple, in file order.
const values = (text, category) =>
  [...text.matchAll(new RegExp(`\\('${category}',\\s*'([^']*)'`, 'g'))].map(
    (match) => match[1],
  );

describe('016_job_field_and_skills migration guards', () => {
  it('adds the three columns guarded by IF NOT EXISTS', () => {
    expect(mig).toMatch(
      /alter table public\.job_vacancies\s+add column if not exists field\s+text/,
    );
    expect(mig).toMatch(
      /alter table public\.job_vacancies\s+add column if not exists skills\s+text\[\] not null default '\{\}'/,
    );
    expect(mig).toMatch(
      /alter table public\.job_seekers\s+add column if not exists field\s+text/,
    );
  });

  it('indexes skills with GIN and field with btree', () => {
    expect(mig).toMatch(
      /create index if not exists job_vacancies_skills_gin\s+on public\.job_vacancies using gin \(skills\)/,
    );
    expect(mig).toMatch(
      /create index if not exists job_vacancies_field_idx\s+on public\.job_vacancies \(field\)/,
    );
  });

  it('seeds both controlled vocabularies', () => {
    expect(values(code, 'job_field')).toHaveLength(15);
    expect(values(code, 'skill').length).toBeGreaterThanOrEqual(50);
    // The local starter set the plan calls out explicitly.
    for (const skill of ['Customer Service', 'MS Excel', 'Welding', 'Teamwork']) {
      expect(values(code, 'skill')).toContain(skill);
    }
  });

  it('backfills every distinct seeker skill with an idempotent insert', () => {
    expect(mig).toContain('select distinct trim(lower(skill))');
    expect(mig).toContain('from public.job_seekers, unnest(skills) as skill');
    expect(mig).toContain('on conflict (category, value) do nothing');
    // Case-insensitive guard: an existing 'ms excel' must not coexist with the
    // seeded canonical 'MS Excel'.
    expect(mig).toContain('where not exists');
    expect(mig).toMatch(/lower\(r\.value\) = existing\.s/);
  });

  it('runs in a single transaction with plain CREATE INDEX (no CONCURRENTLY)', () => {
    expect(mig).toContain('BEGIN;');
    expect(mig).toContain('COMMIT;');
    expect(code).not.toMatch(/CONCURRENTLY/);
  });

  it('contains no destructive statements', () => {
    expect(code).not.toMatch(/\bdrop\s+(column|table|schema|database|type)\b/i);
    expect(code).not.toMatch(/\btruncate\b/i);
    expect(code).not.toMatch(/\bdelete\s+from\b/i);
  });

  it('keeps db/seed.sql carrying the same vocabulary', () => {
    expect(values(seed, 'job_field')).toEqual(values(code, 'job_field'));
    expect(values(seed, 'skill')).toEqual(values(code, 'skill'));
  });
});
