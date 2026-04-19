'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Radio, RefreshCcw, Signal } from 'lucide-react'
import { MessageCard } from '@/components/ledger/MessageCard'
import { type LedgerMessage } from '@/lib/contracts/ledger'

interface MessageFeedProps {
  connectionMode: 'connecting' | 'websocket' | 'polling'
  error: string | null
  hasMore: boolean
  isLoadingInitial: boolean
  isLoadingMore: boolean
  loadMore: () => Promise<void>
  messages: LedgerMessage[]
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-2xl border p-5"
      style={{ background: 'var(--surface-1)', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-32 rounded-full bg-white/8" />
        <div className="h-4 w-20 rounded-full bg-white/8" />
      </div>
      <div className="space-y-2">
        <div className="h-4 rounded-full bg-white/8" />
        <div className="h-4 rounded-full bg-white/8" />
        <div className="h-4 w-3/4 rounded-full bg-white/8" />
      </div>
    </div>
  )
}

export function MessageFeed({
  connectionMode,
  error,
  hasMore,
  isLoadingInitial,
  isLoadingMore,
  loadMore,
  messages,
}: MessageFeedProps) {
  const [now, setNow] = useState(() => Date.now())
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef(loadMore)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    loadMoreRef.current = loadMore
  }, [loadMore])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isLoadingMore || isLoadingInitial) return
        void loadMoreRef.current()
      },
      { rootMargin: '320px 0px' },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingInitial, isLoadingMore])

  return (
    <section
      className="analytics-card ledger-static-card rounded-[28px] border p-6 sm:p-7"
      style={{
        background: 'linear-gradient(180deg, rgba(14,10,28,0.96) 0%, rgba(10,8,24,0.96) 100%)',
        borderColor: 'rgba(255,255,255,0.08)',

      }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span
            className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em]"
            style={{
              color: '#9ed7ff',
              borderColor: 'rgba(62,178,255,0.2)',
              background: 'rgba(62,178,255,0.08)',
            }}
          >
            <Radio size={12} />
            Live feed
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">Latest marks</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(240,238,245,0.5)' }}>
            New messages are prepended in real time and historical logs load in 50-message pages.
          </p>
        </div>

        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color:
              connectionMode === 'websocket'
                ? '#bbf7d0'
                : connectionMode === 'polling'
                  ? '#fde68a'
                  : '#dbe2ff',
          }}
        >
          {connectionMode === 'websocket' && <Signal size={13} />}
          {connectionMode === 'polling' && <RefreshCcw size={13} />}
          {connectionMode === 'connecting' && <Loader2 size={13} className="animate-spin" />}
          {connectionMode === 'websocket' && 'WebSocket live'}
          {connectionMode === 'polling' && 'Polling fallback'}
          {connectionMode === 'connecting' && 'Connecting'}
        </div>
      </div>

      {error && (
        <div
          className="mb-5 rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'rgba(248,113,113,0.22)',
            background: 'rgba(248,113,113,0.08)',
            color: '#fecaca',
          }}
        >
          {error}
        </div>
      )}

      {connectionMode === 'polling' && !error && (
        <div
          className="mb-5 rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'rgba(251,191,36,0.2)',
            background: 'rgba(251,191,36,0.08)',
            color: '#fde68a',
          }}
        >
          WebSocket updates are offline right now. The feed is refreshing from RPC every 30 seconds.
        </div>
      )}

      <div className="space-y-4">
        {isLoadingInitial && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!isLoadingInitial && messages.length === 0 && (
          <div
            className="rounded-[24px] border px-6 py-16 text-center"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <h3 className="text-lg font-semibold">Be the first to leave a mark...</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: 'rgba(240,238,245,0.48)' }}>
              The ledger is empty for now. The first confirmed post becomes part of LitVM history.
            </p>
          </div>
        )}

        {!isLoadingInitial && messages.map((message) => (
          <MessageCard key={message.id} message={message} now={now} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-6" />

      {hasMore && (
        <div className="mt-2 flex justify-center">
          <button
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
            className="cin-btn cin-btn-ghost min-w-[200px] text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Loading older messages...
              </>
            ) : (
              'Load older messages'
            )}
          </button>
        </div>
      )}
    </section>
  )
}
