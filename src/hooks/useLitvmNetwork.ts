'use client'

import { useCallback } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { litvm } from '@/config/chains'
import { getWalletErrorMessage } from '@/lib/walletErrors'
import { attestLitvmWalletChain } from '@/lib/litvmChainGuard'

export function useLitvmNetwork() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending } = useSwitchChain()

  const isWrongNetwork = isConnected && chainId !== litvm.id

  const switchToLitvm = useCallback(async () => {
    if (!isConnected || !address) {
      return {
        switched: false as const,
        error: 'Connect a wallet before switching to LitVM LiteForge.',
      }
    }

    try {
      const switchedChain = await switchChainAsync({ chainId: litvm.id })
      if (switchedChain.id !== litvm.id) {
        throw new Error(`Wallet returned an unexpected chain after switching. Expected Chain ID ${litvm.id}.`)
      }
      await attestLitvmWalletChain({ expectedAddress: address })
      return { switched: true as const, error: undefined }
    } catch (error) {
      return {
        switched: false as const,
        error: getWalletErrorMessage(error, 'Network switch was not completed.'),
      }
    }
  }, [address, isConnected, switchChainAsync])

  return {
    chainId,
    isWrongNetwork,
    isSwitchingChain: isPending,
    switchToLitvm,
  }
}
