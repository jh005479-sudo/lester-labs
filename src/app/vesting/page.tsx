'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { VestingForm } from '@/components/vesting/VestingForm'
import { MySchedules } from '@/components/vesting/MySchedules'
import { ToolHero } from '@/components/shared/ToolHero'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

type Tab = 'create' | 'my'
const COLOR = '#F5A623'
const TABS: { id: Tab; label: string }[] = [
  { id: 'create', label: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled ? 'New Schedule' : 'New Schedule (Disabled)' },
  { id: 'my', label: 'My Schedules' },
]

export default function VestingPage() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('create')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <ToolHero
        category={PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled ? 'Reviewed / Token Distribution' : 'Containment / Token Distribution'}
        title="Lester"
        titleHighlight="Vester"
        subtitle={PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled
          ? 'Create a source-pinned replacement schedule or inspect and release an authenticated legacy vesting position.'
          : 'Inspect historical vesting schedules and replacement readiness. New paid schedules remain disabled during post-compromise containment.'}
        color={COLOR}
        image="/images/carousel/token-vesting.png"
        compact
        stats={[
          { label: 'Schedules', value: 'Linear + Cliff' },
          { label: 'Model', value: 'VestingWallet' },
          { label: 'Recovery', value: 'Beneficiary release' },
          { label: 'Writes', value: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled ? 'Source-pinned' : 'New schedules disabled' },
          { label: 'Status', value: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled ? 'Public-testnet replacement' : 'Replacement pending' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '920px' }}>
        {!isConnected ? (
          <ConnectWalletPrompt
            body={PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled
              ? 'Connect to create a source-pinned replacement schedule or inspect and release eligible beneficiary schedules.'
              : 'Connect only to inspect beneficiary schedules or use the existing beneficiary release path. New paid schedule creation remains disabled.'}
            previewTitle="Vesting preview"
            previewItems={[
              { label: 'Schedule', value: 'Linear + cliff', detail: 'Model team, investor, or advisor unlocks.' },
              { label: 'Release', value: 'On-chain call', detail: 'Call release(token) on the vesting wallet.' },
              { label: 'Proof', value: 'Wallet address', detail: 'Each vesting wallet remains inspectable.' },
            ]}
            nextActions={[
              { href: '/launch', label: 'Factory status' },
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
