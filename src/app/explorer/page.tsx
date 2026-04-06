'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { Search, Twitter } from 'lucide-react'

// TODO: Replace with live RPC calls to LitVM node — endpoint: process.env.NEXT_PUBLIC_LITVM_RPC_URL

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

const VALIDATORS = [
  '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
  '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
  '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
  '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
]

function randomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function generateBlock(number: number, secondsAgo: number): Block {
  return {
    number,
    time: `${secondsAgo}s ago`,
    txCount: Math.floor(Math.random() * 20) + 3,
    validator: VALIDATORS[Math.floor(Math.random() * VALIDATORS.length)],
    sizeKB: Math.floor(Math.random() * 50) + 10,
  }
}

function generateTx(secondsAgo: number): Transaction {
  return {
    hash: `0x${randomHex(64)}`,
    from: `0x${randomHex(40)}`,
    to: `0x${randomHex(40)}`,
    value: (Math.random() * 100).toFixed(4),
    time: `${secondsAgo}s ago`,
    status: Math.random() > 0.15 ? 'Success' : 'Pending',
  }
}

const INITIAL_BLOCK = 1284091

function generateInitialBlocks(): Block[] {
  return Array.from({ length: 8 }, (_, i) => generateBlock(INITIAL_BLOCK - i, (i + 1) * 3))
}

function generateInitialTxs(): Transaction[] {
  return Array.from({ length: 8 }, (_, i) => generateTx((i + 1) * 2 + 1))
}

export default function ExplorerPage() {
  const [blocks, setBlocks] = useState<Block[]>(generateInitialBlocks)
  const [txs, setTxs] = useState<Transaction[]>(generateInitialTxs)
  const [latestBlock, setLatestBlock] = useState(INITIAL_BLOCK)
  const [searchQuery, setSearchQuery] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  const addNewData = useCallback(() => {
    setLatestBlock((prev) => {
      const next = prev + 1
      setBlocks((prevBlocks) => [generateBlock(next, 1), ...prevBlocks.slice(0, 7)])
      setTxs((prevTxs) => [generateTx(1), ...prevTxs.slice(0, 7)])
      return next
    })
  }, [])

  useEffect(() => {
    const interval = setInterval(addNewData, 5000)
    return () => clearInterval(interval)
  }, [addNewData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  const handleTweet = () => {
    const text = `🔬 LitVM Network Stats via @LesterLabs\n\n📦 Block: #${latestBlock.toLocaleString()}\n⚡ TPS: 47.3\n🔄 24h Txs: 128,440\n⏱️ Block Time: 2.1s\n\nBuilding on LitVM 🧪⚗️\n\nlesterlabs.vercel.app/explorer\n\n#LitVM #Litecoin #DeFi`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  const stats = [
    { label: 'Latest Block', value: `#${latestBlock.toLocaleString()}` },
    { label: 'Block Time', value: '2.1s avg' },
    { label: 'TPS', value: '47.3' },
    { label: 'Active Validators', value: '21' },
    { label: '24h Transactions', value: '128,440' },
    { label: 'zkLTC Price', value: '$0.0842' },
  ]

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />
      <LTCBanner />

      <main className="mx-auto max-w-7xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        {/* Network Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-white/10 bg-[var(--surface-1)] px-4 py-3"
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
            className="w-full rounded-lg border border-white/10 bg-[var(--surface-1)] py-3 pl-12 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none transition-colors font-mono"
          />
        </form>

        {/* Toast */}
        {toastVisible && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-[var(--warning)]/30 bg-[var(--surface-2)] px-5 py-3 text-sm text-[var(--warning)] shadow-lg">
            RPC not yet connected — check back at mainnet launch
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latest Blocks */}
          <div className="rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
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
          <div className="rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
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

      {/* Tweet Snapshot Button */}
      <button
        onClick={handleTweet}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 sm:px-5 py-3 text-sm font-medium text-white shadow-lg hover:opacity-90 transition-opacity"
      >
        <Twitter className="h-4 w-4" />
        Share Stats
      </button>
    </div>
  )
}
