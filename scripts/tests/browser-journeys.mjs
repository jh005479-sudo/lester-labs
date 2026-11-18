/** Local-only browser regression tests. Uses an already installed Chromium; downloads nothing. */
import assert from 'node:assert/strict'
import { PLATFORM_ACTIVITY_BASELINE as baseline } from '../../src/config/platformActivitySnapshot.ts'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, isAbsolute } from 'node:path'
import { once } from 'node:events'

const base = new URL(process.env.BROWSER_TEST_URL ?? 'http://127.0.0.1:3100')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.username || base.password || base.pathname !== '/') throw new Error('Browser tests require an HTTP loopback root URL.')
const executable = process.env.CHROMIUM_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome')
if (!isAbsolute(executable)) throw new Error('Use an absolute path to an approved installed browser.')
const profile = await mkdtemp(join(tmpdir(), 'lester-browser-test-'))
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const chrome = spawn(executable, ['--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking', '--password-store=basic', '--use-mock-keychain', 'about:blank'], {
  stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], env: { HOME: profile, TMPDIR: profile, PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8' },
})
let nextId = 0
const requests = new Map()
let sessionId
let connectionError
let serveZeroFactoryFee = false
const failConnection = error => {
  connectionError = error
  for (const pending of requests.values()) { clearTimeout(pending.timeout); pending.reject(error) }
  requests.clear()
  chrome.kill('SIGTERM')
}
const send = (method, params = {}, targetSession = sessionId) => new Promise((resolve, reject) => {
  if (connectionError) { reject(connectionError); return }
  const id = ++nextId
  const timeout = setTimeout(() => { requests.delete(id); reject(new Error(`Browser command timed out: ${method}`)) }, 15_000)
  requests.set(id, { resolve, reject, timeout })
  chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }) + '\0')
})
try {
  const handleMessage = async (message) => {
    if (message.id) {
      const pending = requests.get(message.id)
      if (!pending) return
      clearTimeout(pending.timeout); requests.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result)
    } else if (message.method === 'Fetch.requestPaused') {
      // Tests never contact RPCs, metrics providers, wallets, or other external services.
      const url = new URL(message.params.request.url)
      const local = url.origin === base.origin || ['data:', 'blob:'].includes(url.protocol)
      if (serveZeroFactoryFee && url.origin === 'https://rpc.testnet.liteforge.zeeve.net') {
        const request = message.params.request
        const cors = [
          { name: 'Access-Control-Allow-Origin', value: base.origin },
          { name: 'Access-Control-Allow-Headers', value: 'content-type' },
          { name: 'Access-Control-Allow-Methods', value: 'POST' },
        ]
        if (request.method === 'OPTIONS') {
          await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 204, responseHeaders: cors }, message.sessionId)
          return
        }
        const rpc = request.postData && JSON.parse(request.postData)
        if (rpc?.method === 'eth_call' && rpc.params?.[0]?.data === '0xdce0b4e4') {
          const result = { jsonrpc: '2.0', id: rpc.id, result: '0x' + '0'.repeat(64) }
          await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
            responseHeaders: [...cors, { name: 'Content-Type', value: 'application/json' }],
            body: Buffer.from(JSON.stringify(result)).toString('base64') }, message.sessionId)
          return
        }
      }
      if (url.origin === base.origin && ['/api/platform-stats', '/api/explorer/summary'].includes(url.pathname)) {
        const stats = url.pathname === '/api/platform-stats'
        const payload = stats ? {
          ...baseline.totals, baseline, fetchedAt: '2026-11-18T00:00:00Z',
          breakdown: Object.fromEntries(Object.entries(baseline.totals).map(([key, count]) => [key, { baseline: count, postCutover: 0 }])),
          coverage: Object.fromEntries(Object.keys(baseline.totals).map(key => [key, { status: 'fallback' }])),
        } : { error: 'Live explorer feed temporarily unavailable.' }
        await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: stats ? 200 : 503,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') }, message.sessionId)
        return
      }
      if (url.origin === base.origin && ['/api/activity', '/api/market-history', '/api/usage'].includes(url.pathname)) {
        const usage = url.pathname === '/api/usage'
        await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: usage ? 200 : 503, responseHeaders: [{name:'Content-Type',value:'application/json'}], body: Buffer.from(JSON.stringify(usage ? {available:false} : {error:'History unavailable'})).toString('base64') }, message.sessionId).catch(() => undefined)
        return
      }
      await send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', { requestId: message.params.requestId, ...(local ? {} : { errorReason: 'BlockedByClient' }) }, message.sessionId).catch(() => undefined)
    }
  }
  // Private process pipes avoid a debug listener or a file-supplied endpoint.
  let incoming = ''
  chrome.stdio[4].setEncoding('utf8')
  chrome.stdio[4].on('data', chunk => {
    try {
      incoming += chunk
      if (incoming.length > 16_777_216) throw new Error('Browser response exceeds the test limit.')
      let boundary
      while ((boundary = incoming.indexOf('\0')) !== -1) {
        const message = JSON.parse(incoming.slice(0, boundary))
        incoming = incoming.slice(boundary + 1)
        void handleMessage(message).catch(failConnection)
      }
    } catch (error) { failConnection(error) }
  })
  chrome.stdio[3].on('error', failConnection)
  chrome.stdio[4].on('error', failConnection)
  await once(chrome, 'spawn')
  const target = await send('Target.createTarget', { url: 'about:blank' }, null)
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  const callFunction = async (functionDeclaration, args = []) => {
    const document = await send('Runtime.evaluate', { expression: 'document' })
    const objectId = document.result.objectId
    if (!objectId) throw new Error('Browser document unavailable.')
    try {
      const result = await send('Runtime.callFunctionOn', { objectId, functionDeclaration, arguments: args.map(value => ({ value })), returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
      return result.result.value
    } finally { await send('Runtime.releaseObject', { objectId }) }
  }
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await evaluate(expression)) return
      await pause(100)
    }
    throw new Error(`Journey condition failed: ${expression}`)
  }
  const waitForFunction = async (functionDeclaration, args) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await callFunction(functionDeclaration, args)) return
      await pause(100)
    }
    throw new Error('Journey condition failed.')
  }
  const navigate = async (path, text) => {
    await send('Page.navigate', { url: new URL(path, base).href })
    await waitForFunction('function(text) { return document.readyState === "complete" && document.body.innerText.includes(text) }', [text])
    await pause(300)
  }
  const fill = async (selector, value) => {
    await callFunction('function(selector, value) { const input = document.querySelector(selector); if (!input) throw new Error("Missing input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); }', [selector, value])
  }
  const noOverflow = async () => assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), true, 'Page overflows the viewport')
  await send('Emulation.setDeviceMetricsOverride', {width:1280,height:900,deviceScaleFactor:1,mobile:false})
  await navigate('/projects', 'Build your next project.')
  await fill('main input', 'not-an-address')
  await evaluate('document.querySelector("main form").requestSubmit()')
  await waitFor('Array.from(document.querySelectorAll("[role=alert]")).some(el=>el.textContent.includes("address")) || document.querySelector("main input").validity.patternMismatch')
  await noOverflow()
  console.log('PASS projects rejects invalid addresses')
  await navigate('/setup?next=/vesting', 'Ready for your first transaction?')
  await waitFor('document.querySelector("main a.workspace-button[href=\\"/vesting\\"]") !== null')
  await navigate('/setup?next=/unknown', 'Ready for your first transaction?')
  await waitFor('document.querySelector("main a.workspace-button[href=\\"/projects\\"]") !== null')
  console.log('PASS setup returns to known tools and rejects unknown destinations')
  await navigate('/launch', 'Token Basics')
  await waitFor('document.querySelector("input[placeholder=\\"e.g. My Awesome Token\\"]") !== null')
  await fill('input[placeholder="e.g. My Awesome Token"]', 'Browser Journey Token')
  await fill('input[placeholder="e.g. MAT"]', 'BJT')
  await fill('input[type=number]', '1000000')
  await waitFor('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("Next") && !b.disabled)')
  await send('Page.reload')
  await waitFor('document.querySelector("input[placeholder=\\"e.g. My Awesome Token\\"]")?.value === "Browser Journey Token"')
  const openTokenReview = async () => {
    for (let step = 0; step < 2; step++) {
      await evaluate('Array.from(document.querySelectorAll("main button")).find(button => button.textContent.includes("Next") && !button.disabled).click()')
      await pause(100)
    }
  }
  await openTokenReview()
  await waitFor('document.body.innerText.includes("The factory fee could not be verified.")')
  assert.equal(await evaluate('document.querySelector("main").innerText.includes("0.05 zkLTC")'), false)
  serveZeroFactoryFee = true
  await navigate('/launch', 'Token Basics')
  await waitFor('document.querySelector("input[type=number]")?.value === "1000000"')
  await openTokenReview()
  await waitFor('Array.from(document.querySelectorAll("main span")).some(el => el.textContent === "0 zkLTC")')
  serveZeroFactoryFee = false
  console.log('PASS token draft reload, unavailable fee and verified zero fee')
  await navigate('/explorer', 'Latest Block')
  await waitFor('document.querySelector("main").innerText.split("Unavailable").length >= 4')
  console.log('PASS failed explorer feeds mark all unknown counts unavailable')
  const token = '0x1111111111111111111111111111111111111111'
  await navigate(`/vesting?token=${token}`, 'Plan your token releases')
  await waitForFunction('function(token) { return Array.from(document.querySelectorAll("input")).some(el => el.value === token) }', [token])
  assert.equal(await evaluate('document.body.innerText.includes("Connect your wallet when you’re ready")'), true)
  console.log('PASS token handoff without a wallet')
  await navigate(`/locker/verify?chain=1&id=1`, 'Choose LitVM testnet')
  console.log('PASS public certificate rejects the wrong chain')
  await navigate(`/portfolio?address=${token}`, 'Portfolio')
  await waitForFunction('function(token) { return document.body.innerText.includes(token.slice(0, 6)) || Array.from(document.querySelectorAll("input")).some(el => el.value === token) }', [token])
  console.log('PASS address-only portfolio')
  await navigate('/transactions', 'No transactions yet')
  await evaluate('document.querySelector("details").open = true')
  await waitFor('document.body.innerText.includes("Usage sharing is currently unavailable.")')
  assert.equal(await evaluate('document.querySelector("input[type=checkbox]").checked'), false)
  console.log('PASS empty transaction history and metrics opt-in default')
  const pending = {id:'browser-pending', chainId:4441, account:token, target:token, hash:`0x${'2'.repeat(64)}`, action:'createToken',stage:'submitted',createdAt:1,updatedAt:1}
  await callFunction('function(entries) { localStorage.setItem("lester:transactions:v1", JSON.stringify(entries)) }', [[pending]])
  await send('Page.reload')
  await waitFor('document.body.innerText.includes("Waiting for confirmation")')
  assert.equal(await evaluate('Array.from(document.querySelectorAll("button")).some(b=>/retry|resend/i.test(b.textContent))'),false)
  console.log('PASS pending history survives reload and RPC failure without a retry action')
  await navigate('/analytics','Activity, at a glance.')
  const tabPoint = await evaluate('(() => { const r=Array.from(document.querySelectorAll("[role=tab]")).find(el=>el.textContent === "Tokens").getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()')
  await send('Input.dispatchMouseEvent', {type:'mousePressed',...tabPoint,button:'left',clickCount:1})
  await send('Input.dispatchMouseEvent', {type:'mouseReleased',...tabPoint,button:'left',clickCount:1})
  await waitFor('document.body.innerText.includes("We couldn’t load activity.")')
  assert.equal(await evaluate('document.body.innerText.includes("No entries on this page.")'),false)
  console.log('PASS unavailable history is not presented as empty activity')
  for (const width of [320, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:844,deviceScaleFactor:1,mobile:true})
    await navigate('/', 'LESTER LABS')
    await waitFor('document.querySelector(".scroll-hero-stats")?.innerText.includes("Snapshot")')
    let originalCounterSize
    for (const scale of [100, 150]) {
      await callFunction('function(scale) { document.documentElement.style.fontSize = scale + "%"; }', [scale])
      const layout = await evaluate(`(() => {
        const stats = document.querySelector('.scroll-hero-stats')
        const next = document.querySelector('.scroll-hero-spacer').nextElementSibling
        const cards = [...stats.querySelectorAll('small')].filter(el => el.textContent.includes('Snapshot'))
        const fits = cards.every(label => {
          const card = label.parentElement.getBoundingClientRect()
          return [...label.parentElement.children].every(child => {
            const box = child.getBoundingClientRect()
            return box.left >= card.left - 1 && box.right <= card.right + 1
          })
        })
        const size = parseFloat(getComputedStyle(cards[0].parentElement.firstElementChild).fontSize)
        return { cards: cards.length, bottom: stats.getBoundingClientRect().bottom, next: next.getBoundingClientRect().top, fits, size }
      })()`)
      assert.equal(layout.cards, 5)
      assert.ok(layout.fits, `Counter text escapes its card at ${width}px and ${scale}%`)
      if (scale === 100) originalCounterSize = layout.size
      else assert.ok(layout.size >= originalCounterSize * 1.49, 'Counter type must follow the requested font size')
      assert.ok(layout.bottom <= layout.next + 1, `Hero overlaps at ${width}px and ${scale}% font size`)
      await noOverflow()
    }
    await evaluate('document.documentElement.style.fontSize = ""')
  }
  console.log('PASS dated counters clear the next section at three mobile widths and enlarged text')
  const pressKey = async (key, shift = false) => {
    for (const type of ['rawKeyDown','keyUp']) await send('Input.dispatchKeyEvent', {
      type, key, code: key, windowsVirtualKeyCode: key === 'Tab' ? 9 : 27, modifiers: shift ? 8 : 0,
    })
  }
  await evaluate('document.querySelector("button[aria-controls=mobile-navigation-menu]").click()')
  const toggleSelector = 'button[aria-controls=mobile-navigation-menu]'
  await waitFor(`document.activeElement.matches('${toggleSelector}[aria-expanded=true]')`)
  await pressKey('Tab', true)
  assert.equal(await evaluate('document.activeElement === Array.from(document.querySelectorAll("#mobile-navigation-menu a[href]")).at(-1)'), true)
  await pressKey('Tab')
  assert.equal(await evaluate(`document.activeElement.matches('${toggleSelector}')`), true)
  await pressKey('Tab')
  assert.equal(await evaluate('document.activeElement === document.querySelector("#mobile-navigation-menu a[href]")'), true)
  await pressKey('Escape')
  await waitFor(`document.activeElement.matches('${toggleSelector}[aria-expanded=false]')`)
  console.log('PASS mobile navigation wraps keyboard focus and returns focus on Escape')
  for (const [path,text] of [['/projects','Build your next project.'],['/setup','Ready for your first transaction?'],['/locker/verify','Check a liquidity lock'],['/vesting','Plan your token releases'],['/transactions','Transactions']]) {
    await navigate(path,text); await noOverflow()
  }
  console.log('PASS five mobile routes without horizontal overflow')
  for (const [path,text] of [['/swap','Lester Swap'],['/pool','Liquidity Pool'],['/launch','Lester Minter'],['/launchpad','Lester Launch'],['/airdrop','Lester Dropper'],['/docs','Lester Labs Documentation'],['/tutorials','LitVM DeFi Tutorials'],['/governance','Lester Gov'],['/locker','New deposits are paused'],['/vesting','Plan your token releases'],['/portfolio','Your portfolio']]) {
    await navigate(path,text)
    await noOverflow()
    const semantics = await evaluate(`(() => {
      const visible = (element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' }
      const unnamed = Array.from(document.querySelectorAll('button,input,select,textarea')).filter((element) => {
        if (!visible(element) || element.type === 'hidden') return false
        return !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.labels?.length || element.textContent?.trim() || element.title)
      }).length
      const undersized = Array.from(document.querySelectorAll('button,input,select')).filter((element) => {
        if (!visible(element) || ['checkbox','radio','range','hidden'].includes(element.type)) return false
        return element.getBoundingClientRect().height < 43.5
      }).length
      return { mains: document.querySelectorAll('main').length, namedMain: Boolean(document.querySelector('main')?.getAttribute('aria-label')?.trim()), h1s: document.querySelectorAll('main h1').length, unnamed, undersized }
    })()`)
    assert.deepEqual(semantics, { mains: 1, namedMain: true, h1s: 1, unnamed: 0, undersized: 0 }, `${path} mobile semantics regressed`)
  }
  console.log('PASS tool routes with one main, one h1, named controls, and 44px mobile targets')
} finally {
  for (const pending of requests.values()) { clearTimeout(pending.timeout); pending.reject(new Error('Browser closed')) }
  requests.clear()
  chrome.stdio[3].end()
  chrome.kill('SIGTERM')
  await Promise.race([once(chrome,'exit'), pause(3000)])
  if (chrome.exitCode === null) chrome.kill('SIGKILL')
  await rm(profile, { recursive:true, force:true, maxRetries:3, retryDelay:100 })
}
