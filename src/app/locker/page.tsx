'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Navbar } from '@/components/layout/Navbar'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { LockForm } from '@/components/locker/LockForm'
import { MyLocks } from '@/components/locker/MyLocks'
import { ToolHero } from '@/components/shared/ToolHero'

type Tab = 'create' | 'my-locks'
const COLOR = '#2DCE89'
const TABS: { id: Tab; label: string }[] = [
  { id: 'create', label: 'Create Lock' },
  { id: 'my-locks', label: 'My Locks' },
]

export default function LockerPage() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('create')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <Navbar />
      <ToolHero
        category="LP Security"
        title="Lester"
        titleHighlight="Lockup"
        subtitle="Lock LP tokens on-chain with time-based release and shareable lock certificates."
        color={COLOR}
        image="/images/carousel/liquidity-locker.png"
        compact
        stats={[
          { label: 'Proof', value: 'On-chain' },
          { label: 'Certificate', value: 'Shareable' },
          { label: 'Trust', value: 'Day one' },
          { label: 'Fee', value: '0.03 zkLTC' },
        ]}
      />
      <div className="tool-page-content" style={{ maxWidth: '920px' }}>
        {!isConnected ? (
          <ConnectWalletPrompt />
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
