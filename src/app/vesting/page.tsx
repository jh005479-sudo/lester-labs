'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { VestingForm } from '@/components/vesting/VestingForm'
import { MySchedules } from '@/components/vesting/MySchedules'
import { ToolHero } from '@/components/shared/ToolHero'

type Tab = 'create' | 'my'
const COLOR = '#F5A623'
const TABS: { id: Tab; label: string }[] = [
  { id: 'create', label: 'Create Schedule' },
  { id: 'my', label: 'My Schedules' },
]

export default function VestingPage() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('create')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <ToolHero
        category="Token Distribution"
        title="Lester"
        titleHighlight="Vester"
        subtitle="Create OpenZeppelin-based vesting wallets for teams, investors, and advisors, then verify each schedule on-chain."
        color={COLOR}
        image="/images/carousel/token-vesting.png"
        compact
        stats={[
          { label: 'Schedules', value: 'Linear + Cliff' },
          { label: 'Model', value: 'VestingWallet' },
          { label: 'Release', value: 'On demand' },
          { label: 'Claims', value: 'Beneficiary' },
          { label: 'Fee', value: '0.03 zkLTC' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '920px' }}>
        {!isConnected ? (
          <ConnectWalletPrompt
            body="Connect to create vesting wallets and inspect beneficiary schedules. Vested tokens are released by calling release(token) on the vesting wallet."
            previewTitle="Vesting preview"
            previewItems={[
              { label: 'Schedule', value: 'Linear + cliff', detail: 'Model team, investor, or advisor unlocks.' },
              { label: 'Release', value: 'On-chain call', detail: 'Call release(token) on the vesting wallet.' },
              { label: 'Proof', value: 'Wallet address', detail: 'Each vesting wallet remains inspectable.' },
            ]}
            nextActions={[
              { href: '/launch', label: 'Deploy token' },
              { href: '/docs', label: 'Vesting docs' },
            ]}
          />
        ) : (
          <>
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
            {activeTab === 'create' ? <VestingForm /> : <MySchedules />}
          </>
        )}
      </div>
    </div>
  )
}
