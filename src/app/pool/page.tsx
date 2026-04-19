'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Droplets, ExternalLink, Layers3, Loader2, Minus, Plus, Wallet, X } from 'lucide-react'
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { ToolHero } from '@/components/shared/ToolHero'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { ERC20_ABI, UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI, UNISWAP_V2_ROUTER_ABI } from '@/config/abis'
import { UNISWAP_V2_FACTORY_ADDRESS, UNISWAP_V2_ROUTER_ADDRESS, WRAPPED_ZKLTC_ADDRESS, isValidContractAddress } from '@/config/contracts'

const ACCENT = '#E44FB5'
const PAGE_SIZE = 10
const MAX_DISPLAY = 100
const MAX_INITIAL = 20 // pre-load first 20 pairs (2 batches)

function ZERO_ADDRESS(): string {
  return '0x0000000000000000000000000000000000000000'
}

function formatAmount(value: bigint, decimals: number) {
  const raw = formatUnits(value, decimals)
  const [whole, fraction = ''] = raw.split('.')
  if (!fraction) return whole
  return `${whole}.${fraction.slice(0, 6).replace(/0+$/, '') || '0'}`
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
function PoolCard({ pairAddress, token0Meta, token1Meta, token0Address, token1Address, r0, r1 }: {
  pairAddress: `0x${string}`
  token0Meta: TokenMeta
  token1Meta: TokenMeta
  token0Address: `0x${string}`
  token1Address: `0x${string}`
  r0: bigint
  r1: bigint
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
          <Link
            href={`/swap?addLiquidity=${pairAddress}&token0=${token0Address}&token1=${token1Address}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
          >
            <Plus size={12} />
            Add Liquidity
          </Link>
          <a
            href={`https://liteforge.explorer.caldera.xyz/address/${pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
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
    </div>
  )
}

// ── LP position card for connected wallet view ──────────────────────────────
function PositionCard({ position, onAddLiquidity, onRemoveLiquidity }: {
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
  onAddLiquidity: (pairAddress: `0x${string}`, token0: `0x${string}`, token1: `0x${string}`) => void
  onRemoveLiquidity: (pairAddress: `0x${string}`, token0: `0x${string}`, token1: `0x${string}`, lpBalance: bigint) => void
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
            onClick={() => onAddLiquidity(position.pairAddress, position.token0Address, position.token1Address)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
          >
            <Plus size={12} />
            Add Liquidity
          </button>
          <button
            onClick={() => onRemoveLiquidity(position.pairAddress, position.token0Address, position.token1Address, position.lpBalance)}
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
  pairAddress,
  token0,
  token1,
  lpBalance,
  onClose,
  onSuccess,
}: {
  pairAddress: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  lpBalance: bigint
  onClose: () => void
  onSuccess: () => void
}) {
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const queryClient = useQueryClient()

  const [removePercent, setRemovePercent] = useState('100')  // percentage or 'max'
  const [removing, setRemoving] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [txOpen, setTxOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [approvalPending, setApprovalPending] = useState(false)

  const isToken0Native = token0.toLowerCase() === ZERO_ADDRESS().toLowerCase()
  const isToken1Native = token1.toLowerCase() === ZERO_ADDRESS().toLowerCase()
  const isETHPair = isToken0Native || isToken1Native

  const maxLpReadable = Number(lpBalance) / 1e18
  const lpAmount = parseFloat(removePercent) > 0 && parseFloat(removePercent) <= maxLpReadable
    ? BigInt(Math.floor(parseFloat(removePercent) * 1e18))
    : 0n

  // Read reserves to calculate expected token amounts
  const reservesRead = useReadContract({
    address: pairAddress,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: 'getReserves',
  })

  const reserves = reservesRead.data as readonly [bigint, bigint, number] | undefined

  // Read total supply to calculate expected amounts out
  const totalSupplyRead = useReadContract({
    address: pairAddress,
    abi: UNISWAP_V2_PAIR_ABI,
    functionName: 'totalSupply',
  })

  const totalSupply = totalSupplyRead.data as bigint | undefined

  const expectedToken0 = reserves && totalSupply && totalSupply > 0n
    ? (reserves[0] * lpAmount) / totalSupply
    : 0n
  const expectedToken1 = reserves && totalSupply && totalSupply > 0n
    ? (reserves[1] * lpAmount) / totalSupply
    : 0n
  // LP token allowance check
  const allowanceRead = useReadContract({
    address: pairAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, UNISWAP_V2_ROUTER_ADDRESS] : undefined,
    query: { enabled: isConnected && Boolean(address) },
  })

  const allowance = (allowanceRead.data ?? 0n) as bigint
  const needsApproval = isConnected && allowance < lpAmount && lpAmount > 0n

  const { isLoading: isConfirming, isSuccess: txConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  })

  useEffect(() => {
    if (!txHash) return
    if (isConfirming) {
      setTxStatus('pending')
      setTxMessage('Remove liquidity transaction pending...')
    }
  }, [isConfirming, txHash])

  useEffect(() => {
    if (!txHash || !txConfirmed) return
    setTxStatus('success')
    setTxMessage('Liquidity removed successfully on LitVM.')
  }, [txConfirmed, txHash])

  useEffect(() => {
    if (!txHash || !txError) return
    setTxStatus('error')
    setTxMessage(txError.message.slice(0, 180))
  }, [txError, txHash])

  const canRemove = isConnected && parseFloat(removePercent) > 0 && lpAmount > 0n

  async function handleApprove() {
    if (!address) return
    setApprovalPending(true)
    try {
      const hash = await writeContractAsync({
        address: pairAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [UNISWAP_V2_ROUTER_ADDRESS, lpAmount],
      })
      setTxHash(hash)
      setTxOpen(true)
      setTxStatus('pending')
      setTxMessage('Approval transaction pending...')
      // Invalidate allowance so needsApproval updates immediately after approval confirms
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
    setRemoving(true)
    try {
      setTxOpen(true)
      setTxStatus('pending')
      setTxMessage(undefined)

      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS)

      let hash: `0x${string}`

      if (isETHPair) {
        // One of the tokens is zkLTC (native)
        const tokenAddr = isToken0Native ? token1 : token0
        hash = await writeContractAsync({
          address: UNISWAP_V2_ROUTER_ADDRESS,
          abi: UNISWAP_V2_ROUTER_EXTENDED_ABI,
          functionName: 'removeLiquidityETH',
          args: [tokenAddr, lpAmount, 0n, 0n, address, deadline],
        })
      } else {
        // Both ERC20 — ensure tokenA < tokenB
        const [tokenA, tokenB] = token0.toLowerCase() < token1.toLowerCase()
          ? [token0, token1] as const
          : [token1, token0] as const
        hash = await writeContractAsync({
          address: UNISWAP_V2_ROUTER_ADDRESS,
          abi: UNISWAP_V2_ROUTER_EXTENDED_ABI,
          functionName: 'removeLiquidity',
          args: [tokenA, tokenB, lpAmount, 0n, 0n, address, deadline],
        })
      }

      setTxHash(hash)
    } catch (err) {
      setTxStatus('error')
      setTxMessage(err instanceof Error ? err.message.slice(0, 180) : 'Remove liquidity failed.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Remove Liquidity</h2>
        <button
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
                type="number"
                min="0"
                step="any"
                value={removePercent}
                onChange={(e) => setRemovePercent(e.target.value)}
                placeholder="0.0"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right font-mono text-lg text-white outline-none placeholder:text-white/20 focus:border-white/20"
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setRemovePercent((Number(lpBalance) / 1e18).toFixed(8))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white"
                >
                  Max
                </button>
                <button
                  onClick={() => setRemovePercent('0')}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex gap-2 text-xs text-white/40">
              {['25', '50', '75'].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const fraction = (Number(lpBalance) * Number(pct) / 100 / 1e18).toFixed(8)
                    setRemovePercent(fraction)
                  }}
                  className={`flex-1 rounded-full border py-1 transition ${
                    removePercent === pct
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/10 text-white/40 hover:border-white/15'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Expected amounts */}
          {lpAmount > 0n && reserves && (
            <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-white/35">You will receive (estimated)</p>
              <div className="flex justify-between">
                <span className="text-sm text-white/70">{formatAmount(expectedToken0, 18)}</span>
                <span className="text-sm text-white/70">{formatAmount(expectedToken1, 18)}</span>
              </div>
            </div>
          )}

          {/* Approval needed */}
          {needsApproval && (
            <button
              onClick={handleApprove}
              disabled={approvalPending}
              className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-white/70 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approvalPending ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{approvalPending ? 'Approving…' : 'Approve LP Token'}</span>
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
            <span>{removing ? 'Removing…' : isConfirming ? 'Confirming…' : 'Remove Liquidity'}</span>
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

  const isDexConfigured = isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS) && isValidContractAddress(WRAPPED_ZKLTC_ADDRESS)

  // ── Total pair count ─────────────────────────────────────────────────────
  const allPairsLengthRead = useReadContract({
    address: UNISWAP_V2_FACTORY_ADDRESS,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'allPairsLength',
    query: { enabled: isDexConfigured },
  })

  const totalPairs = Number(allPairsLengthRead.data ?? 0n)
  const maxDisplay = Math.min(totalPairs, MAX_DISPLAY)

  // ── Pagination state ─────────────────────────────────────────────────────
  const [loadedBatches, setLoadedBatches] = useState(2) // start with 2 batches (20 pairs)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // ── Remove liquidity modal state ────────────────────────────────────────
  const [showRemoveLiq, setShowRemoveLiq] = useState(false)
  const [removeLiqData, setRemoveLiqData] = useState<{
    pairAddress: `0x${string}`
    token0: `0x${string}`
    token1: `0x${string}`
    lpBalance: bigint
  } | null>(null)

  const displayedCount = Math.min(loadedBatches * PAGE_SIZE, maxDisplay)

  // ── Batch-fetch pair addresses ───────────────────────────────────────────
  const pairAddressReads = useReadContracts({
    contracts: isDexConfigured
      ? Array.from({ length: displayedCount }, (_, index) => ({
          address: UNISWAP_V2_FACTORY_ADDRESS,
          abi: UNISWAP_V2_FACTORY_ABI,
          functionName: 'allPairs' as const,
          args: [BigInt(index)],
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
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token0' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token1' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'totalSupply' as const },
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
          tokenAddress !== WRAPPED_ZKLTC_ADDRESS.toLowerCase() &&
          tokenAddress !== ZERO_ADDRESS().toLowerCase()
      )
      .flatMap((tokenAddress) => [
        { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'name' as const },
        { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' as const },
        { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' as const },
      ]),
    query: { enabled: tokenAddresses.size > 0 },
  })

  const tokenMetaMap = new Map<string, TokenMeta>()
  tokenMetaMap.set(WRAPPED_ZKLTC_ADDRESS.toLowerCase(), {
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
        tokenAddress !== WRAPPED_ZKLTC_ADDRESS.toLowerCase() &&
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

  const visiblePools = pools.filter(
    (p) => !(p.lpBalance > 0n && p.totalSupply > 0n) // exclude pools where user already has LP
  )

  function handleAddLiquidity(
    pairAddress: `0x${string}`,
    token0: `0x${string}`,
    token1: `0x${string}`
  ) {
    window.location.href = `/swap?addLiquidity=${pairAddress}&token0=${token0}&token1=${token1}`
  }

  function handleRemoveLiquidity(
    pairAddress: `0x${string}`,
    token0: `0x${string}`,
    token1: `0x${string}`,
    lpBalance: bigint
  ) {
    setRemoveLiqData({ pairAddress, token0, token1, lpBalance })
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
        subtitle="Browse all factory pools, view reserves, and manage your LP positions."
        color={ACCENT}
        image="/images/carousel/pool.png"
        imagePosition="center 65px"
        imageTopFade={false}
        compact
        stats={[
          { label: 'Factory pairs', value: totalPairs.toString() },
          { label: 'Displayed', value: `${displayedCount}/${maxDisplay}` },
          { label: 'Your positions', value: positions.length.toString() },
        ]}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {!isDexConfigured && (
          <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
            Configure factory and WZKLTC addresses before using the pool page.
          </div>
        )}

        {/* ── Header + Create Pool CTA ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {isConnected ? 'Your LP Positions' : 'All Factory Pools'}
            </h2>
            <p className="mt-1 text-sm text-white/45">
              {isConnected
                ? `${positions.length} position${positions.length !== 1 ? 's' : ''} found for ${address?.slice(0, 6)}…`
                : `${visiblePools.length} pool${visiblePools.length !== 1 ? 's' : ''} available to explore`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!isConnected && (
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/45">
                Connect wallet to see your positions
              </div>
            )}
            <Link
              href="/swap?createPool=1"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition"
              style={{
                background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)`,
                boxShadow: '0 8px 24px rgba(228,79,181,0.25)',
              }}
            >
              <Plus size={14} />
              Create Pool
            </Link>
          </div>
        </div>

        {/* ── Not connected: show all pools ───────────────────────────────── */}
        {!isConnected ? (
          visiblePools.length === 0 ? (
            <div className="analytics-card rounded-[30px] border border-white/10 bg-white/[0.03] p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Layers3 size={22} className="text-white/65" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-white">No pools yet</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">
                Be the first to create a pool on the LitVM DEX.
              </p>
              <Link
                href="/swap?createPool=1"
                className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)`,
                }}
              >
                <Plus size={14} />
                Create First Pool
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
                  Showing {maxDisplay} of {totalPairs} total pairs. Connect to view your positions.
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
                    ? `Displaying first ${MAX_DISPLAY} pools.`
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
                  Open Swap
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
                  You don't hold any Lester Labs V2 LP tokens yet. Add liquidity to a pair to earn from trades.
                </p>
                <Link
                  href="/swap"
                  className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)` }}
                >
                  <Droplets size={14} />
                  Go to Swap
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {positions.map((position) => (
                  <PositionCard
                    key={position.pairAddress}
                    position={position}
                    onAddLiquidity={handleAddLiquidity}
                    onRemoveLiquidity={handleRemoveLiquidity}
                  />
                ))}
              </div>
            )}

            {/* Remove liquidity panel */}
            {showRemoveLiq && removeLiqData && (
              <div className="analytics-card rounded-[30px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/30">
                <RemoveLiquidityPanel
                  pairAddress={removeLiqData.pairAddress}
                  token0={removeLiqData.token0}
                  token1={removeLiqData.token1}
                  lpBalance={removeLiqData.lpBalance}
                  onClose={() => setShowRemoveLiq(false)}
                  onSuccess={() => {
                    setShowRemoveLiq(false)
                    setRemoveLiqData(null)
                    // Refresh data by re-triggering reads
                    lpBalanceReads.refetch()
                    pairStateReads.refetch()
                  }}
                />
              </div>
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
                      Showing {maxDisplay} of {totalPairs} total pairs.
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

