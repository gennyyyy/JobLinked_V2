// G15 (ADR-043): minimal, dependency-free observability.
//
// In-process counters only — the topology is one persistent node (ADR-037), so a
// per-process snapshot is the whole picture. Nothing is persisted; a restart
// resets the counters, which is exactly what an operator wants from a liveness
// view. No timers, no exports, no background flush: the numbers are read on
// demand by GET /api/metrics.

const startedAt = Date.now();
const counters = new Map(); // "METHOD class" -> count, e.g. "GET 2xx"
let totalRequests = 0;
let totalErrors = 0;
let totalMs = 0;
let lastError = null; // { at, method, path, status }

// Latency histogram in coarse buckets — enough to answer "is it slow?" without
// pulling in a metrics library.
const BUCKETS = [25, 50, 100, 250, 500, 1000, 2500, 5000];
const latency = new Map(BUCKETS.map((b) => [b, 0]));
let overBucket = 0;

// Optional alert hook: when ALERT_WEBHOOK_URL is set, a 5xx posts a small JSON
// line to it (Slack/Discord/generic incoming webhook shape). Throttled to one
// per minute so a broken dependency cannot turn into an alert storm, and
// fire-and-forget: an alert must never delay or fail a response.
const ALERT_WINDOW_MS = 60_000;
let lastAlertAt = 0;

function maybeAlert(payload) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const now = Date.now();
  if (now - lastAlertAt < ALERT_WINDOW_MS) return;
  lastAlertAt = now;
  const body = JSON.stringify({ text: `[joblinked-api] ${payload.status} on ${payload.method} ${payload.path}`, ...payload });
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    .catch(() => { /* an unreachable alert target is not a request failure */ });
}

export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  // F-09: capture the bare path at entry, like requestLog. Never the query
  // string — it is read back by the token-gated snapshot and posted to the
  // alert webhook, and admin searches (?search=<name>) carry PII.
  const { path } = req;
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    totalRequests += 1;
    totalMs += ms;

    const klass = `${Math.floor(res.statusCode / 100)}xx`;
    const key = `${req.method} ${klass}`;
    counters.set(key, (counters.get(key) || 0) + 1);

    const bucket = BUCKETS.find((b) => ms <= b);
    if (bucket === undefined) overBucket += 1;
    else latency.set(bucket, (latency.get(bucket) || 0) + 1);

    if (res.statusCode >= 500) {
      totalErrors += 1;
      lastError = { at: new Date().toISOString(), method: req.method, path, status: res.statusCode };
      maybeAlert({ ...lastError, errors5xx: totalErrors, requests: totalRequests });
    }
  });
  next();
}

export function metricsSnapshot() {
  const byStatus = {};
  for (const [key, count] of counters) byStatus[key] = count;
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    requests: {
      total: totalRequests,
      errors5xx: totalErrors,
      errorRate: totalRequests ? Number((totalErrors / totalRequests).toFixed(4)) : 0,
      byStatus,
    },
    latencyMs: {
      average: totalRequests ? Number((totalMs / totalRequests).toFixed(1)) : 0,
      buckets: Object.fromEntries(BUCKETS.map((b) => [`<=${b}`, latency.get(b) || 0])),
      over5000: overBucket,
    },
    memoryMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
    lastError,
  };
}

// Test-only reset so one suite's requests cannot leak into another's numbers.
export function resetMetrics() {
  counters.clear();
  latency.forEach((_v, b) => latency.set(b, 0));
  totalRequests = 0;
  totalErrors = 0;
  totalMs = 0;
  overBucket = 0;
  lastError = null;
}
