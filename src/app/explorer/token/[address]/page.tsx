'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { getTokenDetails, getTokenTransfers, type TokenDetails, type TokenTransfer } from '@/lib/token-indexer'
import { formatAddress, LITVM_EXPLORER_URL } from '@/lib/explorerRpc'
import { Copy, ExternalLink, Share2, ArrowLeft } from 'lucide-react'

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

export default function TokenDetailPage() {
  const params = useParams()
  const address = params.address as string

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
                <h1 className="text-2xl font-bold">{details.name}</h1>
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
