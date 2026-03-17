'use client'

import { useEffect, useRef, useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { TokenWizard } from '@/components/launch/TokenWizard'

const COLOR = '#6B4FFF'
const COLOR_RGB = '107,79,255'

interface WizardState {
  name: string
  symbol: string
  supply: string
  decimals: number
  mintable: boolean
  burnable: boolean
  pausable: boolean
}

export default function LaunchPage() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [wizState, setWizState] = useState<WizardState>({
    name: '', symbol: '', supply: '', decimals: 18,
    mintable: false, burnable: true, pausable: false,
  })

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

  const iconLetter = wizState.symbol ? wizState.symbol.charAt(0) : '?'

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
          {/* Left */}
          <div style={{ maxWidth: 480 }}>
            <div className="tool-badge fade-up d1" style={{ background: `rgba(${COLOR_RGB},.08)`, border: `1px solid rgba(${COLOR_RGB},.15)`, color: '#8B74FF' }}>
              <div className="tool-badge-dot" style={{ background: COLOR }} />
              Token Creation
            </div>
            <h1 className="tool-hero-title fade-up d2">
              <span className="white">Lester </span>
              <span className="accent" style={{ backgroundImage: `linear-gradient(135deg,#8B74FF,${COLOR},#E44FB5)` }}>Minter</span>
            </h1>
            <p className="tool-hero-desc fade-up d3">Deploy a custom ERC-20 token on LitVM in under a minute. No code required. No compromises.</p>
            <div className="tool-hero-stats fade-up d4">
              {[['Type','ERC-20'],['Speed','< 1 min'],['Code','None'],['Fee','0.05 zkLTC']].map(([l,v]) => (
                <div key={l} style={{ display:'flex',flexDirection:'column',gap:2 }}>
                  <div className="tool-stat-label">{l}</div>
                  <div className="tool-stat-value">{v}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Right — illustration card */}
          <div ref={cardRef} className="tool-illus-card fade-up d3" style={{ borderColor: `rgba(${COLOR_RGB},.12)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/carousel/token-factory.png" alt="Lester Minter" />
            <div className="tool-illus-glow" style={{ background: `radial-gradient(ellipse at 50% 100%,rgba(${COLOR_RGB},.2) 0%,transparent 60%)` }} />
            {[
              {s:'4px',c:'#8B74FF',t:'20%',l:'5%',d:'0s'},
              {s:'3px',c:'#E44FB5',t:'60%',r:'8%',d:'1.5s'},
              {s:'3px',c:COLOR,b:'30%',l:'10%',d:'2.5s'},
              {s:'2px',c:'#36D1DC',t:'40%',r:'15%',d:'3.5s'},
            ].map((p,i) => (
              <div key={i} style={{
                position:'absolute', width:p.s, height:p.s, borderRadius:'50%', background:p.c,
                top:(p as {s:string;c:string;t?:string;l?:string;r?:string;b?:string;d:string}).t,
                bottom:(p as {s:string;c:string;t?:string;l?:string;r?:string;b?:string;d:string}).b,
                left:(p as {s:string;c:string;t?:string;l?:string;r?:string;b?:string;d:string}).l,
                right:(p as {s:string;c:string;t?:string;l?:string;r?:string;b?:string;d:string}).r,
                opacity:0, animation:`particleDrift 4s ease-in-out ${p.d} infinite`,
              }} />
            ))}
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
          {/* Left: form */}
          <div>
            <TokenWizard onStateChange={setWizState} />
          </div>
          {/* Right: live preview */}
          <div className="tool-preview">
            <div className="tool-preview-card">
              <div className="tool-preview-header">
                <div className="tool-preview-dot" style={{ background: COLOR, boxShadow: `0 0 6px ${COLOR}` }} />
                <div className="tool-preview-label">Live Preview</div>
              </div>
              <div className="tool-preview-body">
                <div className="tool-preview-icon" style={{ background: `linear-gradient(135deg,${COLOR},#E44FB5)`, boxShadow: `0 4px 20px rgba(${COLOR_RGB},.2)` }}>
                  {iconLetter}
                </div>
                <div className="tool-preview-name">{wizState.name || 'Your Token'}</div>
                <div className="tool-preview-symbol" style={{ color: '#8B74FF' }}>{wizState.symbol || 'SYMBOL'}</div>
                <div className="tool-preview-stat"><span className="tool-preview-stat-k">Total Supply</span><span className="tool-preview-stat-v">{wizState.supply ? Number(wizState.supply).toLocaleString() : '—'}</span></div>
                <div className="tool-preview-stat"><span className="tool-preview-stat-k">Decimals</span><span className="tool-preview-stat-v">{wizState.decimals}</span></div>
                <div className="tool-preview-stat"><span className="tool-preview-stat-k">Standard</span><span className="tool-preview-stat-v">ERC-20</span></div>
                <div className="tool-preview-feats">
                  {([['Mintable',wizState.mintable],['Burnable',wizState.burnable],['Pausable',wizState.pausable]] as [string,boolean][]).map(([l,on]) => (
                    <span key={l} className={on ? 'tool-preview-feat-on' : 'tool-preview-feat-off'}>{l}</span>
                  ))}
                </div>
                <div className="tool-preview-network">
                  <div className="tool-preview-net-dot" />
                  <span className="tool-preview-net-text">Deploying to</span>
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
