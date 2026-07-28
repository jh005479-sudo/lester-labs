const BASIS_POINTS = 10_000n
const MAX_SLIPPAGE_BPS = 5_000n

type Address = `0x${string}`

export type DexTargets = {
  factory: Address
  router: Address
  wrappedNative: Address
}

export function sameAddress(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase())
}

export function hasCanonicalDexTargets(configured: DexTargets, canonical: DexTargets): boolean {
  return (
    sameAddress(configured.factory, canonical.factory) &&
    sameAddress(configured.router, canonical.router) &&
    sameAddress(configured.wrappedNative, canonical.wrappedNative)
  )
}

export function assertCanonicalRouterRuntime(
  configured: DexTargets,
  canonical: DexTargets,
  routerFactory: string | undefined,
  routerWrappedNative: string | undefined,
  factoryFeeTo: string | undefined,
  factoryFeeToSetter: string | undefined,
  approvedTreasury: string,
): void {
  if (!hasCanonicalDexTargets(configured, canonical)) {
    throw new Error('DEX transactions are disabled because the configured targets are not the canonical LitVM deployment.')
  }
  if (!sameAddress(routerFactory, canonical.factory) || !sameAddress(routerWrappedNative, canonical.wrappedNative)) {
    throw new Error('DEX transactions are disabled because the router runtime targets could not be authenticated.')
  }
  if (!sameAddress(factoryFeeTo, approvedTreasury) || !sameAddress(factoryFeeToSetter, approvedTreasury)) {
    throw new Error('DEX transactions are disabled because the factory fee controls are not assigned to the approved Lester treasury.')
  }
}

export function assertCanonicalPair(
  requestedPair: string,
  factoryPair: string,
  requestedTokenA: string,
  requestedTokenB: string,
  pairToken0: string,
  pairToken1: string,
): void {
  if (!sameAddress(requestedPair, factoryPair)) {
    throw new Error('The selected pair is not registered by the canonical LitVM factory.')
  }

  const requested = [requestedTokenA.toLowerCase(), requestedTokenB.toLowerCase()].sort()
  const actual = [pairToken0.toLowerCase(), pairToken1.toLowerCase()].sort()
  if (requested[0] !== actual[0] || requested[1] !== actual[1]) {
    throw new Error('The selected pair token metadata does not match the canonical factory pair.')
  }
}

export function validateSlippageBps(slippageBps: bigint): bigint {
  if (slippageBps <= 0n || slippageBps > MAX_SLIPPAGE_BPS) {
    throw new Error('Slippage tolerance must be greater than 0% and no more than 50%.')
  }
  return slippageBps
}

export function applySlippageMinimum(quotedAmount: bigint, slippageBps: bigint): bigint {
  validateSlippageBps(slippageBps)
  if (quotedAmount <= 0n) {
    throw new Error('A positive fresh quote is required before submitting this transaction.')
  }

  const minimum = (quotedAmount * (BASIS_POINTS - slippageBps)) / BASIS_POINTS
  if (minimum <= 0n) {
    throw new Error('The quoted amount is too small to produce a nonzero slippage minimum.')
  }
  return minimum
}

export function computeAddLiquidityMinimums({
  desiredA,
  desiredB,
  reserveA,
  reserveB,
  slippageBps,
}: {
  desiredA: bigint
  desiredB: bigint
  reserveA: bigint
  reserveB: bigint
  slippageBps: bigint
}): { amountAMin: bigint; amountBMin: bigint } {
  if (desiredA <= 0n || desiredB <= 0n) {
    throw new Error('Both desired liquidity amounts must be greater than zero.')
  }
  if ((reserveA === 0n) !== (reserveB === 0n)) {
    throw new Error('The pair returned an invalid one-sided reserve quote.')
  }

  if (reserveA === 0n && reserveB === 0n) {
    return {
      amountAMin: applySlippageMinimum(desiredA, slippageBps),
      amountBMin: applySlippageMinimum(desiredB, slippageBps),
    }
  }

  const optimalB = (desiredA * reserveB) / reserveA
  if (optimalB <= desiredB) {
    return {
      amountAMin: applySlippageMinimum(desiredA, slippageBps),
      amountBMin: applySlippageMinimum(optimalB, slippageBps),
    }
  }

  const optimalA = (desiredB * reserveA) / reserveB
  return {
    amountAMin: applySlippageMinimum(optimalA, slippageBps),
    amountBMin: applySlippageMinimum(desiredB, slippageBps),
  }
}

export function computeRemoveLiquidityMinimums({
  reserve0,
  reserve1,
  totalSupply,
  liquidity,
  slippageBps,
}: {
  reserve0: bigint
  reserve1: bigint
  totalSupply: bigint
  liquidity: bigint
  slippageBps: bigint
}): { expected0: bigint; expected1: bigint; amount0Min: bigint; amount1Min: bigint } {
  if (liquidity <= 0n || totalSupply <= 0n || liquidity > totalSupply) {
    throw new Error('A valid LP amount and fresh total supply are required before removing liquidity.')
  }

  const expected0 = (reserve0 * liquidity) / totalSupply
  const expected1 = (reserve1 * liquidity) / totalSupply
  return {
    expected0,
    expected1,
    amount0Min: applySlippageMinimum(expected0, slippageBps),
    amount1Min: applySlippageMinimum(expected1, slippageBps),
  }
}
