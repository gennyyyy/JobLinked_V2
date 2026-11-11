import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PAGES = [
  ['dashboard', '/job-seeker', '/jobseeker/dashboard'],
  ['opportunities', '/job-seeker/jobs', '/jobseeker/recommended'],
  ['saved', '/job-seeker/saved', '/jobseeker/saved'],
  ['applications', '/job-seeker/applications', '/jobseeker/applications'],
  ['employment', '/job-seeker/employment', '/jobseeker/employment-tracking'],
  ['profile', '/job-seeker/profile', '/jobseeker/profile'],
  ['settings', '/job-seeker/settings', '/jobseeker/settings'],
]

const capture = () => {
  const main = document.querySelector('main') || document.body
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    url: location.href,
    eyebrow: text(main.querySelector('.eyebrow')),
    h1: text(main.querySelector('h1')),
    description: text(main.querySelector('h1 + p')),
    cardTitles: [...main.querySelectorAll('[data-slot=card-title]')].map(text).filter(Boolean),
    th: [...main.querySelectorAll('thead th')].map(text).filter(Boolean),
    labels: [...main.querySelectorAll('label, legend')].map(text).filter(Boolean),
    buttons: [...main.querySelectorAll('button')].map(text).filter(Boolean),
  }
}

const unique = (list) => [...new Set(list)]

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })

  const ref = await browser.newPage()
  await ref.setViewport({ width: 1440, height: 900 })
  await ref.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 40000 })
  await (await ref.$('input[type=email]')).type('maria@demo.joblinked.ph')
  await (await ref.$('input[type=password]')).type(process.env.DEMO_PASSWORD || '')
  await (await ref.$('button[type=submit]')).click()
  await ref.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 30000 })

  const ours = await browser.newPage()
  await ours.setViewport({ width: 1440, height: 900 })

  for (const [name, ourPath, refPath] of PAGES) {
    await ref.bringToFront()
    await ref.goto(`http://localhost:3000${refPath}`, { waitUntil: 'networkidle2', timeout: 40000 })
    await new Promise((r) => setTimeout(r, 1200))
    const reference = await ref.evaluate(capture)

    await ours.bringToFront()
    await ours.goto(`http://localhost:5175/jobseeker-preview.html?page=${ourPath}`, { waitUntil: 'networkidle2', timeout: 40000 })
    await new Promise((r) => setTimeout(r, 1500))
    const current = await ours.evaluate(capture)

    const diff = {}
    for (const key of ['eyebrow', 'h1', 'description']) {
      if (reference[key] !== current[key]) diff[key] = { ref: reference[key], cur: current[key] }
    }
    for (const key of ['cardTitles', 'th', 'labels', 'buttons']) {
      const a = unique(reference[key])
      const b = unique(current[key])
      const missing = a.filter((item) => !b.includes(item))
      const extra = b.filter((item) => !a.includes(item))
      if (missing.length || extra.length) diff[key] = { missing, extra }
    }
    const keys = Object.keys(diff)
    console.log(`\n=== ${name} (${reference.url}) — ${keys.length ? keys.join(', ') : 'MATCH'}`)
    for (const key of keys) {
      const value = diff[key]
      if (value.ref !== undefined) console.log(`  ${key}: ref="${value.ref}" cur="${value.cur}"`)
      else console.log(`  ${key}: missing=${JSON.stringify(value.missing)} extra=${JSON.stringify(value.extra)}`)
    }
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
