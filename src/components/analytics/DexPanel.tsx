'use client'

import { BarChart3, ShieldCheck } from 'lucide-react'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

export function DexPanel() {
  return (
    <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
      <div className="mb-4 flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-xl font-bold text-white">DEX market analytics unavailable</h2>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-white/55">
        {PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled
          ? 'The source-pinned replacement DEX is active, but audited market analytics are not yet published. Lester Labs therefore'
          : 'The legacy DEX is recovery-only and replacement writes are contained. Lester Labs therefore'}
        {' '}
        does not present fabricated TVL, pair prices, fiat values, volume, or market-share charts as live activity.
        The homepage transaction counters are a separate, source-pinned historical baseline with explicit coverage.
      </p>
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-xs leading-5 text-emerald-100/70">
          This panel will return only when every value can be reproduced from named blocks, authenticated pair events,
          reserves, token decimals, and a disclosed pricing source.
        </p>
      </div>
    </section>
  )
}
