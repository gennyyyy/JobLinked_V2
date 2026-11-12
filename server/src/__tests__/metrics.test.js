import express from 'express';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { metricsMiddleware, metricsSnapshot, resetMetrics } from '../middleware/metrics.js';
import metricsRoutes from '../routes/metrics.js';

// G15 (ADR-043): counters + the token-gated scrape endpoint.

function app() {
  const instance = express();
  instance.use(metricsMiddleware);
  instance.get('/api/boom', () => { throw new Error('kaboom'); });
  instance.get('/api/admin/users', () => { throw new Error('search failed'); });
  instance.get('/api/ok', (_req, res) => res.json({ ok: true }));
  instance.use('/api', metricsRoutes);
  // Four args: Express only treats a handler as the error middleware with this shape.
  instance.use((_err, _req, res, next) => { void next; return res.status(500).json({ error: 'internal' }); });
  return instance;
}

describe('metrics middleware', () => {
  beforeEach(() => {
    resetMetrics();
    delete process.env.METRICS_TOKEN;
  });

  it('counts requests by method + status class and averages latency', async () => {
    const instance = app();
    await request(instance).get('/api/ok');
    await request(instance).get('/api/ok');
    await request(instance).get('/api/boom');

    const snap = metricsSnapshot();
    expect(snap.requests.total).toBe(3);
    expect(snap.requests.byStatus['GET 2xx']).toBe(2);
    expect(snap.requests.byStatus['GET 5xx']).toBe(1);
    expect(snap.requests.errors5xx).toBe(1);
    expect(snap.latencyMs.average).toBeGreaterThan(0);
    expect(snap.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('remembers the last 5xx for triage, path included', async () => {
    await request(app()).get('/api/boom');
    const snap = metricsSnapshot();
    expect(snap.lastError).toMatchObject({ method: 'GET', path: '/api/boom', status: 500 });
    expect(typeof snap.lastError.at).toBe('string');
  });

  it('never stores the query string in lastError (F-09 — admin search PII)', async () => {
    process.env.METRICS_TOKEN = 'scrape-me';
    const instance = app();
    await request(instance).get('/api/admin/users?search=Juan%20Cruz&userId=abc');
    const res = await request(instance).get('/api/metrics').set('x-metrics-token', 'scrape-me');
    expect(res.body.lastError).toMatchObject({ method: 'GET', path: '/api/admin/users', status: 500 });
    expect(JSON.stringify(res.body.lastError)).not.toContain('Juan');
    expect(res.body.lastError.path).not.toContain('?');
  });

  it('is a 404 while the token is unset, and for a wrong token', async () => {
    const instance = app();
    expect((await request(instance).get('/api/metrics')).status).toBe(404);

    process.env.METRICS_TOKEN = 'scrape-me';
    expect((await request(instance).get('/api/metrics')).status).toBe(404);
    expect((await request(instance).get('/api/metrics').set('x-metrics-token', 'nope')).status).toBe(404);
  });

  it('serves the snapshot with the right token', async () => {
    process.env.METRICS_TOKEN = 'scrape-me';
    const instance = app();
    await request(instance).get('/api/ok');

    const res = await request(instance).get('/api/metrics').set('x-metrics-token', 'scrape-me');
    expect(res.status).toBe(200);
    expect(res.body.requests.total).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('latencyMs.buckets');
    expect(res.body).toHaveProperty('memoryMb');
  });
});

afterAll(() => { delete process.env.METRICS_TOKEN; });
