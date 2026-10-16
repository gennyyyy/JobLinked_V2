// H5: level-aware structured logging. One JSON line per event to
// stdout/stderr via console. The API mirrors pino's
// (.info/.warn/.error/.child) so swapping internals later never touches call
// sites. ponytail/ADR-020: server deps stay lean — one rate-limited Express
// process writing JSON lines does not need pino's worker-thread throughput.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[String(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

// Trust-boundary discipline: NEVER log the pg error object (its .query and
// .parameters are the citizen record) and never log request bodies — those
// stay at the call site, which whitelists scalar fields only. This wrapper's
// job is the opposite guarantee: formatting must never throw, or logging
// would take down the request it was meant to observe.
const line = (level, msg, fields, bindings) => {
  try {
    return JSON.stringify({ level, time: new Date().toISOString(), msg, ...bindings, ...fields });
  } catch {
    return JSON.stringify({ level, time: new Date().toISOString(), msg: String(msg) });
  }
};

const emit = (level, msg, fields, bindings) => {
  if (LEVELS[level] < threshold) return;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  sink(line(level, msg, fields, bindings));
};

const make = (bindings) => ({
  debug: (msg, fields = {}) => emit('debug', msg, fields, bindings),
  info: (msg, fields = {}) => emit('info', msg, fields, bindings),
  warn: (msg, fields = {}) => emit('warn', msg, fields, bindings),
  error: (msg, fields = {}) => emit('error', msg, fields, bindings),
  // Per-request bindings (req.id) instead of re-threading context by hand.
  child: (extra) => make({ ...bindings, ...extra }),
});

export default make({});
