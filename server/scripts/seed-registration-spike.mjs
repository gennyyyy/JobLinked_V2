#!/usr/bin/env node
// Registration-spike simulation: 100 job seekers + 50 employers registering at once.
//
//   node scripts/seed-registration-spike.mjs                # 100 seekers + 50 employers, all at once
//   node scripts/seed-registration-spike.mjs --seekers 20 --employers 10
//   node scripts/seed-registration-spike.mjs --resume       # retry throttled/failed provisions only
//
// Phases:
//   1. create the accounts (Supabase admin API; the anon /signup endpoint 429s at
//      ~3 requests/min because the project still runs the built-in SMTP limiter)
//   2. concurrently sign each account in (real /token path) -> access tokens
//   3. fire one POST /api/auth/provision per account, all at once (the app's real
//      registration backend step), 100 job-seeker + 50 employer payloads
//   4. verify Postgres rows, then print latency/status tables
//
// State lives in .registration-spike-state.local.json so --resume can finish
// accounts the IP rate limiter throttled (restart the API to clear its buckets).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// ---------------------------------------------------------------- env + args
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* not run from server/ */ }
// The anon key lives in the frontend env (repo root); the server env keeps only
// the service role. Read it so phase 2 exercises the same /token path browsers do.
try {
  for (const line of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(line);
    if (m && m[1] === 'VITE_SUPABASE_ANON_KEY' && !process.env.SUPABASE_ANON_KEY) {
      process.env.SUPABASE_ANON_KEY = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch { /* no root env available */ }

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const num = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  const v = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : d;
};
const API = `http://127.0.0.1:${process.env.PORT || 4000}`;
const SEEKERS = num('seekers', 100);
const EMPLOYERS = num('employers', 50);
const STATE_FILE = new URL('../.registration-spike-state.local.json', import.meta.url);

const supaAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// The anon client is what the browser uses; sign-in goes through the same /token path.
const supaAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ------------------------------------------------------------- identity data
const FIRST = ['maria', 'jose', 'ana', 'carlo', 'liza', 'mark', 'jenny', 'paolo', 'grace', 'daniel',
  'kristine', 'miguel', 'angelica', 'rafael', 'nicole', 'antonio', 'sophia', 'gabriel', 'isabel', 'francis',
  'carmela', 'reynaldo', 'bea', 'joel', 'trisha', 'arnel', 'mica', 'dennis', 'joy', 'eduardo'];
const MIDDLE = ['santos', 'reyes', 'cruz', 'bautista', 'garcia', 'mendoza', 'delacruz', 'ramos', 'aquino', 'villanueva',
  'castillo', 'navarro', 'domingo', 'salazar', 'pascual', 'fernandez', 'flores', 'rivera', 'gonzales', 'mercado',
  'lim', 'tan', 'chua', 'ortiz', 'vasquez', 'padilla', 'serrano', 'valdez', 'ignacio', 'corpuz'];
const LAST = ['santos', 'reyes', 'cruz', 'bautista', 'garcia', 'mendoza', 'dela cruz', 'ramos', 'aquino', 'villanueva',
  'castillo', 'navarro', 'domingo', 'salazar', 'pascual', 'fernandez', 'flores', 'rivera', 'gonzales', 'mercado',
  'lim', 'tan', 'chua', 'ortiz', 'vasquez', 'padilla', 'serrano', 'valdez', 'ignacio', 'corpuz'];
const BARANGAYS = ['Poblacion', 'San Jose', 'San Juan', 'San Antonio', 'Santo Tomas', 'San Fernando',
  'Santo Rosario', 'San Isidro', 'San Pedro', 'Santa Cruz'];
const STREETS = ['Rizal Street', 'Quirino Boulevard', 'Del Pilar Street', 'Magsaysay Street', 'Bonifacio Street',
  'Luna Street', 'Aguinaldo Street', 'Plaza Avenue', 'National Highway', 'Coastal Road'];
const SCHOOLS = ['Santa Maria National High School', 'Don Mariano Marcos State University', 'La Union Colleges',
  'Northern Philippines College', 'University of Northern Philippines', 'Ilocos Sur Polytechnic College'];
const EDUCATION = ['High School', 'Senior High School', 'Vocational', 'College', 'Postgraduate'];
const SKILLS = ['customer service', 'cooking', 'inventory', 'driving', 'excel', 'teaching', 'nursing', 'welding',
  'programming', 'sales', 'cashiering', 'warehouse', 'electrical', 'plumbing', 'agriculture', 'bookkeeping',
  'social media', 'photo editing', 'delivery', 'security'];
const STATUSES = ['Employed', 'Unemployed', 'Underemployed', 'Fresh Graduate', 'Student'];
const PREFIXES = ['north star', 'golden harvest', 'santa maria', 'union', 'blue ridge', 'green fields', 'sunrise',
  'mabini', 'rizal', 'poblacion', 'ilocos', 'la union', 'cordillera', 'bright', 'metro', 'pacific', 'mango tree',
  'riverside', 'highland', 'coastal', 'summit', 'harvest', 'town center', 'plaza', 'bayview'];
const TRADES = ['trading', 'construction', 'foods', 'logistics', 'medical services', 'tutorial center',
  'security services', 'agri supply', 'motor parts', 'water refilling', 'bakeshop', 'hardware', 'pharmacy',
  'printing press', 'auto repair', 'laundry services', 'event rentals', 'furniture', 'poultry farm', 'travel agency'];
const POSITIONS = ['hr officer', 'operations manager', 'store supervisor', 'branch manager', 'administrative officer',
  'hr coordinator', 'owner', 'general manager'];

const pad = (n, w = 3) => String(n).padStart(w, '0');
const pick = (arr, i) => arr[i % arr.length];
const brgy = (i) => pick(BARANGAYS, i);

function seekerIdentity(i) {
  const first = pick(FIRST, i);
  const middle = pick(MIDDLE, i * 7 + 3);
  const last = pick(LAST, Math.floor(i / FIRST.length) * 5 + 2);
  return {
    index: i,
    role: 'job-seeker',
    email: `spike.seeker.${pad(i + 1)}@joblinked-spike.test`,
    password: `Spike!Seek${100 + i}!`,
    payload: {
      role: 'job-seeker',
      email: `spike.seeker.${pad(i + 1)}@joblinked-spike.test`,
      first_name: first,
      middle_name: middle,
      last_name: last,
      phone: `09${pad(170000000 + i * 7919, 9).slice(-9)}`,
      birthdate: `19${85 + (i % 19)}-${pad(1 + (i % 12), 2)}-${pad(1 + (i % 27), 2)}`,
      house_number_unit: `${1 + (i % 250)}`,
      street_address: pick(STREETS, i * 3 + 1),
      barangay_district: brgy(i),
      city_municipality: 'Santa Maria',
      province_state: 'La Union',
      postal_code: '2911',
      country: 'Philippines',
      employment_status: pick(STATUSES, i),
      skills: [pick(SKILLS, i * 3), pick(SKILLS, i * 5 + 1), pick(SKILLS, i * 7 + 2), pick(SKILLS, i * 11 + 3)].filter((v, k, a) => a.indexOf(v) === k),
      education: {
        level: pick(EDUCATION, i),
        school: pick(SCHOOLS, i * 5 + 2),
        end_year: 2010 + (i % 16),
      },
    },
  };
}

function employerIdentity(i) {
  const prefix = pick(PREFIXES, i);
  // Unique (prefix, trade) pairs across the 50-account cohort: prefix cycles
  // every 25, trade advances by 7 mod 20. (Earlier formulas either collided or
  // collapsed every company into two industries — both caught by DB checks.)
  const trade = pick(TRADES, (i * 7) % TRADES.length);
  const company = `${prefix} ${trade}`;
  const first = pick(FIRST, i * 3 + 1);
  const last = pick(LAST, i * 7 + 4);
  return {
    index: i,
    role: 'employer',
    email: `spike.employer.${pad(i + 1)}@joblinked-spike.test`,
    password: `Spike!Emp${200 + i}!`,
    payload: {
      role: 'employer',
      email: `spike.employer.${pad(i + 1)}@joblinked-spike.test`,
      first_name: first,
      middle_name: pick(MIDDLE, i * 5 + 1),
      last_name: last,
      phone: `09${pad(180000000 + i * 6151, 9).slice(-9)}`,
      company_name: company,
      company_email: `spike.employer.${pad(i + 1)}@joblinked-spike.test`,
      industry: trade.replace(/\b\w/g, (c) => c.toUpperCase()),
      house_number_unit: `${1 + (i % 120)}`,
      street_address: pick(STREETS, i * 2 + 3),
      barangay_district: brgy(i * 2),
      city_municipality: 'Santa Maria',
      province_state: 'La Union',
      postal_code: '2911',
      country: 'Philippines',
      representative_email: `spike.employer.${pad(i + 1)}@joblinked-spike.test`,
      representative_position: pick(POSITIONS, i),
    },
  };
}

// --------------------------------------------------------------- spike state
function loadState() {
  if (!existsSync(STATE_FILE)) return { accounts: [] };
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}
function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const identities = [
  ...Array.from({ length: SEEKERS }, (_, i) => seekerIdentity(i)),
  ...Array.from({ length: EMPLOYERS }, (_, i) => employerIdentity(i)),
];

// ----------------------------------------------------------------- phases
async function createAccounts(accounts) {
  const results = await Promise.allSettled(accounts.map(async (account) => {
    if (account.userId) return account; // resume: already created
    const { data, error } = await supaAdmin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    });
    if (error && !/already registered/i.test(error.message)) throw new Error(`createUser ${account.email}: ${error.message}`);
    account.userId = data?.user?.id || account.userId;
    if (!account.userId) {
      const { data: list } = await supaAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      account.userId = list?.users?.find((u) => u.email === account.email)?.id;
    }
    return account;
  }));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) for (const f of failed.slice(0, 5)) console.log(`  create fail: ${f.reason}`);
  return accounts.filter((a) => a.userId);
}

async function signIn(account) {
  if (account.token) return account;
  const { data, error } = await supaAnon.auth.signInWithPassword({ email: account.email, password: account.password });
  if (!error && data.session) { account.token = data.session.access_token; return account; }
  // Fallback: admin magic-link mint (same path the load harness uses).
  const { data: link, error: linkError } = await supaAdmin.auth.admin.generateLink({ type: 'magiclink', email: account.email });
  if (linkError) throw new Error(`signIn ${account.email}: ${error?.message || linkError.message}`);
  const { data: otp, error: otpError } = await supaAdmin.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (otpError) throw new Error(`verifyOtp ${account.email}: ${otpError.message}`);
  account.token = otp.session.access_token;
  return account;
}

async function provision(account) {
  if (account.provisioned) return account;
  const t0 = performance.now();
  try {
    const res = await fetch(`${API}/api/auth/provision`, {
      method: 'POST',
      headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(account.payload),
    });
    account.status = res.status;
    const body = await res.json().catch(() => ({}));
    account.provisioned = res.ok;
    if (!res.ok) account.error = `${res.status} ${body?.error?.code || ''} ${body?.error?.message || ''}`.trim();
  } catch (e) {
    account.status = -1;
    account.error = String(e.message || e);
  }
  account.durationMs = performance.now() - t0;
  return account;
}

async function pooled(items, worker, concurrency) {
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, run));
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const CONCURRENCY = Math.max(1, num('concurrency', identities.length));

if (flag('resume')) {
  const state = loadState();
  const pending = state.accounts.filter((a) => !a.provisioned && a.userId);
  if (!pending.length) { console.log('resume: nothing pending'); process.exit(0); }
  console.log(`resume: ${pending.length} accounts still need a token; retrying in paced rounds`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let round = 1; round <= 8; round++) {
    const todo = pending.filter((a) => !a.token);
    if (!todo.length) break;
    await pooled(todo, async (a) => {
      try { await signIn(a); } catch (e) { a.error = String(e.message || e); }
    }, Math.min(5, todo.length));
    saveState(state);
    const have = pending.filter((a) => a.token).length;
    console.log(`  round ${round}: tokens ${have}/${pending.length}`);
    if (!todo.length) break;
    if (pending.some((a) => !a.token)) await sleep(45000);
  }
  const withTokens = pending.filter((a) => a.token);
  console.log(`resume: provisioning ${withTokens.length} accounts`);
  await pooled(withTokens, provision, CONCURRENCY);
  saveState(state);
  const ok = state.accounts.filter((a) => a.provisioned).length;
  console.log(`resume: provisioned total ${ok}/${state.accounts.length}`);
  process.exit(state.accounts.filter((a) => a.userId).every((a) => a.provisioned) ? 0 : 1);
}

const state = { started: new Date().toISOString(), accounts: [] };
const t0 = performance.now();
const accounts = identities.map((identity) => ({ ...identity, provisioned: false, status: 0, token: null, userId: null, error: null }));
state.accounts = accounts;

console.log(`Phase 1/3 creating ${accounts.length} accounts (${SEEKERS} seekers + ${EMPLOYERS} employers)...`);
await createAccounts(accounts);
saveState(state);
console.log(`  created ${accounts.filter((a) => a.userId).length}/${accounts.length}`);

console.log('Phase 2/3 signing in...');
const signErrors = [];
await pooled(accounts.filter((a) => a.userId), async (a) => {
  try { await signIn(a); } catch (e) { signErrors.push(`${a.email}: ${e.message}`); }
}, Math.min(CONCURRENCY, 25));
console.log(`  signed in ${accounts.filter((a) => a.token).length}/${accounts.length}${signErrors.length ? ` (${signErrors.length} errors, first: ${signErrors[0]})` : ''}`);
if (signErrors.length > 3) console.log(`  sign-in errors sample: ${signErrors.slice(0, 3).join(' | ')}`);

console.log(`Phase 3/3 firing ${accounts.length} concurrent provision requests...`);
const runStart = new Date();
const wallStart = performance.now();
await pooled(accounts.filter((a) => a.token), provision, CONCURRENCY);
const wallMs = performance.now() - wallStart;
saveState(state);

const statusCounts = {};
for (const a of accounts) statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
const ok = accounts.filter((a) => a.provisioned);
const durations = accounts.filter((a) => a.status > 0).map((a) => a.durationMs);

console.log('\n=== REGISTRATION SPIKE ===');
console.log(`accounts            ${accounts.length} (${SEEKERS} seekers + ${EMPLOYERS} employers)`);
console.log(`phase1 created      ${accounts.filter((a) => a.userId).length}`);
console.log(`phase2 signed in    ${accounts.filter((a) => a.token).length}`);
console.log(`provision statuses  ${JSON.stringify(statusCounts)}`);
console.log(`provision wall      ${(wallMs / 1000).toFixed(2)}s (${(accounts.length / (wallMs / 1000)).toFixed(1)} req/s)`);
console.log(`latency             p50 ${pct(durations, 50).toFixed(0)}ms  p95 ${pct(durations, 95).toFixed(0)}ms  max ${(durations.length ? Math.max(...durations) : 0).toFixed(0)}ms`);
const failures = accounts.filter((a) => !a.provisioned);
if (failures.length) {
  console.log(`failures            ${failures.length} (run with --resume after restarting the API to clear the IP limiter)`);
  for (const f of failures.slice(0, 5)) console.log(`  ${f.email}: ${f.error}`);
}

// -------------------------------------------------------------- verification
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
await new Promise((r) => setTimeout(r, 1500));
const ids = accounts.filter((a) => a.userId).map((a) => a.userId);
const verify = (await db.query(
  `select
     (select count(*)::int from job_seekers where id = any($1::uuid[])) as seekers,
     (select count(*)::int from employers where id = any($1::uuid[])) as employers,
     (select count(*)::int from employer_accreditations ea where ea.company_id = any($1::uuid[]) and ea.status = 'pending') as pending_accreditations,
     (select count(*)::int from job_seekers where id = any($1::uuid[]) and full_name is not null and full_name <> '') as seekers_named,
     (select count(distinct email)::int from job_seekers where id = any($1::uuid[])) as seeker_emails,
     (select count(distinct company_name)::int from employers where id = any($1::uuid[])) as unique_companies`,
  [ids],
)).rows[0];
console.log('\n=== DB VERIFICATION ===');
console.log(`job_seekers rows    ${verify.seekers} / ${SEEKERS}`);
console.log(`employers rows      ${verify.employers} / ${EMPLOYERS}`);
console.log(`pending accred.     ${verify.pending_accreditations} / ${EMPLOYERS}`);
console.log(`unique names        seekers named ${verify.seekers_named}, unique emails ${verify.seeker_emails}, unique companies ${verify.unique_companies}`);
await db.end();

console.log('\nstate: server/.registration-spike-state.local.json');
process.exit(failures.length ? 1 : 0);
