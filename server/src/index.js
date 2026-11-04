import 'dotenv/config';
import './env.js';
import logger from './logger.js';

import { createApp } from './app.js';
import { uploadDir } from './upload.js';

const app = createApp();

const port = Number(process.env.PORT) || 4000;

// The resolved uploads root is logged once: a relative UPLOAD_DIR is resolved
// against server/ (never process.cwd()), and an operator needs to know exactly
// which folder belongs in the backup set.
logger.info('uploads directory', { dir: uploadDir });

// `node --watch` restarts can overlap the previous child's shutdown, so the port
// is briefly busy through no fault of the operator. Give the old process ~15s to
// let go before reporting a real conflict; the old 3s window could expire while a
// request was still draining, leaving the watcher with a dead child and no API.
const MAX_BIND_ATTEMPTS = 30;
function listen(attempt = 1) {
  const server = app.listen(port, () => logger.info('joblinked-api listening', { port }));
  // Bounded request lifetime. Without these a handler that never answers (or a
  // client that never finishes its body) keeps the socket open forever; a
  // browser allows ~6 connections per origin, so a handful of stuck calls makes
  // every later API call queue behind them and the app looks frozen. 60s of
  // inactivity is far above any real upload/download on this API.
  server.requestTimeout = 60_000; // whole request must arrive within 60s
  server.headersTimeout = 30_000; // headers first; must stay > keepAliveTimeout
  server.keepAliveTimeout = 25_000; // default 5s races browser socket reuse and fails the next click
  server.setTimeout(60_000); // no bytes either way for 60s -> socket destroyed
  server.on('error', (error) => {
    if (error.code !== 'EADDRINUSE') throw error;
    if (attempt >= MAX_BIND_ATTEMPTS) {
      logger.error(`port ${port} is already in use - stop the other API instance or set PORT`, { port });
      process.exit(1);
    }
    setTimeout(() => listen(attempt + 1), 500);
  });
}
listen();

// Belt and braces for "randomly crashed with no explanation": any escape that
// got past the route handlers is one structured line + a clean death, and the
// dev runner respawns within a second (in production a supervisor does the
// same). Half-alive is worse than dead — never swallow these.
const crash = (kind, e) => {
  logger.error(kind, { code: e?.code, message: e?.message, stack: e?.stack?.split('\n').slice(0, 3).join(' | ') });
  process.exit(1);
};
process.on('uncaughtException', crash.bind(null, 'uncaught_exception'));
process.on('unhandledRejection', crash.bind(null, 'unhandled_rejection'));
