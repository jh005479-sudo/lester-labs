import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { checkTokenSafety, rpcCall } from './token-safety.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('token safety RPC timeout', () => {
  it('aborts a stalled RPC request within the configured deadline', async () => {
    globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })

    await assert.rejects(rpcCall('eth_getCode', [], 10), /timed out after 10ms/i)
  })

  it('returns an unknown, non-authoritative report when bytecode analysis times out', async () => {
    globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })

    const report = await checkTokenSafety('0x0000000000000000000000000000000000000001', 10)
    assert.equal(report.score, 'caution')
    assert.equal(report.checks[0].status, 'unknown')
    assert.match(report.checks[0].detail, /no safety conclusion was made/i)
  })

  it('treats a mint selector match as a non-authoritative review signal', async () => {
    globalThis.fetch = async (_url, init) => {
      const { method } = JSON.parse(init?.body)
      const result = method === 'eth_getCode' ? '0x604040c10f196000' : '0x'
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const report = await checkTokenSafety('0x0000000000000000000000000000000000000001', 10)
    const mintSignal = report.checks.find((check) => check.name === 'Mint selector signal')

    assert.equal(mintSignal?.status, 'warn')
    assert.match(mintSignal?.detail ?? '', /does not prove/i)
    assert.notEqual(report.score, 'risky')
  })
})
