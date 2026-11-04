#!/usr/bin/env node
// Role-by-role E2E walkthrough: logs in as each role, clicks every portal page,
// records render/console/network/performance issues, and probes key features.
//
//   node scripts/e2e-role-walkthrough.mjs [--base http://localhost:4173]
//
// Requires the built app (vite preview) + API running.
import puppeteer from 'puppeteer-core';
import { existsSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:4173').replace(/\/$/, '');
const API = arg('api', 'http://localhost:4000');

const exeCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = exeCandidates.find((p) => existsSync(p));
if (!executablePath) { console.error('NO_BROWSER'); process.exit(2); }

const ROLES = [
  {
    name: 'job-seeker',
    email: 'spike.seeker.001@joblinked-spike.test',
    password: 'Spike!Seek100!',
    home: '/job-seeker',
    nav: [
      ['Overview', '/job-seeker'], ['My profile', '/job-seeker/profile'], ['Browse Jobs', '/job-seeker/jobs'],
      ['Saved jobs', '/job-seeker/saved'], ['My applications', '/job-seeker/applications'],
      ['Employment Tracking', '/job-seeker/employment'], ['Notifications', '/job-seeker/notifications'],
      ['Account settings', '/job-seeker/settings'],
    ],
  },
  {
    name: 'employer',
    email: 'spike.employer.004@joblinked-spike.test',
    password: 'Spike!Emp203!',
    home: '/employer',
    nav: [
      ['Overview', '/employer'], ['Accreditation', '/employer/accreditation'], ['Company profile', '/employer/company'],
      ['Job management', '/employer/job-posts'], ['Applicants', '/employer/applicants'],
      ['Employees Tracking', '/employer/employees'], ['Notifications', '/employer/notifications'],
    ],
  },
  {
    name: 'super-admin',
    email: 'e2e.admin@joblinked-spike.test',
    password: 'E2e!Admin2026!',
    home: '/super-admin',
    nav: [
      ['Overview', '/super-admin'], ['My profile', '/super-admin/profile'],
      ['Employer accreditation', '/super-admin/accreditation'], ['User management', '/super-admin/users'],
      ['Role Management', '/super-admin/roles'], ['Employment oversight', '/super-admin/employment-tracking'],
      ['Job vacancy oversight', '/super-admin/job-posts'], ['Applications & placements', '/super-admin/applications'],
      ['Reports & insights', '/super-admin/reports'], ['Announcements', '/super-admin/broadcast'],
      ['Audit log', '/super-admin/logs'], ['Notifications', '/super-admin/notifications'],
      ['System settings', '/super-admin/settings'],
    ],
  },
];

const PUBLIC = [
  ['Landing', '/'], ['Jobs', '/jobs'], ['Login', '/login'], ['Sign up', '/signup'],
  ['Forgot password', '/forgot-password'], ['Privacy', '/privacy'],
];

const NOISE = /Download the React DevTools|favicon|visibility level|ERR_BLOCKED_BY_CLIENT|source ?map|React Router Future Flag|Each child in a list/i;
const ERROR_ALERT = /cannot reach|failed|error|try again|invalid|required|not allowed|denied|closed/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apiHealthy = async () => {
  try { const r = await fetch(`${API}/api/health`); return r.ok; } catch { return false; }
};
async function waitForApi(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await apiHealthy()) return true;
    await sleep(2000);
  }
  return false;
}

const browser = await puppeteer.launch({ executablePath, headless: 'new' });
const report = { base: BASE, api: API, started: new Date().toISOString(), roles: {}, public: [], issues: [] };
const addIssue = (severity, area, page, message) => report.issues.push({ severity, area, page, message });

async function newInstrumentedPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  let state = { consoleErrors: [], pageErrors: [], failedRequests: [], apiErrors: [] };
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text().slice(0, 400);
    if (!NOISE.test(t)) state.consoleErrors.push(t);
  });
  page.on('pageerror', (e) => state.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText || '';
    if (!/ERR_ABORTED|BLOCKED_BY_CLIENT/.test(f)) state.failedRequests.push(`${r.url()} :: ${f}`);
  });
  page.on('response', (r) => {
    if (r.url().startsWith(API) && r.status() >= 400) state.apiErrors.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`);
  });
  return {
    page,
    reset: () => { state = { consoleErrors: [], pageErrors: [], failedRequests: [], apiErrors: [] }; },
    drain: () => ({
      consoleErrors: [...new Set(state.consoleErrors)].slice(0, 3),
      pageErrors: [...new Set(state.pageErrors)].slice(0, 2),
      failedRequests: [...new Set(state.failedRequests)].slice(0, 3),
      apiErrors: [...new Set(state.apiErrors)].slice(0, 3),
    }),
  };
}

const snapshot = (page) => page.evaluate(() => ({
  textLength: (document.body.innerText || '').trim().length,
  heading: (document.querySelector('h1')?.innerText || document.querySelector('h2')?.innerText || '').trim().slice(0, 70).replace(/\s+/g, ' '),
  bodyStart: (document.body.innerText || '').trim().slice(0, 90).replace(/\s+/g, ' '),
  hasNav: !!document.querySelector('a[href="/job-seeker"], a[href="/employer"], a[href="/super-admin"]'),
}));

function recordIssues(area, path, d, ms) {
  for (const e of d.pageErrors) addIssue('critical', area, path, `page crashed: ${e}`);
  for (const e of d.failedRequests) addIssue('high', area, path, `request failed: ${e}`);
  for (const e of d.apiErrors) addIssue('high', area, path, `API error: ${e}`);
  for (const e of d.consoleErrors) addIssue('low', area, path, `console error: ${e}`);
  if (ms > 2500) addIssue('medium', area, path, `slow page: ${ms} ms`);
}

async function visit(page, path) {
  const link = await page.$(`a[href="${path}"]`);
  if (!link) return { path, status: 'LINK-MISSING', ms: 0 };
  const t0 = Date.now();
  await link.evaluate((el) => el.click());
  await page.waitForNetworkIdle({ idleTime: 250, timeout: 8000 }).catch(() => {});
  await sleep(250);
  const ms = Date.now() - t0;
  const snap = await snapshot(page);
  const alertText = await page.evaluate(() => document.querySelector('[role="alert"]')?.innerText?.slice(0, 200) || '');
  const alert = ERROR_ALERT.test(alertText) ? alertText : '';
  const valid = snap.textLength > 40 && !/something went wrong|unexpected error/i.test(snap.bodyStart);
  return { path, status: valid ? 'OK' : 'BLANK/ERROR', ms, alert, ...snap };
}

async function visitWithRetry(ctx, path, roleName) {
  ctx.reset();
  let result = await visit(ctx.page, path);
  let d = ctx.drain();
  const apiDown = d.apiErrors.some((e) => /ERR_CONNECTION_REFUSED|Failed to fetch/i.test(e)) || /cannot reach the api/i.test(result.alert || '');
  if (apiDown && await waitForApi()) {
    report.apiRestarts = (report.apiRestarts || 0) + 1;
    ctx.reset();
    result = await visit(ctx.page, path);
    d = ctx.drain();
    result.retriedAfterApiRestart = true;
  }
  return { result, d };
}

async function login(page, role) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.type('#login-email', role.email, { delay: 5 });
  await page.type('#login-password', role.password, { delay: 5 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('#login-email'), { timeout: 20000 }).catch(() => {});
  await sleep(800);
  const alert = await page.evaluate(() => document.querySelector('[role="alert"]')?.innerText || '');
  return { ok: !(await page.$('#login-email')), alert, body: (await page.evaluate(() => document.body.innerText.slice(0, 120))).replace(/\s+/g, ' ') };
}

// ---------------------------------------------------------------- public pass
{
  const ctx = await newInstrumentedPage();
  await waitForApi();
  for (const [label, path] of PUBLIC) {
    ctx.reset();
    const t0 = Date.now();
    const res = await ctx.page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
    await sleep(200);
    const snap = await snapshot(ctx.page);
    const d = ctx.drain();
    const ms = Date.now() - t0;
    report.public.push({ label, path, status: res?.status(), ms, ...snap });
    recordIssues('public', path, d, ms);
    if (!snap.textLength) addIssue('high', 'public', path, 'page rendered empty');
  }
  await ctx.page.close();
}

// ------------------------------------------------------------ role walkthrough
for (const role of ROLES) {
  const ctx = await newInstrumentedPage();
  const apiUp = await waitForApi();
  if (!apiUp) {
    addIssue('critical', role.name, '/login', 'API never became healthy — skipped');
    report.roles[role.name] = { login: { ok: false, alert: 'API down' }, pages: [] };
    await ctx.page.close();
    continue;
  }
  const loginResult = await login(ctx.page, role);
  if (!loginResult.ok) {
    addIssue('critical', role.name, '/login', `login failed: ${loginResult.alert || 'still on /login'}; body: ${loginResult.body}`);
    report.roles[role.name] = { login: loginResult, pages: [] };
    await ctx.page.close();
    continue;
  }
  const home = await snapshot(ctx.page);
  report.roles[role.name] = { login: { ok: true }, home, pages: [], probes: {} };
  if (!home.hasNav) addIssue('high', role.name, role.home, 'portal nav not rendered after login');
  if (!home.textLength) addIssue('critical', role.name, role.home, 'home page blank after login');

  for (const [label, path] of role.nav) {
    const { result, d } = await visitWithRetry(ctx, path, role.name);
    report.roles[role.name].pages.push({ label, ...result, ...d });
    if (result.status === 'LINK-MISSING') addIssue('high', role.name, path, `nav link not found: ${label}`);
    if (result.status === 'BLANK/ERROR') addIssue('high', role.name, path, `${label} blank/error: "${result.bodyStart}"`);
    if (result.alert) addIssue('medium', role.name, path, `visible alert: ${result.alert}`);
    recordIssues(role.name, path, d, result.ms);
  }

  try {
    if (role.name === 'job-seeker') {
      await waitForApi();
      await visitWithRetry(ctx, '/job-seeker/jobs', role.name);
      await sleep(600);
      const jobLink = await ctx.page.$('a[href^="/job-seeker/jobs/"]');
      if (!jobLink) addIssue('high', 'job-seeker', '/job-seeker/jobs', 'no job cards rendered');
      else {
        const t0 = Date.now();
        await jobLink.evaluate((el) => el.click());
        await ctx.page.waitForNetworkIdle({ idleTime: 250, timeout: 8000 }).catch(() => {});
        await sleep(300);
        const detail = await ctx.page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')].find((b) => /submit application|apply/i.test(b.innerText.trim()));
          return {
            heading: (document.querySelector('h1')?.innerText || '').slice(0, 70).replace(/\s+/g, ' '),
            hasApply: !!btn,
            applyLabel: btn?.innerText.trim().slice(0, 40) || '',
            alreadyApplied: /application submitted/i.test(document.body.innerText),
          };
        });
        report.roles[role.name].probes.jobDetail = { ms: Date.now() - t0, ...detail };
        if (!detail.hasApply && !detail.alreadyApplied) {
          addIssue('high', 'job-seeker', '/job-seeker/jobs/:id', 'job detail has no submit/apply control');
        } else if (detail.hasApply) {
          await ctx.page.evaluate(() => {
            const btn = [...document.querySelectorAll('button')].find((b) => /submit application|apply/i.test(b.innerText.trim()));
            btn?.click();
          });
          await ctx.page.waitForNetworkIdle({ idleTime: 300, timeout: 8000 }).catch(() => {});
          await sleep(800);
          const after = await ctx.page.evaluate(() => ({
            submitted: /application submitted/i.test(document.body.innerText),
            error: (document.querySelector('.text-danger, [role="alert"]')?.innerText || '').slice(0, 160),
          }));
          report.roles[role.name].probes.applyResult = after;
          if (!after.submitted) addIssue('high', 'job-seeker', '/job-seeker/jobs/:id', `apply action did not confirm: ${after.error || 'no confirmation text'}`);
        }
      }
    }
    if (role.name === 'employer') {
      await waitForApi();
      await visitWithRetry(ctx, '/employer/job-posts', role.name);
      await sleep(600);
      const createBtn = await ctx.page.evaluate(() => {
        const b = [...document.querySelectorAll('button, a')].find((el) => /new job|create|post a job/i.test(el.innerText || ''));
        return b ? b.innerText.trim().slice(0, 40) : null;
      });
      report.roles[role.name].probes.createJobButton = createBtn;
      if (!createBtn) addIssue('high', 'employer', '/employer/job-posts', 'no create-job control found');
      await visitWithRetry(ctx, '/employer/applicants', role.name);
      await sleep(600);
      report.roles[role.name].probes.applicantRows = await ctx.page.evaluate(() => document.querySelectorAll('tbody tr').length);
    }
    if (role.name === 'super-admin') {
      await waitForApi();
      await visitWithRetry(ctx, '/super-admin/users', role.name);
      await sleep(600);
      const userRows = await ctx.page.evaluate(() => document.querySelectorAll('tbody tr').length);
      await visitWithRetry(ctx, '/super-admin/reports', role.name);
      await sleep(900);
      const charts = await ctx.page.evaluate(() => document.querySelectorAll('svg.recharts-surface').length);
      await visitWithRetry(ctx, '/super-admin/accreditation', role.name);
      await sleep(500);
      const accRows = await ctx.page.evaluate(() => document.querySelectorAll('tbody tr').length);
      report.roles[role.name].probes = { userRows, charts, accRows };
      if (!userRows) addIssue('high', 'super-admin', '/super-admin/users', 'user management table is empty');
      if (!charts) addIssue('medium', 'super-admin', '/super-admin/reports', 'no chart rendered');
      if (!accRows) addIssue('medium', 'super-admin', '/super-admin/accreditation', 'accreditation table is empty');
    }
  } catch (e) {
    addIssue('medium', role.name, 'feature probe', String(e.message || e).slice(0, 200));
  }
  await ctx.page.close();
}

await browser.close();
writeFileSync(new URL('../.e2e-walkthrough.local.json', import.meta.url), JSON.stringify(report, null, 2));

console.log('=== PUBLIC ===');
for (const p of report.public) console.log(`${p.path.padEnd(18)} ${String(p.status).padEnd(4)} ${String(p.ms).padStart(5)}ms text:${p.textLength} h:"${p.heading}"`);
for (const role of ROLES) {
  const r = report.roles[role.name];
  console.log(`\n=== ${role.name.toUpperCase()} ===`);
  if (!r || !r.login?.ok) { console.log('  LOGIN FAILED'); continue; }
  console.log(`  home text:${r.home.textLength} nav:${r.home.hasNav} h:"${r.home.heading}"`);
  for (const p of r.pages) console.log(`  ${p.label.padEnd(26)} ${String(p.status).padEnd(12)} ${String(p.ms).padStart(5)}ms text:${p.textLength} h:"${p.heading}"${p.alert ? ` ALERT:${p.alert}` : ''}${p.apiErrors.length ? ` API:${p.apiErrors.join(';')}` : ''}${p.pageErrors.length ? ` ERR:${p.pageErrors[0]}` : ''}`);
  console.log(`  probes: ${JSON.stringify(r.probes)}`);
}
console.log(`\n=== ISSUES (${report.issues.length}) ===`);
for (const i of report.issues) console.log(`[${i.severity}] ${i.area} ${i.page}: ${i.message}`);
console.log('\nresult: server/.e2e-walkthrough.local.json');
