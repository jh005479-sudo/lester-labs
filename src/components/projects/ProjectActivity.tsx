'use client'

import Link from 'next/link'
import { useIndexedActivity } from '@/hooks/useIndexedActivity'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { transactionLabel } from '@/lib/transactionHistory'
import { lockVerificationLink } from '@/lib/projectJourney'
import { LIQUIDITY_LOCKER_ADDRESS } from '@/config/contracts'

export function ProjectActivity({ token, pair }: { token: string; pair?: string }) {
  const locks = useIndexedActivity('locks')
  const sales = useIndexedActivity('presales')
  const transactions = useTransactionHistory().filter((entry) => entry.asset?.toLowerCase() === token.toLowerCase()).slice(0, 8)
  const tokenTopic = `0x${token.slice(2).toLowerCase().padStart(64, '0')}`
  const pairTopic = pair ? `0x${pair.slice(2).toLowerCase().padStart(64, '0')}` : undefined
  const matchingLocks = locks.data?.logs.filter((log) => pairTopic && log.topics[2]?.toLowerCase() === pairTopic) ?? []
  const matchingSales = sales.data?.logs.filter((log) => log.topics[2]?.toLowerCase() === tokenTopic) ?? []
  return <section className="workspace-panel mt-6"><h2>Project activity</h2><p className="workspace-note">Recent locks and presales from the explorer archive. Open a record to check its current state.</p>
    {(locks.isError || sales.isError) && <p role="alert" className="workspace-notice">Some project activity is unavailable. <button className="underline" onClick={() => { void locks.refetch(); void sales.refetch() }}>Try again</button></p>}
    {locks.isPending || sales.isPending ? <p role="status" className="workspace-note mt-4">Finding related activity…</p> : <ul className="workspace-list">
      {matchingLocks.slice(0, 8).map((log) => <li key={`${log.transactionHash}:${log.logIndex}`}><span className="flex-1">Liquidity lock #{BigInt(log.topics[1]).toString()}</span><Link className="workspace-button secondary" href={lockVerificationLink(LIQUIDITY_LOCKER_ADDRESS, BigInt(log.topics[1]).toString())}>Verify lock</Link></li>)}
      {matchingSales.slice(0, 8).map((log) => <li key={`${log.transactionHash}:${log.logIndex}`}><span className="flex-1">Presale · Block {log.blockNumber.toLocaleString()}</span><Link className="workspace-button secondary" href={`/launchpad/0x${log.topics[1].slice(26)}`}>View presale</Link></li>)}
      {!matchingLocks.length && !matchingSales.length && !locks.isError && !sales.isError && <li><p>No related locks or presales in the latest archive pages. Older activity may be missing.</p></li>}
    </ul>}
    {transactions.length > 0 && <><h3 className="mt-6 font-semibold">Saved on this device</h3><ul className="workspace-list">{transactions.map((entry) => <li key={entry.id}><div className="flex-1"><span>{transactionLabel(entry.action)}</span><p>{entry.stage === 'confirmed' ? 'Receipt confirmed' : entry.stage === 'submitted' ? 'Awaiting confirmation' : 'View transaction status'}</p></div><Link className="workspace-button secondary" href={entry.hash ? `/explorer/tx/${entry.hash}` : '/transactions'}>View</Link></li>)}</ul></>}
  </section>
}
