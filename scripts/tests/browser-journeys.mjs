/** Local-only browser regression tests. Uses an already installed Chromium; downloads nothing. */
import assert from 'node:assert/strict'
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
  console.log('PASS token validation and draft reload')
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
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
  for (const [path,text] of [['/projects','Build your next project.'],['/setup','Ready for your first transaction?'],['/locker/verify','Check a liquidity lock'],['/vesting','Plan your token releases'],['/transactions','Transactions']]) {
    await navigate(path,text); await noOverflow()
  }
  console.log('PASS five mobile routes without horizontal overflow')
} finally {
  for (const pending of requests.values()) { clearTimeout(pending.timeout); pending.reject(new Error('Browser closed')) }
  requests.clear()
  chrome.stdio[3].end()
  chrome.kill('SIGTERM')
  await Promise.race([once(chrome,'exit'), pause(3000)])
  if (chrome.exitCode === null) chrome.kill('SIGKILL')
  await rm(profile, { recursive:true, force:true, maxRetries:3, retryDelay:100 })
}
