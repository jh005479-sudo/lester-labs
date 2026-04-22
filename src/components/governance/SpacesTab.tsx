'use client'

import { Bolt, CheckCircle2, FileSignature, Shield } from 'lucide-react'

const SPACES = [
  {
    title: 'Lester Core',
    slug: 'lester-core',
    summary: 'Protocol-wide signalling for treasury policy, product priorities, and governance standards.',
    badge: 'Snapshot-style',
    icon: <Bolt size={18} />,
  },
  {
    title: 'Launchpad Projects',
    slug: 'project-spaces',
    summary: 'Each launch can run its own token-holder vote with a clear forum thread and fixed balance snapshot.',
    badge: 'Per-project',
    icon: <FileSignature size={18} />,
  },
  {
    title: 'Execution Track',
    slug: 'manual-execution',
    summary: 'Passed votes are executed manually by the responsible team or multisig after public review.',
    badge: 'Human review',
    icon: <Shield size={18} />,
  },
]

const CHECKLIST = [
  'Publish the proposal text in a forum thread or project announcement channel before opening the vote.',
  'Set a clear balance snapshot so holders know exactly when voting power is measured.',
  'Keep choices simple: For, Against, and Abstain unless the proposal genuinely needs multiple options.',
  'Treat the result as signalling until the execution transaction or multisig action is posted publicly.',
]

export function SpacesTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E44FB5]/20 bg-[#E44FB5]/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={18} className="mt-0.5 text-[#E44FB5]" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white">Mainnet recommendation: Snapshot-style off-chain voting</p>
            <p className="text-white/65">
              Lester Labs is standardising on an off-chain, signature-based governance workflow for community voting.
              The website now reflects that safer model instead of offering placeholder on-chain proposal and vote actions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SPACES.map((space) => (
          <div
            key={space.slug}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E44FB5]/15 text-[#E44FB5]">
                {space.icon}
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-white/55">
                {space.badge}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">{space.title}</h3>
            <p className="mt-1 font-mono text-xs text-white/35">{space.slug}</p>
            <p className="mt-4 text-sm leading-relaxed text-white/60">{space.summary}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Operating Standard</h2>
        <p className="mt-2 text-sm text-white/55">
          Use the governance page to prepare proposals and explain the voting flow. Publishing, signature collection,
          and execution remain intentionally separate until the full Snapshot/IPFS pipeline is shipped.
        </p>
        <div className="mt-5 grid gap-3">
          {CHECKLIST.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/70"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
