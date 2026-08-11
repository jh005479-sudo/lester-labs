import type { Address, Hex } from 'viem'
import type { LedgerRpcLog } from './ledger.ts'

const HEX_PATTERN = /^0x[0-9a-fA-F]*$/
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
export const LEDGER_HISTORY_CURSOR_KEYS = ['block_number', 'index', 'items_count'] as const

export type LedgerHistoryCursor = Partial<Record<(typeof LEDGER_HISTORY_CURSOR_KEYS)[number], number>>

export interface LedgerHistoryPage {
  logs: LedgerRpcLog[]
  nextCursor: LedgerHistoryCursor | null
}

interface ExplorerLogItem {
  address?: { hash?: unknown }
  block_hash?: unknown
  block_number?: unknown
  data?: unknown
  index?: unknown
  topics?: unknown
  transaction_hash?: unknown
}

interface ExplorerLogResponse {
  items?: unknown
  next_page_params?: unknown
}

function isHex(value: unknown): value is Hex {
  return typeof value === 'string' && HEX_PATTERN.test(value) && value.length % 2 === 0
}

function isHash(value: unknown): value is Hex {
  return typeof value === 'string' && HASH_PATTERN.test(value)
}

function toQuantityHex(value: number): Hex {
  return `0x${value.toString(16)}` as Hex
}

function normalizeCursor(value: unknown): LedgerHistoryCursor | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const cursor: LedgerHistoryCursor = {}
  for (const key of LEDGER_HISTORY_CURSOR_KEYS) {
    const candidate = (value as Record<string, unknown>)[key]
    if (candidate === undefined) continue
    if (!Number.isSafeInteger(candidate) || (candidate as number) < 0) return null
    cursor[key] = candidate as number
  }

  return Object.keys(cursor).length ? cursor : null
}

function normalizeExplorerLog(
  value: unknown,
  expectedAddress: Address,
  expectedTopic: Hex,
): LedgerRpcLog | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const item = value as ExplorerLogItem
  const returnedAddress = item.address?.hash
  if (
    typeof returnedAddress !== 'string' ||
    !ADDRESS_PATTERN.test(returnedAddress) ||
    returnedAddress.toLowerCase() !== expectedAddress.toLowerCase()
  ) {
    return null
  }

  if (!Number.isSafeInteger(item.block_number) || (item.block_number as number) < 0) return null
  if (!Number.isSafeInteger(item.index) || (item.index as number) < 0) return null
  if (!isHex(item.data)) return null
  if (!Array.isArray(item.topics)) return null

  const topics = item.topics.filter((topic): topic is Hex => isHash(topic))
  if (!topics.length || topics[0].toLowerCase() !== expectedTopic.toLowerCase()) return null

  return {
    address: returnedAddress as Address,
    blockHash: isHash(item.block_hash) ? item.block_hash : undefined,
    blockNumber: toQuantityHex(item.block_number as number),
    data: item.data,
    logIndex: toQuantityHex(item.index as number),
    removed: false,
    topics,
    transactionHash: isHash(item.transaction_hash) ? item.transaction_hash : undefined,
  }
}

export function normalizeExplorerLedgerHistoryPage(
  value: unknown,
  expectedAddress: Address,
  expectedTopic: Hex,
  pageSize: number,
): LedgerHistoryPage {
  const response = value && typeof value === 'object' && !Array.isArray(value)
    ? value as ExplorerLogResponse
    : {}
  const items = Array.isArray(response.items) ? response.items : []

  return {
    logs: items
      .slice(0, Math.max(0, Math.floor(pageSize)))
      .map((item) => normalizeExplorerLog(item, expectedAddress, expectedTopic))
      .filter((log): log is LedgerRpcLog => Boolean(log)),
    nextCursor: normalizeCursor(response.next_page_params),
  }
}
