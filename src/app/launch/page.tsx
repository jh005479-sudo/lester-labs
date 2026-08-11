'use client'

import { useState } from 'react'
import { TokenWizard } from '@/components/launch/TokenWizard'
import { BuilderChecklist } from '@/components/shared/BuilderChecklist'
import { ToolHero } from '@/components/shared/ToolHero'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

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
      <ToolHero
        category={PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled ? 'Reviewed / Token Factory' : 'Containment / Token Factory'}
        title="Lester"
        titleHighlight="Minter"
        subtitle={PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled
          ? 'Configure and deploy through the source-pinned post-compromise Token Factory after reviewing the exact fee and wallet prompt.'
          : 'Inspect the token configuration flow while new deployments remain disabled pending a source-pinned post-compromise factory and controller.'}
        color={COLOR}
        image="/images/carousel/token-factory.png"
        compact
        flowKey="minter"
        stats={[
          { label: 'Type', value: 'ERC-20' },
          { label: 'Mode', value: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled ? 'Reviewed creation' : 'Readiness' },
          { label: 'Writes', value: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled ? 'Source-pinned' : 'Disabled' },
          { label: 'Status', value: PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled ? 'Replacement candidate' : 'Replacement pending' },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <BuilderChecklist />
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
          {/* Right: configuration preview */}
          <div className="tool-preview tool-preview-launch-align">
            <div className="tool-preview-card">
              <div className="tool-preview-header">
                <div className="tool-preview-dot" style={{ background: COLOR, boxShadow: `0 0 6px ${COLOR}` }} />
                <div className="tool-preview-label">Configuration Preview</div>
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
                  <span className="tool-preview-net-text">Target network</span>
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
