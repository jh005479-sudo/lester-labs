'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getIndexedTokens, getFeaturedTokens, type TokenInfo, type FeaturedToken } from '@/lib/token-indexer'
import { RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'

type Timeframe = '10m' | '1h' | '4h' | '24h' | '7d'

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '10m', label: '10m' },
  { key: '1h', label: '1H' },
  { key: '4h', label: '4H' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
]



function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// Compute a synthetic price change from tx activity for demo until DEX data available
function computePriceChange(token: TokenInfo, tf: Timeframe): number | null {
  // Use real data if available
  if (token.priceChange?.[tf] !== undefined) return token.priceChange[tf]!

  // Otherwise derive from hourly transfer activity
  const hours = token.txCountByHour ?? []
  if (hours.length < 2) return null

  const hoursMap: Record<Timeframe, number> = { '10m': 1, '1h': 1, '4h': 4, '24h': 24, '7d': 24 }
  const window = hoursMap[tf]
  const recentSlice = hours.slice(-window)
  const olderSlice = hours.slice(-(window * 2), -window)

  const recent = recentSlice.reduce((a, b) => a + b, 0)
  const older = olderSlice.reduce((a, b) => a + b, 0)

  if (older === 0 && recent === 0) return null
  if (older === 0) return recent > 0 ? 100 : 0

  return Number((((recent - older) / older) * 100).toFixed(2))
}

function getHolderTrend(token: TokenInfo): 'up' | 'down' | 'stable' {
  if (token.holderTrend) return token.holderTrend
  const hours = token.txCountByHour ?? []
  if (hours.length < 12) return 'stable'
  const recent6 = hours.slice(-6).reduce((a, b) => a + b, 0)
  const older6 = hours.slice(-12, -6).reduce((a, b) => a + b, 0)
  if (recent6 > older6 * 1.2) return 'up'
  if (recent6 < older6 * 0.8) return 'down'
  return 'stable'
}

export function TrendingPanel() {
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [featured, setFeatured] = useState<FeaturedToken[]>([])
  const [timeframe, setTimeframe] = useState<Timeframe>('24h')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Timeout after 15s to avoid infinite loading if RPC is unresponsive
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout — chain may be unreachable')), 15_000)
      )
      const [list, featuredList] = await Promise.race([
        Promise.all([getIndexedTokens(), getFeaturedTokens()]),
        timeoutPromise,
      ] as any)
      setTokens(list)
      setFeatured(featuredList)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load tokens'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Compute changes and sort
  const trending = tokens
    .map(t => ({ token: t, change: computePriceChange(t, timeframe) }))
    .filter(x => x.change !== null)
    .sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!))
    .slice(0, 20)

  return (
    <div>
      {/* Featured Tokens */}
      <div className="mb-8">
        <h3 className="text-sm font-mono tracking-wider text-white/40 mb-4">FEATURED TOKENS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {featured.map(ft => {
            const href = ft.address ? `/analytics/token/${ft.address}` : '#'
            return (
              <Link
                key={ft.symbol}
                href={href}
                className="analytics-card block p-5 rounded-xl bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-2,#111)] border border-white/10 hover:border-white/25 transition group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${ft.isEcosystem ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {ft.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{ft.symbol}</span>
                      {ft.isEcosystem && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-mono">ECOSYSTEM</span>
                      )}
                    </div>
                    <div className="text-white/50 text-sm">{ft.name}</div>
                  </div>
                </div>
                <p className="text-white/40 text-xs">{ft.description}</p>
                {ft.holderCount !== undefined && (
                  <div className="mt-3 flex gap-4 text-xs text-white/60">
                    <span>Holders: {ft.holderCount}</span>
                    <span>Txns: {ft.txCount24h}</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Trending Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🔥 Trending Tokens
          </h2>
          <p className="text-white/50 text-sm mt-1">Top 20 by price change — activity-derived until DEX data available</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-white/10 text-sm hover:border-white/20 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Timeframe Selector */}
      <div className="flex gap-2 mb-6">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.key}
            onClick={() => setTimeframe(tf.key)}
            className={`px-4 py-2 rounded-lg text-sm font-mono transition ${timeframe === tf.key ? 'bg-white/10 border border-white/20 text-white' : 'bg-[var(--surface-1)] border border-white/5 text-white/40 hover:text-white/60'}`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {loading && tokens.length === 0 && (
        <div className="text-center py-20">
          <div className="flex items-center justify-center gap-3 text-white/50">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Scanning chain for tokens...</span>
          </div>
          <div className="text-white/20 text-xs mt-2">This may take a few seconds on first load</div>
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-20">
          <div className="text-red-400/80 text-sm mb-2">⚠️ {error}</div>
          <button onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white/70 transition">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && tokens.length === 0 && (
        <div className="text-center py-20">
          <div className="text-white/30 text-lg mb-2">No tokens available yet</div>
          <div className="text-white/20 text-sm">No tokens available yet — awaiting DEX deployment</div>
        </div>
      )}

      {!loading && !error && tokens.length > 0 && trending.length === 0 && (
        <div className="text-center py-20">
          <div className="text-white/30 text-lg mb-2">No trending data yet</div>
          <div className="text-white/20 text-sm">Activity data will populate as tokens are traded on the DEX</div>
        </div>
      )}

      {/* Token Table */}
      {trending.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs font-mono">
                <th className="text-left py-3 px-2">#</th>
                <th className="text-left py-3 px-2">Token</th>
                <th className="text-right py-3 px-2">Price Change</th>
                <th className="text-right py-3 px-2">Holders</th>
                <th className="text-center py-3 px-2">Trend</th>
                <th className="text-center py-3 px-2">LP</th>
              </tr>
            </thead>
            <tbody>
              {trending.map(({ token, change }, i) => {
                const trend = getHolderTrend(token)
                const isUp = change! > 0
                return (
                  <Link
                    key={token.address}
                    href={`/analytics/token/${token.address}`}
                    className="contents"
                  >
                    <tr className="border-b border-white/5 hover:bg-white/[0.03] transition cursor-pointer">
                      <td className="py-3 px-2 text-white/30 font-mono">{i + 1}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--surface-1)] border border-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                            {token.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold">{token.symbol}</div>
                            <div className="text-white/40 text-xs">{token.name.length > 30 ? token.name.slice(0, 27) + '...' : token.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`inline-flex items-center gap-1 font-mono font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                          {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isUp ? '+' : ''}{change!.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-white/70">
                        {formatNumber(token.holderCount)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400 inline" />}
                        {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400 inline" />}
                        {trend === 'stable' && <span className="text-white/20 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {token.lpLocked === true && <span title="LP Locked">🔒</span>}
                        {token.lpLocked === false && <span title="LP Unlocked" className="opacity-50">🔓</span>}
                        {token.lpLocked === undefined && <span className="text-white/20 text-xs">—</span>}
                      </td>
                    </tr>
                  </Link>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
