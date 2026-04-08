'use client'

import { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { TokenTracker } from '@/components/analytics/TokenTracker'
import { HealthPanel } from '@/components/analytics/HealthPanel'

type Tab = 'tokens' | 'health'

const TABS: { key: Tab; label: string }[] = [
  { key: 'tokens', label: 'TOKENS' },
  { key: 'health', label: 'HEALTH' },
]

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('tokens')

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <LTCBanner />
      <Navbar />
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-white/50 text-sm mt-1">LitVM chain data — tokens, network health, and more</p>
        </div>

        {/* Tab bar */}
        <div className="flex items-end gap-0 border-b border-white/10 mb-8">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-5 py-3 text-xs font-mono tracking-wider transition-colors duration-200"
              style={{
                color: activeTab === tab.key ? 'var(--foreground)' : 'rgba(255,255,255,0.35)',
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          ))}
          {/* Future tabs — grayed out */}
          {['DEX', 'BRIDGE', 'SMART MONEY'].map(label => (
            <button
              key={label}
              disabled
              className="relative px-5 py-3 text-xs font-mono tracking-wider text-white/15 cursor-not-allowed"
            >
              {label}
              <span className="ml-1.5 text-[10px] text-white/20 font-sans normal-case tracking-normal">soon</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'tokens' && <TokenTracker />}
        {activeTab === 'health' && <HealthPanel />}
      </div>
    </main>
  )
}
