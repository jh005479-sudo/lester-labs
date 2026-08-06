'use client'

import { useState } from 'react'
import { useLitvmNetwork } from '@/hooks/useLitvmNetwork'

export default function NetworkGuard() {
  const { isWrongNetwork, isSwitchingChain, switchToLitvm } = useLitvmNetwork()
  const [switchError, setSwitchError] = useState<string | null>(null)

  if (!isWrongNetwork) return null

  async function handleSwitch() {
    setSwitchError(null)
    const result = await switchToLitvm()
    if (!result.switched) setSwitchError(result.error ?? 'The wallet did not switch to LitVM LiteForge.')
  }

  return (
    <div style={{
      position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 200,
      background: 'rgba(251, 191, 36, 0.06)',
      border: '1px solid rgba(251, 191, 36, 0.15)',
      borderRadius: '12px', padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: '14px',
      fontSize: '13px', backdropFilter: 'blur(20px)',
    }}>
      <span style={{ color: 'var(--warning)' }}>
        Wrong network — switch to LitVM LiteForge (Chain ID 4441)
        {switchError ? ` · ${switchError}` : ''}
      </span>
      <button
        onClick={() => { void handleSwitch() }}
        disabled={isSwitchingChain}
        className="cin-btn"
        style={{ padding: '5px 14px', fontSize: '12px', background: 'rgba(251,191,36,0.12)', color: 'var(--warning)', boxShadow: 'none', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        {isSwitchingChain ? 'Switching…' : 'Switch to LitVM'}
      </button>
    </div>
  )
}
