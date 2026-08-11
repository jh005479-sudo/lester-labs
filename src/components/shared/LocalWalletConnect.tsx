'use client'

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { litvm } from '@/config/chains'

type WalletAccount = {
  address: `0x${string}`
  displayName: string
}

type WalletChain = {
  id: number
  name: string
  unsupported: boolean
  hasIcon: false
  iconUrl?: undefined
}

type CustomRenderState = {
  account?: WalletAccount
  chain?: WalletChain
  mounted: boolean
  openAccountModal: () => void
  openChainModal: () => void
  openConnectModal: () => void
}

type CustomProps = {
  children: (state: CustomRenderState) => ReactNode
}

const subscribeToHydration = () => () => undefined

function useLocalWallet() {
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const { address, chain, isConnected } = useAccount()
  const { connectors, connectAsync, isPending: isConnecting } = useConnect()
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()
  const [error, setError] = useState<string | null>(null)

  const injectedConnector = connectors.find((connector) => connector.id === 'injected')
  const busy = isConnecting || isDisconnecting || isSwitching

  async function connect() {
    setError(null)
    if (!injectedConnector) {
      setError('No locally installed wallet extension was detected.')
      return
    }

    try {
      const connection = await connectAsync({ connector: injectedConnector, chainId: litvm.id })
      if (connection.chainId !== litvm.id) {
        await disconnectAsync()
        throw new Error(`Wallet remained on chain ${connection.chainId}; expected LitVM ${litvm.id}.`)
      }
    } catch (cause) {
      await disconnectAsync().catch(() => undefined)
      setError(cause instanceof Error ? cause.message : 'Wallet connection failed.')
    }
  }

  async function switchToLitvm() {
    setError(null)
    try {
      const switched = await switchChainAsync({ chainId: litvm.id })
      if (switched.id !== litvm.id) {
        throw new Error(`Wallet remained on chain ${switched.id}; expected LitVM ${litvm.id}.`)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Network switch failed.')
    }
  }

  async function disconnect() {
    setError(null)
    await disconnectAsync()
  }

  return {
    account: isConnected && address
      ? { address, displayName: `${address.slice(0, 6)}…${address.slice(-4)}` }
      : undefined,
    busy,
    chain: isConnected && chain
      ? {
          id: chain.id,
          name: chain.name,
          unsupported: chain.id !== litvm.id,
          hasIcon: false as const,
        }
      : undefined,
    connect,
    disconnect,
    error,
    mounted,
    switchToLitvm,
  }
}

function LocalConnectButton() {
  const wallet = useLocalWallet()

  return (
    <span className="inline-flex flex-col items-center">
      <button
        type="button"
        className="cin-btn min-h-11"
        disabled={!wallet.mounted || wallet.busy}
        onClick={() => void (wallet.account ? wallet.disconnect() : wallet.connect())}
      >
        {wallet.busy
          ? 'Wallet request pending…'
          : wallet.account
            ? `Disconnect ${wallet.account.displayName}`
            : 'Connect Wallet'}
      </button>
      {wallet.error && <span className="mt-2 max-w-sm text-xs text-red-300" role="status">{wallet.error}</span>}
    </span>
  )
}

function LocalConnectCustom({ children }: CustomProps) {
  const wallet = useLocalWallet()

  return children({
    account: wallet.account,
    chain: wallet.chain,
    mounted: wallet.mounted,
    openAccountModal: () => void wallet.disconnect(),
    openChainModal: () => void wallet.switchToLitvm(),
    openConnectModal: () => void wallet.connect(),
  })
}

export const ConnectButton = Object.assign(LocalConnectButton, {
  Custom: LocalConnectCustom,
})
