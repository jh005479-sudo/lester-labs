#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { keccak256 } from 'viem'

import { requirePlatformActivityApiCoverage } from './platform-activity-coverage.mjs'
import {
  CUTOVER_CONFIGURATION,
  CUTOVER_METRIC_METHODS,
  EXPECTED_CHAIN_ID,
  LEGACY_RUNTIME_CODE_HASHES,
  LITVM_RPC_URL,
  PLATFORM_ACTIVITY_CONTINUITY_FLOORS,
  createJsonRpcReader,
  readLegacyCutoverState,
  requireHex,
  toSafeNumber,
} from './capture-platform-activity-cutover.mjs'

const MAX_CANDIDATE_BYTES = 200_000
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/u
const METRIC_NAMES = Object.freeze([
  'tokensMinted',
  'walletsAirdropped',
  'presalesCreated',
  'swapsCompleted',
  'onChainMessages',
])

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error(`${label} must contain exactly the reviewed fields.`)
  }
}

function requireSafeCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`)
  }
  return value
}

function requireIsoTimestamp(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be an ISO timestamp.`)
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp.`)
  }
  return value
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

export function requireCredentialFreeSecondRpcUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) {
    throw new Error('A bounded credential-free second RPC URL is required.')
  }
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('The second RPC URL is invalid.')
  }
  if (url.protocol !== 'https:') throw new Error('The second RPC URL must use HTTPS.')
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('The second RPC URL must not contain credentials, query parameters, or a fragment.')
  }
  if (url.origin === new URL(LITVM_RPC_URL).origin) {
    throw new Error('The verification endpoint must use a different RPC origin from the primary capture endpoint.')
  }
  return url.href
}

export function requirePlatformActivityCutoverCandidate(value) {
  assertExactKeys(value, [
    'blockHash',
    'blockTimestamp',
    'capturedAt',
    'chainId',
    'components',
    'configuration',
    'metricMethods',
    'operatorRequirements',
    'reviewStatus',
    'schemaVersion',
    'snapshotKind',
    'throughBlock',
    'totals',
    'warnings',
  ], 'The cutover candidate')

  if (
    value.schemaVersion !== 1 ||
    value.snapshotKind !== 'post-replacement-cutover' ||
    value.reviewStatus !== 'candidate-read-only-capture' ||
    value.chainId !== Number(EXPECTED_CHAIN_ID)
  ) throw new Error('The cutover candidate identity is invalid.')
  requireSafeCount(value.throughBlock, 'Cutover throughBlock')
  if (!HASH_PATTERN.test(value.blockHash)) throw new Error('The cutover block hash is invalid.')
  requireIsoTimestamp(value.blockTimestamp, 'Cutover blockTimestamp')
  requireIsoTimestamp(value.capturedAt, 'Cutover capturedAt')

  if (!isDeepStrictEqual(value.configuration, CUTOVER_CONFIGURATION)) {
    throw new Error('The cutover candidate does not pin the reviewed legacy configuration and continuity floors.')
  }
  if (!isDeepStrictEqual(value.metricMethods, CUTOVER_METRIC_METHODS)) {
    throw new Error('The cutover candidate metric methods do not match the reviewed counting rules.')
  }

  assertExactKeys(value.totals, METRIC_NAMES, 'The cutover totals')
  for (const name of METRIC_NAMES) {
    const count = requireSafeCount(value.totals[name], `Cutover ${name}`)
    if (count < PLATFORM_ACTIVITY_CONTINUITY_FLOORS[name]) {
      throw new Error(`Cutover ${name} is below the source-pinned continuity floor.`)
    }
  }

  assertExactKeys(value.components, [
    'iloFactoryCounts',
    'productionApiCounts',
    'productionApiCoverage',
    'productionApiObservedAt',
    'runtimeCodeHashes',
    'tokenFactoryNonce',
  ], 'The cutover components')
  requireSafeCount(value.components.tokenFactoryNonce, 'Cutover TokenFactory nonce')
  if (
    !Array.isArray(value.components.iloFactoryCounts) ||
    value.components.iloFactoryCounts.length !== 2
  ) throw new Error('The cutover candidate must contain exactly two ILO factory counts.')
  value.components.iloFactoryCounts.forEach((count, index) => {
    requireSafeCount(count, `Cutover ILO factory count ${index}`)
  })
  if (!isDeepStrictEqual(value.components.runtimeCodeHashes, LEGACY_RUNTIME_CODE_HASHES)) {
    throw new Error('The cutover candidate runtime hashes do not match the reviewed legacy configuration.')
  }

  assertExactKeys(value.components.productionApiCounts, METRIC_NAMES, 'The production API counts')
  for (const name of METRIC_NAMES) {
    requireSafeCount(value.components.productionApiCounts[name], `Production API ${name}`)
  }
  requirePlatformActivityApiCoverage(value.components.productionApiCoverage)
  if (value.components.productionApiObservedAt !== null) {
    requireIsoTimestamp(value.components.productionApiObservedAt, 'Production API observedAt')
  }

  const derivedTokenCount = Math.max(0, value.components.tokenFactoryNonce - 1)
  const derivedIloCount = value.components.iloFactoryCounts[0] + value.components.iloFactoryCounts[1]
  if (
    value.totals.tokensMinted !== derivedTokenCount ||
    value.totals.presalesCreated !== derivedIloCount ||
    value.totals.walletsAirdropped !== value.components.productionApiCounts.walletsAirdropped ||
    value.totals.swapsCompleted !== value.components.productionApiCounts.swapsCompleted
  ) throw new Error('The cutover totals are inconsistent with their authenticated counters or declared first-party baselines.')

  for (const [name, collection] of [
    ['warnings', value.warnings],
    ['operatorRequirements', value.operatorRequirements],
  ]) {
    if (
      !Array.isArray(collection) ||
      collection.length > 50 ||
      collection.some((entry) => typeof entry !== 'string' || entry.length === 0 || entry.length > 1_000)
    ) throw new Error(`The cutover candidate ${name} are malformed.`)
  }
  if (value.operatorRequirements.length === 0) {
    throw new Error('The cutover candidate must retain its operator requirements.')
  }

  return value
}

function requireExactBlock(block, blockTag, candidateHash) {
  if (
    !block ||
    requireHex(block.number, 'verification block number').toLowerCase() !== blockTag.toLowerCase() ||
    typeof block.hash !== 'string' ||
    !HASH_PATTERN.test(block.hash) ||
    block.hash.toLowerCase() !== candidateHash.toLowerCase()
  ) throw new Error('The second RPC did not return the candidate block identity.')
  return block
}

export async function verifyPlatformActivityCutoverCandidate(
  candidateValue,
  { rpc, hashRuntimeCode = keccak256 },
) {
  const candidate = requirePlatformActivityCutoverCandidate(candidateValue)
  if (typeof rpc !== 'function') throw new Error('A read-only RPC function is required.')

  const chainId = BigInt(requireHex(await rpc('eth_chainId', []), 'verification chain ID'))
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Unexpected verification chain ID ${chainId}; expected ${EXPECTED_CHAIN_ID}.`)
  }

  const blockTag = `0x${BigInt(candidate.throughBlock).toString(16)}`
  const firstBlock = requireExactBlock(
    await rpc('eth_getBlockByNumber', [blockTag, false]),
    blockTag,
    candidate.blockHash,
  )
  const blockTimestamp = new Date(toSafeNumber(firstBlock.timestamp, 'verification block timestamp') * 1_000).toISOString()
  if (blockTimestamp !== candidate.blockTimestamp) {
    throw new Error('The second RPC block timestamp does not match the cutover candidate.')
  }

  const legacyState = await readLegacyCutoverState(rpc, blockTag, hashRuntimeCode)
  if (
    toSafeNumber(legacyState.factoryNonce, 'verified TokenFactory nonce') !== candidate.components.tokenFactoryNonce ||
    legacyState.firstIloCount !== candidate.components.iloFactoryCounts[0] ||
    legacyState.secondIloCount !== candidate.components.iloFactoryCounts[1] ||
    legacyState.tokensMinted !== candidate.totals.tokensMinted ||
    legacyState.presalesCreated !== candidate.totals.presalesCreated ||
    legacyState.messageCount !== candidate.totals.onChainMessages ||
    !isDeepStrictEqual(legacyState.runtimeCodeHashes, candidate.components.runtimeCodeHashes)
  ) throw new Error('The second RPC exact-block counters or runtime configuration differ from the cutover candidate.')

  requireExactBlock(
    await rpc('eth_getBlockByNumber', [blockTag, false]),
    blockTag,
    candidate.blockHash,
  )

  const candidatePayloadSha256 = `0x${createHash('sha256')
    .update(`${JSON.stringify(canonicalize(candidate), null, 2)}\n`)
    .digest('hex')}`
  return Object.freeze({
    status: 'VERIFIED_SECOND_RPC',
    chainId: Number(EXPECTED_CHAIN_ID),
    throughBlock: candidate.throughBlock,
    blockHash: candidate.blockHash.toLowerCase(),
    candidatePayloadSha256,
    verifiedCounters: Object.freeze({ ...candidate.totals }),
    verifiedRuntimeCodeHashes: LEGACY_RUNTIME_CODE_HASHES,
  })
}

export function readCutoverCandidateFile(candidatePath) {
  const resolvedPath = resolve(candidatePath)
  const stat = lstatSync(resolvedPath)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > MAX_CANDIDATE_BYTES) {
    throw new Error('The cutover candidate must be a bounded regular JSON file, not a symlink.')
  }
  const source = readFileSync(resolvedPath, 'utf8')
  return requirePlatformActivityCutoverCandidate(JSON.parse(source))
}

async function main() {
  const [, , candidatePath, secondRpcInput, ...unexpected] = process.argv
  if (!candidatePath || !secondRpcInput || unexpected.length > 0) {
    throw new Error('Usage: node scripts/security/verify-platform-activity-cutover.mjs <candidate.json> <credential-free-second-rpc-url>')
  }
  const rpcUrl = requireCredentialFreeSecondRpcUrl(secondRpcInput)
  const proof = await verifyPlatformActivityCutoverCandidate(
    readCutoverCandidateFile(candidatePath),
    { rpc: createJsonRpcReader(rpcUrl) },
  )
  process.stdout.write(`${JSON.stringify({ ...proof, rpcUrl }, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  } catch (error) {
    process.stderr.write(`Cutover verification failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
