'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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

function isLPToken(token: TokenInfo): boolean {
  const name = token.name.toLowerCase()
  const symbol = token.symbol.toLowerCase()
  return (
    name.includes('-lp') ||
    name.includes(' lp') ||
    name.includes('uniswapv2') ||
    name.includes('pair') ||
    symbol.includes('lp') ||
    symbol.includes('uni-v2')
  )
}

// Use actual hourly transfer counts from TokenInfo
function generateSparklineData(token: TokenInfo): number[] {
  return token.txCountByHour ?? new Array(24).fill(0)
}

function Sparkline({ data }: { data: number[] }) {
  if (data.every(v => v === 0)) {
    return (
      <svg width={60} height={20} className="opacity-30">
        <line x1={0} y1={10} x2={60} y2={10} stroke="#6b7280" strokeWidth={1.5} />
      </svg>
    )
  }
  const max = Math.max(...data, 1)
  const w = 60
  const h = 20
  const step = w / (data.length - 1)
  const points = data.map((v, i) => [i * step, h - (v / max) * (h - 2) - 1])
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

  // Determine trend: compare last 6 to first 6
  const first6 = data.slice(0, 6).reduce((a, b) => a + b, 0)
  const last6 = data.slice(-6).reduce((a, b) => a + b, 0)
  const color = last6 > first6 * 1.1 ? '#22c55e' : last6 < first6 * 0.9 ? '#ef4444' : '#6b7280'

  return (
    <svg width={60} height={20}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type SortKey = 'newest' | 'holders' | 'txCount' | 'trending'

export function TokenTracker() {
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [hideLp, setHideLp] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const list = await getIndexedTokens()
      setTokens(prev => {
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
  useEffect(() => {
    const iv = setInterval(load, 30_000) // Poll every 30s instead of 10s
    return () => clearInterval(iv)
  }, [load])
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

  const now = Math.floor(Date.now() / 1000)

  const lpTokenCount = tokens.filter(isLPToken).length
  const visibleTokens = hideLp ? tokens.filter(t => !isLPToken(t)) : tokens

  const filtered = visibleTokens
    .filter(t => {
      if (!search) return true
      const q = search.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q) || t.address.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sort === 'holders') return b.holderCount - a.holderCount
      if (sort === 'txCount') return b.txCount24h - a.txCount24h
      if (sort === 'trending') {
        // Approximate trending: <24h tokens with >3 holders, sorted by holderCount
        const aIsNew = (now - a.createdAt) < 86400
        const bIsNew = (now - b.createdAt) < 86400
        const aQual = aIsNew && a.holderCount > 3
        const bQual = bIsNew && b.holderCount > 3
        if (aQual && !bQual) return -1
        if (!aQual && bQual) return 1
        return b.holderCount - a.holderCount
      }
      return b.creationBlock - a.creationBlock
    })

  const sortButtons: { key: SortKey; label: string; icon?: React.ReactNode }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'holders', label: 'Holders' },
    { key: 'txCount', label: 'Transactions' },
    { key: 'trending', label: 'Trending', icon: <span>🔥</span> },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Token Launch Tracker</h2>
          <p className="text-white/50 text-sm mt-1">Live ERC-20 token deployments on LitVM</p>
          <p className="text-white/30 text-xs mt-0.5">Sparklines show actual hourly Transfer events over last 24h.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-white/10 text-sm hover:border-white/20 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Search + Sort + LP toggle */}
      <div className="flex flex-wrap gap-3 mb-4">
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
        <div className="flex gap-2 flex-wrap">
          {sortButtons.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`px-3 py-2 rounded-lg text-sm border transition flex items-center gap-1.5 ${sort === key ? 'bg-white/10 border-white/20 text-white' : 'bg-[var(--surface-1)] border-white/10 text-white/50 hover:text-white/70'}`}
            >
              {icon ?? <ArrowUpDown className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* LP toggle + count */}
      <div className="flex items-center gap-3 mb-6 text-sm">
        <button
          onClick={() => setHideLp(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition ${hideLp ? 'bg-white/10 border-white/20 text-white' : 'bg-[var(--surface-1)] border-white/10 text-white/50'}`}
        >
          <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${hideLp ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-white/30'}`}>
            {hideLp && <span className="text-[9px] font-bold text-white">✓</span>}
          </span>
          Hide LP Tokens
        </button>
        <span className="text-white/40">
          Showing {filtered.length} tokens
          {hideLp && lpTokenCount > 0 && ` (${lpTokenCount} LP token${lpTokenCount !== 1 ? 's' : ''} hidden)`}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}
      {loading && tokens.length === 0 && (
        <div className="text-center py-20 text-white/50">Scanning for tokens...</div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 text-white/50">No tokens found. Deployments will appear here automatically.</div>
      )}

      {/* Token Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(token => {
          const age = now - token.createdAt
          const isNew = age < 3600
          const isHot = token.holderCount >= 10 && age < 3600
          const isTrending = sort === 'trending' && age < 86400 && token.holderCount > 3
          const sparkData = generateSparklineData(token)
          // Growth rate for trending view: holderCount / (age in hours) capped
          const ageHours = Math.max(age / 3600, 0.5)
          const growthRate = Math.round(token.holderCount / ageHours)

          return (
            <Link
              key={token.address}
              href={`/explorer/token/${token.address}`}
              className="analytics-card block p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 hover:border-white/20 transition group relative"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
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
                    {isTrending && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                        🔥 +{growthRate}/hr
                      </span>
                    )}
                  </div>
                  <div className="text-white/60 text-sm">{token.name.length > 64 ? token.name.slice(0, 61) + '...' : token.name}</div>
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

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs font-mono text-white/30 truncate max-w-[calc(100%-70px)]">{token.address}</span>
                <div className="shrink-0">
                  <Sparkline data={sparkData} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
