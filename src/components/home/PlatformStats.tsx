'use client'

import { useEffect, useRef, useState } from 'react'
import { PLATFORM_ACTIVITY_BASELINE } from '@/config/platformActivity'
import type { PlatformMetricName, PlatformStatsSnapshot } from '@/lib/platformStats'
import {
  getPlatformStatsSessionCacheKey,
  matchesCompiledPlatformActivityBaseline,
} from '@/lib/platformStatsDisclosure'

const POLL_INTERVAL_MS = 60_000
const SESSION_CACHE_KEY = getPlatformStatsSessionCacheKey(PLATFORM_ACTIVITY_BASELINE)

const metrics = [
  ['tokensMinted', 'Token Contracts Created', '#6B4FFF'],
  ['walletsAirdropped', 'Airdrop Entries', '#36D1DC'],
  ['presalesCreated', 'Pre-sales Created', '#5E6AD2'],
  ['swapsCompleted', 'Swaps Completed', '#E44FB5'],
  ['onChainMessages', 'On-chain Messages', '#F5A623'],
] as const satisfies ReadonlyArray<readonly [PlatformMetricName, string, string]>

function StatChip({ label, value, accent, coverage }: { label: string; value: string; accent: string; coverage?: string }) {
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
        color: 'var(--foreground-dim)',
        fontFamily: "'Inter', sans-serif",
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        {label}
      </span>
      {coverage && <small className="text-xs text-[var(--foreground-dim)]">{coverage}</small>}
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
    metrics.every(([key]) => Number.isSafeInteger(candidate[key]) && (candidate[key] ?? -1) >= 0 &&
      ['live', 'bounded', 'fallback', 'historical-baseline'].includes(candidate.coverage?.[key]?.status ?? '')) &&
    typeof candidate.fetchedAt === 'string' && Number.isFinite(Date.parse(candidate.fetchedAt)) &&
    matchesCompiledPlatformActivityBaseline(candidate.baseline, PLATFORM_ACTIVITY_BASELINE) &&
    Boolean(candidate.breakdown && typeof candidate.breakdown.tokensMinted?.baseline === 'number') &&
    Boolean(candidate.breakdown && typeof candidate.breakdown.tokensMinted?.postCutover === 'number')
  )
}

export function PlatformStats() {
  const [snapshot, setSnapshot] = useState<PlatformStatsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const mountedRef = useRef(true)

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
      }
    } catch {
      setLoading(true)
    }
  }, [])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    const fetchSnapshot = async () => {
      try {
        const response = await fetch('/api/platform-stats')

        if (!response.ok) throw new Error('Failed to fetch platform stats')
        const payload = (await response.json()) as unknown
        if (!isValidSnapshot(payload)) throw new Error('Invalid platform stats payload')

        if (!mountedRef.current) return

        setRefreshFailed(false)
        setSnapshot(payload)
        setLoading(false)
        try { sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(payload)) } catch { /* Storage is optional. */ }
      } catch {
        if (!mountedRef.current) return
        setRefreshFailed(true)
        setLoading(false)
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
    <div style={{ marginTop: 20 }}>
      <div style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {metrics.map(([key, label, accent]) => {
          const status = snapshot?.coverage[key].status
          const historical = status === 'fallback' || status === 'historical-baseline'
          const coverage = historical ? `Snapshot · ${PLATFORM_ACTIVITY_BASELINE.blockTimestamp.slice(0, 10)}`
            : status === 'bounded' ? 'Partial count' : status === 'live' ? 'Chain count' : undefined
          return <StatChip key={key} label={label} accent={accent} coverage={coverage}
            value={loading || !snapshot ? '—' : formatCount(snapshot[key])} />
        })}
      </div>
      <p className="mt-2 text-center text-xs text-[var(--foreground-dim)]">
        {refreshFailed ? 'Refresh unavailable. ' : ''}
        {snapshot ? `Last response ${new Date(snapshot.fetchedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC`
          : loading ? 'Loading activity…' : 'Activity unavailable'}
      </p>
    </div>
  )
}
