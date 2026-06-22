'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { ShareModal } from '@/components/ShareModal'
import { LiveActivityRail } from '@/components/shared/LiveActivityRail'
import { BarChart3, BookmarkPlus, Coins, Droplets, Search } from 'lucide-react'
import { useLocalEngagement } from '@/hooks/useLocalEngagement'
import { createEmptyExplorerSummary, type ExplorerSummary } from '@/lib/explorerSummary'
import { LITVM_EXPLORER_URL } from '@/lib/explorerRpc'

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function ExplorerPage() {
  const [summary, setSummary] = useState<ExplorerSummary>(() => createEmptyExplorerSummary())
  const [loadingBlocks, setLoadingBlocks] = useState(true)
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const { saveSearch, addActivity, scopedSearches } = useLocalEngagement()
  const savedExplorerSearches = scopedSearches('explorer')

  useEffect(() => {
    let active = true
    const loadStage = async (stage: 'blocks' | 'transactions') => {
      try {
        if (!active) return
        const res = await fetch(`/api/explorer/summary?stage=${stage}`, {
          cache: 'no-store',
        })
        const data = await res.json() as ExplorerSummary
        if (!active) return
        setSummary((current) => ({
          latestBlock: data.latestBlock || current.latestBlock,
          blocks: data.blocks.length > 0 ? data.blocks : current.blocks,
          transactions: stage === 'transactions' ? data.transactions : current.transactions,
          updatedAt: data.updatedAt ?? current.updatedAt,
        }))
      } catch (e) {
        console.error('Failed to load live explorer data', e)
      } finally {
        if (!active) return
        if (stage === 'blocks') setLoadingBlocks(false)
        if (stage === 'transactions') setLoadingTransactions(false)
      }
    }

    const load = () => {
      setLoadingBlocks(true)
      setLoadingTransactions(true)
      loadStage('blocks').then(() => loadStage('transactions'))
    }

    load()
    const interval = setInterval(load, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) setSearchQuery(q)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    saveSearch('explorer', q)
    addActivity({
      type: 'wallet',
      id: q,
      label: q.length > 24 ? `${q.slice(0, 10)}...${q.slice(-8)}` : q,
      href: `/explorer?q=${encodeURIComponent(q)}`,
      action: 'Search explorer',
    })
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
    window.open(`${LITVM_EXPLORER_URL}/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer')
  }

  const stats = [
    { label: 'Latest Block', value: summary.latestBlock ? `#${summary.latestBlock.toLocaleString()}` : 'Ready' },
    { label: 'Block Time', value: summary.blocks.length > 1 ? 'Live' : loadingBlocks ? 'Syncing' : '—' },
    { label: 'Recent Blocks', value: loadingBlocks && summary.blocks.length === 0 ? 'Syncing' : summary.blocks.length.toString() },
    { label: 'Sampled Txs', value: loadingTransactions && summary.transactions.length === 0 ? 'Syncing' : summary.transactions.length.toString() },
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

        <LiveActivityRail surface="explorer" />

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
        <div className="-mt-5 mb-8 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => saveSearch('explorer', searchQuery)}
            disabled={!searchQuery.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <BookmarkPlus size={13} />
            Save search
          </button>
          {savedExplorerSearches.slice(0, 4).map((search) => (
            <button
              key={`${search.query}:${search.updatedAt}`}
              type="button"
              onClick={() => setSearchQuery(search.query)}
              className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-xs text-white/45 transition hover:border-white/15 hover:text-white/75"
            >
              {search.query.length > 24 ? `${search.query.slice(0, 12)}...${search.query.slice(-8)}` : search.query}
            </button>
          ))}
        </div>

        {/* Explorer actions */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <Link href="/explorer/tokens" className="analytics-card rounded-lg border border-white/10 bg-[var(--surface-1)] p-4 no-underline transition hover:border-white/20">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <Coins size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Token Launch Tracker</p>
                <p className="mt-1 text-xs text-white/40">Search new LitVM assets.</p>
              </div>
            </div>
          </Link>
          <Link href="/charts" className="analytics-card rounded-lg border border-white/10 bg-[var(--surface-1)] p-4 no-underline transition hover:border-white/20">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-300/20 bg-violet-300/10 text-violet-200">
                <BarChart3 size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Market Charts</p>
                <p className="mt-1 text-xs text-white/40">Price and reserve views.</p>
              </div>
            </div>
          </Link>
          <Link href="/pool" className="analytics-card rounded-lg border border-white/10 bg-[var(--surface-1)] p-4 no-underline transition hover:border-white/20">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-pink-300/20 bg-pink-300/10 text-pink-200">
                <Droplets size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">DEX Pools</p>
                <p className="mt-1 text-xs text-white/40">Inspect pairs and liquidity.</p>
              </div>
            </div>
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
              {summary.blocks.map((block) => (
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
              {summary.blocks.length === 0 && (
                Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-24 animate-pulse rounded bg-white/8" />
                      <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
                    </div>
                    <div className="h-4 w-20 animate-pulse rounded bg-white/8" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Latest Transactions */}
          <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Latest Transactions</h2>
              <span className="text-xs text-white/40">Auto-refreshing</span>
            </div>
            <div className="divide-y divide-white/5">
              {summary.transactions.map((tx, i) => (
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
              {summary.transactions.length === 0 && (
                Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="space-y-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-white/8" />
                      <div className="h-3 w-44 animate-pulse rounded bg-white/5" />
                    </div>
                    <div className="h-4 w-20 animate-pulse rounded bg-white/8" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Share Stats Modal + Button */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        stats={{
          blockHeight: summary.latestBlock,
          txCount24h: summary.transactions.length * 3000, // estimated from recent sample
          activeAddresses24h: summary.transactions.length * 200,
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
