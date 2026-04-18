'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Loader2, CheckCircle, AlertCircle, ThumbsUp, ThumbsDown, Minus, Search } from 'lucide-react'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { useGovernance, useGovernanceWrite } from '@/hooks/useGovernance'
import { GOVERNANCE_CONFIG } from '@/config/governance'
import { ProposalState } from '@/config/governance'

const STATE_COLORS: Record<ProposalState, string> = {
  Pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Active: 'bg-green-500/20 text-green-400 border-green-500/30',
  Defeated: 'bg-red-500/20 text-red-400 border-red-500/30',
  Succeeded: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Queued: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Executed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Canceled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const SUPPORT_ICONS = {
  0: <ThumbsDown size={14} />,
  1: <ThumbsUp size={14} />,
  2: <Minus size={14} />,
}

export function VoteTab() {
  const { isConnected, proposals, isLoading, refetch } = useGovernance()
  const { castVoteWithReason, isVoting, voteTx, SUPPORT_LABELS } = useGovernanceWrite()

  const [search, setSearch] = useState('')
  const [selectedProposal, setSelectedProposal] = useState<number | null>(null)
  const [selectedSupport, setSelectedSupport] = useState<0 | 1 | 2>(1)
  const [reason, setReason] = useState('')
  const [voted, setVoted] = useState<Record<number, boolean>>({})
  const [pendingVoteId, setPendingVoteId] = useState<number | null>(null) // capture at click time

  const activeProposals = proposals.filter(
    (p) =>
      (p.state === 'Active' || p.state === 'Pending') &&
      !p.hasVoted &&
      !voted[p.id] &&
      p.description.toLowerCase().includes(search.toLowerCase()),
  )

  if (!isConnected) return <ConnectWalletPrompt />

  const handleVote = (proposalId: number) => {
    setPendingVoteId(proposalId)
    castVoteWithReason(proposalId, selectedSupport, reason)
  }

  // Watch for vote tx success and update voted state
  useEffect(() => {
    if (voteTx.isSuccess && pendingVoteId !== null) {
      setVoted((v) => ({ ...v, [pendingVoteId]: true }))
      setSelectedProposal(null)
      setReason('')
      setPendingVoteId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteTx.isSuccess])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Active Votes</h2>
        <p className="text-xs text-gray-500">Cast your vote on active governance proposals</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search proposals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#E44FB5]/50"
        />
      </div>

      {/* Proposal list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Loading proposals...</span>
        </div>
      ) : activeProposals.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-sm">
            {search
              ? 'No active proposals match your search'
              : 'No active proposals right now. Check back soon!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeProposals.map((proposal) => {
            const isSelected = selectedProposal === proposal.id

            return (
              <div
                key={proposal.id}
                className={`rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-[#E44FB5] bg-[#E44FB5]/5'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {/* Proposal header */}
                <button
                  className="w-full p-5 text-left"
                  onClick={() => setSelectedProposal(isSelected ? null : proposal.id)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">#{proposal.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATE_COLORS[proposal.state]}`}>
                        {proposal.state}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">
                      {isSelected ? '▲' : '▼'}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium leading-snug">{proposal.description}</p>
                </button>

                {/* Expanded voting form */}
                {isSelected && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Cast your vote</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([0, 1, 2] as const).map((support) => (
                          <button
                            key={support}
                            onClick={() => setSelectedSupport(support)}
                            className={`py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                              selectedSupport === support
                                ? support === 1
                                  ? 'border-green-500 bg-green-500/20 text-green-400'
                                  : support === 0
                                  ? 'border-red-500 bg-red-500/20 text-red-400'
                                  : 'border-gray-500 bg-gray-500/20 text-gray-400'
                                : 'border-white/10 text-gray-400 hover:border-white/20'
                            }`}
                          >
                            {SUPPORT_ICONS[support]}
                            {SUPPORT_LABELS[support]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">
                        Reason <span className="text-gray-600 normal-case">(optional)</span>
                      </p>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder="Explain your vote (on-chain, non-binding)..."
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-[#E44FB5]/50 resize-none"
                      />
                    </div>

                    <button
                      onClick={() => handleVote(proposal.id)}
                      disabled={isVoting}
                      className="w-full py-2.5 rounded-xl bg-[#E44FB5] hover:bg-[#c9369e] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isVoting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Voting...
                        </>
                      ) : (
                        <>
                          {SUPPORT_ICONS[selectedSupport]}
                          Submit Vote — {SUPPORT_LABELS[selectedSupport]}
                        </>
                      )}
                    </button>

                    {voteTx.isError && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <AlertCircle size={12} />
                        Vote failed. Check gas and try again.
                      </div>
                    )}

                    {voted[proposal.id] && (
                      <div className="flex items-center gap-2 text-xs text-green-400">
                        <CheckCircle size={12} />
                        Vote recorded on-chain!
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Already voted / closed */}
      {proposals.filter((p) => p.hasVoted || (!['Active', 'Pending'].includes(p.state))).length > 0 && (
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-3">Past votes</p>
          <div className="space-y-2">
            {proposals
              .filter((p) => p.hasVoted || !['Active', 'Pending'].includes(p.state))
              .slice(0, 5)
              .map((proposal) => (
                <div
                  key={proposal.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-500">#{proposal.id}</span>
                    <span className="text-gray-300 truncate max-w-[200px]">{proposal.description}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {proposal.hasVoted && (
                      <span className="text-blue-400">Voted</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full border text-xs ${STATE_COLORS[proposal.state]}`}>
                      {proposal.state}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
