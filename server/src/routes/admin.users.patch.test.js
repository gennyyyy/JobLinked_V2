import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Contract: PATCH /api/admin/users/:id must only write keys that are real columns
// of the resolved role table. The super-admin edit-profile flow posts `phone`,
// which super_admins has no column for (db/schema.sql), so writing the body
// verbatim used to raise Postgres 42703 and turn into a 500.
const adminSrc = readFileSync(path.join(process.cwd(), 'server', 'src/routes/admin.js'), 'utf8');

describe('admin users PATCH column filtering', () => {
  it('derives the valid columns from the resolved table', () => {
    expect(adminSrc).toContain('information_schema.columns');
    expect(adminSrc).toMatch(/table_schema = 'public' and table_name = \$1/);
    expect(adminSrc).toMatch(/const valid = new Set\(cols\.map\(\(c\) => c\.column_name\)\)/);
  });

  it('builds patch only from validated columns', () => {
    expect(adminSrc).toMatch(/for \(const k of Object\.keys\(body\)\) if \(valid\.has\(k\)\) patch\[k\] = body\[k\]/);
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
