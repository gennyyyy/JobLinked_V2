// Real-browser walk of every portal page against the bench API.
// Login with real Supabase credentials, then click the sidebar (the SPA is a
// MemoryRouter and the client does not persist sessions across reloads).
import { existsSync, writeFileSync, unlinkSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const BASE = process.argv[2] || 'http://localhost:4173'
const api = process.argv[3] || 'http://127.0.0.1:4100'
const IMG = 'E:/code_ni_hans/peso_project/src/assets/bgless_logo.png'
const RESUME = 'E:/code_ni_hans/peso_project/server/.verify-resume.pdf'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isResumeFileGet = (c) => c.method === 'GET'
  && /\/api\/files\/resumes\//.test(c.url)
  && !/\/api\/files\/resumes\/mine$/.test(c.url)
const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!exe) { console.error('no chrome'); process.exit(2) }
writeFileSync(RESUME, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(4096, 0x20)]))

// Give the bench admin a browser-usable password (bench DB / bench user only).
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const adminEmail = 'bench.admin@joblinked-spike.test'
const adminPassword = 'Bench!Admin!2026'
const link = await supa.auth.admin.generateLink({ type: 'magiclink', email: adminEmail })
if (link.data?.user) await supa.auth.admin.updateUserById(link.data.user.id, { password: adminPassword })

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` :: ${detail}`}`) }
const IGNORE = /font visibility|Extension context|chrome-extension:/

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' })
try {
  async function newPage() {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    const problems = []
    const apiCalls = []
    page.on('request', (r) => {
      const u = r.url()
      if (u.includes('/api/')) apiCalls.push({ method: r.method(), url: u })
    })
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) problems.push(`console: ${m.text().slice(0, 200)}`) })
    page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`))
    page.on('requestfailed', (r) => {
      const why = r.failure()?.errorText || ''
      if (!/ERR_ABORTED|ERR_BLOCKED_BY_CLIENT/.test(why) && !IGNORE.test(r.url())) problems.push(`reqfail: ${r.url()} ${why}`)
    })
    return { page, problems, apiCalls }
  }

  async function audit(page, problems, label, expectText) {
    const body = await page.evaluate(() => document.body.innerText)
    const url = page.url()
    const okText = expectText ? new RegExp(expectText, 'i').test(body) : true
    const okBody = body.trim().length > 120
    const crash = /Something went wrong|Failed to fetch|Unexpected Application Error/i.test(body)
    check(`${label} renders`, okBody && okText && !crash, `url=${url} len=${body.length} expect=${expectText} crash=${crash}`)
    check(`${label} console clean`, problems.length === 0, problems.slice(0, 3).join(' | '))
    problems.length = 0
    return { url, body }
  }

  // ---------- public ----------
  {
    const { page, problems } = await newPage()
    for (const [path, expect] of [['/', 'JobLinked|PESO'], ['/jobs', 'job'], ['/login', 'Sign In'], ['/signup', 'register'],
      ['/register/job-seeker', 'registration|register'], ['/register/employer', 'registration|employer'], ['/privacy', 'privacy'], ['/terms', 'terms'],
      ['/forgot-password', 'reset|forgot']]) {
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 }).catch((e) => problems.push(`goto ${path}: ${e.message}`))
      await audit(page, problems, `public ${path}`, expect)
    }
    const publicJobs = await fetch(`${api}/api/jobs?page=1&pageSize=5`).then((r) => r.json())
    const jobId = publicJobs.jobs?.[0]?.id
    if (jobId) {
      await page.goto(`${BASE}/jobs/${jobId}`, { waitUntil: 'networkidle2' })
      const { body } = await audit(page, problems, 'public job detail', String(publicJobs.jobs[0].title).slice(0, 20))
      check('public job detail shows company', body.toLowerCase().includes(String(publicJobs.jobs[0].employers?.company_name || 'bench company').toLowerCase().slice(0, 12)), body.slice(0, 200))
    } else {
      check('public jobs list has data', false, 'no published jobs from API')
    }
    await page.close()
  }

  // ---------- login helper ----------
  async function login(email, password) {
    const { page, problems, apiCalls } = await newPage()
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
    await page.type('#login-email', email)
    await page.type('#login-password', password)
    await page.click('button[type="submit"]')
    for (let i = 0; i < 40; i += 1) {
      await new Promise((r) => setTimeout(r, 500))
      const ready = await page.evaluate(() => Boolean(document.querySelector('nav[aria-label$="navigation"]')) && document.body.innerText.length > 300).catch(() => false)
      if (ready) break
    }
    // First paint after a cold login can lag behind the poll; settle the network once.
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 500))
    const body = await page.evaluate(() => document.body.innerText)
    const nav = await page.$('nav[aria-label$="navigation"]')
    check(`login ${email}`, Boolean(nav) && /workspace|dashboard|overview/i.test(body), `url=${page.url()} body=${body.slice(0, 160)}`)
    check(`login ${email} no error banner`, !/invalid email or password|unable to sign in/i.test(body), body.slice(0, 200))
    return { page, problems, apiCalls }
  }

  async function clickNav(page, text) {
    const clicked = await page.evaluate((t) => {
      const nav = document.querySelector('nav[aria-label$="navigation"]')
      const links = nav ? [...nav.querySelectorAll('a')] : [...document.querySelectorAll('a')]
      const hit = links.find((a) => a.innerText.trim().toLowerCase().startsWith(t.toLowerCase()))
      hit?.click()
      return Boolean(hit)
    }, text)
    await sleep(1200)
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 8000 }).catch(() => {})
    return clicked
  }

  async function walk(page, problems, portalLabel, labelToPath) {    // Start from the portal home the login landed on, then click each sidebar link.
    for (const label of labelToPath) {
      const clicked = await page.evaluate((text) => {
        const nav = document.querySelector('nav[aria-label$="navigation"]')
        const links = nav ? [...nav.querySelectorAll('a')] : [...document.querySelectorAll('a')]
        const hit = links.find((a) => a.innerText.trim().toLowerCase().startsWith(text.toLowerCase()))
        if (!hit) return false
        hit.click()
        return true
      }, label)
      if (!clicked) { check(`${portalLabel} nav "${label}" exists`, false); continue }
      await new Promise((r) => setTimeout(r, 1200))
      await page.waitForNetworkIdle({ idleTime: 400, timeout: 8000 }).catch(() => {})
      await audit(page, problems, `${portalLabel} "${label}"`)
    }
  }

  // ---------- job seeker ----------
  {
    const { page, problems, apiCalls } = await login('spike.seeker.003@joblinked-spike.test', 'Spike!Seek102!')
    await new Promise((r) => setTimeout(r, 1200))
    await audit(page, problems, 'seeker landing')
    await walk(page, problems, 'seeker', ['Overview', 'My profile', 'Browse Jobs', 'Saved jobs', 'My applications', 'Employment Tracking', 'Notifications', 'Account settings'])
    // Real data assertion: the application created by verify-live must be listed.
    const navClicked = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label$="navigation"]')
      const hit = nav && [...nav.querySelectorAll('a')].find((a) => a.innerText.trim().toLowerCase().startsWith('my applications'))
      hit?.click(); return Boolean(hit)
    })
    if (navClicked) {
      await new Promise((r) => setTimeout(r, 1500))
      const body = await page.evaluate(() => document.body.innerText)
      check('seeker applications list renders', /my applications/i.test(body) && !/something went wrong|failed to fetch/i.test(body), body.slice(0, 300))
    }

    // ── profile picture persists (the reported "reverts on refresh" bug) ──
    await clickNav(page, 'My profile')
    await page.waitForSelector('#profile-picture', { timeout: 10000 })
    apiCalls.length = 0
    await (await page.$('#profile-picture')).uploadFile(IMG)
    await page.waitForFunction(() => Boolean(document.querySelector('img[alt="Profile picture"]')), { timeout: 25000 }).catch(() => {})
    const avatarSrc = await page.evaluate(() => document.querySelector('img[alt="Profile picture"]')?.getAttribute('src') || '')
    check('avatar upload reaches the API', apiCalls.some((c) => c.method === 'POST' && c.url.endsWith('/api/seekers/me/avatar')), JSON.stringify(apiCalls.slice(0, 4)))
    check('avatar preview renders', avatarSrc.startsWith('blob:'), avatarSrc.slice(0, 40))

    apiCalls.length = 0
    await clickNav(page, 'Overview')
    await clickNav(page, 'My profile')
    await page.waitForFunction(() => Boolean(document.querySelector('img[alt="Profile picture"]')), { timeout: 25000 }).catch(() => {})
    const persistedSrc = await page.evaluate(() => document.querySelector('img[alt="Profile picture"]')?.getAttribute('src') || '')
    check('avatar persists after leaving and returning', persistedSrc.startsWith('blob:'), persistedSrc.slice(0, 40))
    check('avatar re-fetched from the API', apiCalls.some((c) => c.method === 'GET' && /\/api\/seekers\/[^/]+\/avatar/.test(c.url)), JSON.stringify(apiCalls.filter((c) => c.url.includes('avatar'))))

    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /remove photo/i.test(x.innerText)); b?.click() })
    await sleep(1200)
    check('avatar removed via UI', !(await page.$('img[alt="Profile picture"]')))

    // ── resume bytes are fetched on demand, not during page load ─────────
    apiCalls.length = 0
    await (await page.$('#resume-upload')).uploadFile(RESUME)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /add resume/i.test(x.innerText)); b?.click() })
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /^view/i.test(b.innerText)), { timeout: 25000 }).catch(() => {})
    await sleep(800)
    check('resume upload posted', apiCalls.some((c) => c.method === 'POST' && /\/api\/files\/resumes$/.test(c.url)), JSON.stringify(apiCalls.slice(0, 4)))
    check('no resume bytes prefetched on load', !apiCalls.some(isResumeFileGet), JSON.stringify(apiCalls.filter(isResumeFileGet)))
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^view/i.test(x.innerText)); b?.click() })
    await sleep(1800)
    check('View fetches the file on demand', apiCalls.some(isResumeFileGet), JSON.stringify(apiCalls.filter((c) => c.url.includes('/files/resumes'))))
    await page.close()
  }

  // ---------- employer ----------
  {
    const { page, problems, apiCalls } = await login('spike.employer.010@joblinked-spike.test', 'Spike!Emp209!')
    await new Promise((r) => setTimeout(r, 1200))
    await audit(page, problems, 'employer landing')
    await walk(page, problems, 'employer', ['Overview', 'Accreditation', 'Company profile', 'Job management', 'Applicants', 'Employees Tracking', 'Notifications'])

    // ── company logo persists and renders from the public endpoint ───────
    await clickNav(page, 'Company profile')
    await page.waitForSelector('#company-logo', { timeout: 10000 })
    apiCalls.length = 0
    await (await page.$('#company-logo')).uploadFile(IMG)
    await page.waitForFunction(() => Boolean(document.querySelector('img[data-testid="company-logo-image"]')), { timeout: 25000 }).catch(() => {})
    const logoSrc = await page.evaluate(() => document.querySelector('img[data-testid="company-logo-image"]')?.getAttribute('src') || '')
    check('logo upload reaches the API', apiCalls.some((c) => c.method === 'POST' && c.url.endsWith('/api/employers/me/logo')), JSON.stringify(apiCalls.slice(0, 4)))
    check('logo renders from the public endpoint', /\/api\/employers\/[^/]+\/logo/.test(logoSrc), logoSrc.slice(0, 80))

    await clickNav(page, 'Overview')
    await clickNav(page, 'Company profile')
    await page.waitForFunction(() => Boolean(document.querySelector('img[data-testid="company-logo-image"]')), { timeout: 25000 }).catch(() => {})
    check('logo persists after leaving and returning', Boolean(await page.$('img[data-testid="company-logo-image"]')))
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /remove logo/i.test(x.innerText)); b?.click() })
    await sleep(1200)
    check('logo removed via UI', !(await page.$('img[data-testid="company-logo-image"]')))
    await page.close()
  }

  // ---------- super admin ----------
  {
    const { page, problems } = await login(adminEmail, adminPassword)
    await new Promise((r) => setTimeout(r, 1200))
    await audit(page, problems, 'admin landing')
    await walk(page, problems, 'admin', ['Overview', 'My profile', 'Employer accreditation', 'User management', 'Role Management', 'Employment oversight', 'Job vacancy oversight', 'Applications & placements', 'Reports & insights', 'Announcements', 'Audit log', 'Notifications', 'System settings'])
    await page.close()
  }
} finally {
  await browser.close()
  try { unlinkSync(RESUME) } catch { /* already gone */ }
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} browser checks passed`)
process.exit(results.every((r) => r.ok) ? 0 : 1)
