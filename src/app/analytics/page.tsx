'use client'

import dynamic from 'next/dynamic'
import { useState, type ComponentType } from 'react'

type Tab = 'trending' | 'tokens' | 'health' | 'dex' | 'bridge' | 'smartmoney'

const TrendingPanel = dynamic(
  () => import('@/components/analytics/TrendingPanel').then((mod) => mod.TrendingPanel),
  { ssr: false, loading: () => <AnalyticsPanelLoading label="Loading trending data..." /> },
)
const TokenTracker = dynamic(
  () => import('@/components/analytics/TokenTracker').then((mod) => mod.TokenTracker),
  { ssr: false, loading: () => <AnalyticsPanelLoading label="Loading token tracker..." /> },
)
const HealthPanel = dynamic(
  () => import('@/components/analytics/HealthPanel').then((mod) => mod.HealthPanel),
  { ssr: false, loading: () => <AnalyticsPanelLoading label="Loading network health..." /> },
)
const DexPanel = dynamic(
  () => import('@/components/analytics/DexPanel').then((mod) => mod.DexPanel),
  { ssr: false, loading: () => <AnalyticsPanelLoading label="Loading DEX analytics..." /> },
)
const BridgePanel = dynamic(
  () => import('@/components/analytics/BridgePanel').then((mod) => mod.BridgePanel),
  { ssr: false, loading: () => <AnalyticsPanelLoading label="Loading bridge analytics..." /> },
)
const SmartMoneyPanel = dynamic(
  () => import('@/components/analytics/SmartMoneyPanel').then((mod) => mod.SmartMoneyPanel),
  { ssr: false, loading: () => <AnalyticsPanelLoading label="Loading smart money data..." /> },
)

const TABS: { key: Tab; label: string }[] = [
  { key: 'trending', label: '🔥 TRENDING' },
  { key: 'tokens', label: 'TOKENS' },
  { key: 'health', label: 'HEALTH' },
  { key: 'dex', label: 'DEX' },
  { key: 'bridge', label: 'BRIDGE' },
  { key: 'smartmoney', label: 'SMART MONEY' },
]

const TAB_COMPONENTS = {
  trending: TrendingPanel,
  tokens: TokenTracker,
  health: HealthPanel,
  dex: DexPanel,
  bridge: BridgePanel,
  smartmoney: SmartMoneyPanel,
} satisfies Record<Tab, ComponentType>

function AnalyticsPanelLoading({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-white/45">
      {label}
    </div>
  )
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('trending')
  const ActivePanel = TAB_COMPONENTS[activeTab]

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-[120px]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-white/50">
            LitVM chain data — tokens, network health, and more
          </p>
        </div>

        <div className="mb-8 flex items-end gap-0 border-b border-white/10">
          {TABS.map((tab) => (
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

        <ActivePanel />
      </div>
    </main>
  )
}
