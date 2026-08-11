import { getBlock, getBytecode, getTransactionReceipt, readContract } from 'wagmi/actions'
import { decodeEventLog, keccak256, zeroAddress } from 'viem'
import { UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI, UNISWAP_V2_ROUTER_ABI } from '@/config/abis'
import { litvm } from '@/config/chains'
import {
  LITVM_CURRENT_CONTRACTS,
  LITVM_CURRENT_RUNTIME_CODE_HASHES,
  LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION,
  LITVM_LEGACY_LIQUIDITY_LOCKERS,
  LITVM_LEGACY_VESTING_FACTORIES,
  isCanonicalLitvmContract,
  getLegacyDexRecoveryDeployment,
  type LitvmContractAddress,
  type RuntimeCodeHash,
  type VestingChildRuntimeAttestation,
} from '@/config/contracts'
import { wagmiConfig } from '@/config/wagmi'
import { LIQUIDITY_LOCKER_ABI } from '@/lib/contracts/liquidityLocker'
import { VESTING_FACTORY_ABI, VESTING_WALLET_RECOVERY_ABI } from '@/lib/contracts/tokenVesting'
import { isAttestedVestingWalletRuntime } from '@/lib/vestingRuntimeAttestation'
import {
  type FrontendWriteIntent,
  type RecoveryWriteProvenanceClaim,
  type RuntimeAttestationRequirement,
  type StandardWriteProvenanceClaim,
} from '@/lib/frontendWritePolicy'
import { attestApprovedIloFactoryRouting, attestIloProvenance } from '@/lib/launchpadProvenance'

async function requireRuntime(
  address: `0x${string}`,
  label: string,
  expectedRuntimeCodeHash?: RuntimeCodeHash,
): Promise<void> {
  const code = await getBytecode(wagmiConfig, { address, chainId: litvm.id })
  if (!code || code === '0x') throw new Error(`${label} has no runtime bytecode on LitVM.`)
  if (expectedRuntimeCodeHash && keccak256(code).toLowerCase() !== expectedRuntimeCodeHash.toLowerCase()) {
    throw new Error(`${label} runtime bytecode does not match the source-pinned deployment.`)
  }
}

export async function attestRuntimeRequirements(
  requirements: readonly RuntimeAttestationRequirement[],
): Promise<void> {
  const unique = new Map<string, RuntimeAttestationRequirement>()
  for (const requirement of requirements) {
    const key = requirement.address.toLowerCase()
    const existing = unique.get(key)
    if (
      existing?.expectedRuntimeCodeHash &&
      requirement.expectedRuntimeCodeHash &&
      existing.expectedRuntimeCodeHash.toLowerCase() !== requirement.expectedRuntimeCodeHash.toLowerCase()
    ) throw new Error('Conflicting source-pinned runtime requirements were produced for one transaction target.')
    if (!existing?.expectedRuntimeCodeHash || requirement.expectedRuntimeCodeHash) unique.set(key, requirement)
  }
  await Promise.all([...unique.values()].map((requirement) => (
    requireRuntime(requirement.address, requirement.label, requirement.expectedRuntimeCodeHash)
  )))
}

export async function attestCurrentDexPairGeneration(
  pairs: readonly {
    tokenA: `0x${string}`
    tokenB: `0x${string}`
    allowMissing: boolean
  }[] | undefined,
): Promise<void> {
  if (!pairs || pairs.length === 0) return
  for (const pairRequest of pairs) {
    const pair = await readContract(wagmiConfig, {
      address: LITVM_CURRENT_CONTRACTS.uniswapV2Factory,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: 'getPair',
      args: [pairRequest.tokenA, pairRequest.tokenB],
      chainId: litvm.id,
    }) as `0x${string}`
    if (pair.toLowerCase() === zeroAddress) {
      if (pairRequest.allowMissing) continue
      throw new Error('The requested swap path is not registered by the source-pinned DEX factory.')
    }
    const [token0, token1] = await Promise.all([
      readContract(wagmiConfig, {
        address: pair,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: 'token0',
        chainId: litvm.id,
      }),
      readContract(wagmiConfig, {
        address: pair,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: 'token1',
        chainId: litvm.id,
      }),
      requireRuntime(pair, 'factory-created DEX pair', LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Pair),
    ])
    const matchesRequestedTokens = (
      isCanonicalLitvmContract(token0, pairRequest.tokenA) &&
      isCanonicalLitvmContract(token1, pairRequest.tokenB)
    ) || (
      isCanonicalLitvmContract(token0, pairRequest.tokenB) &&
      isCanonicalLitvmContract(token1, pairRequest.tokenA)
    )
    if (!matchesRequestedTokens) {
      throw new Error('The registered DEX pair runtime does not bind the requested token addresses.')
    }
  }
}

export async function attestStandardWriteProvenance(
  provenance: StandardWriteProvenanceClaim | undefined,
  {
    attestApprovedFactoryRouting = false,
    connectedAccount,
    requiredIloRole = 'any',
  }: {
    attestApprovedFactoryRouting?: boolean
    connectedAccount?: `0x${string}`
    requiredIloRole?: 'any' | 'owner'
  } = {},
): Promise<void> {
  if (attestApprovedFactoryRouting) await attestApprovedIloFactoryRouting()
  if (!provenance) return
  const attested = await attestIloProvenance(provenance.child, {
    expectedSourceFactory: provenance.sourceFactory,
    requiredKind: 'current',
  })
  if (
    requiredIloRole === 'owner' &&
    (!connectedAccount || !isCanonicalLitvmContract(attested.owner, connectedAccount))
  ) throw new Error('This replacement ILO capability is owner-only and the connected wallet is not the on-chain owner.')
}

interface LockerSource {
  address: LitvmContractAddress
  runtimeCodeHash: RuntimeCodeHash
}

function resolveLockerSource(address: string): LockerSource | undefined {
  if (isCanonicalLitvmContract(address, LITVM_CURRENT_CONTRACTS.liquidityLocker)) {
    return {
      address: LITVM_CURRENT_CONTRACTS.liquidityLocker,
      runtimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.liquidityLocker,
    }
  }
  const legacy = LITVM_LEGACY_LIQUIDITY_LOCKERS.find((deployment) => (
    isCanonicalLitvmContract(address, deployment.address)
  ))
  return legacy && { address: legacy.address, runtimeCodeHash: legacy.runtimeCodeHash }
}

interface VestingSource {
  address: LitvmContractAddress
  runtimeCodeHash: RuntimeCodeHash
  childRuntimeAttestation: VestingChildRuntimeAttestation
}

function resolveVestingSource(address: string): VestingSource | undefined {
  if (isCanonicalLitvmContract(address, LITVM_CURRENT_CONTRACTS.vestingFactory)) {
    return {
      address: LITVM_CURRENT_CONTRACTS.vestingFactory,
      runtimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.vestingFactory,
      childRuntimeAttestation: LITVM_CURRENT_VESTING_CHILD_RUNTIME_ATTESTATION,
    }
  }
  const legacy = LITVM_LEGACY_VESTING_FACTORIES.find((deployment) => (
    isCanonicalLitvmContract(address, deployment.address)
  ))
  return legacy && {
    address: legacy.address,
    runtimeCodeHash: legacy.runtimeCodeHash,
    childRuntimeAttestation: {
      kind: 'exact-runtime-hashes',
      runtimeCodeHashes: legacy.childRuntimeCodeHashes,
    },
  }
}

interface DexSource {
  id: string
  factory: LitvmContractAddress
  router: LitvmContractAddress
  wrappedNative: LitvmContractAddress
  factoryRuntimeCodeHash: RuntimeCodeHash
  routerRuntimeCodeHash: RuntimeCodeHash
  wrappedNativeRuntimeCodeHash: RuntimeCodeHash
  pairRuntimeCodeHash: RuntimeCodeHash
}

function resolveDexSource(deploymentId: string): DexSource | undefined {
  if (deploymentId === 'current') {
    return {
      id: 'current',
      factory: LITVM_CURRENT_CONTRACTS.uniswapV2Factory,
      router: LITVM_CURRENT_CONTRACTS.uniswapV2Router,
      wrappedNative: LITVM_CURRENT_CONTRACTS.wrappedZkLtc,
      factoryRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Factory,
      routerRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Router,
      wrappedNativeRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.wrappedZkLtc,
      pairRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Pair,
    }
  }
  const legacy = getLegacyDexRecoveryDeployment(deploymentId)
  return legacy && { ...legacy }
}

async function attestLockerRecovery(
  provenance: Extract<RecoveryWriteProvenanceClaim, { kind: 'locker' }>,
  connectedAccount: `0x${string}`,
): Promise<void> {
  const source = resolveLockerSource(provenance.sourceLocker)
  if (!source || !isCanonicalLitvmContract(source.address, provenance.sourceLocker)) {
    throw new Error('The selected locker is not a source-pinned recovery deployment.')
  }
  const [lock, latestBlock] = await Promise.all([
    readContract(wagmiConfig, {
      address: source.address,
      abi: LIQUIDITY_LOCKER_ABI,
      functionName: 'getLock',
      args: [provenance.lockId],
      chainId: litvm.id,
    }) as Promise<readonly [`0x${string}`, bigint, bigint, `0x${string}`, boolean]>,
    getBlock(wagmiConfig, { chainId: litvm.id, blockTag: 'latest' }),
    requireRuntime(source.address, 'recovery LiquidityLocker', source.runtimeCodeHash),
  ])
  if (
    lock[0].toLowerCase() === zeroAddress ||
    lock[1] <= 0n ||
    lock[2] > latestBlock.timestamp ||
    lock[4] ||
    !isCanonicalLitvmContract(lock[3], connectedAccount)
  ) throw new Error('The lock is absent, withdrawn, or does not pay the connected wallet.')
}

async function attestVestingRecovery(
  provenance: Extract<RecoveryWriteProvenanceClaim, { kind: 'vesting-wallet' }>,
  connectedAccount: `0x${string}`,
): Promise<void> {
  const source = resolveVestingSource(provenance.sourceFactory)
  if (!source || !isCanonicalLitvmContract(source.address, provenance.sourceFactory)) {
    throw new Error('The selected VestingFactory is not a source-pinned recovery deployment.')
  }
  const [receipt, owner, childCode] = await Promise.all([
    getTransactionReceipt(wagmiConfig, { hash: provenance.creationTxHash, chainId: litvm.id }),
    readContract(wagmiConfig, {
      address: provenance.child,
      abi: VESTING_WALLET_RECOVERY_ABI,
      functionName: 'owner',
      chainId: litvm.id,
    }),
    getBytecode(wagmiConfig, { address: provenance.child, chainId: litvm.id }),
    requireRuntime(source.address, 'recovery VestingFactory', source.runtimeCodeHash),
    requireRuntime(provenance.token, 'vested token'),
  ])
  if (
    receipt.status !== 'success' ||
    !isCanonicalLitvmContract(receipt.to ?? undefined, source.address) ||
    !childCode ||
    childCode === '0x' ||
    !isAttestedVestingWalletRuntime(childCode, source.childRuntimeAttestation) ||
    !isCanonicalLitvmContract(owner, provenance.beneficiary) ||
    !isCanonicalLitvmContract(owner, connectedAccount)
  ) throw new Error('The VestingWallet receipt, runtime, or beneficiary provenance no longer matches.')

  let receiptMatches = false
  for (const log of receipt.logs) {
    if (!isCanonicalLitvmContract(log.address, source.address)) continue
    try {
      const decoded = decodeEventLog({
        abi: VESTING_FACTORY_ABI,
        eventName: 'VestingCreated',
        data: log.data,
        topics: log.topics,
        strict: true,
      })
      if (
        isCanonicalLitvmContract(decoded.args.vestingWallet, provenance.child) &&
        isCanonicalLitvmContract(decoded.args.beneficiary, provenance.beneficiary)
      ) {
        receiptMatches = true
        break
      }
    } catch {
      // Unrelated logs in the same receipt are not provenance evidence.
    }
  }
  if (!receiptMatches) throw new Error('The selected receipt does not create this VestingWallet for the connected beneficiary.')
}

async function attestWrappedRecovery(
  provenance: Extract<RecoveryWriteProvenanceClaim, { kind: 'wrapped-native' }>,
): Promise<void> {
  const source = resolveDexSource(provenance.deploymentId)
  if (!source || !isCanonicalLitvmContract(source.wrappedNative, provenance.wrappedNative)) {
    throw new Error('The selected wrapped-native token is not part of a source-pinned recovery deployment.')
  }
  await requireRuntime(source.wrappedNative, 'recovery wrapped-native token', source.wrappedNativeRuntimeCodeHash)
}

async function attestDexLiquidityRecovery(
  provenance: Extract<RecoveryWriteProvenanceClaim, { kind: 'dex-liquidity' }>,
): Promise<void> {
  const source = resolveDexSource(provenance.deploymentId)
  if (
    !source ||
    !isCanonicalLitvmContract(source.router, provenance.router) ||
    isCanonicalLitvmContract(provenance.tokenA, provenance.tokenB)
  ) throw new Error('The selected DEX recovery tuple is not source-pinned.')

  const [routerFactory, routerWrapped, registeredPair, pairToken0, pairToken1] = await Promise.all([
    readContract(wagmiConfig, {
      address: source.router,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: 'factory',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: source.router,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: 'WETH',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: source.factory,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: 'getPair',
      args: [provenance.tokenA, provenance.tokenB],
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: provenance.pair,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'token0',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: provenance.pair,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'token1',
      chainId: litvm.id,
    }),
    requireRuntime(source.factory, 'recovery DEX factory', source.factoryRuntimeCodeHash),
    requireRuntime(source.router, 'recovery DEX router', source.routerRuntimeCodeHash),
    requireRuntime(source.wrappedNative, 'recovery wrapped-native token', source.wrappedNativeRuntimeCodeHash),
    requireRuntime(provenance.pair, 'factory-created recovery pair', source.pairRuntimeCodeHash),
  ])
  const pairTokensMatch = (
    isCanonicalLitvmContract(pairToken0, provenance.tokenA) &&
    isCanonicalLitvmContract(pairToken1, provenance.tokenB)
  ) || (
    isCanonicalLitvmContract(pairToken0, provenance.tokenB) &&
    isCanonicalLitvmContract(pairToken1, provenance.tokenA)
  )
  if (
    !isCanonicalLitvmContract(routerFactory, source.factory) ||
    !isCanonicalLitvmContract(routerWrapped, source.wrappedNative) ||
    !isCanonicalLitvmContract(registeredPair, provenance.pair) ||
    !pairTokensMatch
  ) throw new Error('The pair is not generated and registered by the selected source-pinned DEX factory/router tuple.')
}

export async function attestRecoveryWriteProvenance(
  intent: FrontendWriteIntent,
  provenance: RecoveryWriteProvenanceClaim,
  connectedAccount: `0x${string}`,
): Promise<void> {
  if (provenance.kind === 'locker') return attestLockerRecovery(provenance, connectedAccount)
  if (provenance.kind === 'vesting-wallet') return attestVestingRecovery(provenance, connectedAccount)
  if (provenance.kind === 'wrapped-native') return attestWrappedRecovery(provenance)
  if (provenance.kind === 'dex-liquidity') {
    const source = resolveDexSource(provenance.deploymentId)
    if (!source) throw new Error('The selected DEX recovery deployment is not source-pinned.')
    if (intent.functionName === 'removeLiquidityETH') {
      const args = Array.isArray(intent.args) ? intent.args : []
      const token = typeof args[0] === 'string' ? args[0] : undefined
      const tokenAIsWrapped = isCanonicalLitvmContract(provenance.tokenA, source.wrappedNative)
      const tokenBIsWrapped = isCanonicalLitvmContract(provenance.tokenB, source.wrappedNative)
      const expectedToken = tokenAIsWrapped ? provenance.tokenB : provenance.tokenA
      if (
        tokenAIsWrapped === tokenBIsWrapped ||
        !isCanonicalLitvmContract(token, expectedToken)
      ) throw new Error('Native LP recovery requires exactly one source-pinned wrapped-native leg and the other pair token.')
    }
    return attestDexLiquidityRecovery(provenance)
  }
  if (provenance.kind === 'ilo-child') {
    const attested = await attestIloProvenance(provenance.child, {
      expectedSourceFactory: provenance.sourceFactory,
      requiredKind: 'any',
    })
    if (provenance.role === 'owner' && !isCanonicalLitvmContract(attested.owner, connectedAccount)) {
      throw new Error('This ILO recovery capability is owner-only and the connected wallet is not the on-chain owner.')
    }
  }
}
