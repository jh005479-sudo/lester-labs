'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Clock } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { VestingForm } from '@/components/vesting/VestingForm'
import { MySchedules } from '@/components/vesting/MySchedules'

type Tab = 'create' | 'my'

export default function VestingPage() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('create')

  return (
    <div className="min-h-screen bg-background premium-tight">
      <Navbar />
      <main className="app-shell" style={{ maxWidth: 980 }}>
        {/* Header */}
        <div className="tool-hero">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Clock size={20} className="text-white" />
            </div>
            <h1 className="tool-hero-title">Token Vesting</h1>
          </div>
          <p className="tool-hero-copy">
            Create token vesting plans for teams, investors, and advisors.
          </p>
        </div>

        <div className="tool-after-hero">
        {!isConnected ? (
          <ConnectWalletPrompt />
        ) : (
          <div>
            {/* Tabs */}
            <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              {(
                [
                  { id: 'create', label: 'Create Schedule' },
                  { id: 'my', label: 'My Schedules' },
                ] as { id: Tab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'create' ? <VestingForm /> : <MySchedules />}
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
