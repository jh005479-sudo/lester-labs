'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ExternalLink, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { UNISWAP_V2_ROUTER_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { rpc } from '@/lib/rpcClient'

const EXPLORER_BASE = 'https://liteforge.explorer.caldera.xyz'
const PAGE_SIZE = 20

// ── Types ──────────────────────────────────────────────────────────────────

interface SwapRecord {
  txHash: `0x${string}`
  timestamp: number
  blockNumber: number
  tokenIn: { address: `0x${string}`; symbol: string; amount: string; decimals: number }
  tokenOut: { address: `0x${string}`; symbol: string; amount: string; decimals: number }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function truncate(addr: string, chars = 4) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`
}

function formatTimeAgo(timestamp: number): string {
  const diff = (Date.now() / 1000) - timestamp
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(timestamp * 1000).toLocaleDateString()
}

// Uniswap V2 Swap event signature
const SWAP_SIG = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'

// Transfer event signature
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

async function fetchSwapHistory(
  wallet: `0x${string}`,
  offset: number,
  limit: number,
): Promise<SwapRecord[]> {
  if (!isValidContractAddress(UNISWAP_V2_ROUTER_ADDRESS)) return []

  const walletTopic = '0x' + wallet.slice(2).padStart(64, '0')

  try {
    // Try to fetch Swap events from the router contract
    const logs = await rpc<any[]>('eth_getLogs', [{
      address: UNISWAP_V2_ROUTER_ADDRESS,
      topics: [
        SWAP_SIG,
        null, // topic1: sender (indexed)
        null, // topic2: recipient (indexed)
      ],
      fromBlock: '0x1',
      toBlock: 'latest',
    }])

    // Also fetch from allPairs events
    // More practical approach: look for Transfer events that indicate swaps
    // by scanning the token addresses the wallet holds

    // Filter logs where either sender or recipient is the wallet
    const walletSwaps = (logs || [])
      .filter((l: any) => {
        const topic1 = l.topics?.[1] || ''
        const topic2 = l.topics?.[2] || ''
        return (
          topic1.toLowerCase() === walletTopic.toLowerCase() ||
          topic2.toLowerCase() === walletTopic.toLowerCase()
        )
      })
      .slice(offset, offset + limit)

    // Fetch block info for timestamps
    const records: SwapRecord[] = await Promise.all(
      walletSwaps.map(async (log: any) => {
        const txHash = log.transactionHash as `0x${string}`
        const blockNumber = parseInt(log.blockNumber, 16)
        const logData = log.data || '0x'

        // Parse swap data: amountIn, amountOut, tokenIn, tokenOut
        // Swap(address sender, address recipient, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed token0, address indexed token1)
        // topics[2] = token0, topics[3] = token1
        // data: amount0In (32 bytes), amount1In (32 bytes), amount0Out (32 bytes), amount1Out (32 bytes)
        const token0 = ('0x' + (log.topics?.[2] || '').slice(26)) as `0x${string}`
        const token1 = ('0x' + (log.topics?.[3] || '').slice(26)) as `0x${string}`

        const amount0In = BigInt('0x' + logData.slice(2, 66))
        const amount1In = BigInt('0x' + logData.slice(66, 130))
        const amount0Out = BigInt('0x' + logData.slice(130, 194))
        const amount1Out = BigInt('0x' + logData.slice(194, 258))

        const isExactIn = amount0In > 0n || amount1In > 0n

        // Fetch block for timestamp
        let timestamp = 0
        try {
          const block = await rpc<any>('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false])
          timestamp = parseInt(block?.timestamp || '0', 16)
        } catch { /* use 0 */ }

        // Fetch token symbols
        const [sym0, sym1] = await Promise.all([
          rpc<string>('eth_call', [{ to: token0, data: '0x06fdde03' }, 'latest']).catch(() => '?'),
          rpc<string>('eth_call', [{ to: token1, data: '0x06fdde03' }, 'latest']).catch(() => '?'),
        ])

        const tokenInSymbol = isExactIn ? (amount0In > 0n ? sym0 : sym1) : (amount0Out > 0n ? sym0 : sym1)
        const tokenOutSymbol = isExactIn ? (amount0Out > 0n ? sym0 : sym1) : (amount0In > 0n ? sym0 : sym1)
        const amountIn = isExactIn ? (amount0In > 0n ? amount0In : amount1In) : (amount0Out > 0n ? amount0Out : amount1Out)
        const amountOut = isExactIn ? (amount0Out > 0n ? amount0Out : amount1Out) : (amount0In > 0n ? amount0In : amount1In)
        const tokenInAddr = isExactIn ? (amount0In > 0n ? token0 : token1) : (amount0Out > 0n ? token0 : token1)
        const tokenOutAddr = isExactIn ? (amount0Out > 0n ? token0 : token1) : (amount0In > 0n ? token0 : token1)

        return {
          txHash,
          timestamp,
          blockNumber,
          tokenIn: {
            address: tokenInAddr,
            symbol: sym0 === '0x' ? '?' : tokenInSymbol,
            amount: formatAmount(amountIn, 18),
            decimals: 18,
          },
          tokenOut: {
            address: tokenOutAddr,
            symbol: sym1 === '0x' ? '?' : tokenOutSymbol,
            amount: formatAmount(amountOut, 18),
            decimals: 18,
          },
        }
      })
    )

    return records
  } catch {
    // Fallback: try direct token transfer scan approach
    return []
  }
}

function formatAmount(value: bigint, decimals: number): string {
  const raw = (Number(value) / Math.pow(10, decimals)).toFixed(6)
  return parseFloat(raw).toString()
}

// ── Empty / Loading States ────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px' }}>No swaps found</p>
      <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', marginTop: '6px' }}>
        Your swap history will appear here once you execute a trade.
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 56,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}

// ── SwapRow ────────────────────────────────────────────────────────────────

function SwapRow({ swap }: { swap: SwapRecord }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr 1fr auto',
        gap: '12px',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
      }}
    >
      <div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{formatTimeAgo(swap.timestamp)}</p>
      </div>

      <div>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#34D399' }}>
          +{swap.tokenIn.amount} <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{swap.tokenIn.symbol}</span>
        </p>
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>In</p>
      </div>

      <div>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#EF4444' }}>
          -{swap.tokenOut.amount} <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{swap.tokenOut.symbol}</span>
        </p>
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>Out</p>
      </div>

      <a
        href={`${EXPLORER_BASE}/tx/${swap.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: '11px', fontFamily: 'monospace' }}
      >
        {truncate(swap.txHash, 4)}
        <ExternalLink size={10} />
      </a>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export function SwapHistoryPanel() {
  const { address } = useAccount()
  const [swaps, setSwaps] = useState<SwapRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSwaps = useCallback(async (offset = 0, append = false) => {
    if (!address) return
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      const records = await fetchSwapHistory(address, offset, PAGE_SIZE)
      if (append) {
        setSwaps(prev => [...prev, ...records])
      } else {
        setSwaps(records)
      }
      setHasMore(records.length === PAGE_SIZE)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load swap history')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [address])

  useEffect(() => {
    loadSwaps(0)
  }, [loadSwaps])

  if (!address) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
          {loading ? 'Loading…' : `${swaps.length} swap${swaps.length !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => loadSwaps(0)}
          style={{
            padding: '5px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px' }}>
          <p style={{ fontSize: '12px', color: '#EF4444' }}>{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Empty state */}
      {!loading && swaps.length === 0 && !error && <EmptyState />}

      {/* Swap list */}
      {!loading && swaps.length > 0 && (
        <div className="space-y-2">
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 1fr auto',
              gap: '12px',
              padding: '8px 16px',
            }}
          >
            {['Time', 'In', 'Out', 'Tx'].map((h, i) => (
              <p key={h} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)' }}>
                {h}
              </p>
            ))}
          </div>

          {swaps.map(swap => (
            <SwapRow key={swap.txHash} swap={swap} />
          ))}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => loadSwaps(swaps.length, true)}
              disabled={loadingMore}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  )
}
