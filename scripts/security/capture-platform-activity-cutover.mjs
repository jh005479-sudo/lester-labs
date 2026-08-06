#!/usr/bin/env node

import { requirePlatformActivityApiCoverage } from './platform-activity-coverage.mjs'

/**
 * Read-only cutover capture for the historical homepage activity floor.
 *
 * This script never signs, writes to the repository, accepts endpoint
 * overrides, or sends an RPC method other than the allowlisted reads below.
 * Review its JSON output and commit the selected values separately.
 */

const LITVM_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http'
const PRODUCTION_STATS_URL = 'https://www.lester-labs.com/api/platform-stats'
const EXPECTED_CHAIN_ID = 4_441n
const MAX_RESPONSE_BYTES = 100_000

const LEGACY = Object.freeze({
  tokenFactory: '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948',
  iloFactories: Object.freeze([
    '0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f',
    '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB',
  ]),
  ledger: '0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079',
})

const SELECTORS = Object.freeze({
  getILOCount: '0xa7113af8',
  messageCount: '0x3dbcc8d1',
})

let requestId = 0

function requireHex(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/u.test(value)) {
    throw new Error(`${label} is not a hexadecimal quantity.`)
  }
  return value
}

function toSafeNumber(value, label) {
  const parsed = typeof value === 'bigint' ? value : BigInt(requireHex(value, label))
  if (parsed < 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds the safe counter range.`)
  }
  return Number(parsed)
}

function requireApiCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Production API ${label} is not a non-negative safe integer.`)
  }
  return value
}

async function readBoundedUtf8(response, label) {
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength)
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 1 || parsedLength > MAX_RESPONSE_BYTES) {
      throw new Error(`${label} declared an empty, invalid, or oversized response.`)
    }
  }
  if (!response.body) throw new Error(`${label} returned no response body.`)

  const reader = response.body.getReader()
  const chunks = []
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel('response byte limit exceeded')
      throw new Error(`${label} exceeded the response byte limit.`)
    }
    chunks.push(value)
  }
  if (receivedBytes === 0) throw new Error(`${label} returned an empty response.`)

  const bytes = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

async function fetchBoundedJson(url, init, label) {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`)
  const body = await readBoundedUtf8(response, label)
  return JSON.parse(body)
}

async function rpc(method, params) {
  const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getTransactionCount', 'eth_call'])
  if (!allowed.has(method)) throw new Error(`RPC method is not allowlisted: ${method}`)
  const id = ++requestId
  const payload = await fetchBoundedJson(
    LITVM_RPC_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    },
    `LiteForge ${method}`,
  )
  if (!payload || payload.jsonrpc !== '2.0' || payload.id !== id || payload.error || payload.result === undefined) {
    throw new Error(`LiteForge ${method} returned an invalid JSON-RPC response.`)
  }
  return payload.result
}

async function readUint256(address, selector, blockTag, label) {
  const result = await rpc('eth_call', [{ to: address, data: selector }, blockTag])
  return toSafeNumber(result, label)
}

async function capture() {
  const chainId = BigInt(requireHex(await rpc('eth_chainId', []), 'chain ID'))
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Unexpected chain ID ${chainId}; expected ${EXPECTED_CHAIN_ID}.`)
  }

  const blockTag = requireHex(await rpc('eth_blockNumber', []), 'latest block')
  const block = await rpc('eth_getBlockByNumber', [blockTag, false])
  if (
    !block ||
    requireHex(block.number, 'block number').toLowerCase() !== blockTag.toLowerCase() ||
    typeof block.hash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/u.test(block.hash)
  ) throw new Error('Latest block identity is incomplete or inconsistent.')

  const [factoryNonceHex, firstIloCount, secondIloCount, messageCount, productionStats] = await Promise.all([
    rpc('eth_getTransactionCount', [LEGACY.tokenFactory, blockTag]),
    readUint256(LEGACY.iloFactories[0], SELECTORS.getILOCount, blockTag, 'primary ILO count'),
    readUint256(LEGACY.iloFactories[1], SELECTORS.getILOCount, blockTag, 'earlier ILO count'),
    readUint256(LEGACY.ledger, SELECTORS.messageCount, blockTag, 'Ledger message count'),
    fetchBoundedJson(PRODUCTION_STATS_URL, { method: 'GET' }, 'production platform-stats API'),
  ])

  const factoryNonce = BigInt(requireHex(factoryNonceHex, 'TokenFactory nonce'))
  const tokensMinted = toSafeNumber(factoryNonce > 0n ? factoryNonce - 1n : 0n, 'TokenFactory creation count')
  const presalesCreated = firstIloCount + secondIloCount
  if (!Number.isSafeInteger(presalesCreated)) throw new Error('Combined ILO count is unsafe.')

  const apiCounts = {
    tokensMinted: requireApiCount(productionStats.tokensMinted, 'tokensMinted'),
    walletsAirdropped: requireApiCount(productionStats.walletsAirdropped, 'walletsAirdropped'),
    presalesCreated: requireApiCount(productionStats.presalesCreated, 'presalesCreated'),
    swapsCompleted: requireApiCount(productionStats.swapsCompleted, 'swapsCompleted'),
    onChainMessages: requireApiCount(productionStats.onChainMessages, 'onChainMessages'),
  }
  const apiCoverage = requirePlatformActivityApiCoverage(productionStats.coverage)

  const repeatedBlock = await rpc('eth_getBlockByNumber', [blockTag, false])
  if (!repeatedBlock || repeatedBlock.hash?.toLowerCase() !== block.hash.toLowerCase()) {
    throw new Error('The captured block hash changed during verification.')
  }

  const blockTimestampSeconds = toSafeNumber(block.timestamp, 'block timestamp')
  const warnings = []
  if (apiCounts.tokensMinted !== tokensMinted) {
    warnings.push(`Production token display ${apiCounts.tokensMinted} differed from block-pinned factory count ${tokensMinted}; the on-chain count was selected.`)
  }
  if (apiCounts.presalesCreated !== presalesCreated) {
    warnings.push(`Production presale display ${apiCounts.presalesCreated} differed from block-pinned factory total ${presalesCreated}; the on-chain total was selected.`)
  }
  if (apiCounts.onChainMessages !== messageCount) {
    warnings.push(`Production message display ${apiCounts.onChainMessages} differed from block-pinned Ledger count ${messageCount}; the on-chain count was selected.`)
  }

  return {
    schemaVersion: 1,
    snapshotKind: 'post-replacement-cutover',
    reviewStatus: 'candidate-read-only-capture',
    chainId: Number(EXPECTED_CHAIN_ID),
    throughBlock: toSafeNumber(block.number, 'block number'),
    blockHash: block.hash,
    blockTimestamp: new Date(blockTimestampSeconds * 1_000).toISOString(),
    capturedAt: new Date().toISOString(),
    totals: {
      tokensMinted,
      walletsAirdropped: apiCounts.walletsAirdropped,
      presalesCreated,
      swapsCompleted: apiCounts.swapsCompleted,
      onChainMessages: messageCount,
    },
    components: {
      tokenFactoryNonce: toSafeNumber(factoryNonce, 'TokenFactory nonce'),
      iloFactoryCounts: [firstIloCount, secondIloCount],
      productionApiObservedAt: typeof productionStats.fetchedAt === 'string' ? productionStats.fetchedAt : null,
      productionApiCounts: apiCounts,
      productionApiCoverage: apiCoverage,
    },
    metricMethods: {
      tokensMinted: 'Block-pinned legacy TokenFactory CREATE nonce minus the EIP-161 initial contract nonce.',
      walletsAirdropped: 'First-party historical production display floor; the legacy Disperse contract has no authenticated counter or event and addresses may repeat.',
      presalesCreated: 'Sum of both source-pinned legacy ILOFactory getILOCount() values at the captured block.',
      swapsCompleted: 'First-party historical production display floor; the old API may serve a bounded/fallback swap audit and this is not volume or distinct users.',
      onChainMessages: 'Source-pinned legacy Ledger messageCount() at the captured block.',
    },
    warnings,
    operatorRequirements: [
      'Do not activate replacements from this output alone.',
      'Confirm all five replacement counters are zero before using this as the historical floor.',
      'Repeat from a second clean network and require the same block-pinned on-chain results.',
      'Review the two first-party bounded counters and their coverage labels explicitly.',
      'Set every replacement activity start block to throughBlock + 1 and run the full configuration test suite.',
    ],
  }
}

try {
  const result = await capture()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`Cutover capture failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
