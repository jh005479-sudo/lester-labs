'use client'

import { Coins, ShieldCheck } from 'lucide-react'

export function TokenTracker() {
  return (
    <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
      <div className="mb-4 flex items-center gap-3">
        <Coins className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-xl font-bold text-white">Complete token index unavailable</h2>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-white/55">
        The high-volume legacy TokenFactory has no child counter, and newest-block transfer scans do not establish a
        complete token list, unique holder count, 24-hour transaction total, launch trend, or legitimacy signal.
        Lester Labs therefore does not present those bounded samples as a live market index.
      </p>
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-xs leading-5 text-emerald-100/70">
          A future index must publish its factory inventory, start/end blocks, reorg handling, event filters, token
          metadata failures, duplicate rules, and holder definition. Token existence is never an endorsement.
        </p>
      </div>
    </section>
  )
}
