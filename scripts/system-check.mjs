#!/usr/bin/env node
// Repeatable system smoke: drives a running site with headless Chrome, one load
// per public route, and fails on console errors, page errors, or failed requests.
//
//   npm run build && npm run preview      # in one terminal
//   npm run syscheck                      # in another (defaults to :4173)
//   npm run syscheck -- --base http://localhost:5173
//
// Exits 1 on any problem, 2 when no Chrome/Edge binary can be found.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const argv = process.argv.slice(2)
const flagValue = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  const v = i >= 0 ? argv[i + 1] : undefined
  return v && !v.startsWith('--') ? v : fallback
}
const BASE = flagValue('base', 'http://localhost:4173').replace(/\/$/, '')

// Public routes only: signed-in screens need a session, so they belong to a
// later authed smoke rather than a pre-deploy gate.
const routes = [
  '/', '/jobs', '/login', '/signup', '/register',
  '/register/job-seeker', '/register/employer',
  '/forgot-password', '/reset-password', '/privacy', '/terms',
]

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

const browser = await puppeteer.launch({ executablePath, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })

// Browser-extension chatter is not this app's failure and cannot be fixed here.
const IGNORE = /font visibility|Extension context invalidated|chrome-extension:\/\//
const problems = []
const onConsole = (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) problems.push(`[console] ${page.url()}: ${m.text().slice(0, 300)}`) }
const onPageError = (e) => problems.push(`[pageerror] ${page.url()}: ${String(e).slice(0, 400)}`)
const onRequestFailed = (r) => {
  const why = r.failure()?.errorText || 'unknown'
  if (!/net::ERR_(ABORTED|BLOCKED_BY_CLIENT)/.test(why) && !IGNORE.test(r.url())) problems.push(`[reqfailed] ${r.url()}: ${why}`)
}
page.on('console', onConsole)
page.on('pageerror', onPageError)
page.on('requestfailed', onRequestFailed)

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

await browser.close()

console.log(`\n=== PROBLEMS (${problems.length}) ===`)
if (problems.length) {
  console.log(problems.join('\n'))
  process.exit(1)
}
console.log('(none) — all public routes rendered')
