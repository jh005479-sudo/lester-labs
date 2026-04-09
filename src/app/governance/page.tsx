'use client'

import { useState } from 'react'
import { Vote } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { SpacesTab } from '@/components/governance/SpacesTab'
import { CreateProposalTab } from '@/components/governance/CreateProposalTab'
import { VoteTab } from '@/components/governance/VoteTab'

type Tab = 'spaces' | 'create' | 'vote'

const TABS: { id: Tab; label: string }[] = [
  { id: 'spaces', label: 'Spaces' },
  { id: 'create', label: 'Create Proposal' },
  { id: 'vote', label: 'Vote' },
]

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('spaces')

  return (
    <div className="min-h-screen bg-background premium-tight">
      <Navbar />
      <main className="app-shell" style={{ maxWidth: 1040 }}>
        {/* Page header */}
        <div className="tool-hero">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Vote size={20} className="text-white" />
            </div>
            <h1 className="tool-hero-title">Governance</h1>
          </div>
          <p className="tool-hero-copy">
            Off-chain voting and proposal management — Snapshot-style, no gas required.
          </p>
        </div>

        <div className="tool-after-hero">
        {/* Tab switcher */}
        <div className="mb-8 flex rounded-xl border border-white/10 bg-[var(--surface-1)] p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-white shadow'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'spaces' && <SpacesTab />}
        {activeTab === 'create' && <CreateProposalTab />}
        {activeTab === 'vote' && <VoteTab />}
        </div>
      </main>
    </div>
  )
}
