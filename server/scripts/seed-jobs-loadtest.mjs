#!/usr/bin/env node
// Seeds realistic employer accounts and fires N simultaneous job-post requests.
//
//   node scripts/seed-jobs-loadtest.mjs                 # 15 employers, 150 jobs, all at once
//   node scripts/seed-jobs-loadtest.mjs --jobs 60 --employers 6
//   node scripts/seed-jobs-loadtest.mjs --concurrency 30
//
// What it does:
//   1. mints a Supabase session per test employer (email: loadtest.empNN@example.com)
//   2. POST /api/auth/provision (role=employer, realistic company fields)
//   3. approves each company's accreditation row (trigger syncs employers.status)
//   4. fires one POST /api/jobs per job, distributed across employers, all in parallel
//   5. verifies rows/history/audit/notifications in Postgres and prints a report
//
// The seeded data is meant to stay (realistic demo data). Re-running reuses the
// same accounts and ADDS another batch of jobs.
//
// Zero new dependencies: uses pg + @supabase/supabase-js already required by the server.
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

const argv = process.argv.slice(2);
const num = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const API = `http://127.0.0.1:${process.env.PORT || 4000}`;
const JOBS = num('jobs', 150);
const EMPLOYERS = num('employers', 15);
const CONCURRENCY = num('concurrency', JOBS); // default: all at once

// ------------------------------------------------------- realistic companies
const COMPANIES = [
  { name: 'santa maria bakeshop', industry: 'Food & Beverage', barangay: 'Poblacion', street: 'Rizal Street', rep: 'store manager' },
  { name: 'ilocos hardware supply', industry: 'Retail / Construction Supply', barangay: 'Poblacion', street: 'Quirino Boulevard', rep: 'branch supervisor' },
  { name: 'santa maria rural bank', industry: 'Banking & Finance', barangay: 'Poblacion', street: 'Del Pilar Street', rep: 'HR officer' },
  { name: 'cordillera coffee roasters', industry: 'Food & Beverage', barangay: 'San Jose', street: 'National Highway', rep: 'operations lead' },
  { name: 'santa maria medical center', industry: 'Healthcare', barangay: 'Poblacion', street: 'Magsaysay Street', rep: 'HR coordinator' },
  { name: 'la union agri-trading', industry: 'Agriculture / Trading', barangay: 'San Antonio', street: 'Farm-to-Market Road', rep: 'warehouse manager' },
  { name: 'brightspace tutorial center', industry: 'Education', barangay: 'Santo Tomas', street: 'Aguinaldo Street', rep: 'center director' },
  { name: 'santa maria logistics hub', industry: 'Logistics / Transport', barangay: 'San Juan', street: 'Highway Junction', rep: 'fleet supervisor' },
  { name: 'mango tree restaurant', industry: 'Food & Beverage', barangay: 'Poblacion', street: 'Plaza Avenue', rep: 'restaurant manager' },
  { name: 'union coastal resort', industry: 'Hospitality / Tourism', barangay: 'San Fernando', street: 'Coastal Road', rep: 'front office manager' },
  { name: 'santa maria water district', industry: 'Utilities', barangay: 'Poblacion', street: 'Bonifacio Street', rep: 'administrative officer' },
  { name: 'northstar it solutions', industry: 'Information Technology', barangay: 'San Jose', street: 'Tech Park Building', rep: 'HR business partner' },
  { name: 'santa maria security agency', industry: 'Security Services', barangay: 'San Antonio', street: 'Luna Street', rep: 'operations manager' },
  { name: 'greenfields poultry farm', industry: 'Agriculture', barangay: 'Santo Rosario', street: 'Farm Road', rep: 'farm supervisor' },
  { name: 'santa maria builders corp', industry: 'Construction', barangay: 'San Juan', street: 'Industrial Drive', rep: 'project coordinator' },
];

const TITLES = {
  'Food & Beverage': ['Barista', 'Kitchen Staff', 'Service Crew', 'Cashier', 'Pastry Assistant', 'Branch Supervisor'],
  'Retail / Construction Supply': ['Sales Associate', 'Inventory Clerk', 'Cashier', 'Delivery Helper', 'Warehouse Staff', 'Store Supervisor'],
  'Banking & Finance': ['Bank Teller', 'Loans Assistant', 'Customer Service Officer', 'Accounting Staff', 'Branch Operations Clerk'],
  'Healthcare': ['Staff Nurse', 'Nursing Aide', 'Medical Records Clerk', 'Pharmacy Assistant', 'Front Desk Officer', 'Laboratory Assistant'],
  'Agriculture / Trading': ['Farm Hand', 'Harvest Supervisor', 'Warehouse Checker', 'Delivery Driver', 'Sales Coordinator'],
  'Education': ['Tutor', 'Front Desk Assistant', 'Academic Coordinator', 'Teaching Aide'],
  'Logistics / Transport': ['Delivery Driver', 'Dispatcher', 'Warehouse Associate', 'Logistics Coordinator', 'Truck Helper'],
  'Hospitality / Tourism': ['Front Desk Attendant', 'Housekeeping Staff', 'Food Server', 'Reservations Assistant', 'Maintenance Staff'],
  'Utilities': ['Meter Reader', 'Administrative Staff', 'Field Technician', 'Customer Service Assistant'],
  'Information Technology': ['IT Support Specialist', 'Web Developer', 'Data Entry Specialist', 'Network Technician', 'QA Assistant'],
  'Security Services': ['Security Guard', 'Shift Supervisor', 'Control Room Operator', 'Security Aide'],
  'Agriculture': ['Farm Worker', 'Poultry Caretaker', 'Quality Checker', 'Delivery Driver'],
  'Construction': ['Construction Worker', 'Site Engineer', 'Safety Officer', 'Warehouse Custodian', 'Project Assistant'],
};
const ARRANGEMENTS = ['On-site', 'On-site', 'On-site', 'Hybrid', 'Remote / Work from home'];
const TYPES = ['Full-time', 'Full-time', 'Full-time', 'Part-time', 'Contractual', 'Project-based'];
const TAG_POOL = ['customer service', 'cooking', 'inventory', 'driving', 'excel', 'teaching', 'nursing', 'welding', 'programming', 'sales'];
const DEADLINES = ['2026-12-15', '2026-12-31', '2027-01-15', '2027-01-31', '2027-02-15'];

const pick = (arr, i) => arr[i % arr.length];
const emailFor = (i) => `loadtest.emp${String(i + 1).padStart(2, '0')}@example.com`;

// ---------------------------------------------------------------- token mint
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function mintToken(email) {
  const linkFor = async () => {
    const { data, error } = await supa.auth.admin.generateLink({ type: 'magiclink', email });
    if (error) throw new Error(`generateLink ${email}: ${error.message}`);
    return data;
  };
  let link = await linkFor();
  if (link.user && !link.user.email_confirmed_at) {
    const { error } = await supa.auth.admin.updateUserById(link.user.id, { email_confirm: true });
    if (error) throw new Error(`confirm ${email}: ${error.message}`);
    link = await linkFor();
  }
  const { data, error } = await supa.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (error) throw new Error(`verifyOtp ${email}: ${error.message}`);
  return { token: data.session.access_token, userId: data.session.user.id };
}

// --------------------------------------------------------- provision employer
async function provisionEmployer(company, token, email) {
  const payload = {
    role: 'employer',
    email,
    first_name: 'Ana',
    last_name: 'Reyes',
    phone: '09171234567',
    company_name: company.name,
    company_email: email,
    industry: company.industry,
    house_number_unit: '123',
    street_address: company.street,
    barangay_district: company.barangay,
    city_municipality: 'Santa Maria',
    province_state: 'La Union',
    postal_code: '2911',
    country: 'Philippines',
    representative_email: email,
    representative_position: company.rep,
  };
  const res = await fetch(`${API}/api/auth/provision`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok || res.status === 409 || /already provisioned/i.test(body?.error?.message || '')) return;
  throw new Error(`provision ${company.name}: ${res.status} ${body?.error?.message || ''}`);
}

// ------------------------------------------------------------------ job body
function jobPayload(company, companyIndex, jobIndex) {
  const titles = TITLES[company.industry] || ['Staff'];
  const title = pick(titles, jobIndex);
  const tags = [pick(TAG_POOL, companyIndex + jobIndex), pick(TAG_POOL, companyIndex * 3 + jobIndex + 2)];
  const salary = 12000 + ((companyIndex * 7 + jobIndex * 13) % 12) * 1500;
  return {
    title,
    office: company.name,
    location: `${company.barangay}, Santa Maria, La Union`,
    employment_type: pick(TYPES, companyIndex + jobIndex),
    work_arrangement: pick(ARRANGEMENTS, companyIndex + jobIndex),
    salary_min: salary,
    salary_max: salary + 6000,
    description: `${company.name} is hiring a ${title} for its ${company.barangay} branch. Join a local team serving the Santa Maria community.`,
    requirements: `${pick(['At least 1 year', 'At least 2 years', 'Fresh graduates welcome', 'At least 6 months'])} of relevant experience; ${pick(['good communication skills', 'attention to detail', 'willingness to learn', 'team player'])}; amenable to ${pick(['shifting schedules', 'weekend duty', 'branch assignment'])}.`,
    benefits: 'SSS, PhilHealth, Pag-IBIG, 13th month pay, meal allowance',
    vacancies: 1 + ((companyIndex + jobIndex) % 4),
    deadline: pick(DEADLINES, companyIndex + jobIndex),
    instructions: 'Submit your application through JobLinked and attach your updated resume.',
    tags,
    status: 'published',
  };
}

// ------------------------------------------------------------------ main flow
const summary = { started: new Date().toISOString() };
console.log(`Seeding ${EMPLOYERS} employers and posting ${JOBS} jobs (concurrency ${Math.min(CONCURRENCY, JOBS)})...`);

const accounts = [];
for (let i = 0; i < EMPLOYERS; i++) {
  const email = emailFor(i);
  const company = pick(COMPANIES, i);
  const { token, userId } = await mintToken(email);
  await provisionEmployer(company, token, email);
  accounts.push({ index: i, email, company, token, userId });
  process.stdout.write(`  employer ${i + 1}/${EMPLOYERS}: ${company.name}\n`);
}

// Approve accreditation: the trigger mirrors employer_accreditations -> employers.
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const ids = accounts.map((a) => a.userId);
await db.query(
  `insert into employer_accreditations (company_id, status)
   select x::uuid, 'approved' from unnest($1::uuid[]) x
   where not exists (select 1 from employer_accreditations ea where ea.company_id = x)`,
  [ids],
);
await db.query(
  `update employer_accreditations set status = 'approved' where company_id = any($1::uuid[])`,
  [ids],
);
const approved = await db.query(
  `select id, accreditation_status from employers where id = any($1::uuid[])`,
  [ids],
);
const notApproved = approved.rows.filter((r) => r.accreditation_status !== 'approved');
if (notApproved.length) throw new Error(`accreditation not approved for ${notApproved.length} employers`);
console.log(`  accreditation approved for ${approved.rowCount} employers`);

// Distributions: front-load 8-12 per company so the total equals JOBS.
const base = Math.floor(JOBS / EMPLOYERS);
const extra = JOBS % EMPLOYERS;
const plan = accounts.map((a, i) => ({ account: a, count: base + (i < extra ? 1 : 0) }));

const requests = [];
for (const { account, count } of plan) {
  for (let j = 0; j < count; j++) {
    requests.push({
      account,
      payload: jobPayload(account.company, account.index, j),
      startedAt: 0,
      durationMs: 0,
      status: 0,
      id: null,
      error: null,
    });
  }
}

// Fire with a bounded pool of in-flight requests (default = all at once).
async function fire(req) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API}/api/jobs`, {
      method: 'POST',
      headers: { authorization: `Bearer ${req.account.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(req.payload),
    });
    req.status = res.status;
    const body = await res.json().catch(() => ({}));
    if (res.ok) req.id = body.id;
    else req.error = `${res.status} ${body?.error?.code || ''} ${body?.error?.message || ''}`.trim();
  } catch (e) {
    req.status = -1;
    req.error = String(e.message || e);
  }
  req.durationMs = performance.now() - t0;
}

const runStart = new Date();
const wallStart = performance.now();
let cursor = 0;
const workers = Array.from({ length: Math.min(CONCURRENCY, requests.length) }, async () => {
  while (cursor < requests.length) {
    const req = requests[cursor++];
    await fire(req);
  }
});
await Promise.all(workers);
const wallMs = performance.now() - wallStart;

// Give fire-and-forget audit/notification writes a moment to land.
await new Promise((r) => setTimeout(r, 2500));

// ---------------------------------------------------------------- verification
const createdIds = requests.filter((r) => r.status === 201 && r.id).map((r) => r.id);
const verify = {};
if (createdIds.length) {
  const rows = await db.query(
    `select count(*)::int as jobs,
            count(*) filter (where status = 'published')::int as published,
            count(*) filter (where published_at is not null)::int as stamped,
            count(distinct company_id)::int as companies
     from job_vacancies where id = any($1::uuid[])`,
    [createdIds],
  );
  verify.jobs = rows.rows[0];
  const hist = await db.query(
    `select count(*)::int as n from job_status_history where job_id = any($1::uuid[]) and status = 'published'`,
    [createdIds],
  );
  verify.historyRows = hist.rows[0].n;
  const audit = await db.query(
    `select count(*)::int as n from audit_logs
     where action = 'job.create' and created_at >= $1`,
    [runStart],
  );
  verify.auditRows = audit.rows[0].n;
  const notes = await db.query(
    `select count(*)::int as n from notifications
     where title = 'New job for you' and created_at >= $1`,
    [runStart],
  );
  verify.matchingNotifications = notes.rows[0].n;
  const perCompany = await db.query(
    `select e.company_name, count(*)::int as jobs
     from job_vacancies j join employers e on e.id = j.company_id
     where j.id = any($1::uuid[]) group by e.company_name order by jobs desc`,
    [createdIds],
  );
  verify.perCompany = perCompany.rows;
}

await db.end();

// --------------------------------------------------------------------- report
const durations = requests.map((r) => r.durationMs).sort((a, b) => a - b);
const pct = (p) => durations[Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))] || 0;
const statusCounts = {};
for (const r of requests) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
const failures = requests.filter((r) => r.status !== 201);
const successDurations = requests.filter((r) => r.status === 201).map((r) => r.durationMs).sort((a, b) => a - b);
const spct = (p) => successDurations[Math.min(successDurations.length - 1, Math.floor((p / 100) * successDurations.length))] || 0;

summary.requests = requests.length;
summary.statusCounts = statusCounts;
summary.wallSeconds = Number((wallMs / 1000).toFixed(2));
summary.throughputPerSec = Number((requests.length / (wallMs / 1000)).toFixed(1));
summary.latency = { p50: Number(pct(50).toFixed(1)), p95: Number(pct(95).toFixed(1)), p99: Number(pct(99).toFixed(1)), max: Number((durations.at(-1) || 0).toFixed(1)) };
summary.successLatency = { p50: Number(spct(50).toFixed(1)), p95: Number(spct(95).toFixed(1)), max: Number((successDurations.at(-1) || 0).toFixed(1)) };
summary.verification = verify;
summary.failures = failures.slice(0, 8).map((r) => ({ company: r.account.company.name, title: r.payload.title, error: r.error }));

console.log('\n=== JOB POSTING CONCURRENCY TEST ===');
console.log(`requests           ${summary.requests}`);
console.log(`status counts      ${JSON.stringify(statusCounts)}`);
console.log(`wall time          ${summary.wallSeconds}s  (${summary.throughputPerSec} req/s)`);
console.log(`latency all        p50 ${summary.latency.p50}ms  p95 ${summary.latency.p95}ms  p99 ${summary.latency.p99}ms  max ${summary.latency.max}ms`);
console.log(`latency 201-only   p50 ${summary.successLatency.p50}ms  p95 ${summary.successLatency.p95}ms  max ${summary.successLatency.max}ms`);
if (verify.jobs) {
  console.log(`db jobs created    ${verify.jobs.jobs} (published ${verify.jobs.published}, published_at set ${verify.jobs.stamped}, companies ${verify.jobs.companies})`);
  console.log(`status history     ${verify.historyRows} published rows`);
  console.log(`audit job.create   ${verify.auditRows}`);
  console.log(`seeker notifs      ${verify.matchingNotifications} ("New job for you")`);
  console.log('per company        ' + verify.perCompany.map((r) => `${r.company_name} (${r.jobs})`).join(', '));
}
if (summary.failures.length) {
  console.log('\nfirst failures:');
  for (const f of summary.failures) console.log(`  ${f.error}  [${f.company} / ${f.title}]`);
}
writeFileSync(new URL('../.jobs-loadtest-result.local.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log('\nfull result: server/.jobs-loadtest-result.local.json');
process.exit(Object.keys(statusCounts).some((s) => s !== '201') ? 1 : 0);
