import express from 'express';
import authRoutes from '../../routes/auth.js';
import jobsRoutes from '../../routes/jobs.js';
import applicationsRoutes from '../../routes/applications.js';
import profilesRoutes from '../../routes/profiles.js';
import adminRoutes from '../../routes/admin.js';
import reportsRoutes from '../../routes/reports.js';
import aiRoutes from '../../routes/ai.js';
import health from '../../routes/health.js';
import { createApp } from '../../app.js';
import { err } from '../../util.js';

// The production wiring from server/src/index.js (minus listen, CORS, trust
// proxy, rate limiters) so supertest can drive the real routers end-to-end.
export function makeApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', health);

  app.use('/api', authRoutes, jobsRoutes, applicationsRoutes, profilesRoutes, adminRoutes, reportsRoutes, aiRoutes);
  app.use('/api', (_req, res) => err(res, 404, 'NOT_FOUND', 'Route not found'));
  // eslint-disable-next-line no-unused-vars
  app.use((e, _req, res, _next) => {
    if (e?.status === 400 || e?.status === 413) {
      return err(res, 400, e.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        e.status === 413 ? 'Payload too large' : 'Invalid request body');
    }
    err(res, 500, 'INTERNAL', 'Something went wrong');
  });

  return app;
}

// The real production stack — helmet, compression, CORS with preflight
// caching, request ids, and the actual rate limiters — for the middleware
// regression tests (helpers/app.js mirrors index.js, so this is createApp).
export const makeHardenedApp = createApp;
