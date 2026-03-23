'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { ArrowLeft } from 'lucide-react'

// TODO: Replace with live RPC calls to LitVM node — endpoint: process.env.NEXT_PUBLIC_LITVM_RPC_URL

interface BlockTx {
  hash: string
  from: string
  to: string
  value: string
  gas: string
  status: 'Success' | 'Pending'
}

// Seeded pseudo-random generator for deterministic mock data
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

function seededHex(length: number, rand: () => number): string {
  const chars = '0123456789abcdef'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(rand() * 16)]
  }
  return result
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function generateBlockTxs(count: number, rand: () => number): BlockTx[] {
  return Array.from({ length: count }, () => ({
    hash: `0x${seededHex(64, rand)}`,
    from: `0x${seededHex(40, rand)}`,
    to: `0x${seededHex(40, rand)}`,
    value: (rand() * 50).toFixed(4),
    gas: (Math.floor(rand() * 50000) + 21000).toLocaleString(),
    status: rand() > 0.1 ? 'Success' as const : 'Pending' as const,
  }))
}

export default function BlockDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number: blockNumberStr } = use(params)

  // RP-006: Parse and validate block number
  const parsed = Number(blockNumberStr)
  const isValidBlockNumber = Number.isSafeInteger(parsed) && parsed >= 0
  const blockNumber = isValidBlockNumber ? parsed : 0

  // RP-006: Render error state if invalid
  if (!isValidBlockNumber) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
          <Link
            href="/explorer"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Explorer
          </Link>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Invalid block number</h1>
            <p className="text-white/60 mb-6">
              The block number &quot;{blockNumberStr}&quot; is not a valid block number.
              Block numbers must be non-negative integers.
            </p>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Explorer
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // RP-006: Memoized tx generation only runs for validated numeric input
  // Memoize mock data so it doesn't regenerate on re-renders
  // TODO: Fetch real block data from LitVM RPC
  const { blockHash, parentHash, validator, txCount, txs } = useMemo(() => {
    const rand = seededRandom(blockNumber)
    const count = Math.floor(rand() * 15) + 5
    return {
      blockHash: `0x${seededHex(64, rand)}`,
      parentHash: `0x${seededHex(64, rand)}`,
      validator: `0x${seededHex(40, rand)}`,
      txCount: count,
      txs: generateBlockTxs(count, rand),
    }
  }, [blockNumber])

  const details = [
    { label: 'Block Number', value: `#${blockNumber.toLocaleString()}` },
    { label: 'Block Hash', value: blockHash, mono: true, truncate: true },
    { label: 'Parent Hash', value: parentHash, mono: true, truncate: true },
    { label: 'Timestamp', value: 'Mar 19, 2026 14:32:18 UTC' },
    { label: 'Validator', value: validator, mono: true, truncate: true },
  ]

  const blockStats = [
    { label: 'Gas Used', value: '12,482,109 (59.4%)' },
    { label: 'Gas Limit', value: '21,000,000' },
    { label: 'Transactions', value: txCount.toString() },
    { label: 'Block Size', value: `${Math.floor(Math.random() * 40) + 15} KB` },
    { label: 'Block Time', value: '2.1s' },
  ]

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
        <Link
          href="/explorer"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explorer
        </Link>

        {/* Block Header */}
        <h1 className="text-2xl font-bold text-white mb-6">
          Block <span className="font-mono text-[var(--accent)]">#{blockNumber.toLocaleString()}</span>
        </h1>

        {/* Block Details */}
        <div className="rounded-xl border border-white/10 bg-[var(--surface-1)] mb-6 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Block Details</h2>
          </div>
          <div className="divide-y divide-white/5">
            {details.map((d) => (
              <div key={d.label} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-white/50">{d.label}</span>
                <span className={`text-sm text-white ${d.mono ? 'font-mono' : ''}`}>
                  {d.truncate ? truncateAddress(d.value) : d.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Block Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {blockStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-white/10 bg-[var(--surface-1)] px-4 py-3"
            >
              <p className="text-xs text-white/40 uppercase tracking-wider">{stat.label}</p>
              <p className="text-base font-semibold font-mono text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Transaction List */}
        <div className="rounded-xl border border-white/10 bg-[var(--surface-1)] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
              Transactions ({txCount})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                  <th className="px-5 py-3">Hash</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To</th>
                  <th className="px-5 py-3 text-right">Value</th>
                  <th className="px-5 py-3 text-right">Gas</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {txs.map((tx, i) => (
                  <tr key={`${tx.hash}-${i}`} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/explorer/tx/${tx.hash}`}
                        className="font-mono text-[var(--accent)] hover:underline"
                      >
                        {truncateAddress(tx.hash)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-white/70">{truncateAddress(tx.from)}</td>
                    <td className="px-5 py-3 font-mono text-white/70">{truncateAddress(tx.to)}</td>
                    <td className="px-5 py-3 text-right font-mono text-white/80">{tx.value} zkLTC</td>
                    <td className="px-5 py-3 text-right font-mono text-white/60">{tx.gas}</td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.status === 'Success'
                            ? 'bg-[var(--success)]/15 text-[var(--success)]'
                            : 'bg-[var(--warning)]/15 text-[var(--warning)]'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
