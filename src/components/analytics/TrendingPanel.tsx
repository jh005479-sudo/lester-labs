'use client'

import { LineChart, ShieldCheck } from 'lucide-react'

export function TrendingPanel() {
  return (
    <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
      <div className="mb-4 flex items-center gap-3">
        <LineChart className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-xl font-bold text-white">Token trends unavailable</h2>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-white/55">
        Transfer-event frequency is not price performance, holder growth, market demand, or a recommendation.
        Lester Labs does not publish a “trending” ranking until it has a reproducible price/liquidity index with
        explicit pair coverage, block windows, decimal handling, and manipulation controls.
      </p>
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-xs leading-5 text-emerald-100/70">
          No transfer count is relabelled as price change, and no token is promoted from a bounded RPC sample.
        </p>
      </div>
    </section>
  )
}
