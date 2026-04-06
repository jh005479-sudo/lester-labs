'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { formatAddress, formatEtherFromHex, getTransactionByHash, getTransactionReceipt, hexToBigInt, hexToNumber, LITVM_EXPLORER_URL } from '@/lib/explorerRpc'

export default function TransactionDetailsPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params)
  const [tx, setTx] = useState<any>(null)
  const [receipt, setReceipt] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([getTransactionByHash(hash), getTransactionReceipt(hash)])
      .then(([txData, receiptData]) => {
        if (!active) return
        setTx(txData)
        setReceipt(receiptData)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load transaction')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [hash])

  if (loading) return <div className="p-6 pt-28 text-sm text-zinc-400">Loading transaction from LitVM testnet…</div>
  if (error || !tx) return <div className="p-6 pt-28 text-sm text-red-400">Transaction unavailable: {error || 'Not found'}</div>

  const gasUsed = receipt?.gasUsed ? hexToBigInt(receipt.gasUsed) : 0n
  const gasPrice = tx?.gasPrice ? hexToBigInt(tx.gasPrice) : 0n
  const txFeeWei = gasUsed * gasPrice
  const txFee = Number(txFeeWei) / 1e18
  const method = tx?.input && tx.input !== '0x' ? tx.input.slice(0, 10) : 'Transfer'

  return (
    <div className="mx-auto max-w-5xl px-6 pt-28 pb-10 text-zinc-100">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Transaction</p>
          <h1 className="mt-2 break-all font-mono text-lg">{hash}</h1>
        </div>
        <Link href={`${LITVM_EXPLORER_URL}/tx/${hash}`} target="_blank" className="inline-flex items-center gap-2 text-sm text-cyan-400">
          Open in Caldera Explorer <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm md:grid-cols-2">
        <div><span className="text-zinc-500">Transaction Hash</span><div className="mt-1 break-all font-mono">{hash}</div></div>
        <div><span className="text-zinc-500">Status and Method</span><div className="mt-1">{receipt?.status === '0x1' ? 'Success' : receipt?.status === '0x0' ? 'Failed' : 'Pending'} <span className="font-mono text-zinc-400">{method}</span></div></div>
        <div><span className="text-zinc-500">Block</span><div className="mt-1 font-mono">{hexToNumber(tx.blockNumber).toLocaleString()}</div></div>
        <div><span className="text-zinc-500">Nonce</span><div className="mt-1">{hexToNumber(tx.nonce).toLocaleString()}</div></div>
        <div><span className="text-zinc-500">From</span><div className="mt-1 break-all font-mono">{tx.from}</div></div>
        <div><span className="text-zinc-500">To / Contract</span><div className="mt-1 break-all font-mono">{tx.to || 'Contract Creation'}</div></div>
        <div><span className="text-zinc-500">Value</span><div className="mt-1">{formatEtherFromHex(tx.value)} zkLTC</div></div>
        <div><span className="text-zinc-500">Transaction Fee</span><div className="mt-1">{txFee ? `${txFee.toFixed(9)} zkLTC` : 'Pending'}</div></div>
        <div><span className="text-zinc-500">Gas Used</span><div className="mt-1">{receipt?.gasUsed ? hexToNumber(receipt.gasUsed).toLocaleString() : 'Pending'}</div></div>
        <div><span className="text-zinc-500">Gas Price</span><div className="mt-1">{gasPrice ? `${Number(gasPrice) / 1e9} Gwei` : 'Pending'}</div></div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm">
        <p className="mb-3 text-zinc-500">Quick links</p>
        <div className="flex flex-col gap-2 font-mono text-cyan-400">
          <Link href={`${LITVM_EXPLORER_URL}/address/${tx.from}`} target="_blank">From: {formatAddress(tx.from)}</Link>
          {tx.to ? <Link href={`${LITVM_EXPLORER_URL}/address/${tx.to}`} target="_blank">To: {formatAddress(tx.to)}</Link> : null}
          <Link href={`${LITVM_EXPLORER_URL}/block/${hexToNumber(tx.blockNumber)}`} target="_blank">Block: {hexToNumber(tx.blockNumber).toLocaleString()}</Link>
          <Link href={`${LITVM_EXPLORER_URL}/tx/${hash}`} target="_blank">Explorer tx page</Link>
        </div>
      </div>
    </div>
  )
}
