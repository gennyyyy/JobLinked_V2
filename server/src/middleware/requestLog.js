import logger from '../logger.js';

// H5: one access line per request — method, path, status, duration, and the
// L3 correlation id. Cheap: it runs off the response 'finish' event, so no
// latency is added to the answer. Only the request line is logged: bodies,
// headers, and PII never reach it. LB health polls are skipped at success; a
// failing probe is a warn (degraded, not an error).
export default function requestLog(req, res, next) {
  const started = process.hrtime.bigint();
  // Capture at entry: mounted routers rewrite req.url as they match, so the
  // full original path must be taken before routing runs (same as morgan's
  // req.originalUrl).
  const { method, path } = req;
  const id = req.id;
  res.on('finish', () => {
    const isHealth = path === '/api/health';
    const failed = res.statusCode >= 500;
    if (isHealth && !failed) return;
    logger.child({ id })[failed ? 'warn' : 'info']('request', {
      method,
      path,
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
    });
  });
  next();
}
