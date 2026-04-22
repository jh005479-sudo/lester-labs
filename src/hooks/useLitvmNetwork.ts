'use client'

import { useCallback } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { litvm } from '@/config/chains'
import { getWalletErrorMessage } from '@/lib/walletErrors'

export function useLitvmNetwork() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending } = useSwitchChain()

  const isWrongNetwork = isConnected && chainId !== litvm.id

  const switchToLitvm = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: litvm.id })
      return { switched: true as const, error: undefined }
    } catch (error) {
      return {
        switched: false as const,
        error: getWalletErrorMessage(error, 'Network switch was not completed.'),
      }
    }
  }, [switchChainAsync])

  return {
    chainId,
    isWrongNetwork,
    isSwitchingChain: isPending,
    switchToLitvm,
    switchChainAsync,
  }
}
