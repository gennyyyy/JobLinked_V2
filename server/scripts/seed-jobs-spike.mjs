#!/usr/bin/env node
// Simultaneous job-posting spike: 100 published jobs from 50 different employers.
//
//   node scripts/seed-jobs-spike.mjs                # 50 employers x 2 jobs = 100, all at once
//   node scripts/seed-jobs-spike.mjs --per-employer 1
//
// Prerequisites: the 50 registration-spike employers exist
// (spike.employer.001..050@joblinked-spike.test), created by
// scripts/seed-registration-spike.mjs.
//
// Phases:
//   1. sign in the 50 employers (real /token path; paced when Supabase throttles)
//   2. approve their accreditation rows (PESO approval; trigger syncs employers)
//   3. fire every POST /api/jobs at once with realistic per-industry payloads
//   4. verify rows/status history/audit in Postgres and print the latency table
//
// Data is meant to stay; re-running adds another batch.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// ---------------------------------------------------------------- env + args
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* not run from server/ */ }
try {
  for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(line);
    if (m && m[1] === 'VITE_SUPABASE_ANON_KEY' && !process.env.SUPABASE_ANON_KEY) {
      process.env.SUPABASE_ANON_KEY = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch { /* no root env */ }

const argv = process.argv.slice(2);
const num = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : d;
};
const API = `http://127.0.0.1:${process.env.PORT || 4000}`;
const PER_EMPLOYER = num('per-employer', 2);
const EMPLOYERS = 50;
const pad = (n) => String(n).padStart(3, '0');

const supaAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------- title/tag pools
const TITLES = {
  trading: ['Sales Associate', 'Warehouse Staff', 'Purchaser', 'Delivery Helper'],
  construction: ['Construction Worker', 'Site Engineer', 'Safety Officer', 'Project Assistant'],
  foods: ['Service Crew', 'Kitchen Staff', 'Cashier', 'Branch Supervisor'],
  logistics: ['Delivery Driver', 'Dispatcher', 'Warehouse Associate', 'Logistics Coordinator'],
  'medical services': ['Staff Nurse', 'Nursing Aide', 'Front Desk Officer', 'Medical Records Clerk'],
  'tutorial center': ['Tutor', 'Teaching Aide', 'Academic Coordinator'],
  'security services': ['Security Guard', 'Shift Supervisor', 'Control Room Operator'],
  'agri supply': ['Inventory Clerk', 'Sales Associate', 'Delivery Helper'],
  'motor parts': ['Auto Mechanic', 'Parts Clerk', 'Delivery Driver'],
  'water refilling': ['Delivery Driver', 'Plant Operator', 'Customer Service Assistant'],
  bakeshop: ['Baker', 'Pastry Assistant', 'Cashier', 'Service Crew'],
  hardware: ['Sales Associate', 'Inventory Clerk', 'Delivery Helper'],
  pharmacy: ['Pharmacy Assistant', 'Cashier', 'Inventory Clerk'],
  'printing press': ['Press Operator', 'Layout Artist', 'Customer Service Assistant'],
  'auto repair': ['Auto Mechanic', 'Service Advisor', 'Shop Assistant'],
  'laundry services': ['Laundry Attendant', 'Delivery Driver', 'Customer Service Assistant'],
  'event rentals': ['Event Crew', 'Delivery Helper', 'Event Coordinator'],
  furniture: ['Carpenter', 'Sales Associate', 'Delivery Helper'],
  'poultry farm': ['Farm Worker', 'Poultry Caretaker', 'Quality Checker', 'Delivery Driver'],
  'travel agency': ['Travel Consultant', 'Reservations Assistant', 'Admin Staff'],
};
const TAGS = {
  trading: ['sales', 'inventory'], construction: ['welding', 'construction'], foods: ['cooking', 'customer service'],
  logistics: ['driving', 'delivery'], 'medical services': ['nursing', 'customer service'], 'tutorial center': ['teaching'],
  'security services': ['security'], 'agri supply': ['inventory', 'sales'], 'motor parts': ['auto mechanic', 'sales'],
  'water refilling': ['driving', 'customer service'], bakeshop: ['cooking', 'customer service'],
  hardware: ['inventory', 'sales'], pharmacy: ['customer service', 'inventory'], 'printing press': ['graphic design'],
  'auto repair': ['auto mechanic'], 'laundry services': ['customer service', 'driving'],
  'event rentals': ['customer service'], furniture: ['carpentry', 'sales'], 'poultry farm': ['agriculture'],
  'travel agency': ['customer service', 'sales'],
};
const TYPES = ['Full-time', 'Full-time', 'Full-time', 'Part-time', 'Contractual', 'Project-based'];
const ARRANGEMENTS = ['On-site', 'On-site', 'On-site', 'Hybrid', 'Remote / Work from home'];
const DEADLINES = ['2026-12-15', '2026-12-31', '2027-01-15', '2027-01-31', '2027-02-15'];
const pick = (arr, i) => arr[i % arr.length];

// --------------------------------------------------------------- main flow
const accounts = Array.from({ length: EMPLOYERS }, (_, i) => ({
  index: i,
  email: `spike.employer.${pad(i + 1)}@joblinked-spike.test`,
  password: `Spike!Emp${200 + i}!`,
  token: null,
  userId: null,
}));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pooled = async (items, worker, concurrency) => {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (cursor < items.length) { await worker(items[cursor++]); }
  }));
};

console.log(`Phase 1/3 signing in ${EMPLOYERS} employers...`);
for (let round = 1; round <= 8; round++) {
  const todo = accounts.filter((a) => !a.token);
  if (!todo.length) break;
  await pooled(todo, async (a) => {
    const { data, error } = await supaAnon.auth.signInWithPassword({ email: a.email, password: a.password });
    if (error || !data.session) { a.error = error?.message; return; }
    a.token = data.session.access_token;
    a.userId = data.session.user.id;
  }, 5);
  const have = accounts.filter((a) => a.token).length;
  console.log(`  round ${round}: signed in ${have}/${EMPLOYERS}`);
  if (have < EMPLOYERS) await sleep(45000);
}
const signedIn = accounts.filter((a) => a.token);
if (signedIn.length < EMPLOYERS) {
  console.log(`  only ${signedIn.length}/${EMPLOYERS} signed in; failing: ${accounts.filter((a) => !a.token).slice(0, 3).map((a) => a.email).join(', ')}`);
}

console.log('Phase 2/3 approving accreditation (PESO step)...');
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const ids = signedIn.map((a) => a.userId);
await db.query(`update employer_accreditations set status = 'approved' where company_id = any($1::uuid[])`, [ids]);
const employers = (await db.query(
  `select id, company_name, industry, barangay_district, street_address, accreditation_status
     from employers where id = any($1::uuid[]) order by company_name`,
  [ids],
)).rows;
const notApproved = employers.filter((e) => e.accreditation_status !== 'approved');
console.log(`  approved ${employers.length - notApproved.length}/${employers.length} employers${notApproved.length ? ` (${notApproved.length} NOT approved)` : ''}`);

// ------------------------------------------------------------- build jobs
const tradeOf = (e) => (e.industry || '').toLowerCase().replace(/\b\w/g, (c) => c);
const jobs = [];
for (const e of employers) {
  const trade = tradeOf(e);
  const titles = TITLES[trade] || ['Staff'];
  const tags = TAGS[trade] || ['customer service'];
  for (let k = 0; k < PER_EMPLOYER; k++) {
    const n = e.company_name.length + k + e.barangay_district.length;
    const title = pick(titles, n + k);
    const salary = 12000 + ((n * 3 + k * 7) % 10) * 1500;
    jobs.push({
      employer: e,
      token: signedIn.find((a) => a.userId === e.id).token,
      payload: {
        title,
        office: e.company_name,
        location: `${e.barangay_district}, Santa Maria, La Union`,
        employment_type: pick(TYPES, n + k),
        work_arrangement: pick(ARRANGEMENTS, n + k),
        salary_min: salary,
        salary_max: salary + 6000,
        description: `${e.company_name} in ${e.barangay_district} is looking for a ${title}. Join our local team serving the Santa Maria community.`,
        requirements: `${pick(['At least 1 year', 'At least 2 years', 'Fresh graduates welcome', 'At least 6 months'])} of relevant experience; ${pick(['good communication skills', 'attention to detail', 'willingness to learn', 'team player'])}; willing to work in ${e.barangay_district}.`,
        benefits: 'SSS, PhilHealth, Pag-IBIG, 13th month pay, meal allowance',
        vacancies: 1 + ((n + k) % 3),
        deadline: pick(DEADLINES, n + k),
        instructions: 'Apply through JobLinked with your updated resume.',
        tags: [pick(tags, k), ...(n % 3 === 0 ? ['customer service'] : []), ...(n % 5 === 0 ? [tags[0]] : [])].filter((v, i, a) => a.indexOf(v) === i),
        status: 'published',
      },
      status: 0,
      id: null,
      error: null,
      durationMs: 0,
    });
  }
}
console.log(`Phase 3/3 firing ${jobs.length} concurrent job posts...`);
const runStart = new Date();
const wallStart = performance.now();
await pooled(jobs, async (job) => {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API}/api/jobs`, {
      method: 'POST',
      headers: { authorization: `Bearer ${job.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(job.payload),
    });
    job.status = res.status;
    const body = await res.json().catch(() => ({}));
    if (res.ok) job.id = body.id;
    else job.error = `${res.status} ${body?.error?.code || ''} ${body?.error?.message || ''}`.trim();
  } catch (e) {
    job.status = -1;
    job.error = String(e.message || e);
  }
  job.durationMs = performance.now() - t0;
}, jobs.length);
const wallMs = performance.now() - wallStart;

// --------------------------------------------------------- verification
await sleep(2500);
const created = jobs.filter((j) => j.status === 201 && j.id).map((j) => j.id);
const verify = {};
if (created.length) {
  const r = await db.query(
    `select count(*)::int as jobs,
            count(*) filter (where status = 'published')::int as published,
            count(*) filter (where published_at is not null)::int as stamped,
            count(distinct company_id)::int as companies
     from job_vacancies where id = any($1::uuid[])`,
    [created],
  );
  verify.jobs = r.rows[0];
  const hist = await db.query(`select count(*)::int as n from job_status_history where job_id = any($1::uuid[])`, [created]);
  verify.history = hist.rows[0].n;
  const audit = await db.query(`select count(*)::int as n from audit_logs where action = 'job.create' and created_at >= $1`, [runStart]);
  verify.audit = audit.rows[0].n;
  const perCompany = await db.query(
    `select e.company_name, count(*)::int as jobs from job_vacancies j
     join employers e on e.id = j.company_id
     where j.id = any($1::uuid[]) group by e.company_name order by jobs desc`,
    [created],
  );
  verify.perCompany = perCompany.rows;
}
await db.end();

const durations = jobs.map((j) => j.durationMs);
const sorted = [...durations].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] || 0;
const statusCounts = {};
for (const j of jobs) statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;

const summary = {
  started: new Date().toISOString(),
  requests: jobs.length,
  employers: employers.length,
  statusCounts,
  wallSeconds: Number((wallMs / 1000).toFixed(2)),
  throughputPerSec: Number((jobs.length / (wallMs / 1000)).toFixed(1)),
  latency: { p50: Number(pct(50).toFixed(0)), p95: Number(pct(95).toFixed(0)), p99: Number(pct(99).toFixed(0)), max: Number((sorted.at(-1) || 0).toFixed(0)) },
  verification: verify,
  failures: jobs.filter((j) => j.status !== 201).slice(0, 8).map((j) => ({ company: j.employer.company_name, title: j.payload.title, error: j.error })),
};

console.log('\n=== JOB POSTING SPIKE ===');
console.log(`requests            ${summary.requests} from ${summary.employers} employers`);
console.log(`status counts       ${JSON.stringify(statusCounts)}`);
console.log(`wall time           ${summary.wallSeconds}s (${summary.throughputPerSec} req/s)`);
console.log(`latency             p50 ${summary.latency.p50}ms  p95 ${summary.latency.p95}ms  p99 ${summary.latency.p99}ms  max ${summary.latency.max}ms`);
if (verify.jobs) {
  console.log(`db rows             ${verify.jobs.jobs} jobs (published ${verify.jobs.published}, published_at ${verify.jobs.stamped}, companies ${verify.jobs.companies})`);
  console.log(`history / audit     ${verify.history} / ${verify.audit}`);
  console.log('per company         ' + verify.perCompany.map((r) => `${r.company_name} (${r.jobs})`).join(', '));
}
if (summary.failures.length) {
  console.log('\nfailures:');
  for (const f of summary.failures) console.log(`  ${f.error}  [${f.company} / ${f.title}]`);
}
writeFileSync(new URL('../.jobs-spike-result.local.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log('\nresult: server/.jobs-spike-result.local.json');
process.exit(Object.keys(statusCounts).some((s) => s !== '201') ? 1 : 0);
