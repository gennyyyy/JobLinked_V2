// Live file-storage verification: avatars/logos in Postgres, resumes on disk,
// cache headers, magic bytes, concurrent uploads, promotion on delete, quota.
//   node scripts/verify-files.mjs --base http://127.0.0.1:4100
import 'dotenv/config'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import http from 'node:http'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const BASE = (process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://127.0.0.1:4100').replace(/\/$/, '')
const UPLOAD_DIR = join(process.cwd(), 'uploads')
const dbUrl = new URL(process.env.DATABASE_URL); dbUrl.pathname = '/joblinked_bench'
const db = new pg.Client({ connectionString: dbUrl.toString() }); await db.connect()
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` :: ${detail}`}`) }
const mints = {}
async function mint(email) {
  if (mints[email]) return mints[email]
  const link = await supa.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) throw new Error(link.error.message)
  const otp = await supa.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })
  if (otp.error) throw new Error(otp.error.message)
  const session = otp.data.session
  mints[email] = { token: session.access_token, id: session.user.id }
  return mints[email]
}
async function provision(account, role, extra = {}) {
  const s = await mint(account.email)
  const me = await fetch(`${BASE}/api/auth/me`, { headers: { authorization: `Bearer ${s.token}` } })
  if (me.status === 404) {
    const body = { role, email: account.email, first_name: 'File', last_name: 'Audit', ...extra }
    const p = await fetch(`${BASE}/api/auth/provision`, { method: 'POST', headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!p.ok) throw new Error(`provision ${account.email}: ${p.status} ${await p.text()}`)
  }
  account.token = s.token; account.id = s.id
}

const seekerA = { email: 'spike.seeker.003@joblinked-spike.test' }
const seekerB = { email: 'spike.seeker.012@joblinked-spike.test' }
const employerA = { email: 'spike.employer.010@joblinked-spike.test' }
await provision(seekerA, 'job-seeker'); await provision(seekerB, 'job-seeker'); await provision(employerA, 'employer', { company_name: 'File Audit Co' })

const auth = (a) => ({ authorization: `Bearer ${a.token}` })
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const pdf = (bytes) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(bytes - 9, 0x20)])
const form = (buffer, name, type = 'application/octet-stream') => {
  const f = new FormData(); f.append('file', new Blob([buffer], { type }), name); return f
}
const raw = (path, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: Number(new URL(BASE).port || 80), path, method: 'GET', headers }, (res) => {
    const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
  })
  req.on('error', reject); req.end()
})

// ── avatar ──────────────────────────────────────────────────────────────────
let r = await fetch(`${BASE}/api/seekers/me/avatar`, { method: 'POST', headers: auth(seekerA), body: form(PNG, 'me.png', 'image/png') })
let body = await r.json()
check('avatar upload 201', r.status === 201, `${r.status} ${JSON.stringify(body)}`)
check('avatar response has no bytes', !JSON.stringify(body).includes('"bytes"'))
const storedAvatar = (await db.query(`select octet_length(bytes) n, mime from profile_images where owner_id=$1 and kind='seeker-avatar'`, [seekerA.id])).rows[0]
check('avatar bytes are in Postgres', storedAvatar?.n === PNG.length && storedAvatar?.mime === 'image/png', JSON.stringify(storedAvatar))

r = await raw(`/api/seekers/${seekerA.id}/avatar`, auth(seekerA))
check('owner avatar 200 + private cache', r.status === 200 && /private/.test(r.headers['cache-control']) && /authorization/i.test(r.headers.vary || ''), JSON.stringify({ status: r.status, cc: r.headers['cache-control'], vary: r.headers.vary }))
check('avatar bytes round-trip', Buffer.compare(r.body, PNG) === 0, `${r.body.length} vs ${PNG.length}`)
const avatarEtag = r.headers.etag
r = await raw(`/api/seekers/${seekerA.id}/avatar`, { ...auth(seekerA), 'if-none-match': avatarEtag })
check('avatar 304 revalidation', r.status === 304 && r.body.length === 0, `${r.status} ${r.body.length}`)
// Replacing the photo must change the validator: a cached copy cannot satisfy
// the next request (Cache-Control is max-age=0, must-revalidate).
const PNG_B = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
r = await fetch(`${BASE}/api/seekers/me/avatar`, { method: 'POST', headers: auth(seekerA), body: form(PNG_B, 'me2.png', 'image/png') })
check('avatar replace 201', r.status === 201, String(r.status))
r = await raw(`/api/seekers/${seekerA.id}/avatar`, { ...auth(seekerA), 'if-none-match': avatarEtag })
check('replaced avatar bypasses the old validator', r.status === 200 && Buffer.compare(r.body, PNG_B) === 0, `${r.status} same=${Buffer.compare(r.body, PNG_B) === 0}`)
r = await raw(`/api/seekers/${seekerA.id}/avatar`, auth(seekerA))
check('replaced avatar sends max-age=0', /max-age=0/.test(r.headers['cache-control'] || ''), r.headers['cache-control'])

r = await raw(`/api/seekers/${seekerA.id}/avatar`, auth(seekerB))
check('other seeker avatar -> 403', r.status === 403, String(r.status))
// Remove any prior run's application link so "unlinked" is actually unlinked.
await db.query(
  `delete from job_applications where seeker_id = $1
     and job_id in (select id from job_vacancies where company_id = $2)`, [seekerA.id, employerA.id])
r = await raw(`/api/seekers/${seekerA.id}/avatar`, auth(employerA))
check('unlinked employer avatar -> 403', r.status === 403, String(r.status))

// link employer via a real application so the applicant exception is proven
await db.query(`insert into employer_accreditations (company_id, status, decided_at) values ($1,'approved',now())`, [employerA.id])
let job = await fetch(`${BASE}/api/jobs`, { method: 'POST', headers: { ...auth(employerA), 'content-type': 'application/json' }, body: JSON.stringify({ title: `File Audit Job ${Date.now()}`, status: 'published' }) }).then((x) => x.json())
if (job.id) {
  await fetch(`${BASE}/api/applications`, { method: 'POST', headers: { ...auth(seekerA), 'content-type': 'application/json' }, body: JSON.stringify({ job_id: job.id }) })
  r = await raw(`/api/seekers/${seekerA.id}/avatar`, auth(employerA))
  check('linked employer avatar -> 200', r.status === 200, String(r.status))
  const jobs = await fetch(`${BASE}/api/jobs?page=1&pageSize=200&order=created_at.desc`).then((x) => x.json())
  check('cached job list still renders', Array.isArray(jobs.jobs))
}

r = await fetch(`${BASE}/api/seekers/me/avatar`, { method: 'DELETE', headers: auth(seekerA) })
check('avatar delete 200', r.status === 200)
r = await raw(`/api/seekers/${seekerA.id}/avatar`, auth(seekerA))
check('avatar gone -> 404', r.status === 404)

// image validation edges: wrong bytes, oversize, wrong role
r = await fetch(`${BASE}/api/seekers/me/avatar`, { method: 'POST', headers: auth(seekerA), body: form(Buffer.from('not an image at all'), 'fake.png', 'image/png') })
check('non-image bytes named .png -> 400', r.status === 400, String(r.status))
r = await fetch(`${BASE}/api/seekers/me/avatar`, { method: 'POST', headers: auth(seekerA), body: form(Buffer.concat([PNG, Buffer.alloc(2.5 * 1024 * 1024, 0)]), 'huge.png', 'image/png') })
check('image over 2 MB -> 400', r.status === 400, String(r.status))
r = await fetch(`${BASE}/api/seekers/me/avatar`, { method: 'POST', headers: auth(employerA), body: form(PNG, 'role.png', 'image/png') })
check('employer cannot set a seeker avatar -> 403', r.status === 403, String(r.status))

// ── company logo ────────────────────────────────────────────────────────────
r = await fetch(`${BASE}/api/employers/me/logo`, { method: 'POST', headers: auth(employerA), body: form(PNG, 'logo.png', 'image/png') })
check('logo upload 201', r.status === 201, String(r.status))
r = await raw(`/api/employers/${employerA.id}/logo`)
check('public logo 200 + public cache', r.status === 200 && r.headers['cache-control'] === 'public, max-age=300', JSON.stringify({ status: r.status, cc: r.headers['cache-control'] }))
check('public logo bytes round-trip', Buffer.compare(r.body, PNG) === 0)
const logoEtag = r.headers.etag
r = await raw(`/api/employers/${employerA.id}/logo`, { 'if-none-match': logoEtag })
check('logo 304 revalidation', r.status === 304 && r.body.length === 0, String(r.status))
const employerMe = await fetch(`${BASE}/api/employers/me`, { headers: auth(employerA) }).then((x) => x.json())
check('employer profile exposes has_logo, not bytes', employerMe.has_logo === true && !('logo' in employerMe) && !JSON.stringify(employerMe).includes('"bytes"'), JSON.stringify({ has_logo: employerMe.has_logo, keys: Object.keys(employerMe).length }))
r = await fetch(`${BASE}/api/employers/me/logo`, { method: 'DELETE', headers: auth(employerA) })
check('logo delete 200', r.status === 200)

// ── resumes on disk ─────────────────────────────────────────────────────────
r = await fetch(`${BASE}/api/files/resumes`, { method: 'POST', headers: auth(seekerA), body: form(pdf(200 * 1024), 'audit-valid.pdf', 'application/pdf') })
body = await r.json()
check('resume upload 201', r.status === 201, `${r.status} ${JSON.stringify(body).slice(0, 120)}`)
const resumeRow = (await db.query('select id, file_path, file_name from resumes where id=$1', [body.resume.id])).rows[0]
const abs = join(UPLOAD_DIR, resumeRow.file_path)
check('resume stored under server/uploads', abs.includes(`${join('server', 'uploads')}`) && existsSync(abs) && statSync(abs).size === 200 * 1024, abs)
check('resume row stores a path, not bytes', (await db.query('select pg_column_size(r) n from resumes r where id=$1', [resumeRow.id])).rows[0].n < 512)

r = await fetch(`${BASE}/api/files/resumes`, { method: 'POST', headers: auth(seekerA), body: form(Buffer.from('MZ\u0090\u0000 definitely not a pdf'), 'audit-spoof.pdf', 'application/pdf') })
check('EXE bytes as .pdf -> 400', r.status === 400, String(r.status))
r = await fetch(`${BASE}/api/files/resumes`, { method: 'POST', headers: auth(seekerA), body: form(pdf(2 * 1024 * 1024 + 1), 'audit-big.pdf', 'application/pdf') })
check('PDF over 2 MB -> 400', r.status === 400, String(r.status))

r = await raw(`/api/files/${resumeRow.file_path}`, auth(seekerA))
check('resume download private + disposition', /private/.test(r.headers['cache-control']) && /authorization/i.test(r.headers.vary || '') && /inline; filename=/.test(r.headers['content-disposition'] || ''), JSON.stringify(r.headers))
check('resume 304 revalidation', (await raw(`/api/files/${resumeRow.file_path}`, { ...auth(seekerA), 'if-none-match': r.headers.etag })).status === 304)

// concurrent uploads
const burst = await Promise.all(Array.from({ length: 6 }, (_, i) =>
  fetch(`${BASE}/api/files/resumes`, { method: 'POST', headers: auth(seekerA), body: form(pdf(50 * 1024), `audit-burst-${i}.pdf`, 'application/pdf') }).then(async (x) => ({ status: x.status, body: await x.json() }))))
check('6 concurrent uploads all 201', burst.every((x) => x.status === 201), burst.map((x) => x.status).join(','))
const active = (await db.query(`select count(*)::int n from resumes where seeker_id=$1 and is_active`, [seekerA.id])).rows[0].n
check('exactly one active resume after burst', active === 1, String(active))

// activation races the same one-active index; the lock must serialize it too
const ids = (await db.query(`select id from resumes where seeker_id=$1 order by uploaded_at`, [seekerA.id])).rows.map((x) => x.id)
const activate = await Promise.all(Array.from({ length: 12 }, (_, i) =>
  fetch(`${BASE}/api/files/resumes/${ids[i % ids.length]}/activate`, { method: 'POST', headers: auth(seekerA) })
    .then(async (x) => ({ status: x.status, body: await x.json() }))))
check('12 concurrent activations all 200', activate.every((x) => x.status === 200), activate.map((x) => x.status).join(','))
const activeAfter = (await db.query(`select count(*)::int n from resumes where seeker_id=$1 and is_active`, [seekerA.id])).rows[0].n
check('exactly one active resume after activation race', activeAfter === 1, String(activeAfter))

// delete the active one -> promote newest remaining
const currentActive = (await db.query(`select id from resumes where seeker_id=$1 and is_active`, [seekerA.id])).rows[0].id
await fetch(`${BASE}/api/files/resumes/${currentActive}`, { method: 'DELETE', headers: auth(seekerA) })
const afterDelete = (await db.query(`select count(*)::int n from resumes where seeker_id=$1 and is_active`, [seekerA.id])).rows[0].n
check('deleting active promotes another', afterDelete === 1, String(afterDelete))

// quota: 20 rows max (insert fillers, then expect 400 before multer writes)
const filler = Array.from({ length: 20 }, (_, i) => `('${seekerA.id}', 'resumes/${seekerA.id}/quota-${i}.pdf', 'quota-${i}.pdf', false)`).join(',')
await db.query(`insert into resumes (seeker_id, file_path, file_name, is_active) values ${filler}`)
r = await fetch(`${BASE}/api/files/resumes`, { method: 'POST', headers: auth(seekerA), body: form(pdf(1024), 'audit-over-quota.pdf', 'application/pdf') })
check('quota rejects the 21st resume', r.status === 400, String(r.status))
await db.query(`delete from resumes where file_name like 'quota-%'`)

// cleanup everything this run created
const leftovers = (await db.query(`select id, file_path from resumes where seeker_id=$1`, [seekerA.id])).rows
for (const row of leftovers) await fetch(`${BASE}/api/files/resumes/${row.id}`, { method: 'DELETE', headers: auth(seekerA) })
if (job?.id) await fetch(`${BASE}/api/jobs/${job.id}`, { method: 'DELETE', headers: auth(employerA) })

console.log(`\n${results.filter((x) => x.ok).length}/${results.length} checks passed`)
await db.end()
process.exit(results.every((x) => x.ok) ? 0 : 1)
