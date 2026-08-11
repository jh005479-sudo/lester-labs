#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  decodeFunctionResult,
  encodeFunctionData,
  getContractAddress,
  keccak256,
} from 'viem'

const PRIMARY_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http'
const EXPECTED_CHAIN_ID = 4_441n
const EXPECTED_PROFILE = 'testnet-immutable-disposable'
const FROZEN_CONTROLLER = '0x0000000000000000000000000000000000000001'
const TEST_GAS_TREASURY = '0x439945924515218061b644901a31aC4A6c00957c'
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/u
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/u
const MAX_RESPONSE_BYTES = 2_000_000

export const VERIFIED_CHECKS = Object.freeze([
  'two-rpc-chain-and-cutover-block-identity',
  'deployment-create-address-sequence',
  'deployment-transactions-and-receipts',
  'replacement-runtime-code-and-byte-lengths',
  'immutable-controller-and-test-treasury-role-bindings',
  'zero-replacement-counters-at-cutover',
])

const READ_ABI = Object.freeze({
  address: (name) => [{ type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
  boolean: (name) => [{ type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] }],
  uint256: (name) => [{ type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
})

function canonicalizeJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeJson(child)]),
    )
  }
  return value
}

export function canonicalLiveVerificationSha256(report) {
  const payload = Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'reportSha256'))
  return `0x${createHash('sha256')
    .update(`${JSON.stringify(canonicalizeJson(payload), null, 2)}\n`)
    .digest('hex')}`
}

function rawSha256(bytes) {
  return `0x${createHash('sha256').update(bytes).digest('hex')}`
}

async function readBoundedJson(response, label) {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`)
  if (!response.body) throw new Error(`${label} returned no body.`)
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    throw new Error(`${label} declared an oversized response.`)
  }
  const reader = response.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel('response byte limit exceeded')
      throw new Error(`${label} exceeded the response limit.`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

function createRpcReader(rpcUrl) {
  let id = 0
  return async (method, params) => {
    const allowed = new Set([
      'eth_blockNumber',
      'eth_call',
      'eth_chainId',
      'eth_getBlockByNumber',
      'eth_getCode',
      'eth_getTransactionByHash',
      'eth_getTransactionCount',
      'eth_getTransactionReceipt',
    ])
    if (!allowed.has(method)) throw new Error(`RPC method is not allowlisted: ${method}`)
    const requestId = ++id
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    const body = await readBoundedJson(response, `${new URL(rpcUrl).origin} ${method}`)
    if (!body || body.jsonrpc !== '2.0' || body.id !== requestId || body.error || body.result === undefined) {
      throw new Error(`${new URL(rpcUrl).origin} ${method} returned an invalid response.`)
    }
    return body.result
  }
}

function requireSecondRpcUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('The second RPC URL is invalid.')
  }
  if (
    url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    url.origin === new URL(PRIMARY_RPC_URL).origin
  ) throw new Error('The second RPC must be a distinct credential-free HTTPS origin.')
  return url.href
}

function requireHexQuantity(value, label) {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/u.test(value)) {
    throw new Error(`${label} is not a canonical hexadecimal quantity.`)
  }
  return BigInt(value)
}

function requireAddress(value, expected, label) {
  if (
    typeof value !== 'string' || !ADDRESS_PATTERN.test(value) ||
    value.toLowerCase() !== expected.toLowerCase()
  ) throw new Error(`${label} is ${String(value)}; expected ${expected}.`)
}

async function readFunction(rpc, address, abi, blockTag) {
  const data = encodeFunctionData({ abi, functionName: abi[0].name })
  const result = await rpc('eth_call', [{ to: address, data }, blockTag])
  return decodeFunctionResult({ abi, functionName: abi[0].name, data: result })
}

async function verifyRpcIdentity(primaryRpc, secondRpc, blockTag) {
  const [primaryChain, secondChain, primaryBlock, secondBlock] = await Promise.all([
    primaryRpc('eth_chainId', []),
    secondRpc('eth_chainId', []),
    primaryRpc('eth_getBlockByNumber', [blockTag, false]),
    secondRpc('eth_getBlockByNumber', [blockTag, false]),
  ])
  if (
    requireHexQuantity(primaryChain, 'primary chain ID') !== EXPECTED_CHAIN_ID ||
    requireHexQuantity(secondChain, 'second chain ID') !== EXPECTED_CHAIN_ID
  ) throw new Error('Both RPC endpoints must identify LitVM chain 4441.')
  if (
    !primaryBlock || !secondBlock ||
    primaryBlock.number?.toLowerCase() !== blockTag.toLowerCase() ||
    secondBlock.number?.toLowerCase() !== blockTag.toLowerCase() ||
    !HASH_PATTERN.test(primaryBlock.hash) ||
    primaryBlock.hash.toLowerCase() !== secondBlock.hash?.toLowerCase()
  ) throw new Error('The two RPC endpoints disagree on the cutover block identity.')
  return primaryBlock
}

function recordMap(manifest) {
  if (!Array.isArray(manifest.deployments) || manifest.deployments.length !== 13) {
    throw new Error('The manifest must contain exactly thirteen deployments.')
  }
  return new Map(manifest.deployments.map((record) => [record.name, record]))
}

async function verifyDeploymentRecords(manifest, primaryRpc, secondRpc, blockTag) {
  const runtimeCodeHashes = {}
  for (let index = 0; index < manifest.deployments.length; index += 1) {
    const record = manifest.deployments[index]
    const expectedAddress = getContractAddress({ from: manifest.gasOnlyDeployer, nonce: BigInt(index) })
    requireAddress(record.address, expectedAddress, `${record.name} CREATE address`)
    if (record.nonce !== index || !HASH_PATTERN.test(record.transactionHash) || !HASH_PATTERN.test(record.runtimeCodeHash)) {
      throw new Error(`${record.name} manifest transaction/runtime evidence is malformed.`)
    }
    const [primaryCode, secondCode, transaction, receipt, preDeploymentCode, priorNonce] = await Promise.all([
      primaryRpc('eth_getCode', [record.address, blockTag]),
      secondRpc('eth_getCode', [record.address, blockTag]),
      primaryRpc('eth_getTransactionByHash', [record.transactionHash]),
      primaryRpc('eth_getTransactionReceipt', [record.transactionHash]),
      primaryRpc('eth_getCode', [record.address, `0x${BigInt(record.blockNumber - 1).toString(16)}`]),
      primaryRpc('eth_getTransactionCount', [manifest.gasOnlyDeployer, `0x${BigInt(record.blockNumber - 1).toString(16)}`]),
    ])
    if (
      typeof primaryCode !== 'string' || primaryCode === '0x' || primaryCode.toLowerCase() !== secondCode?.toLowerCase() ||
      keccak256(primaryCode).toLowerCase() !== record.runtimeCodeHash.toLowerCase() ||
      (primaryCode.length - 2) / 2 !== record.runtimeCodeBytes
    ) throw new Error(`${record.name} runtime differs from its manifest or between RPC endpoints.`)
    if (
      !transaction || transaction.hash?.toLowerCase() !== record.transactionHash.toLowerCase() ||
      transaction.from?.toLowerCase() !== manifest.gasOnlyDeployer.toLowerCase() || transaction.to !== null ||
      requireHexQuantity(transaction.nonce, `${record.name} transaction nonce`) !== BigInt(index) ||
      requireHexQuantity(transaction.blockNumber, `${record.name} transaction block`) !== BigInt(record.blockNumber) ||
      !receipt || receipt.status !== '0x1' ||
      receipt.transactionHash?.toLowerCase() !== record.transactionHash.toLowerCase() ||
      receipt.contractAddress?.toLowerCase() !== record.address.toLowerCase() ||
      requireHexQuantity(receipt.blockNumber, `${record.name} receipt block`) !== BigInt(record.blockNumber) ||
      transaction.blockHash?.toLowerCase() !== receipt.blockHash?.toLowerCase() ||
      preDeploymentCode !== '0x' || requireHexQuantity(priorNonce, `${record.name} prior deployer nonce`) !== BigInt(index)
    ) throw new Error(`${record.name} deployment transaction, receipt, or pre-deployment state is invalid.`)
    runtimeCodeHashes[record.name] = record.runtimeCodeHash.toLowerCase()
  }
  return runtimeCodeHashes
}

async function verifyRolesAndCounters(manifest, primaryRpc, secondRpc, blockTag) {
  const records = recordMap(manifest)
  const addressOf = (name) => records.get(name).address
  const calls = [
    ['DEX fee controller', addressOf('UniswapV2Factory'), READ_ABI.address('feeToSetter'), manifest.controller],
    ['DEX fee treasury', addressOf('UniswapV2Factory'), READ_ABI.address('feeTo'), manifest.treasury],
    ['DEX deployment signer', addressOf('UniswapV2Factory'), READ_ABI.address('deploymentSigner'), manifest.gasOnlyDeployer],
    ['Router factory', addressOf('UniswapV2Router02'), READ_ABI.address('factory'), addressOf('UniswapV2Factory')],
    ['Router wrapped native', addressOf('UniswapV2Router02'), READ_ABI.address('WETH'), addressOf('WrappedZkLTC')],
    ['Connector router', addressOf('UniSwapConnector'), READ_ABI.address('router'), addressOf('UniswapV2Router02')],
    ['Connector factory', addressOf('UniSwapConnector'), READ_ABI.address('factory'), addressOf('UniswapV2Factory')],
    ['Connector treasury', addressOf('UniSwapConnector'), READ_ABI.address('treasury'), manifest.treasury],
    ['Connector controller', addressOf('UniSwapConnector'), READ_ABI.address('controller'), manifest.controller],
    ['Connector wrapped native', addressOf('UniSwapConnector'), READ_ABI.address('wrappedNative'), addressOf('WrappedZkLTC')],
    ['Connector deployment signer', addressOf('UniSwapConnector'), READ_ABI.address('deploymentSigner'), manifest.gasOnlyDeployer],
    ['ILO router', addressOf('ILOFactory'), READ_ABI.address('router'), addressOf('UniswapV2Router02')],
    ['ILO connector', addressOf('ILOFactory'), READ_ABI.address('connector'), addressOf('UniSwapConnector')],
    ['ILO DEX factory', addressOf('ILOFactory'), READ_ABI.address('dexFactory'), addressOf('UniswapV2Factory')],
  ]
  for (const name of ['TokenFactory', 'VestingFactory', 'LiquidityLocker', 'TheLedger', 'ILOFactory']) {
    calls.push([`${name} owner`, addressOf(name), READ_ABI.address('owner'), manifest.controller])
    calls.push([`${name} treasury`, addressOf(name), READ_ABI.address('treasury'), manifest.treasury])
    calls.push([`${name} deployment signer`, addressOf(name), READ_ABI.address('deploymentSigner'), manifest.gasOnlyDeployer])
  }
  for (const [label, address, abi, expected] of calls) {
    const [primaryValue, secondValue] = await Promise.all([
      readFunction(primaryRpc, address, abi, blockTag),
      readFunction(secondRpc, address, abi, blockTag),
    ])
    requireAddress(primaryValue, expected, label)
    requireAddress(secondValue, expected, `${label} on second RPC`)
  }
  for (const [label, address] of [
    ['DEX disclosed-signer fee profile', addressOf('UniswapV2Factory')],
    ['Connector disclosed-signer fee profile', addressOf('UniSwapConnector')],
    ['TokenFactory disclosed-signer fee profile', addressOf('TokenFactory')],
    ['VestingFactory disclosed-signer fee profile', addressOf('VestingFactory')],
    ['LiquidityLocker disclosed-signer fee profile', addressOf('LiquidityLocker')],
    ['TheLedger disclosed-signer fee profile', addressOf('TheLedger')],
    ['ILOFactory disclosed-signer fee profile', addressOf('ILOFactory')],
  ]) {
    const abi = READ_ABI.boolean('deploymentSignerMayReceiveFees')
    const [primaryValue, secondValue] = await Promise.all([
      readFunction(primaryRpc, address, abi, blockTag),
      readFunction(secondRpc, address, abi, blockTag),
    ])
    if (primaryValue !== true || secondValue !== true) throw new Error(`${label} must be true on both RPC endpoints.`)
  }

  const [tokenFactoryNonce, recipientEntries, swapCount, messageCount, iloCount] = await Promise.all([
    primaryRpc('eth_getTransactionCount', [addressOf('TokenFactory'), blockTag]),
    readFunction(primaryRpc, addressOf('Disperse'), READ_ABI.uint256('totalRecipientEntries'), blockTag),
    readFunction(primaryRpc, addressOf('UniswapV2Router02'), READ_ABI.uint256('totalSwapCount'), blockTag),
    readFunction(primaryRpc, addressOf('TheLedger'), READ_ABI.uint256('messageCount'), blockTag),
    readFunction(primaryRpc, addressOf('ILOFactory'), READ_ABI.uint256('getILOCount'), blockTag),
  ])
  const counters = {
    tokensMinted: Number(requireHexQuantity(tokenFactoryNonce, 'replacement TokenFactory nonce') - 1n),
    walletsAirdropped: Number(recipientEntries),
    presalesCreated: Number(iloCount),
    swapsCompleted: Number(swapCount),
    onChainMessages: Number(messageCount),
  }
  if (Object.values(counters).some((value) => value !== 0)) {
    throw new Error('Every replacement activity counter must be zero at the selected cutover block.')
  }
  return counters
}

export async function verifyPublicTestnetReplacementLive({ manifestPath, secondRpcUrl, throughBlock }) {
  const manifestBytes = readFileSync(resolve(manifestPath))
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  if (
    manifest.kind !== 'lester-labs-post-compromise-replacement' || manifest.schemaVersion !== 2 ||
    manifest.chainId !== '4441' || manifest.deploymentProfile !== EXPECTED_PROFILE ||
    manifest.controller.toLowerCase() !== FROZEN_CONTROLLER ||
    manifest.treasury.toLowerCase() !== TEST_GAS_TREASURY.toLowerCase() ||
    manifest.gasOnlyDeployer.toLowerCase() !== TEST_GAS_TREASURY.toLowerCase() || manifest.startingNonce !== 0
  ) throw new Error('The manifest is not the reviewed immutable LitVM public-testnet stack.')
  const rpcUrl = requireSecondRpcUrl(secondRpcUrl)
  const primaryRpc = createRpcReader(PRIMARY_RPC_URL)
  const secondRpc = createRpcReader(rpcUrl)
  const latest = requireHexQuantity(await primaryRpc('eth_blockNumber', []), 'latest primary block')
  const selectedBlock = throughBlock === undefined ? latest : BigInt(throughBlock)
  if (selectedBlock <= 0n || selectedBlock > latest) throw new Error('The requested verification block is invalid.')
  const blockTag = `0x${selectedBlock.toString(16)}`
  const block = await verifyRpcIdentity(primaryRpc, secondRpc, blockTag)
  const runtimeCodeHashes = await verifyDeploymentRecords(manifest, primaryRpc, secondRpc, blockTag)
  const replacementCountersAtCutover = await verifyRolesAndCounters(manifest, primaryRpc, secondRpc, blockTag)
  const payload = {
    kind: 'lester-labs-public-testnet-live-verification',
    schemaVersion: 1,
    status: 'VERIFIED_TWO_RPC',
    primaryRpcOrigin: new URL(PRIMARY_RPC_URL).origin,
    rpcUrl,
    chainId: '4441',
    blockNumber: Number(selectedBlock),
    blockHash: block.hash.toLowerCase(),
    deploymentManifestRawSha256: rawSha256(manifestBytes),
    verifiedChecks: VERIFIED_CHECKS,
    authorityModel: {
      controller: FROZEN_CONTROLLER,
      controllerKind: 'ecrecover-precompile-immutable-no-admin-key',
      treasury: TEST_GAS_TREASURY,
      gasOnlyDeployer: TEST_GAS_TREASURY,
      treasuryKind: 'disclosed-valueless-test-gas-eoa',
    },
    runtimeCodeHashes,
    replacementCountersAtCutover,
  }
  return { reportSha256: canonicalLiveVerificationSha256(payload), ...payload }
}

async function main() {
  const [, , manifestPath, secondRpcInput, throughBlockInput, ...unexpected] = process.argv
  if (!manifestPath || !secondRpcInput || unexpected.length > 0) {
    throw new Error('Usage: verify-public-testnet-replacement-live.mjs <deployment-manifest.json> <second-rpc-url> [through-block]')
  }
  const report = await verifyPublicTestnetReplacementLive({
    manifestPath,
    secondRpcUrl: secondRpcInput,
    throughBlock: throughBlockInput,
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Public-testnet verification failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
