import 'dotenv/config';
import './env.js';
import logger from './logger.js';

import { createApp } from './app.js';

const app = createApp();

const port = Number(process.env.PORT) || 4000;

// `node --watch` restarts can overlap the previous child's shutdown, so the port
// is briefly busy through no fault of the operator. Retry for a few seconds
// before reporting a real conflict.
const MAX_BIND_ATTEMPTS = 10;
function listen(attempt = 1) {
  const server = app.listen(port, () => logger.info('joblinked-api listening', { port }));
  server.on('error', (error) => {
    if (error.code !== 'EADDRINUSE') throw error;
    if (attempt >= MAX_BIND_ATTEMPTS) {
      logger.error(`port ${port} is already in use - stop the other API instance or set PORT`, { port });
      process.exit(1);
    }
    setTimeout(() => listen(attempt + 1), 300);
  });
}
listen();
