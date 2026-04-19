/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import type { UseReadContractParameters, UseReadContractsParameters } from 'wagmi'

export type RpcCallError = 'rate_limited' | 'network' | 'generic'

export interface RpcCallState {
  error: RpcCallError | null
  isRetrying: boolean
}

function classifyRpcError(error: unknown): RpcCallError {
  if (!error) return 'generic'
  const rpcError = error as { code?: number; message?: string }
  if (rpcError?.code === 429) return 'rate_limited'
  const message =
    rpcError?.message ?? (error instanceof Error ? error.message : String(error))
  if (/429|rate\s*limit|too\s*many\s*requests/i.test(message)) return 'rate_limited'
  if (/network|fetch|conn|econn|offline|aborted|timeout/i.test(message)) return 'network'
  return 'generic'
}

// ── useReadContract wrapper ──────────────────────────────────────────────────

export function useRpcCallReadContract(
  parameters: UseReadContractParameters
): ReturnType<typeof useReadContract> & { rpcState: RpcCallState } {
  const [rpcState, setRpcState] = useState<RpcCallState>({
    error: null,
    isRetrying: false,
  })

  const result = useReadContract({
    address: parameters.address,
    abi: parameters.abi,
    functionName: parameters.functionName,
    args: parameters.args,
    account: parameters.account,
    blockNumber: parameters.blockNumber,
    blockTag: parameters.blockTag,
    // @ts-ignore – wagmi v2 passes `query` straight to react-query's useQuery,
    // so onError/onSuccess are available at runtime even if the complex types don't surface them.
    query: {
      enabled: (parameters.query as any)?.enabled,
      retry: 1,
      retryDelay: () => 2000,
      onError(error: Error) {
        setRpcState({ error: classifyRpcError(error), isRetrying: false })
        ;(parameters.query as any)?.onError?.(error)
      },
      onSuccess(data: any) {
        setRpcState({ error: null, isRetrying: false })
        ;(parameters.query as any)?.onSuccess?.(data)
      },
    } as any,
  })

  return { ...result, rpcState }
}

// ── useReadContracts wrapper ─────────────────────────────────────────────────

export function useRpcCallReadContracts(
  parameters: UseReadContractsParameters
): ReturnType<typeof useReadContracts> & { rpcState: RpcCallState } {
  const [rpcState, setRpcState] = useState<RpcCallState>({
    error: null,
    isRetrying: false,
  })

  const result = useReadContracts({
    contracts: parameters.contracts,
    account: parameters.account,
    // @ts-ignore – same reason as above
    query: {
      enabled: (parameters.query as any)?.enabled,
      retry: 1,
      retryDelay: () => 2000,
      onError(error: Error) {
        setRpcState({ error: classifyRpcError(error), isRetrying: false })
        ;(parameters.query as any)?.onError?.(error)
      },
      onSuccess(data: any) {
        setRpcState({ error: null, isRetrying: false })
        ;(parameters.query as any)?.onSuccess?.(data)
      },
    } as any,
  })

  return { ...result, rpcState }
}
