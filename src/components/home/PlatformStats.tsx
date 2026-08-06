'use client'

import { useEffect, useRef, useState } from 'react'
import { PLATFORM_ACTIVITY_BASELINE } from '@/config/platformActivity'
import type { PlatformStatsSnapshot } from '@/lib/platformStats'
import {
  getPlatformStatsDisclosure,
  getPlatformStatsSessionCacheKey,
  matchesCompiledPlatformActivityBaseline,
} from '@/lib/platformStatsDisclosure'

const POLL_INTERVAL_MS = 60_000
const SESSION_CACHE_KEY = getPlatformStatsSessionCacheKey(PLATFORM_ACTIVITY_BASELINE)

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
    typeof candidate.fetchedAt === 'string' &&
    matchesCompiledPlatformActivityBaseline(candidate.baseline, PLATFORM_ACTIVITY_BASELINE) &&
    Boolean(candidate.breakdown && typeof candidate.breakdown.tokensMinted?.baseline === 'number') &&
    Boolean(candidate.breakdown && typeof candidate.breakdown.tokensMinted?.postCutover === 'number')
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
        const response = await fetch('/api/platform-stats')

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

  const breakdownRows = snapshot
    ? [
        { label: 'Token contracts created', value: snapshot.breakdown.tokensMinted },
        { label: 'Airdrop recipient entries', value: snapshot.breakdown.walletsAirdropped },
        { label: 'Pre-sales created', value: snapshot.breakdown.presalesCreated },
        { label: 'Swaps completed', value: snapshot.breakdown.swapsCompleted },
        { label: 'On-chain messages', value: snapshot.breakdown.onChainMessages },
      ]
    : []
  const disclosure = getPlatformStatsDisclosure(snapshot?.baseline.snapshotKind)

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        <StatChip
          label="Token Contracts Created"
          value={loading || snapshot === null ? '—' : formatCount(snapshot.tokensMinted)}
          accent="#6B4FFF"
        />
        <StatChip
          label="Airdrop Entries"
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

      <div style={{
        maxWidth: 900,
        margin: '12px auto 0',
        padding: '10px 12px',
        border: '1px solid rgba(245,166,35,0.24)',
        borderRadius: 10,
        background: 'rgba(245,166,35,0.055)',
        color: 'rgba(255,255,255,0.68)',
        fontSize: 11,
        lineHeight: 1.55,
        textAlign: 'center',
      }}>
        <strong style={{ color: 'rgba(255,255,255,0.86)' }}>
          {disclosure.headline}
        </strong>{' '}{disclosure.summary}
      </div>

      {snapshot && (
        <div style={{
          maxWidth: 900,
          margin: '8px auto 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 6,
        }}>
          {([
            ['Token contracts', snapshot.coverage.tokensMinted],
            ['Airdrop entries', snapshot.coverage.walletsAirdropped],
            ['Pre-sales', snapshot.coverage.presalesCreated],
            ['Router swap actions', snapshot.coverage.swapsCompleted],
            ['On-chain messages', snapshot.coverage.onChainMessages],
          ] as const).map(([label, coverage]) => (
            <div key={label} style={{
              padding: '7px 9px',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              color: 'rgba(255,255,255,0.48)',
              fontSize: 10,
              lineHeight: 1.45,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{label}</span>
              {' · '}{coverage.status}: {coverage.note}
            </div>
          ))}
        </div>
      )}

      {snapshot && (
        <details style={{
          maxWidth: 760,
          margin: '12px auto 0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.025)',
          color: 'rgba(255,255,255,0.52)',
          fontSize: 11,
          lineHeight: 1.6,
        }}>
          <summary style={{ cursor: 'pointer', padding: '9px 12px', textAlign: 'center' }}>
            Provenance and baseline breakdown · LitVM block {formatCount(snapshot.baseline.throughBlock)}
          </summary>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px' }}>
            <p style={{ margin: 0 }}>
              Production API values observed at {snapshot.baseline.provenance.productionSnapshotObservedAt}; contemporaneous
              LitVM block <code>{snapshot.baseline.blockHash}</code> at {snapshot.baseline.blockTimestamp}.{' '}
              {snapshot.baseline.provenance.disclaimer}
            </p>
            <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
              {breakdownRows.map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span>{row.label}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {formatCount(row.value.baseline)} baseline + {formatCount(row.value.postCutover)} post-cutover = {formatCount(row.value.total)}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ margin: '8px 0 0' }}>
              These are historical on-chain action/address counters, not unique users. Airdrop addresses may repeat,
              and every metric may include automated, bot, or spam-heavy activity.
            </p>
            <p style={{ margin: '6px 0 0' }}>
              {disclosure.detail}
            </p>
          </div>
        </details>
      )}
    </div>
  )
}
