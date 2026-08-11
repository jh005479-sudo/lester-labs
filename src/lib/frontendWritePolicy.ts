import {
  APPROVED_GOVERNANCE_TIMELOCK_ADDRESS,
  APPROVED_GOVERNANCE_TOKEN_ADDRESS,
  APPROVED_GOVERNOR_ADDRESS,
  APPROVED_ILO_CREATION_CHILD_RUNTIME_CODE_HASH,
  APPROVED_ILO_CREATION_CONNECTOR_ADDRESS,
  APPROVED_ILO_CREATION_CONNECTOR_RUNTIME_CODE_HASH,
  APPROVED_ILO_CREATION_FACTORY_ADDRESS,
  APPROVED_ILO_CREATION_FACTORY_RUNTIME_CODE_HASH,
  APPROVED_GOVERNANCE_TIMELOCK_RUNTIME_CODE_HASH,
  APPROVED_GOVERNANCE_TOKEN_RUNTIME_CODE_HASH,
  APPROVED_GOVERNOR_RUNTIME_CODE_HASH,
  LITVM_COMPROMISED_LEGACY_DEPLOYMENTS,
  LITVM_COMPROMISED_LEGACY_GOVERNANCE,
  LITVM_CURRENT_CONTRACTS,
  LITVM_CURRENT_RUNTIME_CODE_HASHES,
  LITVM_LEGACY_CONTRACTS,
  LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS,
  LITVM_LEGACY_ILO_FACTORIES,
  LITVM_LEGACY_LIQUIDITY_LOCKERS,
  POST_COMPROMISE_GOVERNANCE_ACTIVE,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
  isCanonicalLitvmContract,
  isValidContractAddress,
  type RuntimeCodeHash,
} from '../config/contracts.ts'

export interface FrontendWriteIntent {
  address?: unknown
  functionName?: unknown
  args?: unknown
  value?: unknown
}

export interface RuntimeAttestationRequirement {
  address: `0x${string}`
  label: string
  /** Undefined means that non-empty bytecode is required for a user-selected token. */
  expectedRuntimeCodeHash?: RuntimeCodeHash
}

export interface FrontendWriteDecision {
  runtimeAttestations: readonly RuntimeAttestationRequirement[]
  dexPairAttestations?: readonly {
    tokenA: `0x${string}`
    tokenB: `0x${string}`
    allowMissing: boolean
  }[]
  iloProvenance?: StandardIloChildProvenanceClaim
  iloProvenanceRole?: 'any' | 'owner'
  attestApprovedIloFactoryRouting?: boolean
}

export interface StandardIloChildProvenanceClaim {
  kind: 'current-ilo-child'
  child: `0x${string}`
  sourceFactory: `0x${string}`
}

export type StandardWriteProvenanceClaim = StandardIloChildProvenanceClaim

export type RecoveryWriteProvenanceClaim =
  | {
      kind: 'locker'
      sourceLocker: `0x${string}`
      lockId: bigint
    }
  | {
      kind: 'vesting-wallet'
      sourceFactory: `0x${string}`
      child: `0x${string}`
      creationTxHash: `0x${string}`
      beneficiary: `0x${string}`
      token: `0x${string}`
    }
  | {
      kind: 'ilo-child'
      sourceFactory: `0x${string}`
      child: `0x${string}`
      role: 'claimant' | 'owner'
    }
  | {
      kind: 'wrapped-native'
      deploymentId: 'current' | string
      wrappedNative: `0x${string}`
    }
  | {
      kind: 'dex-liquidity'
      deploymentId: 'current' | string
      pair: `0x${string}`
      router: `0x${string}`
      tokenA: `0x${string}`
      tokenB: `0x${string}`
    }

interface ApprovedIloConfiguration {
  factory?: `0x${string}`
  factoryRuntimeCodeHash?: RuntimeCodeHash
  childRuntimeCodeHash?: RuntimeCodeHash
  connector?: `0x${string}`
  connectorRuntimeCodeHash?: RuntimeCodeHash
}

export interface FrontendWritePolicyConfiguration {
  replacementsActive: boolean
  governanceActive: boolean
  nowSeconds: bigint
  contracts: {
    tokenFactory: `0x${string}`
    vestingFactory: `0x${string}`
    liquidityLocker: `0x${string}`
    disperse: `0x${string}`
    ledger: `0x${string}`
    uniswapV2Factory: `0x${string}`
    uniswapV2Router: `0x${string}`
    wrappedZkLtc: `0x${string}`
  }
  runtimeCodeHashes: {
    tokenFactory: RuntimeCodeHash
    vestingFactory: RuntimeCodeHash
    liquidityLocker: RuntimeCodeHash
    disperse: RuntimeCodeHash
    ledger: RuntimeCodeHash
    uniswapV2Factory: RuntimeCodeHash
    uniswapV2Router: RuntimeCodeHash
    uniswapV2Pair: RuntimeCodeHash
    wrappedZkLtc: RuntimeCodeHash
  }
  approvedIlo: ApprovedIloConfiguration
  governance: {
    token?: `0x${string}`
    governor?: `0x${string}`
    timelock?: `0x${string}`
    tokenRuntimeCodeHash?: RuntimeCodeHash
    governorRuntimeCodeHash?: RuntimeCodeHash
    timelockRuntimeCodeHash?: RuntimeCodeHash
  }
  retiredTargets: readonly string[]
}

const MAX_UINT256 = (1n << 256n) - 1n
const MAX_FRONTEND_TOKEN_AMOUNT = (1n << 192n) - 1n
const MAX_FRONTEND_NATIVE_VALUE = 1_000_000_000n * 10n ** 18n
const MAX_PROTOCOL_FEE_VALUE = 10n ** 17n // every reviewed paid factory caps its fee at 0.1 native token
const MAX_DEADLINE_WINDOW = 2n * 60n * 60n
const MAX_LOCK_WINDOW = 100n * 365n * 24n * 60n * 60n
const MAX_ILO_LOCK_WINDOW = 10n * 365n * 24n * 60n * 60n
const MAX_BATCH_RECIPIENTS = 200
const MAX_WHITELIST_RECIPIENTS = 200
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/
const HEX_BYTES_PATTERN = /^0x(?:[0-9a-fA-F]{2})*$/

const RETIRED_DIRECT_TARGETS = Object.freeze([
  ...Object.values(LITVM_COMPROMISED_LEGACY_DEPLOYMENTS),
  ...Object.values(LITVM_COMPROMISED_LEGACY_GOVERNANCE),
  ...Object.values(LITVM_LEGACY_CONTRACTS),
  ...LITVM_LEGACY_ILO_FACTORIES.map((deployment) => deployment.address),
  ...LITVM_LEGACY_LIQUIDITY_LOCKERS.map((deployment) => deployment.address),
  ...LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS.flatMap((deployment) => [
    deployment.factory,
    deployment.router,
    deployment.wrappedNative,
  ]),
])

export function sourcePinnedFrontendWritePolicyConfiguration(
  nowSeconds = BigInt(Math.floor(Date.now() / 1_000)),
): FrontendWritePolicyConfiguration {
  return {
    replacementsActive: POST_COMPROMISE_REPLACEMENTS_ACTIVE,
    governanceActive: POST_COMPROMISE_GOVERNANCE_ACTIVE,
    nowSeconds,
    contracts: LITVM_CURRENT_CONTRACTS,
    runtimeCodeHashes: LITVM_CURRENT_RUNTIME_CODE_HASHES,
    approvedIlo: {
      factory: APPROVED_ILO_CREATION_FACTORY_ADDRESS,
      factoryRuntimeCodeHash: APPROVED_ILO_CREATION_FACTORY_RUNTIME_CODE_HASH,
      childRuntimeCodeHash: APPROVED_ILO_CREATION_CHILD_RUNTIME_CODE_HASH,
      connector: APPROVED_ILO_CREATION_CONNECTOR_ADDRESS,
      connectorRuntimeCodeHash: APPROVED_ILO_CREATION_CONNECTOR_RUNTIME_CODE_HASH,
    },
    governance: {
      token: APPROVED_GOVERNANCE_TOKEN_ADDRESS,
      governor: APPROVED_GOVERNOR_ADDRESS,
      timelock: APPROVED_GOVERNANCE_TIMELOCK_ADDRESS,
      tokenRuntimeCodeHash: APPROVED_GOVERNANCE_TOKEN_RUNTIME_CODE_HASH,
      governorRuntimeCodeHash: APPROVED_GOVERNOR_RUNTIME_CODE_HASH,
      timelockRuntimeCodeHash: APPROVED_GOVERNANCE_TIMELOCK_RUNTIME_CODE_HASH,
    },
    retiredTargets: RETIRED_DIRECT_TARGETS,
  }
}

function asAddress(value: unknown): `0x${string}` | undefined {
  return typeof value === 'string' && isValidContractAddress(value) ? value : undefined
}

function asFunctionName(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArgs(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function asNativeValue(value: unknown): bigint | undefined {
  if (value === undefined) return 0n
  if (typeof value === 'bigint') return value >= 0n ? value : undefined
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  return undefined
}

function matches(address: string | undefined, expected: string | undefined): boolean {
  return Boolean(address && expected && isCanonicalLitvmContract(address, expected))
}

function matchesAny(address: string | undefined, candidates: readonly string[]): boolean {
  return Boolean(address && candidates.some((candidate) => isCanonicalLitvmContract(address, candidate)))
}

function requireAddress(value: unknown, label: string): `0x${string}` {
  const address = asAddress(value)
  if (!address) throw new Error(`${label} must be a non-zero address.`)
  return address
}

function requireAmount(value: unknown, label: string, { allowZero = false } = {}): bigint {
  if (
    typeof value !== 'bigint' ||
    value < 0n ||
    (!allowZero && value === 0n) ||
    value > MAX_FRONTEND_TOKEN_AMOUNT
  ) {
    throw new Error(`${label} must be a ${allowZero ? 'non-negative' : 'positive'} bounded integer amount.`)
  }
  return value
}

function requireNoNativeValue(value: unknown): void {
  if (asNativeValue(value) !== 0n) throw new Error('This transaction type cannot send native value.')
}

function requireProtocolFeeValue(value: unknown): bigint {
  const amount = asNativeValue(value)
  if (amount === undefined || amount > MAX_PROTOCOL_FEE_VALUE) {
    throw new Error('The protocol fee value is outside the reviewed 0.1-native-token bound.')
  }
  return amount
}

function requirePositiveNativeValue(value: unknown): bigint {
  const amount = asNativeValue(value)
  if (amount === undefined || amount <= 0n || amount > MAX_FRONTEND_NATIVE_VALUE) {
    throw new Error('Native value must be positive and within the frontend safety bound.')
  }
  return amount
}

function requireDeadline(value: unknown, configuration: FrontendWritePolicyConfiguration): bigint {
  if (
    typeof value !== 'bigint' ||
    value <= configuration.nowSeconds ||
    value > configuration.nowSeconds + MAX_DEADLINE_WINDOW
  ) {
    throw new Error('The transaction deadline must be within the next two hours.')
  }
  return value
}

function requireRecoveryDeadline(value: unknown): bigint {
  const nowSeconds = BigInt(Math.floor(Date.now() / 1_000))
  if (typeof value !== 'bigint' || value <= nowSeconds || value > nowSeconds + MAX_DEADLINE_WINDOW) {
    throw new Error('Recovery deadline must be within the next two hours.')
  }
  return value
}

function requireConnectedAccount(account: string | undefined): `0x${string}` {
  return requireAddress(account, 'Connected wallet')
}

function requireConnectedRecipient(value: unknown, account: string): `0x${string}` {
  const recipient = requireAddress(value, 'Transaction recipient')
  if (!isCanonicalLitvmContract(recipient, account)) {
    throw new Error('Transaction proceeds must be sent to the connected wallet.')
  }
  return recipient
}

function exactRuntime(
  address: `0x${string}`,
  expectedRuntimeCodeHash: RuntimeCodeHash | undefined,
  label: string,
): RuntimeAttestationRequirement {
  if (!expectedRuntimeCodeHash) throw new Error(`${label} has no source-pinned runtime hash.`)
  return { address, expectedRuntimeCodeHash, label }
}

function selectedTokenRuntime(address: `0x${string}`, label = 'selected ERC-20 token'): RuntimeAttestationRequirement {
  return { address, label }
}

function requireDistinctTokenPath(value: unknown): readonly `0x${string}`[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    throw new Error('Swap path must contain two to four token addresses.')
  }
  const path = value.map((entry, index) => requireAddress(entry, `Swap path entry ${index + 1}`))
  for (let index = 1; index < path.length; index += 1) {
    if (matches(path[index - 1], path[index])) throw new Error('Adjacent swap path tokens must be distinct.')
  }
  return path
}

function requireRecipientsAndValues(recipientsValue: unknown, valuesValue: unknown): {
  recipients: readonly `0x${string}`[]
  values: readonly bigint[]
  total: bigint
} {
  if (!Array.isArray(recipientsValue) || !Array.isArray(valuesValue)) {
    throw new Error('Recipient and value batches must be arrays.')
  }
  if (
    recipientsValue.length === 0 ||
    recipientsValue.length > MAX_BATCH_RECIPIENTS ||
    recipientsValue.length !== valuesValue.length
  ) {
    throw new Error('Recipient and value batches must have the same bounded non-zero length.')
  }
  const recipients = recipientsValue.map((entry, index) => requireAddress(entry, `Recipient ${index + 1}`))
  const values = valuesValue.map((entry, index) => requireAmount(entry, `Recipient amount ${index + 1}`))
  const total = values.reduce((sum, entry) => sum + entry, 0n)
  if (total > MAX_FRONTEND_TOKEN_AMOUNT) throw new Error('The batch total exceeds the frontend safety bound.')
  return { recipients, values, total }
}

function decision(...runtimeAttestations: RuntimeAttestationRequirement[]): FrontendWriteDecision {
  return { runtimeAttestations }
}

function adjacentPairs(path: readonly `0x${string}`[]): readonly {
  tokenA: `0x${string}`
  tokenB: `0x${string}`
  allowMissing: false
}[] {
  return path.slice(0, -1).map((tokenA, index) => ({
    tokenA,
    tokenB: path[index + 1],
    allowMissing: false as const,
  }))
}

function requireApprovedIloConfiguration(configuration: FrontendWritePolicyConfiguration): Required<ApprovedIloConfiguration> {
  const { factory, factoryRuntimeCodeHash, childRuntimeCodeHash, connector, connectorRuntimeCodeHash } = configuration.approvedIlo
  if (!factory || !factoryRuntimeCodeHash || !childRuntimeCodeHash || !connector || !connectorRuntimeCodeHash) {
    throw new Error('Replacement ILO factory, child, and connector provenance is incomplete.')
  }
  return { factory, factoryRuntimeCodeHash, childRuntimeCodeHash, connector, connectorRuntimeCodeHash }
}

/**
 * Pure post-activation capability evaluator. It intentionally accepts an
 * injected configuration so tests exercise a synthetic active deployment even
 * while the production source registry remains in containment.
 */
export function evaluateStandardFrontendWrite(
  intent: FrontendWriteIntent,
  connectedAccount: string | undefined,
  provenance: StandardWriteProvenanceClaim | undefined,
  configuration: FrontendWritePolicyConfiguration,
): FrontendWriteDecision {
  if (!configuration.replacementsActive) {
    throw new Error('Ordinary frontend writes are disabled until the reviewed post-compromise deployment set is activated.')
  }

  const account = requireConnectedAccount(connectedAccount)
  const target = requireAddress(intent.address, 'Transaction target')
  const functionName = asFunctionName(intent.functionName)
  const args = asArgs(intent.args)
  if (matchesAny(target, configuration.retiredTargets)) {
    throw new Error('This write is blocked because its target is a retired pre-cutover deployment.')
  }

  const contracts = configuration.contracts
  const hashes = configuration.runtimeCodeHashes

  if (matches(target, contracts.tokenFactory) && functionName === 'createToken') {
    requireProtocolFeeValue(intent.value)
    if (
      args.length !== 7 ||
      typeof args[0] !== 'string' || args[0].trim().length === 0 || args[0].length > 64 ||
      typeof args[1] !== 'string' || args[1].trim().length === 0 || args[1].length > 16 ||
      typeof args[3] !== 'number' || !Number.isInteger(args[3]) || args[3] < 0 || args[3] > 18 ||
      args.slice(4).some((entry) => typeof entry !== 'boolean')
    ) throw new Error('Token creation arguments do not match the reviewed capability.')
    requireAmount(args[2], 'Initial token supply')
    return decision(exactRuntime(target, hashes.tokenFactory, 'TokenFactory'))
  }

  if (matches(target, contracts.ledger) && functionName === 'post') {
    const value = requirePositiveNativeValue(intent.value)
    if (value > MAX_PROTOCOL_FEE_VALUE) throw new Error('Ledger value exceeds its reviewed fee bound.')
    if (args.length !== 1 || typeof args[0] !== 'string' || !HEX_BYTES_PATTERN.test(args[0])) {
      throw new Error('Ledger message must be an encoded byte string.')
    }
    const byteLength = (args[0].length - 2) / 2
    if (byteLength < 1 || byteLength > 1_024) throw new Error('Ledger message must contain 1 to 1,024 bytes.')
    return decision(exactRuntime(target, hashes.ledger, 'TheLedger'))
  }

  if (matches(target, contracts.wrappedZkLtc) && functionName === 'deposit') {
    requirePositiveNativeValue(intent.value)
    if (args.length !== 0) throw new Error('Wrapped-native deposit cannot contain arguments.')
    return decision(exactRuntime(target, hashes.wrappedZkLtc, 'wrapped native token'))
  }

  if (matches(target, contracts.liquidityLocker) && functionName === 'lockLiquidity') {
    requireProtocolFeeValue(intent.value)
    if (args.length !== 4) throw new Error('Liquidity lock arguments do not match the reviewed capability.')
    const lpToken = requireAddress(args[0], 'LP token')
    requireAmount(args[1], 'LP token amount')
    if (
      typeof args[2] !== 'bigint' ||
      args[2] <= configuration.nowSeconds ||
      args[2] > configuration.nowSeconds + MAX_LOCK_WINDOW
    ) throw new Error('Liquidity unlock time must be in the future and within 100 years.')
    requireAddress(args[3], 'Liquidity withdrawer')
    return decision(
      exactRuntime(target, hashes.liquidityLocker, 'LiquidityLocker'),
      selectedTokenRuntime(lpToken, 'selected LP token'),
    )
  }

  if (matches(target, contracts.vestingFactory) && functionName === 'createVestingSchedule') {
    requireProtocolFeeValue(intent.value)
    if (args.length !== 7) throw new Error('Vesting creation arguments do not match the reviewed capability.')
    const token = requireAddress(args[0], 'Vesting token')
    requireAddress(args[1], 'Vesting beneficiary')
    requireAmount(args[2], 'Vesting amount')
    const start = requireAmount(args[3], 'Vesting start', { allowZero: true })
    const cliff = requireAmount(args[4], 'Vesting cliff', { allowZero: true })
    const duration = requireAmount(args[5], 'Vesting duration')
    if (cliff > duration || start > (1n << 64n) - 1n || duration > (1n << 64n) - 1n || typeof args[6] !== 'boolean') {
      throw new Error('Vesting times or revocability flag are outside the reviewed bounds.')
    }
    return decision(
      exactRuntime(target, hashes.vestingFactory, 'VestingFactory'),
      selectedTokenRuntime(token, 'selected vesting token'),
    )
  }

  if (matches(target, contracts.disperse) && functionName === 'disperseToken') {
    requireNoNativeValue(intent.value)
    if (args.length !== 3) throw new Error('Token distribution arguments do not match the reviewed capability.')
    const token = requireAddress(args[0], 'Distribution token')
    requireRecipientsAndValues(args[1], args[2])
    return decision(
      exactRuntime(target, hashes.disperse, 'Disperse'),
      selectedTokenRuntime(token, 'selected distribution token'),
    )
  }

  if (matches(target, contracts.disperse) && functionName === 'disperseEther') {
    if (args.length !== 2) throw new Error('Native distribution arguments do not match the reviewed capability.')
    const { total } = requireRecipientsAndValues(args[0], args[1])
    if (total > MAX_FRONTEND_NATIVE_VALUE) throw new Error('The native distribution total exceeds the frontend safety bound.')
    const value = asNativeValue(intent.value)
    if (value === undefined || value !== total) throw new Error('Native distribution value must equal the exact recipient total.')
    return decision(exactRuntime(target, hashes.disperse, 'Disperse'))
  }

  if (functionName === 'approve') {
    requireNoNativeValue(intent.value)
    if (args.length !== 2) throw new Error('Approval arguments do not match the reviewed capability.')
    const spender = requireAddress(args[0], 'Approval spender')
    requireAmount(args[1], 'Approval amount')
    const approvedSpenders = [
      contracts.liquidityLocker,
      contracts.vestingFactory,
      contracts.disperse,
      contracts.uniswapV2Router,
    ] as const
    if (!matchesAny(spender, approvedSpenders)) {
      throw new Error('Approval spender is not an exact source-pinned frontend capability.')
    }
    if (matchesAny(spender, configuration.retiredTargets)) {
      throw new Error('This approval is blocked because its spender is a retired pre-cutover deployment.')
    }
    const hash = matches(spender, contracts.liquidityLocker)
      ? hashes.liquidityLocker
      : matches(spender, contracts.vestingFactory)
        ? hashes.vestingFactory
        : matches(spender, contracts.disperse)
          ? hashes.disperse
          : hashes.uniswapV2Router
    return decision(
      selectedTokenRuntime(target),
      exactRuntime(spender, hash, 'approval spender'),
    )
  }

  if (matches(target, contracts.uniswapV2Router)) {
    const routerRuntime = exactRuntime(target, hashes.uniswapV2Router, 'UniswapV2Router')
    const factoryRuntime = exactRuntime(contracts.uniswapV2Factory, hashes.uniswapV2Factory, 'UniswapV2Factory')
    const wrappedRuntime = exactRuntime(contracts.wrappedZkLtc, hashes.wrappedZkLtc, 'wrapped native token')

    if (functionName === 'addLiquidity') {
      requireNoNativeValue(intent.value)
      if (args.length !== 8) throw new Error('Add-liquidity arguments do not match the reviewed capability.')
      const tokenA = requireAddress(args[0], 'Token A')
      const tokenB = requireAddress(args[1], 'Token B')
      if (matches(tokenA, tokenB)) throw new Error('Liquidity tokens must be distinct.')
      const desiredA = requireAmount(args[2], 'Desired token A amount')
      const desiredB = requireAmount(args[3], 'Desired token B amount')
      const minA = requireAmount(args[4], 'Minimum token A amount')
      const minB = requireAmount(args[5], 'Minimum token B amount')
      if (minA > desiredA || minB > desiredB) throw new Error('Liquidity minima cannot exceed desired amounts.')
      requireConnectedRecipient(args[6], account)
      requireDeadline(args[7], configuration)
      return {
        runtimeAttestations: [routerRuntime, factoryRuntime, wrappedRuntime, selectedTokenRuntime(tokenA), selectedTokenRuntime(tokenB)],
        dexPairAttestations: [{ tokenA, tokenB, allowMissing: true }],
      }
    }

    if (functionName === 'addLiquidityETH') {
      requirePositiveNativeValue(intent.value)
      if (args.length !== 6) throw new Error('Native add-liquidity arguments do not match the reviewed capability.')
      const token = requireAddress(args[0], 'Liquidity token')
      const desired = requireAmount(args[1], 'Desired token amount')
      const tokenMin = requireAmount(args[2], 'Minimum token amount')
      requireAmount(args[3], 'Minimum native amount')
      if (tokenMin > desired) throw new Error('Token minimum cannot exceed desired amount.')
      requireConnectedRecipient(args[4], account)
      requireDeadline(args[5], configuration)
      return {
        runtimeAttestations: [routerRuntime, factoryRuntime, wrappedRuntime, selectedTokenRuntime(token)],
        dexPairAttestations: [{ tokenA: token, tokenB: contracts.wrappedZkLtc, allowMissing: true }],
      }
    }

    if (functionName === 'swapExactETHForTokens') {
      requirePositiveNativeValue(intent.value)
      if (args.length !== 4) throw new Error('Native-input swap arguments do not match the reviewed capability.')
      requireAmount(args[0], 'Minimum swap output')
      const path = requireDistinctTokenPath(args[1])
      if (!matches(path[0], contracts.wrappedZkLtc)) throw new Error('Native-input swap path must begin with wrapped native token.')
      requireConnectedRecipient(args[2], account)
      requireDeadline(args[3], configuration)
      return {
        runtimeAttestations: [routerRuntime, factoryRuntime, wrappedRuntime, ...path.map((token) => selectedTokenRuntime(token))],
        dexPairAttestations: adjacentPairs(path),
      }
    }

    if (functionName === 'swapExactTokensForETH' || functionName === 'swapExactTokensForTokens') {
      requireNoNativeValue(intent.value)
      if (args.length !== 5) throw new Error('Token-input swap arguments do not match the reviewed capability.')
      requireAmount(args[0], 'Swap input amount')
      requireAmount(args[1], 'Minimum swap output')
      const path = requireDistinctTokenPath(args[2])
      if (functionName === 'swapExactTokensForETH' && !matches(path[path.length - 1], contracts.wrappedZkLtc)) {
        throw new Error('Native-output swap path must end with wrapped native token.')
      }
      requireConnectedRecipient(args[3], account)
      requireDeadline(args[4], configuration)
      return {
        runtimeAttestations: [routerRuntime, factoryRuntime, wrappedRuntime, ...path.map((token) => selectedTokenRuntime(token))],
        dexPairAttestations: adjacentPairs(path),
      }
    }
  }

  const ilo = requireApprovedIloConfiguration(configuration)
  if (matches(target, ilo.factory) && functionName === 'createILO') {
    requireProtocolFeeValue(intent.value)
    if (args.length !== 9) throw new Error('ILO creation arguments do not match the reviewed capability.')
    const token = requireAddress(args[0], 'ILO sale token')
    const softCap = requireAmount(args[1], 'ILO soft cap')
    const hardCap = requireAmount(args[2], 'ILO hard cap')
    requireAmount(args[3], 'ILO token price')
    const start = requireAmount(args[4], 'ILO start time')
    const end = requireAmount(args[5], 'ILO end time')
    if (hardCap < softCap || start >= end || end > configuration.nowSeconds + MAX_LOCK_WINDOW) {
      throw new Error('ILO caps or sale times are outside the reviewed bounds.')
    }
    if (typeof args[6] !== 'bigint' || args[6] < 5_000n || args[6] > 10_000n) {
      throw new Error('ILO liquidity basis points must be between 5,000 and 10,000.')
    }
    if (typeof args[7] !== 'bigint' || args[7] < 30n * 24n * 60n * 60n || args[7] > MAX_ILO_LOCK_WINDOW) {
      throw new Error('ILO LP lock duration is outside the reviewed range.')
    }
    if (typeof args[8] !== 'boolean') throw new Error('ILO whitelist flag must be boolean.')
    return {
      runtimeAttestations: [
        exactRuntime(target, ilo.factoryRuntimeCodeHash, 'ILOFactory'),
        exactRuntime(ilo.connector, ilo.connectorRuntimeCodeHash, 'UniSwapConnector'),
        exactRuntime(contracts.uniswapV2Router, hashes.uniswapV2Router, 'UniswapV2Router'),
        exactRuntime(contracts.uniswapV2Factory, hashes.uniswapV2Factory, 'UniswapV2Factory'),
        selectedTokenRuntime(token, 'ILO sale token'),
      ],
      attestApprovedIloFactoryRouting: true,
    }
  }

  const isIloChildCall = ['contribute', 'finalize', 'setWhitelist'].includes(functionName)
  const isIloTokenFunding = functionName === 'transfer' && args.length === 2
  if (isIloChildCall || isIloTokenFunding) {
    if (!provenance || provenance.kind !== 'current-ilo-child' || !matches(provenance.sourceFactory, ilo.factory)) {
      throw new Error('A source-pinned current ILO child provenance claim is required.')
    }
    const child = requireAddress(provenance.child, 'ILO child')
    if (isIloChildCall && !matches(target, child)) throw new Error('ILO write target does not match its provenance claim.')
    if (isIloTokenFunding && !matches(requireAddress(args[0], 'ILO funding recipient'), child)) {
      throw new Error('ILO token funding recipient does not match its provenance claim.')
    }
    if (functionName === 'contribute') requirePositiveNativeValue(intent.value)
    else requireNoNativeValue(intent.value)
    if (functionName === 'finalize' && args.length !== 0) throw new Error('ILO finalize cannot contain arguments.')
    if (functionName === 'setWhitelist') {
      if (!Array.isArray(args[0]) || args[0].length === 0 || args[0].length > MAX_WHITELIST_RECIPIENTS || typeof args[1] !== 'boolean') {
        throw new Error('ILO whitelist arguments do not match the reviewed capability.')
      }
      args[0].forEach((entry, index) => requireAddress(entry, `Whitelist address ${index + 1}`))
    }
    if (isIloTokenFunding) requireAmount(args[1], 'ILO token funding amount')
    return {
      runtimeAttestations: [
        exactRuntime(child, ilo.childRuntimeCodeHash, 'ILO child'),
        exactRuntime(ilo.factory, ilo.factoryRuntimeCodeHash, 'ILOFactory'),
        exactRuntime(ilo.connector, ilo.connectorRuntimeCodeHash, 'UniSwapConnector'),
        ...(isIloTokenFunding ? [selectedTokenRuntime(target, 'ILO sale token')] : []),
      ],
      iloProvenance: provenance,
      iloProvenanceRole: isIloTokenFunding || functionName === 'setWhitelist' ? 'owner' : 'any',
    }
  }

  if (configuration.governanceActive) {
    const governance = configuration.governance
    if (matches(target, governance.governor) && functionName === 'castVote') {
      requireNoNativeValue(intent.value)
      if (
        args.length !== 2 || typeof args[0] !== 'bigint' || args[0] < 0n || args[0] > MAX_UINT256 ||
        typeof args[1] !== 'number' || !Number.isInteger(args[1]) || args[1] < 0 || args[1] > 2
      ) throw new Error('Governance vote arguments do not match the reviewed capability.')
      return decision(exactRuntime(target, governance.governorRuntimeCodeHash, 'Governor'))
    }
    if (matches(target, governance.governor) && functionName === 'castVoteWithReason') {
      requireNoNativeValue(intent.value)
      if (
        args.length !== 3 || typeof args[0] !== 'bigint' || args[0] < 0n || args[0] > MAX_UINT256 ||
        typeof args[1] !== 'number' || !Number.isInteger(args[1]) || args[1] < 0 || args[1] > 2 ||
        typeof args[2] !== 'string' || args[2].length > 1_024
      ) throw new Error('Governance reasoned-vote arguments do not match the reviewed capability.')
      return decision(exactRuntime(target, governance.governorRuntimeCodeHash, 'Governor'))
    }
    if (matches(target, governance.governor) && functionName === 'propose') {
      requireNoNativeValue(intent.value)
      if (
        args.length !== 4 || !Array.isArray(args[0]) || !Array.isArray(args[1]) || !Array.isArray(args[2]) ||
        args[0].length === 0 || args[0].length > 32 || args[0].length !== args[1].length ||
        args[0].length !== args[2].length || typeof args[3] !== 'string' || args[3].length === 0 || args[3].length > 10_000
      ) throw new Error('Governance proposal arguments do not match the reviewed capability.')
      args[0].forEach((entry, index) => requireAddress(entry, `Proposal target ${index + 1}`))
      args[1].forEach((entry, index) => requireAmount(entry, `Proposal value ${index + 1}`, { allowZero: true }))
      if (args[2].some((entry) => typeof entry !== 'string' || !HEX_BYTES_PATTERN.test(entry) || entry.length > 131_074)) {
        throw new Error('Governance proposal calldata is malformed or too large.')
      }
      return decision(exactRuntime(target, governance.governorRuntimeCodeHash, 'Governor'))
    }
    if (matches(target, governance.token) && functionName === 'delegate') {
      requireNoNativeValue(intent.value)
      if (args.length !== 1) throw new Error('Governance delegation arguments do not match the reviewed capability.')
      requireAddress(args[0], 'Governance delegate')
      return decision(exactRuntime(target, governance.tokenRuntimeCodeHash, 'governance token'))
    }
  }

  throw new Error(`Standard frontend capability is not permitted: ${functionName || 'unknown function'}.`)
}

export function assertStandardFrontendWriteAllowed(
  intent: FrontendWriteIntent,
  connectedAccount?: string,
  provenance?: StandardWriteProvenanceClaim,
): FrontendWriteDecision {
  return evaluateStandardFrontendWrite(
    intent,
    connectedAccount,
    provenance,
    sourcePinnedFrontendWritePolicyConfiguration(),
  )
}

/**
 * Recovery permits only a small, value-free function set. The returned claim
 * still has to be freshly authenticated on-chain by the central safe-write
 * hook before a wallet prompt can be opened.
 */
export function assertRecoveryFrontendWriteAllowed(
  intent: FrontendWriteIntent,
  connectedAccount: string | undefined,
  provenance: RecoveryWriteProvenanceClaim | undefined,
): RecoveryWriteProvenanceClaim {
  requireConnectedAccount(connectedAccount)
  requireNoNativeValue(intent.value)
  if (!provenance) throw new Error('Recovery requires a centrally verified provenance claim.')

  const target = requireAddress(intent.address, 'Recovery target')
  const functionName = asFunctionName(intent.functionName)
  const args = asArgs(intent.args)

  if (provenance.kind === 'locker') {
    if (
      functionName === 'withdraw' &&
      matches(target, provenance.sourceLocker) &&
      args.length === 1 &&
      typeof args[0] === 'bigint' &&
      args[0] >= 0n &&
      args[0] === provenance.lockId
    ) return provenance
  }

  if (provenance.kind === 'wrapped-native') {
    if (
      functionName === 'withdraw' &&
      matches(target, provenance.wrappedNative) &&
      args.length === 1
    ) {
      requireAmount(args[0], 'Wrapped-native recovery amount')
      return provenance
    }
  }

  if (provenance.kind === 'dex-liquidity') {
    if (functionName === 'approve') {
      if (
        matches(target, provenance.pair) &&
        args.length === 2 &&
        matches(asAddress(args[0]), provenance.router)
      ) {
        requireAmount(args[1], 'LP recovery approval amount')
        return provenance
      }
    }
    if (functionName === 'removeLiquidity' && matches(target, provenance.router)) {
      if (args.length !== 7) throw new Error('Recovery remove-liquidity arguments do not match the reviewed capability.')
      const tokenA = requireAddress(args[0], 'Recovery token A')
      const tokenB = requireAddress(args[1], 'Recovery token B')
      if (
        !(matches(tokenA, provenance.tokenA) && matches(tokenB, provenance.tokenB)) &&
        !(matches(tokenA, provenance.tokenB) && matches(tokenB, provenance.tokenA))
      ) throw new Error('Recovery tokens do not match the factory-attested pair.')
      requireAmount(args[2], 'LP recovery amount')
      requireAmount(args[3], 'Minimum recovery token A')
      requireAmount(args[4], 'Minimum recovery token B')
      requireConnectedRecipient(args[5], connectedAccount!)
      requireRecoveryDeadline(args[6])
      return provenance
    }
    if (functionName === 'removeLiquidityETH' && matches(target, provenance.router)) {
      if (args.length !== 6) throw new Error('Recovery native remove-liquidity arguments do not match the reviewed capability.')
      const token = requireAddress(args[0], 'Recovery token')
      if (!matches(token, provenance.tokenA) && !matches(token, provenance.tokenB)) {
        throw new Error('Recovery token does not match the factory-attested pair.')
      }
      requireAmount(args[1], 'LP recovery amount')
      requireAmount(args[2], 'Minimum recovery token')
      requireAmount(args[3], 'Minimum recovery native token')
      requireConnectedRecipient(args[4], connectedAccount!)
      requireRecoveryDeadline(args[5])
      return provenance
    }
  }

  if (provenance.kind === 'vesting-wallet') {
    if (
      functionName === 'release' &&
      matches(target, provenance.child) &&
      args.length === 1 &&
      matches(asAddress(args[0]), provenance.token) &&
      TRANSACTION_HASH_PATTERN.test(provenance.creationTxHash)
    ) return provenance
  }

  if (provenance.kind === 'ilo-child' && matches(target, provenance.child) && args.length === 0) {
    if (provenance.role === 'claimant' && ['claim', 'refund'].includes(functionName)) return provenance
    if (
      provenance.role === 'owner' &&
      ['claimLP', 'sweepExcessETH', 'sweepExcessTokens', 'cancel'].includes(functionName)
    ) return provenance
  }

  throw new Error(`Recovery transaction shape or provenance is not permitted: ${functionName || 'unknown function'}.`)
}
