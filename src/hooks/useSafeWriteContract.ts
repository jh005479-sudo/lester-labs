'use client'

import { useCallback } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { litvm } from '@/config/chains'
import { useLitvmNetwork } from '@/hooks/useLitvmNetwork'
import { getWrongNetworkMessage } from '@/lib/walletErrors'
import {
  assertRecoveryFrontendWriteAllowed,
  assertStandardFrontendWriteAllowed,
  type FrontendWriteIntent,
  type RecoveryWriteProvenanceClaim,
  type StandardWriteProvenanceClaim,
} from '@/lib/frontendWritePolicy'
import {
  attestRecoveryWriteProvenance,
  attestCurrentDexPairGeneration,
  attestRuntimeRequirements,
  attestStandardWriteProvenance,
} from '@/lib/frontendWriteAttestation'
import { attestLitvmWalletChain } from '@/lib/litvmChainGuard'
import { runGuardedLitvmWalletPrompt } from '@/lib/litvmChainPolicy'

interface EnsureLitvmWriteOptions {
  action?: string
  onError?: (message: string) => void
}

type SafeWriteVariables = FrontendWriteIntent & {
  address: `0x${string}`
  abi: readonly unknown[]
  functionName: string
  gas?: bigint
  chainId?: number
}

export function useSafeWriteContract() {
  const { address: connectedAddress, isConnected } = useAccount()
  const { chainId, isWrongNetwork, isSwitchingChain, switchToLitvm } = useLitvmNetwork()
  const write = useWriteContract()

  const ensureLitvmWrite = useCallback(
    async ({ action = 'submitting a transaction', onError }: EnsureLitvmWriteOptions = {}) => {
      if (!isConnected) {
        onError?.('Connect a wallet before submitting a transaction.')
        return false
      }

      if (isWrongNetwork) {
        const result = await switchToLitvm()
        if (!result.switched) {
          onError?.(result.error ?? getWrongNetworkMessage(action))
          return false
        }
      }

      try {
        await attestLitvmWalletChain({ expectedAddress: connectedAddress })
      } catch (error) {
        onError?.(error instanceof Error ? error.message : getWrongNetworkMessage(action))
        return false
      }

      return true
    },
    [connectedAddress, isConnected, isWrongNetwork, switchToLitvm],
  )

  const writeContractAsync = async (
    variables: SafeWriteVariables,
    provenance?: StandardWriteProvenanceClaim,
    options?: Parameters<typeof write.writeContractAsync>[1],
  ) => {
    if (!connectedAddress) throw new Error('Connect a wallet before submitting a transaction.')
    const decision = assertStandardFrontendWriteAllowed(variables, connectedAddress, provenance)
    return runGuardedLitvmWalletPrompt({
      requestedChainId: variables.chainId,
      attestWalletChain: () => attestLitvmWalletChain({ expectedAddress: connectedAddress }),
      preflight: async () => {
        await attestRuntimeRequirements(decision.runtimeAttestations)
        await attestCurrentDexPairGeneration(decision.dexPairAttestations)
        await attestStandardWriteProvenance(decision.iloProvenance, {
          attestApprovedFactoryRouting: decision.attestApprovedIloFactoryRouting,
          connectedAccount: connectedAddress,
          requiredIloRole: decision.iloProvenanceRole,
        })
      },
      prompt: () => write.writeContractAsync(
        {
          ...variables,
          account: connectedAddress,
          chainId: litvm.id,
        } as never,
        options as never,
      ),
    })
  }

  const writeRecoveryContractAsync = async (
    variables: SafeWriteVariables,
    provenance: RecoveryWriteProvenanceClaim,
    options?: Parameters<typeof write.writeContractAsync>[1],
  ) => {
    const approvedProvenance = assertRecoveryFrontendWriteAllowed(variables, connectedAddress, provenance)
    if (!connectedAddress) throw new Error('Connect a wallet before submitting a recovery transaction.')
    return runGuardedLitvmWalletPrompt({
      requestedChainId: variables.chainId,
      attestWalletChain: () => attestLitvmWalletChain({ expectedAddress: connectedAddress }),
      preflight: () => attestRecoveryWriteProvenance(variables, approvedProvenance, connectedAddress),
      prompt: () => write.writeContractAsync(
        {
          ...variables,
          account: connectedAddress,
          chainId: litvm.id,
        } as never,
        options as never,
      ),
    })
  }

  return {
    data: write.data,
    error: write.error,
    isError: write.isError,
    isIdle: write.isIdle,
    isPending: write.isPending,
    isSuccess: write.isSuccess,
    reset: write.reset,
    status: write.status,
    chainId,
    ensureLitvmWrite,
    isWrongNetwork,
    isSwitchingChain,
    switchToLitvm,
    writeContractAsync,
    writeRecoveryContractAsync,
  }
}
