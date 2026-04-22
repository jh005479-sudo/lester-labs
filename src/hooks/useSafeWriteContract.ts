'use client'

import { useCallback } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { litvm } from '@/config/chains'
import { useLitvmNetwork } from '@/hooks/useLitvmNetwork'
import { getWrongNetworkMessage } from '@/lib/walletErrors'

interface EnsureLitvmWriteOptions {
  action?: string
  onError?: (message: string) => void
}

export function useSafeWriteContract() {
  const { isConnected } = useAccount()
  const { chainId, isWrongNetwork, isSwitchingChain, switchToLitvm } = useLitvmNetwork()
  const write = useWriteContract()

  const ensureLitvmWrite = useCallback(
    async ({ action = 'submitting a transaction', onError }: EnsureLitvmWriteOptions = {}) => {
      if (!isConnected) {
        onError?.('Connect a wallet before submitting a transaction.')
        return false
      }

      if (!isWrongNetwork) return true

      const result = await switchToLitvm()
      if (!result.switched) {
        onError?.(result.error ?? getWrongNetworkMessage(action))
        return false
      }

      return true
    },
    [isConnected, isWrongNetwork, switchToLitvm],
  )

  const writeContract: typeof write.writeContract = useCallback(
    (variables, options) =>
      write.writeContract(
        {
          ...variables,
          chainId: litvm.id,
        } as never,
        options as never,
      ),
    [write],
  )

  const writeContractAsync: typeof write.writeContractAsync = useCallback(
    (variables, options) =>
      write.writeContractAsync(
        {
          ...variables,
          chainId: litvm.id,
        } as never,
        options as never,
      ),
    [write],
  )

  return {
    ...write,
    chainId,
    ensureLitvmWrite,
    isWrongNetwork,
    isSwitchingChain,
    switchToLitvm,
    writeContract,
    writeContractAsync,
  }
}
