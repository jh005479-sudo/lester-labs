'use client'

import { useState } from 'react'
import { Search, ArrowRight, Users, FileText, Bolt, Diamond, FlaskConical, HardHat } from 'lucide-react'
import { GovernanceInfoModal } from './GovernanceInfoModal'

interface SpaceCard {
  name: string
  slug: string
  token: string
  members: number
  proposals: number
  icon: 'bolt' | 'diamond' | 'flask' | 'hardhat'
}

const DEMO_SPACES: SpaceCard[] = [
  {
    name: 'LitVM Community',
    slug: 'litvm.eth',
    token: '0x1a2b...3c4d',
    members: 1842,
    proposals: 7,
    icon: 'bolt',
  },
  {
    name: 'zkLTC Protocol',
    slug: 'zkltc.ltc',
    token: '0x9e8f...7a6b',
    members: 3210,
    proposals: 12,
    icon: 'diamond',
  },
  {
    name: 'Lester DAO',
    slug: 'lester.dao',
    token: '0x4c5d...2e1f',
    members: 654,
    proposals: 3,
    icon: 'flask',
  },
  {
    name: 'DeFi Builders',
    slug: 'defibuilders.ltc',
    token: '0x7b8c...9d0e',
    members: 2108,
    proposals: 18,
    icon: 'hardhat',
  },
]

export function SpacesTab() {
  const [query, setQuery] = useState('')
  const [spaceModalOpen, setSpaceModalOpen] = useState(false)

  const filtered = DEMO_SPACES.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.slug.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search governance spaces..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none transition-colors"
        />
      </div>

      {/* Demo label */}
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
          Demo spaces — example data only
        </span>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((space) => (
            <div
              key={space.slug}
              className="analytics-card group rounded-xl border border-white/10 bg-white/5 p-5 hover:border-white/20 hover:bg-white/[0.07] transition-all"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[var(--accent)]">
                    {space.icon === 'bolt' && <Bolt size={16} />}
                    {space.icon === 'diamond' && <Diamond size={16} />}
                    {space.icon === 'flask' && <FlaskConical size={16} />}
                    {space.icon === 'hardhat' && <HardHat size={16} />}
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{space.name}</h3>
                    <p className="text-xs text-white/40">{space.slug}</p>
                  </div>
                </div>
              </div>

              <p className="mb-4 font-mono text-xs text-white/30">{space.token}</p>

              <div className="mb-4 flex gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-white/50">
                  <Users size={13} />
                  <span>{space.members.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/50">
                  <FileText size={13} />
                  <span>{space.proposals} proposals</span>
                </div>
              </div>

              <button
                onClick={() => setSpaceModalOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-sm font-medium text-white/60 hover:border-[var(--accent)]/50 hover:text-white transition-colors"
              >
                Enter
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-card rounded-xl border border-white/10 bg-white/5 py-16 text-center">
          <p className="text-white/40">No spaces found</p>
        </div>
      )}

      {/* Footer note */}
      <p className="text-center text-xs text-white/30">
        Create a space for your token community — coming soon
      </p>

      <GovernanceInfoModal open={spaceModalOpen} onClose={() => setSpaceModalOpen(false)} />
    </div>
  )
}
