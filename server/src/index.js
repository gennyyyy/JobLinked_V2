import 'dotenv/config';
import './env.js';

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import jobsRoutes from './routes/jobs.js';
import applicationsRoutes from './routes/applications.js';
import profilesRoutes from './routes/profiles.js';
import adminRoutes from './routes/admin.js';
import { err } from './util.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', authRoutes, jobsRoutes, applicationsRoutes, profilesRoutes, adminRoutes);

app.use('/api', (_req, res) => err(res, 404, 'NOT_FOUND', 'Route not found'));
// eslint-disable-next-line no-unused-vars
app.use((e, _req, res, _next) => {
  console.error(e);
  if (e.status === 400) return err(res, 400, 'BAD_REQUEST', 'Invalid request body');
  err(res, 500, 'INTERNAL', 'Something went wrong');
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`joblinked-api on :${port}`));
