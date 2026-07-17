'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useLocalEngagement } from '@/hooks/useLocalEngagement'
import { getTokenDetails, getTokenTransfers, type TokenDetails, type TokenTransfer } from '@/lib/token-indexer'
import { formatAddress, LITVM_EXPLORER_URL, rpc } from '@/lib/explorerRpc'
import { checkTokenSafety, type SafetyReport } from '@/lib/token-safety'
import { BarChart3, BookmarkCheck, BookmarkPlus, Copy, Droplets, ExternalLink, Share2, ArrowLeft, ShieldCheck, ShieldAlert, ShieldX, Users } from 'lucide-react'
import { aggregateInboundTransferSample, type TransferSampleLog } from '../transferSample'

// ─── Holder distribution ──────────────────────────────────────────────────

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

interface RecipientEntry { address: string; value: bigint }

async function fetchTopRecipients(tokenAddr: string): Promise<{
  entries: RecipientEntry[]
  recipientCount: number
  totalValue: bigint
  fromBlock: number
  toBlock: number
  truncated: boolean
}> {
  try {
    const latestHex = await rpc<string>('eth_blockNumber', [], { cacheKey: 'token-sample-latest', cacheTtl: 10_000 })
    const latestBlock = parseInt(latestHex, 16)
    const fromBlock = Math.max(0, latestBlock - 10_000 + 1)
    let logs: TransferSampleLog[] = []
    const logLimit = 2_000
    let cursorEnd = latestBlock

    while (cursorEnd >= fromBlock && logs.length < logLimit) {
      const batchStart = Math.max(fromBlock, cursorEnd - 999)
      const batch = await rpc<TransferSampleLog[]>('eth_getLogs', [{
        address: tokenAddr,
        topics: [TRANSFER_TOPIC],
        fromBlock: `0x${batchStart.toString(16)}`,
        toBlock: `0x${cursorEnd.toString(16)}`,
      }], { cacheKey: `token-recipient-sample:${tokenAddr}:${batchStart}:${cursorEnd}`, cacheTtl: 30_000 })
      logs = batch.slice(-(logLimit - logs.length)).concat(logs)
      cursorEnd = batchStart - 1
    }

    const sample = aggregateInboundTransferSample(logs)
    return {
      ...sample,
      fromBlock,
      toBlock: latestBlock,
      truncated: fromBlock > 0 || logs.length >= logLimit,
    }
  } catch {
    return { entries: [], recipientCount: 0, totalValue: 0n, fromBlock: 0, toBlock: 0, truncated: true }
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
    const div = 10n ** BigInt(decimals)
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

// ─── Bounded recipient activity chart ─────────────────────────────────────

function TransferRecipientChart({ tokenAddress }: { tokenAddress: string }) {
  const [data, setData] = useState<{ name: string; value: number; pct: number }[]>([])
  const [topPct, setTopPct] = useState(0)
  const [recipientCount, setRecipientCount] = useState(0)
  const [coverage, setCoverage] = useState<{ fromBlock: number; toBlock: number; truncated: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTopRecipients(tokenAddress).then(({ entries, recipientCount: sampledRecipients, totalValue, fromBlock, toBlock, truncated }) => {
      setCoverage({ fromBlock, toBlock, truncated })
      setRecipientCount(sampledRecipients)
      if (totalValue === 0n || entries.length === 0) { setLoading(false); return }
      const topSum = entries.reduce((a, e) => a + e.value, 0n)
      const otherSum = totalValue - topSum
      const toNum = (value: bigint) => Number((value * 10000n) / totalValue) / 100

      const chartData = entries.map((e) => ({
        name: `${e.address.slice(0, 6)}...${e.address.slice(-4)}`,
        value: toNum(e.value),
        pct: toNum(e.value),
      }))
      if (otherSum > 0n) {
        chartData.push({ name: 'Other sampled recipients', value: toNum(otherSum), pct: toNum(otherSum) })
      }

      setTopPct(Math.round(toNum(topSum)))
      setData(chartData)
      setLoading(false)
    })
  }, [tokenAddress])

  if (loading) return <div className="h-48 flex items-center justify-center text-white/30 text-sm">Loading recent recipient activity...</div>
  if (data.length === 0) return <div className="h-24 flex items-center justify-center text-white/30 text-sm">No transfers found in the bounded recent window.</div>

  return (
    <div>
      <p className="mb-3 text-xs text-white/35">
        Inbound transfer volume across {recipientCount.toLocaleString()} unique recipients
        {coverage ? ` in blocks ${coverage.fromBlock.toLocaleString()}-${coverage.toBlock.toLocaleString()}` : ''}.
        {coverage?.truncated ? ' This is a partial activity sample, not a holder balance reconstruction.' : ''}
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-48 h-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.name.startsWith('Other') ? '#374151' : HOLDER_COLORS[index % HOLDER_COLORS.length]}
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
            Top 10 inbound: <span className="text-white font-mono">{topPct}%</span>
            <span className="w-3 h-3 rounded-sm bg-gray-700 inline-block ml-2" />
            Other sampled: <span className="text-white font-mono">{100 - topPct}%</span>
          </div>
          {data.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.name.startsWith('Other') ? '#374151' : HOLDER_COLORS[i] }} />
              <span className="font-mono text-xs text-white/60 flex-1">{d.name}</span>
              <span className="font-mono text-xs text-white">{d.pct.toFixed(2)}%</span>
            </div>
          ))}
          {data.length > 6 && (
            <div className="text-xs text-white/30 pl-4">+ {data.length - 6} more sampled recipients</div>
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
    let active = true
    checkTokenSafety(tokenAddress)
      .then((result) => {
        if (active) setReport(result)
      })
      .catch(() => {
        if (active) {
          setReport({
            score: 'caution',
            checks: [{
              name: 'Automated analysis availability',
              status: 'unknown',
              detail: 'Automated checks were unavailable. No safety conclusion was made.',
            }],
          })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [tokenAddress])

  if (loading) return (
    <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
      <div className="text-sm text-white/30">Analyzing token safety...</div>
    </div>
  )
  if (!report) return null

  const badgeConfig = {
    safe: { icon: ShieldCheck, color: 'text-cyan-300', bg: 'bg-cyan-300/10 border-cyan-300/30', label: 'NO FLAGS FOUND' },
    caution: { icon: ShieldAlert, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', label: 'REVIEW SIGNALS' },
    risky: { icon: ShieldX, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', label: 'FLAGS FOUND' },
  }
  const cfg = badgeConfig[report.score]
  const Icon = cfg.icon

  const statusIcon = { pass: '✅', warn: '⚠️', fail: '❌', unknown: '❓' }
  const statusColor = { pass: 'text-green-400', warn: 'text-yellow-400', fail: 'text-red-400', unknown: 'text-white/40' }

  return (
    <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-medium text-white/50">Automated Contract Signals</h2>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.bg} ${cfg.color}`}>
          <Icon className="w-4 h-4" /> {cfg.label}
        </span>
      </div>
      <p className="mb-4 text-xs text-white/35">Heuristic bytecode and metadata checks only. This is not an audit or a safety guarantee.</p>
      <div className="space-y-2">
        {report.checks.map((check, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="text-base">{statusIcon[check.status]}</span>
            <div>
              <span className={`font-medium ${statusColor[check.status]}`}>
                {check.name === 'Liquidity locked' ? 'Dead-address token balance' : check.name}
              </span>
              <span className="text-white/40 ml-2 text-xs">
                {check.name === 'Liquidity locked'
                  ? 'Underlying token supply at a dead address does not prove that DEX LP tokens are locked.'
                  : check.detail}
              </span>
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
  const isValidAddress = /^0x[0-9a-fA-F]{40}$/.test(rawAddress)
  const address = isValidAddress ? rawAddress : ''

  const [details, setDetails] = useState<TokenDetails | null>(null)
  const [transfers, setTransfers] = useState<TokenTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { addActivity, isWatched, toggleWatchlist } = useLocalEngagement()
  const watched = isWatched('token', address)

  useEffect(() => {
    if (!isValidAddress) return
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [nextDetails, nextTransfers] = await Promise.all([
          getTokenDetails(address).catch((error: unknown) => {
            throw new Error(`Details: ${error instanceof Error ? error.message : 'Unable to load token'}`)
          }),
          getTokenTransfers(address, 20).catch(() => []),
        ])
        if (!active) return
        setDetails(nextDetails)
        setTransfers(nextTransfers)
      } catch (error: unknown) {
        if (active) setError(error instanceof Error ? error.message : 'Unable to load token')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [address, isValidAddress])

  useEffect(() => {
    if (!details) return
    addActivity({
      type: 'token',
      id: address,
      label: `${details.name} ($${details.symbol})`,
      href: `/explorer/token/${address}`,
      action: 'View token market',
    })
  }, [addActivity, address, details])

  const copyAddress = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareTweet = () => {
    if (!details) return
    const text = `${details.name} ($${details.symbol}) on LitVM\n\nRecent unique recipients: ${details.holderCount} | Supply: ${details.totalSupply}\n\nTrack it: ${window.location.href}`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  if (!isValidAddress) {
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

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <div className="pt-[120px] max-w-5xl mx-auto px-4 text-center py-20 text-white/50">Loading token details...</div>
      </main>
    )
  }

  if (error || !details) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-white">
        <div className="pt-[120px] max-w-5xl mx-auto px-4">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error || 'Token not found'}</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => toggleWatchlist({
                  type: 'token',
                  id: address,
                  label: `${details.name} ($${details.symbol})`,
                  href: `/explorer/token/${address}`,
                })}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                  watched
                    ? 'border-violet-300/30 bg-violet-300/12 text-violet-100'
                    : 'border-white/10 bg-white/5 text-white/65 hover:border-white/20 hover:text-white'
                }`}
              >
                {watched ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                {watched ? 'Watching' : 'Watch'}
              </button>
              <button
                onClick={shareTweet}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1DA1F2]/20 border border-[#1DA1F2]/30 text-[#1DA1F2] text-sm hover:bg-[#1DA1F2]/30 transition"
              >
                <Share2 className="w-4 h-4" /> Share Token
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <Stat label="Decimals" value={String(details.decimals)} />
            <Stat label="Total Supply" value={`${details.totalSupply} ${details.symbol}`} />
            <Stat label="Unique Recipients (Sample)" value={String(details.holderCount)} />
            <Stat label="Recent Transfers (Sample)" value={String(details.txCount24h)} />
          </div>
          {details.transferSample && (
            <p className="mt-3 text-xs text-white/35">
              Transfer sample: blocks {details.transferSample.scannedFromBlock.toLocaleString()}-{details.transferSample.toBlock.toLocaleString()}
              {details.transferSample.truncated ? '; partial newest-first coverage.' : '.'}
            </p>
          )}
        </div>

        <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-medium text-white/50">Market Actions</h2>
              <p className="mt-1 text-xs text-white/35">Chart, trade, liquidity, presale, contract, and creator links in one place.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link href={`/charts?q=${address}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">
              <BarChart3 className="w-4 h-4 text-cyan-200" /> Chart
            </Link>
            <Link href={`/swap?token1=${address}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">
              <Droplets className="w-4 h-4 text-pink-200" /> Swap
            </Link>
            <Link href={`/pool?q=${address}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">
              <Droplets className="w-4 h-4 text-emerald-200" /> Add LP
            </Link>
            <Link href={`/launchpad?q=${address}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">
              <ExternalLink className="w-4 h-4 text-violet-200" /> Presales
            </Link>
            <a href={`${LITVM_EXPLORER_URL}/token/${address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">
              <Users className="w-4 h-4 text-blue-200" /> External token view
            </a>
            <a href={`${LITVM_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">
              <ExternalLink className="w-4 h-4 text-white/50" /> Contract
            </a>
            {details.factoryProvenance === 'verified' && details.deployer ? (
              <Link href={`/explorer/address/${details.deployer}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">
                <ExternalLink className="w-4 h-4 text-amber-200" /> Creator
              </Link>
            ) : (
              <span className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-sm text-white/35">
                <ExternalLink className="w-4 h-4" /> Creator not indexed
              </span>
            )}
            <Link href="/ledger" className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">
              <ExternalLink className="w-4 h-4 text-fuchsia-200" /> Ledger update
            </Link>
          </div>
        </div>

        {/* Bounded recipient activity sample */}
        <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
          <h2 className="text-sm font-medium text-white/50 mb-4">Recent Inbound Recipient Activity</h2>
          <TransferRecipientChart tokenAddress={address} />
        </div>

        {/* Automated contract signals */}
        <SafetyScorePanel tokenAddress={address} />

        {/* Deployer Info */}
        <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
          <h2 className="text-sm font-medium text-white/50 mb-3">Deployer Info</h2>
          {details.factoryProvenance === 'verified' ? (
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
          ) : (
            <p className="text-sm text-white/35">This token was not found in the bounded Lester factory window, so creator and deployment fields are not asserted.</p>
          )}
        </div>

        {/* DEX / Price */}
        <div className="p-5 rounded-xl bg-[var(--surface-1)] border border-white/10 mb-6">
          <h2 className="text-sm font-medium text-white/50 mb-3">Indexed Market Data</h2>
          {details.priceUsd !== undefined ? (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Stat label="Indexed Price" value={`$${details.priceUsd?.toFixed(6)}`} />
              <Stat label="24h Volume" value={`$${details.volume24h?.toLocaleString()}`} />
              <Stat label="24h Change" value={`${details.priceChange24h !== undefined ? (details.priceChange24h >= 0 ? '+' : '') + details.priceChange24h.toFixed(2) + '%' : '—'}`} />
            </div>
          ) : (
            <p className="text-white/30 text-sm">No indexed market data. Open Market Charts to inspect current on-chain reserve ratios.</p>
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
