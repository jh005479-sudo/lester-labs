'use client'

import { useState, useCallback } from 'react'
import { CheckCircle2, Copy, ExternalLink, Lock, Share2 } from 'lucide-react'

export interface LockCertificateData {
  lockId: string
  lpToken: string
  amount: string
  unlockDate: Date
  withdrawer: string
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

interface LockCertificateProps {
  data: LockCertificateData
  onReset: () => void
}

export function LockCertificate({ data, onReset }: LockCertificateProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = `lester-labs.com/locker/verify?id=${data.lockId}`

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareUrl])

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center space-y-2">
        <div className="flex justify-center"><Lock size={40} className="text-[var(--accent)]" /></div>
        <h2 className="text-2xl font-bold text-white">Liquidity Locked!</h2>
        <p className="text-white/60">
          Your LP tokens are now secured on-chain.{' '}
          <span className="text-[var(--accent)] font-medium">Lock ID #{data.lockId}</span>
        </p>
      </div>

      {/* Certificate card */}
      <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--surface-1)] overflow-hidden">
        {/* Header bar */}
        <div className="bg-[var(--accent)]/10 border-b border-[var(--accent)]/20 px-5 py-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--accent)]">Lock Certificate</span>
          <span className="ml-auto text-xs text-white/40 font-mono">#{data.lockId}</span>
        </div>

        {/* Details grid */}
        <div className="p-5 grid gap-4">
          <CertRow label="LP Token">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-white">{shortenAddress(data.lpToken)}</span>
              <a
                href={`https://sepolia.arbiscan.io/address/${data.lpToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-[var(--accent)] transition-colors"
                title="View on explorer"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </CertRow>

          <CertRow label="Amount Locked">
            <span className="font-semibold text-white">{data.amount} LP</span>
          </CertRow>

          <CertRow label="Unlock Date">
            <span className="text-white">{formatDate(data.unlockDate)}</span>
          </CertRow>

          <CertRow label="Withdrawer">
            <span className="font-mono text-sm text-white">{shortenAddress(data.withdrawer)}</span>
          </CertRow>
        </div>
      </div>

      {/* Shareable URL */}
      <div className="rounded-xl border border-white/10 bg-[var(--surface-1)] p-4 space-y-3">
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
          Share Lock Certificate
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <span className="flex-1 truncate font-mono text-sm text-white/70">{shareUrl}</span>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 rounded p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            title="Copy link"
          >
            {copied ? (
              <CheckCircle2 size={15} className="text-green-400" />
            ) : (
              <Copy size={15} />
            )}
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Share2 size={15} />
          {copied ? 'Link Copied!' : 'Share Lock Certificate →'}
        </button>
        <p className="text-xs text-white/30 text-center">
          Anyone can verify this lock without connecting a wallet
        </p>
      </div>

      {/* New lock */}
      <div className="text-center">
        <button
          onClick={onReset}
          className="text-sm text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
        >
          Create another lock
        </button>
      </div>
    </div>
  )
}

function CertRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--text-muted)] shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  )
}
