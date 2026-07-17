export function getBoundedNewestBlockRange(
  requestedFromBlock: number,
  toBlock: number,
  maxBlocks: number,
) {
  const safeTo = Math.max(0, Math.floor(toBlock))
  const safeFrom = Math.max(0, Math.min(safeTo, Math.floor(requestedFromBlock)))
  const safeMax = Math.max(1, Math.floor(maxBlocks))
  const scannedFromBlock = Math.max(safeFrom, safeTo - safeMax + 1)

  return {
    requestedFromBlock: safeFrom,
    scannedFromBlock,
    toBlock: safeTo,
    truncated: scannedFromBlock > safeFrom,
  }
}

export function findByCanonicalAddress<T extends { address: string }>(
  items: readonly T[],
  address: string,
): T | undefined {
  const normalized = address.toLowerCase()
  return items.find((item) => item.address.toLowerCase() === normalized)
}

export function inferFactoryProvenance(item: {
  deployer?: string
  creationTx?: string
  creationBlock?: number
  factoryProvenance?: 'verified' | 'unknown'
}): 'verified' | 'unknown' {
  if (item.factoryProvenance) return item.factoryProvenance
  return /^0x[0-9a-fA-F]{40}$/.test(item.deployer ?? '')
    && /^0x[0-9a-fA-F]{64}$/.test(item.creationTx ?? '')
    && (item.creationBlock ?? 0) > 0
    ? 'verified'
    : 'unknown'
}
