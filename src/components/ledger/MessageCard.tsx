'use client'

import { ExternalLink } from 'lucide-react'
import { LEDGER_EXPLORER_BASE_URL, type LedgerMessage } from '@/lib/contracts/ledger'

interface MessageCardProps {
  message: LedgerMessage
  now: number
}

function formatRelativeTime(timestamp: number, now: number): string {
  const diff = Math.max(0, Math.floor(now / 1000) - timestamp)

  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86_400)}d ago`
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function MessageCard({ message, now }: MessageCardProps) {
  const postedAt = new Date(message.timestamp * 1000)

  return (
    <article
      className="ledger-message-card rounded-2xl border p-5 transition-all duration-500"
      style={{
        background: message.isHighlighted
          ? 'linear-gradient(180deg, rgba(94,106,210,0.12) 0%, rgba(255,255,255,0.03) 100%)'
          : 'var(--surface-1)',
        borderColor: message.isHighlighted ? 'rgba(94,106,210,0.52)' : 'rgba(255,255,255,0.08)',

      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`${LEDGER_EXPLORER_BASE_URL}/address/${message.sender}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.12em] uppercase transition-colors"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              color: '#cfd4ff',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {truncateAddress(message.sender)}
          </a>
          <span
            className="rounded-full px-3 py-1 text-[11px] font-mono"
            style={{ color: 'rgba(240,238,245,0.58)', background: 'rgba(255,255,255,0.03)' }}
          >
            #{message.index.toString()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'rgba(240,238,245,0.48)' }}>
          <time dateTime={postedAt.toISOString()} title={postedAt.toLocaleString()}>
            {formatRelativeTime(message.timestamp, now)}
          </time>
          {message.txHash && (
            <a
              href={`${LEDGER_EXPLORER_BASE_URL}/tx/${message.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-white"
            >
              View tx
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <p
        className="text-sm leading-7 sm:text-[15px]"
        style={{
          color: '#eef0fb',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'var(--font-geist-mono), monospace',
        }}
      >
        {message.text}
      </p>
    </article>
  )
}
