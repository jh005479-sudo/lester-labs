#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { keccak256 } from 'viem'
import { requirePlatformActivityApiCoverage } from './platform-activity-coverage.mjs'

/**
 * Read-only cutover capture for the historical homepage activity floor.
 *
 * This script never signs, writes to the repository, accepts endpoint
 * overrides, or sends an RPC method other than the allowlisted reads below.
 * Review its JSON output and commit the selected values separately.
 */

export const LITVM_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http'
const PRODUCTION_STATS_URL = 'https://www.lester-labs.com/api/platform-stats'
export const EXPECTED_CHAIN_ID = 4_441n
const MAX_RESPONSE_BYTES = 100_000

export const LEGACY = Object.freeze({
  tokenFactory: '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948',
  iloFactories: Object.freeze([
    '0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f',
    '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB',
  ]),
  ledger: '0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079',
})

export const SELECTORS = Object.freeze({
  getILOCount: '0xa7113af8',
  messageCount: '0x3dbcc8d1',
})

export const LEGACY_RUNTIME_CODE_HASHES = Object.freeze({
  tokenFactory: '0x5b3bb2e693021e2ab040b6bf248785eb627600bbec002e87c10e138521be1d9d',
  iloFactories: Object.freeze([
    '0xed56b878c6c936b7a54c0fc501a87cd96dc185e8d0967759df88817a03bc2dd5',
    '0x9c52ccc3cf932eeff5f19c65d7055f9c8eaa50b68e64a1e1e6bafebaf0e81b9a',
  ]),
  ledger: '0x5bfae473fddc1457d06edc1c5603f0217b0b3debdc34969abe1611b386fb4233',
})

export const PLATFORM_ACTIVITY_CONTINUITY_FLOORS = Object.freeze({
  tokensMinted: 500_139,
  walletsAirdropped: 16_433,
  presalesCreated: 8_451,
  swapsCompleted: 12_975,
  onChainMessages: 66_776,
})

export const CUTOVER_CONFIGURATION = Object.freeze({
  chainId: Number(EXPECTED_CHAIN_ID),
  legacy: LEGACY,
  selectors: SELECTORS,
  runtimeCodeHashes: LEGACY_RUNTIME_CODE_HASHES,
  continuityFloors: PLATFORM_ACTIVITY_CONTINUITY_FLOORS,
})

export const CUTOVER_METRIC_METHODS = Object.freeze({
  tokensMinted: 'Block-pinned legacy TokenFactory CREATE nonce minus the EIP-161 initial contract nonce.',
  walletsAirdropped: 'First-party historical production display floor; the legacy Disperse contract has no authenticated counter or event and addresses may repeat.',
  presalesCreated: 'Sum of both source-pinned legacy ILOFactory getILOCount() values at the captured block.',
  swapsCompleted: 'First-party historical production display floor; the old API may serve a bounded/fallback swap audit and this is not volume or distinct users.',
  onChainMessages: 'Source-pinned legacy Ledger messageCount() at the captured block.',
})

export function requireHex(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/u.test(value)) {
    throw new Error(`${label} is not a hexadecimal quantity.`)
  }
  return value
}

export function toSafeNumber(value, label) {
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

export async function fetchBoundedJson(url, init, label) {
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

export function createJsonRpcReader(rpcUrl) {
  let requestId = 0
  return async function rpc(method, params) {
    const allowed = new Set([
      'eth_chainId',
      'eth_blockNumber',
      'eth_getBlockByNumber',
      'eth_getTransactionCount',
      'eth_call',
      'eth_getCode',
    ])
    if (!allowed.has(method)) throw new Error(`RPC method is not allowlisted: ${method}`)
    const id = ++requestId
    const payload = await fetchBoundedJson(
      rpcUrl,
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
}

export async function readUint256(rpc, address, selector, blockTag, label) {
  const result = await rpc('eth_call', [{ to: address, data: selector }, blockTag])
  return toSafeNumber(result, label)
}

export async function readLegacyCutoverState(rpc, blockTag, hashRuntimeCode = keccak256) {
  const [factoryNonceHex, firstIloCount, secondIloCount, messageCount, tokenFactoryCode, firstIloCode, secondIloCode, ledgerCode] = await Promise.all([
    rpc('eth_getTransactionCount', [LEGACY.tokenFactory, blockTag]),
    readUint256(rpc, LEGACY.iloFactories[0], SELECTORS.getILOCount, blockTag, 'primary ILO count'),
    readUint256(rpc, LEGACY.iloFactories[1], SELECTORS.getILOCount, blockTag, 'earlier ILO count'),
    readUint256(rpc, LEGACY.ledger, SELECTORS.messageCount, blockTag, 'Ledger message count'),
    rpc('eth_getCode', [LEGACY.tokenFactory, blockTag]),
    rpc('eth_getCode', [LEGACY.iloFactories[0], blockTag]),
    rpc('eth_getCode', [LEGACY.iloFactories[1], blockTag]),
    rpc('eth_getCode', [LEGACY.ledger, blockTag]),
  ])
  const runtimeCodeHashes = {
    tokenFactory: hashRuntimeCode(requireHex(tokenFactoryCode, 'TokenFactory runtime code')),
    iloFactories: [
      hashRuntimeCode(requireHex(firstIloCode, 'primary ILOFactory runtime code')),
      hashRuntimeCode(requireHex(secondIloCode, 'earlier ILOFactory runtime code')),
    ],
    ledger: hashRuntimeCode(requireHex(ledgerCode, 'Ledger runtime code')),
  }
  if (JSON.stringify(runtimeCodeHashes).toLowerCase() !== JSON.stringify(LEGACY_RUNTIME_CODE_HASHES).toLowerCase()) {
    throw new Error('The exact-block legacy runtime configuration does not match the source-pinned cutover configuration.')
  }

  const factoryNonce = BigInt(requireHex(factoryNonceHex, 'TokenFactory nonce'))
  const tokensMinted = toSafeNumber(factoryNonce > 0n ? factoryNonce - 1n : 0n, 'TokenFactory creation count')
  const presalesCreated = firstIloCount + secondIloCount
  if (!Number.isSafeInteger(presalesCreated)) throw new Error('Combined ILO count is unsafe.')

  return {
    factoryNonce,
    firstIloCount,
    secondIloCount,
    messageCount,
    tokensMinted,
    presalesCreated,
    runtimeCodeHashes,
  }
}

export async function capture() {
  const rpc = createJsonRpcReader(LITVM_RPC_URL)
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

  const [legacyState, productionStats] = await Promise.all([
    readLegacyCutoverState(rpc, blockTag),
    fetchBoundedJson(PRODUCTION_STATS_URL, { method: 'GET' }, 'production platform-stats API'),
  ])

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
  if (apiCounts.tokensMinted !== legacyState.tokensMinted) {
    warnings.push(`Production token display ${apiCounts.tokensMinted} differed from block-pinned factory count ${legacyState.tokensMinted}; the on-chain count was selected.`)
  }
  if (apiCounts.presalesCreated !== legacyState.presalesCreated) {
    warnings.push(`Production presale display ${apiCounts.presalesCreated} differed from block-pinned factory total ${legacyState.presalesCreated}; the on-chain total was selected.`)
  }
  if (apiCounts.onChainMessages !== legacyState.messageCount) {
    warnings.push(`Production message display ${apiCounts.onChainMessages} differed from block-pinned Ledger count ${legacyState.messageCount}; the on-chain count was selected.`)
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
      tokensMinted: legacyState.tokensMinted,
      walletsAirdropped: apiCounts.walletsAirdropped,
      presalesCreated: legacyState.presalesCreated,
      swapsCompleted: apiCounts.swapsCompleted,
      onChainMessages: legacyState.messageCount,
    },
    configuration: CUTOVER_CONFIGURATION,
    components: {
      tokenFactoryNonce: toSafeNumber(legacyState.factoryNonce, 'TokenFactory nonce'),
      iloFactoryCounts: [legacyState.firstIloCount, legacyState.secondIloCount],
      runtimeCodeHashes: legacyState.runtimeCodeHashes,
      productionApiObservedAt: typeof productionStats.fetchedAt === 'string' ? productionStats.fetchedAt : null,
      productionApiCounts: apiCounts,
      productionApiCoverage: apiCoverage,
    },
    metricMethods: CUTOVER_METRIC_METHODS,
    warnings,
    operatorRequirements: [
      'Do not activate replacements from this output alone.',
      'Require the clean exporter to prove all five replacement counters are zero at this exact block before using it as the historical floor.',
      'Verify this exact candidate from a second clean network through a different credential-free RPC origin.',
      'Review the two first-party bounded counters and their coverage labels explicitly.',
      'Set every replacement activity start block to throughBlock + 1 and run the full configuration test suite.',
    ],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await capture()
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`Cutover capture failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
