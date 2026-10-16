#!/usr/bin/env node
// Zero-dependency load harness for the JobLinked Express API.
// Built-in fetch + a hand-rolled concurrency pool. No new packages.
//
// Run it from the server/ directory:
//
//   node scripts/loadtest.mjs --label S1a --route "anon:/api/jobs?page=1&pageSize=20" \
//     --requests 5000 --concurrency 200
//
//   node scripts/loadtest.mjs --label S3 --duration 60 --concurrency 1000 --xff \
//     --route "anon:/api/jobs?page=1&pageSize=20" \
//     --route "anon:/api/jobs/1c1b2a34-1111-4222-8333-444455556666" \
//     --route "auth:/api/auth/me" \
//     --route "auth:/api/notifications/mine"
//
// Route kinds — prefix each --route with "anon:" or "auth:". `auth:` attaches the
// bearer token from .loadtest-token.local. `--xff` rotates X-Forwarded-For so each
// worker looks like a distinct client IP: the general limiter keys on
// req.user.id || ipKeyGenerator(req.ip), so without it every anonymous request in
// a scenario shares one 300/15min bucket and the run measures the throttle, not
// the app. `--no-xff` is the deliberate single-IP throttle probe (S4).
//
//   node scripts/loadtest.mjs --mint-token --mint-email you@example.com
//
// Writes a short-lived access token to .loadtest-token.local (gitignored via *.local)
// using the Supabase service-role key. Read-only against the app DB: mints a magic
// link + verifyOtp for an existing user, changes no password or profile.

import { monitorEventLoopDelay } from 'node:perf_hooks';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const str = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  const v = i >= 0 ? argv[i + 1] : undefined;
  return v != null && !v.startsWith('--') ? v : d;
};
const num = (n, d) => {
  const s = str(n);
  return s != null && s !== '' && Number.isFinite(Number(s)) ? Number(s) : d;
};
const repeated = (n) => argv.flatMap((a, i) => (a === `--${n}` && argv[i + 1] != null ? [argv[i + 1]] : []));

const URL_BASE = str('url', 'http://127.0.0.1:4000');
const LABEL = str('label', 'run');
const WANT = num('requests', 0);
const DURATION_SEC = num('duration', 0);
const CONCURRENCY = Math.max(1, num('concurrency', 50));
const TIMEOUT_MS = num('timeout', 30000);
const WARMUP = num('warmup', 0);
const PROBE_EVERY_MS = num('probe-every', 500);
const JSON_OUT = str('json', '');
const USE_XFF = flag('xff');
const XFF_IP = str('xff-ip', '');
const TOKEN_FILE = str('token-file', new URL('../.loadtest-token.local', import.meta.url));

const loadEnvFile = () => {
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* not running under the server dir */ }
};

const mintToken = async () => {
  const email = str('mint-email', '');
  if (!email) throw new Error('--mint-token needs --mint-email <address>');
  loadEnvFile();
  const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: link, error: le } = await supa.auth.admin.generateLink({ type: 'magiclink', email });
  if (le) throw new Error(`generateLink: ${le.message}`);
  const { data, error } = await supa.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (error) throw new Error(`verifyOtp: ${error.message}`);
  writeFileSync(TOKEN_FILE, data.session.access_token);
  const exp = new Date(data.session.expires_at * 1000).toISOString();
  console.log(`token for ${data.session.user.id} (${email}) written to ${TOKEN_FILE}; expires ${exp}`);
};

if (flag('mint-token')) { await mintToken(); process.exit(0); }

// ---------------------------------------------------------------- measurement
const ms = (a, b) => Number(b - a) / 1e6;
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
const fmt = (n, d = 1) => Number(n).toFixed(d);

const stats = () => {
  const m = process.memoryUsage();
  return { rssMB: +(m.rss / 1048576).toFixed(1), heapMB: +(m.heapUsed / 1048576).toFixed(1), extMB: +(m.external / 1048576).toFixed(1) };
};

const results = {
  label: LABEL,
  config: { url: URL_BASE, concurrency: CONCURRENCY, requests: WANT, durationSec: DURATION_SEC, xff: USE_XFF, routes: [] },
  latencies: [],
  probeLatencies: [],
  statusCounts: {},
  errorCounts: {},
  bytes: 0,
  completed: 0,
  maxInflight: 0,
  timestamps: [], // hrtime ns
  perSec: [],
  rssSeries: [],
  elapsed: [],
};

const probe = { running: false, count: 0, errors: 0 };

const startHealthProbe = (headers) => {
  if (!flag('probe')) return null;
  probe.running = true;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    const t0 = process.hrtime.bigint();
    try {
      const r = await fetch(`${URL_BASE}/api/health`, { headers: { ...headers, 'x-forwarded-for': '127.0.0.1' } });
      await r.arrayBuffer();
      results.probeLatencies.push(ms(t0, process.hrtime.bigint()));
      probe.count += 1;
    } catch (e) {
      probe.errors += 1;
      results.probeLatencies.push(ms(t0, process.hrtime.bigint()));
      results.errorCounts[`probe:${e?.cause?.code || e?.name || 'error'}`] =
        (results.errorCounts[`probe:${e?.cause?.code || e?.name || 'error'}`] || 0) + 1;
    }
    const wait = Math.max(0, PROBE_EVERY_MS - ms(t0, process.hrtime.bigint()));
    setTimeout(tick, wait);
  };
  void tick();
  return () => { stopped = true; };
};

const run = async () => {
  const routes = repeated('route')
    .map((spec) => {
      const i = spec.indexOf(':');
      const kind = spec.slice(0, i).toLowerCase();
      if (kind !== 'anon' && kind !== 'auth') throw new Error(`route must start with anon: or auth: — got "${spec}"`);
      return { kind, target: spec.slice(i + 1) };
    });
  if (!routes.length) throw new Error('no --route given');
  if (!WANT && !DURATION_SEC) throw new Error('give --requests <n> and/or --duration <sec>');
  let token = '';
  const tokenFiles = repeated('token-file').length ? repeated('token-file') : [TOKEN_FILE];
  const tokens = [];
  if (routes.some((r) => r.kind === 'auth')) {
    for (const f of tokenFiles) {
      if (!existsSync(f)) throw new Error(`${f} missing — run --mint-token first`);
      tokens.push(readFileSync(f, 'utf8').trim());
    }
    token = tokens[0];
  }

  const eld = monitorEventLoopDelay({ resolution: 10 });
  eld.enable();
  const drift = { max: 0 };
  const t0 = Date.now();
  let last = t0;
  const ticker = setInterval(() => {
    const now = Date.now();
    drift.max = Math.max(drift.max, now - last - 1000);
    last = now;
  }, 1000);
  const memAt = { start: stats() };

  const stopProbe = startHealthProbe({ 'user-agent': 'loadtest-probe' });

  // --warmup: one serial request per route, not recorded.
  for (let i = 0; i < WARMUP; i += 1) {
    const r = routes[i % routes.length];
    const h = r.kind === 'auth' ? { authorization: `Bearer ${token}` } : {};
    try { await fetch(`${URL_BASE}${r.target}`, { headers: h, signal: AbortSignal.timeout(TIMEOUT_MS) }).then((x) => x.arrayBuffer()); } catch { /* warmup */ }
  }

  const dead = DURATION_SEC > 0 ? Date.now() + DURATION_SEC * 1000 : 0;
  let seq = 0;
  let inflight = 0;
  const more = () => (WANT > 0 ? seq < WANT : Date.now() < dead);

  const one = async (id) => {
    const r = routes[seq % routes.length];
    seq += 1;
    const headers = { 'user-agent': 'loadtest' };
    if (r.kind === 'auth') headers.authorization = `Bearer ${tokens.length ? tokens[seq % tokens.length] : token}`;
    if (USE_XFF || XFF_IP) {
      // Worker-derived: one distinct client IP per concurrent virtual user.
      // 10.20.<hi>.<lo> gives 65k addresses, comfortably above the 1,000 target.
      // --xff-ip pins every worker to one address: the single-IP throttle probe.
      headers['x-forwarded-for'] = XFF_IP || `10.20.${(id >> 8) % 256}.${id % 256}`;
    }
    const t = process.hrtime.bigint();
    inflight += 1;
    results.maxInflight = Math.max(results.maxInflight, inflight);
    try {
      const res = await fetch(`${URL_BASE}${r.target}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = await res.arrayBuffer();
      const dt = ms(t, process.hrtime.bigint());
      lat.push(dt);
      ts.push(t);
      results.statusCounts[res.status] = (results.statusCounts[res.status] || 0) + 1;
      results.bytes += body.byteLength;
      results.completed += 1;
    } catch (e) {
      lat.push(ms(t, process.hrtime.bigint()));
      ts.push(t);
      const key = e?.cause?.code || e?.name || 'fetch_error';
      results.errorCounts[key] = (results.errorCounts[key] || 0) + 1;
      results.completed += 1;
    } finally {
      inflight -= 1;
    }
  };

  const lat = results.latencies;
  const ts = results.timestamps;

  const worker = async (id) => { while (more()) await one(id); };

  const seriesSampler = setInterval(() => {
    results.rssSeries.push(stats());
  }, 1000);

  const wall = process.hrtime.bigint();
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  results.elapsed.push(+(Number(process.hrtime.bigint() - wall) / 1e9).toFixed(2));
  clearInterval(seriesSampler);
  memAt.end = stats();

  // mid sample = the 50% percentile sample already captured in rssSeries
  const mid = results.rssSeries[Math.floor(results.rssSeries.length / 2)] || memAt.end;
  const p = [...lat].sort((a, b) => a - b);
  const ps = [...results.probeLatencies].sort((a, b) => a - b);
  const e = results.elapsed[0] || 0.001;

  // per-second throughput
  const buckets = [];
  for (const t of ts) {
    const s = Math.floor(ms(ts[0], t) / 1000);
    buckets[s] = (buckets[s] || 0) + 1;
  }
  results.perSec = buckets.map((v) => v || 0);

  const rows = [
    ['component', 'value'],
    ['scenario', LABEL],
    ['concurrency (workers)', CONCURRENCY],
    ['max in-flight observed', results.maxInflight],
    ['requests attempted', seq],
    ['completed', results.completed],
    ['duration (s)', fmt(e, 2)],
    ['throughput (req/s)', fmt(results.completed / e, 0)],
    ['latency p50 (ms)', fmt(pct(p, 50))],
    ['latency p95 (ms)', fmt(pct(p, 95))],
    ['latency p99 (ms)', fmt(pct(p, 99))],
    ['latency max (ms)', fmt(p[p.length - 1] ?? 0)],
    ['status counts', Object.entries(results.statusCounts).sort().map(([k, v]) => `${k}:${v}`).join(' ') || '(none)'],
    ['fetch errors', Object.entries(results.errorCounts).sort().map(([k, v]) => `${k}:${v}`).join(' ') || '(none)'],
    ['event-loop lag p50 (ms)', fmt(eld.percentile(50) / 1e6)],
    ['event-loop lag p99 (ms)', fmt(eld.percentile(99) / 1e6)],
    ['event-loop lag max (ms)', fmt(Number(eld.max) / 1e6)],
    ['setInterval(1000) drift max (ms)', Math.round(drift.max)],
    ['loader RSS start (MB)', memAt.start.rssMB],
    ['loader RSS mid (MB)', mid.rssMB],
    ['loader RSS end (MB)', memAt.end.rssMB],
    ['loader heap start (MB)', memAt.start.heapMB],
    ['loader heap end (MB)', memAt.end.heapMB],
    ['loader external end (MB)', memAt.end.extMB],
    ['health probe n / errors', `${probe.count} / ${probe.errors}`],
    ['health probe p50 (ms)', fmt(pct(ps, 50))],
    ['health probe p95 (ms)', fmt(pct(ps, 95))],
    ['health probe max (ms)', fmt(ps[ps.length - 1] ?? 0)],
    ['req/s per second', results.perSec.join(' ')],
    ['loader RSS per second (MB)', results.rssSeries.map((s) => s.rssMB).join(' ')],
  ];
  const w = Math.max(...rows.map((r) => String(r[0]).length));
  console.log('');
  for (const [k, v] of rows) console.log(`${String(k).padEnd(w)}  ${v}`);
  stopProbe?.();

  const snapshot = {
    label: LABEL,
    config: { url: URL_BASE, concurrency: CONCURRENCY, requests: WANT, durationSec: DURATION_SEC, xff: USE_XFF, xffIp: XFF_IP || null, routes: routes.map((r) => `${r.kind}:${r.target}`) },
    attempted: seq,
    completed: results.completed,
    elapsedSec: +e.toFixed(2),
    throughputPerSec: +(results.completed / e).toFixed(1),
    maxInflight: results.maxInflight,
    latency: { p50: +pct(p, 50).toFixed(2), p95: +pct(p, 95).toFixed(2), p99: +pct(p, 99).toFixed(2), max: +(p[p.length - 1] ?? 0).toFixed(2) },
    statusCounts: results.statusCounts,
    errorCounts: results.errorCounts,
    bytes: results.bytes,
    eventLoopLagMs: { p50: +(eld.percentile(50) / 1e6).toFixed(2), p99: +(eld.percentile(99) / 1e6).toFixed(2), max: +(Number(eld.max) / 1e6).toFixed(2) },
    intervalDriftMaxMs: Math.round(drift.max),
    memory: { start: memAt.start, mid, end: memAt.end },
    probe: { n: probe.count, errors: probe.errors, p50: +pct(ps, 50).toFixed(2), p95: +pct(ps, 95).toFixed(2), max: +(ps[ps.length - 1] ?? 0).toFixed(2), latencies: results.probeLatencies.map((x) => +x.toFixed(2)) },
    perSec: results.perSec,
    rssSeries: results.rssSeries.map((s) => s.rssMB),
  };
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`json -> ${JSON_OUT}`);
  }
  clearInterval(ticker);
  eld.disable();
};

process.on('unhandledRejection', (e) => {
  console.error(`[loader] unhandledRejection: ${e?.cause?.code || e?.message || e}`);
});
process.on('uncaughtException', (e) => {
  console.error(`[loader] uncaughtException: ${e?.stack || e}`);
  process.exit(1);
});

await run();
