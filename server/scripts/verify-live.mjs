#!/usr/bin/env node
// Live verification harness: real HTTP against a running API, real Postgres,
// real Supabase-minted sessions. No mocks. Exits 1 on any failed assertion.
//
//   node scripts/verify-live.mjs --base http://127.0.0.1:4100
//
// Fixtures use @joblinked-spike.test addresses (Supabase dev project only) and
// the `joblinked_bench` database. Never point this at production.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const BASE = arg('base', 'http://127.0.0.1:4100').replace(/\/$/, '')
const BENCH_DB = arg('db', 'joblinked_bench')
const ONLY = arg('only', '')
const QUIET = argv.includes('--quiet')

if (!/_bench$/.test(BENCH_DB)) {
  console.error(`[verify-live] refusing to run: DB name "${BENCH_DB}" must end in _bench (never touch production).`)
  process.exit(1)
}
const parsed = new URL(process.env.DATABASE_URL)
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
  console.error(`[verify-live] refusing to run against non-local host "${parsed.hostname}".`)
  process.exit(1)
}
const benchUrl = new URL(process.env.DATABASE_URL)
benchUrl.pathname = `/${BENCH_DB}`
const db = new pg.Client({ connectionString: benchUrl.toString() })
await db.connect()

// ------------------------------------------------------------------ reporting
const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) console.log(`FAIL  ${name}${detail ? ` :: ${detail}` : ''}`)
  else if (!QUIET) console.log(`ok    ${name}`)
}
const eq = (name, actual, expected) =>
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)

const section = (name) => { if (!QUIET) console.log(`\n## ${name}`) }
const enabled = (name) => !ONLY || ONLY.split(',').includes(name)

// ------------------------------------------------------------------ http
async function req(method, path, { token, body, headers = {}, form } = {}) {
  const h = { ...headers }
  if (token) h.authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { h['content-type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(BASE + path, { method, headers: h, body: payload })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* non-JSON (csv/health) */ }
  return { status: res.status, body: json, text, headers: Object.fromEntries(res.headers) }
}

// ------------------------------------------------------------------ fixtures
const supaAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function mint(email) {
  const linkFor = () => supaAdmin.auth.admin.generateLink({ type: 'magiclink', email })
  let link = await linkFor()
  if (link.error) throw new Error(`generateLink ${email}: ${link.error.message}`)
  if (link.data.user && !link.data.user.email_confirmed_at) {
    await supaAdmin.auth.admin.updateUserById(link.data.user.id, { email_confirm: true })
    link = await linkFor()
  }
  const otp = await supaAdmin.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })
  if (otp.error) throw new Error(`verifyOtp ${email}: ${otp.error.message}`)
  return { token: otp.data.session.access_token, id: otp.data.session.user.id }
}

async function upsertAdmin(email) {
  const { data, error } = await supaAdmin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { role: 'super-admin' } })
  let user = data?.user
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) throw new Error(`createUser ${email}: ${error.message}`)
    const list = await supaAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    user = list.data.users.find((u) => u.email === email)
  }
  if (!user) throw new Error(`admin user not found: ${email}`)
  await supaAdmin.auth.admin.updateUserById(user.id, { app_metadata: { role: 'super-admin' } })
  const t = await mint(email)
  await db.query(
    `insert into super_admins (id, email, full_name, status) values ($1,$2,'bench admin','active')
     on conflict (id) do update set status='active'`, [t.id, email])
  return t
}

const F = {
  seekerA: { email: 'spike.seeker.003@joblinked-spike.test' },
  seekerB: { email: 'spike.seeker.012@joblinked-spike.test' },
  employerA: { email: 'spike.employer.010@joblinked-spike.test' },
  employerB: { email: 'spike.employer.018@joblinked-spike.test' },
  admin: { email: 'bench.admin@joblinked-spike.test' },
}

async function provision(account, role, extra = {}) {
  const s = await mint(account.email)
  account.token = s.token
  account.id = s.id
  const me = await req('GET', '/api/auth/me', { token: s.token })
  if (me.status === 404) {
    const body = { role, email: account.email, first_name: 'Bench', last_name: role, ...extra }
    const p = await req('POST', '/api/auth/provision', { token: s.token, body })
    if (p.status !== 201) throw new Error(`provision ${account.email}: ${p.status} ${p.text}`)
    account.profile = p.body
  } else if (me.status === 200) {
    account.profile = me.body
  } else {
    throw new Error(`me ${account.email}: ${me.status} ${me.text}`)
  }
}

async function setup() {
  await provision(F.seekerA, 'job-seeker')
  await provision(F.seekerB, 'job-seeker')
  await provision(F.employerA, 'employer', { company_name: 'Bench Employer A' })
  await provision(F.employerB, 'employer', { company_name: 'Bench Employer B' })
  F.admin = await upsertAdmin(F.admin.email)

  // Employer A must be accredited before it can publish (ADR-022).
  const { rows } = await db.query(
    `select id from employer_accreditations where company_id = $1 order by submitted_at desc limit 1`, [F.employerA.id])
  if (rows[0]) {
    const r = await req('PATCH', `/api/accreditations/${rows[0].id}`, { token: F.admin.token, body: { status: 'approved' } })
    if (r.status !== 200) throw new Error(`approve accreditation: ${r.status} ${r.text}`)
  }
  // Wipe per-run artifacts so runs are repeatable.
  await db.query(`delete from job_vacancies where company_id = any($1::uuid[]) and title like 'Bench %'`,
    [[F.employerA.id, F.employerB.id]])
}

// ------------------------------------------------------------------ checks
function ok(name, r, expected = 200) {
  check(`${name} -> ${expected}`, r.status === expected, `got ${r.status} ${r.text?.slice(0, 300)}`)
  return r
}
function errCode(r) { return r.body?.error?.code }

// ================================================================== TESTS
await setup()

if (enabled('auth')) {
  section('AUTH / PROVISION / HEALTH')
  ok('health', await req('GET', '/api/health'))
  const h = await req('GET', '/api/health')
  eq('health payload', h.body, { ok: true, db: 'ok' })

  ok('me without token -> 401', await req('GET', '/api/auth/me'), 401)
  ok('me invalid token -> 401', await req('GET', '/api/auth/me', { token: 'nope' }), 401)
  ok('me seekerA', await req('GET', '/api/auth/me', { token: F.seekerA.token }))
  const me = await req('GET', '/api/auth/me', { token: F.seekerA.token })
  eq('me role', me.body.role, 'job-seeker')

  // Idempotent provision: second call answers the existing row with 200.
  const again = await req('POST', '/api/auth/provision', { token: F.seekerA.token, body: { role: 'job-seeker' } })
  ok('provision twice -> 200', again, 200)
  eq('provision twice id', again.body.id, F.seekerA.id)

  // A client-writable body role must never create a super-admin.
  const forged = await req('POST', '/api/auth/provision', { token: F.seekerB.token, body: { role: 'super-admin' } })
  ok('forged super-admin provision -> 403', forged, 403)
  eq('forged provision code', errCode(forged), 'FORBIDDEN')

  ok('audit no token -> 401', await req('POST', '/api/audit', { body: { action: 'auth.login' } }), 401)
  ok('audit unknown action -> 400', await req('POST', '/api/audit', { token: F.seekerA.token, body: { action: 'admin.login' } }), 400)
  ok('audit valid action -> 204', await req('POST', '/api/audit', { token: F.seekerA.token, body: { action: 'auth.login' } }), 204)
}

let jobA, draftA, jobId, up, resumeId, rel

if (enabled('jobs')) {
  section('JOBS')
  ok('seeker cannot create job -> 403',
    await req('POST', '/api/jobs', { token: F.seekerA.token, body: { title: 'nope' } }), 403)
  ok('job requires title -> 400',
    await req('POST', '/api/jobs', { token: F.employerA.token, body: {} }), 400)
  ok('invalid work_arrangement -> 400',
    await req('POST', '/api/jobs', { token: F.employerA.token, body: { title: 'x', work_arrangement: 'moon' } }), 400)

  // Employer B is not accredited: drafts allowed, publish refused.
  const draftB = await req('POST', '/api/jobs', { token: F.employerB.token, body: { title: 'Bench Draft B', status: 'draft' } })
  ok('unaccredited draft allowed', draftB, 201)
  eq('draft status', draftB.body.status, 'draft')
  const pubB = await req('POST', '/api/jobs', { token: F.employerB.token, body: { title: 'Bench Publish B' } })
  ok('unaccredited publish -> 403', pubB, 403)

  draftA = await req('POST', '/api/jobs', { token: F.employerA.token, body: {
    title: 'Bench Draft A', status: 'draft', description: 'secret draft body', tags: ['php', 'sql'] } })
  ok('accredited draft created', draftA, 201)

  jobA = await req('POST', '/api/jobs', { token: F.employerA.token, body: {
    title: 'Bench Published A', description: 'public body', location: 'Santa Maria',
    employment_type: 'Full-time', work_arrangement: 'On-site', salary_min: 15000, salary_max: 25000,
    tags: ['php', 'benchspecific'], vacancies: 2,
  } })
  ok('accredited publish created', jobA, 201)
  eq('published status', jobA.body.status, 'published')
  check('published_at stamped', Boolean(jobA.body.published_at), String(jobA.body.published_at))
  jobId = jobA.body.id

  // Cross-tenant write.
  ok('employer B cannot patch A job -> 403',
    await req('PATCH', `/api/jobs/${jobId}`, { token: F.employerB.token, body: { title: 'stolen' } }), 403)
  ok('seeker cannot patch A job -> 403',
    await req('PATCH', `/api/jobs/${jobId}`, { token: F.seekerA.token, body: { title: 'stolen' } }), 403)
  ok('patch nothing -> 400', await req('PATCH', `/api/jobs/${jobId}`, { token: F.employerA.token, body: {} }), 400)
  ok('patch vacancies empty -> 400',
    await req('PATCH', `/api/jobs/${jobId}`, { token: F.employerA.token, body: { vacancies: '' } }), 400)
  const patched = await req('PATCH', `/api/jobs/${jobId}`, { token: F.employerA.token, body: { title: 'Bench Published A2' } })
  ok('owner patch', patched)
  eq('patched title', patched.body.title, 'Bench Published A2')

  const dupe = await req('POST', `/api/jobs/${jobId}/duplicate`, { token: F.employerA.token })
  ok('duplicate job', dupe, 201)
  eq('duplicate is draft', dupe.body.status, 'draft')
  eq('duplicate title', dupe.body.title, 'Bench Published A2 (Copy)')
  eq('duplicate cleared deadline', dupe.body.deadline, null)

  // Public visibility.
  const list = await req('GET', '/api/jobs?page=1&pageSize=100')
  ok('public list', list)
  check('public list only published', (list.body.jobs || []).every((j) => j.status === 'published'))
  check('draft absent from public list', !(list.body.jobs || []).some((j) => j.id === draftA.body.id))
  check('published present', (list.body.jobs || []).some((j) => j.id === jobId))

  ok('draft detail anon -> 404', await req('GET', `/api/jobs/${draftA.body.id}`), 404)
  ok('draft detail owner -> 200', await req('GET', `/api/jobs/${draftA.body.id}`, { token: F.employerA.token }))
  ok('published detail anon', await req('GET', `/api/jobs/${jobId}`))
  ok('invalid uuid -> 404', await req('GET', '/api/jobs/not-a-uuid'), 404)

  const search = await req('GET', '/api/jobs?search=Bench%20Published')
  check('search finds job', (search.body.jobs || []).some((j) => j.id === jobId), JSON.stringify(search.body).slice(0, 200))
  const wildcard = await req('GET', '/api/jobs?search=%25%25%25')
  ok('like-wildcard search survives', wildcard)
  eq('like-wildcard does not match all', wildcard.body.total, 0)
  ok('bad page -> 400', await req('GET', '/api/jobs?page=abc'), 400)
  ok('bad workArrangement -> 400', await req('GET', '/api/jobs?workArrangement=moon'), 400)
  ok('bad order col is ignored safely', await req('GET', '/api/jobs?order=drop%20table.desc'))
  const bySkills = await req('GET', '/api/jobs?skills=benchspecific')
  check('skills filter finds job', (bySkills.body.jobs || []).some((j) => j.id === jobId))

  // Employer job list envelope + cross-tenant.
  const own = await req('GET', `/api/employers/${F.employerA.id}/jobs`, { token: F.employerA.token })
  ok('employer own jobs', own)
  check('envelope counts.published >= 1', own.body.counts?.published >= 1, JSON.stringify(own.body.counts))
  ok('employer B reads A jobs -> 403',
    await req('GET', `/api/employers/${F.employerA.id}/jobs`, { token: F.employerB.token }), 403)
  ok('invalid employer uuid -> 400',
    await req('GET', '/api/employers/nope/jobs', { token: F.employerA.token }), 400)

  const hist = await req('GET', `/api/jobs/${jobId}/history`, { token: F.employerA.token })
  ok('job history', hist)
  check('history has publish row', (hist.body || []).some((h) => h.status === 'published'))
  ok('other employer history -> 403',
    await req('GET', `/api/jobs/${jobId}/history`, { token: F.employerB.token }), 403)

  // Admin status flow.
  ok('admin unpublish', await req('POST', `/api/admin/jobs/${jobId}/unpublish`, { token: F.admin.token }))
  const afterUnpub = await req('GET', `/api/jobs/${jobId}`, { token: F.employerA.token })
  eq('unpublished status', afterUnpub.body.status, 'draft')
  ok('admin republish', await req('POST', `/api/admin/jobs/${jobId}/publish`, { token: F.admin.token }))
  const afterPub = await req('GET', `/api/jobs/${jobId}`)
  eq('republished visible', afterPub.body.status, 'published')

  // Past-deadline job for the application guard.
  const expired = await req('POST', '/api/jobs', { token: F.employerA.token, body: {
    title: 'Bench Expired A', deadline: '2020-01-01' } })
  ok('expired job created', expired, 201)
  F.expiredJobId = expired.body.id

  // Admin patch validation.
  ok('admin patch invalid status -> 400',
    await req('PATCH', `/api/admin/jobs/${jobId}`, { token: F.admin.token, body: { status: 'nope' } }), 400)
  ok('admin patch vacancies empty -> 400',
    await req('PATCH', `/api/admin/jobs/${jobId}`, { token: F.admin.token, body: { vacancies: '' } }), 400)
  ok('admin patch invalid uuid -> 404',
    await req('PATCH', '/api/admin/jobs/nope', { token: F.admin.token, body: { title: 'x' } }), 404)
}

if (enabled('applications')) {
  section('APPLICATIONS')
  // Resume upload (real multipart + disk).
  const resumeBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
  up = await req('POST', '/api/files/resumes', {
    token: F.seekerA.token,
    form: (() => { const f = new FormData(); f.append('file', new Blob([resumeBytes], { type: 'application/pdf' }), 'bench-resume.pdf'); return f })(),
  })
  ok('resume upload', up, 201)
  resumeId = up.body.resume?.id
  check('resume row active', up.body.resume?.is_active === true)
  check('resume path namespaced', String(up.body.path).startsWith(`resumes/${F.seekerA.id}/`), up.body.path)

  ok('no file -> 400',
    await req('POST', '/api/files/resumes', { token: F.seekerA.token, form: new FormData() }), 400)
  ok('bad extension -> 400', await req('POST', '/api/files/resumes', {
    token: F.seekerA.token,
    form: (() => { const f = new FormData(); f.append('file', new Blob(['MZ']), 'malware.exe'); return f })(),
  }), 400)

  const appA = await req('POST', '/api/applications', { token: F.seekerA.token, body: { job_id: F.expiredJobId } })
  ok('apply expired -> 400', appA, 400)
  const apply = await req('POST', '/api/applications', { token: F.seekerA.token, body: { job_id: jobA.body.id, resume_id: resumeId } })
  ok('apply', apply, 201)
  const applyId = apply.body.id
  const dup = await req('POST', '/api/applications', { token: F.seekerA.token, body: { job_id: jobA.body.id } })
  ok('double apply -> 409', dup, 409)
  eq('double apply code', errCode(dup), 'CONFLICT')
  ok('apply to draft -> 400',
    await req('POST', '/api/applications', { token: F.seekerA.token, body: { job_id: draftA.body.id } }), 400)
  ok('apply with foreign resume -> 400',
    await req('POST', '/api/applications', { token: F.seekerB.token, body: { job_id: jobA.body.id, resume_id: resumeId } }), 400)
  ok('employer cannot apply -> 403',
    await req('POST', '/api/applications', { token: F.employerA.token, body: { job_id: jobA.body.id } }), 403)

  const mine = await req('GET', '/api/applications/mine', { token: F.seekerA.token })
  ok('my applications', mine)
  const mineApp = (mine.body || []).find((a) => a.id === applyId)
  check('application embeds job', mineApp?.job?.id === jobA.body.id)
  check('application embeds resume', mineApp?.resume?.id === resumeId)
  check('fresh application history is an array', Array.isArray(mineApp?.history) && mineApp.history.length === 0)

  ok('employer B reads job applicants -> 403',
    await req('GET', `/api/applications/job/${jobA.body.id}`, { token: F.employerB.token }), 403)
  const applicants = await req('GET', `/api/applications/job/${jobA.body.id}`, { token: F.employerA.token })
  ok('employer reads applicants', applicants)
  check('applicant PII embedded', Boolean(applicants.body?.[0]?.seeker?.full_name))

  ok('employer B company scope -> 403',
    await req('GET', `/api/applications/company/${F.employerA.id}`, { token: F.employerB.token }), 403)
  ok('employer own company scope',
    await req('GET', `/api/applications/company/${F.employerA.id}`, { token: F.employerA.token }))
  ok('invalid company uuid -> 400',
    await req('GET', '/api/applications/company/nope', { token: F.employerA.token }), 400)

  const dash = await req('GET', '/api/applications/employers/me/dashboard', { token: F.employerA.token })
  ok('employer dashboard', dash)
  check('dashboard stats total >= 1', dash.body?.stats?.total_candidates >= 1, JSON.stringify(dash.body?.stats))

  // Status transitions + trigger + notifications.
  const before = await req('GET', '/api/notifications/mine', { token: F.seekerA.token })
  const interview = await req('POST', `/api/applications/${applyId}/status`, {
    token: F.employerA.token, body: { status: 'Interview', interviewAt: '2026-12-01T09:00:00Z', interviewInstructions: 'Bring ID' } })
  ok('set Interview', interview)
  eq('status Interview', interview.body.status, 'Interview')
  check('interview_at persisted', interview.body.interview_at !== null)
  ok('invalid status -> 400',
    await req('POST', `/api/applications/${applyId}/status`, { token: F.employerA.token, body: { status: 'Hired' } }), 400)
  ok('employer B cannot change status -> 403',
    await req('POST', `/api/applications/${applyId}/status`, { token: F.employerB.token, body: { status: 'Rejected' } }), 403)

  const accepted = await req('POST', `/api/applications/${applyId}/status`, { token: F.employerA.token, body: { status: 'Accepted' } })
  ok('set Accepted', accepted)
  const emp = await db.query('select * from employment_history where application_id = $1', [applyId])
  check('employment_history trigger row', emp.rowCount === 1, `rows=${emp.rowCount}`)
  check('employment_history is_current', emp.rows[0]?.is_current === true)
  check('employment_history employer name', emp.rows[0]?.employer_name === 'bench employer a', emp.rows[0]?.employer_name)

  const placed = await req('POST', `/api/applications/${applyId}/status`, { token: F.employerA.token, body: { status: 'Placed' } })
  ok('set Placed', placed)
  const terminated = await req('POST', `/api/applications/${applyId}/status`, { token: F.employerA.token, body: { status: 'Terminated' } })
  ok('set Terminated', terminated)
  const emp2 = await db.query('select * from employment_history where application_id = $1', [applyId])
  check('terminated closes employment', emp2.rows[0]?.is_current === false)

  const hist = await req('GET', `/api/applications/${applyId}/history`, { token: F.seekerA.token })
  ok('seeker reads own history', hist)
  eq('history transition count', hist.body.length, 4)
  ok('other seeker history -> 403',
    await req('GET', `/api/applications/${applyId}/history`, { token: F.seekerB.token }), 403)
  ok('invalid application uuid -> 404',
    await req('GET', '/api/applications/nope/history', { token: F.seekerA.token }), 404)

  const after = await req('GET', '/api/notifications/mine', { token: F.seekerA.token })
  check('seeker notified of transition', (after.body || []).length > (before.body || []).length,
    `${before.body?.length} -> ${after.body?.length}`)

  // Credential reads are link-scoped.
  const seekerEducation = await req('GET', `/api/applications/seekers/${F.seekerA.id}/education`, { token: F.employerA.token })
  ok('linked employer reads education', seekerEducation)
  ok('unlinked employer reads education -> 403',
    await req('GET', `/api/applications/seekers/${F.seekerA.id}/education`, { token: F.employerB.token }), 403)
  ok('seeker reads own education',
    await req('GET', `/api/applications/seekers/${F.seekerA.id}/education`, { token: F.seekerA.token }))
  ok('invalid seeker uuid -> 400',
    await req('GET', '/api/applications/seekers/nope/experience', { token: F.employerA.token }), 400)

  // Resume file access: owner, linked employer, everyone else.
  rel = up.body.path
  const ownFile = await req('GET', `/api/files/${rel}`, { token: F.seekerA.token })
  ok('owner downloads resume', ownFile)
  check('resume bytes served', ownFile.text.startsWith('%PDF'))
  ok('linked employer downloads resume', await req('GET', `/api/files/${rel}`, { token: F.employerA.token }))
  ok('unlinked employer download -> 403', await req('GET', `/api/files/${rel}`, { token: F.employerB.token }), 403)
  ok('other seeker download -> 403', await req('GET', `/api/files/${rel}`, { token: F.seekerB.token }), 403)
  ok('anon download -> 401', await req('GET', `/api/files/${rel}`), 401)
  ok('unknown bucket -> 404', await req('GET', '/api/files/private/x', { token: F.admin.token }), 404)
  const traversal = await req('GET', '/api/files/documents/..%2f..%2fpackage.json', { token: F.admin.token })
  check('path traversal refused', [400, 404].includes(traversal.status), `got ${traversal.status}`)
  check('path traversal leaks nothing', !String(traversal.text).includes('"name"'), traversal.text.slice(0, 120))

  // Resume lifecycle.
  const mineRes = await req('GET', '/api/files/resumes/mine', { token: F.seekerA.token })
  ok('resume list', mineRes)
  check('one active resume', (mineRes.body || []).filter((r) => r.is_active).length === 1)
  ok('other seeker deletes resume -> 403',
    await req('DELETE', `/api/files/resumes/${resumeId}`, { token: F.seekerB.token }), 403)
}

if (enabled('admin')) {
  section('ADMIN')
  ok('seeker admin stats -> 403', await req('GET', '/api/admin/stats', { token: F.seekerA.token }), 403)
  ok('employer admin stats -> 403', await req('GET', '/api/admin/stats', { token: F.employerA.token }), 403)
  const stats = await req('GET', '/api/admin/stats', { token: F.admin.token })
  ok('admin stats', stats)
  check('stats numeric', typeof stats.body.seekers === 'number' && typeof stats.body.jobs === 'number')

  const users = await req('GET', '/api/admin/users?page=1&pageSize=5', { token: F.admin.token })
  ok('admin users list', users)
  check('users envelope', Array.isArray(users.body.data) && typeof users.body.total === 'number')
  ok('admin users bad role -> 400', await req('GET', '/api/admin/users?role=nope', { token: F.admin.token }), 400)
  ok('admin users bad status -> 400', await req('GET', '/api/admin/users?status=nope', { token: F.admin.token }), 400)
  const attrSearch = await req('GET', '/api/admin/users?search=%25%25%25', { token: F.admin.token })
  ok('admin users wildcard search', attrSearch)
  eq('admin wildcard search does not match all', attrSearch.body.total, 0)

  ok('admin patch missing user -> 404',
    await req('PATCH', '/api/admin/users/00000000-0000-4000-8000-000000000000', { token: F.admin.token, body: { status: 'active' } }), 404)
  ok('admin patch invalid uuid -> 404',
    await req('PATCH', '/api/admin/users/nope', { token: F.admin.token, body: { status: 'active' } }), 404)
  ok('admin cannot change own status -> 403',
    await req('PATCH', `/api/admin/users/${F.admin.id}`, { token: F.admin.token, body: { status: 'suspended' } }), 403)
  ok('admin cannot change own role -> 403',
    await req('POST', `/api/admin/users/${F.admin.id}/role`, { token: F.admin.token, body: { role: 'job-seeker' } }), 403)

  // Suspend / reinstate a real account: status must gate the token immediately.
  ok('suspend seekerB', await req('PATCH', `/api/admin/users/${F.seekerB.id}`, { token: F.admin.token, body: { status: 'suspended' } }))
  const blocked = await req('GET', '/api/auth/me', { token: F.seekerB.token })
  ok('suspended session -> 403', blocked, 403)
  check('suspension message', /suspended|deactivated/i.test(blocked.body?.error?.message || ''), blocked.text)
  ok('reinstate seekerB', await req('PATCH', `/api/admin/users/${F.seekerB.id}`, { token: F.admin.token, body: { status: 'active' } }))
  ok('reinstated session works', await req('GET', '/api/auth/me', { token: F.seekerB.token }))

  // Invite: validation, duplicate, real send.
  ok('invite missing fields -> 400', await req('POST', '/api/admin/users/invite', { token: F.admin.token, body: { email: 'x@y.z' } }), 400)
  ok('invite unknown role -> 400', await req('POST', '/api/admin/users/invite', {
    token: F.admin.token, body: { email: 'x@y.z', first_name: 'A', last_name: 'B', role: 'god' } }), 400)
  ok('invite employer missing company -> 400', await req('POST', '/api/admin/users/invite', {
    token: F.admin.token, body: { email: 'x@y.z', first_name: 'A', last_name: 'B', role: 'employer' } }), 400)
  ok('invite duplicate email -> 409', await req('POST', '/api/admin/users/invite', {
    token: F.admin.token, body: { email: F.seekerA.email, first_name: 'A', last_name: 'B', role: 'job-seeker' } }), 409)
  const inviteEmail = `bench.invite.${Date.now()}@joblinked-spike.test`
  const invited = await req('POST', '/api/admin/users/invite', {
    token: F.admin.token, body: { email: inviteEmail, first_name: 'Bench', last_name: 'Invite', role: 'job-seeker' } })
  if (invited.status === 429) {
    // Supabase's own email rate limit: must surface as retryable 429, never the
    // old fake 409 "email already registered".
    eq('invite upstream rate limit is 429', errCode(invited), 'RATE_LIMITED')
  } else {
    ok('invite created', invited, 201)
    eq('invite response', [invited.body.invited, invited.body.role], [true, 'job-seeker'])
  }

  ok('companies list', await req('GET', '/api/admin/companies', { token: F.admin.token }))
  ok('companies bad status -> 400', await req('GET', '/api/admin/companies?status=nope', { token: F.admin.token }), 400)
  ok('admin jobs list', await req('GET', '/api/admin/jobs', { token: F.admin.token }))
  ok('admin jobs bad status -> 400', await req('GET', '/api/admin/jobs?status=nope', { token: F.admin.token }), 400)
  ok('admin applications list', await req('GET', '/api/admin/applications', { token: F.admin.token }))
  ok('admin applications bad status -> 400', await req('GET', '/api/admin/applications?status=Hired', { token: F.admin.token }), 400)
  ok('admin employees list', await req('GET', '/api/admin/employees', { token: F.admin.token }))
  ok('admin referrals list', await req('GET', '/api/admin/referrals', { token: F.admin.token }))
  ok('admin accreditations list', await req('GET', '/api/admin/accreditations', { token: F.admin.token }))

  ok('audit logs list', await req('GET', '/api/admin/audit-logs?limit=5', { token: F.admin.token }))
  ok('audit bad userId -> 400', await req('GET', '/api/admin/audit-logs?userId=nope', { token: F.admin.token }), 400)
  ok('audit bad from -> 400', await req('GET', '/api/admin/audit-logs?from=yesterday', { token: F.admin.token }), 400)
  ok('audit bad to -> 400', await req('GET', '/api/admin/audit-logs?to=2026/01/01', { token: F.admin.token }), 400)
  const logs = await req('GET', `/api/admin/audit-logs?userId=${F.seekerA.id}&limit=3`, { token: F.admin.token })
  check('audit filter by user', Array.isArray(logs.body) && logs.body.length <= 3)
  ok('audit limit clamps', await req('GET', '/api/admin/audit-logs?limit=999999', { token: F.admin.token }))

  // Reference data CRUD.
  const refCat = `bench_cat_${Date.now()}`
  ok('reference list', await req('GET', '/api/admin/reference/education_level', { token: F.admin.token }))
  const refNew = await req('POST', `/api/admin/reference/${refCat}`, { token: F.admin.token, body: { value: 'Bench Value' } })
  ok('reference create', refNew, 201)
  ok('reference duplicate -> 409', await req('POST', `/api/admin/reference/${refCat}`, { token: F.admin.token, body: { value: 'Bench Value' } }), 409)
  ok('reference delete', await req('DELETE', `/api/admin/reference/${refNew.body.id}`, { token: F.admin.token }))
  ok('reference delete again -> 404', await req('DELETE', `/api/admin/reference/${refNew.body.id}`, { token: F.admin.token }), 404)
  ok('reference bad id -> 400', await req('DELETE', '/api/admin/reference/nope', { token: F.admin.token }), 400)

  // Custom roles CRUD + assignment.
  ok('permissions catalog', await req('GET', '/api/admin/permissions', { token: F.admin.token }))
  const roleName = `Bench Role ${Date.now()}`
  const roleNew = await req('POST', '/api/admin/roles', { token: F.admin.token, body: {
    name: roleName, description: 'bench', permissions: ['reports.view', 'bogus.key'], base_role: 'super-admin' } })
  ok('role create', roleNew, 201)
  eq('role filters unknown permission', roleNew.body.permissions, ['reports.view'])
  ok('role duplicate -> 409', await req('POST', '/api/admin/roles', { token: F.admin.token, body: { name: roleName } }), 409)
  ok('role invalid base -> 400', await req('POST', '/api/admin/roles', { token: F.admin.token, body: { name: `${roleName} x`, base_role: 'god' } }), 400)
  const roleId = roleNew.body.id
  const rolePatch = await req('PATCH', `/api/admin/roles/${roleId}`, { token: F.admin.token, body: { description: 'patched' } })
  ok('role patch', rolePatch)
  eq('role patch persisted', rolePatch.body.description, 'patched')
  ok('role patch bad id -> 400', await req('PATCH', '/api/admin/roles/nope', { token: F.admin.token, body: { name: 'x' } }), 400)
  const assign = await req('POST', `/api/admin/users/${F.seekerB.id}/custom-role`, { token: F.admin.token, body: { custom_role_id: roleId } })
  ok('custom role assign', assign)
  eq('custom role id stored', assign.body.custom_role_id, roleId)
  ok('unknown custom role -> 400', await req('POST', `/api/admin/users/${F.seekerB.id}/custom-role`, {
    token: F.admin.token, body: { custom_role_id: 99999999 } }), 400)
  ok('role delete', await req('DELETE', `/api/admin/roles/${roleId}`, { token: F.admin.token }))
  const cleared = await db.query('select custom_role_id from job_seekers where id = $1', [F.seekerB.id])
  check('role delete clears tags', cleared.rows[0]?.custom_role_id === null, String(cleared.rows[0]?.custom_role_id))

  // Seeker child reads.
  ok('admin reads seeker education', await req('GET', `/api/admin/seekers/${F.seekerA.id}/education`, { token: F.admin.token }))
  ok('admin reads seeker experience', await req('GET', `/api/admin/seekers/${F.seekerA.id}/experience`, { token: F.admin.token }))
  ok('admin reads seeker employment', await req('GET', `/api/admin/seekers/${F.seekerA.id}/employment`, { token: F.admin.token }))
  ok('admin seeker child bad uuid -> 404', await req('GET', '/api/admin/seekers/nope/education', { token: F.admin.token }), 404)

  // Accreditation lifecycle (employer B: pending -> rejected -> approved).
  ok('employer resubmits accreditation', await req('POST', '/api/accreditations', { token: F.employerB.token }), 201)
  const accB = await db.query(`select id from employer_accreditations where company_id = $1 and status = 'pending' order by submitted_at desc limit 1`, [F.employerB.id])
  const accId = accB.rows[0].id
  ok('accreditation bad status -> 400', await req('PATCH', `/api/accreditations/${accId}`, { token: F.admin.token, body: { status: 'nope' } }), 400)
  ok('accreditation bad uuid -> 404', await req('PATCH', '/api/accreditations/nope', { token: F.admin.token, body: { status: 'approved' } }), 404)
  ok('accreditation reject', await req('PATCH', `/api/accreditations/${accId}`, { token: F.admin.token, body: { status: 'rejected', remarks: 'missing permit' } }))
  const companyB = await db.query('select accreditation_status, accreditation_remarks from employers where id = $1', [F.employerB.id])
  eq('trigger synced status', companyB.rows[0]?.accreditation_status, 'rejected')
  eq('trigger synced remarks', companyB.rows[0]?.accreditation_remarks, 'missing permit')
  const accList = await req('GET', `/api/accreditations/company/${F.employerB.id}`, { token: F.employerB.token })
  ok('employer reads own accreditation', accList)
  ok('other employer reads accreditation -> 403',
    await req('GET', `/api/accreditations/company/${F.employerB.id}`, { token: F.employerA.token }), 403)
  ok('employer cannot decide accreditation -> 403',
    await req('PATCH', `/api/accreditations/${accId}`, { token: F.employerB.token, body: { status: 'approved' } }), 403)

  // Document upload + review.
  const docForm = (name) => { const f = new FormData(); f.append('file', new Blob(['%PDF-1.4 bench'], { type: 'application/pdf' }), name); f.append('doc_type', 'business_permit'); return f }
  const doc = await req('POST', '/api/documents', { token: F.employerB.token, form: docForm('permit.pdf') })
  ok('document upload', doc, 201)
  const docId = doc.body.id
  ok('document without doc_type -> 400', await req('POST', '/api/files/documents', { token: F.employerB.token, form: (() => { const f = new FormData(); f.append('file', new Blob(['x']), 'x.pdf'); return f })() }), 400)
  ok('other employer cannot read documents -> 403',
    await req('GET', `/api/documents/company/${F.employerB.id}`, { token: F.employerA.token }), 403)
  ok('admin reads documents', await req('GET', `/api/documents/company/${F.employerB.id}`, { token: F.admin.token }))
  ok('document bad status -> 400', await req('PATCH', `/api/documents/${docId}`, { token: F.admin.token, body: { status: 'nope' } }), 400)
  ok('document verify', await req('PATCH', `/api/documents/${docId}`, { token: F.admin.token, body: { status: 'verified' } }))
  const docRel = (await db.query('select file_path from employer_documents where id = $1', [docId])).rows[0].file_path
  ok('employer downloads own document', await req('GET', `/api/files/${docRel}`, { token: F.employerB.token }))
  ok('other employer downloads document -> 403', await req('GET', `/api/files/${docRel}`, { token: F.employerA.token }), 403)

  // System broadcast.
  ok('broadcast missing title -> 400', await req('POST', '/api/admin/system-notifications', { token: F.admin.token, body: { message: 'x' } }), 400)
  const bcast = await req('POST', '/api/admin/system-notifications', { token: F.admin.token, body: {
    title: 'Bench broadcast', message: 'hello bench' } })
  ok('broadcast sent', bcast)
  check('broadcast fan-out > 0', bcast.body.sent > 0, String(bcast.body.sent))
  const notices = await req('GET', '/api/notifications/mine?unreadOnly=true', { token: F.seekerA.token })
  ok('unread notifications', notices)
  check('broadcast received', (notices.body || []).some((n) => n.title === 'Bench broadcast'))
  const nid = notices.body[0]?.id
  ok('mark one read', await req('POST', `/api/notifications/${nid}/read`, { token: F.seekerA.token }))
  ok('mark unknown read -> 404', await req('POST', '/api/notifications/99999999/read', { token: F.seekerA.token }), 404)
  ok('mark bad id -> 400', await req('POST', '/api/notifications/nope/read', { token: F.seekerA.token }), 400)
  const foreignNotice = await db.query(`select id from notifications where user_id <> $1 limit 1`, [F.seekerA.id])
  ok('cannot read another user notification -> 404',
    await req('POST', `/api/notifications/${foreignNotice.rows[0].id}/read`, { token: F.seekerA.token }), 404)
  ok('read all', await req('POST', '/api/notifications/read-all', { token: F.seekerA.token }))
  ok('delete notification', await req('DELETE', `/api/notifications/${nid}`, { token: F.seekerA.token }))
  ok('delete same again -> 404', await req('DELETE', `/api/notifications/${nid}`, { token: F.seekerA.token }), 404)
  ok('delete other user notification -> 404',
    await req('DELETE', `/api/notifications/${foreignNotice.rows[0].id}`, { token: F.seekerA.token }), 404)
}

if (enabled('reports')) {
  section('REPORTS')
  const types = ['applicants', 'vacancies', 'placements', 'employers', 'barangay', 'monthly', 'applications', 'jobs', 'seekers']
  for (const type of types) {
    const r = await req('GET', `/api/admin/reports/${type}/export`, { token: F.admin.token })
    ok(`export ${type}`, r)
    check(`export ${type} content-type`, String(r.headers['content-type']).startsWith('text/csv'), r.headers['content-type'])
    check(`export ${type} attachment`, /attachment; filename=/.test(r.headers['content-disposition'] || ''))
    check(`export ${type} has header row`, r.text.split('\n')[0].includes(','), r.text.slice(0, 80))
  }
  ok('export bad type -> 400', await req('GET', '/api/admin/reports/nope/export', { token: F.admin.token }), 400)
  ok('export bad format -> 400', await req('GET', '/api/admin/reports/seekers/export?format=pdf', { token: F.admin.token }), 400)
  ok('export bad page -> 400', await req('GET', '/api/admin/reports/seekers/export?page=abc', { token: F.admin.token }), 400)

  // CSV formula injection: real stored value, real export.
  const original = await req('GET', '/api/seekers/me', { token: F.seekerA.token })
  await req('PATCH', '/api/seekers/me', { token: F.seekerA.token, body: { full_name: '=cmd|calc!A1' } })
  const injected = await req('GET', '/api/admin/reports/seekers/export?pageSize=2000', { token: F.admin.token })
  check('csv injection neutralised', injected.text.includes(`"'=cmd|calc!a1"`),
    (injected.text.split('\n').find((l) => l.includes('cmd|calc')) || '').slice(0, 120))
  await req('PATCH', '/api/seekers/me', { token: F.seekerA.token, body: { full_name: original.body.full_name || 'Bench Seeker' } })
}

if (enabled('security')) {
  section('SECURITY / ROBUSTNESS')
  ok('unknown route -> 404', await req('GET', '/api/nope'), 404)
  eq('unknown route code', errCode(await req('GET', '/api/nope')), 'NOT_FOUND')

  const malformed = await fetch(BASE + '/api/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${F.employerA.token}` }, body: '{bad json' })
  await malformed.text()
  eq('malformed json -> 400', malformed.status, 400)

  const big = await fetch(BASE + '/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${F.employerA.token}` },
    body: JSON.stringify({ title: 'x', description: 'y'.repeat(1_200_000) }) })
  const bigBody = await big.json().catch(() => ({}))
  eq('oversized payload -> 400', big.status, 400)
  eq('oversized payload code', bigBody?.error?.code, 'PAYLOAD_TOO_LARGE')

  const helmet = await req('GET', '/api/health')
  eq('helmet nosniff', helmet.headers['x-content-type-options'], 'nosniff')
  check('request id header', Boolean(helmet.headers['x-request-id']), Object.keys(helmet.headers).join(','))

  const evil = await fetch(BASE + '/api/health', { headers: { origin: 'https://evil.example' } })
  await evil.text()
  check('cors rejects unknown origin', !evil.headers.get('access-control-allow-origin'), evil.headers.get('access-control-allow-origin'))
  const good = await fetch(BASE + '/api/health', { headers: { origin: 'http://localhost:5173' } })
  await good.text()
  eq('cors allows configured origin', good.headers.get('access-control-allow-origin'), 'http://localhost:5173')

  // SQL-injection-shaped search must return cleanly.
  const sqli = await req('GET', "/api/jobs?search='%20or%201=1--")
  ok('sqli-shaped search survives', sqli)
  eq('sqli-shaped search returns no all-rows', sqli.body.total, 0)

  // Stored XSS-shaped title comes back as data, never executable markup.
  const xss = await req('POST', '/api/jobs', { token: F.employerA.token, body: { title: '<img src=x onerror=alert(1)>', status: 'draft' } })
  ok('xss-shaped title accepted as data', xss, 201)
  const xssRead = await req('GET', `/api/jobs/${xss.body.id}`, { token: F.employerA.token })
  eq('xss title round-trips verbatim', xssRead.body.title, '<img src=x onerror=alert(1)>')

  // Large page sizes are clamped, not honoured unbounded.
  const clamped = await req('GET', '/api/jobs?pageSize=100000', { token: F.admin.token })
  ok('pageSize clamp', clamped)
  check('pageSize <= 100', clamped.body.pageSize <= 100, String(clamped.body.pageSize))
}

if (enabled('roles')) {
  section('ROLE MOVE INVARIANTS')
  const beforeApps = await db.query('select count(*)::int n from job_applications where seeker_id = $1', [F.seekerB.id])
  const toEmployer = await req('POST', `/api/admin/users/${F.seekerB.id}/role`, { token: F.admin.token, body: { role: 'employer' } })
  ok('move seeker -> employer', toEmployer)
  const meEmployer = await req('GET', '/api/auth/me', { token: F.seekerB.token })
  ok('moved account resolves', meEmployer)
  eq('moved role', meEmployer.body.role, 'employer')
  const oldRow = await db.query('select status from job_seekers where id = $1', [F.seekerB.id])
  eq('old row deactivated', oldRow.rows[0]?.status, 'inactive')
  const appsAfter = await db.query('select count(*)::int n from job_applications where seeker_id = $1', [F.seekerB.id])
  eq('applications preserved on move', appsAfter.rows[0].n, beforeApps.rows[0].n)

  const back = await req('POST', `/api/admin/users/${F.seekerB.id}/role`, { token: F.admin.token, body: { role: 'job-seeker' } })
  ok('move employer -> seeker', back)
  const meSeeker = await req('GET', '/api/auth/me', { token: F.seekerB.token })
  eq('moved back role', meSeeker.body.role, 'job-seeker')
  const reactivated = await db.query('select status from job_seekers where id = $1', [F.seekerB.id])
  eq('old row reactivated', reactivated.rows[0]?.status, 'active')
  ok('role move invalid role -> 400',
    await req('POST', `/api/admin/users/${F.seekerB.id}/role`, { token: F.admin.token, body: { role: 'god' } }), 400)
}

if (enabled('ratelimit')) {
  section('RATE LIMIT')
  // Pin one client IP so the auth bucket is deterministic. TRUST_PROXY=1 makes
  // X-Forwarded-For the client address, exactly like the documented deployment.
  const ip = `10.99.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`
  let saw429 = null
  for (let i = 0; i < 110; i += 1) {
    const r = await req('GET', '/api/auth/me', { headers: { 'x-forwarded-for': ip } })
    if (r.status === 429) { saw429 = r; break }
  }
  ok('auth limiter engages', saw429, 429)
  eq('rate limit code', errCode(saw429), 'RATE_LIMITED')
  check('retry-after header', Boolean(saw429.headers['retry-after']), Object.keys(saw429.headers).join(','))
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`)
await db.end()
process.exit(results.every((r) => r.ok) ? 0 : 1)
