import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Security and Recovery Status | Lester Labs',
  description: 'Current containment, replacement-deployment, and site-reputation remediation status for Lester Labs.',
}

const statusRows = [
  {
    area: 'Application writes',
    status: 'Contained',
    detail: 'Ordinary contract writes are disabled. Only narrowly scoped, permissionless recovery paths remain available.',
  },
  {
    area: 'Legacy authorities',
    status: 'Compromised · UI quarantined',
    detail: 'The legacy contracts still have compromised on-chain authority. This source blocks them as new paid-action and approval targets; that is containment, not authority recovery.',
  },
  {
    area: 'Gate A — authority recovery',
    status: 'Pending independent inputs',
    detail: 'Activation requires distinct fresh controller, treasury, and one-time deployer addresses, verified role assignments, and retirement of compromised authority paths.',
  },
  {
    area: 'Gate B — source and reputation',
    status: 'Pending clean evidence',
    detail: 'Reviewed source, reproducible artifacts, exact runtime and served-asset parity, hosting/account control, and warning-trigger remediation must pass independently of Gate A.',
  },
  {
    area: 'Wallet connectivity',
    status: 'Restricted',
    detail: 'Injected wallets only during recovery. WalletConnect and mutable frontend contract/RPC environment overrides are disabled.',
  },
  {
    area: 'Site reputation',
    status: 'Remediation in progress',
    detail: 'A MetaMask hostname warning remains under investigation. No appeal will be submitted until both independent release gates pass and the clean production deployment is rechecked.',
  },
]

export default function SecurityStatusPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-16 text-white sm:px-8">
      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Public security status</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Post-compromise containment is active</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">
          The former build machine, deployer, and treasury authority are treated as compromised. The legacy stack is
          not considered safe for new paid interactions. This page reports readiness; it is not a claim that replacement
          deployment or the MetaMask warning has already been resolved.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-6">
        <h2 className="text-xl font-semibold">Two independent release gates</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/15 p-4">
            <h3 className="font-medium text-white/90">A — compromised authority and control-plane recovery</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Replace and verify the deployer, controller, treasury, role graph, hosting credentials, DNS authority,
              and every administrative or fee-routing path. A clean website alone cannot repair compromised on-chain control.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/15 p-4">
            <h3 className="font-medium text-white/90">B — malicious-flag, source, runtime, and served-build remediation</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Reproduce the warning, remove misleading or unsafe interaction patterns, review source and dependencies,
              attest exact runtimes and frontend assets, and verify the clean production origin. Fresh keys alone cannot prove this gate.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium leading-6 text-amber-100/85">
          Neither gate substitutes for the other. Ordinary writes stay disabled, and a reputation appeal is submitted only after both gates pass.
        </p>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
        {statusRows.map((row) => (
          <div key={row.area} className="grid gap-2 border-b border-white/10 p-5 last:border-b-0 sm:grid-cols-[180px_190px_1fr]">
            <h2 className="font-medium text-white/90">{row.area}</h2>
            <div className="text-sm font-medium text-amber-300">{row.status}</div>
            <p className="text-sm leading-6 text-white/55">{row.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <h2 className="font-semibold">Analytics disclosure</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Homepage totals preserve a first-party production counter snapshot through LiteForge block 36,723,038.
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
