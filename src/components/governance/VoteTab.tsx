'use client'

import { CheckCircle2, Clock3, FileSignature, ShieldCheck } from 'lucide-react'

const STEPS = [
  {
    title: 'Review the proposal thread',
    body: 'Read the motivation, exact execution plan, and linked discussion before you sign anything.',
    icon: <FileSignature size={16} className="text-[#E44FB5]" />,
  },
  {
    title: 'Verify the snapshot reference',
    body: 'Make sure the vote uses a clear balance snapshot so token weighting cannot shift mid-vote.',
    icon: <Clock3 size={16} className="text-[#E44FB5]" />,
  },
  {
    title: 'Sign the vote off-chain',
    body: 'Snapshot-style voting should use wallet signatures rather than an on-chain transaction from this page.',
    icon: <CheckCircle2 size={16} className="text-[#E44FB5]" />,
  },
  {
    title: 'Wait for execution proof',
    body: 'A passed result should be followed by a multisig, timelock, or operator action posted back to the community.',
    icon: <ShieldCheck size={16} className="text-[#E44FB5]" />,
  },
]

const SAFETY_NOTES = [
  'If a vote changes treasury, emissions, or permissions, require a public execution transaction after the vote passes.',
  'Avoid free-form multi-choice votes when a simple For / Against / Abstain result is enough.',
  'Publish the exact contract addresses or treasury destinations before the vote opens.',
  'Do not ask holders to sign opaque payloads that are not clearly tied to a known proposal.',
]

export function VoteTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Snapshot-Style Voting Flow</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          The governance UI now guides users through an off-chain vote lifecycle instead of submitting on-chain votes
          from a placeholder interface. That keeps the experience aligned with the lower-risk model selected for mainnet.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {STEPS.map((step) => (
          <div
            key={step.title}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E44FB5]/15">
              {step.icon}
            </div>
            <h3 className="text-base font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <h2 className="text-lg font-semibold text-white">Voter Safety Checklist</h2>
        <div className="mt-4 grid gap-3">
          {SAFETY_NOTES.map((note) => (
            <div
              key={note}
              className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/70"
            >
              {note}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
