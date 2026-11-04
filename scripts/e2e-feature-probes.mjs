#!/usr/bin/env node
// Interaction probes: opens key feature surfaces per role and verifies they
// render, without submitting mutations. Complements e2e-role-walkthrough.mjs.
import puppeteer from 'puppeteer-core';
import { existsSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4173';
const exeCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = exeCandidates.find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const add = (role, probe, ok, detail) => { results.push({ role, probe, ok, detail }); console.log(`[${ok ? 'OK' : 'FAIL'}] ${role} / ${probe}: ${detail}`); };

const browser = await puppeteer.launch({ executablePath, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

async function login(email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#login-email', { timeout: 15000 });
  await page.type('#login-email', email, { delay: 4 });
  await page.type('#login-password', password, { delay: 4 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('#login-email'), { timeout: 20000 }).catch(() => {});
  await sleep(900);
  return !(await page.$('#login-email'));
}
async function go(path) {
  const link = await page.$(`a[href="${path}"]`);
  if (!link) return false;
  await link.evaluate((el) => el.click());
  await page.waitForNetworkIdle({ idleTime: 250, timeout: 8000 }).catch(() => {});
  await sleep(400);
  return true;
}
const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
const findClick = (re, scope = 'main') => page.evaluate((src, scopeSel) => {
  const root = scopeSel ? (document.querySelector(scopeSel) || document) : document;
  const rx = new RegExp(src, 'i');
  const el = [...root.querySelectorAll('button, a, [role="button"]')].find((e) => rx.test(e.innerText || '') && !e.disabled);
  if (el) { el.click(); return el.innerText.trim().slice(0, 50); }
  return null;
}, re.source, scope);

// ------------------------------------------------------------- job seeker 50
{
  const ok = await login('spike.seeker.050@joblinked-spike.test', 'Spike!Seek149!');
  add('job-seeker', 'login', ok, ok ? 'signed in' : 'failed');
  if (ok) {
    await go('/job-seeker/jobs'); await sleep(500);
    const card = await page.$('a[href^="/job-seeker/jobs/"]');
    if (card) {
      await card.evaluate((el) => el.click());
      await page.waitForNetworkIdle({ idleTime: 250, timeout: 8000 }).catch(() => {});
      await sleep(400);
      const state = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => /submit application/i.test(b.innerText));
        return { hasSubmit: !!btn, already: /application submitted/i.test(document.body.innerText), heading: document.querySelector('h1')?.innerText?.slice(0, 50) };
      });
      if (state.hasSubmit) {
        await findClick(/submit application/);
        await page.waitForNetworkIdle({ idleTime: 300, timeout: 8000 }).catch(() => {});
        await sleep(900);
        const after = await page.evaluate(() => ({ confirmed: /application submitted/i.test(document.body.innerText), error: (document.querySelector('.text-danger')?.innerText || '').slice(0, 150) }));
        add('job-seeker', 'apply via UI', after.confirmed, after.confirmed ? 'confirmation shown' : `no confirmation (${after.error || 'none'})`);
        await go('/job-seeker/applications'); await sleep(500);
        const rows = await count('tbody tr');
        add('job-seeker', 'application appears in My applications', rows > 0, `${rows} rows`);
      } else {
        add('job-seeker', 'apply via UI', false, `no submit button (already applied: ${state.already}, job: ${state.heading})`);
      }
    } else {
      add('job-seeker', 'job cards', false, 'no job card links');
    }
    await go('/job-seeker/profile'); await sleep(400);
    const inputs = await count('input, textarea, select');
    add('job-seeker', 'profile form renders', inputs > 0, `${inputs} fields`);
  }
}

// ------------------------------------------------------------------ employer
{
  const ok = await login('spike.employer.004@joblinked-spike.test', 'Spike!Emp203!');
  add('employer', 'login', ok, ok ? 'signed in' : 'failed');
  if (ok) {
    await go('/employer/job-posts'); await sleep(500);
    const clicked = await findClick(/create a vacancy|new job|create/i);
    await sleep(600);
    const form = await page.evaluate(() => ({
      fields: document.querySelectorAll('input, textarea, select').length,
      dialog: !!document.querySelector('[role="dialog"]'),
      heading: (document.querySelector('h1, h2, [role="dialog"] h2')?.innerText || '').slice(0, 60),
    }));
    add('employer', 'create-vacancy surface opens', !!clicked && (form.fields > 0 || form.dialog), `clicked="${clicked}" fields=${form.fields} dialog=${form.dialog} h="${form.heading}"`);
    await page.keyboard.press('Escape').catch(() => {});
    await go('/employer/applicants'); await sleep(500);
    const rows = await count('tbody tr');
    add('employer', 'applicant list rows', rows > 0, `${rows} rows`);
    const beforeText = await page.evaluate(() => document.body.innerText.length);
    const row = await page.$('tbody tr');
    if (row) await row.evaluate((el) => el.click());
    await sleep(800);
    const detail = await page.evaluate(() => ({
      textLen: document.body.innerText.length,
      dialog: !!document.querySelector('[role="dialog"]'),
      hasApplicantDetail: /application|applicant|resume|status|interview/i.test(document.body.innerText),
    }));
    add('employer', 'applicant detail opens from a row', !!row && (detail.dialog || detail.textLen > beforeText + 20), `dialog=${detail.dialog} text ${beforeText}→${detail.textLen}`);
  }
}

// --------------------------------------------------------------- super admin
{
  const ok = await login('e2e.admin@joblinked-spike.test', 'E2e!Admin2026!');
  add('super-admin', 'login', ok, ok ? 'signed in' : 'failed');
  if (ok) {
    await go('/super-admin/accreditation'); await sleep(500);
    const accRows = await count('tbody tr');
    const beforeAcc = await page.evaluate(() => document.body.innerText.length);
    let review = await findClick(/review|open case|view details|approve|reject/i);
    if (!review) {
      const row = await page.$('tbody tr');
      if (row) { await row.evaluate((el) => el.click()); review = 'row click'; }
    }
    await sleep(800);
    const accSurface = await page.evaluate(() => ({ dialog: !!document.querySelector('[role="dialog"]'), text: document.body.innerText.length }));
    add('super-admin', 'accreditation review surface', !!review && (accSurface.dialog || accSurface.text > beforeAcc + 20), `rows=${accRows} clicked="${review}" dialog=${accSurface.dialog} text ${beforeAcc}→${accSurface.text}`);
    await page.keyboard.press('Escape').catch(() => {});
    await go('/super-admin/users'); await sleep(500);
    const userRows = await count('tbody tr');
    const invite = await findClick(/add user|invite/i);
    await sleep(700);
    const inviteSurface = await page.evaluate(() => ({ dialog: !!document.querySelector('[role="dialog"]'), fields: document.querySelectorAll('[role="dialog"] input, [role="dialog"] select').length }));
    add('super-admin', 'user invite surface', !!invite && (inviteSurface.dialog || inviteSurface.fields > 0), `rows=${userRows} clicked="${invite}" dialog=${inviteSurface.dialog} fields=${inviteSurface.fields}`);
    await page.keyboard.press('Escape').catch(() => {});
    await go('/super-admin/broadcast'); await sleep(500);
    const form = await page.evaluate(() => ({ fields: document.querySelectorAll('input, textarea, select').length, buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 6) }));
    add('super-admin', 'announcement form renders', form.fields > 0, `fields=${form.fields} buttons=${JSON.stringify(form.buttons)}`);
    await go('/super-admin/settings'); await sleep(500);
    const settings = await page.evaluate(() => ({ fields: document.querySelectorAll('input, select, textarea').length, save: [...document.querySelectorAll('button')].some((b) => /save/i.test(b.innerText)) }));
    add('super-admin', 'settings form renders', settings.fields > 0, `fields=${settings.fields} save=${settings.save}`);
  }
}

add('global', 'page errors during probes', pageErrors.length === 0, pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : 'none');
await browser.close();
writeFileSync(new URL('../.e2e-feature-probes.local.json', import.meta.url), JSON.stringify({ results, pageErrors }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} probes passed ===`);
process.exit(failed.length ? 1 : 0);
