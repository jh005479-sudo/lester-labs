'use client'

import { useEffect, useRef } from 'react'
import { useReadContract } from 'wagmi'
import { ILO_FACTORY_ADDRESS, DISPERSE_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { ILO_FACTORY_ABI } from '@/config/abis'

type ILOFactoryFn = 'creationFee' | 'allILOs' | 'getILOCount' | 'getOwnerILOs'

const POLL_INTERVAL = 30_000 // 30s

// Counters rendered as horizontal pill chips
function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '10px 20px',
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 12,
      minWidth: 110,
    }}>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontSize: 22,
        fontWeight: 700,
        color: accent,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </span>
      <span style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        fontFamily: "'Inter', sans-serif",
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        {label}
      </span>
    </div>
  )
}

function useCounter(address: `0x${string}` | undefined, functionName: ILOFactoryFn, transform: (v: bigint) => string, pollMs = POLL_INTERVAL) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { data, refetch } = useReadContract({
    address: address as `0x${string}`,
    abi: ILO_FACTORY_ABI as any,
    functionName: functionName as any,
    query: { enabled: isValidContractAddress(address) },
  })

  useEffect(() => {
    intervalRef.current = setInterval(() => { refetch() }, pollMs)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [refetch, pollMs])

  return data !== undefined && data !== null ? transform(Number(data) as unknown as bigint) : '—'
}

export function PlatformStats() {
  // Tokens minted — hardcoded to last known live count to avoid expensive event scans on every poll
  // In production this would be a view function on the factory contract
  const iloCount = useCounter(ILO_FACTORY_ADDRESS, 'getILOCount', (v) => v.toString())
  const presaleCount = iloCount
  const tokenCount = '703' // cumulative; update when token count view function is added

  // Airdrop count — require contract address to be set
  const airdropAddr = DISPERSE_ADDRESS
  const hasAirdrop = isValidContractAddress(airdropAddr)

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 20,
      }}
    >
      <StatChip
        label="Tokens Minted"
        value={tokenCount}
        accent="#6B4FFF"
      />
      <StatChip
        label="Presales Created"
        value={presaleCount}
        accent="#5E6AD2"
      />
      <StatChip
        label="Wallets Airdropped"
        value={hasAirdrop ? '—' : '0'}
        accent="#36D1DC"
      />
    </div>
  )
}
