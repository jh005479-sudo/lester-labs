import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getContractAddress } from 'viem'

import {
  VERIFIED_CHECKS,
  canonicalLiveVerificationSha256,
} from './verify-public-testnet-replacement-live.mjs'
import { readCutoverCandidateFile } from './verify-platform-activity-cutover.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const defaultPackagePath = resolve(repositoryRoot, 'src/config/approvedPublicReplacement.json')
const evidenceRoot = resolve(repositoryRoot, 'docs/security/evidence')
const defaultPaths = Object.freeze({
  manifest: resolve(evidenceRoot, 'disposable-testnet-4441-2026-08-06/deployment-manifest.json'),
  buildAttestation: resolve(evidenceRoot, 'disposable-testnet-4441-2026-08-06/build-attestation.json'),
  initialIndependentVerification: resolve(evidenceRoot, 'disposable-testnet-4441-2026-08-06/independent-verifier-output.txt'),
  initialRuntimeSnapshot: resolve(evidenceRoot, 'disposable-testnet-4441-2026-08-06/final-runtime-hash-snapshot.json'),
  cutoverCandidate: resolve(evidenceRoot, 'public-testnet-4441-cutover-2026-08-11/cutover-candidate.json'),
  cutoverSecondRpcProof: resolve(evidenceRoot, 'public-testnet-4441-cutover-2026-08-11/cutover-second-rpc-proof.json'),
  liveVerification: resolve(evidenceRoot, 'public-testnet-4441-cutover-2026-08-11/replacement-live-verification.json'),
})

export const PUBLIC_TESTNET_RELEASE_PROFILE = 'public-testnet-immutable'
export const PUBLIC_TESTNET_DEPLOYMENT_PROFILE = 'testnet-immutable-disposable'
export const FROZEN_TESTNET_CONTROLLER = '0x0000000000000000000000000000000000000001'
export const DISCLOSED_TEST_GAS_TREASURY = '0x439945924515218061b644901a31aC4A6c00957c'
const HASH_PATTERN = /^0x[0-9a-f]{64}$/u
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/u
const SOURCE_COMMIT_PATTERN = /^[0-9a-f]{40}$/u
const METRIC_NAMES = Object.freeze([
  'tokensMinted', 'walletsAirdropped', 'presalesCreated', 'swapsCompleted', 'onChainMessages',
])
const DEPLOYMENTS = Object.freeze([
  ['WrappedZkLTC', 'WETH9'],
  ['UniswapV2Factory', 'UniswapV2Factory'],
  ['UniswapV2Router02', 'UniswapV2Router02'],
  ['UniSwapConnector', 'UniSwapConnector'],
  ['TokenFactory', 'TokenFactory'],
  ['VestingFactory', 'VestingFactory'],
  ['LiquidityLocker', 'LiquidityLocker'],
  ['TheLedger', 'TheLedger'],
  ['Disperse', 'Disperse'],
  ['ILOFactory', 'ILOFactory'],
  ['LitGovToken', 'LitGovToken'],
  ['LitTimelock', 'LitTimelock'],
  ['LitGovernor', 'LitGovernor'],
])
const MANIFEST_KEYS = Object.freeze([
  'buildAttestationSha256', 'buildSourceCommit', 'chainId', 'confirmations', 'controller',
  'deploymentProfile', 'deployments', 'gasOnlyDeployer', 'kind', 'legacyRecovery',
  'parameters', 'planHash', 'schemaVersion', 'startingNonce', 'treasury', 'verifiedAtBlock',
])
const TESTNET_SAFEGUARDS = Object.freeze([
  'litvm-chain-id-4441-only',
  'immutable-ecrecover-precompile-controller',
  'disclosed-wallet-has-no-administrative-role',
  'exact-runtime-and-target-preflight-before-every-write',
  'replacement-governance-writes-disabled',
  'legacy-contracts-recovery-only',
  'post-cutover-analytics-deltas-only',
])
const EXPECTED_CHILD_RUNTIMES = Object.freeze({
  uniswapV2Pair: '0x25357cf6c3aa89ed3e871f444993f171f0c34eca08aae4c8a7b83b346d1ca8be',
  vestingWallet: Object.freeze({
    normalizedRuntimeCodeHash: '0x5f40860c5067c8b7e597c3e7c2ceaefee2094d2180aa94e07d03c7cecd5d9b23',
    runtimeCodeBytes: 2140,
    immutableReferences: Object.freeze([
      Object.freeze({ start: 469, length: 32 }),
      Object.freeze({ start: 1362, length: 32 }),
      Object.freeze({ start: 1796, length: 32 }),
      Object.freeze({ start: 1831, length: 32 }),
      Object.freeze({ start: 1883, length: 32 }),
      Object.freeze({ start: 1980, length: 32 }),
    ]),
  }),
  iloChild: '0x21fd209220234ea41672808ce894f1d737c70f0e2e4b8e0faa3cac5e82d470b6',
})

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error(`${label} must contain exactly the public-testnet reviewed fields.`)
  }
}

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

function canonicalSha256(value) {
  return `0x${createHash('sha256')
    .update(`${JSON.stringify(canonicalizeJson(value), null, 2)}\n`)
    .digest('hex')}`
}

function rawSha256(filePath) {
  return `0x${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`
}

export function canonicalPublicTestnetManifestSha256(manifest) {
  return `0x${createHash('sha256').update(`${JSON.stringify(manifest, null, 2)}\n`).digest('hex')}`
}

export function publicTestnetApprovalPayloadFromPackage(value) {
  return {
    releaseProfile: value.releaseProfile,
    deploymentManifestSha256: value.deploymentManifestSha256,
    deploymentManifest: value.deploymentManifest,
    frontendRuntimeAttestations: value.frontendRuntimeAttestations,
    sourceEvidence: value.sourceEvidence,
    activityCutover: value.activityCutover,
    testnetAcceptance: value.testnetAcceptance,
  }
}

export function canonicalPublicTestnetApprovalPayloadSha256(value) {
  return canonicalSha256(publicTestnetApprovalPayloadFromPackage(value))
}

function assertHash(value, label) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value) || value === `0x${'00'.repeat(32)}`) {
    throw new Error(`${label} must be a non-zero lower-case SHA-256/bytes32 digest.`)
  }
}

function assertCounters(value, label, expected) {
  assertExactKeys(value, METRIC_NAMES, label)
  for (const name of METRIC_NAMES) {
    if (!Number.isSafeInteger(value[name]) || value[name] < 0 || (expected && value[name] !== expected[name])) {
      throw new Error(`${label} ${name} is invalid or contradicts the bound evidence.`)
    }
  }
}

function assertManifest(manifest) {
  assertExactKeys(manifest, MANIFEST_KEYS, 'The public-testnet deployment manifest')
  if (
    manifest.kind !== 'lester-labs-post-compromise-replacement' || manifest.schemaVersion !== 2 ||
    manifest.chainId !== '4441' || manifest.deploymentProfile !== PUBLIC_TESTNET_DEPLOYMENT_PROFILE ||
    manifest.controller.toLowerCase() !== FROZEN_TESTNET_CONTROLLER ||
    manifest.treasury.toLowerCase() !== DISCLOSED_TEST_GAS_TREASURY.toLowerCase() ||
    manifest.gasOnlyDeployer.toLowerCase() !== DISCLOSED_TEST_GAS_TREASURY.toLowerCase() ||
    manifest.startingNonce !== 0 || !SOURCE_COMMIT_PATTERN.test(manifest.buildSourceCommit) ||
    !Number.isSafeInteger(manifest.confirmations) || manifest.confirmations < 1 || manifest.confirmations > 64 ||
    !Number.isSafeInteger(manifest.verifiedAtBlock) || manifest.verifiedAtBlock <= 0
  ) throw new Error('The approved package does not identify the exact immutable LitVM public-testnet authority model.')
  assertHash(manifest.planHash, 'The public-testnet plan hash')
  assertHash(manifest.buildAttestationSha256, 'The public-testnet build attestation digest')
  if (!Array.isArray(manifest.deployments) || manifest.deployments.length !== DEPLOYMENTS.length) {
    throw new Error('The public-testnet manifest must contain exactly thirteen deployments.')
  }
  const addresses = new Set()
  const transactions = new Set()
  let latestDeploymentBlock = 0
  for (let index = 0; index < DEPLOYMENTS.length; index += 1) {
    const record = manifest.deployments[index]
    assertExactKeys(
      record,
      ['name', 'artifact', 'address', 'nonce', 'transactionHash', 'blockNumber', 'runtimeCodeHash', 'runtimeCodeBytes'],
      `The public-testnet deployment record ${index}`,
    )
    const [expectedName, expectedArtifact] = DEPLOYMENTS[index]
    const expectedAddress = getContractAddress({ from: manifest.gasOnlyDeployer, nonce: BigInt(index) })
    if (
      record.name !== expectedName || record.artifact !== expectedArtifact || record.nonce !== index ||
      !ADDRESS_PATTERN.test(record.address) || record.address.toLowerCase() !== expectedAddress.toLowerCase() ||
      !HASH_PATTERN.test(record.transactionHash) || !HASH_PATTERN.test(record.runtimeCodeHash) ||
      !Number.isSafeInteger(record.blockNumber) || record.blockNumber <= 0 ||
      !Number.isSafeInteger(record.runtimeCodeBytes) || record.runtimeCodeBytes <= 0
    ) throw new Error(`${expectedName} public-testnet deployment evidence is invalid.`)
    if (addresses.has(record.address.toLowerCase()) || transactions.has(record.transactionHash)) {
      throw new Error('Public-testnet deployment addresses and transactions must be unique.')
    }
    addresses.add(record.address.toLowerCase())
    transactions.add(record.transactionHash)
    latestDeploymentBlock = Math.max(latestDeploymentBlock, record.blockNumber)
  }
  if (manifest.verifiedAtBlock < latestDeploymentBlock + manifest.confirmations - 1) {
    throw new Error('The public-testnet manifest does not prove deployment finality.')
  }
}

function assertFrontendRuntimeAttestations(value, buildAttestation) {
  assertExactKeys(value, ['uniswapV2Pair', 'vestingWallet', 'iloChild'], 'The public-testnet child runtime attestations')
  assertExactKeys(
    value.vestingWallet,
    ['normalizedRuntimeCodeHash', 'runtimeCodeBytes', 'immutableReferences'],
    'The public-testnet VestingWallet attestation',
  )
  if (JSON.stringify(value) !== JSON.stringify(EXPECTED_CHILD_RUNTIMES)) {
    throw new Error('The public-testnet child runtime attestations differ from the exact attested build output.')
  }
  const expectedArtifactDigests = {
    UniswapV2Pair: '0xd1244c3154e8f7c08bf2549d294d1a25fc5a71a11c024debb383dc598f1146e8',
    ILO: '0x93bf3bf7583d737503ceff701f4030522352d9b3f602c60195b7b8995e388aec',
    VestingWallet: '0x3068f331a79e8538853a1dfe821b488071a9154a2c63afb09e509d2968b7d073',
  }
  for (const [name, digest] of Object.entries(expectedArtifactDigests)) {
    const artifact = buildAttestation.artifacts?.find((entry) => entry.name === name)
    if (!artifact || artifact.artifactSha256 !== digest) {
      throw new Error(`The attested ${name} artifact digest differs from the reproduced child runtime evidence.`)
    }
  }
}

function assertTestnetAcceptance(value) {
  assertExactKeys(
    value,
    ['acceptedAt', 'acceptedBy', 'authorityModel', 'fundsModel', 'reviewModel', 'safeguards', 'scope'],
    'The public-testnet risk acceptance',
  )
  if (
    value.acceptedBy !== 'repository-owner' ||
    value.scope !== 'litvm-chain-4441-valueless-public-testnet-only' ||
    value.authorityModel !== 'immutable-ecrecover-precompile-no-admin-key' ||
    value.fundsModel !== 'disclosed-eoa-valueless-test-gas-and-test-fees-only' ||
    value.reviewModel !== 'sole-owner-testnet-exception-no-independent-reviewers' ||
    typeof value.acceptedAt !== 'string' || new Date(value.acceptedAt).toISOString() !== value.acceptedAt ||
    JSON.stringify(value.safeguards) !== JSON.stringify(TESTNET_SAFEGUARDS)
  ) throw new Error('The package does not contain the exact bounded public-testnet risk acceptance.')
}

function assertSourceEvidence(value, paths, manifest, cutover) {
  assertExactKeys(value, [
    'buildAttestationRawSha256', 'deploymentManifestRawSha256',
    'initialIndependentVerifierRawSha256', 'initialRuntimeSnapshotRawSha256',
    'liveVerificationRawSha256', 'liveVerificationReportSha256',
  ], 'The public-testnet source evidence')
  const expectedRaw = {
    buildAttestationRawSha256: rawSha256(paths.buildAttestation),
    deploymentManifestRawSha256: rawSha256(paths.manifest),
    initialIndependentVerifierRawSha256: rawSha256(paths.initialIndependentVerification),
    initialRuntimeSnapshotRawSha256: rawSha256(paths.initialRuntimeSnapshot),
    liveVerificationRawSha256: rawSha256(paths.liveVerification),
  }
  for (const [name, digest] of Object.entries(expectedRaw)) {
    if (value[name] !== digest) throw new Error(`${name} differs from the source-pinned public-testnet evidence.`)
  }
  const sourceManifest = JSON.parse(readFileSync(paths.manifest, 'utf8'))
  if (JSON.stringify(sourceManifest) !== JSON.stringify(manifest)) {
    throw new Error('The approved package manifest differs from the raw deployed-manifest evidence.')
  }
  const buildAttestation = JSON.parse(readFileSync(paths.buildAttestation, 'utf8'))
  if (
    buildAttestation.schemaVersion !== 3 || buildAttestation.status !== 'ATTESTED' ||
    buildAttestation.deploymentProfile !== PUBLIC_TESTNET_DEPLOYMENT_PROFILE ||
    buildAttestation.sourceCommit !== manifest.buildSourceCommit ||
    value.buildAttestationRawSha256 !== manifest.buildAttestationSha256
  ) throw new Error('The public-testnet build attestation does not bind the manifest profile and source commit.')
  const initialSnapshot = JSON.parse(readFileSync(paths.initialRuntimeSnapshot, 'utf8'))
  if (
    initialSnapshot.chainId !== '4441' || initialSnapshot.liveContracts !== 13 ||
    !Array.isArray(initialSnapshot.runtimeHashMismatches) || initialSnapshot.runtimeHashMismatches.length !== 0
  ) throw new Error('The initial public-testnet runtime snapshot is incomplete or reports a mismatch.')

  const liveReport = JSON.parse(readFileSync(paths.liveVerification, 'utf8'))
  assertExactKeys(liveReport, [
    'reportSha256', 'kind', 'schemaVersion', 'status', 'primaryRpcOrigin', 'rpcUrl', 'chainId',
    'blockNumber', 'blockHash', 'deploymentManifestRawSha256', 'verifiedChecks', 'authorityModel',
    'runtimeCodeHashes', 'replacementCountersAtCutover',
  ], 'The two-RPC public-testnet live verification')
  if (
    liveReport.kind !== 'lester-labs-public-testnet-live-verification' || liveReport.schemaVersion !== 1 ||
    liveReport.status !== 'VERIFIED_TWO_RPC' || liveReport.primaryRpcOrigin !== 'https://liteforge.rpc.caldera.xyz' ||
    new URL(liveReport.rpcUrl).origin !== 'https://rpc.lite-node.com' || liveReport.chainId !== '4441' ||
    liveReport.blockNumber !== cutover.throughBlock || liveReport.blockHash !== cutover.blockHash.toLowerCase() ||
    liveReport.deploymentManifestRawSha256 !== value.deploymentManifestRawSha256 ||
    JSON.stringify(liveReport.verifiedChecks) !== JSON.stringify(VERIFIED_CHECKS) ||
    liveReport.authorityModel.controller !== FROZEN_TESTNET_CONTROLLER ||
    liveReport.authorityModel.treasury.toLowerCase() !== DISCLOSED_TEST_GAS_TREASURY.toLowerCase() ||
    liveReport.authorityModel.gasOnlyDeployer.toLowerCase() !== DISCLOSED_TEST_GAS_TREASURY.toLowerCase()
  ) throw new Error('The two-RPC live report is not bound to the exact public-testnet manifest and cutover.')
  if (canonicalLiveVerificationSha256(liveReport) !== liveReport.reportSha256 || value.liveVerificationReportSha256 !== liveReport.reportSha256) {
    throw new Error('The canonical live-verification report digest is invalid.')
  }
  assertCounters(liveReport.replacementCountersAtCutover, 'The live replacement counters', cutover.replacementCountersAtCutover)
  for (const deployment of manifest.deployments) {
    if (liveReport.runtimeCodeHashes[deployment.name] !== deployment.runtimeCodeHash.toLowerCase()) {
      throw new Error(`${deployment.name} live runtime evidence differs from the deployment manifest.`)
    }
  }
  return buildAttestation
}

function assertActivityCutover(value, paths) {
  assertExactKeys(
    value,
    ['throughBlock', 'blockHash', 'totals', 'independentSecondRpc', 'replacementCountersAtCutover'],
    'The public-testnet activity cutover',
  )
  assertExactKeys(
    value.independentSecondRpc,
    ['candidateRawSha256', 'candidatePayloadSha256', 'proofRawSha256', 'rpcUrl'],
    'The public-testnet second-RPC cutover evidence',
  )
  assertCounters(value.totals, 'The public-testnet historical totals')
  assertCounters(value.replacementCountersAtCutover, 'The public-testnet replacement counters', Object.fromEntries(METRIC_NAMES.map((name) => [name, 0])))
  const candidate = readCutoverCandidateFile(paths.cutoverCandidate)
  const proof = JSON.parse(readFileSync(paths.cutoverSecondRpcProof, 'utf8'))
  if (
    value.throughBlock !== candidate.throughBlock || value.blockHash.toLowerCase() !== candidate.blockHash.toLowerCase() ||
    JSON.stringify(value.totals) !== JSON.stringify(candidate.totals) ||
    value.independentSecondRpc.candidateRawSha256 !== rawSha256(paths.cutoverCandidate) ||
    value.independentSecondRpc.proofRawSha256 !== rawSha256(paths.cutoverSecondRpcProof) ||
    value.independentSecondRpc.candidatePayloadSha256 !== proof.candidatePayloadSha256 ||
    value.independentSecondRpc.rpcUrl !== proof.rpcUrl || proof.status !== 'VERIFIED_SECOND_RPC' ||
    proof.chainId !== 4441 || proof.throughBlock !== candidate.throughBlock ||
    proof.blockHash.toLowerCase() !== candidate.blockHash.toLowerCase() ||
    JSON.stringify(proof.verifiedCounters) !== JSON.stringify(candidate.totals)
  ) throw new Error('The public-testnet activity cutover is not bound to the exact candidate and second-RPC proof.')
}

export function assertExactApprovedPublicTestnetReplacementPackageShape(value) {
  assertExactKeys(value, [
    'status', 'releaseProfile', 'approvalPayloadSha256', 'deploymentManifestSha256',
    'deploymentManifest', 'frontendRuntimeAttestations', 'sourceEvidence', 'activityCutover',
    'testnetAcceptance',
  ], 'The APPROVED public-testnet replacement package')
  if (value.status !== 'APPROVED' || value.releaseProfile !== PUBLIC_TESTNET_RELEASE_PROFILE) {
    throw new Error('The replacement package is not an APPROVED public-testnet immutable package.')
  }
  assertManifest(value.deploymentManifest)
  assertExactKeys(value.frontendRuntimeAttestations, ['uniswapV2Pair', 'vestingWallet', 'iloChild'], 'The public-testnet frontend runtimes')
  assertExactKeys(value.frontendRuntimeAttestations.vestingWallet, ['normalizedRuntimeCodeHash', 'runtimeCodeBytes', 'immutableReferences'], 'The public-testnet VestingWallet runtime')
  if (!Array.isArray(value.frontendRuntimeAttestations.vestingWallet.immutableReferences)) {
    throw new Error('The public-testnet VestingWallet immutable references must be an array.')
  }
  for (const reference of value.frontendRuntimeAttestations.vestingWallet.immutableReferences) {
    assertExactKeys(reference, ['start', 'length'], 'A public-testnet VestingWallet immutable reference')
  }
  assertExactKeys(value.sourceEvidence, [
    'buildAttestationRawSha256', 'deploymentManifestRawSha256',
    'initialIndependentVerifierRawSha256', 'initialRuntimeSnapshotRawSha256',
    'liveVerificationRawSha256', 'liveVerificationReportSha256',
  ], 'The public-testnet source evidence')
  assertActivityCutover(value.activityCutover, defaultPaths)
  assertTestnetAcceptance(value.testnetAcceptance)
}

export function verifyApprovedPublicTestnetReplacementPackage(filePath = defaultPackagePath, paths = {}) {
  const evidencePaths = { ...defaultPaths, ...paths }
  const value = JSON.parse(readFileSync(filePath, 'utf8'))
  assertExactApprovedPublicTestnetReplacementPackageShape(value)
  const actualManifestSha256 = canonicalPublicTestnetManifestSha256(value.deploymentManifest)
  if (value.deploymentManifestSha256 !== actualManifestSha256) {
    throw new Error(`Public-testnet manifest digest is ${actualManifestSha256}; expected ${value.deploymentManifestSha256}.`)
  }
  const buildAttestation = assertSourceEvidence(value.sourceEvidence, evidencePaths, value.deploymentManifest, value.activityCutover)
  assertFrontendRuntimeAttestations(value.frontendRuntimeAttestations, buildAttestation)
  const actualPayloadSha256 = canonicalPublicTestnetApprovalPayloadSha256(value)
  if (value.approvalPayloadSha256 !== actualPayloadSha256) {
    throw new Error(`Public-testnet approval payload digest is ${actualPayloadSha256}; expected ${value.approvalPayloadSha256}.`)
  }
  return {
    status: 'APPROVED',
    releaseProfile: PUBLIC_TESTNET_RELEASE_PROFILE,
    approvalPayloadSha256: actualPayloadSha256,
    deploymentManifestSha256: actualManifestSha256,
    buildSourceCommit: value.deploymentManifest.buildSourceCommit,
  }
}
