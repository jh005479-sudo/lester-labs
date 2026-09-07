'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ArrowUpRight, CheckCircle2, Clock3, CircleAlert } from 'lucide-react'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { transactionLabel, saveTrackedTransaction, type TransactionStage } from '@/lib/transactionHistory'
import { UsagePreference } from '@/components/shared/UsagePreference'

const labels: Record<TransactionStage, string> = {
  checking: 'Checking transaction', wallet: 'Waiting for your wallet', submitted: 'Waiting for confirmation',
  confirmed: 'Confirmed', reverted: 'Reverted', cancelled: 'Not sent', failed: 'Not submitted', unknown: 'Check your wallet',
}

export default function TransactionsPage() {
  const { address } = useAccount()
  const history = useTransactionHistory()
  const entries = address ? history.filter((entry) => entry.account.toLowerCase() === address.toLowerCase()) : history
  return <main className="workspace-page">
    <header className="workspace-heading"><div><p className="workspace-eyebrow">Your activity</p><h1>Transactions</h1><p>Follow confirmations and pick up where you left off.</p></div><Link className="workspace-button secondary" href="/projects">My projects <ArrowUpRight size={16} /></Link></header>
    <div className="workspace-panel">
      <p className="workspace-note">Saved on this device. LitVM testnet only.</p>
      {entries.length === 0 ? <div className="workspace-empty"><Clock3 size={28} /><h2>No transactions yet</h2><p>Your next transaction will appear here.</p><Link href="/projects" className="workspace-button">Start a project</Link></div> :
        <ul className="workspace-list">{entries.map((entry) => {
          const Icon = entry.stage === 'confirmed' ? CheckCircle2 : ['reverted', 'failed', 'cancelled'].includes(entry.stage) ? CircleAlert : Clock3
          return <li key={entry.id}><Icon size={20} className={entry.stage === 'confirmed' ? 'text-emerald-300' : 'text-violet-300'} /><div className="min-w-0 flex-1"><h2>{transactionLabel(entry.action)}</h2><p>{labels[entry.stage]} · {new Date(entry.createdAt).toLocaleString()}</p>{entry.stage === 'submitted' && <p>Keep the hash to check progress. Don’t send it again while confirmation is unknown.</p>}{entry.stage === 'unknown' && <><p>We couldn’t confirm whether your wallet sent this. Check its activity before trying again.</p><button className="workspace-button secondary mt-3" onClick={() => saveTrackedTransaction({ ...entry, stage: 'cancelled', updatedAt: Date.now() })}>I checked — it wasn’t sent</button></>}{entry.stage === 'wallet' && <p>If you left the wallet prompt, check your wallet before starting again.</p>}</div>{entry.hash && <Link href={`/explorer/tx/${entry.hash}`} className="workspace-button secondary">View <ArrowUpRight size={15} /></Link>}</li>
        })}</ul>}
    </div>
    <UsagePreference />
  </main>
}
