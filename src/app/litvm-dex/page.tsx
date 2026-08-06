import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'LitVM DEX Security Status | Lester Labs',
  description: 'Post-compromise status for the Lester Labs LitVM DEX. New swaps and liquidity writes remain disabled; authenticated legacy exits remain available.',
  alternates: { canonical: 'https://www.lester-labs.com/litvm-dex' },
}

export default function LitvmDexPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-28 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Post-compromise containment</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">LitVM DEX writes are disabled</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
          The legacy DEX used a non-canonical direct fee transfer and its fee controller was tied to a compromised
          signer. Lester Labs blocks new swaps, pool creation, liquidity addition, and retired-router approvals until
          a clean replacement deployment and exact served build are independently verified.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-lg font-bold">Recovery still available</h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              Existing LP holders can use narrowly authenticated, value-free removal and wrapped-token withdrawal
              paths. Proceeds must resolve to the connected wallet and runtime code is checked immediately before signing.
            </p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-lg font-bold">Activation requirements</h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              Fresh controller, treasury, and one-time deployer roles; canonical Uniswap V2 fee behaviour; exact
              runtime hashes; clean build attestation; independent on-chain verification; and production artifact parity.
            </p>
          </section>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/pool" className="rounded-lg bg-[#6B4FFF] px-5 py-3 text-sm font-semibold">Open LP recovery view</Link>
          <Link href="/docs" className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">Read safety documentation</Link>
        </div>
      </div>
    </main>
  )
}
