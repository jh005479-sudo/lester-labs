'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { RPC_URL } from '@/lib/rpcClient'
import { TOKEN_FACTORY_ADDRESS } from '@/config/contracts'
import { getTokenMetadataRequestKey, normalizeTokenMetadataAddresses } from '@/lib/tokenMetadataRequest'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TokenMeta {
  address: `0x${string}`
  name: string
  symbol: string
}

const EMPTY_TOKEN_META_MAP = new Map<string, TokenMeta>()

// ── On-chain metadata reader ───────────────────────────────────────────────

const client = createPublicClient({
  transport: http(RPC_URL),
})

const TOKEN_CREATED_EVENT = parseAbiItem(
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)',
)

const ERC20_META_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

// Singleton cache — cold starts load a recent factory window, then refresh incrementally.
let _metaCache: Map<string, TokenMeta> | null = null
let _metaLatestBlock: bigint | null = null
let _metaLoadPromise: Promise<Map<string, TokenMeta>> | null = null
let _metaCacheComplete = false

const TOKEN_META_SESSION_KEY = 'lester_token_meta_v2'
const TOKEN_CREATED_BATCH_SIZE = 50_000n
const TOKEN_META_RECENT_LOOKBACK_BLOCKS = 100_000n
const TOKEN_META_DIRECT_READ_CHUNK_SIZE = 8

function persistTokenMetaCache(complete = _metaCacheComplete) {
  if (typeof window === 'undefined' || _metaCache === null) return

  try {
    sessionStorage.setItem(
      TOKEN_META_SESSION_KEY,
      JSON.stringify({
        latestBlock: (_metaLatestBlock ?? 0n).toString(),
        complete,
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
      complete?: boolean
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
    _metaCacheComplete = parsed.complete ?? _metaLatestBlock > 0n
  } catch {
    _metaCache = null
    _metaLatestBlock = null
    _metaCacheComplete = false
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
  const recentWindowStart = latest > TOKEN_META_RECENT_LOOKBACK_BLOCKS ? latest - TOKEN_META_RECENT_LOOKBACK_BLOCKS : 0n
  const fromBlock = _metaCacheComplete && _metaLatestBlock !== null ? _metaLatestBlock + 1n : recentWindowStart

  if (fromBlock <= latest) {
    const logs = await getTokenCreatedLogs(fromBlock, latest)
    mergeTokenCreatedLogs(existing, logs)
  }

  _metaCache = existing
  _metaLatestBlock = latest
  _metaCacheComplete = true
  persistTokenMetaCache(true)

  return existing
}

async function loadTokenMeta(): Promise<Map<string, TokenMeta>> {
  hydrateTokenMetaCache()
  if (_metaCache && _metaCacheComplete) return _metaCache
  if (_metaLoadPromise) return _metaLoadPromise

  _metaLoadPromise = refreshTokenMeta()
    .catch(() => new Map<string, TokenMeta>())
    .finally(() => {
      _metaLoadPromise = null
    })

  return _metaLoadPromise
}

async function readTokenMetaDirect(address: `0x${string}`): Promise<TokenMeta | null> {
  try {
    const [name, symbol] = await Promise.all([
      client.readContract({ address, abi: ERC20_META_ABI, functionName: 'name' }),
      client.readContract({ address, abi: ERC20_META_ABI, functionName: 'symbol' }),
    ])

    if (!name || !symbol) return null

    return {
      address: address.toLowerCase() as `0x${string}`,
      name: String(name),
      symbol: String(symbol),
    }
  } catch {
    return null
  }
}

async function fetchTokenMetadataForAddresses(addresses: `0x${string}`[]): Promise<Map<string, TokenMeta>> {
  hydrateTokenMetaCache()

  const requested = normalizeTokenMetadataAddresses(addresses)
  const existing = _metaCache ?? new Map<string, TokenMeta>()
  const missing = requested.filter((address) => !existing.has(address))

  for (let index = 0; index < missing.length; index += TOKEN_META_DIRECT_READ_CHUNK_SIZE) {
    const batch = missing.slice(index, index + TOKEN_META_DIRECT_READ_CHUNK_SIZE)
    const results = await Promise.allSettled(batch.map((address) => readTokenMetaDirect(address)))

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        existing.set(result.value.address.toLowerCase(), result.value)
      }
    }
  }

  _metaCache = existing
  persistTokenMetaCache(_metaCacheComplete)

  const filtered = new Map<string, TokenMeta>()
  for (const address of requested) {
    const meta = existing.get(address)
    if (meta) filtered.set(address, meta)
  }

  return filtered
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
  const [metadataState, setMetadataState] = useState<{
    key: string
    metaMap: Map<string, TokenMeta>
  }>({ key: '', metaMap: EMPTY_TOKEN_META_MAP })
  const addressesKey = getTokenMetadataRequestKey(addresses)

  useEffect(() => {
    let cancelled = false
    const requested = addressesKey ? (addressesKey.split(',') as `0x${string}`[]) : []

    if (!requested.length) {
      return
    }

    fetchTokenMetadataForAddresses(requested).then((filtered) => {
      if (cancelled) return
      setMetadataState({ key: addressesKey, metaMap: filtered })
    })

    return () => {
      cancelled = true
    }
  }, [addressesKey])

  if (!addressesKey) {
    return { metaMap: EMPTY_TOKEN_META_MAP, loading: false }
  }

  return {
    metaMap: metadataState.key === addressesKey ? metadataState.metaMap : EMPTY_TOKEN_META_MAP,
    loading: metadataState.key !== addressesKey,
  }
}

export type TokenCacheStatus = 'idle' | 'scanning' | 'cached' | 'refreshing'

export function useAllTokenMetadata(): {
  tokens: TokenMeta[]
  loading: boolean
  cacheStatus: TokenCacheStatus
} {
  const [tokens, setTokens] = useState<TokenMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [cacheStatus, setCacheStatus] = useState<TokenCacheStatus>('scanning')

  // First load — no cache exists yet
  useEffect(() => {
    let cancelled = false

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
