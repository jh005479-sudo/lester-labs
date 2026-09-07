'use client'

import { useEffect, useState } from 'react'
import { Activity, Fuel, ShieldCheck } from 'lucide-react'
import { rpc } from '@/lib/rpcClient'

interface LiveGasSnapshot {
  blockNumber: number
  gasPriceGwei: string
}

function parseRpcQuantity(value: string, label: string): bigint {
  if (!/^0x[0-9a-f]+$/iu.test(value)) throw new Error(`Invalid ${label} RPC quantity`)
  return BigInt(value)
}

export function GasAnalyticsPanel() {
  const [snapshot, setSnapshot] = useState<LiveGasSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [blockHex, gasPriceHex] = await Promise.all([
          rpc<string>('eth_blockNumber', []),
          rpc<string>('eth_gasPrice', []),
        ])
        const blockNumber = parseRpcQuantity(blockHex, 'block number')
        const gasPriceWei = parseRpcQuantity(gasPriceHex, 'gas price')
        if (blockNumber > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Block number exceeds safe display range')
        const whole = gasPriceWei / 1_000_000_000n
        const fractional = ((gasPriceWei % 1_000_000_000n) / 10_000_000n).toString().padStart(2, '0')
        if (!cancelled) {
          setSnapshot({ blockNumber: Number(blockNumber), gasPriceGwei: `${whole}.${fractional}` })
          setError(null)
        }
      } catch {
        if (!cancelled) {
          setSnapshot(null)
          setError('We couldn’t load the current gas price. Try again shortly.')
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
      <div className="mb-5 flex items-center gap-3">
        <Fuel className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-xl font-bold text-white">Current gas price</h2>
      </div>
      {snapshot ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wider text-white/60">Current gas price</p>
            <p className="mt-2 font-mono text-2xl font-bold text-white">{snapshot.gasPriceGwei} Gwei</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wider text-white/60">Observed block</p>
            <p className="mt-2 font-mono text-2xl font-bold text-white">{snapshot.blockNumber.toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-sm text-amber-100/70">{error ?? 'Loading gas price…'}</p>
        </div>
      )}
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-xs leading-5 text-emerald-100/70">
          Gas is the network fee for a transaction. Your wallet shows the final estimate before you sign.
        </p>
      </div>
    </section>
  )
}
