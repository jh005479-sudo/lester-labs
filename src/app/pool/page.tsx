'use client'

import { readContract } from '@wagmi/core'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BarChart3, BookmarkCheck, BookmarkPlus, Droplets, ExternalLink, Layers3, Loader2, Minus, Plus, Wallet, X } from 'lucide-react'
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { formatUnits, parseUnits } from 'viem'
import { ToolHero } from '@/components/shared/ToolHero'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { ERC20_ABI, UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI, UNISWAP_V2_ROUTER_ABI } from '@/config/abis'
import {
  LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS,
  isValidContractAddress,
} from '@/config/contracts'
import { useLocalEngagement } from '@/hooks/useLocalEngagement'
import { useSafeWriteContract } from '@/hooks/useSafeWriteContract'
import { filterPools, getRecentPoolIndices } from '@/lib/poolDisplay'
import { litvm } from '@/config/chains'
import {
  attestFreshDexRecoveryRuntime,
  getSourcePinnedDexRecoverySource,
  isCanonicalDexDeployment,
  readFreshCanonicalPair,
  type DexRecoverySource,
} from '@/lib/dexTransactionReads'
import { computeRemoveLiquidityMinimums, sameAddress, validateSlippageBps } from '@/lib/dexTransactionSafety'
import { wagmiConfig } from '@/config/wagmi'

const ACCENT = '#E44FB5'
const PAGE_SIZE = 10
const MAX_DISPLAY = 250

const CURRENT_DEX_RECOVERY_SOURCE = getSourcePinnedDexRecoverySource('current')
const DEX_RECOVERY_SOURCES: readonly DexRecoverySource[] = Object.freeze([
  CURRENT_DEX_RECOVERY_SOURCE,
  ...LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS
    .filter((deployment) => !(
      sameAddress(deployment.factory, CURRENT_DEX_RECOVERY_SOURCE.factory) &&
      sameAddress(deployment.router, CURRENT_DEX_RECOVERY_SOURCE.router) &&
      sameAddress(deployment.wrappedNative, CURRENT_DEX_RECOVERY_SOURCE.wrappedNative)
    ))
    .map((deployment) => getSourcePinnedDexRecoverySource(deployment.id)),
])

function ZERO_ADDRESS(): string {
  return '0x0000000000000000000000000000000000000000'
}

function formatAmount(value: bigint, decimals: number) {
  const raw = formatUnits(value, decimals)
  const [whole, fraction = ''] = raw.split('.')
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (!fraction) return formatted
  return `${formatted}.${fraction.slice(0, 6).replace(/0+$/, '') || '0'}`
}

function formatInputAmount(value: bigint, decimals: number) {
  const raw = formatUnits(value, decimals)
  const [whole, fraction = ''] = raw.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%'
  if (value < 0.01) return '<0.01%'
  return `${value.toFixed(2)}%`
}

type TokenMeta = {
  name: string
  symbol: string
  decimals: number
}

// ── Pool card skeleton ───────────────────────────────────────────────────────
function PoolCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="h-7 w-40 rounded-full bg-white/5" />
        <div className="flex gap-2">
          <div className="h-7 w-28 rounded-full bg-white/5" />
          <div className="h-7 w-24 rounded-full bg-white/5" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl border border-white/8 bg-[#120f1d]" />
        ))}
      </div>
    </div>
  )
}

// ── Pool card for unauthenticated view ──────────────────────────────────────
function PoolCard({ pairAddress, token0Meta, token1Meta, token0Address, token1Address, r0, r1, totalSupply, watched, onToggleWatch }: {
  pairAddress: `0x${string}`
  token0Meta: TokenMeta
  token1Meta: TokenMeta
  token0Address: `0x${string}`
  token1Address: `0x${string}`
  r0: bigint
  r1: bigint
  totalSupply: bigint
  watched?: boolean
  onToggleWatch?: () => void
}) {
  return (
    <div className="analytics-card rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-white">
            {token0Meta.symbol} / {token1Meta.symbol}
          </div>
          <p className="mt-2 text-sm text-white/45">
            {token0Meta.name} + {token1Meta.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onToggleWatch && (
            <button
              type="button"
              onClick={onToggleWatch}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                watched
                  ? 'border-violet-300/30 bg-violet-300/12 text-violet-100'
                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
              }`}
            >
              {watched ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />}
              {watched ? 'Watching' : 'Watch'}
            </button>
          )}
          <Link
            href="/security"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
          >
            <Plus size={12} />
            New liquidity disabled
          </Link>
          <Link
            href={`/charts?pair=${pairAddress}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-200/35 hover:text-white"
          >
            <BarChart3 size={12} />
            Chart
          </Link>
          <a
            href={`https://liteforge.explorer.caldera.xyz/address/${pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
          >
            <ExternalLink size={12} />
            Explorer
          </a>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="analytics-card rounded-2xl border border-white/8 bg-[#120f1d] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">Reserve 0</p>
          <p className="mt-1.5 text-sm font-semibold text-white">
            {formatAmount(r0, token0Meta.decimals)} {token0Meta.symbol}
          </p>
        </div>
        <div className="analytics-card rounded-2xl border border-white/8 bg-[#120f1d] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">Reserve 1</p>
          <p className="mt-1.5 text-sm font-semibold text-white">
            {formatAmount(r1, token1Meta.decimals)} {token1Meta.symbol}
          </p>
        </div>
        <div className="analytics-card rounded-2xl border border-white/8 bg-[#120f1d] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">Pair</p>
          <p className="mt-1.5 font-mono text-sm text-white/75">
            {pairAddress.slice(0, 6)}…{pairAddress.slice(-4)}
          </p>
        </div>
      </div>
      <div className="mt-3 text-xs leading-relaxed text-white/35">
        Current reserve snapshot; the pair reports {totalSupply > 0n ? 'nonzero' : 'zero'} LP-token supply. Token
        quantities are not comparable across assets and do not establish price, TVL, safety, locked liquidity, or
        recent trading activity.
      </div>
    </div>
  )
}

// ── LP position card for connected wallet view ──────────────────────────────
function PositionCard({ position, onRemoveLiquidity }: {
  position: {
    pairAddress: `0x${string}`
    token0Meta: TokenMeta
    token1Meta: TokenMeta
    token0Address: `0x${string}`
    token1Address: `0x${string}`
    lpBalance: bigint
    pooled0: bigint
    pooled1: bigint
    share: number
  }
  onRemoveLiquidity: (pairAddress: `0x${string}`, token0: `0x${string}`, token1: `0x${string}`, lpBalance: bigint, token0Decimals: number, token1Decimals: number) => void
}) {
  return (
    <div className="analytics-card rounded-[30px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/25">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">LP position</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {position.token0Meta.symbol} / {position.token1Meta.symbol}
          </h2>
          <p className="mt-1 text-sm text-white/45">
            {position.token0Meta.name} paired with {position.token1Meta.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/35"
          >
            <Plus size={12} />
            Add disabled
          </button>
          <button
            onClick={() => onRemoveLiquidity(position.pairAddress, position.token0Address, position.token1Address, position.lpBalance, position.token0Meta.decimals, position.token1Meta.decimals)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
          >
            <Minus size={12} />
            Remove Liquidity
          </button>
          <a
            href={`https://liteforge.explorer.caldera.xyz/address/${position.pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
          >
            View pair
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="analytics-card rounded-2xl border border-white/8 bg-[#120f1d] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">LP balance</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatAmount(position.lpBalance, 18)}</p>
        </div>
        <div className="analytics-card rounded-2xl border border-white/8 bg-[#120f1d] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">Pool share</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatPercent(position.share)}</p>
        </div>
        <div className="analytics-card rounded-2xl border border-white/8 bg-[#120f1d] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">Pair address</p>
          <p className="mt-2 font-mono text-sm text-white/75">
            {position.pairAddress.slice(0, 6)}…{position.pairAddress.slice(-4)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="analytics-card rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">{position.token0Meta.symbol} exposure</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {formatAmount(position.pooled0, position.token0Meta.decimals)} {position.token0Meta.symbol}
          </p>
        </div>
        <div className="analytics-card rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">{position.token1Meta.symbol} exposure</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {formatAmount(position.pooled1, position.token1Meta.decimals)} {position.token1Meta.symbol}
          </p>
        </div>
      </div>
    </div>
  )
}

// Extended ABI with removeLiquidity functions not in the main config
const UNISWAP_V2_ROUTER_EXTENDED_ABI = [
  ...UNISWAP_V2_ROUTER_ABI,
  {
    name: 'removeLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
    ],
  },
  {
    name: 'removeLiquidityETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'amountTokenMin', type: 'uint256' },
      { name: 'amountETHMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH', type: 'uint256' },
    ],
  },
] as const

const DEFAULT_DEADLINE_SECONDS = 20 * 60

// ── Remove Liquidity Panel ──────────────────────────────────────────────────
function RemoveLiquidityPanel({
  deployment,
  pairAddress,
  token0,
  token1,
  lpBalance,
  token0Decimals,
  token1Decimals,
  onClose,
  onSuccess,
}: {
  deployment: DexRecoverySource
  pairAddress: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  lpBalance: bigint
  token0Decimals: number
  token1Decimals: number
  onClose: () => void
  onSuccess: () => void
}) {
  const { address, isConnected } = useAccount()
  const { ensureLitvmWrite, writeRecoveryContractAsync } = useSafeWriteContract()
  const queryClient = useQueryClient()

  const [removeAmount, setRemoveAmount] = useState('')
  const [removing, setRemoving] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [txOpen, setTxOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [approvalPending, setApprovalPending] = useState(false)
  const [txAction, setTxAction] = useState<'approve' | 'remove'>('remove')
  const [slippageBps, setSlippageBps] = useState(50n)

  const isToken0Native = token0.toLowerCase() === deployment.wrappedNative.toLowerCase()
  const isToken1Native = token1.toLowerCase() === deployment.wrappedNative.toLowerCase()
  const isETHPair = isToken0Native || isToken1Native

  let parsedRemoveAmount = 0n
  try {
    parsedRemoveAmount = removeAmount.trim() ? parseUnits(removeAmount.trim(), 18) : 0n
  } catch {
    parsedRemoveAmount = 0n
  }
  const removeAmountExceedsBalance = parsedRemoveAmount > lpBalance
  const lpAmount = parsedRemoveAmount > 0n && !removeAmountExceedsBalance ? parsedRemoveAmount : 0n

  const pairFromFactoryRead = useReadContract({
    address: deployment.factory,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'getPair',
    args: [token0, token1],
    chainId: litvm.id,
    query: { enabled: true },
  })
  const pairIsAuthenticated = Boolean(
    pairFromFactoryRead.isSuccess &&
    sameAddress(pairAddress, pairFromFactoryRead.data as string | undefined),
  )

  const reservesRead = useReadContract({
    address: pairAddress,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: 'getReserves',
    chainId: litvm.id,
    query: { enabled: pairIsAuthenticated },
  })

  const reserves = reservesRead.data as readonly [bigint, bigint, number] | undefined

  // Read total supply to calculate expected amounts out
  const totalSupplyRead = useReadContract({
    address: pairAddress,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: 'totalSupply',
    chainId: litvm.id,
    query: { enabled: pairIsAuthenticated },
  })

  const totalSupply = totalSupplyRead.data as bigint | undefined

  let previewQuote: ReturnType<typeof computeRemoveLiquidityMinimums> | null = null
  if (reserves && totalSupply && lpAmount > 0n) {
    try {
      previewQuote = computeRemoveLiquidityMinimums({
        reserve0: reserves[0],
        reserve1: reserves[1],
        totalSupply,
        liquidity: lpAmount,
        slippageBps,
      })
    } catch {
      previewQuote = null
    }
  }
  const expectedToken0 = previewQuote?.expected0 ?? 0n
  const expectedToken1 = previewQuote?.expected1 ?? 0n
  // LP token allowance check
  const allowanceRead = useReadContract({
    address: pairAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, deployment.router] : undefined,
    chainId: litvm.id,
    query: { enabled: pairIsAuthenticated && isConnected && Boolean(address) },
  })

  const allowance = (allowanceRead.data ?? 0n) as bigint
  const needsApproval = isConnected && allowance < lpAmount && lpAmount > 0n

  const { isLoading: isConfirming, isSuccess: txConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: litvm.id,
    query: { enabled: Boolean(txHash) },
  })

  useEffect(() => {
    if (!txHash) return
    if (isConfirming) {
      setTxStatus('pending')
      setTxMessage(txAction === 'approve' ? 'Approval transaction pending...' : 'Remove liquidity transaction pending...')
    }
  }, [isConfirming, txHash, txAction])

  useEffect(() => {
    if (!txHash || !txConfirmed) return
    setTxStatus('success')
    if (txAction === 'approve') {
      setTxMessage('Approval confirmed. You can now remove liquidity.')
      // Refetch allowance so the Remove button unblocks immediately
      queryClient.invalidateQueries({ queryKey: allowanceRead.queryKey })
      allowanceRead.refetch()
    } else {
      setTxMessage('Liquidity removed successfully on LitVM.')
    }
  }, [txConfirmed, txHash, txAction, queryClient, allowanceRead])

  useEffect(() => {
    if (!txHash || !txError) return
    setTxStatus('error')
    const raw = txError.message
    const revertMatch = raw.match(/reverted with reason string:\s*(.+)/i)
      || raw.match(/execution reverted:\s*(.+)/i)
      || raw.match(/Transaction timed out/i)
    const display = revertMatch ? revertMatch[0] : raw
    setTxMessage(display.slice(0, 300) || `${txAction === 'approve' ? 'Approval' : 'Remove liquidity'} failed.`)
  }, [txError, txHash, txAction])

  const canRemove = isConnected && pairIsAuthenticated && lpAmount > 0n && previewQuote !== null

  async function handleApprove() {
    if (!address) return
    if (!(await ensureLitvmWrite({
      action: 'approving LP tokens for removal',
      onError: (message) => {
        setTxMessage(message)
        setTxOpen(true)
        setTxStatus('error')
      },
    }))) return
    setApprovalPending(true)
    setTxAction('approve')
    try {
      await attestFreshDexRecoveryRuntime(deployment.id)
      await readFreshCanonicalPair(token0, token1, pairAddress, deployment.id)
      const freshLpBalance = await readContract(wagmiConfig, {
        address: pairAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
        chainId: litvm.id,
      }) as bigint
      if (freshLpBalance < lpAmount) {
        throw new Error('Your LitVM LP balance changed. Review the removal amount and try again.')
      }
      const hash = await writeRecoveryContractAsync({
        address: pairAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [deployment.router, lpAmount],
        gas: 500000n,
      }, {
        kind: 'dex-liquidity',
        deploymentId: deployment.id,
        pair: pairAddress,
        router: deployment.router,
        tokenA: token0,
        tokenB: token1,
      })
      setTxHash(hash)
      setTxOpen(true)
      setTxStatus('pending')
      setTxMessage('Approval transaction pending...')
      // Cancel any in-flight query then refetch to get updated allowance
      await queryClient.cancelQueries({ queryKey: allowanceRead.queryKey })
      queryClient.invalidateQueries({ queryKey: allowanceRead.queryKey })
    } catch (err) {
      setTxStatus('error')
      setTxMessage(err instanceof Error ? err.message.slice(0, 180) : 'Approval failed.')
      setTxOpen(true)
    } finally {
      setApprovalPending(false)
    }
  }

  async function handleRemoveLiquidity() {
    if (!canRemove || !address) return
    if (!(await ensureLitvmWrite({
      action: 'removing liquidity',
      onError: (message) => {
        setTxMessage(message)
        setTxOpen(true)
        setTxStatus('error')
      },
    }))) return
    setRemoving(true)
    setTxAction('remove')
    setTxHash(undefined)
    try {
      setTxOpen(true)
      setTxStatus('pending')
      setTxMessage(undefined)

      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS)
      validateSlippageBps(slippageBps)
      await attestFreshDexRecoveryRuntime(deployment.id)
      const freshPair = await readFreshCanonicalPair(token0, token1, pairAddress, deployment.id)
      if (!freshPair) throw new Error('The selected pair is no longer available on the selected source-pinned LitVM factory.')
      const [freshLpBalance, freshAllowance] = await Promise.all([
        readContract(wagmiConfig, {
          address: pairAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
          chainId: litvm.id,
        }) as Promise<bigint>,
        readContract(wagmiConfig, {
          address: pairAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, deployment.router],
          chainId: litvm.id,
        }) as Promise<bigint>,
      ])
      if (freshLpBalance < lpAmount) {
        throw new Error('Your LitVM LP balance changed. Review the removal amount and try again.')
      }
      if (freshAllowance < lpAmount) {
        throw new Error('The router allowance changed. Approve the LP amount again before removing liquidity.')
      }

      const freshQuote = computeRemoveLiquidityMinimums({
        reserve0: freshPair.reserves[0],
        reserve1: freshPair.reserves[1],
        totalSupply: freshPair.totalSupply,
        liquidity: lpAmount,
        slippageBps,
      })
      const token0IsPair0 = sameAddress(token0, freshPair.token0)
      const amount0Min = token0IsPair0 ? freshQuote.amount0Min : freshQuote.amount1Min
      const amount1Min = token0IsPair0 ? freshQuote.amount1Min : freshQuote.amount0Min

      let hash: `0x${string}`

      if (isETHPair) {
        // One of the tokens is zkLTC (native)
        const tokenAddr = isToken0Native ? token1 : token0
        const amountTokenMin = isToken0Native ? amount1Min : amount0Min
        const amountETHMin = isToken0Native ? amount0Min : amount1Min
        hash = await writeRecoveryContractAsync({
          address: deployment.router,
          abi: UNISWAP_V2_ROUTER_EXTENDED_ABI,
          functionName: 'removeLiquidityETH',
          args: [tokenAddr, lpAmount, amountTokenMin, amountETHMin, address, deadline],
          gas: 500000n,
        }, {
          kind: 'dex-liquidity',
          deploymentId: deployment.id,
          pair: pairAddress,
          router: deployment.router,
          tokenA: token0,
          tokenB: token1,
        })
      } else {
        // Both ERC20 — ensure tokenA < tokenB
        const isSorted = token0.toLowerCase() < token1.toLowerCase()
        const [tokenA, tokenB] = isSorted ? [token0, token1] as const : [token1, token0] as const
        const [amountAMin, amountBMin] = isSorted
          ? [amount0Min, amount1Min] as const
          : [amount1Min, amount0Min] as const
        hash = await writeRecoveryContractAsync({
          address: deployment.router,
          abi: UNISWAP_V2_ROUTER_EXTENDED_ABI,
          functionName: 'removeLiquidity',
          args: [tokenA, tokenB, lpAmount, amountAMin, amountBMin, address, deadline],
          gas: 500000n,
        }, {
          kind: 'dex-liquidity',
          deploymentId: deployment.id,
          pair: pairAddress,
          router: deployment.router,
          tokenA: token0,
          tokenB: token1,
        })
      }

      setTxHash(hash)
    } catch (err: unknown) {
      setTxStatus('error')
      const raw = err instanceof Error ? err.message : String(err)
      const revertMatch = raw.match(/reverted with reason string:\s*(.+)/i)
        || raw.match(/execution reverted:\s*(.+)/i)
        || raw.match(/Transaction timed out/i)
      const display = revertMatch ? revertMatch[0] : raw
      setTxMessage(display.slice(0, 300) || 'Remove liquidity failed.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Remove Liquidity</h2>
        <button
          aria-label="Close remove liquidity panel"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-white/55 transition hover:border-white/20 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {!isConnected && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6 text-center">
          <p className="text-sm text-white/55">Connect your wallet to remove liquidity.</p>
        </div>
      )}

      {isConnected && (
        <>
          {/* LP balance info */}
          <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-white/35">Your LP balance</p>
            <p className="mt-2 text-lg font-semibold text-white">{formatAmount(lpBalance, 18)} LP</p>
          </div>

          {/* LP amount input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/55">LP tokens to remove</span>
              <span className="text-white/40">Balance: {formatAmount(lpBalance, 18)}</span>
            </div>
            <div className="flex gap-2">
              <input
                aria-label="LP token amount to remove"
                type="number"
                min="0"
                step="any"
                value={removeAmount}
                onChange={(e) => setRemoveAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right font-mono text-lg text-white outline-none placeholder:text-white/20 focus:border-white/20"
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setRemoveAmount(formatInputAmount(lpBalance, 18))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white"
                >
                  Max
                </button>
                <button
                  onClick={() => setRemoveAmount('')}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex gap-2 text-xs text-white/40">
              {(['2500', '5000', '7500'] as const).map((bp) => (
                <button
                  key={bp}
                  onClick={() => {
                    const lpAmt = (lpBalance * BigInt(bp)) / 10000n
                    setRemoveAmount(formatInputAmount(lpAmt, 18))
                  }}
                  className={`flex-1 rounded-full border py-1 transition ${
                    removeAmount === formatInputAmount((lpBalance * BigInt(bp)) / 10000n, 18)
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/10 text-white/40 hover:border-white/15'
                  }`}
                >
                  {Number(bp) / 100}%
                </button>
              ))}
            </div>
            {removeAmountExceedsBalance && (
              <p className="text-xs text-red-300">Amount exceeds your LP balance.</p>
            )}
          </div>

          {/* Expected amounts */}
          {lpAmount > 0n && reserves && (
            <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-white/35">You will receive (estimated)</p>
              <div className="flex justify-between">
                <span className="text-sm text-white/70">{formatAmount(expectedToken0, token0Decimals)} {token0.slice(0, 6)}…</span>
                <span className="text-sm text-white/70">{formatAmount(expectedToken1, token1Decimals)} {token1.slice(0, 6)}…</span>
              </div>
            </div>
          )}

          {!pairIsAuthenticated && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              Removal is disabled because this pair or the configured DEX targets could not be authenticated against the canonical LitVM factory.
            </p>
          )}

          <div className="space-y-3 rounded-2xl border border-white/8 bg-[#120f1d] p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="remove-liquidity-slippage" className="text-xs uppercase tracking-[0.12em] text-white/35">
                Slippage tolerance
              </label>
              <div className="flex gap-1.5">
                {[10n, 50n, 100n].map((bps) => (
                  <button
                    key={bps.toString()}
                    type="button"
                    onClick={() => setSlippageBps(bps)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      slippageBps === bps
                        ? 'border-fuchsia-300/40 bg-fuchsia-300/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {Number(bps) / 100}%
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="remove-liquidity-slippage"
                aria-label="Remove liquidity slippage tolerance percentage"
                type="number"
                min="0.01"
                max="50"
                step="0.1"
                value={Number(slippageBps) / 100}
                onChange={(event) => {
                  const percent = Number(event.target.value)
                  if (Number.isFinite(percent) && percent > 0 && percent <= 50) {
                    setSlippageBps(BigInt(Math.round(percent * 100)))
                  }
                }}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right text-sm text-white outline-none focus:border-white/25"
              />
              <span className="text-sm text-white/45">%</span>
            </div>
            <p className="text-xs leading-5 text-white/40">
              Minimum outputs are rebuilt from fresh reserves and total supply immediately before submission.
            </p>
          </div>

          {lpAmount > 0n && pairIsAuthenticated && previewQuote === null && (
            <p className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
              A positive two-sided quote is required before liquidity can be removed.
            </p>
          )}

          {/* Approval needed */}
          {needsApproval && pairIsAuthenticated && (
            <button
              onClick={handleApprove}
              disabled={approvalPending}
              className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-white/70 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approvalPending ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{approvalPending ? 'Approving exact recovery amount…' : 'Approve exact LP amount for recovery'}</span>
            </button>
          )}

          {/* Remove button */}
          <button
            onClick={handleRemoveLiquidity}
            disabled={!canRemove || removing || (needsApproval && allowance < lpAmount)}
            className="flex w-full items-center justify-center gap-2 rounded-[18px] px-5 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: needsApproval && allowance < lpAmount
                ? 'rgba(228,79,181,0.3)'
                : `linear-gradient(135deg, #E44FB5 0%, #b43684 100%)`,
              boxShadow: '0 16px 40px rgba(228,79,181,0.28)',
            }}
          >
            {removing || isConfirming ? <Loader2 size={16} className="animate-spin" /> : <Minus size={16} />}
            <span>{removing ? 'Removing…' : isConfirming ? 'Confirming…' : 'Recover Underlying Liquidity'}</span>
          </button>
        </>
      )}

      <TxStatusModal
        isOpen={txOpen}
        onClose={() => {
          if (txStatus === 'success') {
            onSuccess()
            onClose()
          }
          setTxOpen(false)
        }}
        status={txStatus}
        txHash={txHash}
        message={txMessage}
      />
    </div>
  )
}

export default function PoolPage() {
  const { address, isConnected } = useAccount()
  const { isWatched, saveSearch, scopedSearches, toggleWatchlist } = useLocalEngagement()
  const savedPoolSearches = scopedSearches('pool')

  const [selectedDeploymentId, setSelectedDeploymentId] = useState(CURRENT_DEX_RECOVERY_SOURCE.id)
  const selectedDexDeployment = DEX_RECOVERY_SOURCES.find((deployment) => (
    deployment.id === selectedDeploymentId
  )) ?? CURRENT_DEX_RECOVERY_SOURCE

  const isDexConfigured =
    (selectedDexDeployment.id !== 'current' || isCanonicalDexDeployment) &&
    isValidContractAddress(selectedDexDeployment.factory) &&
    isValidContractAddress(selectedDexDeployment.router) &&
    isValidContractAddress(selectedDexDeployment.wrappedNative)

  // ── Total pair count ─────────────────────────────────────────────────────
  const allPairsLengthRead = useReadContract({
    address: selectedDexDeployment.factory,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'allPairsLength',
    chainId: litvm.id,
    query: { enabled: isDexConfigured },
  })

  const totalPairs = Number(allPairsLengthRead.data ?? 0n)
  const maxDisplay = Math.min(totalPairs, MAX_DISPLAY)

  // ── Pagination state ─────────────────────────────────────────────────────
  const [loadedBatches, setLoadedBatches] = useState(2) // start with 2 batches (20 pairs)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [poolSearch, setPoolSearch] = useState('')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setPoolSearch(q)
  }, [])

  // ── Remove liquidity modal state ────────────────────────────────────────
  const [showRemoveLiq, setShowRemoveLiq] = useState(false)
  const [removeLiqData, setRemoveLiqData] = useState<{
    pairAddress: `0x${string}`
    token0: `0x${string}`
    token1: `0x${string}`
    lpBalance: bigint
    token0Decimals: number
    token1Decimals: number
  } | null>(null)

  useEffect(() => {
    setLoadedBatches(2)
    setShowRemoveLiq(false)
    setRemoveLiqData(null)
  }, [selectedDeploymentId])

  const displayedCount = Math.min(loadedBatches * PAGE_SIZE, maxDisplay)
  const displayedIndices = getRecentPoolIndices(totalPairs, displayedCount)

  // ── Batch-fetch pair addresses ───────────────────────────────────────────
  const pairAddressReads = useReadContracts({
    contracts: isDexConfigured
      ? displayedIndices.map((index) => ({
          address: selectedDexDeployment.factory,
          abi: UNISWAP_V2_FACTORY_ABI,
          functionName: 'allPairs' as const,
          args: [index],
          chainId: litvm.id,
        }))
      : [],
    query: { enabled: isDexConfigured && displayedCount > 0 },
  })

  const pairAddresses =
    pairAddressReads.data
      ?.map((result) => (result.status === 'success' ? (result.result as `0x${string}`) : null))
      .filter((result): result is `0x${string}` => result !== null) ?? []

  // ── Read pair metadata ───────────────────────────────────────────────────
  const pairStateReads = useReadContracts({
    contracts: pairAddresses.flatMap((pairAddress) => [
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token0' as const, chainId: litvm.id },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token1' as const, chainId: litvm.id },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves' as const, chainId: litvm.id },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'totalSupply' as const, chainId: litvm.id },
    ]),
    query: { enabled: pairAddresses.length > 0 },
  })

  // ── LP balance reads (connected wallet) ─────────────────────────────────
  const lpBalanceReads = useReadContracts({
    contracts:
      isConnected && address
        ? pairAddresses.map((pairAddress) => ({
            address: pairAddress,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'balanceOf' as const,
            args: [address],
            chainId: litvm.id,
          }))
        : [],
    query: { enabled: isConnected && Boolean(address) && pairAddresses.length > 0 },
  })

  // ── Collect unique token addresses ─────────────────────────────────────
  const tokenAddresses = new Set<string>()
  for (const result of pairStateReads.data ?? []) {
    if (result.status !== 'success' || typeof result.result !== 'string') continue
    if (/^0x[a-fA-F0-9]{40}$/.test(result.result)) {
      tokenAddresses.add((result.result as string).toLowerCase())
    }
  }

  // ── Token metadata reads ─────────────────────────────────────────────────
  const tokenMetadataReads = useReadContracts({
    contracts: Array.from(tokenAddresses)
      .filter(
        (tokenAddress) =>
          tokenAddress !== selectedDexDeployment.wrappedNative.toLowerCase() &&
          tokenAddress !== ZERO_ADDRESS().toLowerCase()
      )
      .flatMap((tokenAddress) => [
        { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'name' as const, chainId: litvm.id },
        { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' as const, chainId: litvm.id },
        { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' as const, chainId: litvm.id },
      ]),
    query: { enabled: tokenAddresses.size > 0 },
  })

  const tokenMetaMap = new Map<string, TokenMeta>()
  tokenMetaMap.set(selectedDexDeployment.wrappedNative.toLowerCase(), {
    name: 'Wrapped zkLTC',
    symbol: 'zkLTC',
    decimals: 18,
  })
  tokenMetaMap.set(ZERO_ADDRESS().toLowerCase(), {
    name: 'zkLTC',
    symbol: 'zkLTC',
    decimals: 18,
  })

  Array.from(tokenAddresses)
    .filter(
      (tokenAddress) =>
        tokenAddress !== selectedDexDeployment.wrappedNative.toLowerCase() &&
        tokenAddress !== ZERO_ADDRESS().toLowerCase()
    )
    .forEach((tokenAddress, index) => {
      const base = index * 3
      const nameResult = tokenMetadataReads.data?.[base]
      const symbolResult = tokenMetadataReads.data?.[base + 1]
      const decimalsResult = tokenMetadataReads.data?.[base + 2]

      if (
        nameResult?.status === 'success' &&
        symbolResult?.status === 'success' &&
        decimalsResult?.status === 'success'
      ) {
        tokenMetaMap.set(tokenAddress, {
          name: nameResult.result as string,
          symbol: symbolResult.result as string,
          decimals: Number(decimalsResult.result),
        })
      }
    })

  // ── Build pool list ─────────────────────────────────────────────────────
  const pools = pairAddresses
    .map((pairAddress, index) => {
      const base = index * 4
      const token0Address =
        pairStateReads.data?.[base]?.status === 'success'
          ? (pairStateReads.data[base].result as `0x${string}`)
          : null
      const token1Address =
        pairStateReads.data?.[base + 1]?.status === 'success'
          ? (pairStateReads.data[base + 1].result as `0x${string}`)
          : null
      const reservesResult = pairStateReads.data?.[base + 2]
      const totalSupplyResult = pairStateReads.data?.[base + 3]

      if (
        token0Address === null ||
        token1Address === null ||
        reservesResult?.status !== 'success' ||
        totalSupplyResult?.status !== 'success'
      ) {
        return null
      }

      const reserves = reservesResult.result as readonly [bigint, bigint, number]
      const totalSupply = totalSupplyResult.result as bigint

      const token0Meta =
        tokenMetaMap.get(token0Address.toLowerCase()) ?? {
          name: 'Unknown',
          symbol: 'UNK',
          decimals: 18,
        }
      const token1Meta =
        tokenMetaMap.get(token1Address.toLowerCase()) ?? {
          name: 'Unknown',
          symbol: 'UNK',
          decimals: 18,
        }

      return {
        pairAddress,
        token0Address,
        token1Address,
        token0Meta,
        token1Meta,
        reserves,
        totalSupply,
        lpBalance:
          lpBalanceReads.data?.[index]?.status === 'success'
            ? (lpBalanceReads.data[index].result as bigint)
            : 0n,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  const positions = pools
    .filter((p) => p.lpBalance > 0n && p.totalSupply > 0n)
    .map((p) => {
      const lpBalance = p.lpBalance
      const totalSupply = p.totalSupply
      const reserves = p.reserves

      const pooled0 = (reserves[0] * lpBalance) / totalSupply
      const pooled1 = (reserves[1] * lpBalance) / totalSupply
      const share = Number((lpBalance * 10_000n) / totalSupply) / 100

      return {
        pairAddress: p.pairAddress,
        token0Meta: p.token0Meta,
        token1Meta: p.token1Meta,
        token0Address: p.token0Address,
        token1Address: p.token1Address,
        lpBalance,
        pooled0,
        pooled1,
        share,
      }
    })

  const searchLower = poolSearch.trim().toLowerCase()
  const visiblePools = filterPools(pools, searchLower, true)

  function handleRemoveLiquidity(
    pairAddress: `0x${string}`,
    token0: `0x${string}`,
    token1: `0x${string}`,
    lpBalance: bigint,
    token0Decimals: number,
    token1Decimals: number
  ) {
    setRemoveLiqData({ pairAddress, token0, token1, lpBalance, token0Decimals, token1Decimals })
    setShowRemoveLiq(true)
  }

  async function handleLoadMore() {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    // Wait for current reads to settle, then load next batch
    await new Promise((resolve) => setTimeout(resolve, 100))
    setLoadedBatches((prev) => prev + 1)
    setIsLoadingMore(false)
  }

  const hasMore = displayedCount < maxDisplay
  const isInitialLoading = pairAddressReads.isLoading || pairStateReads.isLoading

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <ToolHero
        category="Dex"
        title="Liquidity"
        titleHighlight="Pool"
        subtitle="Inspect the bounded newest factory-pair window and eligible wallet positions. New pools and liquidity additions are disabled; authenticated legacy removal is recovery-only."
        color={ACCENT}
        image="/images/carousel/pool.png"
        imagePosition="center 65px"
        imageTopFade={false}
        compact
        flowKey="pool"
        stats={[
          { label: 'Factory pairs', value: totalPairs.toString() },
          { label: 'Newest scanned', value: `${displayedCount}/${maxDisplay}` },
          { label: 'Your positions', value: positions.length.toString() },
        ]}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Source-pinned recovery deployment</p>
              <h2 className="mt-2 text-lg font-semibold text-white">{selectedDexDeployment.label}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                Positions, allowances, quotes, and removal calls below are scoped to this exact factory/router/wrapped-native tuple. Changing the selection clears any open removal flow.
              </p>
            </div>
            <label className="min-w-0 text-sm text-white/60 md:w-80">
              Deployment
              <select
                aria-label="DEX recovery deployment"
                value={selectedDexDeployment.id}
                onChange={(event) => setSelectedDeploymentId(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#120f1d] px-3 text-sm text-white outline-none focus:border-white/25"
              >
                {DEX_RECOVERY_SOURCES.map((deployment) => (
                  <option key={deployment.id} value={deployment.id}>
                    {deployment.label}{deployment.id === 'current' ? '' : ' — retired / withdrawal only'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-white/45 md:grid-cols-2">
            <p className="break-all font-mono">Factory: {selectedDexDeployment.factory}</p>
            <p className="break-all font-mono">Router: {selectedDexDeployment.router}</p>
          </div>
        </section>

        {!isDexConfigured && (
          <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
            Configure factory and WZKLTC addresses before using the pool page.
          </div>
        )}

        <details className="rounded-[20px] border border-amber-300/15 bg-amber-300/[0.045] text-sm text-amber-50/80">
          <summary className="cursor-pointer px-5 py-4 font-semibold text-amber-100">
            Legacy LP recovery is remove-only
          </summary>
          <div className="space-y-3 border-t border-amber-300/10 px-5 py-4 text-xs leading-6 text-amber-50/65">
            <p>
              If this DEX is replaced, old LP tokens remain claims on their original pair contracts. Recover them only through the exact source-pinned legacy router that created the position. Never swap, add liquidity, create a pool, or grant a reusable allowance to a retired router.
            </p>
            <p>
              Before direct recovery, verify that the legacy factory returns the pair for both tokens, the legacy router reports that factory and wrapped-native address, and the recipient is your connected wallet. Approve only the exact LP amount, then call <code>removeLiquidity</code> or <code>removeLiquidityETH</code> with explicit minimum outputs and a short deadline.
            </p>
            {LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS.length > 0 ? (
              <div className="space-y-2">
                {LITVM_LEGACY_DEX_RECOVERY_DEPLOYMENTS.map((deployment) => (
                  <div key={deployment.id} className="rounded-lg border border-amber-300/10 bg-black/15 p-3">
                    <p className="font-semibold text-amber-100">{deployment.label} — withdrawal only</p>
                    <p className="break-all font-mono">Factory: {deployment.factory}</p>
                    <p className="break-all font-mono">Router: {deployment.router}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>
                No retired DEX deployment is currently source-pinned. Do not use an address supplied through chat, an environment variable, or an unverified explorer label.
              </p>
            )}
            <Link href="/docs" className="inline-flex min-h-11 items-center text-amber-200 underline underline-offset-4">
              Read the full recovery checklist
            </Link>
          </div>
        </details>

        {/* ── Header + Create Pool CTA ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {isConnected ? 'Your LP Positions in the Loaded Window' : 'Newest Factory-Pair Window'}
            </h2>
            <p className="mt-1 text-sm text-white/45">
              {isConnected
                ? `${positions.length} position${positions.length !== 1 ? 's' : ''} found for ${address?.slice(0, 6)}…`
                : `${visiblePools.length} pool${visiblePools.length !== 1 ? 's' : ''} available in the newest scanned window`}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <input
              aria-label="Search pools by token, symbol, or address"
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)}
              placeholder="Search pools..."
              type="text"
              className="min-h-11 w-full min-w-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 sm:w-auto sm:min-w-[220px]"
            />
            <button
              type="button"
              onClick={() => saveSearch('pool', poolSearch)}
              disabled={!poolSearch.trim()}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              <BookmarkPlus size={14} />
              Save search
            </button>
            {!isConnected && (
              <div className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-white/45 sm:w-auto">
                Connect wallet to see your positions
              </div>
            )}
            <Link
              href="/security"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition sm:flex-none"
              style={{
                background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)`,
                boxShadow: '0 8px 24px rgba(228,79,181,0.25)',
              }}
            >
              <Plus size={14} />
              New Pools Disabled
            </Link>
          </div>
        </div>
        {savedPoolSearches.length > 0 && (
          <div className="-mt-4 flex flex-wrap gap-2">
            {savedPoolSearches.slice(0, 5).map((search) => (
              <button
                key={`${search.query}:${search.updatedAt}`}
                type="button"
                onClick={() => setPoolSearch(search.query)}
                className="rounded-full border border-white/8 bg-white/[0.025] px-3 py-1.5 text-xs text-white/45 transition hover:border-white/15 hover:text-white/75"
              >
                {search.query}
              </button>
            ))}
          </div>
        )}

        {/* ── Not connected: show all pools ───────────────────────────────── */}
        {!isConnected ? (
          visiblePools.length === 0 ? (
            <div className="analytics-card rounded-[30px] border border-white/10 bg-white/[0.03] p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Layers3 size={22} className="text-white/65" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-white">No pools in the loaded window</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">
                This bounded newest-pair view returned no pools. New pool creation remains disabled.
              </p>
              <Link
                href="/security"
                className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)`,
                }}
              >
                <Plus size={14} />
                Review Security Status
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {visiblePools.map((pool) => (
                <PoolCard
                  key={pool.pairAddress}
                  pairAddress={pool.pairAddress}
                  token0Meta={pool.token0Meta}
                  token1Meta={pool.token1Meta}
                  token0Address={pool.token0Address}
                  token1Address={pool.token1Address}
                  r0={pool.reserves[0]}
                  r1={pool.reserves[1]}
                  totalSupply={pool.totalSupply}
                  watched={isWatched('pool', pool.pairAddress)}
                  onToggleWatch={() => toggleWatchlist({
                    type: 'pool',
                    id: pool.pairAddress,
                    label: `${pool.token0Meta.symbol} / ${pool.token1Meta.symbol}`,
                    href: `/charts?pair=${pool.pairAddress}`,
                  })}
                />
              ))}

              {/* Skeleton rows while loading more */}
              {isInitialLoading &&
                Array.from({ length: Math.min(PAGE_SIZE, maxDisplay - visiblePools.length) }, (_, i) => (
                  <PoolCardSkeleton key={`sk-${i}`} />
                ))}

              {/* Load more button */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore || pairAddressReads.isLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoadingMore || pairAddressReads.isLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Loading…
                      </>
                    ) : (
                      <>
                        <Loader2 size={14} />
                        Load more pools ({Math.min(totalPairs - displayedCount, PAGE_SIZE)} more)
                      </>
                    )}
                  </button>
                </div>
              )}

              {maxDisplay < totalPairs && (
                <p className="text-center text-xs text-white/30">
                  Scanning newest {maxDisplay} of {totalPairs} total pairs. Connect to view your positions.
                </p>
              )}
            </div>
          )
        ) : (
          <>
            {/* ── Connected: wallet positions + CTA ─────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="analytics-card rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Wallet</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Wallet size={18} className="text-white/70" />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-white">
                      {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}
                    </p>
                    <p className="text-sm text-white/45">Connected</p>
                  </div>
                </div>
              </div>

              <div className="analytics-card rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Pairs loaded</p>
                <p className="mt-3 text-3xl font-semibold text-white">{displayedCount}</p>
                <p className="mt-2 text-sm text-white/45">
                  {totalPairs > MAX_DISPLAY
                    ? `Scanning newest ${MAX_DISPLAY} pools.`
                    : `Showing ${displayedCount} of ${totalPairs} pools.`}
                </p>
              </div>

              <div className="analytics-card rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Next action</p>
                <Link
                  href="/swap"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  <Droplets size={14} />
                  Review DEX Status
                </Link>
              </div>
            </div>

            {/* ── LP positions ───────────────────────────────────────────── */}
            {positions.length === 0 ? (
              <div className="analytics-card rounded-[30px] border border-white/10 bg-white/[0.03] p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <Layers3 size={22} className="text-white/65" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-white">No LP positions</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">
                  No LP balance was found in the loaded newest-pair window. This is not a complete wallet history, and new liquidity additions remain disabled.
                </p>
                <Link
                  href="/swap"
                  className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)` }}
                >
                  <Droplets size={14} />
                  Review DEX Status
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {positions.map((position) => (
                  <PositionCard
                    key={position.pairAddress}
                    position={position}
                    onRemoveLiquidity={handleRemoveLiquidity}
                  />
                ))}
              </div>
            )}

            {/* Remove liquidity modal */}
            {showRemoveLiq && removeLiqData && (
              <Dialog.Root open={showRemoveLiq} onOpenChange={(open) => { if (!open) { setShowRemoveLiq(false); setRemoveLiqData(null) } }}>
                <Dialog.Portal>
                  <Dialog.Overlay
                    className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
                    style={{ background: 'rgba(5, 3, 9, 0.85)', backdropFilter: 'blur(12px)' }}
                  />
                  <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    style={{ background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: '24px' }}
                  >
                    <RemoveLiquidityPanel
                      deployment={selectedDexDeployment}
                      pairAddress={removeLiqData.pairAddress}
                      token0={removeLiqData.token0}
                      token1={removeLiqData.token1}
                      lpBalance={removeLiqData.lpBalance}
                      token0Decimals={removeLiqData.token0Decimals}
                      token1Decimals={removeLiqData.token1Decimals}
                      onClose={() => { setShowRemoveLiq(false); setRemoveLiqData(null) }}
                      onSuccess={() => {
                        lpBalanceReads.refetch()
                        pairStateReads.refetch()
                      }}
                    />
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            )}

            {/* Other pools (no LP position) */}
            {visiblePools.length > 0 && (
              <>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <p className="text-xs uppercase tracking-[0.12em] text-white/35">Other pools</p>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="space-y-4">
                  {visiblePools.map((pool) => (
                    <PoolCard
                      key={pool.pairAddress}
                      pairAddress={pool.pairAddress}
                      token0Meta={pool.token0Meta}
                      token1Meta={pool.token1Meta}
                      token0Address={pool.token0Address}
                      token1Address={pool.token1Address}
                      r0={pool.reserves[0]}
                      r1={pool.reserves[1]}
                      totalSupply={pool.totalSupply}
                      watched={isWatched('pool', pool.pairAddress)}
                      onToggleWatch={() => toggleWatchlist({
                        type: 'pool',
                        id: pool.pairAddress,
                        label: `${pool.token0Meta.symbol} / ${pool.token1Meta.symbol}`,
                        href: `/charts?pair=${pool.pairAddress}`,
                      })}
                    />
                  ))}

                  {/* Skeleton rows while loading more */}
                  {isInitialLoading &&
                    Array.from({ length: Math.min(PAGE_SIZE, maxDisplay - visiblePools.length) }, (_, i) => (
                      <PoolCardSkeleton key={`sk-${i}`} />
                    ))}

                  {/* Load more button */}
                  {hasMore && (
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore || pairAddressReads.isLoading}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoadingMore || pairAddressReads.isLoading ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Loading…
                          </>
                        ) : (
                          <>
                            <Loader2 size={14} />
                            Load more pools ({Math.min(totalPairs - displayedCount, PAGE_SIZE)} more)
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {maxDisplay < totalPairs && (
                    <p className="text-center text-xs text-white/30">
                      Scanning newest {maxDisplay} of {totalPairs} total pairs. Load more expands the visible window.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
