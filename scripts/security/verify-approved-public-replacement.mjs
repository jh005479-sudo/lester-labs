import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getContractAddress } from 'viem'
import { verifyControlPlaneRecoveryEvidence } from './verify-control-plane-recovery.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const packagePath = resolve(repositoryRoot, 'src/config/approvedPublicReplacement.json')
const productionAuthoritiesPath = resolve(repositoryRoot, 'contracts/deployment/production-authorities.json')
const safeRuntimeProvenancePath = resolve(repositoryRoot, 'contracts/deployment/safe-v1.4.1-runtime-provenance.json')
const controlPlaneRecoveryPath = resolve(repositoryRoot, 'docs/security/evidence/production-control-plane-recovery.json')
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
const ZERO_ADDRESS = `0x${'00'.repeat(20)}`
const PINNED_SAFE_VERSION = '1.4.1'
const PINNED_SAFE_SOURCE_REPOSITORY = 'https://github.com/safe-fndn/safe-smart-account'
const PINNED_SAFE_SOURCE_RELEASE = 'v1.4.1'
const PINNED_SAFE_SOURCE_COMMIT = 'bf943f80fec5ac647159d26161446ac5d716a294'
const PINNED_SAFE_PROXY_RUNTIME_HASH = '0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c'
const PINNED_SAFE_PROXY_CREATION_CODE_HASH = '0x1856e0ee08399d74e0ea0b03adca210aeade6f748969ac023cdcb4dd62dcaf5f'
const PINNED_SAFE_FACTORY_RUNTIME_HASH = '0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317'
const PINNED_SAFE_IMPLEMENTATION_RUNTIME_HASH = '0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff'
const APPROVAL_KEYS = ['reviewer', 'reviewRole', 'approvalPayloadSha256', 'evidenceSha256', 'approvedAt']
const ACTIVITY_TOTAL_KEYS = ['tokensMinted', 'walletsAirdropped', 'presalesCreated', 'swapsCompleted', 'onChainMessages']
const AUTHORITY_VERIFICATION_KEYS = [
  'address', 'factoryAddress', 'deploymentTransactionHash', 'deploymentBlockNumber',
  'deploymentBlockHash', 'deploymentBlockTimestamp', 'saltNonce', 'proxyRuntimeCodeHash', 'implementationAddress',
  'implementationRuntimeCodeHash', 'safeVersion', 'owners', 'threshold', 'nonce',
  'enabledModules', 'guard', 'fallbackHandler', 'benignSafeReceivedLogCount',
]
const PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const PRODUCTION_AUTHORITY_VERIFICATION_KEYS = [
  'inventorySha256', 'chainId', 'blockNumber', 'blockHash', 'blockTimestamp',
  'authorityReviewMaxAgeSeconds', 'gasOnlyDeployer', 'controller', 'treasury',
]
const INDEPENDENT_REPLACEMENT_VERIFICATION_CHECKS = [
  'source-and-build-attestation',
  'legacy-runtime-anchors',
  'deployment-transactions-and-receipts',
  'replacement-runtime-code-and-byte-lengths',
  'constructor-parameters-and-role-bindings',
  'production-safe-creation-history-and-owner-eoas',
  'production-safe-authorities',
  'zero-replacement-counters-at-cutover',
]

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
    'frontendRuntimeAttestations', 'sourceEvidence', 'activityCutover', 'reviewerApprovals',
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
  assertExactObjectKeys(
    value.sourceEvidence,
    [
      'productionAuthoritiesRawSha256', 'controlPlaneRecoveryRawSha256',
      'productionAuthorityVerification', 'independentReplacementVerification',
    ],
    'The source evidence inventory',
  )
  assertExactObjectKeys(
    value.sourceEvidence.productionAuthorityVerification,
    PRODUCTION_AUTHORITY_VERIFICATION_KEYS,
    'The production authority verification',
  )
  assertExactObjectKeys(
    value.sourceEvidence.productionAuthorityVerification.controller,
    AUTHORITY_VERIFICATION_KEYS,
    'The verified production controller',
  )
  assertExactObjectKeys(
    value.sourceEvidence.productionAuthorityVerification.treasury,
    AUTHORITY_VERIFICATION_KEYS,
    'The verified production treasury',
  )
  const independentVerification = value.sourceEvidence.independentReplacementVerification
  assertExactObjectKeys(
    independentVerification,
    [
      'reportSha256', 'status', 'primaryRpcOrigin', 'rpcUrl', 'chainId', 'blockNumber',
      'blockHash', 'deploymentManifestSha256', 'verifiedChecks',
      'productionAuthorityVerification', 'replacementCountersAtCutover',
    ],
    'The independent replacement verification report',
  )
  assertExactObjectKeys(
    independentVerification.productionAuthorityVerification,
    PRODUCTION_AUTHORITY_VERIFICATION_KEYS,
    'The independent production authority verification',
  )
  assertExactObjectKeys(
    independentVerification.productionAuthorityVerification.controller,
    AUTHORITY_VERIFICATION_KEYS,
    'The independently verified production controller',
  )
  assertExactObjectKeys(
    independentVerification.productionAuthorityVerification.treasury,
    AUTHORITY_VERIFICATION_KEYS,
    'The independently verified production treasury',
  )
  assertExactObjectKeys(
    independentVerification.replacementCountersAtCutover,
    ACTIVITY_TOTAL_KEYS,
    'The independently verified replacement cutover counters',
  )
  assertExactObjectKeys(
    value.activityCutover,
    ['throughBlock', 'blockHash', 'totals', 'independentSecondRpc', 'replacementCountersAtCutover'],
    'The activity cutover',
  )
  assertExactObjectKeys(
    value.activityCutover.totals,
    ACTIVITY_TOTAL_KEYS,
    'The activity cutover totals',
  )
  assertExactObjectKeys(
    value.activityCutover.independentSecondRpc,
    ['candidateRawSha256', 'candidatePayloadSha256', 'proofRawSha256', 'rpcUrl'],
    'The independent second-RPC cutover evidence',
  )
  assertExactObjectKeys(
    value.activityCutover.replacementCountersAtCutover,
    ACTIVITY_TOTAL_KEYS,
    'The replacement cutover counters',
  )
  if (!Array.isArray(value.reviewerApprovals) || value.reviewerApprovals.length < 2) {
    throw new Error('The approved public replacement package requires at least two reviewer approval records.')
  }
  for (const approval of value.reviewerApprovals) {
    assertExactObjectKeys(approval, APPROVAL_KEYS, 'A public replacement reviewer approval')
  }
}

function assertHash(value, label) {
  if (!HASH_PATTERN.test(value) || value === ZERO_HASH) {
    throw new Error(`${label} must be a non-zero lower-case SHA-256 digest.`)
  }
}

function assertReviewerApprovals(value) {
  const reviewers = new Set()
  const roles = new Set()
  const evidenceDigests = new Set()
  for (const approval of value.reviewerApprovals) {
    if (
      typeof approval.reviewer !== 'string' || approval.reviewer.length < 2 || approval.reviewer.length > 120 ||
      typeof approval.reviewRole !== 'string' || approval.reviewRole.length < 2 || approval.reviewRole.length > 120 ||
      /[\u0000-\u001f\u007f]/u.test(approval.reviewer) || /[\u0000-\u001f\u007f]/u.test(approval.reviewRole)
    ) throw new Error('Public replacement reviewer identities and roles must be bounded reviewed text.')
    if (approval.approvalPayloadSha256 !== value.approvalPayloadSha256) {
      throw new Error('Every public replacement approval must bind the exact approval payload SHA-256.')
    }
    assertHash(approval.evidenceSha256, 'A public replacement reviewer evidence SHA-256')
    if (
      typeof approval.approvedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(approval.approvedAt) ||
      Number.isNaN(Date.parse(approval.approvedAt))
    ) throw new Error('A public replacement reviewer approval must have a canonical UTC timestamp.')
    reviewers.add(approval.reviewer.toLowerCase())
    roles.add(approval.reviewRole.toLowerCase())
    evidenceDigests.add(approval.evidenceSha256)
  }
  if (
    reviewers.size !== value.reviewerApprovals.length ||
    roles.size < 2 ||
    evidenceDigests.size !== value.reviewerApprovals.length
  ) {
    throw new Error('Public replacement approvals require distinct reviewers, at least two review roles, and distinct evidence digests.')
  }
}

function rawFileSha256(filePath) {
  return `0x${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`
}

function assertReviewedAuthorityInventoryAuthority(authority, label) {
  assertExactObjectKeys(
    authority,
    [
      'address', 'deployment', 'safeVersion', 'proxy', 'owners', 'threshold',
      'enabledModules', 'guard', 'fallbackHandler',
    ],
    `The reviewed ${label} authority`,
  )
  assertExactObjectKeys(
    authority.deployment,
    ['factoryAddress', 'transactionHash', 'blockNumber', 'blockHash', 'saltNonce'],
    `The reviewed ${label} Safe deployment`,
  )
  assertExactObjectKeys(
    authority.proxy,
    [
      'kind', 'runtimeCodeHash', 'implementationStorageSlot', 'implementationAddress',
      'implementationRuntimeCodeHash', 'sourceRepository', 'sourceRelease', 'sourceCommit',
    ],
    `The reviewed ${label} Safe proxy`,
  )
  assertExactObjectKeys(authority.guard, ['mode'], `The reviewed ${label} Safe guard`)
  assertExactObjectKeys(authority.fallbackHandler, ['mode'], `The reviewed ${label} Safe fallback handler`)
  if (
    typeof authority.address !== 'string' || !ADDRESS_PATTERN.test(authority.address) ||
    typeof authority.deployment.factoryAddress !== 'string' ||
      !ADDRESS_PATTERN.test(authority.deployment.factoryAddress) ||
    authority.address.toLowerCase() === authority.deployment.factoryAddress.toLowerCase() ||
    typeof authority.deployment.transactionHash !== 'string' ||
      !HASH_PATTERN.test(authority.deployment.transactionHash) ||
    !Number.isSafeInteger(authority.deployment.blockNumber) || authority.deployment.blockNumber <= 0 ||
    typeof authority.deployment.blockHash !== 'string' || !HASH_PATTERN.test(authority.deployment.blockHash) ||
    typeof authority.deployment.saltNonce !== 'string' || !/^\d+$/.test(authority.deployment.saltNonce) ||
    typeof authority.proxy.implementationAddress !== 'string' ||
      !ADDRESS_PATTERN.test(authority.proxy.implementationAddress) ||
    authority.address.toLowerCase() === authority.proxy.implementationAddress.toLowerCase() ||
    authority.safeVersion !== PINNED_SAFE_VERSION ||
    authority.proxy.kind !== 'safe-proxy-storage-slot-0' ||
    authority.proxy.implementationStorageSlot !== ZERO_HASH ||
    authority.proxy.runtimeCodeHash !== PINNED_SAFE_PROXY_RUNTIME_HASH ||
    authority.proxy.implementationRuntimeCodeHash !== PINNED_SAFE_IMPLEMENTATION_RUNTIME_HASH ||
    authority.proxy.sourceRepository !== PINNED_SAFE_SOURCE_REPOSITORY ||
    authority.proxy.sourceRelease !== PINNED_SAFE_SOURCE_RELEASE ||
    authority.proxy.sourceCommit !== PINNED_SAFE_SOURCE_COMMIT
  ) throw new Error(`The reviewed ${label} authority does not use the pinned official Safe 1.4.1 runtime provenance.`)
  if (
    !Array.isArray(authority.owners) || authority.owners.length < 2 || authority.owners.length > 32 ||
    authority.owners.some((owner) => typeof owner !== 'string' || !ADDRESS_PATTERN.test(owner)) ||
    new Set(authority.owners.map((owner) => owner.toLowerCase())).size !== authority.owners.length ||
    authority.owners.some((owner) => [
      authority.address,
      authority.deployment.factoryAddress,
      authority.proxy.implementationAddress,
    ].some((forbidden) => owner.toLowerCase() === forbidden.toLowerCase())) ||
    !Number.isSafeInteger(authority.threshold) || authority.threshold < 2 ||
      authority.threshold > authority.owners.length
  ) throw new Error(`The reviewed ${label} Safe owners or threshold are invalid.`)
  if (
    !Array.isArray(authority.enabledModules) || authority.enabledModules.length !== 0 ||
    authority.guard.mode !== 'none' || authority.fallbackHandler.mode !== 'none'
  ) throw new Error(`The reviewed ${label} incident-recovery Safe must have no modules, guard, or fallback handler.`)
  return authority
}

function assertAuthorityReportMatchesInventory(report, authority, label) {
  if (
    report.address.toLowerCase() !== authority.address.toLowerCase() ||
    report.factoryAddress.toLowerCase() !== authority.deployment.factoryAddress.toLowerCase() ||
    report.deploymentTransactionHash !== authority.deployment.transactionHash ||
    report.deploymentBlockNumber !== authority.deployment.blockNumber ||
    report.deploymentBlockHash !== authority.deployment.blockHash ||
    report.saltNonce !== authority.deployment.saltNonce ||
    report.proxyRuntimeCodeHash !== authority.proxy.runtimeCodeHash ||
    report.implementationAddress.toLowerCase() !== authority.proxy.implementationAddress.toLowerCase() ||
    report.implementationRuntimeCodeHash !== authority.proxy.implementationRuntimeCodeHash ||
    report.safeVersion !== authority.safeVersion ||
    JSON.stringify(report.owners.map((owner) => owner.toLowerCase())) !==
      JSON.stringify(authority.owners.map((owner) => owner.toLowerCase())) ||
    report.threshold !== authority.threshold ||
    report.nonce !== 0 ||
    !Array.isArray(report.enabledModules) || report.enabledModules.length !== 0 ||
    report.guard.toLowerCase() !== ZERO_ADDRESS ||
    report.fallbackHandler.toLowerCase() !== ZERO_ADDRESS
  ) throw new Error(`The ${label} Safe facts contradict the exact reviewed authority inventory.`)
}

function parseReviewedAuthorityInventory(filePath, manifest) {
  const runtimeProvenance = JSON.parse(readFileSync(safeRuntimeProvenancePath, 'utf8'))
  if (
    runtimeProvenance?.kind !== 'lester-labs-pinned-safe-runtime-provenance' ||
    runtimeProvenance?.schemaVersion !== 1 ||
    runtimeProvenance?.source?.repository !== PINNED_SAFE_SOURCE_REPOSITORY ||
    runtimeProvenance?.source?.release !== PINNED_SAFE_SOURCE_RELEASE ||
    runtimeProvenance?.source?.commit !== PINNED_SAFE_SOURCE_COMMIT ||
    runtimeProvenance?.proxy?.creationCodeHash !== PINNED_SAFE_PROXY_CREATION_CODE_HASH ||
    runtimeProvenance?.proxy?.runtimeCodeHash !== PINNED_SAFE_PROXY_RUNTIME_HASH ||
    runtimeProvenance?.factory?.runtimeCodeHash !== PINNED_SAFE_FACTORY_RUNTIME_HASH ||
    runtimeProvenance?.implementation?.runtimeCodeHash !== PINNED_SAFE_IMPLEMENTATION_RUNTIME_HASH
  ) throw new Error('The source-pinned Safe 1.4.1 runtime provenance differs from reviewed constants.')
  const authorityInventory = JSON.parse(readFileSync(filePath, 'utf8'))
  assertExactObjectKeys(
    authorityInventory,
    ['kind', 'schemaVersion', 'status', 'chainId', 'review', 'controller', 'treasury'],
    'The source-pinned production authority inventory',
  )
  assertExactObjectKeys(authorityInventory.review, ['approvals'], 'The production authority review')
  if (
    authorityInventory.kind !== 'lester-labs-production-authority-inventory' ||
    authorityInventory.schemaVersion !== 1 ||
    authorityInventory.status !== 'REVIEWED_FOR_PRODUCTION' ||
    authorityInventory.chainId !== '4441' ||
    !Array.isArray(authorityInventory.review.approvals) ||
    authorityInventory.review.approvals.length < 2 || authorityInventory.review.approvals.length > 8
  ) throw new Error('The source-pinned production authority inventory is not fully reviewed for LitVM.')
  const reviewers = new Set()
  const reviewEvidence = new Set()
  for (const approval of authorityInventory.review.approvals) {
    assertExactObjectKeys(approval, ['reviewer', 'approvedAt', 'evidenceSha256'], 'A production authority approval')
    if (
      typeof approval.reviewer !== 'string' || approval.reviewer.length < 3 ||
      /(?:UNREVIEWED|TODO|TBD|PLACEHOLDER|UNKNOWN|NOT[_ -]?SET)/i.test(approval.reviewer) ||
      typeof approval.approvedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(approval.approvedAt) ||
      Number.isNaN(Date.parse(approval.approvedAt)) ||
      typeof approval.evidenceSha256 !== 'string' || !HASH_PATTERN.test(approval.evidenceSha256) ||
      approval.evidenceSha256 === ZERO_HASH
    ) throw new Error('A production authority approval is unreviewed or malformed.')
    reviewers.add(approval.reviewer.toLowerCase())
    reviewEvidence.add(approval.evidenceSha256)
  }
  if (
    reviewers.size !== authorityInventory.review.approvals.length ||
    reviewEvidence.size !== authorityInventory.review.approvals.length
  ) throw new Error('Production authority approvals require distinct reviewers and evidence records.')

  const controller = assertReviewedAuthorityInventoryAuthority(authorityInventory.controller, 'controller')
  const treasury = assertReviewedAuthorityInventoryAuthority(authorityInventory.treasury, 'treasury')
  const controllerOwners = controller.owners.map((owner) => owner.toLowerCase())
  const treasuryOwners = treasury.owners.map((owner) => owner.toLowerCase())
  const sharedOwnerCount = controllerOwners.filter((owner) => treasuryOwners.includes(owner)).length
  const earliestReplacementBlock = Math.min(
    ...manifest.deployments.map((deployment) => deployment.blockNumber),
  )
  if (
    controller.address.toLowerCase() !== manifest.controller.toLowerCase() ||
    treasury.address.toLowerCase() !== manifest.treasury.toLowerCase() ||
    controller.address.toLowerCase() === treasury.address.toLowerCase() ||
    controller.proxy.implementationAddress.toLowerCase() !==
      treasury.proxy.implementationAddress.toLowerCase() ||
    controller.deployment.factoryAddress.toLowerCase() !==
      treasury.deployment.factoryAddress.toLowerCase() ||
    controller.deployment.transactionHash === treasury.deployment.transactionHash ||
    controller.deployment.blockNumber >= earliestReplacementBlock ||
    treasury.deployment.blockNumber >= earliestReplacementBlock ||
    controllerOwners.includes(manifest.gasOnlyDeployer.toLowerCase()) ||
    treasuryOwners.includes(manifest.gasOnlyDeployer.toLowerCase()) ||
    [
      controller.deployment.factoryAddress,
      controller.proxy.implementationAddress,
      treasury.deployment.factoryAddress,
      treasury.proxy.implementationAddress,
    ].some((address) => address.toLowerCase() === manifest.gasOnlyDeployer.toLowerCase()) ||
    JSON.stringify([...controllerOwners].sort()) === JSON.stringify([...treasuryOwners].sort()) ||
    sharedOwnerCount >= Math.min(controller.threshold, treasury.threshold)
  ) throw new Error('The reviewed production authority separation or manifest binding is invalid.')
  return authorityInventory
}

function assertPinnedSourceEvidence(value, manifest, paths, now) {
  const expectedAuthorities = rawFileSha256(paths.productionAuthorities)
  const expectedControlPlane = rawFileSha256(paths.controlPlaneRecovery)
  if (value.productionAuthoritiesRawSha256 !== expectedAuthorities) {
    throw new Error(`Production authority inventory digest is ${expectedAuthorities}; expected ${value.productionAuthoritiesRawSha256}.`)
  }
  if (value.controlPlaneRecoveryRawSha256 !== expectedControlPlane) {
    throw new Error(`Control-plane recovery digest is ${expectedControlPlane}; expected ${value.controlPlaneRecoveryRawSha256}.`)
  }

  const authorityInventory = parseReviewedAuthorityInventory(paths.productionAuthorities, manifest)
  for (const [reportLabel, verification] of [
    ['primary production authority verification', value.productionAuthorityVerification],
    [
      'independent production authority verification',
      value.independentReplacementVerification.productionAuthorityVerification,
    ],
  ]) {
    assertAuthorityReportMatchesInventory(verification.controller, authorityInventory.controller, `${reportLabel} controller`)
    assertAuthorityReportMatchesInventory(verification.treasury, authorityInventory.treasury, `${reportLabel} treasury`)
    const latestSafeCreationTimestamp = Math.max(
      verification.controller.deploymentBlockTimestamp,
      verification.treasury.deploymentBlockTimestamp,
    )
    for (const approval of authorityInventory.review.approvals) {
      const approvalTimestamp = Date.parse(approval.approvedAt) / 1_000
      if (
        approvalTimestamp <= latestSafeCreationTimestamp ||
        approvalTimestamp > verification.blockTimestamp ||
        verification.blockTimestamp - approvalTimestamp > PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS
      ) throw new Error(`The ${reportLabel} is not bound to fresh post-creation authority approvals.`)
    }
  }

  const controlPlane = verifyControlPlaneRecoveryEvidence(paths.controlPlaneRecovery, {
    requireReviewed: true,
    now,
  })
  if (controlPlane.status !== 'REVIEWED') {
    throw new Error('The source-pinned production control-plane recovery is not reviewed.')
  }
}

function assertProductionAuthorityVerificationRecord(
  verification,
  expectedInventorySha256,
  manifest,
  cutover,
  verificationLabel = 'production authority verification',
) {
  if (
    verification.inventorySha256 !== expectedInventorySha256 ||
    verification.chainId !== '4441' ||
    typeof verification.gasOnlyDeployer !== 'string' ||
    !ADDRESS_PATTERN.test(verification.gasOnlyDeployer) ||
    verification.gasOnlyDeployer.toLowerCase() !== manifest.gasOnlyDeployer.toLowerCase() ||
    verification.blockNumber !== cutover.throughBlock ||
    verification.blockHash.toLowerCase() !== cutover.blockHash.toLowerCase() ||
    !Number.isSafeInteger(verification.blockTimestamp) || verification.blockTimestamp <= 0 ||
    verification.authorityReviewMaxAgeSeconds !== PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS
  ) throw new Error(`The ${verificationLabel} is not bound to the exact inventory, chain, and cutover block.`)
  assertHash(verification.inventorySha256, `The ${verificationLabel} inventory SHA-256`)
  if (!HASH_PATTERN.test(verification.blockHash)) {
    throw new Error(`The ${verificationLabel} block hash is invalid.`)
  }

  for (const [authorityLabel, authority, expectedAddress] of [
    ['controller', verification.controller, manifest.controller],
    ['treasury', verification.treasury, manifest.treasury],
  ]) {
    if (
      !ADDRESS_PATTERN.test(authority.address) ||
      authority.address.toLowerCase() !== expectedAddress.toLowerCase() ||
      !ADDRESS_PATTERN.test(authority.factoryAddress) ||
      !HASH_PATTERN.test(authority.deploymentTransactionHash) ||
      !Number.isSafeInteger(authority.deploymentBlockNumber) || authority.deploymentBlockNumber <= 0 ||
      authority.deploymentBlockNumber > verification.blockNumber ||
      !HASH_PATTERN.test(authority.deploymentBlockHash) ||
      !Number.isSafeInteger(authority.deploymentBlockTimestamp) ||
      authority.deploymentBlockTimestamp <= 0 ||
      authority.deploymentBlockTimestamp > verification.blockTimestamp ||
      typeof authority.saltNonce !== 'string' || !/^\d+$/.test(authority.saltNonce) ||
      !HASH_PATTERN.test(authority.proxyRuntimeCodeHash) ||
      !ADDRESS_PATTERN.test(authority.implementationAddress) ||
      !HASH_PATTERN.test(authority.implementationRuntimeCodeHash) ||
      typeof authority.safeVersion !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(authority.safeVersion) ||
      !Array.isArray(authority.owners) || authority.owners.length < 2 || authority.owners.length > 32 ||
      authority.owners.some((owner) => !ADDRESS_PATTERN.test(owner)) ||
      [authority.factoryAddress, authority.implementationAddress, ...authority.owners]
        .some((address) => address.toLowerCase() === verification.gasOnlyDeployer.toLowerCase()) ||
      new Set(authority.owners.map((owner) => owner.toLowerCase())).size !== authority.owners.length ||
      !Number.isSafeInteger(authority.threshold) || authority.threshold < 2 || authority.threshold > authority.owners.length ||
      authority.nonce !== 0 ||
      !Array.isArray(authority.enabledModules) || authority.enabledModules.length > 32 ||
      authority.enabledModules.some((address) => !ADDRESS_PATTERN.test(address)) ||
      new Set(authority.enabledModules.map((address) => address.toLowerCase())).size !== authority.enabledModules.length ||
      !ADDRESS_PATTERN.test(authority.guard) ||
      !ADDRESS_PATTERN.test(authority.fallbackHandler) ||
      !Number.isSafeInteger(authority.benignSafeReceivedLogCount) ||
      authority.benignSafeReceivedLogCount < 0
    ) throw new Error(`The ${verificationLabel} ${authorityLabel} Safe facts are invalid or do not match the manifest.`)
  }
  if (
    verification.controller.factoryAddress.toLowerCase() !==
      verification.treasury.factoryAddress.toLowerCase() ||
    verification.controller.deploymentTransactionHash ===
      verification.treasury.deploymentTransactionHash
  ) throw new Error(`The ${verificationLabel} must bind one pinned factory and distinct Safe creation transactions.`)
}

function assertProductionAuthorityVerification(value, manifest, cutover) {
  assertProductionAuthorityVerificationRecord(
    value.productionAuthorityVerification,
    value.productionAuthoritiesRawSha256,
    manifest,
    cutover,
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
  for (const [label, hash] of [
    ['production authority inventory digest', value.sourceEvidence.productionAuthoritiesRawSha256],
    ['control-plane recovery digest', value.sourceEvidence.controlPlaneRecoveryRawSha256],
    ['cutover candidate raw digest', cutover.independentSecondRpc.candidateRawSha256],
    ['cutover candidate payload digest', cutover.independentSecondRpc.candidatePayloadSha256],
    ['second-RPC proof raw digest', cutover.independentSecondRpc.proofRawSha256],
    [
      'independent replacement verification report digest',
      value.sourceEvidence.independentReplacementVerification.reportSha256,
    ],
    [
      'independent replacement verification block hash',
      value.sourceEvidence.independentReplacementVerification.blockHash,
    ],
    [
      'independent replacement verification manifest digest',
      value.sourceEvidence.independentReplacementVerification.deploymentManifestSha256,
    ],
  ]) assertHash(hash, label)
  let rpcUrl
  try {
    rpcUrl = new URL(cutover.independentSecondRpc.rpcUrl)
  } catch {
    throw new Error('The independent second-RPC URL is invalid.')
  }
  if (
    rpcUrl.protocol !== 'https:' || rpcUrl.username || rpcUrl.password || rpcUrl.search || rpcUrl.hash ||
    rpcUrl.origin === 'https://liteforge.rpc.caldera.xyz'
  ) throw new Error('The cutover proof must identify a distinct credential-free HTTPS RPC URL.')
  if (Object.values(cutover.replacementCountersAtCutover).some((counter) => counter !== 0)) {
    throw new Error('Every replacement activity counter must be exactly zero at the cutover block.')
  }
  assertProductionAuthorityVerification(value.sourceEvidence, manifest, cutover)
  const independentVerification = value.sourceEvidence.independentReplacementVerification
  assertProductionAuthorityVerificationRecord(
    independentVerification.productionAuthorityVerification,
    value.sourceEvidence.productionAuthoritiesRawSha256,
    manifest,
    cutover,
    'independent production authority verification',
  )
  let primaryRpcOrigin
  try {
    primaryRpcOrigin = new URL(independentVerification.primaryRpcOrigin)
  } catch {
    throw new Error('The independent replacement verification primary RPC origin is invalid.')
  }
  if (
    independentVerification.status !== 'VERIFIED_INDEPENDENT_RPC' ||
    independentVerification.chainId !== '4441' ||
    independentVerification.blockNumber !== cutover.throughBlock ||
    independentVerification.blockHash.toLowerCase() !== cutover.blockHash.toLowerCase() ||
    independentVerification.deploymentManifestSha256 !== value.deploymentManifestSha256 ||
    independentVerification.rpcUrl !== cutover.independentSecondRpc.rpcUrl ||
    primaryRpcOrigin.protocol !== 'https:' || primaryRpcOrigin.username || primaryRpcOrigin.password ||
    primaryRpcOrigin.search || primaryRpcOrigin.hash || primaryRpcOrigin.pathname !== '/' ||
    primaryRpcOrigin.origin !== independentVerification.primaryRpcOrigin ||
    primaryRpcOrigin.origin === rpcUrl.origin ||
    JSON.stringify(independentVerification.verifiedChecks) !==
      JSON.stringify(INDEPENDENT_REPLACEMENT_VERIFICATION_CHECKS) ||
    JSON.stringify(canonicalizeJson(independentVerification.productionAuthorityVerification)) !==
      JSON.stringify(canonicalizeJson(value.sourceEvidence.productionAuthorityVerification)) ||
    JSON.stringify(canonicalizeJson(independentVerification.replacementCountersAtCutover)) !==
      JSON.stringify(canonicalizeJson(cutover.replacementCountersAtCutover))
  ) throw new Error('The independent replacement verification report does not bind the exact distinct-RPC manifest, authorities, counters, and cutover block.')
  if (Object.values(independentVerification.replacementCountersAtCutover).some((counter) => counter !== 0)) {
    throw new Error('Every independently verified replacement counter must be exactly zero at the cutover block.')
  }
  const actualIndependentReportSha256 = canonicalIndependentReplacementVerificationSha256(independentVerification)
  if (actualIndependentReportSha256 !== independentVerification.reportSha256) {
    throw new Error(
      `Independent replacement verification report digest is ${actualIndependentReportSha256}; expected ${independentVerification.reportSha256}.`,
    )
  }
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

export function canonicalIndependentReplacementVerificationSha256(report) {
  const payload = Object.fromEntries(
    Object.entries(report).filter(([key]) => key !== 'reportSha256'),
  )
  return `0x${createHash('sha256')
    .update(`${JSON.stringify(canonicalizeJson(payload), null, 2)}\n`)
    .digest('hex')}`
}

export function approvalPayloadFromPackage(value) {
  return {
    deploymentManifestSha256: value.deploymentManifestSha256,
    deploymentManifest: value.deploymentManifest,
    frontendRuntimeAttestations: value.frontendRuntimeAttestations,
    sourceEvidence: value.sourceEvidence,
    activityCutover: value.activityCutover,
  }
}

export function canonicalApprovalPayloadSha256(value) {
  return `0x${createHash('sha256')
    .update(`${JSON.stringify(canonicalizeJson(approvalPayloadFromPackage(value)), null, 2)}\n`)
    .digest('hex')}`
}

export function verifyApprovedPublicReplacementPackage(filePath = packagePath, {
  productionAuthorities = productionAuthoritiesPath,
  controlPlaneRecovery = controlPlaneRecoveryPath,
  now = new Date(),
} = {}) {
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
  assertPinnedSourceEvidence(value.sourceEvidence, value.deploymentManifest, {
    productionAuthorities,
    controlPlaneRecovery,
  }, now)
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
  assertReviewerApprovals(value)
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
