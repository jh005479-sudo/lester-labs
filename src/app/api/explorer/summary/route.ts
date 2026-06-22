import { NextResponse } from 'next/server'
import { getBlockByNumber, getLatestBlockNumber, getTransactionReceipt } from '@/lib/explorerRpc'
import {
  buildExplorerSummary,
  createEmptyExplorerSummary,
  explorerTransactionHash,
  getExplorerSummaryCacheControl,
  type ExplorerSummary,
  type ExplorerSummaryBlockInput,
  type ExplorerSummaryReceiptInput,
} from '@/lib/explorerSummary'

export const dynamic = 'force-dynamic'

type CacheEntry = {
  value: ExplorerSummary
  expires: number
  refreshing?: Promise<ExplorerSummary>
}

const BLOCK_COUNT = 8
const CACHE_TTL_MS = 4_000
const STALE_TTL_MS = 20_000
const cache = new Map<string, CacheEntry>()

function cacheKey(stage: string) {
  return `explorer-summary:${stage}`
}

async function getRecentBlocksFromLatest(latest: number) {
  const numbers = Array.from({ length: BLOCK_COUNT }, (_, index) => latest - index).filter((n) => n >= 0)
  return Promise.all(numbers.map((blockNumber) => getBlockByNumber(blockNumber, true))) as Promise<ExplorerSummaryBlockInput[]>
}

async function buildSummary(includeReceipts: boolean) {
  const latestBlock = await getLatestBlockNumber()
  const blocks = await getRecentBlocksFromLatest(latestBlock)
  const receiptsByHash = new Map<string, ExplorerSummaryReceiptInput | null>()

  if (includeReceipts) {
    const hashes = blocks
      .flatMap((block) => Array.isArray(block.transactions) ? block.transactions.slice(0, 2) : [])
      .map(explorerTransactionHash)
      .filter((hash): hash is string => Boolean(hash))
      .slice(0, 8)

    const receipts = await Promise.all(
      hashes.map((hash) => getTransactionReceipt(hash).catch(() => null)),
    )
    hashes.forEach((hash, index) => receiptsByHash.set(hash, receipts[index]))
  }

  return buildExplorerSummary({
    latestBlock,
    blocks,
    receiptsByHash,
  })
}

async function getCachedSummary(stage: string, includeReceipts: boolean) {
  const key = cacheKey(stage)
  const now = Date.now()
  const entry = cache.get(key)

  if (entry && entry.expires > now) return entry.value

  if (entry && entry.expires + STALE_TTL_MS > now) {
    entry.refreshing ??= buildSummary(includeReceipts)
      .then((value) => {
        cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
        return value
      })
      .finally(() => {
        const current = cache.get(key)
        if (current) current.refreshing = undefined
      })
    return entry.value
  }

  const value = await buildSummary(includeReceipts)
  cache.set(key, { value, expires: now + CACHE_TTL_MS })
  return value
}

export async function GET(request: Request) {
  const stage = new URL(request.url).searchParams.get('stage') === 'transactions' ? 'transactions' : 'blocks'
  const includeReceipts = stage === 'transactions'

  try {
    const summary = await getCachedSummary(stage, includeReceipts)
    return NextResponse.json(summary, {
      headers: {
        'cache-control': getExplorerSummaryCacheControl(),
      },
    })
  } catch (error) {
    return NextResponse.json({
      ...createEmptyExplorerSummary(),
      error: error instanceof Error ? error.message : 'Unable to load explorer summary.',
    }, {
      status: 200,
      headers: {
        'cache-control': 'public, s-maxage=2, stale-while-revalidate=10',
      },
    })
  }
}
