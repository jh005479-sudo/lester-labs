/**
 * RPC Resilience Layer for Caldera/LitVM
 *
 * Solves: Caldera free-tier RPC rate limiting causing 429s and timeouts.
 * Provides: request coalescing, rate limiting, exponential backoff, caching.
 */

// ── Configuration ──────────────────────────────────────────────────────────

export const RPC_URL = process.env.NEXT_PUBLIC_LITVM_RPC_URL ?? 'https://liteforge.rpc.caldera.xyz/infra-partner-http'

const MAX_RPS = 5                // Conservative: 5 requests/sec for free Caldera
const BURST_CAPACITY = 10        // Allow short bursts up to 10
const RETRY_ATTEMPTS = 3
const BASE_DELAY_MS = 1000       // Start with 1s backoff
const MAX_DELAY_MS = 10_000
const CACHE_TTL_MS = 15_000      // 15s cache for block data
const BLOCK_NUMBER_TTL_MS = 5000 // 5s for latest block number

// ── Token Bucket Rate Limiter ──────────────────────────────────────────────

class TokenBucket {
  private tokens: number
  private lastRefill: number

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number, // tokens per ms
  ) {
    this.tokens = capacity
    this.lastRefill = Date.now()
  }

  async acquire(): Promise<void> {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    // Wait until a token is available
    const waitMs = (1 - this.tokens) / this.refillRate
    await new Promise(r => setTimeout(r, waitMs))
    this.refill()
    this.tokens -= 1
  }

  private refill() {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate)
    this.lastRefill = now
  }
}

const limiter = new TokenBucket(BURST_CAPACITY, MAX_RPS / 1000)

// ── Request Coalescing ─────────────────────────────────────────────────────

const inflight = new Map<string, Promise<unknown>>()

function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const p = fn().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

// ── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry<T> { value: T; expires: number }
const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function setCache<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expires: Date.now() + ttlMs })
}

// ── Core RPC with Retry ────────────────────────────────────────────────────

type JsonRpcResponse<T> = {
  jsonrpc: string
  id: number
  result?: T
  error?: { code: number; message: string }
}

let requestId = 0

async function rawRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
    cache: 'no-store',
  })
  if (res.status === 429) throw new RpcRateLimitError(res.statusText)
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`)
  const data = (await res.json()) as JsonRpcResponse<T>
  if (data.error) throw new Error(`RPC error ${data.error.code}: ${data.error.message}`)
  if (data.result === undefined) throw new Error('RPC returned no result')
  return data.result
}

class RpcRateLimitError extends Error {
  constructor(msg: string) { super(msg); this.name = 'RpcRateLimitError' }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function rpcWithRetry<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      await limiter.acquire()
      return await rawRpc<T>(method, params)
    } catch (err) {
      lastError = err as Error
      if (err instanceof RpcRateLimitError || (err as any)?.message?.includes('rate limit')) {
        const backoff = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS)
        console.warn(`[rpcClient] Rate limited on ${method}, retry ${attempt + 1}/${RETRY_ATTEMPTS} in ${backoff}ms`)
        await delay(backoff)
        continue
      }
      // Non-rate-limit error — retry once for transient failures
      if (attempt < 1 && (err as any)?.message?.includes('fetch')) {
        await delay(BASE_DELAY_MS)
        continue
      }
      throw err
    }
  }
  throw lastError
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resilient RPC call — rate limited, retried, coalesced, and cached where appropriate.
 */
export async function rpc<T>(method: string, params: unknown[], options?: {
  /** Cache key — if provided, result is cached for the default TTL */
  cacheKey?: string
  /** Override cache TTL in ms */
  cacheTtl?: number
}): Promise<T> {
  // Check cache
  if (options?.cacheKey) {
    const cached = getCached<T>(options.cacheKey)
    if (cached !== null) return cached
  }

  // Coalesce identical concurrent requests
  const coalesceKey = `${method}:${JSON.stringify(params)}`
  const result = await coalesce(coalesceKey, () => rpcWithRetry<T>(method, params))

  // Store in cache
  if (options?.cacheKey) {
    setCache(options.cacheKey, result, options.cacheTtl ?? CACHE_TTL_MS)
  }

  return result
}

// ── Convenience Functions ──────────────────────────────────────────────────

export const hexToNumber = (value?: string | null) => (value ? parseInt(value, 16) : 0)
export const hexToBigInt = (value?: string | null) => (value ? BigInt(value) : 0)

export function formatAddress(addr?: string | null) {
  if (!addr) return 'Contract Creation'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatEtherFromHex(value?: string | null) {
  const wei = hexToBigInt(value)
  const whole = Number(wei) / 1e18
  if (whole === 0) return '0'
  if (whole < 0.0001) return whole.toExponential(2)
  return whole.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

export async function getLatestBlockNumber(): Promise<number> {
  const result = await rpc<string>('eth_blockNumber', [], {
    cacheKey: 'latestBlockNumber',
    cacheTtl: BLOCK_NUMBER_TTL_MS,
  })
  return hexToNumber(result)
}

export async function getBlockByNumber(blockNumber: number, full = true) {
  return rpc<any>('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, full], {
    cacheKey: `block:${blockNumber}:${full}`,
    cacheTtl: CACHE_TTL_MS,
  })
}

export async function getTransactionByHash(hash: string) {
  return rpc<any>('eth_getTransactionByHash', [hash], {
    cacheKey: `tx:${hash}`,
    cacheTtl: 60_000, // Transactions don't change — cache 1 min
  })
}

export async function getTransactionReceipt(hash: string) {
  return rpc<any>('eth_getTransactionReceipt', [hash], {
    cacheKey: `receipt:${hash}`,
    cacheTtl: 60_000,
  })
}

export async function getRecentBlocks(count = 8) {
  const latest = await getLatestBlockNumber()
  const numbers = Array.from({ length: count }, (_, i) => latest - i).filter(n => n >= 0)
  return Promise.all(numbers.map(n => getBlockByNumber(n, true)))
}

/** Clear all cached data — useful after forced refresh */
export function clearCache() {
  cache.clear()
}
