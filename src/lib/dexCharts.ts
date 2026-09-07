export interface ReservePriceInput {
  baseTokenAddress: string
  token0Address: string
  token1Address: string
  reserve0: bigint
  reserve1: bigint
  token0Decimals: number
  token1Decimals: number
}

export interface PriceHistoryPoint {
  time: string
  price: number
}

export const UNISWAP_V2_SYNC_TOPIC = '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1'

export function parseEvmAddress(value: unknown): `0x${string}` | null {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? value as `0x${string}`
    : null
}

export function parsePairReserves(value: unknown): readonly [bigint, bigint, number] | null {
  return Array.isArray(value)
    && typeof value[0] === 'bigint'
    && typeof value[1] === 'bigint'
    && typeof value[2] === 'number'
    ? value as unknown as readonly [bigint, bigint, number]
    : null
}

export function getNextPairScanCount(
  currentCount: number,
  totalPairs: number,
  pageSize: number,
  maxPairs: number,
): number {
  const safeTotal = Math.max(0, Math.floor(totalPairs))
  const safeCurrent = Math.max(0, Math.floor(currentCount))
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const safeMax = Math.max(0, Math.floor(maxPairs))
  return Math.min(safeTotal, safeMax, safeCurrent + safePageSize)
}

function bigintToNumber(value: bigint, decimals: number) {
  const denominator = 10 ** decimals
  return Number(value) / denominator
}

export function calculateTokenPriceInQuote(input: ReservePriceInput): number | null {
  const base = input.baseTokenAddress.toLowerCase()
  const token0 = input.token0Address.toLowerCase()
  const token1 = input.token1Address.toLowerCase()
  const reserve0 = bigintToNumber(input.reserve0, input.token0Decimals)
  const reserve1 = bigintToNumber(input.reserve1, input.token1Decimals)

  if (reserve0 <= 0 || reserve1 <= 0) return null
  if (base === token0) return reserve1 / reserve0
  if (base === token1) return reserve0 / reserve1
  return null
}

export function getPairDisplaySymbol(baseSymbol: string, quoteSymbol: string): string {
  return `${baseSymbol} / ${quoteSymbol}`
}

/** Reserve quantities are comparable only when they share the same quote asset. */
export function rankWithinQuote<T extends { quote: { address: string } }>(markets: readonly T[], quoteAddress: string, liquidity: (market: T) => number): T[] {
  return markets.filter((market) => market.quote.address.toLowerCase() === quoteAddress.toLowerCase())
    .filter((market) => Number.isFinite(liquidity(market)) && liquidity(market) > 0)
    .sort((a, b) => liquidity(b) - liquidity(a))
}

export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0'
  if (value === 0) return '$0'
  if (Math.abs(value) < 0.01) return `$${value.toPrecision(2)}`
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
}

/** Keep integer precision until token decimals are applied for display. */
export function underlyingLPAmount(balance: bigint, reserve: bigint, supply: bigint): bigint {
  if (balance < 0n || reserve < 0n || supply <= 0n || balance > supply) throw new Error('Invalid pool balance.')
  return balance * reserve / supply
}
