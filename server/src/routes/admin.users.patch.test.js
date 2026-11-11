import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const adminSrc = readFileSync(path.join(process.cwd(), 'server', 'src/routes/admin-users.js'), 'utf8');

describe('admin users PATCH column filtering', () => {
  it('uses an explicit editable-field allowlist (no mass assignment)', () => {
    expect(adminSrc).toContain('const EDITABLE = new Set');
    expect(adminSrc).not.toContain('information_schema.columns');
  });

  it('builds patch only from validated columns', () => {
    expect(adminSrc).toMatch(/for \(const k of Object\.keys\(body\)\) if \(EDITABLE\.has\(k\)\) patch\[k\] = body\[k\]/);
  });

  it('never writes arbitrary body keys as column names', () => {
    expect(adminSrc).not.toMatch(/const patch = \{ \.\.\.\(req\.body/);
  });

  it('keeps the id/role/created_at exclusions and audit of the filtered keys', () => {
    expect(adminSrc).toContain('delete body.id;');
    expect(adminSrc).toContain('delete body.role;');
    expect(adminSrc).toContain('delete body.created_at;');
    expect(adminSrc).toContain("void audit(req.user.id, 'user.update', table, req.params.id, { fields: keys });");
  });

  it('B13/F2: strips email — a local-only email change desyncs the Supabase login identity', () => {
    expect(adminSrc).toContain('delete body.email;');
  });
});