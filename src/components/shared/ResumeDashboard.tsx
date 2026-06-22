'use client'

import Link from 'next/link'
import { ArrowUpRight, Bookmark, Clock3, Search, WalletCards } from 'lucide-react'
import { useLocalEngagement } from '@/hooks/useLocalEngagement'

function relativeTime(timestamp: number) {
  const delta = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ResumeDashboard() {
  const { hydrated, resumeItems, watchlist, activity, savedSearches } = useLocalEngagement()

  if (!hydrated || (resumeItems.length === 0 && watchlist.length === 0 && activity.length === 0)) {
    return (
      <section className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/70">Wallet home</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Start from a core action</h2>
            <p className="mt-1 text-sm text-white/45">Your saved markets, searches, and recent actions will appear here on this device.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/charts" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">Markets</Link>
            <Link href="/launchpad" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">Presales</Link>
            <Link href="/airdrop" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 no-underline hover:text-white">Airdrop</Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/70">Resume session</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Pick up where you left off</h2>
          </div>
          <Clock3 size={18} className="text-white/35" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {resumeItems.slice(0, 6).map((item) => (
            <Link
              key={`${item.kind}:${item.updatedAt}:${item.label}`}
              href={item.href}
              className="rounded-lg border border-white/8 bg-white/[0.025] p-3 no-underline transition hover:border-white/15 hover:bg-white/[0.045]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-xs capitalize text-white/38">
                    {item.kind === 'activity' ? item.action : item.kind} · {relativeTime(item.updatedAt)}
                  </p>
                </div>
                <ArrowUpRight size={15} className="shrink-0 text-cyan-200/70" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
        <div className="grid gap-3">
          <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bookmark size={15} className="text-violet-200" />
              Watchlist
            </div>
            <p className="mt-1 text-xs text-white/40">{watchlist.length} saved tokens, pools, presales, or wallets</p>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <WalletCards size={15} className="text-emerald-200" />
              My Activity
            </div>
            <p className="mt-1 text-xs text-white/40">{activity.length} recent actions with repeat-action links</p>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Search size={15} className="text-cyan-200" />
              Saved Searches
            </div>
            <p className="mt-1 text-xs text-white/40">{savedSearches.length} reusable explorer, market, pool, and launchpad searches</p>
          </div>
        </div>
      </div>
    </section>
  )
}
