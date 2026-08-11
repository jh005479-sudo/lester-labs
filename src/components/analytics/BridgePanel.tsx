'use client'

import { Landmark, ShieldCheck } from 'lucide-react'

export function BridgePanel() {
  return (
    <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
      <div className="mb-4 flex items-center gap-3">
        <Landmark className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-xl font-bold text-white">Bridge analytics unavailable</h2>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-white/55">
        Lester Labs has no source-pinned bridge-contract inventory or independently verified bridge indexer.
        It therefore does not publish bridge TVL, volume, source-chain shares, transaction rows, or timing claims.
      </p>
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-xs leading-5 text-emerald-100/70">
          This panel will only be enabled after exact bridge addresses, chain IDs, runtime hashes, data coverage,
          and calculation methods are published and independently reproducible. No synthetic activity is shown.
        </p>
      </div>
    </section>
  )
}
