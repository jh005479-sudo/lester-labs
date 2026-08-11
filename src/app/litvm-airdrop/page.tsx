import type { Metadata } from 'next'
import Link from 'next/link'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const writesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

export const metadata: Metadata = {
  title: 'LitVM Batch Distribution Safety Status | Lester Labs',
  description: writesActive
    ? 'The source-pinned Lester Labs batch distribution utility is active on LitVM testnet and is not a reward claim.'
    : 'The Lester Labs batch distribution utility is not a reward claim. Sending remains disabled until the reviewed replacement contract is activated.',
  alternates: { canonical: 'https://www.lester-labs.com/litvm-airdrop' },
}

export default function LitvmAirdropPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-28 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Distribution utility—not a reward</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">{writesActive ? 'Immutable public-testnet batch distribution' : 'Batch sending is temporarily disabled'}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
          Lester Labs does not operate a LitVM reward programme, snapshot, allocation, eligibility checker, or claim
          page. Local CSV parsing does not enrol a wallet in anything.{' '}
          {writesActive
            ? 'On-chain sending targets the bounded, source-pinned replacement Disperse contract after exact runtime checks.'
            : 'On-chain sending remains blocked until the new bounded Disperse contract and exact runtime are deployed, verified, and source-pinned.'}
        </p>
        <div className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 text-sm leading-6 text-amber-100/75">
          Never enter a seed phrase or private key, sign an unlimited approval, or follow a third-party instruction to
          repeat transactions for eligibility. {writesActive ? 'Every' : 'When reactivated, every'} batch is capped at 200 recipient entries,
          displayed before signing, and counted on-chain only after successful execution.
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/airdrop" className="rounded-lg bg-[#6B4FFF] px-5 py-3 text-sm font-semibold">{writesActive ? 'Open batch distribution tool' : 'Open local review tool'}</Link>
          <Link href="/tutorials/complete-guide-litvm-airdrop" className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">Read reward-rumour safety</Link>
        </div>
      </div>
    </main>
  )
}
