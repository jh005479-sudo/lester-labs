'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getTokenDetails, getTokenTransfers, type TokenDetails, type TokenTransfer } from '@/lib/token-indexer'
import { ArrowLeft, Copy, ExternalLink, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatSupply(supply: string): string {
  const n = Number(supply.replace(/,/g, ''))
  if (isNaN(n)) return supply
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toFixed(2)
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 text-white/40 hover:text-white/70 transition text-xs">
      <Copy className="w-3 h-3" />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function TokenDetailPage() {
  const params = useParams()
  const router = useRouter()
  const address = params.address as string

  const [token, setToken] = useState<TokenDetails | null>(null)
  const [transfers, setTransfers] = useState<TokenTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartTimeframe, setChartTimeframe] = useState<'24h' | '7d'>('24h')

  const load = useCallback(async () => {
    try {
      setError(null)
      const [details, txs] = await Promise.all([
        getTokenDetails(address),
        getTokenTransfers(address, 50),
      ])
      setToken(details)
      setTransfers(txs)
    } catch (e: any) {
      setError(e.message || 'Failed to load token')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20 text-center py-20 text-white/50">Loading token...</div>
      </main>
    )
  }

  if (error || !token) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error || 'Token not found'}</div>
          <Link href="/analytics" className="text-white/50 hover:text-white transition text-sm">← Back to Analytics</Link>
        </div>
      </main>
    )
  }

  // Chart data: derive from priceHistory if available, otherwise show empty
  const hasChartData = token.priceHistory && token.priceHistory.length > 0

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/analytics')} className="flex items-center gap-2 text-white/50 hover:text-white transition text-sm">
            <ArrowLeft className="w-4 h-4" /> Analytics
          </button>
          <span className="text-white/20">/</span>
          <span className="text-white/50 text-sm">Token</span>
        </div>

        {/* Token Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--surface-1)] border border-white/10 flex items-center justify-center text-xl font-bold text-white/70">
              {token.symbol.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{token.symbol}</h1>
                <span className="text-white/40 text-lg">{token.name}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-white/50">
                <span className="font-mono">{formatAddress(address)}</span>
                <CopyButton text={address} />
              </div>
            </div>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-white/10 text-sm hover:border-white/20 transition">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Chart + Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart */}
            <div className="rounded-xl bg-[var(--surface-1)] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Price Chart</h3>
                <div className="flex gap-2">
                  {(['24h', '7d'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setChartTimeframe(tf)}
                      className={`px-3 py-1 rounded text-xs font-mono ${chartTimeframe === tf ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {hasChartData ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={token.priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                      labelFormatter={(ts) => new Date(ts * 1000).toLocaleString()}
                      formatter={(v: any) => [`$${Number(v).toFixed(6)}`, 'Price']}
                    />
                    <Line type="monotone" dataKey="price" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-white/30">
                  <div className="text-4xl mb-3">📊</div>
                  <div className="text-lg mb-1">No trading data available</div>
                  <div className="text-sm text-white/20">Awaiting DEX deployment — chart will populate with live trades</div>
                </div>
              )}
            </div>

            {/* Token Info Grid */}
            <div className="rounded-xl bg-[var(--surface-1)] border border-white/10 p-6">
              <h3 className="font-semibold mb-4">Token Information</h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div>
                  <div className="text-white/40 text-xs mb-1">Description</div>
                  <div>{token.description || <span className="text-white/20">—</span>}</div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">Website</div>
                  {token.website ? (
                    <a href={token.website} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      {token.website} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : <span className="text-white/20">—</span>}
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">Holder Count</div>
                  <div className="font-mono">{token.holderCount}</div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">Total Supply</div>
                  <div className="font-mono">{formatSupply(token.totalSupply)}</div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">Buys / Sells</div>
                  <div className="font-mono">
                    {token.buyCount !== undefined || token.sellCount !== undefined
                      ? `${token.buyCount ?? '—'} / ${token.sellCount ?? '—'}`
                      : <span className="text-white/20">—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">LP Status</div>
                  <div>
                    {token.lpLocked === true && <span className="text-green-400">🔒 Locked</span>}
                    {token.lpLocked === false && <span className="text-red-400">🔓 Unlocked</span>}
                    {token.lpLocked === undefined && <span className="text-white/20">—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">Pool Address</div>
                  {token.poolAddress ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{formatAddress(token.poolAddress)}</span>
                      <CopyButton text={token.poolAddress} />
                    </div>
                  ) : <span className="text-white/20">—</span>}
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">Contract Address</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{formatAddress(address)}</span>
                    <CopyButton text={address} />
                  </div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">Decimals</div>
                  <div className="font-mono">{token.decimals}</div>
                </div>
                <div>
                  <div className="text-white/40 text-xs mb-1">Created</div>
                  <div className="font-mono text-xs">{token.createdAt ? timeAgo(token.createdAt) : '—'}</div>
                </div>
              </div>

              {/* Contract Warnings */}
              {token.contractWarnings && token.contractWarnings.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-amber-400 text-xs font-mono mb-1">⚠ Contract Warnings</div>
                  {token.contractWarnings.map((w, i) => (
                    <div key={i} className="text-amber-300/70 text-sm">{w}</div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <Link
                  href={`/explorer/token/${address}`}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition flex items-center gap-2"
                >
                  <ExternalLink className="w-3 h-3" /> View in Explorer
                </Link>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Distribution */}
            <div className="rounded-xl bg-[var(--surface-1)] border border-white/10 p-6">
              <h3 className="font-semibold mb-4">Distribution</h3>
              {token.distribution && token.distribution.length > 0 ? (
                <div className="space-y-2">
                  {token.distribution.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-white/60 truncate max-w-[60%]">{d.label || formatAddress(d.address)}</span>
                      <span className="font-mono">{d.value.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/30 text-sm">
                  Distribution data unavailable
                </div>
              )}
            </div>

            {/* Recent Transfers */}
            <div className="rounded-xl bg-[var(--surface-1)] border border-white/10 p-6">
              <h3 className="font-semibold mb-4">Recent Transfers</h3>
              {transfers.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">No transfers found</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {transfers.slice(0, 20).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-0">
                      <div className="text-white/50">
                        <span className="font-mono">{formatAddress(tx.from)}</span>
                        <span className="text-white/20 mx-1">→</span>
                        <span className="font-mono">{formatAddress(tx.to)}</span>
                      </div>
                      <div className="text-white/30 font-mono shrink-0 ml-2">{timeAgo(tx.timestamp)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
