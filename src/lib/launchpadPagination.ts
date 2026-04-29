export function getRecentWindowIndices(totalCount: number, visibleCount: number): bigint[] {
  const safeTotal = Math.max(0, Math.floor(totalCount))
  const safeVisible = Math.max(0, Math.min(safeTotal, Math.floor(visibleCount)))

  return Array.from({ length: safeVisible }, (_, offset) => BigInt(safeTotal - 1 - offset))
}
