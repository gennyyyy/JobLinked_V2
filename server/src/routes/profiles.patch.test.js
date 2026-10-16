import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract: PATCH /api/seekers/me | /api/employers/me must not coerce '' to NULL
// for not-null text columns (a blank suffix/middle_name used to 500 the request).
const profilesSrc = readFileSync(path.join(process.cwd(), 'server', 'src/routes/profiles.js'), 'utf8');

describe('profiles PATCH empty-vs-null', () => {
  it('keeps "" for NOT NULL text columns', () => {
    expect(profilesSrc).toContain('REQUIRED_TEXT');
    expect(profilesSrc).toMatch(/value === '' \? \(REQUIRED_TEXT\.has\(c\) \? '' : null\)/);
  });

  it('lists the not-null text columns', () => {
    for (const c of ['first_name', 'middle_name', 'last_name', 'suffix', 'full_name', 'country', 'company_name']) {
      expect(profilesSrc).toContain(`'${c}'`);
    }
  });
});
