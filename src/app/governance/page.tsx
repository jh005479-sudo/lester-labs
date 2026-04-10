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
  { id: 'create', label: 'Create Proposal' },
  { id: 'vote', label: 'Vote' },
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
        subtitle="Off-chain proposals and gasless voting — Snapshot-style, no gas required."
        color={COLOR}
        image="/images/carousel/governance.png"
        imagePosition="center 30%"
        stats={[
          { label: 'Gas', value: 'Zero' },
          { label: 'Style', value: 'Snapshot' },
          { label: 'Cost', value: 'Free' },
          { label: 'Proposals', value: 'Unlimited' },
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
