import { describe, it, expect } from 'vitest';
import request from 'supertest';

import { makeApp } from './helpers/app.js';

const app = makeApp();

// S2: express.json throws with status 413 over the 1mb limit. The global
// handler used to map only 400, so an oversized body answered 500 INTERNAL.
describe('S2 — payload too large maps to 400, not 500', () => {
  it('413 from the body parser answers 400 PAYLOAD_TOO_LARGE', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(1024 * 1024 + 1024) });
    const res = await request(app).post('/api/auth/provision')
      .set('Content-Type', 'application/json')
      .send(big);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.message).toBe('Payload too large');
  });

  it('malformed JSON still answers 400 BAD_REQUEST', async () => {
    const res = await request(app).post('/api/auth/provision')
      .set('Content-Type', 'application/json')
      .send('not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
