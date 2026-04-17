'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, http } from 'viem'
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

const TOKEN_CREATED_SIG =
  '0xd5d05a8421149c74fd223cfc823befb883babf9bf0b0e4d6bf9c8fdb70e59bb4'

function decodeTokenEvent(data: string): { name: string; symbol: string } | null {
  try {
    const d = data.slice(2)
    const nameLen = parseInt('0x' + d.slice(128, 192), 16)
    const symLen = parseInt('0x' + d.slice(256, 320), 16)
    if (!nameLen || !symLen || nameLen > 64 || symLen > 32) return null
    const name = Buffer.from(d.slice(192, 192 + nameLen * 2), 'hex')
      .toString('utf8')
      .replace(/\0+$/, '')
    const sym = Buffer.from(d.slice(320, 320 + symLen * 2), 'hex')
      .toString('utf8')
      .replace(/\0+$/, '')
    if (!name || !sym) return null
    return { name, symbol: sym }
  } catch {
    return null
  }
}

// Singleton cache — loaded once, refreshed every 1000 blocks
let _metaCache: Map<string, TokenMeta> | null = null
let _cacheBlock = 0

async function loadTokenMeta(): Promise<Map<string, TokenMeta>> {
  if (_metaCache) return _metaCache

  try {
    const latest = await client.getBlockNumber()
    const logs = await client.getLogs({
      address: TOKEN_FACTORY_ADDRESS,
      // @ts-ignore
      event: TOKEN_CREATED_SIG,
      fromBlock: 0n,
      toBlock: latest,
    })

    const metaMap = new Map<string, TokenMeta>()
    for (const log of logs) {
      const topics = log.topics as string[]
      const tokenAddr = topics[2]?.replace('0x000000000000000000000000', '0x').toLowerCase()
      if (!tokenAddr) continue
      const decoded = decodeTokenEvent(log.data)
      if (decoded) {
        metaMap.set(tokenAddr, {
          address: tokenAddr as `0x${string}`,
          name: decoded.name,
          symbol: decoded.symbol,
        })
      }
    }

    _metaCache = metaMap
    _cacheBlock = Number(latest)
    return metaMap
  } catch {
    return new Map()
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTokenMetadata(addresses: `0x${string}`[]): {
  metaMap: Map<string, TokenMeta>
  loading: boolean
} {
  const [metaMap, setMetaMap] = useState<Map<string, TokenMeta>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

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
  }, [addresses.join(',')])

  return { metaMap, loading }
}

// ── Logo URL helper ────────────────────────────────────────────────────────

export function getTokenLogoUrl(address: string): string {
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`
}
