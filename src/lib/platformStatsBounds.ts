export function selectNewestPairIndices(totalPairs: number, limit: number): bigint[] {
  const safeTotal = Math.max(0, Math.floor(totalPairs))
  const safeLimit = Math.max(0, Math.floor(limit))
  const count = Math.min(safeTotal, safeLimit)
  return Array.from({ length: count }, (_, offset) => BigInt(safeTotal - count + offset))
}

export function getBoundedStatsLogRange(fromBlock: bigint, latestBlock: bigint, maxBlocks: bigint) {
  const safeLatest = latestBlock < 0n ? 0n : latestBlock
  const safeFrom = fromBlock < 0n ? 0n : fromBlock > safeLatest ? safeLatest : fromBlock
  const safeMax = maxBlocks < 1n ? 1n : maxBlocks
  const scannedFromBlock = safeLatest - safeFrom + 1n > safeMax
    ? safeLatest - safeMax + 1n
    : safeFrom

  return {
    requestedFromBlock: safeFrom,
    scannedFromBlock,
    toBlock: safeLatest,
    truncated: scannedFromBlock > safeFrom,
  }
}

export function getAuditedCounterBaseline(value: number, auditBlock: bigint) {
  return {
    value: Math.max(0, Math.floor(value)),
    auditBlock,
    note: `Audited through block ${auditBlock.toString()}; unauthenticated event lookalikes are excluded.`,
  }
}

export function sumCompleteCounts(counts: readonly (number | null)[]): number | null {
  if (counts.some((count) => count === null || !Number.isFinite(count))) return null
  return counts.reduce<number>((total, count) => total + (count ?? 0), 0)
}

export function applyCounterFloor(value: number, floor: number) {
  const safeFloor = Number.isFinite(floor) ? Math.max(0, floor) : 0
  const validValue = Number.isFinite(value) ? Math.max(0, value) : null
  if (validValue === null || validValue < safeFloor) {
    return { value: safeFloor, floorApplied: true }
  }
  return { value: validValue, floorApplied: false }
}

export function describeSwapCoverage(input: {
  scannedPairs: number
  totalPairs: number
  pairEnumerationCapped: boolean
  pairResolutionIncomplete: boolean
  logWindowCapped: boolean
  logCountCapped: boolean
}) {
  const limitations: string[] = []
  if (input.pairEnumerationCapped) {
    limitations.push(`Pair enumeration is capped at the newest ${input.scannedPairs} of ${input.totalPairs} factory pairs.`)
  }
  if (input.pairResolutionIncomplete) {
    limitations.push('One or more enumerated pair addresses could not be validated.')
  }
  if (input.logWindowCapped) {
    limitations.push('Swap logs are limited to the newest configured block window.')
  }
  if (input.logCountCapped) {
    limitations.push('Swap log counting stopped at the configured event cap.')
  }

  return limitations.length > 0
    ? `${limitations.join(' ')} Result is partial.`
    : 'Canonical factory pairs and requested swap logs are fully covered.'
}
