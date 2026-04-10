'use client'

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'
import { TrendingPanel } from '@/components/analytics/TrendingPanel'
import { TokenTracker } from '@/components/analytics/TokenTracker'
import { HealthPanel } from '@/components/analytics/HealthPanel'

import { DexPanel } from '@/components/analytics/DexPanel'
import { BridgePanel } from '@/components/analytics/BridgePanel'
import { SmartMoneyPanel } from '@/components/analytics/SmartMoneyPanel'

type Tab = 'trending' | 'tokens' | 'health' | 'dex' | 'bridge' | 'smartmoney'

const TABS: { key: Tab; label: string }[] = [
  { key: 'trending', label: '🔥 TRENDING' },
  { key: 'tokens', label: 'TOKENS' },
  { key: 'health', label: 'HEALTH' },
  { key: 'dex', label: 'DEX' },
  { key: 'bridge', label: 'BRIDGE' },
  { key: 'smartmoney', label: 'SMART MONEY' },
]

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('trending')

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll('.analytics-card')) as HTMLElement[]
    const cleanups: Array<() => void> = []

    cards.forEach((el) => {
      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -3
        const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 3
        el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`
      }

      const onLeave = () => {
        el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)'
      }

      el.addEventListener('mousemove', onMove)
      el.addEventListener('mouseleave', onLeave)
      cleanups.push(() => {
        el.removeEventListener('mousemove', onMove)
        el.removeEventListener('mouseleave', onLeave)
      })
    })

    return () => cleanups.forEach((fn) => fn())
  }, [activeTab])

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

        </div>

        {/* Tab content */}
        {activeTab === 'trending' && <TrendingPanel />}
        {activeTab === 'tokens' && <TokenTracker />}
        {activeTab === 'health' && <HealthPanel />}
        {activeTab === 'dex' && <DexPanel />}
        {activeTab === 'bridge' && <BridgePanel />}
        {activeTab === 'smartmoney' && <SmartMoneyPanel />}
      </div>
    </main>
  )
}
