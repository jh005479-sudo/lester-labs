import type { Metadata } from 'next'
import Link from 'next/link'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'
import { PLATFORM_ACTIVITY_BASELINE } from '@/config/platformActivity'

export const metadata: Metadata = {
  title: 'Security and Recovery Status | Lester Labs',
  description: PUBLIC_RELEASE_STATUS.security.metadataDescription,
}

export default function SecurityStatusPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-16 text-white sm:px-8">
      <div className={`rounded-2xl border p-6 sm:p-8 ${PUBLIC_RELEASE_STATUS.tone === 'success' ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : 'border-amber-400/25 bg-amber-400/[0.06]'}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${PUBLIC_RELEASE_STATUS.tone === 'success' ? 'text-emerald-300' : 'text-amber-300'}`}>Public security status</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{PUBLIC_RELEASE_STATUS.security.heading}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">
          {PUBLIC_RELEASE_STATUS.security.introduction}
        </p>
      </div>

      <section className={`mt-8 rounded-2xl border p-6 ${PUBLIC_RELEASE_STATUS.tone === 'success' ? 'border-emerald-300/20 bg-emerald-300/[0.04]' : 'border-amber-300/20 bg-amber-300/[0.04]'}`}>
        <h2 className="text-xl font-semibold">{PUBLIC_RELEASE_STATUS.security.gatesHeading}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/15 p-4">
            <h3 className="font-medium text-white/90">A — compromised authority and control-plane recovery</h3>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/70">{PUBLIC_RELEASE_STATUS.security.gateAStatus}</p>
            <p className="mt-2 text-sm leading-6 text-white/55">
              {PUBLIC_RELEASE_STATUS.security.gateADetail}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/15 p-4">
            <h3 className="font-medium text-white/90">B — malicious-flag, source, runtime, and served-build remediation</h3>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/70">{PUBLIC_RELEASE_STATUS.security.gateBStatus}</p>
            <p className="mt-2 text-sm leading-6 text-white/55">
              {PUBLIC_RELEASE_STATUS.security.gateBDetail}
            </p>
          </div>
        </div>
        <p className={`mt-4 text-sm font-medium leading-6 ${PUBLIC_RELEASE_STATUS.tone === 'success' ? 'text-emerald-100/85' : 'text-amber-100/85'}`}>
          {PUBLIC_RELEASE_STATUS.security.gatesSummary}
        </p>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
        {PUBLIC_RELEASE_STATUS.security.rows.map((row) => (
          <div key={row.area} className="grid gap-2 border-b border-white/10 p-5 last:border-b-0 sm:grid-cols-[180px_190px_1fr]">
            <h2 className="font-medium text-white/90">{row.area}</h2>
            <div className={`text-sm font-medium ${PUBLIC_RELEASE_STATUS.tone === 'success' ? 'text-emerald-300' : 'text-amber-300'}`}>{row.status}</div>
            <p className="text-sm leading-6 text-white/55">{row.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="font-semibold">Analytics disclosure</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Homepage totals preserve the source-pinned production counter snapshot through LiteForge block{' '}
            {PLATFORM_ACTIVITY_BASELINE.throughBlock.toLocaleString()}.
            They are first-party action counts, not independently verified counts of distinct wallets or people, and may include repeated, automated, bot, or spam activity.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="font-semibold">Never share secrets</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Lester Labs will never request a seed phrase or private key. LiteForge zkLTC is a testnet asset with no
            represented monetary value. Verify the chain, contract, function, recipient, and value in your wallet.
          </p>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <a className="rounded-lg border border-white/15 px-4 py-2 text-white/70 hover:text-white" href="/.well-known/security.txt">
          Security contact
        </a>
        <a
          className="rounded-lg border border-white/15 px-4 py-2 text-white/70 hover:text-white"
          href="https://github.com/jh005479-sudo/lester-labs"
          target="_blank"
          rel="noopener noreferrer"
        >
          Reviewed source
        </a>
        <Link className="rounded-lg border border-white/15 px-4 py-2 text-white/70 hover:text-white" href="/docs">
          Recovery documentation
        </Link>
      </div>
    </main>
  )
}
