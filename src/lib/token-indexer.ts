import { createPublicClient, http, parseAbiItem } from 'viem'
import { RPC_URL } from './rpcClient'
import { TOKEN_FACTORY_ADDRESS } from '@/config/contracts'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  deployer: string
  creationTx: string
  creationBlock: number
  createdAt: number
  holderCount: number
  txCount24h: number
  txCountByHour: number[] // Last 24 hourly transfer counts
  priceChange?: { '10m'?: number; '1h'?: number; '4h'?: number; '24h'?: number; '7d'?: number }
  holderTrend?: 'up' | 'down' | 'stable'
  lpLocked?: boolean
  poolAddress?: string
  buyCount?: number
  sellCount?: number
  description?: string
  website?: string
  contractWarnings?: string[]
}

export interface TokenDetails extends TokenInfo {
  priceUsd?: number
  volume24h?: number
  priceChange24h?: number
  priceHistory?: { timestamp: number; price: number }[]
  distribution?: { label: string; value: number; address: string }[]
}

export interface TokenTransfer {
  from: string
  to: string
  value: string
  txHash: string
  blockNumber: number
  timestamp: number
}

interface IndexedLog {
  address?: string
  args?: Record<string, unknown>
  blockNumber: bigint
  transactionHash: string
}

// ── ERC-20 ABI ─────────────────────────────────────────────────────────────

const ERC20_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const TRANSFER_EVENT = {
  type: 'event' as const,
  name: 'Transfer',
  inputs: [
    { type: 'address', name: 'from', indexed: true },
    { type: 'address', name: 'to', indexed: true },
    { type: 'uint256', name: 'value', indexed: false },
  ],
}

const TOKEN_CREATED_EVENT = parseAbiItem(
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)',
)

// ── Client ─────────────────────────────────────────────────────────────────

const client = createPublicClient({
  transport: http(RPC_URL, {
    retryCount: 2,
    timeout: 30_000,       // 30s per call — generous for getLogs
  }),
})

// ── In-memory caches ───────────────────────────────────────────────────────

// ERC20 metadata cache — survives across re-scans within same session
const erc20MetaCache = new Map<string, { name: string; symbol: string; decimals: number; totalSupply: bigint }>()

// Token list cache
const tokenCache: TokenInfo[] = []
let lastScanBlock = 0
let cachePopulated = false
let scanLock = false  // Prevents concurrent cold scans (e.g., TrendingPanel + TokenTracker racing)

// Block timestamp cache — reused across tokens
const blockTsCache = new Map<number, number>()
let latestKnownTs = 0
let latestKnownBlock = 0

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const

function formatBigInt(val: bigint, decimals: number): string {
  if (decimals === 0) return val.toString()
  return (val / BigInt(10 ** decimals)).toLocaleString()
}

// ── Block timestamp helper ─────────────────────────────────────────────────

async function getBlockTimestamp(blockNumber: number): Promise<number> {
  const cached = blockTsCache.get(blockNumber)
  if (cached !== undefined) return cached

  try {
    const block = await client.getBlock({ blockNumber: BigInt(blockNumber) })
    const ts = Number(block.timestamp)
    blockTsCache.set(blockNumber, ts)
    // Also update latest if newer
    if (ts > latestKnownTs) {
      latestKnownTs = ts
      latestKnownBlock = blockNumber
    }
    return ts
  } catch {
    // Fallback: estimate from latest known + block delta
    if (latestKnownBlock > 0 && latestKnownTs > 0) {
      const delta = blockNumber - latestKnownBlock
      return latestKnownTs + delta // ~1s per block on LitVM
    }
    return Math.floor(Date.now() / 1000)
  }
}

// Batch-fetch block timestamps — one RPC call per block, but parallelized
async function prefetchBlockTimestamps(blockNumbers: number[]): Promise<void> {
  const uncached = blockNumbers.filter(n => !blockTsCache.has(n))
  if (uncached.length === 0) return
  // Fire all in parallel — viem batches them
  await Promise.all(uncached.map(n => getBlockTimestamp(n)))
}

// ── ERC20 metadata (cached) ────────────────────────────────────────────────

async function readErc20Meta(address: `0x${string}`): Promise<{ name: string; symbol: string; decimals: number; totalSupply: bigint } | null> {
  const cached = erc20MetaCache.get(address.toLowerCase())
  if (cached) return cached

  try {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      client.readContract({ address, abi: ERC20_ABI, functionName: 'name' }),
      client.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address, abi: ERC20_ABI, functionName: 'totalSupply' }),
    ])
    if (!name || !symbol) return null
    const meta = { name: String(name), symbol: String(symbol), decimals: Number(decimals), totalSupply: totalSupply as bigint }
    erc20MetaCache.set(address.toLowerCase(), meta)
    return meta
  } catch {
    return null
  }
}

// ── Paginated getLogs ──────────────────────────────────────────────────────

/**
 * Fetch Transfer event logs in paginated batches to avoid RPC timeouts.
 * Returns all matching logs across the block range.
 */
async function getLogsPaginated(
  address: `0x${string}` | undefined,
  event: typeof TRANSFER_EVENT | typeof TOKEN_CREATED_EVENT,
  fromBlock: number,
  toBlock: number | "latest",
  args?: Record<string, unknown>,
): Promise<IndexedLog[]> {
  const BLOCKS_PER_BATCH = 3000
  const allLogs: IndexedLog[] = []

  // Resolve "latest" once — avoids calling getBlockNumber in every batch
  const latestBlock = toBlock === "latest" ? Number(await client.getBlockNumber()) : toBlock
  let cursor = fromBlock

  while (cursor <= latestBlock) {
    const batchEnd = Math.min(cursor + BLOCKS_PER_BATCH - 1, latestBlock)
    try {
      const logs = await client.getLogs({
        address,
        event,
        fromBlock: BigInt(cursor),
        toBlock: BigInt(batchEnd),
        args,
      }) as IndexedLog[]
      allLogs.push(...logs)
    } catch (err) {
      console.warn(`[token-indexer] getLogs batch ${cursor}-${batchEnd} failed, skipping:`, (err as Error).message)
    }
    cursor = batchEnd + 1
  }
  return allLogs
}

// ── Holder + hourly transfer analysis ─────────────────────────────────────

async function analyzeTokenTransfers(
  address: `0x${string}`,
  fromBlock: number,
): Promise<{ holders: number; txCount: number; hourly: number[] }> {
  try {
    const logs = await getLogsPaginated(address, TRANSFER_EVENT, fromBlock, "latest")

    // Cap to last 50k logs to prevent memory blowup on popular tokens
    const capped = logs.length > 50_000 ? logs.slice(-50_000) : logs

    const recipients = new Set<string>()
    for (const log of capped) {
      const to = typeof log.args?.to === 'string' ? log.args.to : undefined
      if (to && to !== ZERO_ADDR) recipients.add(to.toLowerCase())
    }

    // Build hourly buckets from last 24h
    const now = Math.floor(Date.now() / 1000)
    const buckets = new Array(24).fill(0)
    const blocks = [...new Set(capped.map(l => Number(l.blockNumber)))]

    // Prefetch timestamps for all relevant blocks in parallel
    await prefetchBlockTimestamps(blocks)

    for (const log of capped) {
      const blockNum = Number(log.blockNumber)
      const _cachedTs = blockTsCache.get(blockNum); const ts = _cachedTs !== undefined ? _cachedTs : now - ((blocks[blocks.length - 1] ?? blockNum) - blockNum)
      const hoursAgo = Math.floor((now - ts) / 3600)
      if (hoursAgo >= 0 && hoursAgo < 24) {
        buckets[23 - hoursAgo]++
      }
    }

    return { holders: recipients.size, txCount: capped.length, hourly: buckets }
  } catch {
    return { holders: 0, txCount: 0, hourly: new Array(24).fill(0) }
  }
}

// ── Core scanning ──────────────────────────────────────────────────────────

const INITIAL_SCAN_BLOCKS = 2_000    // ~33min on LitVM — enough for testnet, fast on serverless cold start

export async function scanForTokens(fromBlock: number, toBlock: number): Promise<TokenInfo[]> {
  const newTokens: TokenInfo[] = []

  // Only index Lester factory deployments so analytics cannot be polluted by arbitrary chain-wide ERC-20 mints.
  let tokenCreatedLogs: IndexedLog[]
  try {
    tokenCreatedLogs = await getLogsPaginated(TOKEN_FACTORY_ADDRESS, TOKEN_CREATED_EVENT, fromBlock, toBlock)
  } catch (err) {
    console.error('[token-indexer] TokenCreated log scan failed:', err)
    return []
  }

  // Deduplicate by contract address
  const seen = new Set<string>()
  const candidates: {
    address: `0x${string}`
    creator: string
    txHash: string
    blockNumber: number
  }[] = []

  for (const log of tokenCreatedLogs) {
    const tokenAddress = typeof log.args?.tokenAddress === 'string' ? log.args.tokenAddress.toLowerCase() : undefined
    const creator = typeof log.args?.creator === 'string' ? log.args.creator : ZERO_ADDR
    if (!tokenAddress || seen.has(tokenAddress)) continue
    seen.add(tokenAddress)
    candidates.push({
      address: tokenAddress as `0x${string}`,
      creator,
      txHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
    })
  }

  console.log(`[token-indexer] Found ${candidates.length} candidate tokens in blocks ${fromBlock}–${toBlock}`)

  // Prefetch all block timestamps in one parallel batch
  const uniqueBlocks = [...new Set(candidates.map(c => c.blockNumber))]
  await prefetchBlockTimestamps(uniqueBlocks)

  // Parallel token validation — process in chunks of 8 to avoid RPC overload
  const CHUNK = 8
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk = candidates.slice(i, i + CHUNK)
    const results = await Promise.allSettled(
      chunk.map(async (c) => {
        if (tokenCache.some(t => t.address.toLowerCase() === c.address.toLowerCase())) return null
        const meta = await readErc20Meta(c.address)
        if (!meta) return null
        const timestamp = blockTsCache.get(c.blockNumber) ?? Math.floor(Date.now() / 1000)
        const { holders, txCount, hourly } = await analyzeTokenTransfers(c.address, c.blockNumber)
        return {
          address: c.address,
          name: meta.name,
          symbol: meta.symbol,
          decimals: meta.decimals,
          totalSupply: formatBigInt(meta.totalSupply, meta.decimals),
          deployer: c.creator,
          creationTx: c.txHash,
          creationBlock: c.blockNumber,
          createdAt: timestamp,
          holderCount: holders,
          txCount24h: txCount,
          txCountByHour: hourly,
        } satisfies TokenInfo
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        tokenCache.push(r.value)
        newTokens.push(r.value)
      }
    }
  }

  lastScanBlock = toBlock
  cachePopulated = true
  return newTokens
}

export async function getIndexedTokens(): Promise<TokenInfo[]> {
  // Stale-while-revalidate: load from sessionStorage immediately, backfill in background
  if (!cachePopulated) {
    // Acquire scan lock — if another caller already has it, wait
    while (scanLock) await new Promise(r => setTimeout(r, 500))
    if (cachePopulated) return [...tokenCache].sort((a, b) => b.creationBlock - a.creationBlock)
    scanLock = true
    // Try sessionStorage first — avoids serverless cold-start scan entirely
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('lester_tokens')
        if (stored) {
          const parsed = JSON.parse(stored) as TokenInfo[]
          for (const t of parsed) tokenCache.push(t)
          cachePopulated = true
          // Still refresh in background — don't await
          refreshInBackground()
          return [...tokenCache].sort((a, b) => b.creationBlock - a.creationBlock)
        }
      } catch { /* ignore */ }
    }
    // No cache — do the cold scan
    const latest = await client.getBlockNumber()
    const latestNum = Number(latest)
    const from = Math.max(0, latestNum - INITIAL_SCAN_BLOCKS)
    console.log(`[token-indexer] Cold scan: blocks ${from}–${latestNum}`)
    await scanForTokens(from, latestNum)
    persistCache()
    scanLock = false
  }
  return [...tokenCache].sort((a, b) => b.creationBlock - a.creationBlock)
}

async function refreshInBackground() {
  if (scanLock) return  // Another scan in progress
  try {
    const latest = await client.getBlockNumber()
    const latestNum = Number(latest)
    const lastBlock = tokenCache.length > 0 ? Math.max(...tokenCache.map(t => t.creationBlock)) : 0
    if (lastBlock < latestNum) {
      await scanForTokens(lastBlock + 1, latestNum)
      persistCache()
    }
  } catch { /* background refresh failed — not critical */ }
}

function persistCache() {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('lester_tokens', JSON.stringify(tokenCache.slice(0, 200)))
    } catch { /* quota exceeded — ignore */ }
  }
}

// ── Token details ───────────────────────────────────────────────────────────

export async function getTokenDetails(contractAddress: string): Promise<TokenDetails> {
  const addr = contractAddress as `0x${string}`
  const cached = tokenCache.find(t => t.address.toLowerCase() === contractAddress.toLowerCase())

  const meta = await readErc20Meta(addr)
  if (!meta) throw new Error('Not a valid ERC-20 token')

  const latest = await client.getBlockNumber()
  const fromBlock = cached ? cached.creationBlock : Math.max(0, Number(latest) - INITIAL_SCAN_BLOCKS)

  const transferData = await analyzeTokenTransfers(addr, fromBlock)

  const base: TokenInfo = cached ?? {
    address: contractAddress,
    name: meta.name,
    symbol: meta.symbol,
    decimals: meta.decimals,
    totalSupply: formatBigInt(meta.totalSupply, meta.decimals),
    deployer: '',
    creationTx: '',
    creationBlock: fromBlock,
    createdAt: Math.floor(Date.now() / 1000),
    holderCount: transferData.holders,
    txCount24h: transferData.txCount,
    txCountByHour: transferData.hourly,
  }

  if (!cached) {
    base.holderCount = transferData.holders
    base.txCount24h = transferData.txCount
    base.txCountByHour = transferData.hourly
  }

  return { ...base }
}

// ── Token transfers ────────────────────────────────────────────────────────

export async function getTokenTransfers(contractAddress: string, limit: number): Promise<TokenTransfer[]> {
  const addr = contractAddress as `0x${string}`
  const latest = Number(await client.getBlockNumber())
  const from = Math.max(0, latest - INITIAL_SCAN_BLOCKS)

  const logs = await getLogsPaginated(addr, TRANSFER_EVENT, from, latest)
  const recent = logs.slice(-limit).reverse()

  const transfers: TokenTransfer[] = await Promise.all(
    recent.map(async (log) => {
      const ts = await getBlockTimestamp(Number(log.blockNumber))
      return {
        from: typeof log.args?.from === 'string' ? log.args.from : ZERO_ADDR,
        to: typeof log.args?.to === 'string' ? log.args.to : ZERO_ADDR,
        value: typeof log.args?.value === 'bigint' ? log.args.value.toString() : '0',
        txHash: log.transactionHash ?? '',
        blockNumber: Number(log.blockNumber),
        timestamp: ts,
      }
    }),
  )

  return transfers
}

// ── Featured tokens ────────────────────────────────────────────────────────

export interface FeaturedToken {
  symbol: string
  name: string
  address: string
  description: string
  isEcosystem: boolean
  holderCount?: number
  txCount24h?: number
}

export async function getFeaturedTokens(): Promise<FeaturedToken[]> {
  const tokens = await getIndexedTokens()
  const find = (sym: string) => tokens.find(t => t.symbol.toUpperCase() === sym.toUpperCase())

  const ltc = find('LTC')
  const litvm = find('LITVM')

  return [
    {
      symbol: 'LTC',
      name: 'Litecoin',
      address: ltc?.address ?? '',
      description: 'Native bridge asset — Litecoin on LitVM',
      isEcosystem: false,
      holderCount: ltc?.holderCount,
      txCount24h: ltc?.txCount24h,
    },
    {
      symbol: 'LITVM',
      name: 'LitVM Token',
      address: litvm?.address ?? '',
      description: 'Ecosystem governance and utility token',
      isEcosystem: true,
      holderCount: litvm?.holderCount,
      txCount24h: litvm?.txCount24h,
    },
  ]
}

// ── New token watcher ──────────────────────────────────────────────────────

export async function watchForNewTokens(callback: (token: TokenInfo) => void): Promise<() => void> {
  let running = true

  const poll = async () => {
    while (running) {
      try {
        const latest = Number(await client.getBlockNumber())
        const from = lastScanBlock > 0 ? lastScanBlock + 1 : Math.max(0, latest - 100)
        if (from <= latest) {
          const newTokens = await scanForTokens(from, latest)
          for (const t of newTokens) callback(t)
        }
      } catch { /* ignore, retry next cycle */ }
      await new Promise(r => setTimeout(r, 10_000))
    }
  }

  poll()
  return () => { running = false }
}
