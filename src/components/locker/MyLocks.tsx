'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Search, Lock, AlertCircle } from 'lucide-react'

// ── Mock data for demo card ────────────────────────────────────────────────

const MOCK_LOCK = {
  lockId: '42',
  lpToken: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
  amount: '1000.00',
  unlockDate: new Date('2026-03-15'),
  withdrawer: '0x1234567890AbCdEf1234567890AbCdEf12345678',
  withdrawn: false,
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ── Demo lock card ────────────────────────────────────────────────────────

function MockLockCard() {
  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
      {/* Demo badge */}
      <div className="flex items-center gap-2 border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-2">
        <AlertCircle size={13} className="text-yellow-400" />
        <span className="text-xs font-medium text-yellow-400">Demo data — not real on-chain state</span>
      </div>

      {/* Lock details */}
      <div className="p-5 grid gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">Lock ID</span>
          <span className="font-mono text-sm text-white font-semibold">#{MOCK_LOCK.lockId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">LP Token</span>
          <span className="font-mono text-sm text-white">{shortenAddress(MOCK_LOCK.lpToken)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">Locked Amount</span>
          <span className="text-sm text-white font-medium">{MOCK_LOCK.amount} LP</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">Unlock Date</span>
          <span className="text-sm text-white">{formatDate(MOCK_LOCK.unlockDate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">Withdrawer</span>
          <span className="font-mono text-sm text-white">{shortenAddress(MOCK_LOCK.withdrawer)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">Status</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Locked
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function MyLocks() {
  const { address: connectedAddress } = useAccount()
  const [lockIdInput, setLockIdInput] = useState('')
  const [showDemo, setShowDemo] = useState(false)

  const handleLookup = () => {
    if (lockIdInput.trim()) {
      setShowDemo(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLookup()
  }

  return (
    <div className="space-y-6">
      {/* Wallet context */}
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-white">Your Wallet</label>
          <input
            type="text"
            readOnly
            value={connectedAddress ?? ''}
            placeholder="Connect wallet to auto-populate"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white/60 placeholder-white/20 focus:outline-none cursor-default"
          />
          <p className="text-xs text-[var(--text-muted)]">
            Lock history indexing coming soon — use Lock ID lookup below for now
          </p>
        </div>

        {/* Placeholder state */}
        <div className="rounded-lg border border-white/5 bg-white/5 px-4 py-5 text-center space-y-1">
          <Lock size={20} className="mx-auto text-white/20 mb-2" />
          <p className="text-sm font-medium text-white/40">Lock lookup coming soon</p>
          <p className="text-xs text-white/25">
            Enter a Lock ID below to view its details
          </p>
        </div>
      </div>

      {/* Lock ID lookup */}
      <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Look Up a Lock</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Enter a Lock ID to view its on-chain details
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Lock ID (e.g. 42)"
            min="0"
            value={lockIdInput}
            onChange={(e) => {
              setLockIdInput(e.target.value)
              setShowDemo(false)
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:border-[var(--accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
          />
          <button
            onClick={handleLookup}
            disabled={!lockIdInput.trim()}
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Search size={15} />
            View Lock
          </button>
        </div>

        {showDemo && <MockLockCard />}
      </div>
    </div>
  )
}

