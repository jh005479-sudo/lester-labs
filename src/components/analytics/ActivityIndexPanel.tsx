'use client'

import { useState } from 'react'
import Link from 'next/link'
import { decodeEventLog } from 'viem'
import { RefreshCw, ArrowUpRight } from 'lucide-react'
import { useIndexedActivity } from '@/hooks/useIndexedActivity'
import { TOKEN_FACTORY_ABI } from '@/lib/contracts/tokenFactory'
import type { ActivityCursor, ActivitySource } from '@/lib/activityIndex'

export function ActivityIndexPanel({ source = 'tokens' }: { source?: ActivitySource }) {
  const [cursors, setCursors] = useState<Array<ActivityCursor | undefined>>([undefined])
  const query = useIndexedActivity(source, cursors[cursors.length - 1])
  return <section className="workspace-panel">
    <div className="mb-5 flex items-center justify-between gap-4"><h2>{source === 'tokens' ? 'Recent tokens' : 'Recent activity'}</h2><button className="workspace-button secondary" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={15} />Refresh</button></div>
    {query.isPending && <p className="workspace-note" role="status">Loading activity…</p>}
    {query.isError && <p className="workspace-notice" role="alert">{query.error.message}</p>}
    {query.data && <>
      {query.data.logs.length === 0 ? <p className="workspace-note">No entries on this page. You can check older activity below.</p> : <ul className="workspace-list">{query.data.logs.map((log) => {
        let name = 'Transaction'
        let symbol = ''
        let href = `/explorer/tx/${log.transactionHash}`
        if (source === 'tokens') {
          try {
            const event = decodeEventLog({ abi: TOKEN_FACTORY_ABI, eventName: 'TokenCreated', data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] })
            name = event.args.name.slice(0, 80); symbol = event.args.symbol.slice(0, 20); href = `/projects/${event.args.tokenAddress}`
          } catch { /* The raw transaction remains inspectable. */ }
        }
        return <li key={`${log.transactionHash}:${log.logIndex}`}><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{name} {symbol && <span className="text-sm text-violet-300">{symbol}</span>}</h3><p>Block {log.blockNumber.toLocaleString()}</p></div><Link href={href} className="workspace-button secondary">View <ArrowUpRight size={15} /></Link></li>
      })}</ul>}
      <div className="mt-5 flex justify-between gap-3"><button className="workspace-button secondary" disabled={cursors.length <= 1} onClick={() => setCursors((current) => current.slice(0, -1))}>Newer</button><button className="workspace-button secondary" disabled={!query.data.nextCursor} onClick={() => { if (query.data.nextCursor) setCursors((current) => [...current, query.data.nextCursor!]) }}>Older</button></div>
      <details className="workspace-details"><summary>About this data</summary><p>Current Lester Labs contracts. Records come from the LiteForge explorer archive. They help you find activity; they are not independent proof. The provider may omit history.</p><p>Checked {new Date(query.data.coverage.checkedAt).toLocaleString()} · Newest record: block {query.data.coverage.indexedThroughBlock.toLocaleString()}</p></details>
    </>}
  </section>
}
