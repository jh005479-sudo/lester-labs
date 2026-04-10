'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Loader2 } from 'lucide-react'
import { GovernanceInfoModal } from './GovernanceInfoModal'

interface VoteOption {
  label: string
  pct: number
  color: string
}

const DEMO_PROPOSAL = {
  id: 'QmExampleProposalId12345',
  title: 'Example: Treasury Allocation Q2 2026',
  excerpt:
    'This proposal seeks community approval to allocate 500,000 LSTR from the DAO treasury toward protocol liquidity provisioning, ecosystem grants, and a 3-month developer incentive programme. The split is proposed as 50% liquidity / 30% grants / 20% dev rewards.',
}

const VOTE_OPTIONS: VoteOption[] = [
  { label: 'For', pct: 67, color: 'bg-emerald-500' },
  { label: 'Against', pct: 28, color: 'bg-red-500' },
  { label: 'Abstain', pct: 5, color: 'bg-white/20' },
]

export function VoteTab() {
  const { isConnected } = useAccount()
  const [proposalId, setProposalId] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleLoad = () => {
    if (!proposalId.trim()) return
    setLoading(true)
    // Simulate async load
    setTimeout(() => {
      setLoading(false)
      setLoaded(true)
    }, 800)
  }

  const handleCastVote = () => {
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Proposal ID input */}
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Proposal ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
              placeholder="QmProposalCID..."
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-white/20 focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
            />
            <button
              onClick={handleLoad}
              disabled={!proposalId.trim() || loading}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Load Proposal
            </button>
          </div>
          <p className="text-xs text-white/30">Enter a proposal ID to vote</p>
        </div>
      </div>

      {/* Demo / loaded proposal card */}
      {loaded && (
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-6">
          {/* Demo badge */}
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
              Demo proposal — example data
            </span>
          </div>

          {/* Title & body */}
          <div>
            <h3 className="mb-2 text-lg font-semibold text-white">{DEMO_PROPOSAL.title}</h3>
            <p className="text-sm leading-relaxed text-white/50">{DEMO_PROPOSAL.excerpt}</p>
          </div>

          {/* Voting options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-white/70">Cast your vote</p>
            <div className="space-y-2">
              {VOTE_OPTIONS.map((opt) => (
                <label
                  key={opt.label}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    selected === opt.label
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="vote"
                    value={opt.label}
                    checked={selected === opt.label}
                    onChange={() => setSelected(opt.label)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm font-medium text-white">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Vote power */}
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/50">
            Your voting power:{' '}
            <span className="font-semibold text-white">
              {isConnected ? '0.00 LSTR' : '— (connect wallet)'}
            </span>
          </div>

          {/* Cast vote */}
          {!isConnected ? (
            <p className="text-center text-sm text-white/40">
              Connect your wallet to cast a vote
            </p>
          ) : (
            <button
              onClick={handleCastVote}
              disabled={!selected}
              className="w-full rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              Cast Vote
            </button>
          )}

          {/* Results */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-white/70">Current Results</p>
            <div className="space-y-3">
              {VOTE_OPTIONS.map((opt) => (
                <div key={opt.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">{opt.label}</span>
                    <span className="font-semibold text-white">{opt.pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${opt.color} transition-all duration-700`}
                      style={{ width: `${opt.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-white/20">
              Demo data — 4,032 votes cast (example)
            </p>
          </div>
        </div>
      )}

      <GovernanceInfoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

