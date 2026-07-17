'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { LaunchFlowRail } from '@/components/shared/LaunchFlowRail'
import { LiveActivityRail } from '@/components/shared/LiveActivityRail'

function PanelLoading() {
  return (
    <div className="space-y-3" aria-live="polite" aria-label="Loading analytics panel">
      <div className="h-24 animate-pulse rounded-lg border border-white/8 bg-white/[0.035]" />
      <div className="h-48 animate-pulse rounded-lg border border-white/8 bg-white/[0.025]" />
    </div>
  )
}

const TrendingPanel = dynamic(() => import('@/components/analytics/TrendingPanel').then((module) => module.TrendingPanel), { loading: PanelLoading })
const TokenTracker = dynamic(() => import('@/components/analytics/TokenTracker').then((module) => module.TokenTracker), { loading: PanelLoading })
const HealthPanel = dynamic(() => import('@/components/analytics/HealthPanel').then((module) => module.HealthPanel), { loading: PanelLoading })
const DexPanel = dynamic(() => import('@/components/analytics/DexPanel').then((module) => module.DexPanel), { loading: PanelLoading })
const BridgePanel = dynamic(() => import('@/components/analytics/BridgePanel').then((module) => module.BridgePanel), { loading: PanelLoading })
const WhaleWatcherPanel = dynamic(() => import('@/components/analytics/WhaleWatcherPanel').then((module) => module.WhaleWatcherPanel), { loading: PanelLoading })
const GasAnalyticsPanel = dynamic(() => import('@/components/analytics/GasAnalyticsPanel').then((module) => module.GasAnalyticsPanel), { loading: PanelLoading })

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
      <div className="pt-[120px] max-w-7xl mx-auto px-4 pb-20">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-white/50 text-sm mt-1">LitVM chain data — tokens, network health, and more</p>
          <p className="mt-2 text-xs text-white/30">Token discovery and activity tables use bounded newest-first chain samples; they are not complete holder or price indexes.</p>
        </div>

        <LaunchFlowRail active="analytics" compact />
        <div className="mt-8">
          <LiveActivityRail surface="analytics" />
        </div>

        {/* Tab bar */}
        <div role="tablist" aria-label="Analytics views" className="flex items-end gap-0 overflow-x-auto border-b border-white/10 mb-8">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              aria-selected={activeTab === tab.key}
              role="tab"
              onClick={() => setActiveTab(tab.key)}
              className="relative min-h-11 shrink-0 px-5 py-3 text-xs font-mono tracking-wider transition-colors duration-200"
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
