'use client'

import Link from 'next/link'
import { Activity, ArrowUpRight, BarChart3, Clock3, MessageSquareText, Search, Wallet } from 'lucide-react'

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
    eyebrow: 'Live trust layer',
    title: 'Every action should resolve to proof.',
    icon: Search,
    accent: '#8B74FF',
    items: [
      { label: 'Search', value: 'Address / tx / block', detail: 'Jump directly into verification.', href: '/explorer' },
      { label: 'Recent blocks', value: 'Auto-refresh', detail: 'Fresh chain context every session.' },
      { label: 'Share', value: 'Network stats', detail: 'Turn data into social proof.' },
    ],
  },
  analytics: {
    eyebrow: 'Daily market surface',
    title: 'Make LitVM feel alive between launches.',
    icon: BarChart3,
    accent: '#2DCE89',
    items: [
      { label: 'Trending', value: 'Token watch', detail: 'Spot repeat builder activity.' },
      { label: 'Health', value: 'Network panels', detail: 'See whether the market is ready.' },
      { label: 'DEX', value: 'Liquidity context', detail: 'Connect trade activity to launches.', href: '/pool' },
    ],
  },
  portfolio: {
    eyebrow: 'Wallet command center',
    title: 'Close the loop after every transaction.',
    icon: Wallet,
    accent: '#8B74FF',
    items: [
      { label: 'Positions', value: 'Tokens + presales', detail: 'Bring all Lester objects together.' },
      { label: 'Protection', value: 'Locks + vesting', detail: 'Show the trust posture of a wallet.' },
      { label: 'Next step', value: 'Act from context', detail: 'Route builders back into the suite.', href: '/launch' },
    ],
  },
  ledger: {
    eyebrow: 'Social activity layer',
    title: 'Give every launch a public heartbeat.',
    icon: MessageSquareText,
    accent: '#F5A623',
    items: [
      { label: 'Messages', value: 'Immutable feed', detail: 'Updates remain discoverable on-chain.' },
      { label: 'Fee gate', value: 'Spam resistant', detail: 'Make posts meaningful by default.' },
      { label: 'Community', value: 'Post-launch habit', detail: 'Announcements, proofs, milestones.' },
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
            <h2 className="mt-1 text-lg font-semibold leading-tight tracking-tight text-white">
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
