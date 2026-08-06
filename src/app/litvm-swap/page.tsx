import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'LitVM Swap Security Status | Lester Labs',
  description: 'Lester Labs swap containment status: ordinary trading is disabled while the compromised deployment is replaced and independently verified.',
  alternates: { canonical: 'https://www.lester-labs.com/litvm-swap' },
}

export default function LitvmSwapPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-28 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Safety status</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">New swaps are temporarily unavailable</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
          Do not approve or trade through a legacy Lester Labs router. The application fails closed while the
          replacement factory, router, wrapped native token, controller, treasury, runtime code, and clean deployment
          evidence are pending. This page is not a reward campaign or a request to manufacture testnet activity.
        </p>
        <div className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 text-sm leading-6 text-amber-100/75">
          If you already hold a legacy LP position or wrapped zkLTC, use only the labelled recovery action after
          checking chain ID 4441, the exact recipient, function, amount, and decoded calldata in your wallet.
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/swap" className="rounded-lg bg-[#6B4FFF] px-5 py-3 text-sm font-semibold">Open recovery-aware swap view</Link>
          <Link href="/litvm-dex" className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">View DEX status</Link>
        </div>
      </div>
    </main>
  )
}
