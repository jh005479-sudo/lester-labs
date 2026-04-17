'use client'

import type { ReactNode } from 'react'
import { formatEther } from 'viem'
import { Coins, Landmark, ScrollText } from 'lucide-react'
import { estimateLedgerTreasuryTotal } from '@/lib/contracts/ledger'

interface LedgerStatsProps {
  messageCount?: bigint
  minFee?: bigint
  userPostCount: number | null
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: `rgba(${accent},0.12)`, color: `rgb(${accent})` }}
        >
          {icon}
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(240,238,245,0.4)' }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold tracking-tight sm:text-[28px]" style={{ fontFamily: 'var(--font-heading)' }}>
        {value}
      </div>
    </div>
  )
}

export function LedgerStats({ messageCount, minFee, userPostCount }: LedgerStatsProps) {
  const totalMessages = messageCount ?? 0n
  const treasuryEstimate = estimateLedgerTreasuryTotal(totalMessages, minFee)

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={<ScrollText size={20} />}
        label="Total messages"
        value={totalMessages.toLocaleString()}
        accent="94,106,210"
      />
      <StatCard
        icon={<Landmark size={20} />}
        label="Estimated treasury"
        value={`${formatEther(treasuryEstimate)} zkLTC`}
        accent="74,222,128"
      />
      <StatCard
        icon={<Coins size={20} />}
        label="Your posts"
        value={userPostCount === null ? '—' : userPostCount.toLocaleString()}
        accent="244,114,182"
      />
    </section>
  )
}
