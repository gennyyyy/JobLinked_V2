// Throwaway probe: with prefers-reduced-motion, does the loading spinner animate
// while a 2.5s session request is in flight? (Vite ignores probe-*.mjs.)
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.CHROME_PATH].find((p) => p && existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' })
const context = await browser.createBrowserContext()
const page = await context.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await page.setRequestInterception(true)
page.on('request', async (req) => {
  if (req.url().includes('/api/auth/get-session')) { await sleep(2500) }
  req.continue()
})

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.animate-spin', { timeout: 10000 })
const sample = await page.evaluate(() => {
  const el = document.querySelector('.animate-spin')
  const cs = getComputedStyle(el)
  return {
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationName: cs.animationName,
    animationDuration: cs.animationDuration,
    running: el.getAnimations().map((a) => ({ name: a.animationName ?? a.id, state: a.playState, time: Math.round(a.currentTime || 0) })),
    pulseAnimationName: (() => {
      const d = document.createElement('div'); d.className = 'animate-pulse'; document.body.appendChild(d)
      const name = getComputedStyle(d).animationName; d.remove(); return name
    })(),
  }
})
const transformA = await page.evaluate(() => getComputedStyle(document.querySelector('.animate-spin')).transform)
await sleep(400)
const again = await page.evaluate(() => document.querySelector('.animate-spin')?.getAnimations().map((a) => Math.round(a.currentTime || 0)) ?? null)
const transformB = await page.evaluate(() => getComputedStyle(document.querySelector('.animate-spin')).transform)
const keyframes = await page.evaluate(() => {
  for (const sheet of document.styleSheets) {
    try { for (const rule of sheet.cssRules) if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'spin') return rule.cssText.slice(0, 120) } catch {}
  }
  return null
})
console.log(JSON.stringify({ sample, currentTimeAfter400ms: again, transformA, transformB, rotates: transformA !== transformB, keyframes }, null, 2))
await browser.close()
