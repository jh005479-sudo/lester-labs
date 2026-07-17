import { readContract } from '@wagmi/core'
import { zeroAddress } from 'viem'
import { UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI, UNISWAP_V2_ROUTER_ABI } from '@/config/abis'
import { litvm } from '@/config/chains'
import {
  LITVM_TESTNET_CONTRACTS,
  UNISWAP_V2_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_ADDRESS,
  WRAPPED_ZKLTC_ADDRESS,
} from '@/config/contracts'
import { wagmiConfig } from '@/config/wagmi'
import {
  assertCanonicalPair,
  assertCanonicalRouterRuntime,
  hasCanonicalDexTargets,
  type DexTargets,
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

export async function attestFreshDexRuntime(): Promise<void> {
  const [routerFactory, routerWrappedNative] = await Promise.all([
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
  ])

  assertCanonicalRouterRuntime(
    configuredDexTargets,
    canonicalDexTargets,
    routerFactory as string,
    routerWrappedNative as string,
  )
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
): Promise<FreshPairState | null> {
  const pairAddress = await readContract(wagmiConfig, {
    address: configuredDexTargets.factory,
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

  const [pairToken0, pairToken1, reserves, totalSupply] = await Promise.all([
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
  ])

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
