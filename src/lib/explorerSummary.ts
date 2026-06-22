export interface ExplorerSummaryBlockInput {
  number?: string
  timestamp?: string
  transactions?: ExplorerSummaryTransactionInput[]
  miner?: string
  author?: string
  size?: string
}

export type ExplorerSummaryTransactionInput = string | {
  hash?: string
  from?: string
  to?: string | null
  value?: string
}

export interface ExplorerSummaryReceiptInput {
  status?: string
}

export interface ExplorerSummaryBlock {
  number: number
  time: string
  txCount: number
  validator: string
  sizeKB: number
}

export interface ExplorerSummaryTransaction {
  hash: string
  from: string
  to: string
  value: string
  time: string
  status: 'Success' | 'Pending'
}

export interface ExplorerSummary {
  latestBlock: number
  blocks: ExplorerSummaryBlock[]
  transactions: ExplorerSummaryTransaction[]
  updatedAt: string | null
}

export function getExplorerSummaryCacheControl() {
  return 'public, s-maxage=4, stale-while-revalidate=20'
}

export function createEmptyExplorerSummary(): ExplorerSummary {
  return {
    latestBlock: 0,
    blocks: [],
    transactions: [],
    updatedAt: null,
  }
}

export const hexToSummaryNumber = (value?: string | null) => (value ? parseInt(value, 16) : 0)
export const hexToSummaryBigInt = (value?: string | null) => (value ? BigInt(value) : 0n)

export function formatSummaryEtherFromHex(value?: string | null) {
  const wei = hexToSummaryBigInt(value)
  const whole = Number(wei) / 1e18
  if (whole === 0) return '0'
  if (whole < 0.0001) return whole.toExponential(2)
  return whole.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

export function timeAgoFromTimestamp(timestampHex: string | undefined, nowMs = Date.now()) {
  const ts = hexToSummaryNumber(timestampHex)
  if (!ts) return 'Unknown'
  const delta = Math.max(0, Math.floor(nowMs / 1000) - ts)
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  return `${Math.floor(delta / 3600)}h ago`
}

export function explorerTransactionHash(tx: ExplorerSummaryTransactionInput) {
  return typeof tx === 'string' ? tx : tx.hash
}

export function buildExplorerSummary({
  latestBlock,
  blocks,
  receiptsByHash,
  nowMs = Date.now(),
}: {
  latestBlock: number
  blocks: ExplorerSummaryBlockInput[]
  receiptsByHash?: Map<string, ExplorerSummaryReceiptInput | null>
  nowMs?: number
}): ExplorerSummary {
  const summaryBlocks = blocks.map((block) => ({
    number: hexToSummaryNumber(block.number),
    time: timeAgoFromTimestamp(block.timestamp, nowMs),
    txCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
    validator: block.miner || block.author || 'Unknown',
    sizeKB: Math.max(1, Math.round(hexToSummaryNumber(block.size) / 1024)),
  }))

  const transactions = blocks
    .flatMap((block) => (
      Array.isArray(block.transactions)
        ? block.transactions.slice(0, 2).map((tx) => ({ tx, block }))
        : []
    ))
    .slice(0, 8)
    .map(({ tx, block }): ExplorerSummaryTransaction | null => {
      const hash = explorerTransactionHash(tx)
      if (!hash) return null
      const txObject = typeof tx === 'string' ? null : tx
      const receipt = receiptsByHash?.get(hash)
      return {
        hash,
        from: txObject?.from ?? '0x0000000000000000000000000000000000000000',
        to: txObject?.to || '0x0000000000000000000000000000000000000000',
        value: formatSummaryEtherFromHex(txObject?.value),
        time: timeAgoFromTimestamp(block.timestamp, nowMs),
        status: receipt?.status === '0x1' ? 'Success' : 'Pending',
      }
    })
    .filter((tx): tx is ExplorerSummaryTransaction => tx !== null)

  return {
    latestBlock,
    blocks: summaryBlocks,
    transactions,
    updatedAt: new Date(nowMs).toISOString(),
  }
}
