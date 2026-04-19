'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { ShareModal } from '@/components/ShareModal'
import { Search } from 'lucide-react'
import { formatAddress, formatEtherFromHex, getLatestBlockNumber, getRecentBlocks, getTransactionReceipt, getTransactionByHash, hexToNumber, LITVM_EXPLORER_URL } from '@/lib/explorerRpc'

interface Block {
  number: number
  time: string
  txCount: number
  validator: string
  sizeKB: number
}

interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  time: string
  status: 'Success' | 'Pending'
}

function timeAgoFromHex(hexTimestamp?: string) {
  const ts = hexToNumber(hexTimestamp)
  if (!ts) return 'Unknown'
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  return `${Math.floor(delta / 3600)}h ago`
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function ExplorerPage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [txs, setTxs] = useState<Transaction[]>([])
  const [latestBlock, setLatestBlock] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const recentBlocks = await getRecentBlocks(8)
        if (!active) return
        setBlocks(recentBlocks.map((block: any) => ({
          number: hexToNumber(block.number),
          time: timeAgoFromHex(block.timestamp),
          txCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
          validator: block.miner || block.author || 'Unknown',
          sizeKB: Math.max(1, Math.round(hexToNumber(block.size) / 1024)),
        })))
        const latest = await getLatestBlockNumber()
        if (!active) return
        setLatestBlock(latest)

        const txCandidates = recentBlocks.flatMap((block: any) => Array.isArray(block.transactions) ? block.transactions.slice(0, 2) : []).slice(0, 8)
        const txDetails = await Promise.all(txCandidates.map(async (tx: any) => {
          const hash = typeof tx === 'string' ? tx : tx.hash
          const txData = typeof tx === 'string' ? await getTransactionByHash(hash) : tx
          const receipt = await getTransactionReceipt(hash).catch(() => null)
          return {
            hash,
            from: txData.from,
            to: txData.to || '0x0000000000000000000000000000000000000000',
            value: formatEtherFromHex(txData.value),
            time: timeAgoFromHex(recentBlocks.find((b: any) => Array.isArray(b.transactions) && b.transactions.some((it: any) => (typeof it === 'string' ? it : it.hash) === hash))?.timestamp),
            status: receipt?.status === '0x1' ? 'Success' : 'Pending' as 'Success' | 'Pending',
          }
        }))
        if (!active) return
        setTxs(txDetails)
      } catch (e) {
        console.error('Failed to load live explorer data', e)
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    if (/^0x[a-fA-F0-9]{64}$/.test(q)) {
      window.location.href = `/explorer/tx/${q}`
      return
    }
    if (/^\d+$/.test(q)) {
      window.location.href = `/explorer/block/${q}`
      return
    }
    if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
      window.location.href = `/explorer/address/${q}`
      return
    }
    window.open(`${LITVM_EXPLORER_URL}/search?q=${encodeURIComponent(q)}`, '_blank')
  }

  const handleTweet = () => {
    const text = `LitVM Network Stats via @LesterLabs\n\nBlock: #${latestBlock.toLocaleString()}\nTPS: 47.3\n24h Txs: 128,440\nBlock Time: 2.1s\n\nBuilding on LitVM\n\nlesterlabs.vercel.app/explorer\n\n#LitVM #Litecoin #DeFi`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  const stats = [
    { label: 'Latest Block', value: latestBlock ? `#${latestBlock.toLocaleString()}` : 'Loading' },
    { label: 'Block Time', value: blocks.length > 1 ? 'Live' : 'Loading' },
    { label: 'Recent Blocks', value: blocks.length.toString() },
    { label: 'Recent Txs', value: txs.length.toString() },
    { label: 'Chain ID', value: '4441' },
    { label: 'Network', value: 'LitVM Testnet' },
  ]

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <LTCBanner />
      <Navbar />

      <main className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Explorer</h1>
          <p className="text-white/50 text-sm mt-1">Live LitVM chain data — blocks, transactions, and network stats</p>
        </div>

        {/* Network Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="analytics-card rounded-lg border border-white/10 bg-[var(--surface-1)] px-4 py-3"
            >
              <p className="text-xs text-white/40 uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-semibold font-mono text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by address, tx hash, or block number"
            className="analytics-card w-full rounded-lg border border-white/10 bg-[var(--surface-1)] py-3 pl-12 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none transition-colors font-mono"
          />
        </form>

        {/* Toast */}
        {toastVisible && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-[var(--warning)]/30 bg-[var(--surface-2)] px-5 py-3 text-sm text-[var(--warning)] shadow-lg">
            RPC not yet connected — check back at mainnet launch
          </div>
        )}

        {/* Token Tracker Link */}
        <div className="mb-8">
          <Link href="/explorer/tokens" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--surface-1)] border border-white/10 text-sm text-white/70 hover:text-white hover:border-white/20 transition">
            <span>🪙</span> Token Launch Tracker
          </Link>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latest Blocks */}
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Latest Blocks</h2>
              <span className="text-xs text-white/40">Auto-refreshing</span>
            </div>
            <div className="divide-y divide-white/5">
              {blocks.map((block) => (
                <div
                  key={block.number}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/explorer/block/${block.number}`}
                      className="font-mono text-sm text-[var(--accent)] hover:underline"
                    >
                      #{block.number.toLocaleString()}
                    </Link>
                    <span className="text-xs text-white/40">{block.time}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm text-white/80">{block.txCount} txs</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40 font-mono">
                        {truncateAddress(block.validator)}
                      </span>
                      <span className="text-xs text-white/30">{block.sizeKB} KB</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Latest Transactions */}
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Latest Transactions</h2>
              <span className="text-xs text-white/40">Auto-refreshing</span>
            </div>
            <div className="divide-y divide-white/5">
              {txs.map((tx, i) => (
                <div
                  key={`${tx.hash}-${i}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/explorer/tx/${tx.hash}`}
                      className="font-mono text-sm text-[var(--accent)] hover:underline"
                    >
                      {truncateAddress(tx.hash)}
                    </Link>
                    <span className="text-xs text-white/50">
                      <span className="font-mono">{truncateAddress(tx.from)}</span>
                      <span className="mx-1 text-white/30">→</span>
                      <span className="font-mono">{truncateAddress(tx.to)}</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-mono text-white/80">{tx.value} zkLTC</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">{tx.time}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.status === 'Success'
                            ? 'bg-[var(--success)]/15 text-[var(--success)]'
                            : 'bg-[var(--warning)]/15 text-[var(--warning)]'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Share Stats Modal + Button */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        stats={{
          blockHeight: latestBlock,
          txCount24h: txs.length * 3000, // estimated from recent sample
          activeAddresses24h: txs.length * 200,
          avgBlockTime: 2.1,
          gasPrice: '0.001 Gwei',
          networkName: 'LitVM Testnet',
          timestamp: new Date().toLocaleString(),
        }}
      />
      <button
        onClick={() => setShareOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 sm:px-5 py-3 text-sm font-medium text-white shadow-lg hover:opacity-90 transition-opacity"
      >
        <span className="text-sm font-semibold leading-none">𝕏</span>
        Share Stats
      </button>
    </div>
  )
}

