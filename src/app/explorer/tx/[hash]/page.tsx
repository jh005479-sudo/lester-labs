'use client'

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { ArrowLeft, Copy, Check } from 'lucide-react'

// TODO: Replace with live RPC calls to LitVM node — endpoint: process.env.NEXT_PUBLIC_LITVM_RPC_URL

// Seeded pseudo-random generator for deterministic mock data
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

// Convert hash string to numeric seed
function hashToSeed(hash: string): number {
  let seed = 0
  for (let i = 0; i < hash.length; i++) {
    seed = ((seed << 5) - seed + hash.charCodeAt(i)) | 0
  }
  return Math.abs(seed)
}

function seededHex(length: number, rand: () => number): string {
  const chars = '0123456789abcdef'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(rand() * 16)]
  }
  return result
}

function CopyableValue({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 text-sm text-white hover:text-[var(--accent)] transition-colors ${
        mono ? 'font-mono' : ''
      }`}
    >
      <span className="break-all text-left">{value}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-white/30" />
      )}
    </button>
  )
}

export default function TxDetailPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params)

  // Memoize mock data so it doesn't regenerate on re-renders
  // TODO: Fetch real transaction data from LitVM RPC
  const { blockNumber, from, to, value, gasPrice, gasUsed, totalFee, status, confirmations } = useMemo(() => {
    const rand = seededRandom(hashToSeed(hash))
    return {
      blockNumber: 1284088 - Math.floor(rand() * 100),
      from: `0x${seededHex(40, rand)}`,
      to: `0x${seededHex(40, rand)}`,
      value: (rand() * 100).toFixed(4),
      gasPrice: '0.000000025',
      gasUsed: '21,000',
      totalFee: '0.000525',
      status: (rand() > 0.1 ? 'Success' : 'Pending') as 'Success' | 'Pending',
      confirmations: Math.floor(rand() * 100) + 1,
    }
  }, [hash])

  const overviewRows: Array<{ label: string; content: React.ReactNode }> = [
    {
      label: 'Transaction Hash',
      content: <CopyableValue value={hash} />,
    },
    {
      label: 'Status',
      content: (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            status === 'Success'
              ? 'bg-[var(--success)]/15 text-[var(--success)]'
              : 'bg-[var(--warning)]/15 text-[var(--warning)]'
          }`}
        >
          {status}
        </span>
      ),
    },
    {
      label: 'Block',
      content: (
        <Link
          href={`/explorer/block/${blockNumber}`}
          className="font-mono text-sm text-[var(--accent)] hover:underline"
        >
          #{blockNumber.toLocaleString()}
        </Link>
      ),
    },
    {
      label: 'Timestamp',
      content: <span className="text-sm text-white">Mar 19, 2026 14:30:06 UTC</span>,
    },
    {
      label: 'Confirmations',
      content: <span className="text-sm font-mono text-white">{confirmations}</span>,
    },
  ]

  const transferRows: Array<{ label: string; content: React.ReactNode }> = [
    {
      label: 'From',
      content: <CopyableValue value={from} />,
    },
    {
      label: 'To',
      content: <CopyableValue value={to} />,
    },
    {
      label: 'Value',
      content: <span className="text-sm font-mono text-white">{value} zkLTC</span>,
    },
  ]

  const gasRows: Array<{ label: string; content: React.ReactNode }> = [
    {
      label: 'Gas Price',
      content: <span className="text-sm font-mono text-white">{gasPrice} zkLTC</span>,
    },
    {
      label: 'Gas Used',
      content: <span className="text-sm font-mono text-white">{gasUsed}</span>,
    },
    {
      label: 'Transaction Fee',
      content: <span className="text-sm font-mono text-white">{totalFee} zkLTC</span>,
    },
    {
      label: 'Input Data',
      content: <span className="text-sm font-mono text-white/50">0x</span>,
    },
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

        <h1 className="text-2xl font-bold text-white mb-6">Transaction Details</h1>

        {/* Overview */}
        <Section title="Overview">
          {overviewRows.map((row) => (
            <Row key={row.label} label={row.label}>
              {row.content}
            </Row>
          ))}
        </Section>

        {/* Transfer */}
        <Section title="Transfer">
          {transferRows.map((row) => (
            <Row key={row.label} label={row.label}>
              {row.content}
            </Row>
          ))}
        </Section>

        {/* Gas & Fee */}
        <Section title="Gas & Fee">
          {gasRows.map((row) => (
            <Row key={row.label} label={row.label}>
              {row.content}
            </Row>
          ))}
        </Section>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--surface-1)] mb-6 overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3">
      <span className="text-sm text-white/50 shrink-0 sm:w-40">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
