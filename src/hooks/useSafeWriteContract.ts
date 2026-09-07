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
import { createPublicClient, http, encodeFunctionData, keccak256, type Abi } from 'viem'
import { saveTrackedTransaction, parseTransactionHistory, TRANSACTION_STORAGE_KEY, hasUnresolvedDuplicate, type TrackedTransaction } from '@/lib/transactionHistory'
import { validAddress } from '@/lib/projectJourney'
import { recordUsage, transactionSurface } from '@/lib/usageMetrics'

const simulationClient = createPublicClient({ chain: litvm, transport: http(litvm.rpcUrls.default.http[0], { timeout: 8_000, retryCount: 0 }) })
const activePrompts = new Set<string>()

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

  function beginTransaction(variables: SafeWriteVariables): TrackedTransaction {
    if (variables.args !== undefined && !Array.isArray(variables.args)) throw new Error('Transaction arguments could not be checked.')
    if (variables.value !== undefined && typeof variables.value !== 'bigint') throw new Error('Transaction value could not be checked.')
    const firstArgument = Array.isArray(variables.args) ? variables.args[0] : undefined
    const entry: TrackedTransaction = {
      id: crypto.randomUUID(), chainId: 4441, account: connectedAddress!, target: variables.address,
      action: variables.functionName, asset: variables.functionName === 'approve' ? variables.address : validAddress(firstArgument) ? firstArgument : undefined,
      inputHash: keccak256(encodeFunctionData({ abi: variables.abi as Abi, functionName: variables.functionName, args: variables.args })),
      value: (variables.value ?? 0n).toString(),
      stage: 'checking', createdAt: Date.now(), updatedAt: Date.now(),
    }
    let previous: TrackedTransaction[] = []
    try { previous = parseTransactionHistory(localStorage.getItem(TRANSACTION_STORAGE_KEY)) } catch { /* Storage can be unavailable. */ }
    if (hasUnresolvedDuplicate(previous, entry)) throw new Error('This transaction is still unresolved. Check Activity before sending it again.')
    const key = `${entry.account}:${entry.target}:${entry.inputHash}:${entry.value}`.toLowerCase()
    if (activePrompts.has(key)) throw new Error('This transaction is already being checked. Please wait.')
    activePrompts.add(key)
    saveTrackedTransaction(entry)
    return entry
  }

  async function simulate(variables: SafeWriteVariables, entry: TrackedTransaction) {
    if (variables.args !== undefined && !Array.isArray(variables.args)) throw new Error('Transaction arguments could not be checked.')
    if (variables.value !== undefined && typeof variables.value !== 'bigint') throw new Error('Transaction value could not be checked.')
    await simulationClient.simulateContract({
      address: variables.address, abi: variables.abi as Abi, functionName: variables.functionName,
      args: variables.args, value: variables.value, account: connectedAddress,
    })
    entry.stage = 'wallet'
    entry.updatedAt = Date.now()
    saveTrackedTransaction(entry)
  }

  async function trackPrompt(entry: TrackedTransaction, submit: () => Promise<`0x${string}`>) {
    try {
      const hash = await submit()
      saveTrackedTransaction({ ...entry, hash, stage: 'submitted', updatedAt: Date.now() })
      if (entry.action !== 'approve') recordUsage('transaction_submitted', undefined, transactionSurface(entry.action))
      return hash
    } catch (error) {
      const rejected = /user rejected|user denied|4001/i.test(error instanceof Error ? error.message : '')
      saveTrackedTransaction({ ...entry, stage: rejected ? 'cancelled' : entry.stage === 'wallet' ? 'unknown' : 'failed', updatedAt: Date.now() })
      if (entry.action !== 'approve' && (rejected || entry.stage !== 'wallet')) recordUsage('transaction_failed', undefined, transactionSurface(entry.action))
      throw error
    } finally {
      activePrompts.delete(`${entry.account}:${entry.target}:${entry.inputHash}:${entry.value}`.toLowerCase())
    }
  }

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
    const entry = beginTransaction(variables)
    return trackPrompt(entry, () => runGuardedLitvmWalletPrompt({
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
        await simulate(variables, entry)
      },
      prompt: () => write.writeContractAsync(
        {
          ...variables,
          account: connectedAddress,
          chainId: litvm.id,
        } as never,
        options as never,
      ),
    }))
  }

  const writeRecoveryContractAsync = async (
    variables: SafeWriteVariables,
    provenance: RecoveryWriteProvenanceClaim,
    options?: Parameters<typeof write.writeContractAsync>[1],
  ) => {
    const approvedProvenance = assertRecoveryFrontendWriteAllowed(variables, connectedAddress, provenance)
    if (!connectedAddress) throw new Error('Connect a wallet before submitting a recovery transaction.')
    const entry = beginTransaction(variables)
    return trackPrompt(entry, () => runGuardedLitvmWalletPrompt({
      requestedChainId: variables.chainId,
      attestWalletChain: () => attestLitvmWalletChain({ expectedAddress: connectedAddress }),
      preflight: async () => {
        await attestRecoveryWriteProvenance(variables, approvedProvenance, connectedAddress)
        await simulate(variables, entry)
      },
      prompt: () => write.writeContractAsync(
        {
          ...variables,
          account: connectedAddress,
          chainId: litvm.id,
        } as never,
        options as never,
      ),
    }))
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
