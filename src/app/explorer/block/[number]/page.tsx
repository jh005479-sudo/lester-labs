'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { formatAddress, getBlockByNumber, hexToNumber, LITVM_EXPLORER_URL } from '@/lib/explorerRpc'

export default function BlockDetailsPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params)
  const blockNumber = Number(number)
  const [block, setBlock] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getBlockByNumber(blockNumber, true)
      .then((data) => {
        if (!active) return
        setBlock(data)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load block')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [blockNumber])

  if (loading) return <div className="p-6 pt-28 text-sm text-zinc-400">Loading block from LitVM testnet…</div>
  if (error || !block) return <div className="p-6 pt-28 text-sm text-red-400">Block unavailable: {error || 'Not found'}</div>

  const txs = Array.isArray(block.transactions) ? block.transactions : []

  return (
    <div className="mx-auto max-w-5xl px-6 pt-28 pb-10 text-zinc-100">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Block</p>
          <h1 className="mt-2 font-mono text-2xl">#{blockNumber.toLocaleString()}</h1>
        </div>
        <Link href={`${LITVM_EXPLORER_URL}/block/${blockNumber}`} target="_blank" className="inline-flex items-center gap-2 text-sm text-cyan-400">
          Open in Lester Labs Explorer <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm md:grid-cols-2">
        <div><span className="text-zinc-500">Hash</span><div className="mt-1 break-all font-mono">{block.hash}</div></div>
        <div><span className="text-zinc-500">Transactions</span><div className="mt-1">{txs.length.toLocaleString()}</div></div>
        <div><span className="text-zinc-500">Gas Used</span><div className="mt-1">{hexToNumber(block.gasUsed).toLocaleString()}</div></div>
        <div><span className="text-zinc-500">Gas Limit</span><div className="mt-1">{hexToNumber(block.gasLimit).toLocaleString()}</div></div>
        <div><span className="text-zinc-500">Miner / Sequencer</span><div className="mt-1 font-mono">{block.miner}</div></div>
        <div><span className="text-zinc-500">Parent Hash</span><div className="mt-1 break-all font-mono">{block.parentHash}</div></div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6">
        <p className="mb-4 text-sm uppercase tracking-[0.2em] text-zinc-500">Transactions</p>
        <div className="space-y-3 text-sm">
          {txs.slice(0, 25).map((tx: any) => {
            const hash = typeof tx === 'string' ? tx : tx.hash
            const from = typeof tx === 'string' ? '' : tx.from
            const to = typeof tx === 'string' ? '' : tx.to
            return (
              <Link key={hash} href={`/explorer/tx/${hash}`} className="block rounded-xl border border-white/10 p-3 hover:border-cyan-400/40">
                <div className="font-mono text-cyan-400">{hash}</div>
                <div className="mt-1 text-zinc-400">{formatAddress(from)} → {formatAddress(to)}</div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
