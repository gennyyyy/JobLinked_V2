import 'dotenv/config';
import './env.js';
import logger from './logger.js';

import { createApp } from './app.js';

const app = createApp();

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => logger.info('joblinked-api listening', { port }));
