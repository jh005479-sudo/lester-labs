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

export function useAllTokenMetadata(): {
  tokens: TokenMeta[]
  loading: boolean
} {
  const [tokens, setTokens] = useState<TokenMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchAllTokenMetadata().then((all) => {
      if (cancelled) return
      setTokens(all)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { tokens, loading }
}

// ── Logo URL helper ────────────────────────────────────────────────────────

export function getTokenLogoUrl(address: string): string {
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`
}
