'use client'

import { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { TrendingPanel } from '@/components/analytics/TrendingPanel'
import { TokenTracker } from '@/components/analytics/TokenTracker'
import { HealthPanel } from '@/components/analytics/HealthPanel'

import { DexPanel } from '@/components/analytics/DexPanel'
import { BridgePanel } from '@/components/analytics/BridgePanel'
import { WhaleWatcherPanel } from '@/components/analytics/WhaleWatcherPanel'
import { GasAnalyticsPanel } from '@/components/analytics/GasAnalyticsPanel'
import { LaunchFlowRail } from '@/components/shared/LaunchFlowRail'
import { LiveActivityRail } from '@/components/shared/LiveActivityRail'

type Tab = 'trending' | 'tokens' | 'health' | 'dex' | 'bridge' | 'whalewatcher' | 'gas'

const TABS: { key: Tab; label: string }[] = [
  { key: 'trending', label: '🔥 TRENDING' },
  { key: 'tokens', label: 'TOKENS' },
  { key: 'health', label: 'HEALTH' },
  { key: 'dex', label: 'DEX' },
  { key: 'bridge', label: 'BRIDGE' },
  { key: 'whalewatcher', label: 'WHALE WATCHER' },
  { key: 'gas', label: 'GAS' },
]

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('trending')

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

        <LaunchFlowRail active="analytics" compact />
        <div className="mt-8">
          <LiveActivityRail surface="analytics" />
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

        </div>

        {/* Tab content */}
        {activeTab === 'trending' && <TrendingPanel />}
        {activeTab === 'tokens' && <TokenTracker />}
        {activeTab === 'health' && <HealthPanel />}
        {activeTab === 'dex' && <DexPanel />}
        {activeTab === 'bridge' && <BridgePanel />}
        {activeTab === 'whalewatcher' && <WhaleWatcherPanel />}
        {activeTab === 'gas' && <GasAnalyticsPanel />}
      </div>
    </main>
  )
}
