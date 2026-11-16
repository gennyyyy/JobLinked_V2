import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const profilesSrc = readFileSync(path.join(process.cwd(), 'server', 'src/routes/profiles.js'), 'utf8');

describe('document petitions routes', () => {
  const postStart = profilesSrc.indexOf("router.post('/petitions'");
  const getStart = profilesSrc.indexOf("router.get('/petitions/company/:companyId'");
  const patchStart = profilesSrc.indexOf("router.patch('/petitions/:id'");
  const postRoute = profilesSrc.slice(postStart, getStart === -1 ? undefined : getStart);
  const getRoute = profilesSrc.slice(getStart, patchStart === -1 ? undefined : patchStart);
  const patchRoute = profilesSrc.slice(patchStart);

  it('finds all three routes', () => {
    expect(postStart).toBeGreaterThan(-1);
    expect(getStart).toBeGreaterThan(-1);
    expect(patchStart).toBeGreaterThan(-1);
  });

  it('POST validates doc_type against DOC_TYPES', () => {
    expect(postRoute).toContain('!DOC_TYPES.has(doc_type)');
    expect(postRoute).toContain("err(res, 400, 'BAD_REQUEST'");
  });

  it('POST requires reason trimmed >= 10', () => {
    expect(postRoute).toContain("trimmed.length < 10");
    expect(postRoute).toContain("reason must be at least 10 characters");
  });

  it('POST checks accreditation ownership -> 403', () => {
    expect(postRoute).toContain('select 1 from employer_accreditations where id=$1 and company_id=$2');
    expect(postRoute).toContain("err(res, 403, 'FORBIDDEN', 'Not your accreditation')");
  });

  it('POST inserts and returns 201', () => {
    expect(postRoute).toContain('insert into employer_document_petitions');
    expect(postRoute).toContain('res.status(201).json(rows[0])');
  });

  it('POST returns 409 on 23505 duplicate pending', () => {
    expect(postRoute).toContain("e.code === '23505'");
    expect(postRoute).toContain("err(res, 409, 'CONFLICT'");
  });

  it('POST notifies admins', () => {
    expect(postRoute).toContain('notifyAdmins');
    expect(postRoute).toContain("type: 'petition'");
  });

  it('POST audits create', () => {
    expect(postRoute).toContain("audit(req.user.id, 'petition.create'");
  });

  it('GET validates uuid -> 400', () => {
    expect(getRoute).toContain("!isUuid(req.params.companyId)");
    expect(getRoute).toContain("err(res, 400, 'BAD_REQUEST', 'Invalid id')");
  });

  it('GET enforces ownership or super-admin', () => {
    expect(getRoute).toContain("req.user.role !== 'super-admin'");
    expect(getRoute).toContain("req.params.companyId !== req.user.id");
    expect(getRoute).toContain("err(res, 403, 'FORBIDDEN', 'Not your company')");
  });

  it('GET returns array ordered by created_at desc', () => {
    expect(getRoute).toContain('select * from employer_document_petitions where company_id=$1 order by created_at desc');
  });

  it('PATCH uses isUuid -> 404 pattern', () => {
    expect(patchRoute).toContain("!isUuid(req.params.id)");
    expect(patchRoute).toContain("err(res, 404, 'NOT_FOUND', 'Petition not found')");
  });

  it('PATCH requires super-admin role', () => {
    expect(patchRoute).toContain("requireRole('super-admin')");
  });

  it('PATCH validates status approved/rejected', () => {
    expect(patchRoute).toContain("['approved', 'rejected'].includes(status)");
  });

  it('PATCH updates status/remarks/decided_by/decided_at', () => {
    expect(patchRoute).toContain('update employer_document_petitions set status=$2, remarks=$3, decided_by=$4, decided_at=now()');
  });

  it('PATCH returns 404 when not found', () => {
    expect(patchRoute).toContain('if (!rows[0]) return err(res, 404, \'NOT_FOUND\', \'Petition not found\')');
  });

  it('PATCH audits and notifies employer', () => {
    expect(patchRoute).toContain('audit(req.user.id, `petition.${status}`');
    expect(patchRoute).toContain('notifyUser');
  });

  it('PATCH returns 200 via json', () => {
    expect(patchRoute).toContain('res.json(rows[0])');
  });
});