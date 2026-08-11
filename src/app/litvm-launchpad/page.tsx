import type { Metadata } from 'next'
import Link from 'next/link'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const writesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

export const metadata: Metadata = {
  title: 'LitVM Launchpad Security Status | Lester Labs',
  description: writesActive
    ? 'Source-pinned replacement presale creation with recovery-only legacy Lester Labs ILO contracts.'
    : 'Legacy Lester Labs ILO contracts are recovery-only. New sale creation, funding, contributions, and finalisation remain disabled.',
  alternates: { canonical: 'https://www.lester-labs.com/litvm-launchpad' },
}

export default function LitvmLaunchpadPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-28 text-white">
      <div className="mx-auto max-w-4xl">
        <p className={`text-xs font-bold uppercase tracking-[0.16em] ${writesActive ? 'text-emerald-300' : 'text-amber-300'}`}>{writesActive ? 'Replacement candidate + legacy recovery' : 'Recovery-only service'}</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">{writesActive ? 'Reviewed LitVM launchpad candidate' : 'New LitVM presales are disabled'}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
          Production traffic referenced an ILO factory absent from reachable Git history, and both known legacy
          factories embed compromised treasury provenance.{' '}
          {writesActive
            ? 'They remain blocked for creation, funding, contributions, whitelist changes, and finalisation; new activity uses the source-pinned replacement factory and child runtime.'
            : 'New creation, token funding, contributions, whitelist changes, and finalisation are blocked.'}{' '}
          Lester Labs does not promise a token reward or sale allocation.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-lg font-bold">Existing participant recovery</h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              Authenticated legacy children may expose claim or refund actions when their on-chain state permits them.
              The app verifies source-factory provenance and sends no native value on those recovery calls.
            </p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-lg font-bold">Existing owner recovery</h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              Cancellation, matured LP withdrawal, and excess-asset recovery remain available only for the exact
              historical child and only when its current state and caller authority allow the operation.
            </p>
          </section>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/launchpad" className="rounded-lg bg-[#6B4FFF] px-5 py-3 text-sm font-semibold">{writesActive ? 'Open launchpad and recovery' : 'Open legacy recovery view'}</Link>
          <Link href="/docs" className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">Read safety documentation</Link>
        </div>
      </div>
    </main>
  )
}
