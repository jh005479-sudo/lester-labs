'use client'

import { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { TokenWizard } from '@/components/launch/TokenWizard'
import { ToolHero } from '@/components/shared/ToolHero'

const COLOR = '#6B4FFF'
const COLOR_RGB = '107,79,255'

interface WizardState {
  name: string; symbol: string; supply: string
  decimals: number; mintable: boolean; burnable: boolean; pausable: boolean
}

export default function LaunchPage() {
  const [wizState, setWizState] = useState<WizardState>({
    name: '', symbol: '', supply: '', decimals: 18,
    mintable: false, burnable: true, pausable: false,
  })

  const iconLetter = wizState.symbol ? wizState.symbol.charAt(0) : '?'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0818', color: '#f0eef5' }}>
      <Navbar />

      <ToolHero
        category="Token Creation"
        title="Lester"
        titleHighlight="Minter"
        subtitle="Deploy a custom ERC-20 token on LitVM in under a minute. No code required. No compromises."
        color={COLOR}
        image="/images/carousel/token-factory.png"
        compact
        stats={[
          { label: 'Type', value: 'ERC-20' },
          { label: 'Speed', value: '< 1 min' },
          { label: 'Code', value: 'None' },
          { label: 'Fee', value: '0.05 zkLTC' },
        ]}
      />

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
          <div className="tool-preview tool-preview-launch-align">
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
                  {([['Mintable', wizState.mintable], ['Burnable', wizState.burnable], ['Pausable', wizState.pausable]] as [string, boolean][]).map(([l, on]) => (
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
