'use client'

import { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { SpacesTab } from '@/components/governance/SpacesTab'
import { CreateProposalTab } from '@/components/governance/CreateProposalTab'
import { VoteTab } from '@/components/governance/VoteTab'
import { ToolHero } from '@/components/shared/ToolHero'

type Tab = 'spaces' | 'create' | 'vote'
const COLOR = '#E44FB5'
const TABS: { id: Tab; label: string }[] = [
  { id: 'spaces', label: 'Spaces' },
  { id: 'create', label: 'Draft Proposal' },
  { id: 'vote', label: 'Voting Guide' },
]

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('spaces')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <Navbar />
      <ToolHero
        category="Community Voting"
        title="Lester"
        titleHighlight="Gov"
        subtitle="Snapshot-style governance planning for LitVM communities. Draft proposals, set clear snapshots, and keep execution separate from voting."
        color={COLOR}
        image="/images/carousel/governance.png"
        imagePosition="center 30%"
        compact
        stats={[
          { label: 'Voting', value: 'Off-chain' },
          { label: 'Style', value: 'Snapshot' },
          { label: 'Execution', value: 'Manual review' },
          { label: 'Cost', value: 'No vote gas' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '1040px' }}>
        <div className="tool-tab-bar">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="tool-tab"
              style={{
                background: activeTab === tab.id ? COLOR : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'rgba(240,238,245,0.45)',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'spaces' && <SpacesTab />}
        {activeTab === 'create' && <CreateProposalTab />}
        {activeTab === 'vote' && <VoteTab />}
      </div>
    </div>
  )
}
