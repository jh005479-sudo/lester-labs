export interface PoolDisplayTokenMeta {
  name: string
  symbol: string
  decimals: number
}

export interface PoolDisplayItem {
  pairAddress: `0x${string}` | string
  token0Address: `0x${string}` | string
  token1Address: `0x${string}` | string
  token0Meta: PoolDisplayTokenMeta
  token1Meta: PoolDisplayTokenMeta
  reserves: readonly [bigint, bigint, number] | readonly [bigint, bigint]
  totalSupply: bigint
  lpBalance: bigint
}

export function getRecentPoolIndices(totalCount: number, visibleCount: number): bigint[] {
  const safeTotal = Math.max(0, Math.floor(totalCount))
  const safeVisible = Math.max(0, Math.min(safeTotal, Math.floor(visibleCount)))
  return Array.from({ length: safeVisible }, (_, offset) => BigInt(safeTotal - 1 - offset))
}

export function getPoolSearchText(pool: PoolDisplayItem): string {
  return [
    pool.token0Meta.symbol,
    pool.token1Meta.symbol,
    pool.token0Meta.name,
    pool.token1Meta.name,
    pool.pairAddress,
    pool.token0Address,
    pool.token1Address,
  ].join(' ').toLowerCase()
}

export function filterPools<T extends PoolDisplayItem>(
  pools: T[],
  query: string,
  hidePositions: boolean,
): T[] {
  const normalized = query.trim().toLowerCase()

  return pools.filter((pool) => {
    if (hidePositions && pool.lpBalance > 0n && pool.totalSupply > 0n) return false
    if (!normalized) return true
    return getPoolSearchText(pool).includes(normalized)
  })
}
