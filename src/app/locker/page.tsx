'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { LockForm } from '@/components/locker/LockForm'
import { MyLocks } from '@/components/locker/MyLocks'
import { ToolHero } from '@/components/shared/ToolHero'

type Tab = 'create' | 'my-locks'
const COLOR = '#2DCE89'
const TABS: { id: Tab; label: string }[] = [
  { id: 'create', label: 'New Lock (Disabled)' },
  { id: 'my-locks', label: 'My Locks' },
]

export default function LockerPage() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('create')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <ToolHero
        category="Containment / LP Security"
        title="Lester"
        titleHighlight="Lockup"
        subtitle="Inspect historical LP locks and the replacement workflow. New paid locks remain disabled during post-compromise containment."
        color={COLOR}
        image="/images/carousel/liquidity-locker.png"
        compact
        flowKey="locker"
        stats={[
          { label: 'Proof', value: 'On-chain' },
          { label: 'Certificate', value: 'Shareable' },
          { label: 'Writes', value: 'Disabled' },
          { label: 'Status', value: 'Replacement pending' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '920px' }}>
        {!isConnected ? (
          <ConnectWalletPrompt
            body="Connect only to inspect locks associated with your wallet or use an available recovery path. New paid lock creation remains disabled."
            previewTitle="Lockup preview"
            previewItems={[
              { label: 'Certificate', value: 'Historical proof', detail: 'Inspect the recorded lock state and contract address.' },
              { label: 'Release', value: 'Time-based', detail: 'LP unlocks follow the on-chain schedule.' },
              { label: 'Discovery', value: 'Explorer links', detail: 'Every lock can be independently verified.' },
            ]}
            nextActions={[
              { href: '/pool', label: 'Find LP pair' },
              { href: '/docs', label: 'Locking docs' },
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
            {activeTab === 'create' && <LockForm />}
            {activeTab === 'my-locks' && <MyLocks />}
          </>
        )}
      </div>
    </div>
  )
}
