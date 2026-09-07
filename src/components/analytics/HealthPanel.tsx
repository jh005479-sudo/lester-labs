'use client'

import { useEffect, useState } from 'react'
import { Activity, ShieldCheck } from 'lucide-react'
import { rpc } from '@/lib/rpcClient'

interface RpcBlock {
  number: string
  hash: string
  timestamp: string
  gasUsed: string
  gasLimit: string
  transactions: unknown[]
}

interface HealthSnapshot {
  blockNumber: number
  blockHash: string
  blockTimestamp: string
  gasUsed: bigint
  gasLimit: bigint
  transactionEntries: number
  observedAt: string
}

function quantity(value: string, label: string): bigint {
  if (!/^0x[0-9a-f]+$/iu.test(value)) throw new Error(`Invalid ${label}`)
  return BigInt(value)
}

export function HealthPanel() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const block = await rpc<RpcBlock>('eth_getBlockByNumber', ['latest', false])
        const blockNumber = quantity(block.number, 'block number')
        const timestamp = quantity(block.timestamp, 'timestamp')
        if (blockNumber > BigInt(Number.MAX_SAFE_INTEGER) || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error('RPC quantity exceeds safe display range')
        }
        if (!/^0x[0-9a-f]{64}$/iu.test(block.hash) || !Array.isArray(block.transactions)) {
          throw new Error('Invalid block payload')
        }
        if (!cancelled) {
          setSnapshot({
            blockNumber: Number(blockNumber),
            blockHash: block.hash,
            blockTimestamp: new Date(Number(timestamp) * 1000).toISOString(),
            gasUsed: quantity(block.gasUsed, 'gas used'),
            gasLimit: quantity(block.gasLimit, 'gas limit'),
            transactionEntries: block.transactions.length,
            observedAt: new Date().toISOString(),
          })
          setFailed(false)
        }
      } catch {
        if (!cancelled) {
          setSnapshot(null)
          setFailed(true)
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
      <div className="mb-5 flex items-center gap-3">
        <Activity className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-xl font-bold text-white">Latest block</h2>
      </div>
      {snapshot ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            ['Block', snapshot.blockNumber.toLocaleString()],
            ['Block timestamp', snapshot.blockTimestamp],
            ['Transactions', snapshot.transactionEntries.toLocaleString()],
            ['Gas used / limit', `${snapshot.gasUsed.toLocaleString()} / ${snapshot.gasLimit.toLocaleString()}`],
            ['Block hash', snapshot.blockHash],
            ['Last checked', snapshot.observedAt],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <dt className="text-xs uppercase tracking-wider text-white/60">{label}</dt>
              <dd className="mt-2 break-all font-mono text-sm text-white/75">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/70">
          {failed ? 'We couldn’t load the latest block. Try again shortly.' : 'Loading the latest block…'}
        </p>
      )}
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-xs leading-5 text-emerald-100/70">
          A snapshot from LitVM, updated when you open this page. It does not measure network uptime or daily activity.
        </p>
      </div>
    </section>
  )
}
