import { ADDRESS_PATTERN, HASH_PATTERN } from './projectJourney.ts'

export const ACTIVITY_SOURCES = ['tokens', 'locks', 'vesting', 'presales', 'pairs', 'ledger'] as const
export type ActivitySource = typeof ACTIVITY_SOURCES[number]
export interface ActivityLog {
  address: `0x${string}`
  blockNumber: number
  blockHash: `0x${string}`
  transactionHash: `0x${string}`
  logIndex: number
  timestamp?: number
  topics: `0x${string}`[]
  data: `0x${string}`
}
export interface ActivityCursor { block_number?: number; index?: number; items_count?: number }
export interface ActivityPage {
  logs: ActivityLog[]
  nextCursor: ActivityCursor | null
  coverage: { source: string; contract: string; checkedAt: string; indexedThroughBlock: number; verification: 'archive'; complete: false }
}

export function parseActivityCursor(raw: string | null): ActivityCursor | undefined {
  if (!raw) return undefined
  if (raw.length > 200) throw new Error('Invalid page cursor.')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('Invalid page cursor.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid page cursor.')
  const cursor: ActivityCursor = {}
  for (const [key, number] of Object.entries(value)) {
    if (!['block_number', 'index', 'items_count'].includes(key) || !Number.isSafeInteger(number) || number < 0) throw new Error('Invalid page cursor.')
    cursor[key as keyof ActivityCursor] = number
  }
  return Object.keys(cursor).length ? cursor : undefined
}

/** Explorer pagination repeats the fixed topic; it must not change the source filter. */
export function normalizeArchiveCursor(value: unknown, topic: string): ActivityCursor | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid archive cursor.')
  const { topic: repeatedTopic, ...cursor } = value as Record<string, unknown>
  if (repeatedTopic !== undefined && repeatedTopic !== topic) throw new Error('The archive changed its activity filter.')
  return parseActivityCursor(JSON.stringify(cursor)) ?? null
}

export function normalizeActivityLog(raw: unknown, address: string, topic: string): ActivityLog | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const source = (item.address as { hash?: unknown } | undefined)?.hash
  if (typeof source !== 'string' || !ADDRESS_PATTERN.test(source) || source.toLowerCase() !== address.toLowerCase()) return null
  if (typeof item.transaction_hash !== 'string' || !HASH_PATTERN.test(item.transaction_hash)) return null
  if (!Number.isSafeInteger(item.block_number) || Number(item.block_number) < 0 || !Number.isSafeInteger(item.index) || Number(item.index) < 0) return null
  if (!Array.isArray(item.topics)) return null
  if (item.topics.length > 4 || item.topics.some((entry) => entry !== null && (typeof entry !== 'string' || !HASH_PATTERN.test(entry)))) return null
  // The explorer pads unused trailing topic slots with null. Reject gaps.
  const firstNull = item.topics.indexOf(null)
  if (firstNull >= 0 && item.topics.slice(firstNull).some((entry) => entry !== null)) return null
  const topics = item.topics.filter((value): value is `0x${string}` => typeof value === 'string' && HASH_PATTERN.test(value))
  if (topics.length > 4 || topics[0]?.toLowerCase() !== topic.toLowerCase()) return null
  if (typeof item.data !== 'string' || item.data.length > 32_770 || !/^0x(?:[a-fA-F0-9]{2})*$/.test(item.data)) return null
  if (typeof item.block_hash !== 'string' || !HASH_PATTERN.test(item.block_hash)) return null
  return { address: source as `0x${string}`, blockNumber: Number(item.block_number), blockHash: item.block_hash as `0x${string}`, transactionHash: item.transaction_hash as `0x${string}`, logIndex: Number(item.index), topics, data: item.data as `0x${string}` }
}
