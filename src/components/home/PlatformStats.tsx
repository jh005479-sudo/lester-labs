'use client'

import { useState, useEffect, useRef } from 'react'
import { useReadContract } from 'wagmi'
import { ILO_FACTORY_ADDRESS, DISPERSE_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { ILO_FACTORY_ABI } from '@/config/abis'
import { RPC_URL } from '@/lib/rpcClient'

const POLL_INTERVAL = 30_000 // 30s
const TOKEN_FACTORY = '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' as const
const TOKEN_EVENT_SIG = '0xd5d05a8421149c74fd223cfc823befb883babf9bf0b0e4d6bf9c8fdb70e59bb4'
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// ── Stat chip ───────────────────────────────────────────────────────────
function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '10px 20px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
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

// ── ILO count hook ──────────────────────────────────────────────────────
type ILOFactoryFn = 'creationFee' | 'allILOs' | 'getILOCount' | 'getOwnerILOs'

function useILOFactoryCounter(fn: ILOFactoryFn) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { data, refetch } = useReadContract({
    address: ILO_FACTORY_ADDRESS as `0x${string}`,
    abi: ILO_FACTORY_ABI as any,
    functionName: fn as any,
    query: { enabled: isValidContractAddress(ILO_FACTORY_ADDRESS) },
  })

  useEffect(() => {
    intervalRef.current = setInterval(() => { refetch() }, POLL_INTERVAL)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [refetch])

  return data !== undefined && data !== null ? String(data) : '—'
}

// ── Token count from event logs ─────────────────────────────────────────
async function fetchTokenCount(): Promise<number> {
  const CACHE_KEY = 'lester_cached_token_count'
  try {
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          address: TOKEN_FACTORY,
          topics: [TOKEN_EVENT_SIG],
          fromBlock: '0x1',
          toBlock:   'latest',
        }],
        id: 1,
      }),
    })
    const json = await resp.json()
    const count = Array.isArray(json.result) ? json.result.length : 0
    sessionStorage.setItem(CACHE_KEY, String(count))
    return count
  } catch {
    const cached = sessionStorage.getItem(CACHE_KEY)
    return cached ? parseInt(cached) : 0
  }
}

// ── Airdrop wallet count from Disperse contract Transfer events ───────────
async function fetchAirdropWalletCount(): Promise<number> {
  if (!isValidContractAddress(DISPERSE_ADDRESS)) return 0
  const CACHE_KEY = 'lester_cached_airdrop_count'
  try {
    // Transfer(from=Disperse, to=recipient) events — all recipients ofDisperse transfers
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          // Transfer(address indexed from, address indexed to, uint256 value)
          topics: [
            TRANSFER_SIG,
            '0x' + DISPERSE_ADDRESS.slice(2).padStart(64, '0'),  // from = Disperse
            null,                                               // to = any
          ],
          fromBlock: '0x1',
          toBlock:   'latest',
        }],
        id: 1,
      }),
    })
    const json = await resp.json()
    if (!Array.isArray(json.result)) {
      const cached = sessionStorage.getItem(CACHE_KEY)
      return cached ? parseInt(cached) : 0
    }
    // Deduplicate recipients (unique wallet addresses)
    const wallets = new Set<string>()
    for (const ev of json.result) {
      if (ev.topics[2]) {
        const to = '0x' + ev.topics[2].slice(26)
        wallets.add(to.toLowerCase())
      }
    }
    const count = wallets.size
    sessionStorage.setItem(CACHE_KEY, String(count))
    return count
  } catch {
    const cached = sessionStorage.getItem(CACHE_KEY)
    return cached ? parseInt(cached) : 0
  }
}

export function PlatformStats() {
  const iloCount  = useILOFactoryCounter('getILOCount')
  const [tokenCount, setTokenCount] = useState<string>('—')
  const [airdropCount, setAirdropCount] = useState<string>('—')
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initial fetch + 30s polling for token count
  useEffect(() => {
    fetchTokenCount().then(c => {
      setTokenCount(String(c))
      setLoading(false)
    })

    intervalRef.current = setInterval(async () => {
      const c = await fetchTokenCount()
      setTokenCount(String(c))
    }, POLL_INTERVAL)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // Airdrop wallet count — fetch once on mount (disperse events don't change for a static stat)
  useEffect(() => {
    fetchAirdropWalletCount().then(c => {
      setAirdropCount(String(c))
    })
  }, [])

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginTop: 20,
    }}>
      <StatChip
        label="Tokens Minted"
        value={loading ? '—' : tokenCount}
        accent="#6B4FFF"
      />
      <StatChip
        label="Pre-sales Created"
        value={iloCount}
        accent="#5E6AD2"
      />
      <StatChip
        label="Wallets Airdropped"
        value={airdropCount}
        accent="#36D1DC"
      />
    </div>
  )
}
