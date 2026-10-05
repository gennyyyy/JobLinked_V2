import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { ah, err, audit, notifyUser, notifyAdmins } from '../util.js';
import { uploadSingle, uploadDir, relPath } from '../upload.js';

const router = Router();

const SEEKER_ALLOW = ['first_name', 'middle_name', 'last_name', 'suffix', 'full_name', 'phone',
  'house_number_unit', 'street_address', 'subdivision_building', 'barangay_district',
  'city_municipality', 'province_state', 'postal_code', 'country', 'birthdate',
  'skills', 'employment_status', 'preferred_position', 'preferred_location'];
const EMPLOYER_ALLOW = ['first_name', 'middle_name', 'last_name', 'suffix', 'full_name', 'phone',
  'company_name', 'company_email', 'industry', 'house_number_unit', 'street_address',
  'subdivision_building', 'barangay_district', 'city_municipality', 'province_state',
  'postal_code', 'country', 'representative_email', 'representative_position',
  'website', 'description', 'logo_path'];

const meRoutes = (path, table, role, allow) => {
  router.get(path, auth, requireRole(role), ah(async (req, res) => {
    const { rows } = await pool.query(`select * from ${table} where id = $1`, [req.user.id]);
    if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Profile not found');
    res.json(rows[0]);
  }));
  router.patch(path, auth, requireRole(role), ah(async (req, res) => {
    const patch = {};
    for (const c of allow) if (req.body?.[c] !== undefined) patch[c] = req.body[c] === '' ? null : req.body[c];
    if (!Object.keys(patch).length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
    const keys = Object.keys(patch);
    const { rows } = await pool.query(
      `update ${table} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1 returning *`,
      [req.user.id, ...keys.map((k) => patch[k])]);
    if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Profile not found');
    void audit(req.user.id, 'profile.update', table, req.user.id, { fields: keys });
    res.json(rows[0]);
  }));
};
meRoutes('/employers/me', 'employers', 'employer', EMPLOYER_ALLOW);
meRoutes('/seekers/me', 'job_seekers', 'job-seeker', SEEKER_ALLOW);

const ACC_STATUSES = ['none', 'pending', 'approved', 'rejected', 'resubmission', 'revoked'];
const accSelect = `select a.*, json_build_object('full_name', s.full_name) as decided_by
  from employer_accreditations a left join super_admins s on s.id = a.decided_by`;

router.post('/accreditations', auth, requireRole('employer'), ah(async (req, res) => {
  // employers.accreditation_status sync is handled by the DB trigger.
  const { rows } = await pool.query(
    `insert into employer_accreditations (company_id, status) values ($1, 'pending') returning *`, [req.user.id]);
  void audit(req.user.id, 'accreditation.submit', 'employer_accreditations', rows[0].id);
  void notifyAdmins({ type: 'accreditation', title: 'Accreditation awaiting review',
    message: 'A new employer accreditation application is waiting for PESO review.', link: '/super-admin/accreditation' });
  res.status(201).json(rows[0]);
}));

router.get('/accreditations/company/:companyId', auth, ah(async (req, res) => {
  if (req.user.role !== 'super-admin' && req.params.companyId !== req.user.id) {
    return err(res, 403, 'FORBIDDEN', 'Not your company');
  }
  const { rows } = await pool.query(`${accSelect} where a.company_id = $1 order by a.submitted_at desc`, [req.params.companyId]);
  res.json(rows);
}));

router.patch('/accreditations/:id', auth, requireRole('super-admin'), ah(async (req, res) => {
  const { status, remarks = null } = req.body || {};
  if (!ACC_STATUSES.includes(status)) return err(res, 400, 'BAD_REQUEST', `status must be one of ${ACC_STATUSES.join(', ')}`);
  const terminal = ['approved', 'rejected', 'revoked'].includes(status);
  const { rows } = await pool.query(
    `update employer_accreditations set status = $2, remarks = $3, decided_by = $4${terminal ? ', decided_at = now()' : ''}
     where id = $1 returning *`, [req.params.id, status, remarks, req.user.id]);
  if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Accreditation not found');
  void audit(req.user.id, `accreditation.${status}`, 'employer_accreditations', rows[0].id);
  if (['approved', 'rejected', 'resubmission', 'revoked'].includes(status)) {
    const { rows: crows } = await pool.query('select id, company_name from employers where id = $1', [rows[0].company_id]);
    if (crows[0]) {
      void notifyUser(crows[0].id, { type: 'accreditation', title: `Accreditation ${status}`,
        message: `Your accreditation for ${crows[0].company_name} has been ${status}.${remarks ? ` PESO remarks: ${remarks}` : ''}`,
        link: '/employer/accreditation' });
    }
  }
  res.json(rows[0]);
}));

const docSelect = `select d.*,
  json_build_object('full_name', s.full_name) as reviewed_by,
  json_build_object('id', e.id, 'company_name', e.company_name) as company
from employer_documents d
left join super_admins s on s.id = d.reviewed_by
left join employers e on e.id = d.company_id`;

async function storeDocument(companyId, docType, accreditationId, file) {
  const rel = relPath('documents', companyId, path.basename(file.path));
  const { rows } = await pool.query(
    `insert into employer_documents (company_id, accreditation_id, doc_type, file_path, file_name)
     values ($1,$2,$3,$4,$5) returning *`, [companyId, accreditationId || null, docType, rel, file.originalname]);
  return rows[0];
}

async function notifyDocAdmins(companyId, docType) {
  try {
    const { rows } = await pool.query('select company_name from employers where id = $1', [companyId]);
    await notifyAdmins({ type: 'document', title: 'New document for review',
      message: `${rows[0]?.company_name || 'An employer'} uploaded ${String(docType).replace(/_/g, ' ')} for PESO verification.`,
      link: '/super-admin/accreditation' });
  } catch { /* ponytail: best-effort, never fails the upload */ }
}

router.post('/documents', auth, requireRole('employer'), uploadSingle('documents'), ah(async (req, res) => {
  const { doc_type, accreditation_id = null } = req.body || {};
  if (!doc_type) return err(res, 400, 'BAD_REQUEST', 'doc_type is required');
  const doc = await storeDocument(req.user.id, doc_type, accreditation_id, req.file);
  void audit(req.user.id, 'document.upload', 'employer_documents', doc.id, { doc_type });
  void notifyDocAdmins(req.user.id, doc_type);
  res.status(201).json(doc);
}));

router.get('/documents/company/:companyId', auth, ah(async (req, res) => {
  if (req.user.role !== 'super-admin' && req.params.companyId !== req.user.id) {
    return err(res, 403, 'FORBIDDEN', 'Not your company');
  }
  const { rows } = await pool.query(`${docSelect} where d.company_id = $1 order by d.uploaded_at desc`, [req.params.companyId]);
  res.json(rows);
}));

router.patch('/documents/:id', auth, requireRole('super-admin'), ah(async (req, res) => {
  const { status, remarks = null } = req.body || {};
  if (!['pending', 'verified', 'rejected', 'missing'].includes(status)) {
    return err(res, 400, 'BAD_REQUEST', 'status must be pending, verified, rejected, or missing');
  }
  const { rows } = await pool.query(
    `update employer_documents set status = $2, remarks = $3, reviewed_by = $4, reviewed_at = now()
     where id = $1 returning *`, [req.params.id, status, remarks, req.user.id]);
  if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Document not found');
  void audit(req.user.id, `document.${status}`, 'employer_documents', rows[0].id);
  if (['verified', 'rejected'].includes(status)) {
    const { rows: crows } = await pool.query('select id, company_name from employers where id = $1', [rows[0].company_id]);
    if (crows[0]) {
      void notifyUser(crows[0].id, { type: 'document', title: `Document ${status}`,
        message: `Your ${String(rows[0].doc_type).replace(/_/g, ' ')} for ${crows[0].company_name} was ${status}.${remarks ? ` PESO remarks: ${remarks}` : ''}`,
        link: '/employer/accreditation' });
    }
  }
  res.json(rows[0]);
}));

// Upload + resume row. New upload becomes the active resume (setActiveResume, server-side).
router.post('/files/resumes', auth, requireRole('job-seeker'), uploadSingle('resumes'), ah(async (req, res) => {
  const rel = relPath('resumes', req.user.id, path.basename(req.file.path));
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('update resumes set is_active = false where seeker_id = $1', [req.user.id]);
    const { rows } = await client.query(
      'insert into resumes (seeker_id, file_path, file_name, is_active) values ($1,$2,$3,true) returning *',
      [req.user.id, rel, req.file.originalname]);
    await client.query('commit');
    void audit(req.user.id, 'resume.upload', 'resumes', rel);
    res.status(201).json({ path: rel, resume: rows[0] });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}));

// Raw file store for the documents bucket; creates the employer_documents row when doc_type is given.
router.post('/files/documents', auth, requireRole('employer'), uploadSingle('documents'), ah(async (req, res) => {
  const { doc_type = null, accreditation_id = null } = req.body || {};
  const rel = relPath('documents', req.user.id, path.basename(req.file.path));
  let document = null;
  if (doc_type) {
    document = await storeDocument(req.user.id, doc_type, accreditation_id, req.file);
    void audit(req.user.id, 'document.upload', 'employer_documents', document.id, { doc_type });
    void notifyDocAdmins(req.user.id, doc_type);
  }
  res.status(201).json(document ? { path: rel, document } : { path: rel });
}));

router.delete('/files/resumes/:id', auth, ah(async (req, res) => {
  const { rows } = await pool.query('select * from resumes where id = $1', [req.params.id]);
  if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Resume not found');
  if (req.user.role !== 'super-admin' && rows[0].seeker_id !== req.user.id) {
    return err(res, 403, 'FORBIDDEN', 'Not your resume');
  }
  await pool.query('delete from resumes where id = $1', [req.params.id]);
  try { fs.unlinkSync(path.join(uploadDir, rows[0].file_path)); } catch { /* file already gone */ }
  res.json({ deleted: true });
}));

// Addendum A: own resume list (listResumes) + active-resume swap (setActiveResume).
router.get('/files/resumes/mine', auth, requireRole('job-seeker'), ah(async (req, res) => {
  const { rows } = await pool.query('select * from resumes where seeker_id = $1 order by uploaded_at desc', [req.user.id]);
  res.json(rows);
}));

router.post('/files/resumes/:id/activate', auth, requireRole('job-seeker'), ah(async (req, res) => {
  const { rows } = await pool.query('select * from resumes where id = $1', [req.params.id]);
  if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Resume not found');
  if (rows[0].seeker_id !== req.user.id) return err(res, 403, 'FORBIDDEN', 'Not your resume');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('update resumes set is_active = false where seeker_id = $1', [req.user.id]);
    const r = await client.query('update resumes set is_active = true where id = $1 returning *', [req.params.id]);
    await client.query('commit');
    void audit(req.user.id, 'resume.activate', 'resumes', req.params.id);
    res.json(r.rows[0]);
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}));

// Addendum A: seeker profile children. Education/experience are seeker-owned
// CRUD; employment_history is trigger-written, read-only.
const seekerChild = (path, table, order, allow = null, required = []) => {
  router.get(path, auth, requireRole('job-seeker'), ah(async (req, res) => {
    const { rows } = await pool.query(`select * from ${table} where seeker_id = $1 order by ${order}`, [req.user.id]);
    res.json(rows);
  }));
  if (!allow) return;
  router.post(path, auth, requireRole('job-seeker'), ah(async (req, res) => {
    for (const k of required) {
      if (req.body?.[k] === undefined || req.body?.[k] === null || req.body?.[k] === '') {
        return err(res, 400, 'BAD_REQUEST', `${k} is required`);
      }
    }
    const keys = allow.filter((c) => req.body?.[c] !== undefined);
    if (!keys.length) return err(res, 400, 'BAD_REQUEST', 'Nothing to add');
    const { rows } = await pool.query(
      `insert into ${table} (seeker_id, ${keys.join(', ')}) values ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')}) returning *`,
      [req.user.id, ...keys.map((k) => (req.body[k] === '' ? null : req.body[k]))]);
    void audit(req.user.id, `${table}.create`, table, rows[0].id);
    res.status(201).json(rows[0]);
  }));
  router.delete(`${path}/:id`, auth, requireRole('job-seeker'), ah(async (req, res) => {
    const { rowCount } = await pool.query(`delete from ${table} where id = $1 and seeker_id = $2`, [req.params.id, req.user.id]);
    if (!rowCount) return err(res, 404, 'NOT_FOUND', 'Entry not found');
    void audit(req.user.id, `${table}.delete`, table, req.params.id);
    res.json({ deleted: true });
  }));
};
seekerChild('/seekers/me/education', 'education', 'id desc',
  ['level', 'school', 'field', 'start_year', 'end_year'], ['level', 'school']);
seekerChild('/seekers/me/experience', 'work_experience', 'id desc',
  ['company', 'position', 'start_date', 'end_date', 'description'], ['company', 'position']);
seekerChild('/seekers/me/employment', 'employment_history', 'created_at desc');

// Replaces signedUrl: auth + ownership check (own resume, own-company doc, or admin).
router.get('/files/:bucket/*', auth, ah(async (req, res) => {
  const { bucket } = req.params;
  if (!['resumes', 'documents'].includes(bucket)) return err(res, 404, 'NOT_FOUND', 'Unknown bucket');
  const rel = req.params[0] || '';
  const abs = path.normalize(path.join(uploadDir, bucket, rel));
  if (!abs.startsWith(path.join(uploadDir, bucket) + path.sep)) {
    return err(res, 400, 'BAD_REQUEST', 'Invalid path');
  }
  const fullRel = `${bucket}/${rel}`;
  if (req.user.role !== 'super-admin') {
    if (bucket === 'resumes') {
      const { rows } = await pool.query('select seeker_id from resumes where file_path = $1', [fullRel]);
      if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'File not found');
      if (rows[0].seeker_id !== req.user.id) {
        // Addendum A: an employer may read a resume linked to one of their
        // jobs via a job_applications row (same join rule as credential reads).
        if (req.user.role !== 'employer') return err(res, 403, 'FORBIDDEN', 'Not your file');
        const { rows: link } = await pool.query(
          `select 1 from job_applications a join job_vacancies j on j.id = a.job_id
           where j.company_id = $1 and a.seeker_id = $2 limit 1`, [req.user.id, rows[0].seeker_id]);
        if (!link[0]) return err(res, 403, 'FORBIDDEN', 'Not your file');
      }
    } else {
      const { rows } = await pool.query('select id from employer_documents where file_path = $1 and company_id = $2', [fullRel, req.user.id]);
      if (!rows[0]) return err(res, 403, 'FORBIDDEN', 'Not your file');
    }
  }
  if (!fs.existsSync(abs)) return err(res, 404, 'NOT_FOUND', 'File not found');
  void audit(req.user.id, 'document.view', bucket, fullRel);
  res.sendFile(abs);
}));

export default router;
