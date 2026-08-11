import { getBytecode, readContract } from 'wagmi/actions'
import { keccak256, zeroAddress } from 'viem'
import { UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI, UNISWAP_V2_ROUTER_ABI } from '@/config/abis'
import { litvm } from '@/config/chains'
import {
  APPROVED_LESTER_CONTROLLER_ADDRESS,
  APPROVED_LESTER_TREASURY_ADDRESS,
  LITVM_CURRENT_CONTRACTS,
  LITVM_TESTNET_CONTRACTS,
  LITVM_CURRENT_RUNTIME_CODE_HASHES,
  LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
  UNISWAP_V2_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_ADDRESS,
  WRAPPED_ZKLTC_ADDRESS,
  type RuntimeCodeHash,
} from '@/config/contracts'
import { wagmiConfig } from '@/config/wagmi'
import {
  assertCanonicalPair,
  assertCanonicalRouterRuntime,
  hasCanonicalDexTargets,
  type DexTargets,
  sameAddress,
} from '@/lib/dexTransactionSafety'

export const configuredDexTargets: DexTargets = {
  factory: UNISWAP_V2_FACTORY_ADDRESS,
  router: UNISWAP_V2_ROUTER_ADDRESS,
  wrappedNative: WRAPPED_ZKLTC_ADDRESS,
}

export const canonicalDexTargets: DexTargets = {
  factory: LITVM_TESTNET_CONTRACTS.uniswapV2Factory,
  router: LITVM_TESTNET_CONTRACTS.uniswapV2Router,
  wrappedNative: LITVM_TESTNET_CONTRACTS.wrappedZkLtc,
}

export const isCanonicalDexDeployment = hasCanonicalDexTargets(configuredDexTargets, canonicalDexTargets)

export type DexRecoverySource = DexTargets & {
  id: string
  label: string
  factoryRuntimeCodeHash: RuntimeCodeHash
  routerRuntimeCodeHash: RuntimeCodeHash
  wrappedNativeRuntimeCodeHash: RuntimeCodeHash
  pairRuntimeCodeHash: RuntimeCodeHash
}

export function getSourcePinnedDexRecoverySource(deploymentId: string): DexRecoverySource {
  if (deploymentId === 'current') {
    return {
      id: 'current',
      label: POST_COMPROMISE_REPLACEMENTS_ACTIVE
        ? 'Current source-pinned Lester DEX'
        : 'Pre-cutover Lester DEX — recovery only',
      factory: LITVM_CURRENT_CONTRACTS.uniswapV2Factory,
      router: LITVM_CURRENT_CONTRACTS.uniswapV2Router,
      wrappedNative: LITVM_CURRENT_CONTRACTS.wrappedZkLtc,
      factoryRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Factory,
      routerRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Router,
      wrappedNativeRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.wrappedZkLtc,
      pairRuntimeCodeHash: LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Pair,
    }
  }

  const legacy = LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS.find((deployment) => deployment.id === deploymentId)
  if (!legacy) throw new Error('The selected DEX is not in the source-pinned recovery registry.')
  return {
    id: legacy.id,
    label: legacy.label,
    factory: legacy.factory,
    router: legacy.router,
    wrappedNative: legacy.wrappedNative,
    factoryRuntimeCodeHash: legacy.factoryRuntimeCodeHash,
    routerRuntimeCodeHash: legacy.routerRuntimeCodeHash,
    wrappedNativeRuntimeCodeHash: legacy.wrappedNativeRuntimeCodeHash,
    pairRuntimeCodeHash: legacy.pairRuntimeCodeHash,
  }
}

async function attestDexRuntimeCode(source: DexRecoverySource = getSourcePinnedDexRecoverySource('current')): Promise<void> {
  const [factoryCode, routerCode, wrappedCode] = await Promise.all([
    getBytecode(wagmiConfig, { address: source.factory, chainId: litvm.id }),
    getBytecode(wagmiConfig, { address: source.router, chainId: litvm.id }),
    getBytecode(wagmiConfig, { address: source.wrappedNative, chainId: litvm.id }),
  ])
  const attestations = [
    ['factory', factoryCode, source.factoryRuntimeCodeHash],
    ['router', routerCode, source.routerRuntimeCodeHash],
    ['wrapped native token', wrappedCode, source.wrappedNativeRuntimeCodeHash],
  ] as const
  for (const [label, code, expectedHash] of attestations) {
    if (!code || code === '0x' || keccak256(code).toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(`DEX transactions are disabled because the source-pinned ${label} bytecode does not match.`)
    }
  }
}

export async function attestFreshDexRuntime(): Promise<void> {
  await attestDexRuntimeCode(getSourcePinnedDexRecoverySource('current'))
  const [routerFactory, routerWrappedNative, factoryFeeTo, factoryFeeToSetter] = await Promise.all([
    readContract(wagmiConfig, {
      address: configuredDexTargets.router,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: 'factory',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: configuredDexTargets.router,
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName: 'WETH',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: configuredDexTargets.factory,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: 'feeTo',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: configuredDexTargets.factory,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: 'feeToSetter',
      chainId: litvm.id,
    }),
  ])

  assertCanonicalRouterRuntime(
    configuredDexTargets,
    canonicalDexTargets,
    routerFactory as string,
    routerWrappedNative as string,
    factoryFeeTo as string,
    factoryFeeToSetter as string,
    APPROVED_LESTER_TREASURY_ADDRESS,
    APPROVED_LESTER_CONTROLLER_ADDRESS,
  )
}

/**
 * Remove-liquidity recovery authenticates only the source-pinned router tuple.
 * Mutable fee control is intentionally not an authorization dependency: an LP
 * holder must be able to exit a compromised deployment. No swap, pool creation,
 * liquidity addition, or token-input approval may use this weaker attestation.
 */
export async function attestFreshDexRecoveryRuntime(deploymentId = 'current'): Promise<void> {
  const source = getSourcePinnedDexRecoverySource(deploymentId)
  await attestDexRuntimeCode(source)

  const [routerFactory, routerWrappedNative] = await Promise.all([
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
  ])

  if (
    !sameAddress(routerFactory as string, source.factory) ||
    !sameAddress(routerWrappedNative as string, source.wrappedNative)
  ) {
    throw new Error('LP recovery is disabled because the source-pinned router runtime tuple does not match.')
  }
}

export type FreshPairState = {
  pairAddress: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  reserves: readonly [bigint, bigint, number]
  totalSupply: bigint
}

export async function readFreshCanonicalPair(
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  expectedPair?: `0x${string}`,
  deploymentId = 'current',
): Promise<FreshPairState | null> {
  const source = getSourcePinnedDexRecoverySource(deploymentId)
  const pairAddress = await readContract(wagmiConfig, {
    address: source.factory,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'getPair',
    args: [tokenA, tokenB],
    chainId: litvm.id,
  }) as `0x${string}`

  if (pairAddress.toLowerCase() === zeroAddress) {
    if (expectedPair) {
      throw new Error('The selected pair is no longer registered by the canonical LitVM factory.')
    }
    return null
  }

  const [pairToken0, pairToken1, reserves, totalSupply, pairCode] = await Promise.all([
    readContract(wagmiConfig, {
      address: pairAddress,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'token0',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: pairAddress,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'token1',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: pairAddress,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'getReserves',
      chainId: litvm.id,
    }),
    readContract(wagmiConfig, {
      address: pairAddress,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'totalSupply',
      chainId: litvm.id,
    }),
    getBytecode(wagmiConfig, { address: pairAddress, chainId: litvm.id }),
  ])

  if (!pairCode || pairCode === '0x' || keccak256(pairCode).toLowerCase() !== source.pairRuntimeCodeHash.toLowerCase()) {
    throw new Error('The selected pair runtime does not match the source-pinned DEX deployment.')
  }

  assertCanonicalPair(
    expectedPair ?? pairAddress,
    pairAddress,
    tokenA,
    tokenB,
    pairToken0 as string,
    pairToken1 as string,
  )

  return {
    pairAddress,
    token0: pairToken0 as `0x${string}`,
    token1: pairToken1 as `0x${string}`,
    reserves: reserves as readonly [bigint, bigint, number],
    totalSupply: totalSupply as bigint,
  }
}
