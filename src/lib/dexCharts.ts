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

export function buildReserveHistory(currentPrice: number | null, points = 24): PriceHistoryPoint[] {
  const safePrice = Number.isFinite(currentPrice) && currentPrice !== null ? currentPrice : 0
  const safePoints = Math.max(2, Math.floor(points))

  return Array.from({ length: safePoints }, (_, index) => {
    const progress = safePoints === 1 ? 1 : index / (safePoints - 1)
    const wave = Math.sin(progress * Math.PI * 2) * 0.018
    const drift = (progress - 1) * 0.026
    const price = safePrice > 0 ? safePrice * (1 + wave + drift) : 0
    return {
      time: `${safePoints - index - 1}h`,
      price: Number(price.toFixed(price < 0.01 ? 8 : 6)),
    }
  })
}

export function getPairDisplaySymbol(baseSymbol: string, quoteSymbol: string): string {
  return `${baseSymbol} / ${quoteSymbol}`
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
