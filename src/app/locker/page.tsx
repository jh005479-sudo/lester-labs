'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Lock } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { LockForm } from '@/components/locker/LockForm'
import { MyLocks } from '@/components/locker/MyLocks'

type Tab = 'create' | 'my-locks'

const TABS: { id: Tab; label: string }[] = [
  { id: 'create', label: 'Create Lock' },
  { id: 'my-locks', label: 'My Locks' },
]

export default function LockerPage() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('create')

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        {/* Page header */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Lock size={20} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Lester Lockup</h1>
          </div>
          <p className="text-white/50">
            Lock LP tokens on-chain with time-based release and shareable lock certificates.
          </p>
        </div>

        {!isConnected ? (
          <ConnectWalletPrompt />
        ) : (
          <>
            {/* Tab switcher */}
            <div className="mb-6 flex rounded-xl border border-white/10 bg-[var(--surface-1)] p-1 gap-1">
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
            {activeTab === 'create' && <LockForm />}
            {activeTab === 'my-locks' && <MyLocks />}
          </>
        )}
      </main>
    </div>
  )
}
