import type { Hex } from 'viem'

export function padUint256Topic(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, '0')}` as Hex
}

export function getDescendingLedgerIndexPage(startAfter: bigint, pageSize: number): bigint[] {
  if (startAfter <= 0n || pageSize <= 0) return []

  const safePageSize = Math.floor(pageSize)
  const available = startAfter > BigInt(safePageSize) ? safePageSize : Number(startAfter)

  return Array.from({ length: available }, (_, offset) => startAfter - 1n - BigInt(offset))
}
