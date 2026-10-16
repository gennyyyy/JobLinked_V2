import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract test: a client-supplied accreditation id must never link an
// uploaded document to another company's accreditation — storeDocument
// verifies ownership against employer_accreditations first and drops the id
// when it isn't the caller's. Reads source text so no DB is needed.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const profilesSrc = srv('src/routes/profiles.js');

const storeStart = profilesSrc.indexOf('async function storeDocument');
const storeEnd = profilesSrc.indexOf('async function notifyDocAdmins');
const store = profilesSrc.slice(storeStart, storeEnd === -1 ? undefined : storeEnd);

describe('storeDocument accreditation ownership', () => {
  it('verifies a supplied accreditation id against employer_accreditations for the same company', () => {
    expect(storeStart).toBeGreaterThan(-1);
    expect(store).toContain('select 1 from employer_accreditations where id = $1 and company_id = $2');
    expect(store).toContain('[accreditation, companyId]');
  });

  it('runs the ownership check before the insert', () => {
    expect(store.indexOf('employer_accreditations')).toBeGreaterThan(-1);
    expect(store.indexOf('employer_accreditations')).toBeLessThan(store.indexOf('insert into employer_documents'));
  });

  it('drops an unowned or foreign id instead of linking it into the insert', () => {
    expect(store).toContain('owned[0] ? accreditation : null');
    // the insert receives the verified value, never the raw client parameter
    expect(store).toContain('[companyId, accreditation, docType, rel, file.originalname]');
    expect(store).not.toContain('[companyId, accreditationId');
  });
});
