#!/usr/bin/env node
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5183/nethvoice'
const OUT = process.env.OUT || 'screenshots'
const [, , theme = 'dark', ...targets] = process.argv

if (!targets.length) {
  console.error(
    'usage: NV_USER=admin NV_PW=... node scripts/screenshot.mjs <dark|light> "name|/path|optional async page actions" ...\n' +
      'The first target can be "name|@login" to sign in. Requests other than GET are blocked unless ALLOW_WRITES=1.',
  )
  process.exit(2)
}

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: Number(process.env.W || 1600), height: Number(process.env.H || 900) },
  colorScheme: theme === 'light' ? 'light' : 'dark',
  locale: process.env.LOCALE || 'en-US',
})
const page = await context.newPage()
const problems = []
const blocked = []

await page.route(
  (url) => /^\/(freepbx\/(rest|admin)|api|tancredi)\//.test(url.pathname),
  (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const allowed =
      request.method() === 'GET' ||
      path === '/freepbx/rest/testauth' ||
      process.env.ALLOW_WRITES === '1'

    if (allowed) {
      return route.continue()
    }
    blocked.push(`${request.method()} ${path}`)
    return route.fulfill({
      status: 418,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'blocked by screenshot.mjs: read-only run' }),
    })
  },
)

page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text().slice(0, 300))
})
page.on('pageerror', (error) => problems.push(`PAGEERROR ${String(error).slice(0, 300)}`))

const signIn = async () => {
  await page.goto(`${BASE}/login`)
  await page.fill('#username', process.env.NV_USER || 'admin')
  await page.fill('#password', process.env.NV_PW || '')
  await page.click('button[type=submit]')
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 })
}

for (const target of targets) {
  const [name, path, ...actionParts] = target.split('|')
  const action = actionParts.join('|')

  if (path === '@login') {
    await signIn()
  } else {
    await page.goto(BASE + path)
  }
  await page.waitForLoadState('networkidle').catch(() => undefined)

  if (action) {
    try {
      await new Function('page', `return (async () => { ${action} })()`)(page)
    } catch (error) {
      problems.push(`ACTION ${String(error).slice(0, 300)}`)
    }
  }
  await page.waitForTimeout(Number(process.env.WAIT || 700))
  await page.screenshot({ path: `${OUT}/${name}-${theme}.png`, fullPage: process.env.FULL === '1' })
  console.log(`${name}: ${page.url()}`)
}

if (blocked.length) console.log(`BLOCKED WRITES:\n${[...new Set(blocked)].join('\n')}`)
if (problems.length) console.log(`PROBLEMS:\n${[...new Set(problems)].join('\n')}`)
await browser.close()
