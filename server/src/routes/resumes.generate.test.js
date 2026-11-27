import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Stateless renderer: no DB, no auth. Mock the shared seams only so importing
// the full app harness never opens a real pool or Supabase client.
vi.mock('../db.js', async () => { const h = await import('../__tests__/helpers/db.js'); return { pool: h.pool, query: h.query, clientQuery: h.clientQuery, connect: h.connect }; });
vi.mock('../ba.js', async () => { const h = await import('../__tests__/helpers/auth.js'); return { auth: h.baAuth }; });

process.env.SUPABASE_URL ||= 'http://127.0.0.1';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { reset } = await import('../__tests__/helpers/db.js');
const { resetAuth } = await import('../__tests__/helpers/auth.js');
const { makeApp } = await import('../__tests__/helpers/app.js');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const binaryParser = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const app = makeApp();

const baseResume = () => ({
  firstName: 'Juan',
  middleName: '',
  lastName: 'Dela Cruz',
  suffix: '',
  email: 'juan@example.com',
  phone: '09171234567',
  birthdate: '1995-05-20',
  nationality: 'Filipino',
  address: {
    street: '123 Mabini St',
    barangay: 'Barangay 1',
    cityMunicipality: 'Manila',
    provinceState: 'Metro Manila',
    postalCode: '1000',
  },
  education: { level: 'College', school: 'University of the Philippines', field: 'Computer Science', year: '2017' },
  skills: ['JavaScript', 'Node.js'],
  experience: [{ jobTitle: 'Developer', company: 'Acme', startDate: '2020-01', endDate: '', description: 'Built things.' }],
});

const emptyResume = () => ({
  firstName: '', middleName: '', lastName: '', suffix: '',
  email: '', phone: '', birthdate: '', nationality: '',
  address: { street: '', barangay: '', cityMunicipality: '', provinceState: '', postalCode: '' },
  education: null,
  skills: [],
  experience: [],
});

const send = (body) => request(app).post('/api/resumes/generate').send(body);
const sendBinary = (body) => send(body).buffer(true).parse(binaryParser);

beforeEach(() => { reset(); resetAuth(); });

describe('POST /api/resumes/generate', () => {
  it('renders a PDF attachment', async () => {
    const res = await sendBinary({ format: 'pdf', resume: baseResume() });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename=".+-Resume\.pdf"; filename\*=UTF-8''/);
    expect(res.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renders a DOCX attachment', async () => {
    const res = await sendBinary({ format: 'docx', resume: baseResume() });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(DOCX_MIME);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename=".+-Resume\.docx"; filename\*=UTF-8''/);
    expect(res.body.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('accepts a fully empty resume', async () => {
    const res = await sendBinary({ format: 'pdf', resume: emptyResume() });

    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('rejects an unknown format with the contract error shape', async () => {
    const res = await send({ format: 'txt', resume: baseResume() });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'Invalid resume data.' } });
  });

  it('rejects more than 20 skills', async () => {
    const resume = { ...baseResume(), skills: Array.from({ length: 25 }, (_, i) => `skill-${i}`) };
    const res = await send({ format: 'pdf', resume });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects more than 10 experience entries', async () => {
    const entry = { jobTitle: 'Dev', company: 'Acme', startDate: '2020-01', endDate: '', description: '' };
    const resume = { ...baseResume(), experience: Array.from({ length: 11 }, () => entry) };
    const res = await send({ format: 'pdf', resume });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an over-long name', async () => {
    const resume = { ...baseResume(), firstName: 'a'.repeat(101) };
    const res = await send({ format: 'pdf', resume });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed birthdate', async () => {
    const resume = { ...baseResume(), birthdate: '20-05-1995' };
    const res = await send({ format: 'docx', resume });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing resume body', async () => {
    const res = await send({ format: 'pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
