import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getContractAddress } from 'viem'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const packagePath = resolve(repositoryRoot, 'src/config/approvedPublicReplacement.json')
const MANIFEST_KEYS = [
  'buildAttestationSha256', 'buildSourceCommit', 'chainId', 'confirmations', 'controller',
  'deploymentProfile', 'deployments', 'gasOnlyDeployer', 'kind', 'legacyRecovery',
  'parameters', 'planHash', 'schemaVersion', 'startingNonce', 'treasury', 'verifiedAtBlock',
]
const PARAMETER_KEYS = [
  'tokenCreationFee', 'vestingFee', 'lockFee', 'iloPlatformFeeBps', 'iloCreationFee',
  'ledgerMinFee', 'ledgerTreasuryCutBps', 'governanceInitialSupply', 'governanceTimelockDelay',
  'governanceVotingDelay', 'governanceVotingPeriod', 'governanceProposalThreshold', 'governanceQuorumBps',
]
const LEGACY_RECOVERY_NAMES = [
  'disperse', 'iloFactory', 'ledger', 'legacyConnector', 'liquidityLocker', 'litGovToken',
  'litGovernor', 'litTimelock', 'productionBuildIloFactory', 'tokenFactory', 'uniswapV2Factory',
  'uniswapV2Router', 'vestingFactory', 'wrappedZkLtc',
]
export const DEPLOYMENTS = [
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
]
export const REVIEWED_PARAMETERS = {
  tokenCreationFee: '50000000000000000',
  vestingFee: '30000000000000000',
  lockFee: '30000000000000000',
  iloPlatformFeeBps: '200',
  iloCreationFee: '30000000000000000',
  ledgerMinFee: '10000000000000000',
  ledgerTreasuryCutBps: '5000',
  governanceInitialSupply: '10000000000000000000000000',
  governanceTimelockDelay: '172800',
  governanceVotingDelay: '1',
  governanceVotingPeriod: '45600',
  governanceProposalThreshold: '100000000000000000000000',
  governanceQuorumBps: '400',
}
export const LEGACY_ADDRESSES = {
  iloFactory: '0xa533bbe87bdcd91e4367de517e99bf8ba75fd0ab',
  productionBuildIloFactory: '0xc9b1961def0cc5bc1ffe3cfe37a4988d7987a43f',
  tokenFactory: '0x93acc61fcdc2e3407a0c03450adfd8ae78964948',
  vestingFactory: '0x6ee07118d39e9330ef0658ffa797eedd2cb823cf',
  liquidityLocker: '0x80d88c7f529d256e5e6a2cb0e0c30d82bc8827a9',
  ledger: '0xa37ff4bab59a5f861b48527a946c433dc1ee8079',
  uniswapV2Factory: '0x017a126a44aaae9273f7963d4e295f0ee2793ad8',
  uniswapV2Router: '0xd56a623890b083d876d47c3b1c5343b7f983fa62',
  wrappedZkLtc: '0xd141a5dde1a3a373b7e9bb603362a58793ab9d97',
  disperse: '0x3cc66cb4713dca78564df512922adb331ac5ee04',
  legacyConnector: '0x720a547a29f1c86e0ef0be5864faf14a69e894fd',
  litGovToken: '0xa5111cedc04554676dbcca39f2268070008c7a8a',
  litGovernor: '0x5b0092996ba897617b46d42b3f108b253be9ad3d',
  litTimelock: '0xd38ed693730db3eb22ba6d6f0050fc45ac9240ba',
}
export const LEGACY_RUNTIME_HASHES = {
  iloFactory: '0x9c52ccc3cf932eeff5f19c65d7055f9c8eaa50b68e64a1e1e6bafebaf0e81b9a',
  productionBuildIloFactory: '0xed56b878c6c936b7a54c0fc501a87cd96dc185e8d0967759df88817a03bc2dd5',
  tokenFactory: '0x5b3bb2e693021e2ab040b6bf248785eb627600bbec002e87c10e138521be1d9d',
  vestingFactory: '0x96f1c281dcb7a5a69cb007f511067ac08cf39811fc1d5b92864fb3f455ed2e73',
  liquidityLocker: '0xfa5c90c1aee9f3f2606cf1a04b3a4a742ac2950dbf09e0d2e67412d311786c8a',
  ledger: '0x5bfae473fddc1457d06edc1c5603f0217b0b3debdc34969abe1611b386fb4233',
  uniswapV2Factory: '0xce41e64702f625a6e52ba7d0406293e089078d3e6bdaf68d7fa8587f951453ee',
  uniswapV2Router: '0x0bd1cb8135296ff81274635a526cf4bacb32aee80ea0938899ea64294e2bba8a',
  wrappedZkLtc: '0x8c18c51fd322d08ccd34df2b97420cc87b004e738da9363d35a38cc2be761b05',
  disperse: '0x0a002cb14450c22d20885e40fec35bc924e0229f91b7b359c926850b10548891',
  legacyConnector: '0xddb0ce4525768177261872afa458a433d0fb2a312d23325c46fabc29d398ed4e',
  litGovToken: '0xf2f5e1ca1b5b7f82dc5a7dd2544e8b8d6d06deda8259e8f7ec908e99e460d94c',
  litGovernor: '0x07257ea685127e008299cc168253f764bc24456fe8ca11a5d162a66a57706d8b',
  litTimelock: '0xfb6edd3916b02720e51e48ca654186b058d296236f7d3a6de76aae46964dfdba',
}
const REJECTED_ROLE_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xdd221fbbcb0f6092afe51183d964aa89a968ee13',
  '0xcbf819017ae48f261fe143b2a7c8a29d9a2fcd28',
  '0x439945924515218061b644901a31ac4a6c00957c',
  '0x0000000000000000000000000000000000000001',
  ...Object.values(LEGACY_ADDRESSES),
])
const PINNED_LEGACY_RECOVERY = {
  addresses: LEGACY_ADDRESSES,
  runtimeCodeHashes: LEGACY_RUNTIME_HASHES,
  iloFactoryProvenance: [
    {
      label: 'production-build-hidden-factory',
      address: LEGACY_ADDRESSES.productionBuildIloFactory,
      runtimeCodeHash: LEGACY_RUNTIME_HASHES.productionBuildIloFactory,
      observedChildCount: '8330',
      observedOn: '2026-08-04',
    },
    {
      label: 'canonical-legacy-factory',
      address: LEGACY_ADDRESSES.iloFactory,
      runtimeCodeHash: LEGACY_RUNTIME_HASHES.iloFactory,
      observedChildCount: '121',
      observedOn: '2026-08-04',
    },
  ],
}
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const HASH_PATTERN = /^0x[0-9a-f]{64}$/
const ZERO_HASH = `0x${'00'.repeat(32)}`

function assertExactObjectKeys(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly the reviewed fields.`)
  }
}

function assertExactApprovedShape(value) {
  assertExactObjectKeys(value, [
    'status', 'approvalPayloadSha256', 'deploymentManifestSha256', 'deploymentManifest',
    'frontendRuntimeAttestations', 'activityCutover',
  ], 'The APPROVED public replacement package')
  const manifest = value.deploymentManifest
  assertExactObjectKeys(manifest, MANIFEST_KEYS, 'The replacement manifest')
  assertExactObjectKeys(manifest.parameters, PARAMETER_KEYS, 'The replacement parameters')
  assertExactObjectKeys(
    manifest.legacyRecovery,
    ['addresses', 'runtimeCodeHashes', 'iloFactoryProvenance'],
    'The legacy-recovery inventory',
  )
  assertExactObjectKeys(manifest.legacyRecovery.addresses, LEGACY_RECOVERY_NAMES, 'The legacy-recovery addresses')
  assertExactObjectKeys(
    manifest.legacyRecovery.runtimeCodeHashes,
    LEGACY_RECOVERY_NAMES,
    'The legacy-recovery runtime hashes',
  )
  if (!Array.isArray(manifest.legacyRecovery.iloFactoryProvenance) || manifest.legacyRecovery.iloFactoryProvenance.length !== 2) {
    throw new Error('The legacy-recovery ILO provenance must contain exactly two records.')
  }
  for (const provenance of manifest.legacyRecovery.iloFactoryProvenance) {
    assertExactObjectKeys(
      provenance,
      ['label', 'address', 'runtimeCodeHash', 'observedChildCount', 'observedOn'],
      'A legacy-recovery ILO provenance record',
    )
  }
  if (!Array.isArray(manifest.deployments) || manifest.deployments.length !== 13) {
    throw new Error('The replacement manifest must contain exactly thirteen deployment records.')
  }
  for (const deployment of manifest.deployments) {
    assertExactObjectKeys(
      deployment,
      ['name', 'artifact', 'address', 'nonce', 'transactionHash', 'blockNumber', 'runtimeCodeHash', 'runtimeCodeBytes'],
      'A replacement deployment record',
    )
  }
  assertExactObjectKeys(
    value.frontendRuntimeAttestations,
    ['uniswapV2Pair', 'vestingWallet', 'iloChild'],
    'The frontend runtime attestations',
  )
  const vesting = value.frontendRuntimeAttestations.vestingWallet
  assertExactObjectKeys(
    vesting,
    ['normalizedRuntimeCodeHash', 'runtimeCodeBytes', 'immutableReferences'],
    'The VestingWallet runtime attestation',
  )
  if (!Array.isArray(vesting.immutableReferences)) throw new Error('VestingWallet immutable references must be an array.')
  for (const reference of vesting.immutableReferences) {
    assertExactObjectKeys(reference, ['start', 'length'], 'A VestingWallet immutable reference')
  }
  assertExactObjectKeys(value.activityCutover, ['throughBlock', 'blockHash', 'totals'], 'The activity cutover')
  assertExactObjectKeys(
    value.activityCutover.totals,
    ['tokensMinted', 'walletsAirdropped', 'presalesCreated', 'swapsCompleted', 'onChainMessages'],
    'The activity cutover totals',
  )
}

function assertApprovedProductionSemantics(value) {
  const manifest = value.deploymentManifest
  if (
    manifest.kind !== 'lester-labs-post-compromise-replacement' ||
    manifest.schemaVersion !== 2 ||
    manifest.chainId !== '4441' ||
    manifest.deploymentProfile !== 'production-separated-authority'
  ) throw new Error('Only a schema-2 production-separated-authority manifest can be approved.')
  if (!HASH_PATTERN.test(manifest.planHash) || !HASH_PATTERN.test(manifest.buildAttestationSha256)) {
    throw new Error('The production manifest plan/build digests are invalid.')
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.buildSourceCommit)) {
    throw new Error('The production manifest source commit is invalid.')
  }
  if (Object.entries(REVIEWED_PARAMETERS).some(([name, expected]) => manifest.parameters[name] !== expected)) {
    throw new Error('The production manifest parameters differ from reviewed source.')
  }
  if (JSON.stringify(manifest.legacyRecovery) !== JSON.stringify(PINNED_LEGACY_RECOVERY)) {
    throw new Error('The production legacy-recovery inventory differs from reviewed source.')
  }

  const roles = [manifest.controller, manifest.treasury, manifest.gasOnlyDeployer]
  if (
    roles.some((address) => typeof address !== 'string' || !ADDRESS_PATTERN.test(address)) ||
    new Set(roles.map((address) => address.toLowerCase())).size !== roles.length ||
    roles.some((address) => REJECTED_ROLE_ADDRESSES.has(address.toLowerCase()))
  ) throw new Error('Production controller, treasury, and gas-only deployer must be distinct fresh addresses.')
  if (manifest.startingNonce !== 0) throw new Error('The production gas-only deployer must start at nonce zero.')
  if (!Number.isSafeInteger(manifest.confirmations) || manifest.confirmations < 1 || manifest.confirmations > 64) {
    throw new Error('The production manifest confirmation count is invalid.')
  }

  const addresses = new Set()
  const transactions = new Set()
  let latestDeploymentBlock = 0
  for (let index = 0; index < DEPLOYMENTS.length; index += 1) {
    const deployment = manifest.deployments[index]
    const [expectedName, expectedArtifact] = DEPLOYMENTS[index]
    const expectedAddress = getContractAddress({ from: manifest.gasOnlyDeployer, nonce: BigInt(index) })
    if (
      deployment.name !== expectedName || deployment.artifact !== expectedArtifact || deployment.nonce !== index ||
      !ADDRESS_PATTERN.test(deployment.address) || deployment.address.toLowerCase() !== expectedAddress.toLowerCase() ||
      !HASH_PATTERN.test(deployment.transactionHash) || deployment.transactionHash === ZERO_HASH ||
      !HASH_PATTERN.test(deployment.runtimeCodeHash) || !Number.isSafeInteger(deployment.runtimeCodeBytes) ||
      deployment.runtimeCodeBytes <= 0 || !Number.isSafeInteger(deployment.blockNumber) || deployment.blockNumber <= 0
    ) throw new Error(`Production deployment evidence is invalid: ${expectedName}.`)
    const address = deployment.address.toLowerCase()
    const transaction = deployment.transactionHash.toLowerCase()
    if (addresses.has(address) || transactions.has(transaction)) {
      throw new Error('Production deployment addresses and transactions must be unique.')
    }
    addresses.add(address)
    transactions.add(transaction)
    latestDeploymentBlock = Math.max(latestDeploymentBlock, deployment.blockNumber)
  }
  if (roles.some((address) => addresses.has(address.toLowerCase()))) {
    throw new Error('Production authority roles must not overlap replacement deployments.')
  }
  if (
    !Number.isSafeInteger(manifest.verifiedAtBlock) ||
    manifest.verifiedAtBlock < latestDeploymentBlock + manifest.confirmations - 1
  ) throw new Error('The production manifest does not prove deployment finality.')

  const cutover = value.activityCutover
  if (
    !Number.isSafeInteger(cutover.throughBlock) || cutover.throughBlock < manifest.verifiedAtBlock ||
    !HASH_PATTERN.test(cutover.blockHash) ||
    Object.values(cutover.totals).some((total) => !Number.isSafeInteger(total) || total < 0)
  ) throw new Error('The production activity cutover is invalid.')
  for (const hash of [
    value.frontendRuntimeAttestations.uniswapV2Pair,
    value.frontendRuntimeAttestations.iloChild,
    value.frontendRuntimeAttestations.vestingWallet.normalizedRuntimeCodeHash,
  ]) if (!HASH_PATTERN.test(hash)) throw new Error('A production frontend runtime attestation is invalid.')
  const vesting = value.frontendRuntimeAttestations.vestingWallet
  if (!Number.isSafeInteger(vesting.runtimeCodeBytes) || vesting.runtimeCodeBytes <= 0 || vesting.immutableReferences.length === 0) {
    throw new Error('The production VestingWallet runtime length or immutable references are invalid.')
  }
  const covered = new Set()
  for (const reference of vesting.immutableReferences) {
    if (
      !Number.isSafeInteger(reference.start) || !Number.isSafeInteger(reference.length) ||
      reference.start < 0 || reference.length <= 0 || reference.start + reference.length > vesting.runtimeCodeBytes
    ) throw new Error('A production VestingWallet immutable reference is invalid.')
    for (let offset = reference.start; offset < reference.start + reference.length; offset += 1) {
      if (covered.has(offset)) throw new Error('Production VestingWallet immutable references overlap.')
      covered.add(offset)
    }
  }
}

export function canonicalManifestSha256(manifest) {
  return `0x${createHash('sha256').update(`${JSON.stringify(manifest, null, 2)}\n`).digest('hex')}`
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

export function approvalPayloadFromPackage(value) {
  return {
    deploymentManifestSha256: value.deploymentManifestSha256,
    deploymentManifest: value.deploymentManifest,
    frontendRuntimeAttestations: value.frontendRuntimeAttestations,
    activityCutover: value.activityCutover,
  }
}

export function canonicalApprovalPayloadSha256(value) {
  return `0x${createHash('sha256')
    .update(`${JSON.stringify(canonicalizeJson(approvalPayloadFromPackage(value)), null, 2)}\n`)
    .digest('hex')}`
}

export function verifyApprovedPublicReplacementPackage(filePath = packagePath) {
  const value = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The approved public replacement package must be a JSON object.')
  }
  if (value.status === 'NOT_APPROVED') {
    if (Object.keys(value).length !== 1) {
      throw new Error('The NOT_APPROVED sentinel must not contain deployment data.')
    }
    return { status: 'NOT_APPROVED' }
  }
  if (value.status !== 'APPROVED' || !value.deploymentManifest) {
    throw new Error('Public replacement data must be an APPROVED package with a complete deployment manifest.')
  }
  assertExactApprovedShape(value)
  assertApprovedProductionSemantics(value)
  if (!/^0x[0-9a-f]{64}$/.test(value.deploymentManifestSha256)) {
    throw new Error('The approved deployment manifest SHA-256 is not a lower-case digest.')
  }
  const actual = canonicalManifestSha256(value.deploymentManifest)
  if (actual !== value.deploymentManifestSha256) {
    throw new Error(`Approved deployment manifest digest is ${actual}; expected ${value.deploymentManifestSha256}.`)
  }
  if (!/^0x[0-9a-f]{64}$/.test(value.approvalPayloadSha256)) {
    throw new Error('The approved public replacement payload SHA-256 is not a lower-case digest.')
  }
  const actualPayload = canonicalApprovalPayloadSha256(value)
  if (actualPayload !== value.approvalPayloadSha256) {
    throw new Error(`Approved public replacement payload digest is ${actualPayload}; expected ${value.approvalPayloadSha256}.`)
  }
  return {
    status: 'APPROVED',
    approvalPayloadSha256: actualPayload,
    deploymentManifestSha256: actual,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyApprovedPublicReplacementPackage()
  console.log(
    result.status === 'APPROVED'
      ? `Approved public replacement package payload verified: ${result.approvalPayloadSha256}. Activation still requires matching analytics snapshot/latches and a successful application build.`
      : 'Public replacement remains fail-closed: NOT_APPROVED',
  )
}
