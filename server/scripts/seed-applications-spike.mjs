#!/usr/bin/env node
// Application spike: 100 job seekers apply to the SAME job simultaneously.
//
//   node scripts/seed-applications-spike.mjs
//
// Uses the 100 registration-spike seekers (spike.seeker.001..100@joblinked-spike.test).
// Phases:
//   1. sign in the 100 seekers (real /token path; paced when Supabase throttles)
//   2. pick the newest published job with a future deadline as the target
//   3. fire 100 concurrent POST /api/applications for that one job
//   4. race probe: one seeker fires two simultaneous applications to a second job
//      (the unique(job_id, seeker_id) constraint must yield exactly one 201 + one 409)
//   5. verify rows / notifications / audit in Postgres, print the latency table
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// ---------------------------------------------------------------- env
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

const API = `http://127.0.0.1:${process.env.PORT || 4000}`;
const pad = (n) => String(n).padStart(3, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const supaAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const seekers = Array.from({ length: 100 }, (_, i) => ({
  index: i,
  email: `spike.seeker.${pad(i + 1)}@joblinked-spike.test`,
  password: `Spike!Seek${100 + i}!`,
  token: null,
  userId: null,
}));
// Cache tokens so a rerun does not pay the Supabase per-IP sign-in throttle again.
const TOKEN_STATE = new URL('../.applications-spike-state.local.json', import.meta.url);
try {
  const cached = JSON.parse(readFileSync(TOKEN_STATE, 'utf8'));
  for (const s of seekers) {
    const hit = cached.seekers?.find((c) => c.email === s.email);
    if (hit?.token && hit?.userId) { s.token = hit.token; s.userId = hit.userId; }
  }
} catch { /* no cache */ }
const saveTokens = () => writeFileSync(TOKEN_STATE, JSON.stringify({ savedAt: new Date().toISOString(), seekers: seekers.map((s) => ({ email: s.email, token: s.token, userId: s.userId })) }));

const health = async () => {
  try { return (await fetch(`${API}/api/health`)).ok; } catch { return false; }
};
const ensureApi = async () => {
  for (let i = 0; i < 20; i++) {
    if (await health()) return true;
    await sleep(3000);
  }
  return false;
};

const pooled = async (items, worker, concurrency) => {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (cursor < items.length) { await worker(items[cursor++]); }
  }));
};

console.log('Phase 1/4 signing in 100 seekers...');
for (let round = 1; round <= 8; round++) {
  const todo = seekers.filter((s) => !s.token);
  if (!todo.length) break;
  await pooled(todo, async (s) => {
    const { data, error } = await supaAnon.auth.signInWithPassword({ email: s.email, password: s.password });
    if (!error && data.session) { s.token = data.session.access_token; s.userId = data.session.user.id; }
    else s.error = error?.message;
  }, 5);
  const have = seekers.filter((s) => s.token).length;
  console.log(`  round ${round}: signed in ${have}/100`);
  saveTokens();
  if (have < 100) await sleep(45000);
}
const signedIn = seekers.filter((s) => s.token);
if (!(await ensureApi())) { console.log('API is not reachable; aborting'); process.exit(2); }

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const target = (await db.query(
  `select j.id, j.title, e.company_name, j.deadline, j.vacancies
     from job_vacancies j join employers e on e.id = j.company_id
    where j.status = 'published' and (j.deadline is null or j.deadline >= current_date)
    order by j.created_at desc limit 1`,
)).rows[0];
const second = (await db.query(
  `select j.id, j.title, e.company_name from job_vacancies j join employers e on e.id = j.company_id
    where j.status = 'published' and (j.deadline is null or j.deadline >= current_date)
      and j.id <> $1 and j.company_id <> (select company_id from job_vacancies where id = $1)
    order by j.created_at desc limit 1`,
  [target.id],
)).rows[0];
console.log(`Phase 2/4 target job: "${target.title}" at ${target.company_name} (deadline ${target.deadline}, vacancies ${target.vacancies})`);

console.log(`Phase 3/4 firing 100 simultaneous applications...`);
const runStart = new Date();
const applications = signedIn.map((s) => ({ seeker: s, status: 0, id: null, error: null, durationMs: 0 }));
const wallStart = performance.now();
await pooled(applications, async (a) => {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API}/api/applications`, {
      method: 'POST',
      headers: { authorization: `Bearer ${a.seeker.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ job_id: target.id }),
    });
    a.status = res.status;
    const body = await res.json().catch(() => ({}));
    if (res.ok) a.id = body.id;
    else a.error = `${res.status} ${body?.error?.code || ''} ${body?.error?.message || ''}`.trim();
  } catch (e) {
    a.status = -1;
    a.error = String(e.message || e);
  }
  a.durationMs = performance.now() - t0;
}, applications.length);
const wallMs = performance.now() - wallStart;

// --------------------------------------------- duplicate race probe (phase 4)
console.log('Phase 4/4 duplicate-race probe...');
const racer = signedIn[0];
async function applyOnce(jobId) {
  try {
    const res = await fetch(`${API}/api/applications`, {
      method: 'POST',
      headers: { authorization: `Bearer ${racer.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, code: body?.error?.code || null, id: body?.id || null };
  } catch (e) {
    return { status: -1, code: 'NETWORK', id: null, error: String(e.message || e) };
  }
}
const race = await Promise.all([applyOnce(second.id), applyOnce(second.id)]);
const reapply = await applyOnce(target.id); // already applied above => 409

// ------------------------------------------------------------- verification
await sleep(2000);
const verify = {};
if (applications.some((a) => a.status === 201)) {
  const r = await db.query(
    `select count(*)::int as applications, count(distinct seeker_id)::int as seekers,
            count(*) filter (where status = 'Applied')::int as applied_status
       from job_applications where job_id = $1`,
    [target.id],
  );
  verify.applications = r.rows[0];
  const raceRows = await db.query(
    `select count(*)::int as n from job_applications where job_id = $1 and seeker_id = $2`,
    [second.id, racer.userId],
  );
  verify.raceRows = raceRows.rows[0].n;
  const notes = await db.query(
    `select count(*)::int as n from notifications where title = 'New applicant' and created_at >= $1`,
    [runStart],
  );
  verify.employerNotifications = notes.rows[0].n;
  const audit = await db.query(
    `select count(*)::int as n from audit_logs where action = 'application.create' and created_at >= $1`,
    [runStart],
  );
  verify.audit = audit.rows[0].n;
  const history = await db.query(
    `select count(*)::int as n from application_status_history where application_id = any($1::uuid[])`,
    [applications.filter((a) => a.id).map((a) => a.id)],
  );
  verify.statusHistoryRows = history.rows[0].n;
}
await db.end();

const durations = applications.map((a) => a.durationMs).sort((a, b) => a - b);
const pct = (p) => durations[Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))] || 0;
const statusCounts = {};
for (const a of applications) statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;

const summary = {
  started: new Date().toISOString(),
  target,
  second,
  requests: applications.length,
  statusCounts,
  wallSeconds: Number((wallMs / 1000).toFixed(2)),
  throughputPerSec: Number((applications.length / (wallMs / 1000)).toFixed(1)),
  latency: { p50: Number(pct(50).toFixed(0)), p95: Number(pct(95).toFixed(0)), p99: Number(pct(99).toFixed(0)), max: Number((durations.at(-1) || 0).toFixed(0)) },
  raceProbe: { results: race, rowsInDb: verify.raceRows, reapplyStatus: reapply.status },
  verification: verify,
  failures: applications.filter((a) => a.status !== 201).slice(0, 8).map((a) => ({ seeker: a.seeker.email, error: a.error })),
};

console.log('\n=== APPLICATION SPIKE ===');
console.log(`target              "${target.title}" at ${target.company_name}`);
console.log(`requests            ${summary.requests} seekers`);
console.log(`status counts       ${JSON.stringify(statusCounts)}`);
console.log(`wall time           ${summary.wallSeconds}s (${summary.throughputPerSec} req/s)`);
console.log(`latency             p50 ${summary.latency.p50}ms  p95 ${summary.latency.p95}ms  p99 ${summary.latency.p99}ms  max ${summary.latency.max}ms`);
if (verify.applications) {
  console.log(`db rows             ${verify.applications.applications} applications (distinct seekers ${verify.applications.seekers}, status Applied ${verify.applications.applied_status})`);
  console.log(`duplicate race      ${race.map((r) => r.status).join(' + ')} -> ${verify.raceRows} row(s) in DB`);
  console.log(`re-apply afterwards ${reapply.status} (${reapply.code || 'ok'})`);
  console.log(`notifications       ${verify.employerNotifications} "New applicant"`);
  console.log(`audit / history     ${verify.audit} application.create · ${verify.statusHistoryRows} history rows (0 expected: history starts at first status change)`);
}
if (summary.failures.length) {
  console.log('\nfailures:');
  for (const f of summary.failures) console.log(`  ${f.seeker}: ${f.error}`);
}
writeFileSync(new URL('../.applications-spike-result.local.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log('\nresult: server/.applications-spike-result.local.json');
const ok = applications.every((a) => a.status === 201)
  && race.filter((r) => r.status === 201).length === 1
  && reapply.status === 409;
process.exit(ok ? 0 : 1);
