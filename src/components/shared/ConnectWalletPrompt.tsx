'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet } from 'lucide-react'
import { walletConnectConfigured } from '@/config/wagmi'

export function ConnectWalletPrompt() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center fade-up">
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'var(--accent-muted)', border: '1px solid rgba(107,79,255,0.08)' }}
        >
          <Wallet size={24} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
        </div>
        <h3 className="mb-2 text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Connect your wallet
        </h3>
        <p className="mb-8 text-sm" style={{ color: 'var(--foreground-dim)' }}>
          Connect to continue using this utility.
        </p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
        {!walletConnectConfigured && (
          <p className="mt-4 text-[12px]" style={{ color: 'var(--foreground-muted)' }}>
            Local wallet connectivity is running without a configured WalletConnect project ID.
            Add `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to enable the full connector set.
          </p>
        )}
        <p className="mt-6 text-[12px]" style={{ color: 'var(--foreground-muted)' }}>
          Need testnet zkLTC? Use the current LitVM faucet or bridge details shared by the Lester Labs team.
        </p>
      </div>
    </div>
  )
}
