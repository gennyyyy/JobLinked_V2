import 'dotenv/config';
import './env.js';
import logger from './logger.js';

import { createApp } from './app.js';

const app = createApp();

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => logger.info('joblinked-api listening', { port }));

// A duplicate API instance (stray `npm start` beside `npm run dev`) used to throw
// an unhandled stack on every watch restart. Report it once, clearly.
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`port ${port} is already in use - stop the other API instance or set PORT`, { port });
    process.exit(1);
  }
  throw error;
});
