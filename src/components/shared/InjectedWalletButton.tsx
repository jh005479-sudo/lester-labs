'use client'

import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { Loader2, LogOut, Wallet } from 'lucide-react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { litvm } from '@/config/chains'
import { getWalletErrorMessage } from '@/lib/walletErrors'
import { attestLitvmWalletChain } from '@/lib/litvmChainGuard'
import { assertLitvmChainId } from '@/lib/litvmChainPolicy'

interface InjectedWalletButtonProps {
  className?: string
  style?: CSSProperties
  disconnectedLabel?: ReactNode
  compact?: boolean
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Connects only through the source-configured wagmi injected connector.
 *
 * This intentionally has no wallet catalogue, remote connector metadata, or
 * modal dependency. A connected-wallet click is labelled as a disconnect so
 * it never hides an account-changing action behind an ambiguous avatar.
 */
export function InjectedWalletButton({
  className,
  style,
  disconnectedLabel = 'Connect Wallet',
  compact = false,
}: InjectedWalletButtonProps) {
  const { address, isConnected, status } = useAccount()
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect()
  const { disconnectAsync, isPending: isDisconnectPending } = useDisconnect()
  const [localError, setLocalError] = useState<string | null>(null)
  const errorId = useId()

  // Select only the connector declared by src/config/wagmi.ts. Runtime wallet
  // discovery must not silently substitute an unreviewed remote connector.
  const injectedConnector = connectors.find((connector) => connector.id === 'injected')
  const isBusy = status === 'connecting' || isConnectPending || isDisconnectPending

  async function handleWalletAction() {
    setLocalError(null)

    try {
      if (isConnected) {
        await disconnectAsync()
        return
      }

      if (!injectedConnector) {
        setLocalError('No configured injected wallet connector is available. Enable a trusted browser wallet extension and reload.')
        return
      }

      const connection = await connectAsync({ connector: injectedConnector, chainId: litvm.id })
      assertLitvmChainId(connection.chainId)
      await attestLitvmWalletChain({ expectedAddress: connection.accounts[0] })
    } catch (error) {
      // Some connectors expose accounts before rejecting the required chain.
      // Clear partial connection state so an unknown/wrong chain fails closed.
      await disconnectAsync().catch(() => undefined)
      const message = getWalletErrorMessage(error, 'The injected wallet connection could not be completed.')
      setLocalError(
        /provider not found|connector not found/i.test(message)
          ? 'No injected wallet was detected. Enable a trusted browser wallet extension and reload.'
          : message,
      )
    }
  }

  const connectedLabel = address ? `Disconnect ${shortAddress(address)}` : 'Disconnect wallet'
  const ariaLabel = isConnected ? connectedLabel : 'Connect a locally installed wallet extension'

  return (
    <span className={`relative inline-flex flex-col items-center ${compact ? 'max-w-[190px]' : ''}`}>
      <button
        type="button"
        onClick={handleWalletAction}
        disabled={isBusy}
        className={className ?? 'cin-btn min-h-11'}
        aria-label={ariaLabel}
        aria-describedby={localError ? errorId : undefined}
        style={{
          ...(isConnected
            ? {
                background: 'rgba(74, 49, 220, 0.22)',
                border: '1px solid rgba(167, 137, 255, 0.46)',
                boxShadow: '0 8px 22px rgba(45, 26, 120, 0.35)',
              }
            : {
                background: 'linear-gradient(135deg, #6B4FFF 0%, #5B3FF0 100%)',
                border: 'none',
                boxShadow: '0 8px 24px rgba(75, 49, 220, 0.35)',
              }),
          color: '#f6f4ff',
          ...style,
        }}
      >
        {isBusy ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            <span>{isConnected ? 'Disconnecting…' : 'Connecting…'}</span>
          </>
        ) : isConnected ? (
          <>
            <Wallet size={15} aria-hidden="true" />
            <span className={compact ? 'hidden sm:inline' : undefined}>{connectedLabel}</span>
            <LogOut size={14} aria-hidden="true" />
          </>
        ) : (
          disconnectedLabel
        )}
      </button>

      {localError && (
        <span
          id={errorId}
          role="status"
          className={compact
            ? 'absolute right-0 top-[calc(100%+8px)] z-[90] w-[min(320px,calc(100vw-2rem))] rounded-xl border border-red-400/25 bg-[#140c18] px-3 py-2 text-left text-[11px] leading-4 text-red-200 shadow-2xl'
            : 'mt-2 max-w-sm text-center text-xs leading-5 text-red-300'}
        >
          {localError}
        </span>
      )}
    </span>
  )
}
