import type { Address } from 'viem'
import { litvm } from '../../config/chains.ts'
import {
  LEDGER_MESSAGE_POSTED_TOPIC,
  LEDGER_PAGE_SIZE,
} from './ledger.ts'
import {
  LEDGER_HISTORY_CURSOR_KEYS,
  normalizeExplorerLedgerHistoryPage,
  type LedgerHistoryCursor,
  type LedgerHistoryPage,
} from './ledgerHistoryParsing.ts'

export type { LedgerHistoryCursor, LedgerHistoryPage } from './ledgerHistoryParsing.ts'

const REQUEST_TIMEOUT_MS = 6_000

export function normalizeLedgerHistoryPage(
  value: unknown,
  expectedAddress: Address,
): LedgerHistoryPage {
  return normalizeExplorerLedgerHistoryPage(
    value,
    expectedAddress,
    LEDGER_MESSAGE_POSTED_TOPIC,
    LEDGER_PAGE_SIZE,
  )
}

export async function fetchLedgerHistoryPage(
  address: Address,
  cursor?: LedgerHistoryCursor,
): Promise<LedgerHistoryPage> {
  const explorerUrl = litvm.blockExplorers?.default.url
  const url = new URL(`/api/v2/addresses/${address}/logs`, explorerUrl)
  url.searchParams.set('topic', LEDGER_MESSAGE_POSTED_TOPIC)

  if (cursor) {
    for (const key of LEDGER_HISTORY_CURSOR_KEYS) {
      const value = cursor[key]
      if (value !== undefined && Number.isSafeInteger(value) && value >= 0) {
        url.searchParams.set(key, value.toString())
      }
    }
  }

  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Ledger history index returned HTTP ${response.status}.`)
  }

  return normalizeLedgerHistoryPage(await response.json(), address)
}
