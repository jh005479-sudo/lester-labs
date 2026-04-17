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
    const d = data.slice(2) // strip 0x
    const bytes = Buffer.from(d, 'hex')

    // Bytes 0-31: offset to name (uint256 BE, value = 64)
    // Bytes 32-63: offset to symbol (uint256 BE, value = 128)
    const nameOffset = Number(BigInt('0x' + d.slice(0, 64)))
    const symOffset = Number(BigInt('0x' + d.slice(64, 128)))

    // At nameOffset: name length (32 bytes uint256 BE)
    // At nameOffset+32: name bytes
    const nameLen = Number(BigInt('0x' + d.slice(nameOffset * 2, nameOffset * 2 + 64)))
    const nameHex = d.slice((nameOffset + 32) * 2, (nameOffset + 32) * 2 + nameLen * 2)
    const name = Buffer.from(nameHex, 'hex').toString('utf8').replace(/\0+$/, '')

    // At symOffset: symbol length
    // At symOffset+32: symbol bytes
    const symLen = Number(BigInt('0x' + d.slice(symOffset * 2, symOffset * 2 + 64)))
    const symHex = d.slice((symOffset + 32) * 2, (symOffset + 32) * 2 + symLen * 2)
    const sym = Buffer.from(symHex, 'hex').toString('utf8').replace(/\0+$/, '')

    if (!name || !sym || nameLen === 0 || symLen === 0) return null
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
