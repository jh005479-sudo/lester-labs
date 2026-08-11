import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PLATFORM_ACTIVITY_BASELINE } from '../config/platformActivitySnapshot.ts'

import {
  CUTOVER_CONFIGURATION,
  CUTOVER_METRIC_METHODS,
  LEGACY,
  LEGACY_RUNTIME_CODE_HASHES,
  PLATFORM_ACTIVITY_CONTINUITY_FLOORS,
  SELECTORS,
} from '../../scripts/security/capture-platform-activity-cutover.mjs'
import {
  requireCredentialFreeSecondRpcUrl,
  requirePlatformActivityCutoverCandidate,
  verifyPlatformActivityCutoverCandidate,
} from '../../scripts/security/verify-platform-activity-cutover.mjs'

const THROUGH_BLOCK = 36_723_038
const BLOCK_TAG = `0x${BigInt(THROUGH_BLOCK).toString(16)}`
const BLOCK_HASH = `0x${'ab'.repeat(32)}`
const BLOCK_TIMESTAMP_SECONDS = 1_785_000_000

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function coveragePayload() {
  return Object.fromEntries(Object.keys(PLATFORM_ACTIVITY_CONTINUITY_FLOORS).map((name) => [
    name,
    { status: 'historical-baseline', note: `${name} reviewed candidate coverage` },
  ]))
}

function candidateFixture() {
  const totals = { ...PLATFORM_ACTIVITY_CONTINUITY_FLOORS }
  return {
    schemaVersion: 1,
    snapshotKind: 'post-replacement-cutover',
    reviewStatus: 'candidate-read-only-capture',
    chainId: 4_441,
    throughBlock: THROUGH_BLOCK,
    blockHash: BLOCK_HASH,
    blockTimestamp: new Date(BLOCK_TIMESTAMP_SECONDS * 1_000).toISOString(),
    capturedAt: '2026-08-10T22:00:00.000Z',
    totals,
    configuration: jsonClone(CUTOVER_CONFIGURATION),
    components: {
      tokenFactoryNonce: totals.tokensMinted + 1,
      iloFactoryCounts: [8_330, 121],
      runtimeCodeHashes: jsonClone(LEGACY_RUNTIME_CODE_HASHES),
      productionApiObservedAt: '2026-08-10T21:59:59.000Z',
      productionApiCounts: { ...totals },
      productionApiCoverage: coveragePayload(),
    },
    metricMethods: { ...CUTOVER_METRIC_METHODS },
    warnings: [],
    operatorRequirements: ['Independently review this candidate before activation.'],
  }
}

function fakeRpc({ blockHash = BLOCK_HASH } = {}) {
  const calls = []
  const rpc = async (method, params) => {
    calls.push([method, params])
    if (method === 'eth_chainId') return '0x1159'
    if (method === 'eth_getBlockByNumber') {
      return {
        number: BLOCK_TAG,
        hash: blockHash,
        timestamp: `0x${BigInt(BLOCK_TIMESTAMP_SECONDS).toString(16)}`,
      }
    }
    if (method === 'eth_getTransactionCount') {
      assert.deepEqual(params, [LEGACY.tokenFactory, BLOCK_TAG])
      return `0x${BigInt(PLATFORM_ACTIVITY_CONTINUITY_FLOORS.tokensMinted + 1).toString(16)}`
    }
    if (method === 'eth_call') {
      assert.equal(params[1], BLOCK_TAG)
      if (params[0].to === LEGACY.iloFactories[0] && params[0].data === SELECTORS.getILOCount) return '0x208a'
      if (params[0].to === LEGACY.iloFactories[1] && params[0].data === SELECTORS.getILOCount) return '0x79'
      if (params[0].to === LEGACY.ledger && params[0].data === SELECTORS.messageCount) return '0x104d8'
    }
    if (method === 'eth_getCode') {
      assert.equal(params[1], BLOCK_TAG)
      if (params[0] === LEGACY.tokenFactory) return '0x01'
      if (params[0] === LEGACY.iloFactories[0]) return '0x02'
      if (params[0] === LEGACY.iloFactories[1]) return '0x03'
      if (params[0] === LEGACY.ledger) return '0x04'
    }
    throw new Error(`Unexpected fake RPC request: ${method} ${JSON.stringify(params)}`)
  }
  return { calls, rpc }
}

const runtimeHashes = new Map([
  ['0x01', LEGACY_RUNTIME_CODE_HASHES.tokenFactory],
  ['0x02', LEGACY_RUNTIME_CODE_HASHES.iloFactories[0]],
  ['0x03', LEGACY_RUNTIME_CODE_HASHES.iloFactories[1]],
  ['0x04', LEGACY_RUNTIME_CODE_HASHES.ledger],
])

function fakeRuntimeHasher(code) {
  const hash = runtimeHashes.get(code)
  if (!hash) throw new Error(`Unexpected runtime code: ${code}`)
  return hash
}

describe('platform activity cutover second-RPC verification', () => {
  it('keeps every compiled post-cutover homepage total at or above its immutable continuity floor', () => {
    assert.equal(PLATFORM_ACTIVITY_BASELINE.snapshotKind, 'post-replacement-cutover')
    for (const [name, floor] of Object.entries(PLATFORM_ACTIVITY_CONTINUITY_FLOORS)) {
      assert.ok(PLATFORM_ACTIVITY_BASELINE.totals[name] >= floor)
    }
  })

  it('re-reads only the candidate exact block and proves config, floors, runtimes, and counters', async () => {
    const { calls, rpc } = fakeRpc()
    const proof = await verifyPlatformActivityCutoverCandidate(candidateFixture(), {
      rpc,
      hashRuntimeCode: fakeRuntimeHasher,
    })

    assert.equal(proof.status, 'VERIFIED_SECOND_RPC')
    assert.equal(proof.throughBlock, THROUGH_BLOCK)
    assert.deepEqual(proof.verifiedCounters, PLATFORM_ACTIVITY_CONTINUITY_FLOORS)
    const blockPinnedReads = calls.filter(([method]) => method !== 'eth_chainId')
    assert.ok(blockPinnedReads.length > 0)
    for (const [method, params] of blockPinnedReads) {
      const expectedTagIndex = method === 'eth_getBlockByNumber' ? 0 : 1
      assert.equal(params[expectedTagIndex], BLOCK_TAG, `${method} must use the exact candidate block`)
    }
    assert.equal(calls.filter(([method]) => method === 'eth_getBlockByNumber').length, 2)
  })

  it('fails closed for a changed block identity or exact-block counter', async () => {
    const changedBlock = fakeRpc({ blockHash: `0x${'cd'.repeat(32)}` })
    await assert.rejects(
      verifyPlatformActivityCutoverCandidate(candidateFixture(), {
        rpc: changedBlock.rpc,
        hashRuntimeCode: fakeRuntimeHasher,
      }),
      /did not return the candidate block identity/i,
    )

    const changedCounter = candidateFixture()
    changedCounter.totals.onChainMessages += 1
    const stable = fakeRpc()
    await assert.rejects(
      verifyPlatformActivityCutoverCandidate(changedCounter, {
        rpc: stable.rpc,
        hashRuntimeCode: fakeRuntimeHasher,
      }),
      /counters or runtime configuration differ/i,
    )

    const changedRuntime = fakeRpc()
    await assert.rejects(
      verifyPlatformActivityCutoverCandidate(candidateFixture(), {
        rpc: changedRuntime.rpc,
        hashRuntimeCode: (code) => (
          code === '0x04' ? `0x${'00'.repeat(32)}` : fakeRuntimeHasher(code)
        ),
      }),
      /runtime configuration does not match/i,
    )
  })

  it('rejects an under-floor, reconfigured, or extended candidate before any RPC read', () => {
    const belowFloor = candidateFixture()
    belowFloor.totals.walletsAirdropped -= 1
    belowFloor.components.productionApiCounts.walletsAirdropped -= 1
    assert.throws(
      () => requirePlatformActivityCutoverCandidate(belowFloor),
      /below the source-pinned continuity floor/i,
    )

    const reconfigured = candidateFixture()
    reconfigured.configuration.legacy.ledger = '0x1111111111111111111111111111111111111111'
    assert.throws(
      () => requirePlatformActivityCutoverCandidate(reconfigured),
      /does not pin the reviewed legacy configuration/i,
    )

    const extended = { ...candidateFixture(), unreviewed: true }
    assert.throws(
      () => requirePlatformActivityCutoverCandidate(extended),
      /exactly the reviewed fields/i,
    )
  })

  it('accepts only a credential-free HTTPS endpoint on a second RPC origin', () => {
    assert.equal(
      requireCredentialFreeSecondRpcUrl('https://independent-rpc.example/liteforge'),
      'https://independent-rpc.example/liteforge',
    )
    assert.throws(
      () => requireCredentialFreeSecondRpcUrl('https://liteforge.rpc.caldera.xyz/alternate'),
      /different RPC origin/i,
    )
    assert.throws(
      () => requireCredentialFreeSecondRpcUrl('https://user:secret@independent-rpc.example/liteforge'),
      /must not contain credentials/i,
    )
    assert.throws(
      () => requireCredentialFreeSecondRpcUrl('https://independent-rpc.example/liteforge?key=secret'),
      /must not contain credentials/i,
    )
    assert.throws(
      () => requireCredentialFreeSecondRpcUrl('http://independent-rpc.example/liteforge'),
      /must use HTTPS/i,
    )
  })
})
