'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { getTokenDetails, getTokenTransfers, type TokenDetails, type TokenTransfer } from '@/lib/token-indexer'
import { formatAddress, LITVM_EXPLORER_URL, LITVM_RPC_URL } from '@/lib/explorerRpc'
import { checkTokenSafety, type SafetyReport } from '@/lib/token-safety'
import { Copy, ExternalLink, Share2, ArrowLeft, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'

// ─── Holder distribution ──────────────────────────────────────────────────

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

interface HolderEntry { address: string; balance: bigint }

async function fetchTopHolders(tokenAddr: string, decimals: number): Promise<{ entries: HolderEntry[]; totalSupply: bigint }> {
  try {
    // Get latest block to limit scan range
    const latestRes = await fetch(LITVM_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      cache: 'no-store',
    })
    const latestData = (await latestRes.json()) as { result?: string }
    const latestBlock = latestData.result ? parseInt(latestData.result, 16) : 0
    const fromBlock = Math.max(0, latestBlock - 100000) // Last 100k blocks only

    const res = await fetch(LITVM_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_getLogs',
        params: [{ address: tokenAddr, topics: [TRANSFER_TOPIC], fromBlock: `0x${fromBlock.toString(16)}`, toBlock: 'latest' }],
      }),
      cache: 'no-store',
    })
    const data = (await res.json()) as { result?: unknown[] }
    const logs = (data.result ?? []) as Array<{ topics: string[]; data: string }>

    const balances = new Map<string, bigint>()
    for (const log of logs) {
      const from = ('0x' + log.topics[1]?.slice(26)).toLowerCase()
      const to = ('0x' + log.topics[2]?.slice(26)).toLowerCase()
      const value = BigInt(log.data || '0x0')
      if (from !== ZERO_ADDR) balances.set(from, (balances.get(from) ?? 0n) - value)
      if (to !== ZERO_ADDR) balances.set(to, (balances.get(to) ?? 0n) + value)
    }

    const sorted = Array.from(balances.entries())
      .filter(([, b]) => b > 0n)
      .sort((a, b) => (b[1] > a[1] ? 1 : -1))

    const totalSupply = sorted.reduce((acc, [, b]) => acc + b, 0n)
    const entries = sorted.slice(0, 10).map(([address, balance]) => ({ address, balance }))
    return { entries, totalSupply }
  } catch {
    return { entries: [], totalSupply: 0n }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatValue(value: string, decimals: number): string {
  try {
    const big = BigInt(value)
    if (decimals === 0) return big.toLocaleString()
    const div = BigInt(10 ** decimals)
    const whole = big / div
    const frac = big % div
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4)
    return `${whole.toLocaleString()}.${fracStr}`
  } catch {
    return value
  }
}

// ─── Chart colors ─────────────────────────────────────────────────────────

const HOLDER_COLORS = [
  '#06b6d4', // cyan-500
  '#22d3ee', // cyan-400
  '#38bdf8', // sky-400
  '#60a5fa', // blue-400
  '#818cf8', // indigo-400
  '#a78bfa', // violet-400
  '#c084fc', // purple-400
  '#e879f9', // fuchsia-400
  '#f0abfc', // fuchsia-300
  '#d8b4fe', // purple-300
]

// ─── Holder Chart ─────────────────────────────────────────────────────────

function HolderDistributionChart({ tokenAddress, decimals }: { tokenAddress: string; decimals: number }) {
  const [data, setData] = useState<{ name: string; value: number; pct: number }[]>([])
  const [topPct, setTopPct] = useState(0)
  const [topHolder, setTopHolder] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTopHolders(tokenAddress, decimals).then(({ entries, totalSupply }) => {
      if (totalSupply === 0n || entries.length === 0) { setLoading(false); return }
      const topSum = entries.reduce((a, e) => a + e.balance, 0n)
      const otherSum = totalSupply - topSum
      const toNum = (b: bigint) => Number((b * 10000n) / totalSupply) / 100

      const chartData = entries.map((e, i) => ({
        name: `${e.address.slice(0, 6)}...${e.address.slice(-4)}`,
        value: Number(e.balance),
        pct: toNum(e.balance),
      }))
      if (otherSum > 0n) {
        chartData.push({ name: 'Other', value: Number(otherSum), pct: toNum(otherSum) })
      }

      setTopPct(Math.round(toNum(topSum)))
      setTopHolder(toNum(entries[0]?.balance ?? 0n))
      setData(chartData)
      setLoading(false)
    })
  }, [tokenAddress, decimals])

  if (loading) return <div className="h-48 flex items-center justify-center text-white/30 text-sm">Loading holders...</div>
  if (data.length === 0) return <div className="h-24 flex items-center justify-center text-white/30 text-sm">No holder data available</div>

  return (
    <div>
      {topHolder > 50 && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          ⚠ High concentration risk — top holder owns {topHolder.toFixed(1)}% of supply
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-48 h-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.name === 'Other' ? '#374151' : HOLDER_COLORS[index % HOLDER_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(_value: unknown, name: unknown, props: { payload?: { pct?: number } }) =>
                  [`${props.payload?.pct?.toFixed(2) ?? 0}%`, String(name)]
                }
                contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5 text-sm w-full">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'linear-gradient(135deg, #06b6d4, #c084fc)' }} />
            Top 10: <span className="text-white font-mono">{topPct}%</span>
            <span className="w-3 h-3 rounded-sm bg-gray-700 inline-block ml-2" />
            Other: <span className="text-white font-mono">{100 - topPct}%</span>
          </div>
          {data.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.name === 'Other' ? '#374151' : HOLDER_COLORS[i] }} />
              <span className="font-mono text-xs text-white/60 flex-1">{d.name}</span>
              <span className="font-mono text-xs text-white">{d.pct.toFixed(2)}%</span>
            </div>
          ))}
          {data.length > 6 && (
            <div className="text-xs text-white/30 pl-4">+ {data.length - 6} more holders</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Safety Score ─────────────────────────────────────────────────────────

function SafetyScorePanel({ tokenAddress }: { tokenAddress: string }) {
  const [report, setReport] = useState<SafetyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkTokenSafety(tokenAddress).then(r => { setReport(r); setLoading(false) })
  }, [tokenAddress])

  if (loading) return (
    <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
      <div className="text-sm text-white/30">Analyzing token safety...</div>
    </div>
  )
  if (!report) return null

  const badgeConfig = {
    safe: { icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30', label: '🟢 SAFE' },
    caution: { icon: ShieldAlert, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', label: '🟡 CAUTION' },
    risky: { icon: ShieldX, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', label: '🔴 RISKY' },
  }
  const cfg = badgeConfig[report.score]
  const Icon = cfg.icon

  const statusIcon = { pass: '✅', warn: '⚠️', fail: '❌', unknown: '❓' }
  const statusColor = { pass: 'text-green-400', warn: 'text-yellow-400', fail: 'text-red-400', unknown: 'text-white/40' }

  return (
    <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-medium text-white/50">Token Safety</h2>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.bg} ${cfg.color}`}>
          <Icon className="w-4 h-4" /> {cfg.label}
        </span>
      </div>
      <div className="space-y-2">
        {report.checks.map((check, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="text-base">{statusIcon[check.status]}</span>
            <div>
              <span className={`font-medium ${statusColor[check.status]}`}>{check.name}</span>
              <span className="text-white/40 ml-2 text-xs">{check.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function TokenDetailPage() {
  const params = useParams()
  const rawAddress = params.address as string
  if (!/^0x[0-9a-fA-F]{40}$/.test(rawAddress)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Address</h1>
          <p className="text-white/60">Addresses must be 42 hexadecimal characters starting with 0x</p>
          <Link href="/explorer" className="text-[var(--accent)] mt-4 inline-block">Return to Explorer</Link>
        </div>
      </div>
    )
  }
  const address = rawAddress

  const [details, setDetails] = useState<TokenDetails | null>(null)
  const [transfers, setTransfers] = useState<TokenTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    Promise.all([
      getTokenDetails(address).catch(e => { throw new Error(`Details: ${e.message}`) }),
      getTokenTransfers(address, 20).catch(() => []),
    ])
      .then(([d, t]) => { setDetails(d); setTransfers(t) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [address])

  const copyAddress = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareTweet = () => {
    if (!details) return
    const text = `🪙 ${details.name} ($${details.symbol}) on LitVM\n\nHolders: ${details.holderCount} | Supply: ${details.totalSupply}\n\nTrack it: ${window.location.href}`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <LTCBanner /><Navbar />
        <div className="pt-[120px] max-w-5xl mx-auto px-4 text-center py-20 text-white/50">Loading token details...</div>
      </main>
    )
  }

  if (error || !details) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <LTCBanner /><Navbar />
        <div className="pt-[120px] max-w-5xl mx-auto px-4">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error || 'Token not found'}</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <LTCBanner />
      <Navbar />
      <div className="pt-[120px] max-w-5xl mx-auto px-4 pb-20">
        {/* Back link */}
        <Link href="/explorer/tokens" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/70 mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Tokens
        </Link>

        {/* Token Header */}
        <div className="p-6 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{details.name.length > 64 ? details.name.slice(0, 61) + '...' : details.name}</h1>
                <span className="text-lg text-white/50">${details.symbol}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-white/50">
                {address}
                <button onClick={copyAddress} className="p-1 rounded hover:bg-white/10 transition" title="Copy address">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copied && <span className="text-green-400 text-xs">Copied!</span>}
                <a href={`${LITVM_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-white/10 transition">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            <button
              onClick={shareTweet}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1DA1F2]/20 border border-[#1DA1F2]/30 text-[#1DA1F2] text-sm hover:bg-[#1DA1F2]/30 transition"
            >
              <Share2 className="w-4 h-4" /> Share Token
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <Stat label="Decimals" value={String(details.decimals)} />
            <Stat label="Total Supply" value={`${details.totalSupply} ${details.symbol}`} />
            <Stat label="Holders" value={String(details.holderCount)} />
            <Stat label="Txns (24h)" value={String(details.txCount24h)} />
          </div>
        </div>

        {/* Holder Distribution Chart */}
        <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
          <h2 className="text-sm font-medium text-white/50 mb-4">Holder Distribution</h2>
          <HolderDistributionChart tokenAddress={address} decimals={details.decimals} />
        </div>

        {/* Token Safety Score */}
        <SafetyScorePanel tokenAddress={address} />

        {/* Deployer Info */}
        <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
          <h2 className="text-sm font-medium text-white/50 mb-3">Deployer Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-white/40">Deployer </span>
              <span className="font-mono">{formatAddress(details.deployer)}</span>
            </div>
            <div>
              <span className="text-white/40">Created </span>
              <span className="font-mono">Block #{details.creationBlock.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-white/40">TX </span>
              <a href={`${LITVM_EXPLORER_URL}/tx/${details.creationTx}`} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-400 hover:underline">
                {formatAddress(details.creationTx)}
              </a>
            </div>
          </div>
        </div>

        {/* DEX / Price */}
        <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
          <h2 className="text-sm font-medium text-white/50 mb-3">Price & Trading</h2>
          {details.priceUsd !== undefined ? (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Stat label="Price" value={`$${details.priceUsd?.toFixed(6)}`} />
              <Stat label="24h Volume" value={`$${details.volume24h?.toLocaleString()}`} />
              <Stat label="24h Change" value={`${details.priceChange24h !== undefined ? (details.priceChange24h >= 0 ? '+' : '') + details.priceChange24h.toFixed(2) + '%' : '—'}`} />
            </div>
          ) : (
            <p className="text-white/30 text-sm">Not yet trading on DEX</p>
          )}
        </div>

        {/* Recent Transfers */}
        <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10">
          <h2 className="text-sm font-medium text-white/50 mb-4">Recent Transfers</h2>
          {transfers.length === 0 ? (
            <p className="text-white/30 text-sm">No transfers found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-left">
                    <th className="pb-2 font-medium">From</th>
                    <th className="pb-2 font-medium">To</th>
                    <th className="pb-2 font-medium text-right">Value</th>
                    <th className="pb-2 font-medium text-right">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-2 font-mono text-xs">{formatAddress(t.from)}</td>
                      <td className="py-2 font-mono text-xs">{formatAddress(t.to)}</td>
                      <td className="py-2 font-mono text-xs text-right">{formatValue(t.value, details.decimals)}</td>
                      <td className="py-2 text-xs text-white/40 text-right">{timeAgo(t.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/5">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  )
}
