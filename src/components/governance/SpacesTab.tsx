'use client'

import { useState } from 'react'
import { Search, Users, FileText, ArrowRight, Loader2, RefreshCw } from 'lucide-react'
import { useGovernance } from '@/hooks/useGovernance'
import { GOVERNANCE_CONFIG } from '@/config/governance'
import { ProposalState } from '@/config/governance'

const ICON_MAP = {
  bolt: <span className="text-xl">⚡</span>,
  diamond: <span className="text-xl">💎</span>,
  flask: <span className="text-xl">🧪</span>,
  hardhat: <span className="text-xl">⛑️</span>,
} as const

const STATE_COLORS: Record<ProposalState, string> = {
  Pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Active: 'bg-green-500/20 text-green-400 border-green-500/30',
  Defeated: 'bg-red-500/20 text-red-400 border-red-500/30',
  Succeeded: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Queued: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Executed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Canceled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export function SpacesTab() {
  const { spaces, proposals, proposalCount, isLoading, refetch, isConnected } = useGovernance()
  const [selectedSpace, setSelectedSpace] = useState(0)
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState<ProposalState | 'All'>('All')

  const space = spaces[selectedSpace]

  const filteredProposals = proposals.filter((p) => {
    const matchesSearch = p.description.toLowerCase().includes(search.toLowerCase())
    const matchesState = filterState === 'All' || p.state === filterState
    return matchesSearch && matchesState
  })

  return (
    <div className="space-y-6">
      {/* Space cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {spaces.map((s, i) => (
          <button
            key={s.slug}
            onClick={() => setSelectedSpace(i)}
            className={`p-5 rounded-2xl border text-left transition-all ${
              selectedSpace === i
                ? 'border-[#E44FB5] bg-[#E44FB5]/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#E44FB5]/20 flex items-center justify-center">
                {ICON_MAP[s.icon]}
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-400">
                #{i + 1}
              </span>
            </div>
            <h3 className="font-semibold text-white mb-1">{s.name}</h3>
            <p className="text-xs text-gray-500 mb-4 font-mono">{s.slug}</p>
            <div className="flex gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <FileText size={12} /> {s.proposals} proposals
              </span>
            </div>
          </button>
        ))}

        {/* Create new space placeholder */}
        <button className="p-5 rounded-2xl border border-dashed border-white/20 bg-white/5 hover:border-[#E44FB5]/50 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-[#E44FB5] transition-all">
          <span className="text-2xl">+</span>
          <span className="text-xs">Create Space</span>
        </button>
      </div>

      {/* Proposals for selected space */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{space.name} Proposals</h2>
            <button
              onClick={refetch}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Refresh"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          {!isConnected && (
            <span className="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
              Connect wallet to vote or propose
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search proposals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#E44FB5]/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['All', 'Active', 'Pending', 'Succeeded', 'Defeated', 'Executed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterState(s as ProposalState | 'All')}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  filterState === s
                    ? 'border-[#E44FB5] bg-[#E44FB5]/20 text-white'
                    : 'border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Proposal list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span className="text-sm">Loading proposals...</span>
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? 'No proposals match your search' : 'No proposals yet'}</p>
            <p className="text-xs mt-1 text-gray-600">Be the first to create one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProposals.map((proposal) => (
              <div
                key={proposal.id}
                className="p-5 rounded-2xl border border-white/10 bg-white/5 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">#{proposal.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATE_COLORS[proposal.state]}`}>
                      {proposal.state}
                    </span>
                    {proposal.hasVoted && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Voted
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 font-mono">
                    blk {proposal.startBlock} → {proposal.endBlock}
                  </span>
                </div>

                <p className="text-sm text-white font-medium mb-2 leading-snug">{proposal.description}</p>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <span className="text-xs text-gray-500">
                    by <span className="text-gray-400 font-mono">{proposal.proposer.slice(0, 8)}...</span>
                  </span>
                  <a
                    href={`${GOVERNANCE_CONFIG.space.slug.includes('.') ? 'https://' : ''}${GOVERNANCE_CONFIG.space.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#E44FB5] hover:text-[#c9369e] flex items-center gap-1 transition-colors"
                  >
                    View details <ArrowRight size={10} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
