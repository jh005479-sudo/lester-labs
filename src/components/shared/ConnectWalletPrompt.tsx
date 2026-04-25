'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ArrowUpRight, CheckCircle2, FileSearch, Wallet } from 'lucide-react'
import { walletConnectConfigured } from '@/config/wagmi'

type PreviewItem = {
  label: string
  value: string
  detail: string
}

type NextAction = {
  href: string
  label: string
}

interface ConnectWalletPromptProps {
  title?: string
  body?: string
  previewTitle?: string
  previewItems?: PreviewItem[]
  nextActions?: NextAction[]
}

const defaultPreviewItems: PreviewItem[] = [
  { label: 'Network', value: 'LitVM · 4441', detail: 'All writes settle on the LitVM testnet.' },
  { label: 'Proof', value: 'Explorer-ready', detail: 'Transactions can be verified immediately.' },
  { label: 'Next step', value: 'Wallet scoped', detail: 'The app unlocks your balances and positions.' },
]

export function ConnectWalletPrompt({
  title = 'Connect your wallet',
  body = 'Connect to continue using this utility.',
  previewTitle = 'What unlocks after connection',
  previewItems = defaultPreviewItems,
  nextActions = [
    { href: '/explorer', label: 'Check Explorer' },
    { href: '/docs', label: 'Read docs' },
  ],
}: ConnectWalletPromptProps) {
  return (
    <div className="fade-up grid min-h-[40vh] items-center gap-6 lg:grid-cols-[minmax(0,380px),1fr]">
      <div className="w-full text-center lg:text-left">
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl lg:mx-0"
          style={{ background: 'var(--accent-muted)', border: '1px solid rgba(107,79,255,0.08)' }}
        >
          <Wallet size={24} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
        </div>
        <h3 className="mb-2 text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          {title}
        </h3>
        <p className="mb-8 text-sm leading-6" style={{ color: 'var(--foreground-dim)' }}>
          {body}
        </p>
        <div className="flex justify-center lg:justify-start">
          <ConnectButton />
        </div>
        {!walletConnectConfigured && (
          <p className="mt-4 text-[12px] leading-5" style={{ color: 'var(--foreground-muted)' }}>
            Local wallet connectivity is running without a configured WalletConnect project ID.
            Add `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to enable the full connector set.
          </p>
        )}
        <p className="mt-6 text-[12px]" style={{ color: 'var(--foreground-muted)' }}>
          Need testnet zkLTC? Use the current LitVM faucet or bridge details shared by the Lester Labs team.
        </p>
      </div>

      <div
        className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
        style={{ boxShadow: '0 18px 60px rgba(0,0,0,0.18)' }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--accent)' }}>Preview</p>
            <h4 className="mt-1 text-base font-semibold text-white">{previewTitle}</h4>
          </div>
          <FileSearch size={20} className="text-white/28" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {previewItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-white/8 bg-[#0f0c18] p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">{item.label}</p>
                <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
              </div>
              <p className="text-sm font-semibold text-white">{item.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/42">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {nextActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-white/68 transition-colors hover:border-white/20 hover:text-white"
            >
              {action.label}
              <ArrowUpRight size={12} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
