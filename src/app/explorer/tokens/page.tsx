'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { getIndexedTokens, watchForNewTokens, type TokenInfo } from '@/lib/token-indexer'
import { formatAddress } from '@/lib/explorerRpc'
import { Search, Flame, Sparkles, RefreshCw, ArrowUpDown } from 'lucide-react'

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

type SortKey = 'newest' | 'holders' | 'txCount'

export default function TokensPage() {
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const list = await getIndexedTokens()
      setTokens(prev => {
        // Merge: keep existing, add new
        const map = new Map(prev.map(t => [t.address.toLowerCase(), t]))
        for (const t of list) map.set(t.address.toLowerCase(), t)
        return Array.from(map.values()).sort((a, b) => b.creationBlock - a.creationBlock)
      })
    } catch (e: any) {
      setError(e.message || 'Failed to load tokens')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 10s
  useEffect(() => {
    const iv = setInterval(load, 10_000)
    return () => clearInterval(iv)
  }, [load])

  // Real-time watcher
  useEffect(() => {
    let stop: (() => void) | undefined
    watchForNewTokens((token) => {
      setTokens(prev => {
        if (prev.some(t => t.address.toLowerCase() === token.address.toLowerCase())) return prev
        return [token, ...prev]
      })
    }).then(s => { stop = s })
    return () => { stop?.() }
  }, [])

  const filtered = tokens
    .filter(t => {
      if (!search) return true
      const q = search.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q) || t.address.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sort === 'holders') return b.holderCount - a.holderCount
      if (sort === 'txCount') return b.txCount24h - a.txCount24h
      return b.creationBlock - a.creationBlock
    })

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <LTCBanner />
      <Navbar />
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Token Launch Tracker</h1>
            <p className="text-white/50 text-sm mt-1">Live ERC-20 token deployments on LitVM</p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-white/10 text-sm hover:border-white/20 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search by name, symbol, or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-1)] border border-white/10 text-sm focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="flex gap-2">
            {(['newest', 'holders', 'txCount'] as SortKey[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-3 py-2 rounded-lg text-sm border transition flex items-center gap-1.5 ${sort === s ? 'bg-white/10 border-white/20 text-white' : 'bg-[var(--surface-1)] border-white/10 text-white/50 hover:text-white/70'}`}
              >
                <ArrowUpDown className="w-3 h-3" />
                {s === 'newest' ? 'Newest' : s === 'holders' ? 'Holders' : 'Transactions'}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {/* Loading */}
        {loading && tokens.length === 0 && (
          <div className="text-center py-20 text-white/50">Scanning for tokens...</div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-white/50">No tokens found. Deployments will appear here automatically.</div>
        )}

        {/* Token Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(token => {
            const age = Math.floor(Date.now() / 1000) - token.createdAt
            const isNew = age < 3600
            const isHot = token.holderCount >= 10 && age < 3600

            return (
              <Link
                key={token.address}
                href={`/explorer/token/${token.address}`}
                className="block p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 hover:border-white/20 transition group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{token.symbol}</span>
                      {isNew && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                          <Sparkles className="w-3 h-3" /> NEW
                        </span>
                      )}
                      {isHot && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium">
                          <Flame className="w-3 h-3" /> HOT
                        </span>
                      )}
                    </div>
                    <div className="text-white/60 text-sm">{token.name}</div>
                  </div>
                  <div className="text-right text-xs text-white/40">
                    <div className="font-mono">{timeAgo(token.createdAt)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-white/40">Deployer</div>
                  <div className="text-right font-mono text-xs text-white/70">{formatAddress(token.deployer)}</div>
                  <div className="text-white/40">Block</div>
                  <div className="text-right font-mono text-xs text-white/70">#{token.creationBlock.toLocaleString()}</div>
                  <div className="text-white/40">Holders</div>
                  <div className="text-right font-mono text-white/70">{token.holderCount}</div>
                  <div className="text-white/40">Txns (24h)</div>
                  <div className="text-right font-mono text-white/70">{token.txCount24h}</div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 text-xs font-mono text-white/30 truncate">
                  {token.address}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
