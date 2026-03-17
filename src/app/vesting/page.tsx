'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { Navbar } from '@/components/layout/Navbar'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { VestingForm } from '@/components/vesting/VestingForm'
import { MySchedules } from '@/components/vesting/MySchedules'

type Tab = 'create' | 'my'

const COLOR = '#F5A623'
const COLOR_RGB = '245,166,35'
const TABS: { id: Tab; label: string }[] = [
  { id: 'create', label: 'Create Schedule' },
  { id: 'my', label: 'My Schedules' },
]
const FACTS: [string, string][] = [
  ['Fee', '0.03 zkLTC'],
  ['Schedules', 'Linear + Cliff'],
  ['Release', 'Automatic'],
  ['Claims', 'Zero'],
]

export default function VestingPage() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('create')
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      card.style.animation = 'none'
      card.style.transform = `perspective(600px) rotateX(${(y - 0.5) * -8}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-4px)`
    }
    const onLeave = () => {
      card.style.transform = ''
      card.style.animation = 'cardFloat 6s ease-in-out infinite'
    }
    card.addEventListener('mousemove', onMove)
    card.addEventListener('mouseleave', onLeave)
    return () => { card.removeEventListener('mousemove', onMove); card.removeEventListener('mouseleave', onLeave) }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0818', color: '#f0eef5' }}>
      <Navbar />

      {/* HERO */}
      <div className="tool-hero">
        <div className="tool-hero-bg">
          <div className="tool-hero-glow" style={{ background: `radial-gradient(ellipse,rgba(${COLOR_RGB},.06) 0%,transparent 70%)` }} />
          <div className="tool-hero-glow-2" />
          <div className="tool-hero-grid" />
        </div>
        <div className="tool-hero-inner">
          <div style={{ maxWidth: 480 }}>
            <div className="tool-badge fade-up d1" style={{ background: `rgba(${COLOR_RGB},.08)`, border: `1px solid rgba(${COLOR_RGB},.15)`, color: COLOR }}>
              <div className="tool-badge-dot" style={{ background: COLOR }} />
              Token Distribution
            </div>
            <h1 className="tool-hero-title fade-up d2">
              <span className="white">Lester </span>
              <span className="accent" style={{ backgroundImage: `linear-gradient(135deg,${COLOR},#E44FB5)` }}>Vester</span>
            </h1>
            <p className="tool-hero-desc fade-up d3">Create vesting schedules for teams, investors, and advisors. Auto-release, zero claims.</p>
            <div className="tool-hero-stats fade-up d4">
              {[['Schedules','Linear + Cliff'],['Release','Automatic'],['Claims','Zero'],['Fee','0.03 zkLTC']].map(([l,v]) => (
                <div key={l} style={{ display:'flex',flexDirection:'column',gap:2 }}>
                  <div className="tool-stat-label">{l}</div>
                  <div className="tool-stat-value">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div ref={cardRef} className="tool-illus-card fade-up d3" style={{ borderColor: `rgba(${COLOR_RGB},.12)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/carousel/token-vesting.png" alt="Lester Vester" />
            <div className="tool-illus-glow" style={{ background: `radial-gradient(ellipse at 50% 100%,rgba(${COLOR_RGB},.2) 0%,transparent 60%)` }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 clamp(16px,4vw,40px)' }}>
        <div className="tool-section-divide" />
      </div>

      {/* WORKSPACE */}
      <div className="tool-workspace-wrap">
        <div className="tool-ws-bg">
          <div className="tool-ws-glow-1" style={{ background: `radial-gradient(circle,rgba(${COLOR_RGB},.04) 0%,transparent 70%)` }} />
          <div className="tool-ws-glow-2" />
          <div className="tool-ws-glow-3" />
          <div className="tool-ws-scanline" />
        </div>
        <div className="tool-workspace">
          {/* Left */}
          <div>
            {!isConnected ? (
              <ConnectWalletPrompt />
            ) : (
              <>
                <div className="tool-tab-bar">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="tool-tab"
                      style={{
                        background: activeTab === tab.id ? COLOR : 'transparent',
                        color: activeTab === tab.id ? '#fff' : 'rgba(240,238,245,0.45)',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {activeTab === 'create' ? <VestingForm /> : <MySchedules />}
              </>
            )}
          </div>
          {/* Right: info card */}
          <div className="tool-preview">
            <div className="tool-preview-card">
              <div className="tool-preview-header">
                <div className="tool-preview-dot" style={{ background: COLOR, boxShadow: `0 0 6px ${COLOR}` }} />
                <div className="tool-preview-label">About This Tool</div>
              </div>
              <div className="tool-preview-body">
                <div style={{ borderRadius:16, overflow:'hidden', marginBottom:20, border:`1px solid rgba(${COLOR_RGB},.1)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/carousel/token-vesting.png" alt="Lester Vester" style={{ width:'100%', display:'block', objectFit:'cover', height:160 }} />
                </div>
                {FACTS.map(([k,v]) => (
                  <div key={k} className="tool-preview-stat">
                    <span className="tool-preview-stat-k">{k}</span>
                    <span className="tool-preview-stat-v">{v}</span>
                  </div>
                ))}
                <div className="tool-preview-network">
                  <div className="tool-preview-net-dot" />
                  <span className="tool-preview-net-text">Network</span>
                  <span className="tool-preview-net-name">LitVM Testnet</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
