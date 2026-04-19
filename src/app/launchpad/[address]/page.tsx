'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAccount, useReadContract } from 'wagmi'
import { Navbar } from '@/components/layout/Navbar'
import { AlertTriangle, CircleCheck } from 'lucide-react'

const ILO_ABI = [
  { name: 'token', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'softCap', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'hardCap', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'tokensPerEth', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'startTime', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'endTime', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'totalRaised', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'liquidityBps', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'lpLockDuration', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'finalized', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'cancelled', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'whitelistEnabled', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'contribute', outputs: [], stateMutability: 'payable', type: 'function', inputs: [] },
  { name: 'claim', outputs: [], stateMutability: 'nonpayable', type: 'function', inputs: [] },
  { name: 'finalize', outputs: [], stateMutability: 'nonpayable', type: 'function', inputs: [] },
  { name: 'contributions', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [{ name: '', type: 'address' }] },
  { name: 'tokensRequired', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [] },
] as const

const ERC20_ABI = [
  { name: 'name', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function', inputs: [] },
  { name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function', inputs: [{ name: '', type: 'address' }] },
] as const

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

export default function PresalePage() {
  const { address } = useParams<{ address: string }>()
  const { address: user } = useAccount() ?? {}
  const iloAddress = (address || '') as `0x${string}`
  const [now, setNow] = useState(() => Date.now() / 1000)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now() / 1000)
    }, 30000)

    return () => window.clearInterval(timer)
  }, [])

  const ilo = {
    token: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'token' }),
    softCap: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'softCap' }),
    hardCap: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'hardCap' }),
    totalRaised: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'totalRaised' }),
    tokensPerEth: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'tokensPerEth' }),
    startTime: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'startTime' }),
    endTime: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'endTime' }),
    liquidityBps: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'liquidityBps' }),
    lpLockDuration: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'lpLockDuration' }),
    finalized: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'finalized' }),
    cancelled: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'cancelled' }),
    whitelistEnabled: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'whitelistEnabled' }),
    tokensRequired: useReadContract({ address: iloAddress, abi: ILO_ABI, functionName: 'tokensRequired' }),
  }

  const tokenAddr = ilo.token.data as `0x${string}` | undefined
  const tokenMeta = {
    name: useReadContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'name' }),
    symbol: useReadContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'symbol' }),
    decimals: useReadContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'decimals' }),
  }
  const userContribution = useReadContract({
    address: iloAddress,
    abi: ILO_ABI,
    functionName: 'contributions',
    args: [user || '0x0000000000000000000000000000000000000000'],
  })

  const raised = Number(ilo.totalRaised.data ?? 0) / 1e18
  const hardCap = Number(ilo.hardCap.data ?? 0) / 1e18
  const softCap = Number(ilo.softCap.data ?? 0) / 1e18
  const progress = hardCap > 0 ? Math.min(100, (raised / hardCap) * 100) : 0
  const start = Number(ilo.startTime.data ?? 0)
  const end = Number(ilo.endTime.data ?? 0)
  const isLive = now >= start && now <= end && !ilo.finalized.data && !ilo.cancelled.data
  const hasEnded = now > end
  const status = ilo.finalized.data ? 'Finalized' : ilo.cancelled.data ? 'Cancelled' : isLive ? 'Live' : hasEnded ? 'Ended' : 'Upcoming'

  const statusColor = status === 'Live' ? '#4ade80' : status === 'Finalized' ? '#818cf8' : '#f87171'
  const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <Link href="/launchpad" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
            ← Back to Launchpad
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>
                {tokenMeta.name.data || '…'} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>${tokenMeta.symbol.data || '…'}</span>
              </h1>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {address}
              </p>
            </div>
            <span style={{
              padding: '6px 14px',
              background: `${statusColor}22`,
              border: `1px solid ${statusColor}55`,
              borderRadius: '20px',
              fontSize: '13px',
              color: statusColor,
              fontWeight: 600,
            }}>
              ● {status}
            </span>
          </div>
        </div>

        {/* Progress card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Raised</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{raised.toFixed(4)} LTC / {hardCap.toFixed(4)} LTC</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{progress.toFixed(1)}%</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Filled</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{(hardCap - raised).toFixed(4)}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>LTC remaining</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{ilo.whitelistEnabled.data ? 'Yes' : 'No'}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Whitelist</div>
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Presale Details</h2>
          <StatRow label="Soft Cap" value={`${softCap.toFixed(4)} LTC`} />
          <StatRow label="Hard Cap" value={`${hardCap.toFixed(4)} LTC`} />
          <StatRow label="Token Price" value={ilo.tokensPerEth.data ? `${Number(ilo.tokensPerEth.data) / 1e18} tokens/LTC` : '…'} />
          <StatRow label="Liquidity" value={`${(Number(ilo.liquidityBps.data ?? 0) / 100).toFixed(0)}%`} />
          <StatRow label="LP Lock" value={`${Math.round(Number(ilo.lpLockDuration.data ?? 0) / 86400)} days`} />
          <StatRow label="Start Time" value={start > 0 ? new Date(start * 1000).toLocaleString() : '…'} />
          <StatRow label="End Time" value={end > 0 ? new Date(end * 1000).toLocaleString() : '…'} />
          <StatRow label="Your Contribution" value={userContribution.data ? `${Number(userContribution.data) / 1e18} LTC` : 'Not connected'} />
        </div>

        {/* Actions */}
        {status === 'Live' && (
          <div style={cardStyle}>
            <button
              disabled
              style={{
                width: '100%',
                padding: '14px',
                background: 'rgba(99,102,241,0.3)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'not-allowed',
              }}
            >
              Contribute — coming soon
            </button>
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '10px' }}>
              On-chain contribution UI requires wallet integration — connect your wallet to participate
            </p>
          </div>
        )}

        {status === 'Finalized' && (
          <div style={{ ...cardStyle, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <CircleCheck size={18} color="#4ade80" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80' }}>Presale Finalized</span>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              This presale reached its target and has been finalized. Tokens can be claimed by contributors.
            </p>
          </div>
        )}

        {status === 'Cancelled' && (
          <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <AlertTriangle size={18} color="#f87171" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#f87171' }}>Presale Cancelled</span>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              This presale was cancelled. Contributors can reclaim their funds.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
