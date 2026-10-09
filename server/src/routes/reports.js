import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { ah, err } from '../util.js';

const router = Router();
const admin = [auth, requireRole('super-admin')];

// Report SELECTs copied from admin.js (read-only reuse; admin.js untouched).
const SEEKER_COLS = 'id, full_name, email, phone, barangay_district, skills, employment_status, preferred_position, preferred_location';
const seekerJson = `json_build_object(${SEEKER_COLS.split(', ').map((c) => `'${c.trim()}', s.${c.trim()}`).join(', ')})`;
const APP_JOIN = `from job_applications a join job_vacancies j on j.id = a.job_id
  join employers e on e.id = j.company_id join job_seekers s on s.id = a.seeker_id`;
const APP_SELECT = `select a.*, json_build_object('id', j.id, 'title', j.title, 'location', j.location,
  'employers', json_build_object('company_name', e.company_name)) as job, ${seekerJson} as seeker ${APP_JOIN}`;

const s = (v) => (v === null || v === undefined ? '' : String(v));

async function loadReport(type) {
  // Frontend legacy names → canonical backend types.
  if (type === 'applications') type = 'applicants';
  if (type === 'jobs') type = 'vacancies';
  switch (type) {
    case 'applicants': {
      const { rows } = await pool.query(`${APP_SELECT} order by a.applied_at desc`);
      return { title: 'Applicants report', headers: ['Seeker', 'Email', 'Job', 'Company', 'Status', 'Applied At'],
        rows: rows.map((a) => [s(a.seeker?.full_name), s(a.seeker?.email), s(a.job?.title),
          s(a.job?.employers?.company_name), s(a.status), s(a.applied_at)]) };
    }
    case 'vacancies': {
      const { rows } = await pool.query(
        `select j.*, json_build_object('id', e.id, 'company_name', e.company_name) as employers
         from job_vacancies j left join employers e on e.id = j.company_id order by j.created_at desc`);
      return { title: 'Vacancies report', headers: ['Title', 'Company', 'Location', 'Status', 'Type', 'Created At'],
        rows: rows.map((j) => [s(j.title), s(j.employers?.company_name), s(j.location), s(j.status), s(j.employment_type), s(j.created_at)]) };
    }
    case 'placements': {
      const { rows } = await pool.query(
        `select a.*, json_build_object('id', j.id, 'title', j.title, 'company_id', j.company_id,
           'employers', json_build_object('id', e.id, 'company_name', e.company_name)) as job,
         ${seekerJson} as seeker ${APP_JOIN}
         where a.status in ('Accepted', 'Placed') order by a.updated_at desc`);
      return { title: 'Placements report', headers: ['Seeker', 'Email', 'Job', 'Company', 'Status', 'Updated At'],
        rows: rows.map((a) => [s(a.seeker?.full_name), s(a.seeker?.email), s(a.job?.title),
          s(a.job?.employers?.company_name), s(a.status), s(a.updated_at)]) };
    }
    case 'seekers': {
      const { rows } = await pool.query(
        'select id, full_name, email, status, created_at from job_seekers order by created_at desc');
      return { title: 'Seekers report', headers: ['ID', 'Full Name', 'Email', 'Status', 'Created At'],
        rows: rows.map((r) => [s(r.id), s(r.full_name), s(r.email), s(r.status), s(r.created_at)]) };
    }
    case 'employers': {
      const { rows } = await pool.query('select * from employers order by created_at desc');
      return { title: 'Employers report', headers: ['Company', 'Owner', 'Email', 'Status', 'Registered'],
        rows: rows.map((c) => [s(c.company_name), s(c.full_name), s(c.email), s(c.status), s(c.created_at)]) };
    }
    case 'barangay': {
      const { rows } = await pool.query(
        `select s.barangay_district as barangay, count(*)::int as placements ${APP_JOIN}
         where a.status in ('Accepted', 'Placed') and s.barangay_district is not null
         group by s.barangay_district order by placements desc`);
      return { title: 'Placements by barangay', headers: ['Barangay', 'Placements'],
        rows: rows.map((r) => [s(r.barangay), s(r.placements)]) };
    }
    case 'monthly': {
      const [{ rows: apps }, { rows: jobs }, { rows: seekers }] = await Promise.all([
        pool.query(`select to_char(applied_at, 'YYYY-MM') as m, count(*)::int as c from job_applications group by 1`),
        pool.query(`select to_char(created_at, 'YYYY-MM') as m, count(*)::int as c from job_vacancies group by 1`),
        pool.query(`select to_char(created_at, 'YYYY-MM') as m, count(*)::int as c from job_seekers group by 1`),
      ]);
      const byMonth = {};
      for (const [rs, k] of [[apps, 'applications'], [jobs, 'jobs'], [seekers, 'seekers']]) {
        for (const r of rs) byMonth[r.m] = { ...byMonth[r.m], [k]: r.c };
      }
      return { title: 'Monthly report', headers: ['Month', 'Applications', 'Jobs', 'Seekers'],
        rows: Object.keys(byMonth).sort().map((m) => [m, s(byMonth[m].applications || 0), s(byMonth[m].jobs || 0), s(byMonth[m].seekers || 0)]) };
    }
    default:
      return null;
  }
}

// Same builder as the frontend buildCSV (comma-join, quoted cells).
const toCSV = (headers, rows) => [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');

const TYPES = ['applicants', 'vacancies', 'placements', 'employers', 'barangay', 'monthly', 'applications', 'jobs', 'seekers'];

router.get('/admin/reports/:type/export', ...admin, ah(async (req, res) => {
  const { type } = req.params;
  const format = String(req.query.format || 'csv');
  if (!TYPES.includes(type)) return err(res, 400, 'BAD_REQUEST', `type must be one of ${TYPES.join(', ')}`);
  if (format !== 'csv') return err(res, 400, 'BAD_REQUEST', 'format must be csv');
  const report = await loadReport(type);
  const base = `${type}-report`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
  return res.send(toCSV(report.headers, report.rows));
}));

export default router;
