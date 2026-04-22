'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { RPC_URL } from '@/lib/rpcClient'
import { TOKEN_FACTORY_ADDRESS } from '@/config/contracts'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TokenMeta {
  address: `0x${string}`
  name: string
  symbol: string
}

// ── On-chain metadata reader ───────────────────────────────────────────────

const client = createPublicClient({
  transport: http(RPC_URL),
})

const TOKEN_CREATED_EVENT = parseAbiItem(
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)',
)

// Singleton cache — loaded once, refreshed every 1000 blocks
let _metaCache: Map<string, TokenMeta> | null = null
let _metaLatestBlock: bigint | null = null
let _metaLoadPromise: Promise<Map<string, TokenMeta>> | null = null

const TOKEN_META_SESSION_KEY = 'lester_token_meta_v2'
const TOKEN_CREATED_BATCH_SIZE = 50_000n

function persistTokenMetaCache() {
  if (typeof window === 'undefined' || _metaCache === null || _metaLatestBlock === null) return

  try {
    sessionStorage.setItem(
      TOKEN_META_SESSION_KEY,
      JSON.stringify({
        latestBlock: _metaLatestBlock.toString(),
        tokens: Array.from(_metaCache.values()),
      }),
    )
  } catch {
    // Ignore session storage failures.
  }
}

function hydrateTokenMetaCache() {
  if (typeof window === 'undefined' || _metaCache !== null) return

  try {
    const raw = sessionStorage.getItem(TOKEN_META_SESSION_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as {
      latestBlock?: string
      tokens?: TokenMeta[]
    }

    if (!Array.isArray(parsed.tokens) || typeof parsed.latestBlock !== 'string') return

    _metaCache = new Map(
      parsed.tokens.map((token) => [
        token.address.toLowerCase(),
        {
          address: token.address.toLowerCase() as `0x${string}`,
          name: token.name,
          symbol: token.symbol,
        },
      ]),
    )
    _metaLatestBlock = BigInt(parsed.latestBlock)
  } catch {
    _metaCache = null
    _metaLatestBlock = null
  }
}

async function getTokenCreatedLogs(fromBlock: bigint, toBlock: bigint) {
  const logs = []
  let cursor = fromBlock

  while (cursor <= toBlock) {
    const batchEnd = cursor + TOKEN_CREATED_BATCH_SIZE - 1n > toBlock
      ? toBlock
      : cursor + TOKEN_CREATED_BATCH_SIZE - 1n

    const batchLogs = await client.getLogs({
      address: TOKEN_FACTORY_ADDRESS,
      event: TOKEN_CREATED_EVENT,
      fromBlock: cursor,
      toBlock: batchEnd,
    })

    logs.push(...batchLogs)
    cursor = batchEnd + 1n
  }

  return logs
}

function mergeTokenCreatedLogs(
  target: Map<string, TokenMeta>,
  logs: Awaited<ReturnType<typeof getTokenCreatedLogs>>,
) {
  for (const log of logs) {
    const tokenAddress = log.args.tokenAddress?.toLowerCase()
    const name = log.args.name
    const symbol = log.args.symbol

    if (!tokenAddress || !name || !symbol) continue

    target.set(tokenAddress, {
      address: tokenAddress as `0x${string}`,
      name,
      symbol,
    })
  }
}

async function refreshTokenMeta(): Promise<Map<string, TokenMeta>> {
  hydrateTokenMetaCache()

  const existing = _metaCache ?? new Map<string, TokenMeta>()
  const latest = await client.getBlockNumber()
  const fromBlock = _metaLatestBlock === null ? 0n : _metaLatestBlock + 1n

  if (fromBlock <= latest) {
    const logs = await getTokenCreatedLogs(fromBlock, latest)
    mergeTokenCreatedLogs(existing, logs)
  }

  _metaCache = existing
  _metaLatestBlock = latest
  persistTokenMetaCache()

  return existing
}

async function loadTokenMeta(): Promise<Map<string, TokenMeta>> {
  hydrateTokenMetaCache()
  if (_metaCache) return _metaCache
  if (_metaLoadPromise) return _metaLoadPromise

  _metaLoadPromise = refreshTokenMeta()
    .catch(() => new Map<string, TokenMeta>())
    .finally(() => {
      _metaLoadPromise = null
    })

  return _metaLoadPromise
}

export async function fetchAllTokenMetadata(): Promise<TokenMeta[]> {
  const all = await loadTokenMeta()
  return Array.from(all.values()).sort((a, b) => a.symbol.localeCompare(b.symbol))
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTokenMetadata(addresses: `0x${string}`[]): {
  metaMap: Map<string, TokenMeta>
  loading: boolean
} {
  const [metaMap, setMetaMap] = useState<Map<string, TokenMeta>>(new Map())
  const [loading, setLoading] = useState(true)
  const addressesKey = addresses.join(',')

  useEffect(() => {
    let cancelled = false

    loadTokenMeta().then((all) => {
      if (cancelled) return
      const filtered = new Map<string, TokenMeta>()
      for (const addr of addresses) {
        const key = addr.toLowerCase()
        const meta = all.get(key)
        if (meta) filtered.set(key, meta)
      }
      setMetaMap(filtered)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [addresses, addressesKey])

  return { metaMap, loading }
}

export type TokenCacheStatus = 'idle' | 'scanning' | 'cached' | 'refreshing'

export function useAllTokenMetadata(): {
  tokens: TokenMeta[]
  loading: boolean
  cacheStatus: TokenCacheStatus
} {
  const [tokens, setTokens] = useState<TokenMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [cacheStatus, setCacheStatus] = useState<TokenCacheStatus>('idle')

  // First load — no cache exists yet
  useEffect(() => {
    let cancelled = false

    setCacheStatus('scanning')
    fetchAllTokenMetadata()
      .then((all) => {
        if (cancelled) return
        setTokens(all)
        setCacheStatus('cached')
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setCacheStatus('cached')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Block-based refresh when cache already exists
  useEffect(() => {
    if (!_metaCache || _metaCache.size === 0) return

    let cancelled = false

    async function refresh() {
      if (!cancelled) setCacheStatus('refreshing')

      const all = await refreshTokenMeta().then((meta) =>
        Array.from(meta.values()).sort((a, b) => a.symbol.localeCompare(b.symbol)),
      )
      if (cancelled) return

      setTokens(all)
      setCacheStatus('cached')
    }

    const interval = setInterval(() => {
      if (!cancelled) refresh()
    }, 120_000) // refresh every 120 blocks (~2 min on LitVM)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { tokens, loading, cacheStatus }
}

// ── Logo URL helper ────────────────────────────────────────────────────────

export function getTokenLogoUrl(address: string): string {
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`
}
