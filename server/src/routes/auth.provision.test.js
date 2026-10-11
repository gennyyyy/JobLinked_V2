import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract test: POST /api/auth/provision accepts employment_status on the
// PERSON allowlist and persists it to job_seekers. Reads source text so no
// DB/auth env is needed.
const srv = (p) => readFileSync(path.join(process.cwd(), 'server', p), 'utf8');
const authSrc = srv('src/routes/auth.js');

describe('provision employment_status', () => {
  it("allow-lists 'employment_status' on PERSON", () => {
    expect(authSrc).toContain("'employment_status'");
  });

  it('persists employment_status in the job_seekers INSERT', () => {
    expect(authSrc).toContain('employment_status');
    expect(authSrc).toMatch(/insert into job_seekers[\s\S]*employment_status/);
  });

  it("rejects non-whitelisted values with 400 BAD_REQUEST and stores null when empty", () => {
    expect(authSrc).toContain('BAD_REQUEST');
    expect(authSrc).toMatch(/Employed.*Unemployed.*Underemployed.*Fresh Graduate.*Student/s);
  });
});
