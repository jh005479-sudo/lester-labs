'use client'

import { useState, useEffect } from 'react'
import { getLatestBlockNumber, hexToNumber } from '@/lib/explorerRpc'

interface EmbedStats {
  blockHeight: number
  gasPrice: string
  chainId: number
  status: 'online' | 'offline'
}

export default function EmbedStatsPage() {
  const [stats, setStats] = useState<EmbedStats>({
    blockHeight: 0,
    gasPrice: '0',
    chainId: 4441,
    status: 'offline',
  })

  const fetchStats = async () => {
    try {
      const blockHeight = await getLatestBlockNumber()
      const newStats: EmbedStats = {
        blockHeight,
        gasPrice: '~0.001 Gwei',
        chainId: 4441,
        status: 'online',
      }
      setStats(newStats)
      // postMessage for parent
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'litvm-stats', stats: newStats }, '*')
      }
    } catch {
      setStats((s) => ({ ...s, status: 'offline' }))
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0f', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100vh', boxSizing: 'border-box' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '2px' }}>LITVM</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: stats.status === 'online' ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{stats.status === 'online' ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Block Height</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', fontFamily: 'monospace' }}>#{stats.blockHeight.toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Gas Price</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', fontFamily: 'monospace' }}>{stats.gasPrice}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Chain ID</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px', fontFamily: 'monospace' }}>{stats.chainId}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Network</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>LitVM</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
            lester-labs-psi.vercel.app · auto-refreshes every 15s
          </div>
        </div>
      </body>
    </html>
  )
}
