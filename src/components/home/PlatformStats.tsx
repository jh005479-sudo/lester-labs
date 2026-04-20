'use client'

import { useEffect, useRef, useState } from 'react'
import type { PlatformStatsSnapshot } from '@/lib/platformStats'

const POLL_INTERVAL_MS = 30_000
const SESSION_CACHE_KEY = 'lester_platform_stats_v1'

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

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function isValidSnapshot(value: unknown): value is PlatformStatsSnapshot {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<PlatformStatsSnapshot>
  return (
    typeof candidate.tokensMinted === 'number' &&
    typeof candidate.walletsAirdropped === 'number' &&
    typeof candidate.presalesCreated === 'number' &&
    typeof candidate.swapsCompleted === 'number' &&
    typeof candidate.onChainMessages === 'number' &&
    typeof candidate.fetchedAt === 'string'
  )
}

export function PlatformStats() {
  const [snapshot, setSnapshot] = useState<PlatformStatsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const hasSnapshotRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SESSION_CACHE_KEY)
      if (!cached) {
        setLoading(true)
        return
      }

      const parsed = JSON.parse(cached) as unknown
      if (isValidSnapshot(parsed)) {
        setSnapshot(parsed)
        setLoading(false)
        hasSnapshotRef.current = true
      }
    } catch {
      setLoading(true)
    }
  }, [])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    const fetchSnapshot = async () => {
      try {
        const response = await fetch('/api/platform-stats', {
          cache: 'no-store',
        })

        if (!response.ok) throw new Error('Failed to fetch platform stats')
        const payload = (await response.json()) as unknown
        if (!isValidSnapshot(payload)) throw new Error('Invalid platform stats payload')

        if (!mountedRef.current) return

        setSnapshot(payload)
        setLoading(false)
        hasSnapshotRef.current = true
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(payload))
      } catch {
        if (!mountedRef.current) return
        setLoading((current) => current && !hasSnapshotRef.current)
      }
    }

    void fetchSnapshot()
    intervalId = setInterval(() => {
      void fetchSnapshot()
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
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
        value={loading || snapshot === null ? '—' : formatCount(snapshot.tokensMinted)}
        accent="#6B4FFF"
      />
      <StatChip
        label="Wallets Airdropped"
        value={loading || snapshot === null ? '—' : formatCount(snapshot.walletsAirdropped)}
        accent="#36D1DC"
      />
      <StatChip
        label="Pre-sales Created"
        value={loading || snapshot === null ? '—' : formatCount(snapshot.presalesCreated)}
        accent="#5E6AD2"
      />
      <StatChip
        label="Swaps Completed"
        value={loading || snapshot === null ? '—' : formatCount(snapshot.swapsCompleted)}
        accent="#E44FB5"
      />
      <StatChip
        label="On-chain Messages"
        value={loading || snapshot === null ? '—' : formatCount(snapshot.onChainMessages)}
        accent="#F5A623"
      />
    </div>
  )
}
