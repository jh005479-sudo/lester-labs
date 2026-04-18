'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, MessageSquare, Vote } from 'lucide-react'
import {
  formatAddress,
  formatEtherFromHex,
  getTransactionByHash,
  getTransactionReceipt,
  hexToBigInt,
  hexToNumber,
  LITVM_EXPLORER_EXTERNAL,
  LITVM_EXPLORER_URL,
} from '@/lib/explorerRpc'
import { LEDGER_ADDRESS } from '@/config/contracts'
import { GOVERNANCE_CONFIG } from '@/config/governance'

// ── Calldata decoders ─────────────────────────────────────────────────────────

const LEDGER_POST_SEL = '0xbaf9b369'

const GOV_SELECTORS: Record<string, string> = {
  '0x5f357e76': 'castVote',
  '0xdc648a21': 'castVoteWithReason',
  '0xbe3df5a3': 'propose',
  '0x8d42e955': 'queue',
  '0xfe3419a2': 'execute',
  '0x539b5c9b': 'cancel',
  '0x017d2c4c': 'delegate',
  '0x5c60da1b': 'getVotes',
}

const SUPPORT_LABELS: Record<string, string> = { '0': 'Against', '1': 'For', '2': 'Abstain' }

function decodeLedgerMessage(inputHex: string): string | null {
  if (!inputHex || inputHex === '0x' || inputHex.length < 140) return null
  const sel = inputHex.slice(0, 10).toLowerCase()
  if (sel !== LEDGER_POST_SEL) return null
  try {
    const data = inputHex.slice(2)
    const byteLen = parseInt(data.slice(72, 136), 16)
    if (byteLen === 0 || byteLen > 1024) return null
    const byteStart = 136
    const byteHex = data.slice(byteStart, byteStart + byteLen * 2)
    const bytes = Buffer.from(byteHex, 'hex')
    return bytes.toString('utf8').replace(/\0+$/, '')
  } catch { return null }
}

/** Decode governance function calls from raw calldata */
function decodeGovernance(tx: any): { method: string; detail: string; proposalId?: string } | null {
  if (!tx.input || tx.input === '0x' || tx.input.length < 10) return null
  const sel = tx.input.slice(0, 10).toLowerCase()
  const method = GOV_SELECTORS[sel]
  if (!method) return null

  try {
    if (method === 'castVote') {
      const proposalId = BigInt('0x' + tx.input.slice(10, 74)).toString()
      const support = ['Against', 'For', 'Abstain'][parseInt(tx.input.slice(74, 76), 16)]
      return { method, detail: `${support} — Proposal #${proposalId}`, proposalId }
    }
    if (method === 'castVoteWithReason') {
      const proposalId = BigInt('0x' + tx.input.slice(10, 74)).toString()
      const support = ['Against', 'For', 'Abstain'][parseInt(tx.input.slice(74, 76), 16)]
      // Reason is ABI-encoded string — skip for now, just show vote
      return { method, detail: `${support} — Proposal #${proposalId}`, proposalId }
    }
    if (method === 'propose') {
      return { method, detail: 'New governance proposal submitted', proposalId: undefined }
    }
    if (method === 'execute') {
      const proposalId = BigInt('0x' + tx.input.slice(10, 74)).toString()
      return { method, detail: `Execute Proposal #${proposalId}`, proposalId }
    }
    if (method === 'queue') {
      const proposalId = BigInt('0x' + tx.input.slice(10, 74)).toString()
      return { method, detail: `Queue Proposal #${proposalId}`, proposalId }
    }
    if (method === 'cancel') {
      const proposalId = BigInt('0x' + tx.input.slice(10, 74)).toString()
      return { method, detail: `Cancel Proposal #${proposalId}`, proposalId }
    }
    return { method, detail: method }
  } catch { return { method, detail: method } }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransactionDetailsPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params)
  const [tx, setTx] = useState<any>(null)
  const [receipt, setReceipt] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isGovernance =
    tx?.to && tx.to.toLowerCase() === GOVERNANCE_CONFIG.governor.address.toLowerCase()

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
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hash])

  if (loading) return <div className="p-6 pt-28 text-sm text-zinc-400">Loading transaction from LitVM testnet…</div>
  if (error || !tx) return <div className="p-6 pt-28 text-sm text-red-400">Transaction unavailable: {error || 'Not found'}</div>

  const gasUsed: bigint = receipt?.gasUsed ? BigInt(hexToBigInt(receipt.gasUsed)) : 0n
  const gasPrice: bigint = tx?.gasPrice ? BigInt(hexToBigInt(tx.gasPrice)) : 0n
  const txFeeWei = gasUsed * gasPrice
  const txFee = Number(txFeeWei) / 1e18
  const rawMethod = tx?.input && tx.input !== '0x' ? tx.input.slice(0, 10) : null
  const ledgerMessage = tx?.to?.toLowerCase() === LEDGER_ADDRESS.toLowerCase() ? decodeLedgerMessage(tx.input) : null
  const govTx = isGovernance ? decodeGovernance(tx) : null

  return (
    <div className="mx-auto max-w-5xl px-6 pt-28 pb-10 text-zinc-100">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Transaction</p>
          <h1 className="mt-2 break-all font-mono text-lg">{hash}</h1>
        </div>
        <Link
          href={`${LITVM_EXPLORER_EXTERNAL}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
        >
          View on Caldera <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      {/* Governance transaction banner */}
      {govTx && (
        <div className="mb-6 rounded-2xl border border-[#E44FB5]/30 bg-[#E44FB5]/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Vote className="h-4 w-4 text-[#E44FB5]" />
            <span className="text-sm font-semibold text-[#E44FB5] uppercase tracking-wider">Governance Transaction</span>
          </div>
          <div className="space-y-1 text-sm">
            <div><span className="text-zinc-500">Method:</span> <span className="font-mono text-white">{govTx.method}()</span></div>
            <div><span className="text-zinc-500">Action:</span> <span className="text-white">{govTx.detail}</span></div>
            {govTx.proposalId && (
              <div>
                <span className="text-zinc-500">Proposal:</span>{' '}
                <Link
                  href={`${LITVM_EXPLORER_URL}/address/${GOVERNANCE_CONFIG.governor.address}?proposal=${govTx.proposalId}`}
                  className="text-[#E44FB5] hover:underline"
                >
                  #{govTx.proposalId}
                </Link>
              </div>
            )}
            <div className="pt-1 text-xs text-zinc-500">
              Contract: <span className="font-mono">{GOVERNANCE_CONFIG.governor.address}</span>
            </div>
          </div>
        </div>
      )}

      {/* Core tx details */}
      <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm md:grid-cols-2">
        <div><span className="text-zinc-500">Status</span><div className="mt-1">{receipt?.status === '0x1' ? '✅ Success' : receipt?.status === '0x0' ? '❌ Failed' : '⏳ Pending'}</div></div>
        <div><span className="text-zinc-500">Method</span><div className="mt-1 font-mono text-zinc-300">{govTx ? `${govTx.method}()` : rawMethod ? `${rawMethod}` : 'Transfer'}</div></div>
        <div><span className="text-zinc-500">Block</span><div className="mt-1 font-mono">{hexToNumber(tx.blockNumber).toLocaleString()}</div></div>
        <div><span className="text-zinc-500">Nonce</span><div className="mt-1">{hexToNumber(tx.nonce).toLocaleString()}</div></div>
        <div><span className="text-zinc-500">From</span><div className="mt-1 break-all font-mono text-xs">{tx.from}</div></div>
        <div><span className="text-zinc-500">To / Contract</span><div className="mt-1 break-all font-mono text-xs">{tx.to || 'Contract Creation'}</div></div>
        <div><span className="text-zinc-500">Value</span><div className="mt-1">{formatEtherFromHex(tx.value)} zkLTC</div></div>
        <div><span className="text-zinc-500">Transaction Fee</span><div className="mt-1">{txFee ? `${txFee.toFixed(9)} zkLTC` : 'Pending'}</div></div>
        <div><span className="text-zinc-500">Gas Used</span><div className="mt-1">{receipt?.gasUsed ? hexToNumber(receipt.gasUsed).toLocaleString() : 'Pending'}</div></div>
        <div><span className="text-zinc-500">Gas Price</span><div className="mt-1">{gasPrice ? `${Number(gasPrice) / 1e9} Gwei` : 'Pending'}</div></div>
      </div>

      {/* Quick links */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm">
        <p className="mb-3 text-zinc-500 uppercase tracking-wider">Quick links</p>
        <div className="flex flex-col gap-2 font-mono text-cyan-400">
          <Link href={`${LITVM_EXPLORER_URL}/address/${tx.from}`} target="_blank">From: {formatAddress(tx.from)}</Link>
          {tx.to && <Link href={`${LITVM_EXPLORER_URL}/address/${tx.to}`} target="_blank">To: {formatAddress(tx.to)}</Link>}
          <Link href={`${LITVM_EXPLORER_URL}/block/${hexToNumber(tx.blockNumber)}`} target="_blank">Block: {hexToNumber(tx.blockNumber).toLocaleString()}</Link>
          <Link href={`${LITVM_EXPLORER_EXTERNAL}/tx/${hash}`} target="_blank" rel="noopener noreferrer">View on Caldera Explorer →</Link>
        </div>
      </div>

      {/* TheLedger message */}
      {ledgerMessage && (
        <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6">
          <div className="mb-3 flex items-center gap-2 text-purple-400">
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium uppercase tracking-wider">Ledger Message</span>
          </div>
          <p className="font-mono text-base leading-relaxed text-zinc-100">{ledgerMessage}</p>
          <p className="mt-3 text-xs text-zinc-500">Inscribed permanently on-chain via lester-labs.com/ledger</p>
        </div>
      )}
    </div>
  )
}
