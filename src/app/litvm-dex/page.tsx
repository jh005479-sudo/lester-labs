import type { Metadata } from 'next'
import Link from 'next/link'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const writesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

export const metadata: Metadata = {
  title: 'LitVM DEX Security Status | Lester Labs',
  description: writesActive
    ? 'Reviewed replacement-candidate status for the Lester Labs LitVM DEX, with authenticated legacy exits kept separately recovery-only and production serving separately gated.'
    : 'Post-compromise status for the Lester Labs LitVM DEX. New swaps and liquidity writes remain disabled; authenticated legacy exits remain available.',
  alternates: { canonical: 'https://www.lester-labs.com/litvm-dex' },
}

export default function LitvmDexPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-28 text-white">
      <div className="mx-auto max-w-4xl">
        <p className={`text-xs font-bold uppercase tracking-[0.16em] ${writesActive ? 'text-emerald-300' : 'text-amber-300'}`}>
          {writesActive ? 'Reviewed replacement candidate' : 'Post-compromise containment'}
        </p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
          {writesActive ? 'Source-pinned LitVM DEX candidate' : 'LitVM DEX writes are disabled'}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
          {writesActive
            ? 'The candidate factory, router, wrapped-native contract, controller, treasury, and runtimes are source-pinned to the reviewed replacement. Public serving still requires the separate approved frontend manifest and apex/www byte-parity proof. The legacy DEX remains quarantined for new actions because its unusual direct fee route and controller were tied to the compromised stack.'
            : 'The legacy DEX used a non-canonical direct fee transfer and its fee controller was tied to a compromised signer. Lester Labs blocks new swaps, pool creation, liquidity addition, and retired-router approvals until a clean replacement deployment and exact served build are independently verified.'}
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
            <h2 className="text-lg font-bold">{writesActive ? 'Candidate and deployment evidence' : 'Activation requirements'}</h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              {writesActive
                ? 'The candidate evidence binds separated controller, treasury, and one-time deployer roles; canonical Uniswap V2 fee behaviour; exact runtime hashes; full Safe verification; and independent cutover proof. Clean frontend build attestation and production artifact parity remain a separate protected deployment gate.'
                : 'Fresh controller, treasury, and one-time deployer roles; canonical Uniswap V2 fee behaviour; exact runtime hashes; clean build attestation; independent on-chain verification; and production artifact parity.'}
            </p>
          </section>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/pool" className="rounded-lg bg-[#6B4FFF] px-5 py-3 text-sm font-semibold">{writesActive ? 'Open DEX pool view' : 'Open LP recovery view'}</Link>
          <Link href="/docs" className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">Read safety documentation</Link>
        </div>
      </div>
    </main>
  )
}
