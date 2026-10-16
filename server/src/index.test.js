import net from 'node:net';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// Runtime tests for the entrypoint hardening in server/src/index.js: the
// health check really queries the DB, CORS fails closed when CORS_ORIGIN is
// missing, trust proxy yields the client IP behind one proxy hop, and the
// error middleware logs diagnostics only — no request data, no pg PII
// payload. Route modules are stubbed; one stub carries the diagnostic
// endpoints the assertions need. Same mocked-db pattern as routes/*.test.js.
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  // pg-shaped DatabaseError: code/sqlState are safe diagnostics, query and
  // parameters are the citizen record that must never reach the logs.
  boom: () => {
    const e = new Error('duplicate key value violates unique constraint "citizens_email_key"');
    e.code = '23505';
    e.sqlState = '23505';
    e.query = 'insert into citizens (email, birthdate) values ($1, $2)';
    e.parameters = ['pii@example.com', '1990-01-01'];
    return e;
  },
}));

vi.mock('./env.js', () => ({}));
vi.mock('./db.js', () => ({ pool: { query: mocks.query } }));
vi.mock('./routes/auth.js', () => ({
  default: (req, res, next) => {
    if (req.path === '/boom') throw mocks.boom();
    if (req.path === '/boom-auth') {
      req.user = { id: 'user-42', email: 'pii@example.com' };
      throw mocks.boom();
    }
    if (req.path === '/ip') return res.json({ ip: req.ip });
    next();
  },
}));
vi.mock('./routes/jobs.js', () => ({ default: (_req, _res, next) => next() }));
vi.mock('./routes/applications.js', () => ({ default: (_req, _res, next) => next() }));
vi.mock('./routes/profiles.js', () => ({ default: (_req, _res, next) => next() }));
vi.mock('./routes/admin.js', () => ({ default: (_req, _res, next) => next() }));
vi.mock('./routes/reports.js', () => ({ default: (_req, _res, next) => next() }));
vi.mock('./routes/ai.js', () => ({ default: (_req, _res, next) => next() }));

let port = 4600;
// index.js calls app.listen without exporting the server, so the first request
// must wait for the port to actually accept connections.
const listenReady = (p) => new Promise((resolve, reject) => {
  let tries = 0;
  const attempt = () => {
    const sock = net.connect(p, '127.0.0.1');
    sock.on('connect', () => { sock.destroy(); resolve(); });
    sock.on('error', () => {
      if (++tries > 500) return reject(new Error(`port ${p} never opened`));
      setTimeout(attempt, 10);
    });
  };
  attempt();
});
// Boots a fresh index.js app on its own port with the given CORS_ORIGIN and
// TRUST_PROXY (undefined leaves TRUST_PROXY unset, so createApp's fail-safe
// default applies).
const boot = async (corsOrigin, trustProxy) => {
  if (corsOrigin === undefined) delete process.env.CORS_ORIGIN;
  else process.env.CORS_ORIGIN = corsOrigin;
  if (trustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = trustProxy;
  process.env.PORT = String(port++);
  vi.resetModules();
  await import('./index.js');
  await listenReady(Number(process.env.PORT));
  return `http://127.0.0.1:${process.env.PORT}`;
};

const call = (url, init) => globalThis.fetch(url, init).then(async (r) => ({
  status: r.status,
  body: await r.json().catch(() => null),
  acao: r.headers.get('access-control-allow-origin'),
}));

let errorSpy, infoSpy, warnSpy;
beforeEach(() => {
  mocks.query.mockReset();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('entrypoint hardening (server/src/index.js)', () => {
  let base;
  beforeAll(async () => { base = await boot(); });

  it('GET /api/health: 200 { ok: true } with the db status when the database answers', async () => {
    mocks.query.mockResolvedValue({ rows: [1] });
    const { status, body } = await call(`${base}/api/health`);
    expect(mocks.query).toHaveBeenCalledWith('select 1');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.db).toBe('ok');
    // Healthy health probes are LB spam: never an access line.
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('request log: one JSON access line per request with method/path/status/ms/id', async () => {
    mocks.query.mockResolvedValue({ rows: [1] });
    await call(`${base}/api/ip`);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(infoSpy.mock.calls[0][0]);
    expect(line).toMatchObject({ level: 'info', msg: 'request', method: 'GET', path: '/api/ip', status: 200 });
    expect(line.ms).toBeTypeOf('number');
    expect(line.id).toBeTypeOf('string');
  });

  it('GET /api/health: 503 { ok: false } when the database is unreachable', async () => {
    mocks.query.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const { status, body } = await call(`${base}/api/health`);
    expect(status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.db).toBe('unavailable');
    expect(errorSpy).not.toHaveBeenCalled();
    // A failing probe is a warn line (never an error line, never an info line).
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warnSpy.mock.calls[0][0])).toMatchObject({ level: 'warn', msg: 'request', path: '/api/health', status: 503 });
  });

  it('error middleware logs code/sqlstate/message/method/path, never the pg PII payload', async () => {
    await call(`${base}/api/boom`);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls
      .map((args) => args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
      .join('\n');
    expect(logged).toContain('23505');
    expect(logged).toContain('GET');
    expect(logged).toContain('/api/boom');
    expect(logged).toContain('citizens_email_key');
    expect(logged).not.toContain('pii@example.com');
    expect(logged).not.toContain('insert into citizens');
    expect(logged).not.toContain('1990-01-01');
  });

  it('error middleware emits one structured JSON line redacted to whitelisted keys', async () => {
    await call(`${base}/api/boom`);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(errorSpy.mock.calls[0][0]);
    // The whitelist IS the redaction invariant: query/parameters/body never
    // even exist as keys, not just absent values.
    expect(Object.keys(line).sort()).toEqual(
      ['code', 'id', 'level', 'message', 'method', 'msg', 'path', 'sqlState', 'time']);
    expect(line).toMatchObject({
      level: 'error', msg: 'unhandled_error', method: 'GET', path: '/api/boom',
      code: '23505', sqlState: '23505', message: expect.stringContaining('citizens_email_key'),
    });
  });

  it('error middleware logs the user id when present, never user PII or pg internals', async () => {
    await call(`${base}/api/boom-auth`);
    const logged = JSON.stringify(JSON.parse(errorSpy.mock.calls[0][0]));
    expect(logged).toContain('user-42');
    expect(logged).not.toContain('pii@example.com');
    expect(logged).not.toContain('query');
    expect(logged).not.toContain('parameters');
  });

  it('error middleware keeps the 500 INTERNAL body for server errors', async () => {
    const { status, body } = await call(`${base}/api/boom`);
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });

  it('error middleware keeps the 400 BAD_REQUEST body for body-parser errors', async () => {
    const { status, body } = await call(`${base}/api/boom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(status).toBe(400);
    expect(body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Invalid request body' } });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    // The client fault is diagnosable from the request line; V8's parse error
    // quotes the offending body snippet, so e.message is never logged.
    const logged = errorSpy.mock.calls.map((a) => a[0]).join('\n');
    expect(logged).not.toContain('not json');
  });

  it('error middleware maps 413 payload-too-large to 400 PAYLOAD_TOO_LARGE, not 500', async () => {
    const { status, body } = await call(`${base}/api/boom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pad: 'x'.repeat(1024 * 1024 + 1024) }),
    });
    expect(status).toBe(400);
    expect(body).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' } });
  });

  it('trust proxy default 0 (F5 fail safe): req.ip is the socket, a spoofed XFF is ignored', async () => {
    const { body } = await call(`${base}/api/ip`, { headers: { 'X-Forwarded-For': '203.0.113.9' } });
    expect(body.ip).not.toBe('203.0.113.9');
    const plain = await call(`${base}/api/ip`);
    expect(plain.body.ip).toBe(body.ip); // both come from the real socket
  });

  it('trust proxy: client IP comes from X-Forwarded-For behind one explicit proxy hop', async () => {
    const proxied = await boot(undefined, '1');
    const { body } = await call(`${proxied}/api/ip`, { headers: { 'X-Forwarded-For': '203.0.113.9' } });
    expect(body.ip).toBe('203.0.113.9');
  });

  it('cors fails closed to the dev origin when CORS_ORIGIN is unset', async () => {
    const allowed = await call(`${base}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    expect(allowed.acao).toBe('http://localhost:5173');
    const other = await call(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } });
    expect(other.acao).toBeNull();
  });

  it('cors still honours the comma-separated list when CORS_ORIGIN is set', async () => {
    const listed = await boot('http://a.test,http://b.test');
    const ok = await call(`${listed}/api/health`, { headers: { Origin: 'http://b.test' } });
    expect(ok.acao).toBe('http://b.test');
    const no = await call(`${listed}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    expect(no.acao).toBeNull();
  });
});
