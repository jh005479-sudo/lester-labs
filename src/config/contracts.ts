import approvedPublicReplacementJson from './approvedPublicReplacement.json' with { type: 'json' }
import { assertDeterministicCreateDeploymentSequence } from '../lib/publicReplacementCreateAddress.ts'

export type LitvmContractAddress = `0x${string}`
export type RuntimeCodeHash = `0x${string}`

export interface ImmutableRuntimeReference {
  start: number
  length: number
}

export type VestingChildRuntimeAttestation =
  | {
      kind: 'exact-runtime-hashes'
      runtimeCodeHashes: readonly RuntimeCodeHash[]
    }
  | {
      kind: 'immutable-template'
      normalizedRuntimeCodeHash: RuntimeCodeHash
      runtimeCodeBytes: number
      immutableReferences: readonly ImmutableRuntimeReference[]
    }

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const CODE_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/
const COMMIT_HASH_PATTERN = /^[0-9a-f]{40}$/
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ZERO_HASH = `0x${'00'.repeat(32)}`

export const PUBLIC_REPLACEMENT_DEPLOYMENT_PROFILE = 'production-separated-authority' as const

const PUBLIC_REPLACEMENT_DEPLOYMENT_NAMES = Object.freeze([
  'WrappedZkLTC',
  'UniswapV2Factory',
  'UniswapV2Router02',
  'UniSwapConnector',
  'TokenFactory',
  'VestingFactory',
  'LiquidityLocker',
  'TheLedger',
  'Disperse',
  'ILOFactory',
  'LitGovToken',
  'LitTimelock',
  'LitGovernor',
] as const)

type PublicReplacementDeploymentName = (typeof PUBLIC_REPLACEMENT_DEPLOYMENT_NAMES)[number]

const PUBLIC_REPLACEMENT_ARTIFACTS = Object.freeze({
  WrappedZkLTC: 'WETH9',
  UniswapV2Factory: 'UniswapV2Factory',
  UniswapV2Router02: 'UniswapV2Router02',
  UniSwapConnector: 'UniSwapConnector',
  TokenFactory: 'TokenFactory',
  VestingFactory: 'VestingFactory',
  LiquidityLocker: 'LiquidityLocker',
  TheLedger: 'TheLedger',
  Disperse: 'Disperse',
  ILOFactory: 'ILOFactory',
  LitGovToken: 'LitGovToken',
  LitTimelock: 'LitTimelock',
  LitGovernor: 'LitGovernor',
} as const satisfies Record<PublicReplacementDeploymentName, string>)

const PUBLIC_REPLACEMENT_PARAMETERS = Object.freeze({
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
} as const)

interface ApprovedPublicReplacementDeployment {
  name: PublicReplacementDeploymentName
  artifact: string
  address: LitvmContractAddress
  nonce: number
  transactionHash: RuntimeCodeHash
  blockNumber: number
  runtimeCodeHash: RuntimeCodeHash
  runtimeCodeBytes: number
}

export interface ApprovedPublicReplacementPackage {
  status: 'APPROVED'
  approvalPayloadSha256: RuntimeCodeHash
  deploymentManifestSha256: RuntimeCodeHash
  deploymentManifest: {
    kind: 'lester-labs-post-compromise-replacement'
    schemaVersion: 2
    chainId: '4441'
    deploymentProfile: typeof PUBLIC_REPLACEMENT_DEPLOYMENT_PROFILE
    planHash: RuntimeCodeHash
    buildAttestationSha256: RuntimeCodeHash
    buildSourceCommit: string
    gasOnlyDeployer: LitvmContractAddress
    startingNonce: number
    confirmations: number
    controller: LitvmContractAddress
    treasury: LitvmContractAddress
    parameters: Readonly<Record<string, string>>
    legacyRecovery: {
      addresses: Readonly<Record<string, LitvmContractAddress>>
      runtimeCodeHashes: Readonly<Record<string, RuntimeCodeHash>>
      iloFactoryProvenance: readonly {
        label: string
        address: LitvmContractAddress
        runtimeCodeHash: RuntimeCodeHash
        observedChildCount: string
        observedOn: string
      }[]
    }
    verifiedAtBlock: number
    deployments: readonly ApprovedPublicReplacementDeployment[]
  }
  frontendRuntimeAttestations: {
    uniswapV2Pair: RuntimeCodeHash
    vestingWallet: {
      normalizedRuntimeCodeHash: RuntimeCodeHash
      runtimeCodeBytes: number
      immutableReferences: readonly ImmutableRuntimeReference[]
    }
    iloChild: RuntimeCodeHash
  }
  activityCutover: {
    throughBlock: number
    blockHash: RuntimeCodeHash
    totals: {
      tokensMinted: number
      walletsAirdropped: number
      presalesCreated: number
      swapsCompleted: number
      onChainMessages: number
    }
  }
}

const PUBLIC_REPLACEMENT_MANIFEST_KEYS = Object.freeze([
  'buildAttestationSha256',
  'buildSourceCommit',
  'chainId',
  'confirmations',
  'controller',
  'deploymentProfile',
  'deployments',
  'gasOnlyDeployer',
  'kind',
  'legacyRecovery',
  'parameters',
  'planHash',
  'schemaVersion',
  'startingNonce',
  'treasury',
  'verifiedAtBlock',
] as const)

const PUBLIC_REPLACEMENT_LEGACY_RECOVERY_NAMES = Object.freeze([
  'disperse',
  'iloFactory',
  'ledger',
  'legacyConnector',
  'liquidityLocker',
  'litGovToken',
  'litGovernor',
  'litTimelock',
  'productionBuildIloFactory',
  'tokenFactory',
  'uniswapV2Factory',
  'uniswapV2Router',
  'vestingFactory',
  'wrappedZkLtc',
] as const)

function assertExactObjectKeys(value: unknown, expectedKeys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) throw new Error(`${label} must contain exactly the reviewed fields.`)
}

export function assertExactApprovedPublicReplacementPackageShape(
  value: unknown,
): asserts value is ApprovedPublicReplacementPackage {
  assertExactObjectKeys(value, [
    'status',
    'approvalPayloadSha256',
    'deploymentManifestSha256',
    'deploymentManifest',
    'frontendRuntimeAttestations',
    'activityCutover',
  ], 'The APPROVED public replacement package')
  if (value.status !== 'APPROVED') throw new Error('The public replacement package status is not APPROVED.')

  assertExactObjectKeys(value.deploymentManifest, PUBLIC_REPLACEMENT_MANIFEST_KEYS, 'The replacement manifest')
  const manifest = value.deploymentManifest
  assertExactObjectKeys(
    manifest.parameters,
    Object.keys(PUBLIC_REPLACEMENT_PARAMETERS),
    'The replacement manifest parameters',
  )
  assertExactObjectKeys(
    manifest.legacyRecovery,
    ['addresses', 'runtimeCodeHashes', 'iloFactoryProvenance'],
    'The replacement legacy-recovery inventory',
  )
  assertExactObjectKeys(
    manifest.legacyRecovery.addresses,
    PUBLIC_REPLACEMENT_LEGACY_RECOVERY_NAMES,
    'The replacement legacy-recovery addresses',
  )
  assertExactObjectKeys(
    manifest.legacyRecovery.runtimeCodeHashes,
    PUBLIC_REPLACEMENT_LEGACY_RECOVERY_NAMES,
    'The replacement legacy-recovery runtime hashes',
  )
  if (
    !Array.isArray(manifest.legacyRecovery.iloFactoryProvenance) ||
    manifest.legacyRecovery.iloFactoryProvenance.length !== 2
  ) throw new Error('The replacement legacy-recovery ILO provenance must contain exactly two records.')
  for (const provenance of manifest.legacyRecovery.iloFactoryProvenance) {
    assertExactObjectKeys(
      provenance,
      ['label', 'address', 'runtimeCodeHash', 'observedChildCount', 'observedOn'],
      'A replacement legacy-recovery ILO provenance record',
    )
  }

  if (!Array.isArray(manifest.deployments) || manifest.deployments.length !== PUBLIC_REPLACEMENT_DEPLOYMENT_NAMES.length) {
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
  assertExactObjectKeys(
    value.frontendRuntimeAttestations.vestingWallet,
    ['normalizedRuntimeCodeHash', 'runtimeCodeBytes', 'immutableReferences'],
    'The VestingWallet runtime attestation',
  )
  if (!Array.isArray(value.frontendRuntimeAttestations.vestingWallet.immutableReferences)) {
    throw new Error('The VestingWallet immutable references must be an array.')
  }
  for (const reference of value.frontendRuntimeAttestations.vestingWallet.immutableReferences) {
    assertExactObjectKeys(reference, ['start', 'length'], 'A VestingWallet immutable reference')
  }

  assertExactObjectKeys(value.activityCutover, ['throughBlock', 'blockHash', 'totals'], 'The activity cutover')
  assertExactObjectKeys(
    value.activityCutover.totals,
    ['tokensMinted', 'walletsAirdropped', 'presalesCreated', 'swapsCompleted', 'onChainMessages'],
    'The activity cutover totals',
  )
}

function loadApprovedPublicReplacementPackage(value: unknown): ApprovedPublicReplacementPackage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The approved public replacement package must be a JSON object.')
  }
  const record = value as Record<string, unknown>
  if (record.status === 'NOT_APPROVED') {
    if (Object.keys(record).length !== 1) {
      throw new Error('The NOT_APPROVED public replacement sentinel must not contain deployment data.')
    }
    return undefined
  }
  if (record.status !== 'APPROVED') {
    throw new Error('The public replacement package must be the exact NOT_APPROVED sentinel or an APPROVED production package.')
  }
  assertExactApprovedPublicReplacementPackageShape(value)
  return value
}

export const APPROVED_PUBLIC_REPLACEMENT_PACKAGE = loadApprovedPublicReplacementPackage(
  approvedPublicReplacementJson as unknown,
)

function approvedPublicDeployment(
  name: PublicReplacementDeploymentName,
): ApprovedPublicReplacementDeployment | undefined {
  return APPROVED_PUBLIC_REPLACEMENT_PACKAGE?.deploymentManifest.deployments.find(
    (deployment) => deployment.name === name,
  )
}

/**
 * Pre-replacement deployments retained for reads and permissionless recovery.
 * Their mutable administrative surfaces are still controlled by the
 * compromised controller and must not be used for new paid actions.
 */
export const LITVM_COMPROMISED_LEGACY_DEPLOYMENTS = Object.freeze({
  tokenFactory: '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948',
  vestingFactory: '0x6EE07118D39e9330Ef0658FFA797EeDD2CB823Cf',
  liquidityLocker: '0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9',
  disperse: '0x3cc66cb4713dca78564df512922adb331ac5ee04',
  ledger: '0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079',
  uniswapV2Factory: '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8',
  uniswapV2Router: '0xD56a623890b083d876D47c3b1c5343b7f983FA62',
  wrappedZkLtc: '0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97',
} as const satisfies Record<string, LitvmContractAddress>)

/**
 * The first governance deployment is also retired. Live-chain review found
 * that the compromised controller owns the voting token and retains timelock
 * DEFAULT_ADMIN_ROLE/CANCELLER_ROLE, while no executor is configured. These
 * addresses remain read-only historical references and must never be revived
 * merely because the main application replacement set is activated.
 */
export const LITVM_COMPROMISED_LEGACY_GOVERNANCE = Object.freeze({
  token: '0xa5111cedc04554676DbCCA39F2268070008C7A8A',
  governor: '0x5b0092996BA897617B46D42B3F108B253be9Ad3d',
  timelock: '0xd38ed693730Db3eB22bA6d6F0050FC45Ac9240ba',
} as const satisfies Record<string, LitvmContractAddress>)

/**
 * Source-pinned frontend targets.
 *
 * These values are deliberately pinned in reviewed source. Never replace them
 * with NEXT_PUBLIC_* address variables: those variables let a compromised
 * hosting account redirect an otherwise-correct approval or paid write.
 *
 * When a contract is replaced, update its address and matching activity start
 * block in the same reviewed change. The reviewed analytics floor/cutover
 * snapshot contains activity before those replacements.
 *
 * POST_COMPROMISE_REPLACEMENTS_ACTIVE remains false while these entries still
 * point at pre-replacement deployments. Owner/treasury-gated paid actions then
 * fail closed; permissionless recovery remains available.
 */
export const LITVM_CURRENT_CONTRACTS = Object.freeze(
  APPROVED_PUBLIC_REPLACEMENT_PACKAGE
    ? {
        tokenFactory: approvedPublicDeployment('TokenFactory')!.address,
        vestingFactory: approvedPublicDeployment('VestingFactory')!.address,
        liquidityLocker: approvedPublicDeployment('LiquidityLocker')!.address,
        disperse: approvedPublicDeployment('Disperse')!.address,
        ledger: approvedPublicDeployment('TheLedger')!.address,
        uniswapV2Factory: approvedPublicDeployment('UniswapV2Factory')!.address,
        uniswapV2Router: approvedPublicDeployment('UniswapV2Router02')!.address,
        wrappedZkLtc: approvedPublicDeployment('WrappedZkLTC')!.address,
      }
    : { ...LITVM_COMPROMISED_LEGACY_DEPLOYMENTS },
) as Readonly<Record<keyof typeof LITVM_COMPROMISED_LEGACY_DEPLOYMENTS, LitvmContractAddress>>

export const POST_COMPROMISE_REPLACEMENTS_ACTIVE = false as boolean

/**
 * Governance has its own activation latch because replacing the application
 * contracts does not repair the independently compromised token/timelock role
 * graph. All three addresses and exact runtime hashes must be reviewed and
 * source-pinned together before any governance write can be re-enabled.
 */
export const POST_COMPROMISE_GOVERNANCE_ACTIVE = false as boolean
export const APPROVED_GOVERNANCE_TOKEN_ADDRESS = approvedPublicDeployment('LitGovToken')?.address
export const APPROVED_GOVERNOR_ADDRESS = approvedPublicDeployment('LitGovernor')?.address
export const APPROVED_GOVERNANCE_TIMELOCK_ADDRESS = approvedPublicDeployment('LitTimelock')?.address
export const APPROVED_GOVERNANCE_TOKEN_RUNTIME_CODE_HASH = approvedPublicDeployment('LitGovToken')?.runtimeCodeHash
export const APPROVED_GOVERNOR_RUNTIME_CODE_HASH = approvedPublicDeployment('LitGovernor')?.runtimeCodeHash
export const APPROVED_GOVERNANCE_TIMELOCK_RUNTIME_CODE_HASH = approvedPublicDeployment('LitTimelock')?.runtimeCodeHash

/**
 * Retired deployments are kept only for historical discovery and recovery.
 * They must never be selected as paid-write targets by an environment value.
 */
export const LITVM_LEGACY_CONTRACTS = Object.freeze({
  iloFactory: '0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f',
  earlierIloFactory: '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB',
  uniswapConnector: '0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD',
} as const satisfies Record<string, LitvmContractAddress>)

const PUBLIC_REPLACEMENT_PINNED_LEGACY_RECOVERY = Object.freeze({
  addresses: Object.freeze({
    iloFactory: LITVM_LEGACY_CONTRACTS.earlierIloFactory.toLowerCase(),
    productionBuildIloFactory: LITVM_LEGACY_CONTRACTS.iloFactory.toLowerCase(),
    tokenFactory: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.tokenFactory.toLowerCase(),
    vestingFactory: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.vestingFactory.toLowerCase(),
    liquidityLocker: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.liquidityLocker.toLowerCase(),
    ledger: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.ledger.toLowerCase(),
    uniswapV2Factory: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.uniswapV2Factory.toLowerCase(),
    uniswapV2Router: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.uniswapV2Router.toLowerCase(),
    wrappedZkLtc: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.wrappedZkLtc.toLowerCase(),
    disperse: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.disperse.toLowerCase(),
    legacyConnector: LITVM_LEGACY_CONTRACTS.uniswapConnector.toLowerCase(),
    litGovToken: LITVM_COMPROMISED_LEGACY_GOVERNANCE.token.toLowerCase(),
    litGovernor: LITVM_COMPROMISED_LEGACY_GOVERNANCE.governor.toLowerCase(),
    litTimelock: LITVM_COMPROMISED_LEGACY_GOVERNANCE.timelock.toLowerCase(),
  }),
  runtimeCodeHashes: Object.freeze({
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
  }),
  iloFactoryProvenance: Object.freeze([
    Object.freeze({
      label: 'production-build-hidden-factory',
      address: LITVM_LEGACY_CONTRACTS.iloFactory.toLowerCase(),
      runtimeCodeHash: '0xed56b878c6c936b7a54c0fc501a87cd96dc185e8d0967759df88817a03bc2dd5',
      observedChildCount: '8330',
      observedOn: '2026-08-04',
    }),
    Object.freeze({
      label: 'canonical-legacy-factory',
      address: LITVM_LEGACY_CONTRACTS.earlierIloFactory.toLowerCase(),
      runtimeCodeHash: '0x9c52ccc3cf932eeff5f19c65d7055f9c8eaa50b68e64a1e1e6bafebaf0e81b9a',
      observedChildCount: '121',
      observedOn: '2026-08-04',
    }),
  ]),
})

export interface LegacyFactoryRecoveryDeployment {
  id: string
  label: string
  address: LitvmContractAddress
  retiredAtBlock: bigint
  runtimeCodeHash: RuntimeCodeHash
}

export interface LegacyDexRecoveryDeployment {
  id: string
  label: string
  factory: LitvmContractAddress
  router: LitvmContractAddress
  wrappedNative: LitvmContractAddress
  retiredAtBlock: bigint
  factoryRuntimeCodeHash: RuntimeCodeHash
  routerRuntimeCodeHash: RuntimeCodeHash
  wrappedNativeRuntimeCodeHash: RuntimeCodeHash
  /**
   * Every pair produced by this non-proxy factory has identical deployed
   * runtime bytecode. Recovery additionally re-derives the pair through
   * factory.getPair(tokenA, tokenB); a matching hash alone is never enough.
   */
  pairRuntimeCodeHash: RuntimeCodeHash
}

export interface LegacyIloRecoveryDeployment extends LegacyFactoryRecoveryDeployment {
  countAtProvisionalFloor: number
  runtimeCodeHash: RuntimeCodeHash
  childRuntimeCodeHash: RuntimeCodeHash
  connectorAddress?: LitvmContractAddress
  connectorRuntimeCodeHash?: RuntimeCodeHash
}

export interface LegacyVestingFactoryRecoveryDeployment extends LegacyFactoryRecoveryDeployment {
  childRuntimeCodeHashes: readonly RuntimeCodeHash[]
}

/**
 * Every known pre-containment ILO factory, source-pinned for discovery and
 * direct child recovery only. The counts are the two components of the
 * provisional 8,451 production continuity floor at block 36,723,038.
 */
export const LITVM_LEGACY_ILO_FACTORIES: readonly LegacyIloRecoveryDeployment[] = Object.freeze([
  {
    id: 'production-c9b',
    label: 'Production legacy ILO Factory',
    address: LITVM_LEGACY_CONTRACTS.iloFactory,
    retiredAtBlock: 36_723_038n,
    countAtProvisionalFloor: 8_330,
    runtimeCodeHash: '0xed56b878c6c936b7a54c0fc501a87cd96dc185e8d0967759df88817a03bc2dd5',
    childRuntimeCodeHash: '0xa89b7cc62a2d277f3019ec31316c4aac0f034684e191ee98b0bfdf00492eeb5f',
    connectorAddress: LITVM_LEGACY_CONTRACTS.uniswapConnector,
    connectorRuntimeCodeHash: '0xddb0ce4525768177261872afa458a433d0fb2a312d23325c46fabc29d398ed4e',
  },
  {
    id: 'earlier-a533',
    label: 'Earlier legacy ILO Factory',
    address: LITVM_LEGACY_CONTRACTS.earlierIloFactory,
    retiredAtBlock: 36_723_038n,
    countAtProvisionalFloor: 121,
    runtimeCodeHash: '0x9c52ccc3cf932eeff5f19c65d7055f9c8eaa50b68e64a1e1e6bafebaf0e81b9a',
    childRuntimeCodeHash: '0x8359d3e7011bea1f23fad4d454c093a32271b7e2b2078f190a0c0add87598fca',
  },
])

/**
 * Populate these arrays in the same reviewed change that replaces a current
 * deployment. Recovery UIs may read and withdraw from these targets, but new
 * approvals, deposits, swaps, and liquidity additions always use current only.
 */
export const LITVM_LEGACY_VESTING_FACTORIES: readonly LegacyVestingFactoryRecoveryDeployment[] = Object.freeze([
  {
    id: 'pre-containment-2026-08-04',
    label: 'Pre-containment VestingFactory',
    address: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.vestingFactory,
    retiredAtBlock: 36_723_038n,
    runtimeCodeHash: '0x96f1c281dcb7a5a69cb007f511067ac08cf39811fc1d5b92864fb3f455ed2e73',
    childRuntimeCodeHashes: Object.freeze([
      '0x1b19aa59a319db5cb492e8d8b2c7a02e639554a3aebfcc9ebefd2bd95ebcf1f9',
      '0xc0fccea1e1285b801b4112c0c689f6c2ee42636faf92979afbe89f55b46198a9',
    ] satisfies readonly RuntimeCodeHash[]),
  },
])
export const LITVM_LEGACY_LIQUIDITY_LOCKERS: readonly LegacyFactoryRecoveryDeployment[] = Object.freeze([
  {
    id: 'pre-containment-2026-08-04',
    label: 'Pre-containment LiquidityLocker',
    address: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.liquidityLocker,
    retiredAtBlock: 36_723_038n,
    runtimeCodeHash: '0xfa5c90c1aee9f3f2606cf1a04b3a4a742ac2950dbf09e0d2e67412d311786c8a',
  },
])
export const LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS: readonly LegacyDexRecoveryDeployment[] = Object.freeze([
  {
    id: 'pre-containment-2026-08-04',
    label: 'Pre-containment Lester DEX',
    factory: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.uniswapV2Factory,
    router: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.uniswapV2Router,
    wrappedNative: LITVM_COMPROMISED_LEGACY_DEPLOYMENTS.wrappedZkLtc,
    retiredAtBlock: 36_723_038n,
    factoryRuntimeCodeHash: '0xce41e64702f625a6e52ba7d0406293e089078d3e6bdaf68d7fa8587f951453ee',
    routerRuntimeCodeHash: '0x0bd1cb8135296ff81274635a526cf4bacb32aee80ea0938899ea64294e2bba8a',
    wrappedNativeRuntimeCodeHash: '0x8c18c51fd322d08ccd34df2b97420cc87b004e738da9363d35a38cc2be761b05',
    pairRuntimeCodeHash: '0x418843f01f93a550a3e425e6e1028f0ff8c16448fa3416c39505b9238722fcd4',
  },
])

export function getLegacyDexRecoveryDeployment(id: string): LegacyDexRecoveryDeployment | undefined {
  return LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS.find((deployment) => deployment.id === id)
}

/** First block included in the post-baseline activity delta for each target. */
export const LITVM_CURRENT_ACTIVITY_START_BLOCKS = Object.freeze({
  tokenFactory: APPROVED_PUBLIC_REPLACEMENT_PACKAGE
    ? BigInt(APPROVED_PUBLIC_REPLACEMENT_PACKAGE.activityCutover.throughBlock) + 1n
    : 36_723_039n,
  disperse: APPROVED_PUBLIC_REPLACEMENT_PACKAGE
    ? BigInt(APPROVED_PUBLIC_REPLACEMENT_PACKAGE.activityCutover.throughBlock) + 1n
    : 36_723_039n,
  ledger: APPROVED_PUBLIC_REPLACEMENT_PACKAGE
    ? BigInt(APPROVED_PUBLIC_REPLACEMENT_PACKAGE.activityCutover.throughBlock) + 1n
    : 36_723_039n,
  uniswapV2Factory: APPROVED_PUBLIC_REPLACEMENT_PACKAGE
    ? BigInt(APPROVED_PUBLIC_REPLACEMENT_PACKAGE.activityCutover.throughBlock) + 1n
    : 36_723_039n,
} as const)

/** Exact runtime fingerprints used by frontend transaction preflights. */
export const LITVM_CURRENT_RUNTIME_CODE_HASHES = Object.freeze(
  APPROVED_PUBLIC_REPLACEMENT_PACKAGE
    ? {
        tokenFactory: approvedPublicDeployment('TokenFactory')!.runtimeCodeHash,
        vestingFactory: approvedPublicDeployment('VestingFactory')!.runtimeCodeHash,
        liquidityLocker: approvedPublicDeployment('LiquidityLocker')!.runtimeCodeHash,
        disperse: approvedPublicDeployment('Disperse')!.runtimeCodeHash,
        ledger: approvedPublicDeployment('TheLedger')!.runtimeCodeHash,
        uniswapV2Factory: approvedPublicDeployment('UniswapV2Factory')!.runtimeCodeHash,
        uniswapV2Router: approvedPublicDeployment('UniswapV2Router02')!.runtimeCodeHash,
        uniswapV2Pair: APPROVED_PUBLIC_REPLACEMENT_PACKAGE.frontendRuntimeAttestations.uniswapV2Pair,
        wrappedZkLtc: approvedPublicDeployment('WrappedZkLTC')!.runtimeCodeHash,
      }
    : {
        tokenFactory: '0x5b3bb2e693021e2ab040b6bf248785eb627600bbec002e87c10e138521be1d9d',
        vestingFactory: '0x96f1c281dcb7a5a69cb007f511067ac08cf39811fc1d5b92864fb3f455ed2e73',
        liquidityLocker: '0xfa5c90c1aee9f3f2606cf1a04b3a4a742ac2950dbf09e0d2e67412d311786c8a',
        disperse: '0x0a002cb14450c22d20885e40fec35bc924e0229f91b7b359c926850b10548891',
        ledger: '0x5bfae473fddc1457d06edc1c5603f0217b0b3debdc34969abe1611b386fb4233',
        uniswapV2Factory: '0xce41e64702f625a6e52ba7d0406293e089078d3e6bdaf68d7fa8587f951453ee',
        uniswapV2Router: '0x0bd1cb8135296ff81274635a526cf4bacb32aee80ea0938899ea64294e2bba8a',
        uniswapV2Pair: '0x418843f01f93a550a3e425e6e1028f0ff8c16448fa3416c39505b9238722fcd4',
        wrappedZkLtc: '0x8c18c51fd322d08ccd34df2b97420cc87b004e738da9363d35a38cc2be761b05',
      },
) satisfies Readonly<Record<string, RuntimeCodeHash>>

/**
 * VestingWallet embeds schedule-specific constructor immutables. Legacy
 * deployments retain their observed exact hashes; a replacement generation is
 * authenticated by zero-normalising only the compiler-attested immutable byte
 * ranges before comparing the reviewed template hash.
 */
export const LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION: VestingChildRuntimeAttestation =
  APPROVED_PUBLIC_REPLACEMENT_PACKAGE
    ? Object.freeze({
        kind: 'immutable-template' as const,
        ...APPROVED_PUBLIC_REPLACEMENT_PACKAGE.frontendRuntimeAttestations.vestingWallet,
        immutableReferences: Object.freeze([
          ...APPROVED_PUBLIC_REPLACEMENT_PACKAGE.frontendRuntimeAttestations.vestingWallet.immutableReferences,
        ]),
      })
    : Object.freeze({
        kind: 'exact-runtime-hashes' as const,
        runtimeCodeHashes: Object.freeze([
          '0x1b19aa59a319db5cb492e8d8b2c7a02e639554a3aebfcc9ebefd2bd95ebcf1f9',
          '0xc0fccea1e1285b801b4112c0c689f6c2ee42636faf92979afbe89f55b46198a9',
        ] satisfies readonly RuntimeCodeHash[]),
      })

/** Exact legacy hashes retained for read-only compatibility and evidence. */
export const LITVM_CURRENT_VESTING_CHILD_RUNTIME_CODE_HASHES: readonly RuntimeCodeHash[] = Object.freeze(
  LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION.kind === 'exact-runtime-hashes'
    ? [...LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION.runtimeCodeHashes]
    : [],
)

/**
 * Backward-compatible aggregate for read-only provenance checks. The ILO entry
 * is intentionally the recovery-only legacy factory; creation remains disabled.
 */
export const LITVM_TESTNET_CONTRACTS = Object.freeze({
  iloFactory: LITVM_LEGACY_CONTRACTS.iloFactory,
  ...LITVM_CURRENT_CONTRACTS,
})

export const ILO_FACTORY_ADDRESS = LITVM_LEGACY_CONTRACTS.iloFactory
export const TOKEN_FACTORY_ADDRESS = LITVM_CURRENT_CONTRACTS.tokenFactory
export const VESTING_FACTORY_ADDRESS = LITVM_CURRENT_CONTRACTS.vestingFactory
export const LIQUIDITY_LOCKER_ADDRESS = LITVM_CURRENT_CONTRACTS.liquidityLocker
export const DISPERSE_ADDRESS = LITVM_CURRENT_CONTRACTS.disperse
export const LEDGER_ADDRESS = LITVM_CURRENT_CONTRACTS.ledger
export const UNISWAP_V2_FACTORY_ADDRESS = LITVM_CURRENT_CONTRACTS.uniswapV2Factory
export const UNISWAP_V2_ROUTER_ADDRESS = LITVM_CURRENT_CONTRACTS.uniswapV2Router
export const WRAPPED_ZKLTC_ADDRESS = LITVM_CURRENT_CONTRACTS.wrappedZkLtc
export const DISPERSE_RUNTIME_CODE_HASH = LITVM_CURRENT_RUNTIME_CODE_HASHES.disperse
export const VESTING_FACTORY_RUNTIME_CODE_HASH = LITVM_CURRENT_RUNTIME_CODE_HASHES.vestingFactory
export const LIQUIDITY_LOCKER_RUNTIME_CODE_HASH = LITVM_CURRENT_RUNTIME_CODE_HASHES.liquidityLocker
export const TOKEN_FACTORY_RUNTIME_CODE_HASH = LITVM_CURRENT_RUNTIME_CODE_HASHES.tokenFactory
export const LEDGER_RUNTIME_CODE_HASH = LITVM_CURRENT_RUNTIME_CODE_HASHES.ledger

export const RETIRED_COMPROMISED_CONTROLLER_ADDRESS = '0xdd221fbbcb0f6092afe51183d964aa89a968ee13' as const
export const REJECTED_JULY_TARGET_ADDRESS = '0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28' as const
export const DISPOSABLE_TESTNET_DISCLOSED_KEY_ADDRESS = '0x439945924515218061b644901a31aC4A6c00957c' as const
export const DISPOSABLE_TESTNET_FROZEN_AUTHORITY = '0x0000000000000000000000000000000000000001' as const
export const APPROVED_LESTER_CONTROLLER_ADDRESS = APPROVED_PUBLIC_REPLACEMENT_PACKAGE?.deploymentManifest.controller
export const APPROVED_LESTER_TREASURY_ADDRESS = APPROVED_PUBLIC_REPLACEMENT_PACKAGE?.deploymentManifest.treasury
// Derived only from the source-pinned approved production manifest package.
// The disclosed test-gas key and disposable manifest are rejected before any
// public address, hash, role, or activity start can be selected.
export const EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS = APPROVED_PUBLIC_REPLACEMENT_PACKAGE?.deploymentManifest.gasOnlyDeployer
export const LESTER_TREASURY_STATUS = 'no distinct approved post-compromise controller, treasury, and single-use gas EOA are source-pinned'

// The canonical ILO factory is retained for discovery and recovery only. A
// replacement must be audited and pinned here before the frontend can create
// another ILO; an environment override can never enable this paid write.
export const APPROVED_ILO_CREATION_FACTORY_ADDRESS = approvedPublicDeployment('ILOFactory')?.address
export const APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK = APPROVED_PUBLIC_REPLACEMENT_PACKAGE
  ? BigInt(APPROVED_PUBLIC_REPLACEMENT_PACKAGE.activityCutover.throughBlock) + 1n
  : undefined
export const APPROVED_ILO_CREATION_FACTORY_RUNTIME_CODE_HASH = approvedPublicDeployment('ILOFactory')?.runtimeCodeHash
export const APPROVED_ILO_CREATION_CHILD_RUNTIME_CODE_HASH =
  APPROVED_PUBLIC_REPLACEMENT_PACKAGE?.frontendRuntimeAttestations.iloChild
export const APPROVED_ILO_CREATION_CONNECTOR_ADDRESS = approvedPublicDeployment('UniSwapConnector')?.address
export const APPROVED_ILO_CREATION_CONNECTOR_RUNTIME_CODE_HASH =
  approvedPublicDeployment('UniSwapConnector')?.runtimeCodeHash

export const CONTRACT_TARGET_OVERRIDE_ENV_VARS = Object.freeze([
  'NEXT_PUBLIC_ILO_FACTORY_ADDRESS',
  'NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS',
  'NEXT_PUBLIC_VESTING_FACTORY_ADDRESS',
  'NEXT_PUBLIC_LIQUIDITY_LOCKER_ADDRESS',
  'NEXT_PUBLIC_DISPERSE_ADDRESS',
  'NEXT_PUBLIC_LEDGER_ADDRESS',
  'NEXT_PUBLIC_UNISWAP_V2_FACTORY_ADDRESS',
  'NEXT_PUBLIC_UNISWAP_V2_ROUTER_ADDRESS',
  'NEXT_PUBLIC_WRAPPED_ZKLTC_ADDRESS',
  'NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS',
  'NEXT_PUBLIC_GOVERNOR_ADDRESS',
  'NEXT_PUBLIC_GOVERNANCE_TIMELOCK_ADDRESS',
  'NEXT_PUBLIC_LITVM_RPC_URL',
] as const)

export function isValidContractAddress(address: string | undefined): address is LitvmContractAddress {
  return Boolean(address && address.toLowerCase() !== ZERO_ADDRESS && ADDRESS_PATTERN.test(address))
}

export function isCanonicalLitvmContract(address: string | undefined, canonicalAddress: string): boolean {
  return Boolean(address && address.toLowerCase() === canonicalAddress.toLowerCase())
}

export function isApprovedLesterTreasury(address: string | undefined): boolean {
  return Boolean(
    POST_COMPROMISE_REPLACEMENTS_ACTIVE &&
    address &&
    APPROVED_LESTER_TREASURY_ADDRESS &&
    isCanonicalLitvmContract(address, APPROVED_LESTER_TREASURY_ADDRESS),
  )
}

export function isApprovedLesterController(address: string | undefined): boolean {
  return Boolean(
    POST_COMPROMISE_REPLACEMENTS_ACTIVE &&
    address &&
    APPROVED_LESTER_CONTROLLER_ADDRESS &&
    isCanonicalLitvmContract(address, APPROVED_LESTER_CONTROLLER_ADDRESS),
  )
}

export function isApprovedIloCreationFactory(address: string | undefined): boolean {
  return Boolean(
    POST_COMPROMISE_REPLACEMENTS_ACTIVE &&
    address &&
    APPROVED_ILO_CREATION_FACTORY_ADDRESS &&
    isCanonicalLitvmContract(address, APPROVED_ILO_CREATION_FACTORY_ADDRESS) &&
    !LITVM_LEGACY_ILO_FACTORIES.some((deployment) => isCanonicalLitvmContract(address, deployment.address)),
  )
}

export function isApprovedGovernanceToken(address: string | undefined): boolean {
  return Boolean(
    POST_COMPROMISE_GOVERNANCE_ACTIVE &&
    address &&
    APPROVED_GOVERNANCE_TOKEN_ADDRESS &&
    isCanonicalLitvmContract(address, APPROVED_GOVERNANCE_TOKEN_ADDRESS),
  )
}

export function isApprovedGovernor(address: string | undefined): boolean {
  return Boolean(
    POST_COMPROMISE_GOVERNANCE_ACTIVE &&
    address &&
    APPROVED_GOVERNOR_ADDRESS &&
    isCanonicalLitvmContract(address, APPROVED_GOVERNOR_ADDRESS),
  )
}

export function isApprovedGovernanceTimelock(address: string | undefined): boolean {
  return Boolean(
    POST_COMPROMISE_GOVERNANCE_ACTIVE &&
    address &&
    APPROVED_GOVERNANCE_TIMELOCK_ADDRESS &&
    isCanonicalLitvmContract(address, APPROVED_GOVERNANCE_TIMELOCK_ADDRESS),
  )
}

export function hasApprovedGovernanceWritePath({
  token,
  governor,
  timelock,
}: {
  token: string | undefined
  governor: string | undefined
  timelock: string | undefined
}): boolean {
  return (
    isApprovedGovernanceToken(token) &&
    isApprovedGovernor(governor) &&
    isApprovedGovernanceTimelock(timelock)
  )
}

export function hasApprovedIloPaidWritePath({
  factory,
  treasury,
}: {
  factory: string | undefined
  treasury: string | undefined
}): boolean {
  return isApprovedIloCreationFactory(factory) && isApprovedLesterTreasury(treasury)
}

export function hasApprovedLesterControl({
  owner,
  treasury,
  treasuryRequired = false,
}: {
  owner: string | undefined
  treasury?: string
  treasuryRequired?: boolean
}): boolean {
  if (!isApprovedLesterController(owner)) return false
  return !treasuryRequired || isApprovedLesterTreasury(treasury)
}

export function requireContractAddresses(addresses: Record<string, string>): void {
  for (const [name, address] of Object.entries(addresses)) {
    if (!isValidContractAddress(address)) {
      throw new Error(`Canonical contract address is invalid: ${name}. Update the source-pinned LitVM deployment registry.`)
    }
  }
}

export function assertNoContractTargetEnvironmentOverrides(
  environment: Partial<Record<string, string | undefined>>,
): void {
  const configuredOverrides = CONTRACT_TARGET_OVERRIDE_ENV_VARS.filter((name) => Boolean(environment[name]?.trim()))
  if (configuredOverrides.length > 0) {
    throw new Error(
      `Contract targets are source-pinned. Remove forbidden deployment overrides: ${configuredOverrides.join(', ')}`,
    )
  }
}

export function assertCanonicalContractConfiguration(): void {
  requireContractAddresses({
    ...LITVM_CURRENT_CONTRACTS,
    ...LITVM_LEGACY_CONTRACTS,
    ...LITVM_COMPROMISED_LEGACY_GOVERNANCE,
    compromisedController: RETIRED_COMPROMISED_CONTROLLER_ADDRESS,
  })

  if (Boolean(APPROVED_PUBLIC_REPLACEMENT_PACKAGE) !== POST_COMPROMISE_REPLACEMENTS_ACTIVE) {
    throw new Error('Public replacement activation requires one source-pinned approved production manifest package.')
  }
  if (POST_COMPROMISE_REPLACEMENTS_ACTIVE) {
    const approvedPackage = APPROVED_PUBLIC_REPLACEMENT_PACKAGE
    if (!approvedPackage) {
      throw new Error('The approved production manifest package is missing.')
    }
    const manifest = approvedPackage.deploymentManifest
    if (
      manifest.kind !== 'lester-labs-post-compromise-replacement' ||
      manifest.schemaVersion !== 2 ||
      manifest.chainId !== '4441' ||
      manifest.deploymentProfile !== PUBLIC_REPLACEMENT_DEPLOYMENT_PROFILE
    ) {
      throw new Error('Only a schema-2 production-separated-authority manifest may activate the public frontend.')
    }
    for (const [label, hash] of [
      ['complete approval payload SHA-256', approvedPackage.approvalPayloadSha256],
      ['deployment manifest SHA-256', approvedPackage.deploymentManifestSha256],
      ['plan hash', manifest.planHash],
      ['build attestation SHA-256', manifest.buildAttestationSha256],
      ['activity cutover block hash', approvedPackage.activityCutover.blockHash],
      ['Uniswap V2 Pair runtime hash', approvedPackage.frontendRuntimeAttestations.uniswapV2Pair],
      ['ILO child runtime hash', approvedPackage.frontendRuntimeAttestations.iloChild],
    ] as const) {
      if (!CODE_HASH_PATTERN.test(hash)) {
        throw new Error(`The approved public replacement ${label} is invalid.`)
      }
    }
    if (!COMMIT_HASH_PATTERN.test(manifest.buildSourceCommit)) {
      throw new Error('The approved public replacement source commit must be a full lower-case Git hash.')
    }
    if (
      !Number.isSafeInteger(manifest.verifiedAtBlock) ||
      manifest.verifiedAtBlock <= 0 ||
      !Number.isSafeInteger(approvedPackage.activityCutover.throughBlock) ||
      approvedPackage.activityCutover.throughBlock < manifest.verifiedAtBlock
    ) {
      throw new Error('The public activity cutover must be a safe block at or after manifest verification.')
    }
    const expectedActivityTotalNames = [
      'tokensMinted',
      'walletsAirdropped',
      'presalesCreated',
      'swapsCompleted',
      'onChainMessages',
    ] as const
    const activityTotalNames = Object.keys(approvedPackage.activityCutover.totals)
    if (
      activityTotalNames.length !== expectedActivityTotalNames.length ||
      expectedActivityTotalNames.some(
        (name) => !Number.isSafeInteger(approvedPackage.activityCutover.totals[name]) ||
          approvedPackage.activityCutover.totals[name] < 0,
      )
    ) {
      throw new Error('The approved public replacement must bind exactly five non-negative activity totals.')
    }
    if (manifest.startingNonce !== 0) {
      throw new Error('The approved production manifest must use a fresh nonce-zero gas-only EOA.')
    }
    if (
      Object.keys(manifest.parameters).length !== Object.keys(PUBLIC_REPLACEMENT_PARAMETERS).length ||
      Object.entries(PUBLIC_REPLACEMENT_PARAMETERS).some(
        ([name, value]) => manifest.parameters[name] !== value,
      )
    ) throw new Error('The approved production manifest parameters differ from reviewed source.')
    if (JSON.stringify(manifest.legacyRecovery) !== JSON.stringify(PUBLIC_REPLACEMENT_PINNED_LEGACY_RECOVERY)) {
      throw new Error('The approved production manifest legacy-recovery inventory differs from reviewed source.')
    }
    if (
      !Number.isSafeInteger(manifest.confirmations) ||
      manifest.confirmations < 1 ||
      manifest.confirmations > 64
    ) throw new Error('The approved production manifest confirmation count is invalid.')

    if (manifest.deployments.length !== PUBLIC_REPLACEMENT_DEPLOYMENT_NAMES.length) {
      throw new Error('The approved public manifest must contain exactly thirteen replacement deployments.')
    }
    const deploymentNames = new Set<string>()
    const deploymentAddresses = new Set<string>()
    const deploymentTransactions = new Set<string>()
    let latestDeploymentBlock = 0
    for (let deploymentIndex = 0; deploymentIndex < manifest.deployments.length; deploymentIndex += 1) {
      const deployment = manifest.deployments[deploymentIndex]
      if (!PUBLIC_REPLACEMENT_DEPLOYMENT_NAMES.includes(deployment.name)) {
        throw new Error(`Unexpected public replacement deployment: ${String(deployment.name)}`)
      }
      if (deploymentNames.has(deployment.name)) {
        throw new Error(`Duplicate public replacement deployment: ${deployment.name}`)
      }
      if (
        deployment.name !== PUBLIC_REPLACEMENT_DEPLOYMENT_NAMES[deploymentIndex] ||
        deployment.artifact !== PUBLIC_REPLACEMENT_ARTIFACTS[deployment.name] ||
        deployment.nonce !== deploymentIndex ||
        !CODE_HASH_PATTERN.test(deployment.transactionHash) ||
        deployment.transactionHash.toLowerCase() === ZERO_HASH ||
        !Number.isSafeInteger(deployment.blockNumber) ||
        deployment.blockNumber <= 0 ||
        !Number.isSafeInteger(deployment.runtimeCodeBytes) ||
        deployment.runtimeCodeBytes <= 0 ||
        !isValidContractAddress(deployment.address) ||
        !CODE_HASH_PATTERN.test(deployment.runtimeCodeHash)
      ) {
        throw new Error(`The approved public ${deployment.name} deployment evidence is invalid.`)
      }
      latestDeploymentBlock = Math.max(latestDeploymentBlock, deployment.blockNumber)
      const normalizedDeploymentAddress = deployment.address.toLowerCase()
      const normalizedTransactionHash = deployment.transactionHash.toLowerCase()
      if (deploymentAddresses.has(normalizedDeploymentAddress)) {
        throw new Error(`The approved public manifest reuses deployment address ${deployment.address}.`)
      }
      if (deploymentTransactions.has(normalizedTransactionHash)) {
        throw new Error(`The approved public manifest reuses transaction ${deployment.transactionHash}.`)
      }
      deploymentNames.add(deployment.name)
      deploymentAddresses.add(normalizedDeploymentAddress)
      deploymentTransactions.add(normalizedTransactionHash)
    }
    for (const expectedName of PUBLIC_REPLACEMENT_DEPLOYMENT_NAMES) {
      if (!deploymentNames.has(expectedName)) {
        throw new Error(`The approved public manifest is missing ${expectedName}.`)
      }
    }
    for (const [role, address] of [
      ['controller', manifest.controller],
      ['treasury', manifest.treasury],
      ['gas-only deployer', manifest.gasOnlyDeployer],
    ] as const) {
      if (deploymentAddresses.has(address.toLowerCase())) {
        throw new Error(`The approved public ${role} must not be one of the replacement deployment addresses.`)
      }
    }
    if (
      manifest.verifiedAtBlock < latestDeploymentBlock ||
      manifest.verifiedAtBlock < latestDeploymentBlock + manifest.confirmations - 1
    ) throw new Error('The approved public manifest does not prove finality after every deployment.')
    assertDeterministicCreateDeploymentSequence(
      manifest.gasOnlyDeployer,
      manifest.startingNonce,
      manifest.deployments,
    )
    const vestingTemplate = approvedPackage.frontendRuntimeAttestations.vestingWallet
    if (
      !CODE_HASH_PATTERN.test(vestingTemplate.normalizedRuntimeCodeHash) ||
      !Number.isSafeInteger(vestingTemplate.runtimeCodeBytes) ||
      vestingTemplate.runtimeCodeBytes <= 0 ||
      vestingTemplate.immutableReferences.length === 0
    ) throw new Error('The approved public manifest package must pin a VestingWallet immutable template.')
    const immutableBytes = new Set<number>()
    for (const reference of vestingTemplate.immutableReferences) {
      if (
        !Number.isSafeInteger(reference.start) ||
        !Number.isSafeInteger(reference.length) ||
        reference.start < 0 ||
        reference.length <= 0 ||
        reference.start + reference.length > vestingTemplate.runtimeCodeBytes
      ) throw new Error('A VestingWallet immutable reference is outside the attested runtime template.')
      for (let offset = reference.start; offset < reference.start + reference.length; offset += 1) {
        if (immutableBytes.has(offset)) {
          throw new Error('VestingWallet immutable references must not overlap.')
        }
        immutableBytes.add(offset)
      }
    }
  }

  if (
    Boolean(APPROVED_LESTER_CONTROLLER_ADDRESS) !== POST_COMPROMISE_REPLACEMENTS_ACTIVE ||
    Boolean(APPROVED_LESTER_TREASURY_ADDRESS) !== POST_COMPROMISE_REPLACEMENTS_ACTIVE ||
    Boolean(EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS) !== POST_COMPROMISE_REPLACEMENTS_ACTIVE
  ) {
    throw new Error('Replacement activation and distinct controller/treasury/single-use-deployer addresses must be source-pinned together.')
  }
  if (POST_COMPROMISE_GOVERNANCE_ACTIVE !== POST_COMPROMISE_REPLACEMENTS_ACTIVE) {
    throw new Error('Application and governance replacement activation must use the same verified thirteen-contract manifest.')
  }


  const governanceAddresses = {
    token: APPROVED_GOVERNANCE_TOKEN_ADDRESS,
    governor: APPROVED_GOVERNOR_ADDRESS,
    timelock: APPROVED_GOVERNANCE_TIMELOCK_ADDRESS,
  }
  const governanceRuntimeCodeHashes = {
    token: APPROVED_GOVERNANCE_TOKEN_RUNTIME_CODE_HASH,
    governor: APPROVED_GOVERNOR_RUNTIME_CODE_HASH,
    timelock: APPROVED_GOVERNANCE_TIMELOCK_RUNTIME_CODE_HASH,
  }
  const governanceConfigurationComplete = (
    Object.values(governanceAddresses).every(Boolean) &&
    Object.values(governanceRuntimeCodeHashes).every(Boolean)
  )
  if (governanceConfigurationComplete !== POST_COMPROMISE_GOVERNANCE_ACTIVE) {
    throw new Error('Governance activation requires three distinct source-pinned addresses and exact runtime hashes.')
  }
  if (POST_COMPROMISE_GOVERNANCE_ACTIVE) {
    const approvedGovernanceAddresses = Object.entries(governanceAddresses)
      .filter((entry): entry is [string, LitvmContractAddress] => Boolean(entry[1]))
    for (const [role, address] of approvedGovernanceAddresses) {
      if (
        Object.values(LITVM_COMPROMISED_LEGACY_GOVERNANCE).some((legacy) => (
          isCanonicalLitvmContract(address, legacy)
        )) ||
        isCanonicalLitvmContract(address, RETIRED_COMPROMISED_CONTROLLER_ADDRESS) ||
        isCanonicalLitvmContract(address, REJECTED_JULY_TARGET_ADDRESS) ||
        isCanonicalLitvmContract(address, DISPOSABLE_TESTNET_DISCLOSED_KEY_ADDRESS)
      ) {
        throw new Error(`The retired governance/controller/disclosed-key address cannot be the replacement ${role}.`)
      }
    }
    for (let index = 0; index < approvedGovernanceAddresses.length; index += 1) {
      for (let comparison = index + 1; comparison < approvedGovernanceAddresses.length; comparison += 1) {
        if (isCanonicalLitvmContract(
          approvedGovernanceAddresses[index][1],
          approvedGovernanceAddresses[comparison][1],
        )) {
          throw new Error('Replacement governance token, Governor, and timelock addresses must be distinct.')
        }
      }
    }
    for (const [role, codeHash] of Object.entries(governanceRuntimeCodeHashes)) {
      if (!codeHash || !CODE_HASH_PATTERN.test(codeHash)) {
        throw new Error(`Replacement governance ${role} runtime code hash is invalid.`)
      }
    }
  }

  const replacementRoles = {
    controller: APPROVED_LESTER_CONTROLLER_ADDRESS,
    treasury: APPROVED_LESTER_TREASURY_ADDRESS,
    gasOnlyDeployer: EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS,
  }
  for (const [role, address] of Object.entries(replacementRoles)) {
    if (address && !isValidContractAddress(address)) {
      throw new Error(`The reviewed post-compromise ${role} is not a valid address.`)
    }
  }

  const rejectedAuthorityAddresses = [
    RETIRED_COMPROMISED_CONTROLLER_ADDRESS,
    REJECTED_JULY_TARGET_ADDRESS,
    DISPOSABLE_TESTNET_DISCLOSED_KEY_ADDRESS,
    DISPOSABLE_TESTNET_FROZEN_AUTHORITY,
    ...Object.values(LITVM_COMPROMISED_LEGACY_DEPLOYMENTS),
    ...Object.values(LITVM_COMPROMISED_LEGACY_GOVERNANCE),
    ...Object.values(LITVM_LEGACY_CONTRACTS),
  ] as const
  for (const [role, address] of Object.entries(replacementRoles)) {
    if (address && rejectedAuthorityAddresses.some((rejected) => isCanonicalLitvmContract(address, rejected))) {
      throw new Error(`The rejected compromised/disclosed-key address cannot be the post-compromise ${role}.`)
    }
  }

  const pinnedRoleAddresses = Object.entries(replacementRoles)
    .filter((entry): entry is [string, LitvmContractAddress] => Boolean(entry[1]))
  for (let index = 0; index < pinnedRoleAddresses.length; index += 1) {
    for (let comparison = index + 1; comparison < pinnedRoleAddresses.length; comparison += 1) {
      const [leftRole, leftAddress] = pinnedRoleAddresses[index]
      const [rightRole, rightAddress] = pinnedRoleAddresses[comparison]
      if (isCanonicalLitvmContract(leftAddress, rightAddress)) {
        throw new Error(`Post-compromise roles must be distinct: ${leftRole} overlaps ${rightRole}.`)
      }
    }
  }

  if (POST_COMPROMISE_REPLACEMENTS_ACTIVE) {
    const controlledTargets = [
      'tokenFactory',
      'vestingFactory',
      'liquidityLocker',
      'disperse',
      'ledger',
      'uniswapV2Factory',
      'uniswapV2Router',
      'wrappedZkLtc',
    ] as const
    for (const name of controlledTargets) {
      if (isCanonicalLitvmContract(LITVM_CURRENT_CONTRACTS[name], LITVM_COMPROMISED_LEGACY_DEPLOYMENTS[name])) {
        throw new Error(`Replacement activation is blocked because ${name} still points at the compromised deployment.`)
      }
    }
  }

  for (const [name, codeHash] of Object.entries(LITVM_CURRENT_RUNTIME_CODE_HASHES)) {
    if (!CODE_HASH_PATTERN.test(codeHash)) {
      throw new Error(`Canonical runtime code hash is invalid: ${name}.`)
    }
  }
  if (
    LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION.kind === 'exact-runtime-hashes' &&
    (
      LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION.runtimeCodeHashes.length === 0 ||
      LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION.runtimeCodeHashes.some(
        (codeHash) => !CODE_HASH_PATTERN.test(codeHash),
      )
    )
  ) throw new Error('Current VestingWallet recovery runtime hashes are invalid.')

  for (const [name, startBlock] of Object.entries(LITVM_CURRENT_ACTIVITY_START_BLOCKS)) {
    if (startBlock < 1n) {
      throw new Error(`Canonical activity start block is invalid: ${name}.`)
    }
  }

  if (
    APPROVED_ILO_CREATION_FACTORY_ADDRESS &&
    LITVM_LEGACY_ILO_FACTORIES.some((deployment) => (
      isCanonicalLitvmContract(APPROVED_ILO_CREATION_FACTORY_ADDRESS, deployment.address)
    ))
  ) {
    throw new Error('The recovery-only legacy ILO factory cannot be enabled for creation.')
  }


  if (APPROVED_ILO_CREATION_FACTORY_ADDRESS && !isValidContractAddress(APPROVED_ILO_CREATION_FACTORY_ADDRESS)) {
    throw new Error('The future ILO creation factory is not a valid address.')
  }

  if (Boolean(APPROVED_ILO_CREATION_FACTORY_ADDRESS) !== Boolean(APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK)) {
    throw new Error('A future ILO factory address and its first activity block must be pinned together.')
  }
  if (APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK !== undefined && APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK < 1n) {
    throw new Error('The future ILO factory activity start block must be positive.')
  }

  const approvedIloReplacementFields = [
    APPROVED_ILO_CREATION_FACTORY_ADDRESS,
    APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK,
    APPROVED_ILO_CREATION_FACTORY_RUNTIME_CODE_HASH,
    APPROVED_ILO_CREATION_CHILD_RUNTIME_CODE_HASH,
    APPROVED_ILO_CREATION_CONNECTOR_ADDRESS,
    APPROVED_ILO_CREATION_CONNECTOR_RUNTIME_CODE_HASH,
  ] as const
  const approvedIloReplacementComplete = approvedIloReplacementFields.every(Boolean)
  if (approvedIloReplacementFields.some(Boolean) && !approvedIloReplacementComplete) {
    throw new Error('Replacement ILO provenance cannot be partially source-pinned.')
  }
  if (approvedIloReplacementComplete !== POST_COMPROMISE_REPLACEMENTS_ACTIVE) {
    throw new Error('Replacement activation requires the ILO factory, child, and connector addresses/runtime hashes together.')
  }
  if (approvedIloReplacementComplete) {
    requireContractAddresses({
      approvedIloFactory: APPROVED_ILO_CREATION_FACTORY_ADDRESS!,
      approvedIloConnector: APPROVED_ILO_CREATION_CONNECTOR_ADDRESS!,
    })
    for (const codeHash of [
      APPROVED_ILO_CREATION_FACTORY_RUNTIME_CODE_HASH,
      APPROVED_ILO_CREATION_CHILD_RUNTIME_CODE_HASH,
      APPROVED_ILO_CREATION_CONNECTOR_RUNTIME_CODE_HASH,
    ]) {
      if (!codeHash || !CODE_HASH_PATTERN.test(codeHash)) {
        throw new Error('Replacement ILO runtime hashes must be exact source-pinned keccak256 values.')
      }
    }
    if (
      isCanonicalLitvmContract(APPROVED_ILO_CREATION_FACTORY_ADDRESS, APPROVED_ILO_CREATION_CONNECTOR_ADDRESS!) ||
      LITVM_LEGACY_ILO_FACTORIES.some((legacy) => (
        isCanonicalLitvmContract(APPROVED_ILO_CREATION_FACTORY_ADDRESS, legacy.address)
      )) ||
      isCanonicalLitvmContract(APPROVED_ILO_CREATION_CONNECTOR_ADDRESS, LITVM_LEGACY_CONTRACTS.uniswapConnector)
    ) {
      throw new Error('Replacement ILO factory and connector must be distinct from each other and every retired ILO route.')
    }
  }

  const legacyIloFactoryAddresses = new Set<string>()
  let provisionalIloCount = 0
  for (const deployment of LITVM_LEGACY_ILO_FACTORIES) {
    requireContractAddresses({ [`legacy ILO factory ${deployment.id}`]: deployment.address })
    const normalized = deployment.address.toLowerCase()
    if (legacyIloFactoryAddresses.has(normalized)) {
      throw new Error(`Legacy ILO factory ${deployment.id} duplicates another recovery source.`)
    }
    legacyIloFactoryAddresses.add(normalized)
    if (!Number.isSafeInteger(deployment.countAtProvisionalFloor) || deployment.countAtProvisionalFloor < 0) {
      throw new Error(`Legacy ILO factory ${deployment.id} has an invalid provisional count.`)
    }
    provisionalIloCount += deployment.countAtProvisionalFloor
    if (!CODE_HASH_PATTERN.test(deployment.runtimeCodeHash)) {
      throw new Error(`Legacy ILO factory ${deployment.id} has an invalid runtime code hash.`)
    }
    if (!CODE_HASH_PATTERN.test(deployment.childRuntimeCodeHash)) {
      throw new Error(`Legacy ILO factory ${deployment.id} has an invalid child runtime code hash.`)
    }
    if (Boolean(deployment.connectorAddress) !== Boolean(deployment.connectorRuntimeCodeHash)) {
      throw new Error(`Legacy ILO factory ${deployment.id} must pin connector address and runtime together.`)
    }
    if (deployment.connectorAddress) {
      requireContractAddresses({ [`legacy ILO connector ${deployment.id}`]: deployment.connectorAddress })
    }
    if (deployment.connectorRuntimeCodeHash && !CODE_HASH_PATTERN.test(deployment.connectorRuntimeCodeHash)) {
      throw new Error(`Legacy ILO factory ${deployment.id} has an invalid connector runtime code hash.`)
    }
  }
  if (provisionalIloCount !== 8_451) {
    throw new Error('Legacy ILO recovery sources must reconcile to the provisional production floor of 8,451.')
  }

  for (const deployment of LITVM_LEGACY_VESTING_FACTORIES) {
    requireContractAddresses({ [`legacy vesting factory ${deployment.id}`]: deployment.address })
    if (
      POST_COMPROMISE_REPLACEMENTS_ACTIVE &&
      isCanonicalLitvmContract(deployment.address, LITVM_CURRENT_CONTRACTS.vestingFactory)
    ) {
      throw new Error(`Legacy vesting factory ${deployment.id} duplicates the current write target.`)
    }
    if (
      deployment.childRuntimeCodeHashes.length === 0 ||
      deployment.childRuntimeCodeHashes.some((codeHash) => !CODE_HASH_PATTERN.test(codeHash))
    ) {
      throw new Error(`Legacy vesting factory ${deployment.id} has invalid child runtime hashes.`)
    }
  }

  for (const deployment of LITVM_LEGACY_LIQUIDITY_LOCKERS) {
    requireContractAddresses({ [`legacy liquidity locker ${deployment.id}`]: deployment.address })
    if (
      POST_COMPROMISE_REPLACEMENTS_ACTIVE &&
      isCanonicalLitvmContract(deployment.address, LITVM_CURRENT_CONTRACTS.liquidityLocker)
    ) {
      throw new Error(`Legacy liquidity locker ${deployment.id} duplicates the current write target.`)
    }
    if (!CODE_HASH_PATTERN.test(deployment.runtimeCodeHash)) {
      throw new Error(`Legacy liquidity locker ${deployment.id} has an invalid runtime code hash.`)
    }
  }

  for (const deployment of LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS) {
    requireContractAddresses({
      [`legacy DEX factory ${deployment.id}`]: deployment.factory,
      [`legacy DEX router ${deployment.id}`]: deployment.router,
      [`legacy wrapped native ${deployment.id}`]: deployment.wrappedNative,
    })
    for (const codeHash of [
      deployment.factoryRuntimeCodeHash,
      deployment.routerRuntimeCodeHash,
      deployment.wrappedNativeRuntimeCodeHash,
      deployment.pairRuntimeCodeHash,
    ]) {
      if (!CODE_HASH_PATTERN.test(codeHash)) {
        throw new Error(`Legacy DEX recovery deployment ${deployment.id} has an invalid runtime code hash.`)
      }
    }
    if (
      POST_COMPROMISE_REPLACEMENTS_ACTIVE &&
      isCanonicalLitvmContract(deployment.factory, LITVM_CURRENT_CONTRACTS.uniswapV2Factory) ||
      POST_COMPROMISE_REPLACEMENTS_ACTIVE &&
      isCanonicalLitvmContract(deployment.router, LITVM_CURRENT_CONTRACTS.uniswapV2Router)
    ) {
      throw new Error(`Legacy DEX recovery deployment ${deployment.id} overlaps a current write target.`)
    }
  }
}

// This also fails server startup and static rendering outside the normal Next
// build entrypoint. next.config.ts separately rejects stale environment targets.
assertCanonicalContractConfiguration()
