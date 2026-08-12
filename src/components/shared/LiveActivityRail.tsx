'use client'

import Link from 'next/link'
import { Activity, ArrowUpRight, BarChart3, Clock3, MessageSquareText, Search, Wallet } from 'lucide-react'
import { PUBLIC_RELEASE_STATUS } from '@/lib/publicReleaseStatus'

const writesActive = PUBLIC_RELEASE_STATUS.ordinaryWritesEnabled

type RailItem = {
  label: string
  value: string
  detail: string
  href?: string
}

type RailConfig = {
  eyebrow: string
  title: string
  icon: typeof Activity
  accent: string
  items: RailItem[]
}

const rails: Record<'explorer' | 'analytics' | 'portfolio' | 'ledger', RailConfig> = {
  explorer: {
    eyebrow: 'Bounded RPC evidence',
    title: 'Exact lookups plus documented recent samples.',
    icon: Search,
    accent: '#8B74FF',
    items: [
      { label: 'Search', value: 'Address / tx / block', detail: 'Jump directly into verification.', href: '/explorer' },
      { label: 'Recent blocks', value: 'Bounded feed', detail: 'Newest blocks only; not a chain index.' },
      { label: 'Limits', value: 'Disclosed', detail: 'Absence from a sample is not proof of absence.' },
    ],
  },
  analytics: {
    eyebrow: 'Bounded observations',
    title: 'Inspect current RPC data without invented metrics.',
    icon: BarChart3,
    accent: '#2DCE89',
    items: [
      { label: 'Tokens', value: 'Newest sample', detail: 'Not a complete token or holder index.' },
      { label: 'Health', value: 'Latest RPC sample', detail: 'Not uptime or historical liveness.' },
      {
        label: 'DEX',
        value: writesActive ? 'Replacement + recovery' : 'Recovery view',
        detail: writesActive ? 'Source-pinned replacement actions and legacy recovery.' : 'New swaps and liquidity writes are disabled.',
        href: '/pool',
      },
    ],
  },
  portfolio: {
    eyebrow: 'Bounded wallet view',
    title: 'Inspect local and sampled wallet objects.',
    icon: Wallet,
    accent: '#8B74FF',
    items: [
      { label: 'Positions', value: 'Partial sample', detail: 'Not a complete wallet portfolio.' },
      { label: 'Recovery', value: 'Locks + vesting', detail: 'Use only authenticated eligible exits.' },
      {
        label: 'Status',
        value: writesActive ? 'Public-testnet replacement' : 'Writes disabled',
        detail: writesActive ? 'Verify chain 4441, the source-pinned target, and deployment evidence.' : 'Review replacement readiness first.',
        href: '/docs',
      },
    ],
  },
  ledger: {
    eyebrow: 'Historical message sample',
    title: writesActive ? 'Read bounded events or use source-pinned posting.' : 'Read legacy events; paid posting is disabled.',
    icon: MessageSquareText,
    accent: '#F5A623',
    items: [
      { label: 'Messages', value: 'Validated public index', detail: 'Not a complete or perpetual archive.' },
      {
        label: 'Posting',
        value: writesActive ? 'Public-testnet replacement' : 'Disabled',
        detail: writesActive ? 'The immutable fee and test-treasury route is source-pinned.' : 'Legacy fee and treasury routes are retired.',
      },
      { label: 'Attribution', value: 'Wallet address only', detail: 'Content is not endorsed or verified.' },
    ],
  },
}

interface LiveActivityRailProps {
  surface: keyof typeof rails
  className?: string
}

export function LiveActivityRail({ surface, className = '' }: LiveActivityRailProps) {
  const config = rails[surface]
  const Icon = config.icon

  return (
    <section
      className={`analytics-card mb-8 rounded-2xl border border-white/10 bg-[var(--surface-1)] p-4 sm:p-5 ${className}`}
      style={{ boxShadow: '0 18px 60px rgba(0,0,0,0.18)' }}
    >
      <div className="grid gap-5 lg:grid-cols-[320px,1fr] lg:items-center">
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              color: config.accent,
              background: `${config.accent}18`,
              border: `1px solid ${config.accent}44`,
            }}
          >
            <Icon size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: config.accent }}>
              {config.eyebrow}
            </p>
            <h2 className="mt-1 break-words text-lg font-semibold leading-tight tracking-tight text-white">
              {config.title}
            </h2>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {config.items.map((item) => {
            const content = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">{item.label}</span>
                  {item.href ? <ArrowUpRight size={13} style={{ color: config.accent }} /> : <Clock3 size={13} className="text-white/25" />}
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/42">{item.detail}</p>
              </>
            )

            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border border-white/8 bg-white/[0.025] p-4 transition-colors hover:border-white/18 hover:bg-white/[0.045]"
                style={{ textDecoration: 'none' }}
              >
                {content}
              </Link>
            ) : (
              <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
