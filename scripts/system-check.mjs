#!/usr/bin/env node
// Repeatable system smoke: drives a running site with headless Chrome and
// fails on console errors, page errors, failed requests, and (authed mode) 5xx.
//
//   public sweep (pre-deploy gate):
//     npm run build && npm run preview      # in one terminal
//     npm run syscheck                      # in another (defaults to :4173)
//
//   authed smoke (Phase 3, docs/plan/2026-11-04-05-testing-plan.md) — same
//   harness, `--smoke` mode. Needs the dev stack up and the fixtures applied:
//     psql -U postgres -h localhost -d joblinked -f db/seed-dev.sql   # once
//     npm run preview (or dev) + npm run dev:api
//     npm run smoke          # requires INTEGRATION_TEST=1
//
// The smoke creates the fixture auth users in Supabase with generated
// passwords (service-role key from server/.env — never stored in the repo) and
// signs each role in through the real login form: seeker browses + applies →
// employer reviews the applicant + changes status → admin approves the pending
// accreditation + downloads the report CSV → public /jobs/:id deep link.
// Without INTEGRATION_TEST=1, or without Supabase service credentials, it
// prints SKIP and exits 0 — a missing dev environment never fails a run.
//
// Exits 1 on any problem, 2 when no Chrome/Edge binary can be found.
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const flagValue = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  const v = i >= 0 ? argv[i + 1] : undefined
  return v && !v.startsWith('--') ? v : fallback
}
const BASE = flagValue('base', 'http://localhost:4173').replace(/\/$/, '')
const API = flagValue('api', 'http://127.0.0.1:4000').replace(/\/$/, '')
const SMOKE = argv.includes('--smoke')

// Fixture identities — mirrored by db/seed-dev.sql (same UUIDs and emails).
// Keep the two files in sync; a mismatch fails the smoke loudly, not silently.
const FIXTURES = {
  seeker:   { id: '5eed0000-0000-4000-8000-000000000001', email: 'smoke.seeker@joblinked.test',   role: 'job-seeker' },
  employer: { id: '5eed0000-0000-4000-8000-000000000002', email: 'smoke.employer@joblinked.test', role: 'employer' },
  pending:  { id: '5eed0000-0000-4000-8000-000000000003', email: 'smoke.pending@joblinked.test',  role: 'employer' },
  admin:    { id: '5eed0000-0000-4000-8000-000000000004', email: 'smoke.admin@joblinked.test',    role: 'super-admin' },
}
const JOB = { id: '5eed0000-0000-4000-8000-000000000011', title: 'Smoke Test Service Crew' }
const PENDING_COMPANY_HINT = 'smoke pending'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const die = (message) => { console.error(message); process.exit(1) }

// Public routes only: signed-in screens need a session, so they belong to the
// authed smoke (--smoke) rather than a pre-deploy gate.
const routes = [
  '/', '/jobs', '/login', '/signup', '/register',
  '/register/job-seeker', '/register/employer',
  '/forgot-password', '/reset-password', '/privacy', '/terms',
]

if (SMOKE && process.env.INTEGRATION_TEST !== '1') {
  console.log('[smoke] SKIP — INTEGRATION_TEST is not 1. Set it (with a running API + preview and db/seed-dev.sql applied) to run the authed smoke.')
  process.exit(0)
}

// Service-role credentials for the fixture auth users live in server/.env only.
const loadServerEnv = () => {
  try {
    for (const line of readFileSync(new URL('../server/.env', import.meta.url), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z0-9_]+)=(.*)$/.exec(line)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* no server/.env — the skip below handles it */ }
}
if (SMOKE) {
  loadServerEnv()
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[smoke] SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (server/.env); cannot create fixture accounts.')
    process.exit(0)
  }
}

const exeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
const executablePath = exeCandidates.find((p) => existsSync(p))
if (!executablePath) {
  console.error('[syscheck] no Chrome or Edge binary found; set PUPPETEER_EXECUTABLE_PATH')
  process.exit(2)
}

// Browser-extension chatter is not this app's failure and cannot be fixed here.
const IGNORE = /font visibility|Extension context invalidated|chrome-extension:\/\//

const problems = []

function attachListeners(page, { track5xx = false } = {}) {
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) problems.push(`[console] ${page.url()}: ${m.text().slice(0, 300)}`) })
  page.on('pageerror', (e) => problems.push(`[pageerror] ${page.url()}: ${String(e).slice(0, 400)}`))
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText || 'unknown'
    if (!/net::ERR_(ABORTED|BLOCKED_BY_CLIENT)/.test(why) && !IGNORE.test(r.url())) problems.push(`[reqfailed] ${r.url()}: ${why}`)
  })
  if (track5xx) {
    page.on('response', (r) => {
      if (r.status() >= 500 && !IGNORE.test(r.url())) problems.push(`[5xx] ${r.request().method()} ${r.url()}: ${r.status()}`)
    })
  }
}

// ---------------------------------------------------------------- smoke setup
// Fatal-only: these run before the browser and abort with the exact fix.
async function smokePreflight() {
  const health = await fetch(`${API}/api/health`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  if (!health?.ok) die(`[smoke] the API at ${API} is not healthy — start it (npm run dev:api) or point --api at the right port.`)

  const job = await fetch(`${API}/api/jobs/${JOB.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  if (!job?.id) die(`[smoke] fixture vacancy ${JOB.id} is not visible through the API — apply the dev seeds to the API's database: psql -U postgres -h localhost -d joblinked -f db/seed-dev.sql`)
}

const supa = SMOKE
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

// Creates the fixture auth user with the seeded UUID, or resets the password of
// an existing one — so every run gets a fresh, never-committed credential.
async function ensureAuthUser({ id, email, role }) {
  const password = `Smoke!${randomUUID()}`
  const app_metadata = { role }
  const { error } = await supa.auth.admin.createUser({ id, email, password, email_confirm: true, app_metadata })
  if (error) {
    const { error: updateError } = await supa.auth.admin.updateUserById(id, { password, email_confirm: true, app_metadata })
    if (updateError) {
      die(`[smoke] fixture auth user ${email}: ${error.message}; password reset also failed (${updateError.message}). The seeded UUID and the Supabase user must match — delete the stray user or fix db/seed-dev.sql.`)
    }
  }
  return password
}

async function mintToken(email) {
  const link = await supa.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error) die(`[smoke] could not mint a token for ${email}: ${link.error.message}`)
  const { data, error } = await supa.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' })
  if (error) die(`[smoke] verifyOtp for ${email}: ${error.message}`)
  return data.session.access_token
}

// ------------------------------------------------------------- smoke helpers
async function waitFor(page, fn, args = [], { label = 'condition', timeout = 25000 } = {}) {
  const deadline = Date.now() + timeout
  for (;;) {
    const value = await page.evaluate(fn, ...args).catch(() => undefined)
    if (value) return value
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`)
    await sleep(250)
  }
}

const must = (condition, message) => {
  if (!condition) throw new Error(message)
  return condition
}

const clickByText = (page, selector, text) => page.evaluate((sel, t) => {
  const hit = [...document.querySelectorAll(sel)].find((el) => new RegExp(t, 'i').test(el.textContent))
  hit?.click()
  return Boolean(hit)
}, selector, text)

// The workspace sidebar lives in <aside>; the public shell's "Main navigation"
// also ends in "navigation", so scope to the aside or a sign-in race matches
// the login page and every later click lands nowhere.
const SIDEBAR = 'aside nav[aria-label$="navigation"]'

async function clickNav(page, label) {
  const clicked = await page.evaluate((selector, text) => {
    const nav = document.querySelector(selector)
    const links = nav ? [...nav.querySelectorAll('a')] : []
    const hit = links.find((a) => a.textContent.trim().toLowerCase().startsWith(text.toLowerCase()))
    hit?.click()
    return Boolean(hit)
  }, SIDEBAR, label)
  must(clicked, `workspace navigation has no "${label}" link`)
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 10000 }).catch(() => {})
  await sleep(300)
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('#login-email', { timeout: 20000 })
  await page.type('#login-email', email)
  await page.type('#login-password', password)
  await page.click('button[type="submit"]')
  const outcome = await waitFor(page, (sidebar) => {
    if (document.querySelector(sidebar)) return { ok: true }
    const alert = document.querySelector('[role="alert"]')
    const text = alert ? alert.textContent.trim() : ''
    if (/verification challenge/i.test(text)) return { captcha: true }
    return text ? { error: text } : null
  }, [SIDEBAR], { label: `the ${email} workspace to open`, timeout: 30000 })
  if (outcome.captcha) throw new Error('captcha is enabled (VITE_TURNSTILE_SITE_KEY) — the smoke cannot solve it; build the preview without the key')
  if (outcome.error) throw new Error(`sign-in error: ${outcome.error}`)
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
}

async function openPage(browser) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  attachListeners(page, { track5xx: true })
  return { context, page }
}

// Row lookups on list tables: match a row by text, then assert or click a
// button inside it. Runs in the page, so React's own click handlers fire.
const clickRowButton = (page, rowText, buttonText) => page.evaluate((t, b) => {
  const row = [...document.querySelectorAll('table tbody tr')].find((tr) => new RegExp(t, 'i').test(tr.textContent))
  if (!row) return false
  const button = [...row.querySelectorAll('button')].find((x) => new RegExp(b, 'i').test(x.textContent))
  button?.click()
  return Boolean(button)
}, rowText, buttonText)

// ------------------------------------------------------ smoke setup (pre-run)
// Runs before the browser launches so a missing stack aborts with the exact
// fix instead of stranding a Chrome process.
let smokePasswords = null
if (SMOKE) {
  console.log('=== AUTHED SMOKE (Phase 3) ===')
  await smokePreflight()
  smokePasswords = {}
  for (const fixture of Object.values(FIXTURES)) smokePasswords[fixture.email] = await ensureAuthUser(fixture)
  console.log(`[smoke] ${Object.keys(smokePasswords).length} fixture auth users ready (passwords generated for this run)`)

  // Re-open a pending accreditation so the admin step always has one to approve.
  const pendingToken = await mintToken(FIXTURES.pending.email)
  const reset = await fetch(`${API}/api/accreditations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${pendingToken}`, 'content-type': 'application/json' },
  })
  if (!reset.ok) die(`[smoke] could not open a pending accreditation for ${FIXTURES.pending.email} (HTTP ${reset.status}) — is the seed row from db/seed-dev.sql present?`)
  console.log('[smoke] pending accreditation fixture reset\n')
}

// ------------------------------------------------------------------- the run
const browser = await puppeteer.launch({ executablePath, headless: 'new' })
// Wrap all post-launch work in try/finally so a throw (goto timeout, assertion
// failure, etc.) cannot strand the Chrome process.
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  attachListeners(page)

  for (const route of routes) {
    const t0 = Date.now()
    let status = 0
    try {
      status = (await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 30000 }))?.status() ?? 0
    } catch (e) {
      problems.push(`[goto] ${route}: ${e.message.split('\n')[0]}`)
    }
    const text = await page.evaluate(() => document.body.innerText).catch(() => '')
    const hasHeader = (await page.$('header')) !== null
    console.log(`${route} -> ${status} ${Date.now() - t0}ms text:${text.length} header:${hasHeader}`)
    if (status >= 400) problems.push(`[status] ${route}: HTTP ${status}`)
    if (text.trim().length < 40) problems.push(`[blank] ${route}: body nearly empty`)
    if (!hasHeader) problems.push(`[chrome] ${route}: no header rendered`)
  }
  await page.close()

  if (SMOKE) {
    const passwords = smokePasswords
    const step = async (label, fn) => {
      try {
        const detail = await fn()
        console.log(`ok   [smoke] ${label}${detail ? ` — ${detail}` : ''}`)
      } catch (e) {
        console.log(`FAIL [smoke] ${label} :: ${e.message}`)
        problems.push(`[smoke] ${label}: ${e.message}`)
      }
    }

    await step('seeker: browse → apply', async () => {
      const { context, page: seeker } = await openPage(browser)
      try {
        await signIn(seeker, FIXTURES.seeker.email, passwords[FIXTURES.seeker.email])
        await clickNav(seeker, 'Browse Jobs')
        await seeker.waitForSelector('input[placeholder^="Search jobs"]', { timeout: 20000 })
        await seeker.type('input[placeholder^="Search jobs"]', JOB.title)
        await waitFor(seeker, (title) => [...document.querySelectorAll('a')].some((a) => a.textContent.trim() === title), [JOB.title], { label: `the "${JOB.title}" card` })
        await seeker.evaluate((title) => [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === title).click(), JOB.title)
        const state = await waitFor(seeker, () => {
          if (/Application submitted/.test(document.body.innerText)) return 'applied'
          const button = [...document.querySelectorAll('button')].find((b) => /submit application/i.test(b.textContent))
          return button && !button.disabled ? 'ready' : null
        }, [], { label: 'the apply panel on the vacancy page' })
        if (state === 'ready') {
          await clickByText(seeker, 'button', 'submit application')
          await waitFor(seeker, () => /Application submitted/.test(document.body.innerText), [], { label: 'the application receipt' })
          return 'applied to the fixture vacancy'
        }
        return 'application already present from an earlier run'
      } finally {
        await context.close()
      }
    })

    await step('employer: applicants → status change', async () => {
      const { context, page: employer } = await openPage(browser)
      try {
        await signIn(employer, FIXTURES.employer.email, passwords[FIXTURES.employer.email])
        await clickNav(employer, 'Applicants')
        await employer.waitForSelector('input[placeholder^="Search candidate"]', { timeout: 20000 })
        await employer.type('input[placeholder^="Search candidate"]', 'Smoke Seeker')
        await waitFor(employer, (t) => {
          const row = [...document.querySelectorAll('table tbody tr')].find((tr) => new RegExp(t, 'i').test(tr.textContent))
          return Boolean(row)
        }, ['smoke seeker'], { label: 'the seeded applicant row' })
        must(await clickRowButton(employer, 'smoke seeker', 'review candidate'), 'the applicant row has no review button')
        await employer.waitForSelector('#recruitment-status', { timeout: 15000 })
        await employer.select('#recruitment-status', 'Under Review')
        await clickByText(employer, '[role="dialog"] button', 'update candidate')
        await waitFor(employer, () => !document.querySelector('#recruitment-status'), [], { label: 'the candidate dialog to close' })
        await waitFor(employer, (t, m) => {
          const row = [...document.querySelectorAll('table tbody tr')].find((tr) => new RegExp(t, 'i').test(tr.textContent))
          return Boolean(row) && new RegExp(m, 'i').test(row.textContent)
        }, ['smoke seeker', 'under review'], { label: 'the row to show Under Review' })
        return 'status now Under Review'
      } finally {
        await context.close()
      }
    })

    await step('admin: approve accreditation + report CSV', async () => {
      const { context, page: admin } = await openPage(browser)
      try {
        await signIn(admin, FIXTURES.admin.email, passwords[FIXTURES.admin.email])
        await clickNav(admin, 'Employer accreditation')
        await admin.waitForSelector('#accreditation-search', { timeout: 20000 })
        await admin.type('#accreditation-search', PENDING_COMPANY_HINT)
        await waitFor(admin, (t, m) => {
          const row = [...document.querySelectorAll('table tbody tr')].find((tr) => new RegExp(t, 'i').test(tr.textContent))
          return Boolean(row) && new RegExp(m, 'i').test(row.textContent)
        }, [PENDING_COMPANY_HINT, 'pending'], { label: 'the pending fixture row' })
        must(await clickRowButton(admin, PENDING_COMPANY_HINT, 'review'), 'the pending row has no review button')
        await admin.waitForSelector('#accreditation-reason', { timeout: 15000 })
        await clickByText(admin, '[role="dialog"] button', '^approve')
        await waitFor(admin, () => !document.querySelector('#accreditation-reason'), [], { label: 'the review dialog to close' })
        await waitFor(admin, (t, m) => {
          const row = [...document.querySelectorAll('table tbody tr')].find((tr) => new RegExp(t, 'i').test(tr.textContent))
          return Boolean(row) && new RegExp(m, 'i').test(row.textContent)
        }, [PENDING_COMPANY_HINT, 'approved'], { label: 'the row to show Approved' })

        await clickNav(admin, 'Reports & insights')
        await waitFor(admin, () => [...document.querySelectorAll('button')].some((b) => /download csv/i.test(b.textContent)), [], { label: 'the report CSV button' })
        // Capture the client-generated Blob instead of relying on downloads.
        await admin.evaluate(() => {
          window.__smokeCsv = null
          const original = URL.createObjectURL.bind(URL)
          URL.createObjectURL = (blob) => { window.__smokeCsv = blob; return original(blob) }
        })
        await clickByText(admin, 'button', 'download csv')
        const csv = await waitFor(admin, () => (window.__smokeCsv ? window.__smokeCsv.text() : ''), [], { label: 'the CSV blob' })
        must(csv.includes('DEMO DATA'), 'CSV is missing its header row')
        must(csv.includes('"Poblacion"'), 'CSV is missing the Poblacion row')
        return `approved ${PENDING_COMPANY_HINT} + ${csv.split('\n').length} CSV rows`
      } finally {
        await context.close()
      }
    })

    await step('public: /jobs/:id deep link', async () => {
      const context = await browser.createBrowserContext()
      const publicPage = await context.newPage()
      attachListeners(publicPage, { track5xx: true })
      try {
        const response = await publicPage.goto(`${BASE}/jobs/${JOB.id}`, { waitUntil: 'networkidle2', timeout: 30000 })
        must(response && response.status() === 200, `deep link answered HTTP ${response ? response.status() : 'nothing'}`)
        await waitFor(publicPage, (title) => document.body.innerText.includes(title), [JOB.title], { label: `the "${JOB.title}" title` })
        const text = await publicPage.evaluate(() => document.body.innerText)
        must(/log in to apply/i.test(text), 'the apply call-to-action is missing')
        must(!/job not found/i.test(text), 'the page rendered a not-found error')
        return 'renders the seeded vacancy'
      } finally {
        await context.close()
      }
    })
  }

  console.log(`\n=== PROBLEMS (${problems.length}) ===`)
  if (problems.length) {
    console.log(problems.join('\n'))
    process.exitCode = 1
  } else {
    console.log(SMOKE ? '(none) — public routes + authed smoke all clean' : '(none) — all public routes rendered')
  }
} finally {
  await browser.close()
}
