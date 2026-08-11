'use client'

import { EyeOff, ShieldCheck } from 'lucide-react'

export function WhaleWatcherPanel() {
  return (
    <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6">
      <div className="mb-4 flex items-center gap-3">
        <EyeOff className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-xl font-bold text-white">Wallet rankings unavailable</h2>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-white/55">
        Lester Labs does not operate a verified portfolio indexer and will not invent wallet balances, fiat values,
        token picks, staking rewards, or so-called whale alerts. Addresses are not labelled as people or investors
        without a documented attribution source.
      </p>
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-xs leading-5 text-emerald-100/70">
          Future address analytics must identify the sampled blocks, token universe, pricing source, exclusions,
          and whether an address is a contract, exchange, or user-controlled wallet. No synthetic activity is shown.
        </p>
      </div>
    </section>
  )
}
