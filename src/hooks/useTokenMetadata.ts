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

async function loadTokenMeta(): Promise<Map<string, TokenMeta>> {
  if (_metaCache) return _metaCache

  try {
    const latest = await client.getBlockNumber()
    const logs = await client.getLogs({
      address: TOKEN_FACTORY_ADDRESS,
      event: TOKEN_CREATED_EVENT,
      fromBlock: 0n,
      toBlock: latest,
    })

    const metaMap = new Map<string, TokenMeta>()
    for (const log of logs) {
      const tokenAddress = log.args.tokenAddress?.toLowerCase()
      const name = log.args.name
      const symbol = log.args.symbol

      if (tokenAddress && name && symbol) {
        metaMap.set(tokenAddress, {
          address: tokenAddress as `0x${string}`,
          name,
          symbol,
        })
      }
    }

    _metaCache = metaMap
    return metaMap
  } catch {
    return new Map()
  }
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
    let refreshed = false

    async function refresh() {
      // Clear cache to force re-read from chain
      _metaCache = null
      if (!cancelled) setCacheStatus('refreshing')

      const all = await fetchAllTokenMetadata()
      if (cancelled) return

      refreshed = true
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
