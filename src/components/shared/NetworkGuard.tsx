'use client'

import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { litvm } from '@/config/chains'

export default function NetworkGuard() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  const isWrongNetwork = isConnected && chainId !== litvm.id
  if (!isWrongNetwork) return null

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
      <span style={{ color: 'var(--warning)' }}>Wrong network — switch to LitVM Testnet (Chain ID 4441)</span>
      <button
        onClick={() => switchChain({ chainId: litvm.id })}
        disabled={isPending}
        className="cin-btn"
        style={{ padding: '5px 14px', fontSize: '12px', background: 'rgba(251,191,36,0.12)', color: 'var(--warning)', boxShadow: 'none', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        {isPending ? 'Switching…' : 'Switch to LitVM'}
      </button>
    </div>
  )
}
