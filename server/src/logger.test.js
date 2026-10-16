import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// LOG_LEVEL is read at import time, so each case re-imports the module.
const captured = { info: [], warn: [], error: [] };
const load = async () => {
  vi.resetModules();
  return (await import('./logger.js')).default;
};

beforeEach(() => {
  captured.info.length = 0;
  captured.warn.length = 0;
  captured.error.length = 0;
  delete process.env.LOG_LEVEL;
  vi.spyOn(console, 'info').mockImplementation((l) => captured.info.push(l));
  vi.spyOn(console, 'warn').mockImplementation((l) => captured.warn.push(l));
  vi.spyOn(console, 'error').mockImplementation((l) => captured.error.push(l));
});
afterEach(() => vi.restoreAllMocks());

describe('logger (H5)', () => {
  it('emits one JSON line with level/time/msg plus the call-site fields', async () => {
    const logger = await load();
    logger.error('boom', { code: '23505' });
    expect(captured.error).toHaveLength(1);
    expect(JSON.parse(captured.error[0])).toMatchObject({ level: 'error', msg: 'boom', code: '23505' });
    expect(captured.info).toHaveLength(0);
  });

  it('child() merges bindings into every line', async () => {
    const logger = await load();
    logger.child({ id: 'req-1' }).info('request', { path: '/api/x' });
    expect(JSON.parse(captured.info[0])).toMatchObject({ id: 'req-1', msg: 'request', path: '/api/x' });
  });

  it('LOG_LEVEL gates levels below the threshold (default: info)', async () => {
    (await load()).debug('hidden-by-default');
    expect(captured.info).toHaveLength(0);

    process.env.LOG_LEVEL = 'error';
    const logger = await load();
    logger.info('suppressed');
    logger.warn('suppressed');
    logger.error('kept');
    expect(captured.warn).toHaveLength(0);
    expect(captured.error).toHaveLength(1);
  });

  it('never throws when a field cannot be serialized', async () => {
    const logger = await load();
    const cyclic = {};
    cyclic.self = cyclic;
    expect(() => logger.error('boom', { cyclic })).not.toThrow();
    expect(captured.error).toHaveLength(1);
    expect(JSON.parse(captured.error[0]).msg).toBe('boom');
  });
});
