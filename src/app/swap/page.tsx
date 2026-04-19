'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState, useMemo, startTransition } from 'react'
import { ArrowDownUp, ChevronDown, Droplets, Loader2, Plus, Wallet, X } from 'lucide-react'
import { useAccount, useBalance, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair, Route, Trade } from '@uniswap/v2-sdk'
import { encodeFunctionData, formatUnits, maxUint256, parseUnits, zeroAddress } from 'viem'
import { ToolHero } from '@/components/shared/ToolHero'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { SettlementPreview } from '@/components/shared/SettlementPreview'
import {
  ERC20_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V2_ROUTER_ABI,
} from '@/config/abis'
import {
  UNISWAP_V2_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_ADDRESS,
  WRAPPED_ZKLTC_ADDRESS,
  isValidContractAddress,
} from '@/config/contracts'
import { useAllTokenMetadata } from '@/hooks/useTokenMetadata'
import type { TokenCacheStatus } from '@/hooks/useTokenMetadata'
import { useRpcCallReadContract } from '@/hooks/useRpcCall'
import { useSearchParams } from 'next/navigation'

const ACCENT = '#E44FB5'
const NATIVE_GAS_RESERVE = parseUnits('0.01', 18)
const DEFAULT_DEADLINE_SECONDS = 20 * 60
const ZERO_ADDRESS = zeroAddress as `0x${string}`
const CHAIN_ID = 4441

// ── Pinned tokens shown at the top of every dropdown ────────────────────────
const PINNED_TOKENS: { address: `0x${string}`; symbol: string; name: string; isNative: boolean }[] = [
  { address: ZERO_ADDRESS, symbol: 'zkLTC', name: 'zkLTC', isNative: true },
  { address: WRAPPED_ZKLTC_ADDRESS, symbol: 'WZKLTC', name: 'Wrapped zkLTC', isNative: false },
  { address: '0xdaf8bdc2b197c2f0fab9d7359bdf482f8332b21f' as `0x${string}`, symbol: 'WETH', name: 'LL wEth', isNative: false },
  { address: '0x3bce48a3b30414176e796af997bb1ed5e1dc5b22' as `0x${string}`, symbol: 'WBTC', name: 'LL wBTC', isNative: false },
  { address: '0x4af16cfb61fe9a2c6d1452d85b25e7ca49748f16' as `0x${string}`, symbol: 'USDT', name: 'LL USDT', isNative: false },
  { address: '0x7f837d1b20c6ff20d8c6f396760c4f1f1f17babf' as `0x${string}`, symbol: 'USDC', name: 'LL USDC', isNative: false },
]

type TokenOption = {
  address: `0x${string}`
  name: string
  symbol: string
  isNative: boolean
}

type ResolvedToken = TokenOption & {
  decimals: number
}

const NATIVE_TOKEN: ResolvedToken = {
  address: ZERO_ADDRESS,
  name: 'zkLTC',
  symbol: 'zkLTC',
  decimals: 18,
  isNative: true,
}

function formatTokenAmount(value: bigint | null | undefined, decimals: number, fallback = '0') {
  if (value === null || value === undefined) return fallback
  const raw = formatUnits(value, decimals)
  const [whole, fraction = ''] = raw.split('.')
  if (!fraction) return whole
  return `${whole}.${fraction.slice(0, 6).replace(/0+$/, '') || '0'}`
}

function formatInputAmount(value: string) {
  if (!value) return ''
  const normalized = value.replace(/,/g, '')
  if (!/^\d*\.?\d*$/.test(normalized)) return ''
  return normalized
}

function buildSdkToken(token: ResolvedToken) {
  if (token.isNative) {
    return new Token(CHAIN_ID, WRAPPED_ZKLTC_ADDRESS, 18, 'wzkLTC', 'Wrapped zkLTC')
  }
  return new Token(CHAIN_ID, token.address, token.decimals, token.symbol, token.name)
}

// ── Slippage selector ───────────────────────────────────────────────────────
const SLIPPAGE_PRESETS = [10n, 50n, 100n] // 0.1%, 0.5%, 1.0%

function SlippageSelector({
  valueBps,
  onChange,
}: {
  valueBps: bigint
  onChange: (bps: bigint) => void
}) {
  const [customValue, setCustomValue] = useState('')
  const displayPct = Number(valueBps) / 100

  function handlePreset(bps: bigint) {
    onChange(bps)
    setCustomValue('')
  }

  function handleCustom(raw: string) {
    setCustomValue(raw)
    const num = parseFloat(raw)
    if (!isNaN(num) && num > 0 && num <= 50) {
      onChange(BigInt(Math.round(num * 100)))
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {([10n, 50n, 100n] as const).map((bps) => {
        const pct = Number(bps) / 100
        const active = valueBps === bps
        return (
          <button
            key={bps}
            onClick={() => handlePreset(bps)}
            className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
            style={{
              borderColor: active ? ACCENT : 'rgba(255,255,255,0.12)',
              background: active ? `${ACCENT}22` : 'rgba(255,255,255,0.04)',
              color: active ? '#fff' : 'rgba(255,255,255,0.6)',
            }}
          >
            {pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`}
          </button>
        )
      })}
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/4 px-2 py-1">
        <input
          value={customValue}
          onChange={(e) => handleCustom(e.target.value)}
          placeholder={displayPct % 1 === 0 ? `${displayPct.toFixed(0)}` : `${displayPct.toFixed(1)}`}
          type="number"
          min="0.01"
          max="50"
          step="0.1"
          className="w-12 bg-transparent text-right text-xs text-white outline-none placeholder:text-white/30"
        />
        <span className="text-xs text-white/45">%</span>
      </div>
      {Number(valueBps) > 500 && (
        <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-200">
          High slippage
        </span>
      )}
    </div>
  )
}

// ── Create pool panel ────────────────────────────────────────────────────────
function CreatePoolPanel({
  onClose,
  initialToken0,
  initialToken1,
}: {
  onClose: () => void
  initialToken0?: TokenOption | null
  initialToken1?: TokenOption | null
}) {
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { tokens: discoveredTokens } = useAllTokenMetadata()
  const [token0, setToken0] = useState<TokenOption | null>(initialToken0 ?? null)
  const [token1, setToken1] = useState<TokenOption | null>(initialToken1 ?? null)
  const [amount0, setAmount0] = useState('')
  const [amount1, setAmount1] = useState('')
  const [pickerMode, setPickerMode] = useState<'token0' | 'token1' | null>(null)
  const [creating, setCreating] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [txOpen, setTxOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()

  const tokenOptions: TokenOption[] = [
    NATIVE_TOKEN,
    ...discoveredTokens.map((t) => ({ address: t.address, name: t.name, symbol: t.symbol, isNative: false })),
  ]

  const { isLoading: isConfirming, isSuccess: txConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  })

  useEffect(() => {
    if (!txHash) return
    if (isConfirming) {
      setTxStatus('pending')
      setTxMessage('Creating pool transaction pending...')
    }
  }, [isConfirming, txHash])

  useEffect(() => {
    if (!txHash || !txConfirmed) return
    setTxStatus('success')
    setTxMessage('Pool created on LitVM.')
    setAmount0('')
    setAmount1('')
  }, [txConfirmed, txHash])

  useEffect(() => {
    if (!txHash || !txError) return
    setTxStatus('error')
    setTxMessage(txError.message.slice(0, 180))
  }, [txError, txHash])

  const canCreate =
    isConnected &&
    token0 !== null &&
    token1 !== null &&
    token0.address.toLowerCase() !== token1.address.toLowerCase() &&
    parseFloat(amount0) > 0 &&
    parseFloat(amount1) > 0

  async function handleCreate() {
    if (!canCreate || !address) return
    setCreating(true)
    try {
      setTxOpen(true)
      setTxStatus('pending')
      setTxMessage(undefined)

      const t0Decimals = token0!.isNative ? 18 : 18
      const t1Decimals = token1!.isNative ? 18 : 18
      const a0 = parseUnits(amount0, t0Decimals)
      const a1 = parseUnits(amount1, t1Decimals)

      const isToken0Native = token0!.isNative
      const isToken1Native = token1!.isNative
      const token0Addr = isToken0Native ? WRAPPED_ZKLTC_ADDRESS : token0!.address
      const token1Addr = isToken1Native ? WRAPPED_ZKLTC_ADDRESS : token1!.address
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS)

      let hash: `0x${string}`

      if (isToken0Native) {
        hash = await writeContractAsync({
          address: UNISWAP_V2_ROUTER_ADDRESS,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'addLiquidityETH',
          args: [token1Addr, a1, a1, 0n, address, deadline],
          value: a0,
        })
      } else if (isToken1Native) {
        hash = await writeContractAsync({
          address: UNISWAP_V2_ROUTER_ADDRESS,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'addLiquidityETH',
          args: [token0Addr, a0, a0, 0n, address, deadline],
          value: a1,
        })
      } else {
        // Both ERC20 — ensure tokenA < tokenB (factory requirement)
        const [tokenA, tokenB, amountA, amountB] = token0Addr.toLowerCase() < token1Addr.toLowerCase()
          ? [token0Addr, token1Addr, a0, a1] as const
          : [token1Addr, token0Addr, a1, a0] as const
        hash = await writeContractAsync({
          address: UNISWAP_V2_ROUTER_ADDRESS,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'addLiquidity',
          args: [tokenA, tokenB, amountA, amountB, 0n, 0n, address, deadline],
        })
      }
      setTxHash(hash)
    } catch (err) {
      setTxStatus('error')
      setTxMessage(err instanceof Error ? err.message.slice(0, 180) : 'Pool creation failed.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Create Pool</h2>
        <button
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-white/55 transition hover:border-white/20 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {!isConnected && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6 text-center">
          <p className="text-sm text-white/55">Connect your wallet to create a pool.</p>
        </div>
      )}

      {isConnected && (
        <>
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-white/35">Token 1</p>
              <div className="flex gap-2">
                <input
                  value={amount0}
                  onChange={(e) => setAmount0(formatInputAmount(e.target.value))}
                  placeholder="0.0"
                  type="text"
                  inputMode="decimal"
                  className="flex-1 bg-transparent text-lg font-semibold text-white outline-none placeholder:text-white/20"
                />
                <button
                  onClick={() => setPickerMode('token0')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white"
                >
                  {token0?.symbol ?? 'Select'}
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Plus size={14} className="text-white/55" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-white/35">Token 2</p>
              <div className="flex gap-2">
                <input
                  value={amount1}
                  onChange={(e) => setAmount1(formatInputAmount(e.target.value))}
                  placeholder="0.0"
                  type="text"
                  inputMode="decimal"
                  className="flex-1 bg-transparent text-lg font-semibold text-white outline-none placeholder:text-white/20"
                />
                <button
                  onClick={() => setPickerMode('token1')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white"
                >
                  {token1?.symbol ?? 'Select'}
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>
          </div>

          {token0 && token1 && token0.address.toLowerCase() === token1.address.toLowerCase() && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              Cannot create a pool with the same token.
            </p>
          )}

          <button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            className="flex w-full items-center justify-center gap-2 rounded-[18px] px-5 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)`,
              boxShadow: '0 16px 40px rgba(228,79,181,0.28)',
            }}
          >
            {creating || isConfirming ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span>{creating ? 'Creating pool…' : 'Create Pool'}</span>
          </button>
        </>
      )}

      <TxStatusModal
        isOpen={txOpen}
        onClose={() => setTxOpen(false)}
        status={txStatus}
        txHash={txHash}
        message={txMessage}
      />

      <TokenPicker
        open={pickerMode !== null}
        currentToken={pickerMode === 'token0' ? token0 : token1}
        onClose={() => setPickerMode(null)}
        onSelect={(token) => {
          if (pickerMode === 'token0') {
            setToken0(token)
            if (token1 && token1.address.toLowerCase() === token.address.toLowerCase()) {
              setToken1(token0)
            }
          } else if (pickerMode === 'token1') {
            setToken1(token)
            if (token0 && token0.address.toLowerCase() === token.address.toLowerCase()) {
              setToken0(token1)
            }
          }
          setPickerMode(null)
        }}
        tokens={tokenOptions}
      />
    </div>
  )
}

// ── Token picker ────────────────────────────────────────────────────────────
const ROW_HEIGHT = 76
const OVERSCAN = 5

function TokenPicker({
  open,
  currentToken,
  onClose,
  onSelect,
  tokens,
}: {
  open: boolean
  currentToken: TokenOption | null
  onClose: () => void
  onSelect: (token: TokenOption) => void
  tokens: TokenOption[]
}) {
  const [search, setSearch] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 })
  const scrollRef = useRef<HTMLDivElement>(null)

  // 300ms debounce on search input
  useEffect(() => {
    if (!open) return
    setIsSearching(true)
    const timer = setTimeout(() => {
      setDebouncedQuery(search)
      setIsSearching(false)
      // Reset scroll and visible range when query changes
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0
      }
      setVisibleRange({ start: 0, end: 20 })
    }, 300)
    return () => clearTimeout(timer)
  }, [search, open])

  // Scroll handler — calculates visible window
  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const scrollTop = el.scrollTop
    const viewportH = el.clientHeight
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const end = Math.min(totalNonPinnedCount, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN)
    setVisibleRange({ start, end })
  }

  if (!open) return null

  const query = debouncedQuery.trim().toLowerCase()

  // Separate pinned vs. all tokens for filtering
  const pinnedSet = new Set(
    PINNED_TOKENS.map((p) => p.address.toLowerCase()),
  )

  const pinnedInList = query
    ? []
    : PINNED_TOKENS.filter((pt) =>
        tokens.some((t) => t.address.toLowerCase() === pt.address.toLowerCase()),
      )

  const allFiltered = tokens.filter((token) => {
    if (pinnedSet.has(token.address.toLowerCase()) && !query) return false
    if (!query) return true
    return (
      token.name.toLowerCase().includes(query) ||
      token.symbol.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    )
  })

  const totalNonPinnedCount = allFiltered.length

  const visibleTokens = allFiltered.slice(visibleRange.start, visibleRange.end)
  const topSpacerH = visibleRange.start * ROW_HEIGHT
  const bottomSpacerH = Math.max(0, (totalNonPinnedCount - visibleRange.end) * ROW_HEIGHT)

  function renderTokenRow(token: TokenOption) {
    const isSelected = currentToken?.address.toLowerCase() === token.address.toLowerCase()
    return (
      <button
        key={token.address}
        onClick={() => {
          startTransition(() => {
            onSelect(token)
            onClose()
          })
        }}
        className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition"
        style={{
          borderColor: isSelected ? `${ACCENT}55` : 'rgba(255,255,255,0.08)',
          background: isSelected ? 'rgba(228,79,181,0.08)' : 'rgba(255,255,255,0.03)',
          height: ROW_HEIGHT,
        }}
      >
        <div>
          <p className="font-medium text-white">{token.symbol}</p>
          <p className="text-sm text-white/45">{token.name}</p>
        </div>
        <div className="text-right">
          {token.isNative ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-[0.12em] text-white/45">Native</span>
          ) : (
            <p className="font-mono text-xs text-white/35">{`${token.address.slice(0, 6)}…${token.address.slice(-4)}`}</p>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0d0a16] p-6 shadow-2xl shadow-black/50">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Select a token</h2>
            <p className="text-sm text-white/45">Direct Lester Labs V2 pairs on LitVM.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/55 transition hover:border-white/20 hover:text-white"
            aria-label="Close token picker"
          >
            <X size={16} />
          </button>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, symbol, or address"
          className="cin-input mb-4"
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[380px] space-y-2 overflow-y-auto pr-1"
        >
          {/* Pinned tokens — always rendered, not virtualised */}
          {!query && pinnedInList.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-xs uppercase tracking-[0.12em] text-white/35">Pinned Assets</p>
              <div className="mb-3 space-y-1">
                {pinnedInList.map((token) => {
                  const isSelected = currentToken?.address.toLowerCase() === token.address.toLowerCase()
                  return (
                    <button
                      key={token.address}
                      onClick={() => {
                        startTransition(() => {
                          onSelect(token)
                          onClose()
                        })
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition"
                      style={{
                        borderColor: isSelected ? `${ACCENT}55` : 'rgba(255,255,255,0.12)',
                        background: isSelected ? 'rgba(228,79,181,0.1)' : 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <div>
                        <p className="font-semibold text-white">{token.symbol}</p>
                        <p className="text-sm text-white/45">{token.name}</p>
                      </div>
                      {token.isNative && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/45">Native</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="mb-2 h-px bg-white/8" />
            </div>
          )}

          {/* Search results header */}
          {query && (
            <p className="mb-2 px-1 text-xs uppercase tracking-[0.12em] text-white/35">
              {isSearching ? 'Searching…' : `${totalNonPinnedCount} result${totalNonPinnedCount !== 1 ? 's' : ''}`}
            </p>
          )}

          {/* Virtualised non-pinned token list */}
          {totalNonPinnedCount > 0 && (
            <div>
              {topSpacerH > 0 && <div style={{ height: topSpacerH }} />}
              {visibleTokens.map(renderTokenRow)}
              {bottomSpacerH > 0 && <div style={{ height: bottomSpacerH }} />}
            </div>
          )}

          {totalNonPinnedCount === 0 && !isSearching && (
            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-8 text-center text-sm text-white/45">
              No matching tokens found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TokenButton({
  label,
  token,
  onClick,
}: {
  label: string
  token: TokenOption | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
    >
      <span className="text-white/45">{label}</span>
      <span>{token?.symbol ?? 'Select'}</span>
      <ChevronDown size={14} className="text-white/45" />
    </button>
  )
}

// ── Main swap page (inner — uses useSearchParams) ────────────────────────────
function SwapPageInner() {
  const searchParams = useSearchParams()
  const { address, isConnected } = useAccount()
  const { tokens: discoveredTokens, loading: tokensLoading, cacheStatus } = useAllTokenMetadata()
  const { writeContractAsync } = useWriteContract()

  // Restore swap card state from sessionStorage (URL params override on first load)
  const [savedState] = useState<{
    inputToken: TokenOption
    outputToken: TokenOption | null
    amountIn: string
    slippageBps: bigint
  }>(() => {
    try {
      const raw = sessionStorage.getItem('lester_swap_v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          inputToken: parsed.inputToken ?? NATIVE_TOKEN,
          outputToken: parsed.outputToken ?? null,
          amountIn: parsed.amountIn ?? '',
          slippageBps: parsed.slippageBps ? BigInt(parsed.slippageBps) : 50n,
        }
      }
    } catch {
      // ignore corrupt sessionStorage
    }
    return { inputToken: NATIVE_TOKEN, outputToken: null, amountIn: '', slippageBps: 50n }
  })

  const [inputToken, setInputToken] = useState<TokenOption>(savedState.inputToken)
  const [outputToken, setOutputToken] = useState<TokenOption | null>(savedState.outputToken)
  const [amountIn, setAmountIn] = useState(savedState.amountIn)
  const [pickerMode, setPickerMode] = useState<'input' | 'output' | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [txOpen, setTxOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [txAction, setTxAction] = useState<'approve' | 'swap' | null>(null)
  const [slippageBps, setSlippageBps] = useState<bigint>(savedState.slippageBps)
  const [showCreatePool, setShowCreatePool] = useState(false)
  const [addLiqToken0, setAddLiqToken0] = useState<TokenOption | null>(null)
  const [addLiqToken1, setAddLiqToken1] = useState<TokenOption | null>(null)
  const [showSettlementPreview, setShowSettlementPreview] = useState(false)
  const [settlementConfirming, setSettlementConfirming] = useState(false)

  // Initialise create pool panel from URL param — also resolves token addresses to TokenOption objects
  useEffect(() => {
    if (!searchParams.get('createPool') && !searchParams.get('addLiquidity')) return
    setShowCreatePool(true)

    const token0Addr = searchParams.get('token0')?.toLowerCase()
    const token1Addr = searchParams.get('token1')?.toLowerCase()

    if (token0Addr) {
      if (token0Addr === ZERO_ADDRESS.toLowerCase()) {
        setAddLiqToken0(NATIVE_TOKEN)
      } else {
        const found = discoveredTokens.find((t) => t.address.toLowerCase() === token0Addr)
        if (found) {
          setAddLiqToken0({ address: found.address, name: found.name, symbol: found.symbol, isNative: false })
        }
      }
    }

    if (token1Addr) {
      if (token1Addr === ZERO_ADDRESS.toLowerCase()) {
        setAddLiqToken1(NATIVE_TOKEN)
      } else {
        const found = discoveredTokens.find((t) => t.address.toLowerCase() === token1Addr)
        if (found) {
          setAddLiqToken1({ address: found.address, name: found.name, symbol: found.symbol, isNative: false })
        }
      }
    }
  }, [searchParams, discoveredTokens])

  // Persist swap card state to sessionStorage (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          'lester_swap_v1',
          JSON.stringify({
            inputToken,
            outputToken,
            amountIn,
            slippageBps: slippageBps.toString(),
          }),
        )
      } catch {
        // ignore quota errors
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [inputToken, outputToken, amountIn, slippageBps])

  const isDexConfigured =
    isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS) &&
    isValidContractAddress(UNISWAP_V2_ROUTER_ADDRESS) &&
    isValidContractAddress(WRAPPED_ZKLTC_ADDRESS)

  useEffect(() => {
    if (outputToken || discoveredTokens.length === 0) return
    const firstToken = discoveredTokens[0]
    setOutputToken({ address: firstToken.address, name: firstToken.name, symbol: firstToken.symbol, isNative: false })
  }, [discoveredTokens, outputToken])

  const tokenOptions: TokenOption[] = [
    NATIVE_TOKEN,
    ...discoveredTokens.map((token) => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      isNative: false,
    })),
  ]

  const inputNameRead = useReadContract({
    address: !inputToken.isNative ? inputToken.address : undefined,
    abi: ERC20_ABI,
    functionName: 'name',
    query: { enabled: !inputToken.isNative },
  })
  const inputSymbolRead = useReadContract({
    address: !inputToken.isNative ? inputToken.address : undefined,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: !inputToken.isNative },
  })
  const inputDecimalsRead = useReadContract({
    address: !inputToken.isNative ? inputToken.address : undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !inputToken.isNative },
  })

  const outputNameRead = useReadContract({
    address: outputToken && !outputToken.isNative ? outputToken.address : undefined,
    abi: ERC20_ABI,
    functionName: 'name',
    query: { enabled: Boolean(outputToken && !outputToken.isNative) },
  })
  const outputSymbolRead = useReadContract({
    address: outputToken && !outputToken.isNative ? outputToken.address : undefined,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled: Boolean(outputToken && !outputToken.isNative) },
  })
  const outputDecimalsRead = useReadContract({
    address: outputToken && !outputToken.isNative ? outputToken.address : undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: Boolean(outputToken && !outputToken.isNative) },
  })

  const resolvedInput: ResolvedToken = inputToken.isNative
    ? NATIVE_TOKEN
    : {
        ...inputToken,
        name: typeof inputNameRead.data === 'string' ? inputNameRead.data : inputToken.name,
        symbol: typeof inputSymbolRead.data === 'string' ? inputSymbolRead.data : inputToken.symbol,
        decimals: Number(inputDecimalsRead.data ?? 18),
      }

  const resolvedOutput: ResolvedToken | null =
    outputToken === null
      ? null
      : outputToken.isNative
        ? NATIVE_TOKEN
        : {
            ...outputToken,
            name: typeof outputNameRead.data === 'string' ? outputNameRead.data : outputToken.name,
            symbol: typeof outputSymbolRead.data === 'string' ? outputSymbolRead.data : outputToken.symbol,
            decimals: Number(outputDecimalsRead.data ?? 18),
          }

  const normalizedAmountIn = formatInputAmount(amountIn)
  let parsedAmountIn: bigint | null = null
  if (normalizedAmountIn && resolvedInput.decimals >= 0) {
    try {
      parsedAmountIn = parseUnits(normalizedAmountIn, resolvedInput.decimals)
    } catch {
      parsedAmountIn = null
    }
  }

  const wrappedInputAddress = resolvedInput.isNative ? WRAPPED_ZKLTC_ADDRESS : resolvedInput.address
  const wrappedOutputAddress = resolvedOutput
    ? resolvedOutput.isNative
      ? WRAPPED_ZKLTC_ADDRESS
      : resolvedOutput.address
    : ZERO_ADDRESS

  const pairLookupEnabled =
    isDexConfigured &&
    resolvedOutput !== null &&
    wrappedInputAddress.toLowerCase() !== wrappedOutputAddress.toLowerCase()

  const pairAddressRead = useRpcCallReadContract({
    address: UNISWAP_V2_FACTORY_ADDRESS,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'getPair',
    args: pairLookupEnabled ? [wrappedInputAddress, wrappedOutputAddress] : undefined,
    query: { enabled: pairLookupEnabled },
  })

  const pairAddress = ((pairAddressRead as unknown as { data?: `0x${string}` }).data ?? ZERO_ADDRESS) as `0x${string}`
  const pairExists = isValidContractAddress(pairAddress)

  const quoteRead = useRpcCallReadContract({
    address: UNISWAP_V2_ROUTER_ADDRESS,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: 'getAmountsOut',
    args:
      pairExists && resolvedOutput && parsedAmountIn !== null
        ? [parsedAmountIn, [wrappedInputAddress, wrappedOutputAddress]]
        : undefined,
    query: { enabled: pairExists && resolvedOutput !== null && parsedAmountIn !== null },
  })

  const pairState = useReadContracts({
    contracts: pairExists
      ? [
          { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token0' },
          { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token1' },
          { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves' },
        ]
      : [],
    query: { enabled: pairExists },
  })

  const nativeBalance = useBalance({ address })
  const inputTokenBalanceRead = useReadContract({
    address: !resolvedInput.isNative ? resolvedInput.address : undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && !resolvedInput.isNative) },
  })

  const allowanceRead = useReadContract({
    address: !resolvedInput.isNative ? resolvedInput.address : undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, UNISWAP_V2_ROUTER_ADDRESS] : undefined,
    query: { enabled: Boolean(address && !resolvedInput.isNative && isDexConfigured) },
  })

  const quoteAmounts: readonly bigint[] | null = Array.isArray((quoteRead as unknown as { data?: readonly bigint[] }).data) ? (quoteRead as unknown as { data?: readonly bigint[] }).data ?? null : null
  const quotedAmountOut = quoteAmounts && quoteAmounts.length > 1 ? quoteAmounts[quoteAmounts.length - 1] : null
  const quotedAmountOutText =
    resolvedOutput && quotedAmountOut !== null
      ? formatTokenAmount(quotedAmountOut, resolvedOutput.decimals, '')
      : ''

  const pairToken0 = pairState.data?.[0]?.status === 'success' ? (pairState.data[0].result as `0x${string}`) : null
  const pairToken1 = pairState.data?.[1]?.status === 'success' ? (pairState.data[1].result as `0x${string}`) : null
  const pairReserves =
    pairState.data?.[2]?.status === 'success'
      ? (pairState.data[2].result as readonly [bigint, bigint, number])
      : null

  let priceImpactText = '-'
  let executionPriceText = '-'

  if (
    pairReserves &&
    pairToken0 &&
    pairToken1 &&
    parsedAmountIn !== null &&
    resolvedOutput &&
    wrappedInputAddress.toLowerCase() !== wrappedOutputAddress.toLowerCase()
  ) {
    try {
      const inputSdkToken = buildSdkToken(resolvedInput)
      const outputSdkToken = buildSdkToken(resolvedOutput)
      const reserve0Token =
        pairToken0.toLowerCase() === inputSdkToken.address.toLowerCase() ? inputSdkToken : outputSdkToken
      const reserve1Token =
        pairToken1.toLowerCase() === inputSdkToken.address.toLowerCase() ? inputSdkToken : outputSdkToken
      const pair = new Pair(
        CurrencyAmount.fromRawAmount(reserve0Token, pairReserves[0].toString()),
        CurrencyAmount.fromRawAmount(reserve1Token, pairReserves[1].toString()),
      )
      const route = new Route([pair], inputSdkToken, outputSdkToken)
      const trade = Trade.exactIn(route, CurrencyAmount.fromRawAmount(inputSdkToken, parsedAmountIn.toString()))
      priceImpactText = `${trade.priceImpact.toFixed(2)}%`
      executionPriceText = trade.executionPrice.toSignificant(6)
    } catch {
      priceImpactText = '-'
      executionPriceText = '-'
    }
  }

  const allowance = (allowanceRead.data ?? 0n) as bigint
  const needsApproval = !resolvedInput.isNative && parsedAmountIn !== null && allowance < parsedAmountIn
  const inputBalance =
    resolvedInput.isNative
      ? nativeBalance.data?.value ?? 0n
      : ((inputTokenBalanceRead.data ?? 0n) as bigint)

  // Use user-selected slippage (default 0.5%)
  const minimumAmountOut =
    quotedAmountOut === null ? null : (quotedAmountOut * (10_000n - slippageBps)) / 10_000n

  const { isLoading: isConfirming, isSuccess: txConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  })

  useEffect(() => {
    if (!txHash) return
    if (isConfirming) {
      setTxStatus('pending')
      setTxMessage(txAction === 'approve' ? 'Approval transaction pending...' : 'Swap transaction pending...')
    }
  }, [isConfirming, txAction, txHash])

  useEffect(() => {
    if (!txHash || !txConfirmed) return
    setTxStatus('success')
    setTxMessage(txAction === 'approve' ? 'Approval confirmed.' : 'Swap confirmed on LitVM.')
    if (txAction === 'swap') setAmountIn('')
    if (txAction === 'approve') allowanceRead.refetch()
  }, [txAction, txConfirmed, txHash])

  useEffect(() => {
    if (!txHash || !txError) return
    setTxStatus('error')
    setTxMessage(txError.message.slice(0, 180))
  }, [txError, txHash])

  async function handleSwapClick() {
    // Show settlement preview before any wallet interaction
    setShowSettlementPreview(true)
  }

  async function handleSettlementConfirm() {
    setSettlementConfirming(true)
    setShowSettlementPreview(false)
    await handlePrimaryAction()
    setSettlementConfirming(false)
  }

  // Build callData for the settlement preview
  function buildSwapCallData(): { fn: string; data: string; target: string } {
    if (resolvedOutput === null) return { fn: '', data: '0x', target: UNISWAP_V2_ROUTER_ADDRESS }
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS)
    const path = [wrappedInputAddress, wrappedOutputAddress] as `0x${string}`[]
    if (resolvedInput.isNative) {
      return {
        fn: 'swapExactETHForTokens',
        target: UNISWAP_V2_ROUTER_ADDRESS,
        data: encodeFunctionData({
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [minimumAmountOut!, path, address!, deadline],
        }),
      }
    }
    if (resolvedOutput.isNative) {
      return {
        fn: 'swapExactTokensForETH',
        target: UNISWAP_V2_ROUTER_ADDRESS,
        data: encodeFunctionData({
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [parsedAmountIn!, minimumAmountOut!, path, address!, deadline],
        }),
      }
    }
    return {
      fn: 'swapExactTokensForTokens',
      target: UNISWAP_V2_ROUTER_ADDRESS,
      data: encodeFunctionData({
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [parsedAmountIn!, minimumAmountOut!, path, address!, deadline],
      }),
    }
  }

  async function handlePrimaryAction() {
    if (!isConnected || !address || !resolvedOutput || parsedAmountIn === null || !isDexConfigured) return
    if (wrappedInputAddress.toLowerCase() === wrappedOutputAddress.toLowerCase()) return
    if (!pairExists || minimumAmountOut === null) return

    try {
      setTxOpen(true)
      setTxStatus('pending')
      setTxMessage(undefined)

      if (needsApproval) {
        setTxAction('approve')
        const hash = await writeContractAsync({
          address: resolvedInput.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [UNISWAP_V2_ROUTER_ADDRESS, maxUint256],
        })
        setTxHash(hash)
        return
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS)
      const path = [wrappedInputAddress, wrappedOutputAddress] as `0x${string}`[]
      setTxAction('swap')

      if (resolvedInput.isNative) {
        const hash = await writeContractAsync({
          address: UNISWAP_V2_ROUTER_ADDRESS,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [minimumAmountOut, path, address, deadline],
          value: parsedAmountIn,
        })
        setTxHash(hash)
        return
      }

      if (resolvedOutput.isNative) {
        const hash = await writeContractAsync({
          address: UNISWAP_V2_ROUTER_ADDRESS,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [parsedAmountIn, minimumAmountOut, path, address, deadline],
        })
        setTxHash(hash)
        return
      }

      const hash = await writeContractAsync({
        address: UNISWAP_V2_ROUTER_ADDRESS,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [parsedAmountIn, minimumAmountOut, path, address, deadline],
      })
      setTxHash(hash)
    } catch (error) {
      setTxStatus('error')
      setTxMessage(error instanceof Error ? error.message.slice(0, 180) : 'Transaction failed.')
    }
  }

  function setMaxBalance() {
    const rawBalance = resolvedInput.isNative ? nativeBalance.data?.value ?? 0n : inputBalance
    const sourceBalance = resolvedInput.isNative && rawBalance > NATIVE_GAS_RESERVE
      ? rawBalance - NATIVE_GAS_RESERVE
      : rawBalance
    setAmountIn(formatTokenAmount(sourceBalance, resolvedInput.decimals, '0'))
  }

  function flipPair() {
    if (!outputToken) return
    const nextInput = outputToken
    const nextOutput = inputToken
    setInputToken(nextInput)
    setOutputToken(nextOutput)
  }

  const primaryButtonText = !isConnected
    ? 'Connect wallet to swap'
    : resolvedOutput === null
      ? 'Select an output token'
      : wrappedInputAddress.toLowerCase() === wrappedOutputAddress.toLowerCase()
        ? 'Choose another pair'
        : normalizedAmountIn.length === 0
          ? 'Enter an amount'
          : parsedAmountIn === null || parsedAmountIn <= 0n
            ? 'Invalid amount'
            : parsedAmountIn > inputBalance
              ? 'Insufficient balance'
              : !pairExists
                ? 'Pool not found'
                : needsApproval
                  ? `Approve ${resolvedInput.symbol}`
                  : 'Swap'

  const primaryButtonDisabled =
    !isConnected ||
    resolvedOutput === null ||
    normalizedAmountIn.length === 0 ||
    parsedAmountIn === null ||
    parsedAmountIn <= 0n ||
    parsedAmountIn > inputBalance ||
    !pairExists ||
    wrappedInputAddress.toLowerCase() === wrappedOutputAddress.toLowerCase()

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <ToolHero
        category="Dex"
        title="Lester"
        titleHighlight="Swap"
        subtitle="Direct token swaps on Lester Labs' Uniswap V2 fork for LitVM. Quotes come from the live router."
        color={ACCENT}
        image="/images/carousel/swap.png"
        imagePosition="center 46%"
        compact
        stats={[
          { label: 'Network', value: 'LitVM · 4441' },
          { label: 'Swap Fee', value: '0.30%' },
        ]}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {!isDexConfigured && (
          <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
            Configure factory and router addresses before using the swap page.
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-4">
            {/* Tab bar: Swap / Create Pool */}
            <div className="analytics-card flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              <button
                onClick={() => setShowCreatePool(false)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                style={{
                  background: !showCreatePool ? `linear-gradient(135deg, ${ACCENT}, #b43684)` : 'transparent',
                  color: !showCreatePool ? '#fff' : 'rgba(255,255,255,0.55)',
                  boxShadow: !showCreatePool ? '0 4px 16px rgba(228,79,181,0.3)' : 'none',
                }}
              >
                Swap
              </button>
              <button
                onClick={() => setShowCreatePool(true)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                style={{
                  background: showCreatePool ? `linear-gradient(135deg, ${ACCENT}, #b43684)` : 'transparent',
                  color: showCreatePool ? '#fff' : 'rgba(255,255,255,0.55)',
                  boxShadow: showCreatePool ? '0 4px 16px rgba(228,79,181,0.3)' : 'none',
                }}
              >
                Create Pool
              </button>
            </div>

            {/* Create pool panel */}
            {showCreatePool && (
              <div className="analytics-card rounded-[30px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/30">
                {addLiqToken0 !== null && addLiqToken1 !== null ? (
                  <CreatePoolPanel
                    key={`cp-${addLiqToken0.address}-${addLiqToken1.address}`}
                    onClose={() => setShowCreatePool(false)}
                    initialToken0={addLiqToken0}
                    initialToken1={addLiqToken1}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.03] p-8 text-center">
                    <Loader2 size={24} className="animate-spin text-white/40" />
                    <p className="mt-3 text-sm text-white/45">Loading pool tokens…</p>
                  </div>
                )}
              </div>
            )}

            {/* Swap card */}
            {!showCreatePool && (
              <div className="analytics-card rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/30 sm:p-6">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold text-white">Swap</h1>
                    <p className="mt-1 text-sm text-white/45">Direct pairs from the Lester Labs factory.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SlippageSelector valueBps={slippageBps} onChange={setSlippageBps} />
                    <Link
                      href="/pool"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65 transition hover:border-white/20 hover:text-white"
                    >
                      <Droplets size={14} />
                      Pool
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="analytics-card rounded-[26px] border border-white/8 bg-[#120f1d] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.14em] text-white/35">You pay</span>
                      <TokenButton label="From" token={inputToken} onClick={() => setPickerMode('input')} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div>
                        <input
                          value={amountIn}
                          onChange={(event) => setAmountIn(formatInputAmount(event.target.value))}
                          placeholder="0.0"
                          inputMode="decimal"
                          className="w-full border-none bg-transparent px-0 text-[2rem] font-semibold text-white outline-none placeholder:text-white/20"
                        />
                        <p className="mt-2 text-sm text-white/40">
                          Balance: {formatTokenAmount(inputBalance, resolvedInput.decimals)} {resolvedInput.symbol}
                        </p>
                      </div>
                      <button
                        onClick={setMaxBalance}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/70 transition hover:border-white/20 hover:text-white"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={flipPair}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:text-white"
                      aria-label="Flip swap direction"
                    >
                      <ArrowDownUp size={18} />
                    </button>
                  </div>

                  <div className="analytics-card rounded-[26px] border border-white/8 bg-[#120f1d] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.14em] text-white/35">You receive</span>
                      <TokenButton label="To" token={outputToken} onClick={() => setPickerMode('output')} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div>
                        <div className="text-[2rem] font-semibold text-white">
                          {quotedAmountOutText || '0.0'}
                        </div>
                        <p className="mt-2 text-sm text-white/40">Live Quote</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.12em] text-white/50">
                        Direct route
                      </div>
                    </div>
                  </div>
                </div>

                {/* RPC rate-limit warning banner */}
                {(pairAddressRead.rpcState.error || quoteRead.rpcState.error) && (
                  <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    <span>
                      {pairAddressRead.rpcState.error === 'rate_limited' || quoteRead.rpcState.error === 'rate_limited'
                        ? 'RPC rate limited — retrying…'
                        : pairAddressRead.rpcState.error === 'network' || quoteRead.rpcState.error === 'network'
                          ? 'Network error — check your connection.'
                          : 'RPC error — retrying…'}
                    </span>
                  </div>
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="analytics-card rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/35">Price</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {resolvedOutput ? `1 ${resolvedInput.symbol} = ${executionPriceText} ${resolvedOutput.symbol}` : '-'}
                    </p>
                  </div>
                  <div className="analytics-card rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/35">Price impact</p>
                    <p className="mt-2 text-lg font-semibold text-white">{priceImpactText}</p>
                  </div>
                  <div className="analytics-card rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/35">Slippage</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {Number(slippageBps) / 100}% min. receive
                    </p>
                  </div>
                  <div className="analytics-card rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/35">Liquidity</p>
                    <p className="mt-2 text-lg font-semibold text-white">{pairExists ? 'Pool available' : 'No direct pool'}</p>
                  </div>
                </div>

                <button
                  onClick={handleSwapClick}
                  disabled={primaryButtonDisabled || isConfirming || settlementConfirming}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-[18px] px-5 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)`,
                    boxShadow: '0 16px 40px rgba(228,79,181,0.28)',
                  }}
                >
                  {isConfirming ? <Loader2 size={18} className="animate-spin" /> : <ArrowDownUp size={18} />}
                  <span>{primaryButtonText}</span>
                </button>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="analytics-card rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-white/35">Token discovery</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Factory-backed list</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Tokens are pulled from Lester Labs token factory events on LitVM, so the swap page stays local to the platform rather than depending on an external list.
              </p>
              <div className="mt-4 rounded-2xl border border-white/8 bg-[#120f1d] p-4 text-sm text-white/55">
                {tokensLoading && cacheStatus === 'scanning' && (
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: ACCENT }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                    </span>
                    Scanning chain…
                  </span>
                )}
                {tokensLoading && cacheStatus === 'refreshing' && (
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: ACCENT }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                    </span>
                    Refreshing from chain…
                  </span>
                )}
                {!tokensLoading && cacheStatus === 'cached' && (
                  <span>Loaded from cache · {tokenOptions.length} tokens</span>
                )}
                {!tokensLoading && cacheStatus === 'idle' && (
                  <span>{tokenOptions.length} swappable assets detected, including native zkLTC.</span>
                )}
              </div>
            </div>

            <div className="analytics-card rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-white/35">Getting started</p>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Connect your wallet, select a token pair, and swap. Add liquidity on the Pool page to earn from trades.
              </p>
            </div>

            {!isConnected && (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
                <ConnectWalletPrompt />
              </div>
            )}

            {isConnected && (
              <div className="analytics-card rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Connected wallet</p>
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/8 bg-[#120f1d] p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Wallet size={18} className="text-white/70" />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-white">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '-'}</p>
                    <p className="text-sm text-white/45">{formatTokenAmount(nativeBalance.data?.value ?? 0n, 18)} zkLTC</p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <TokenPicker
        open={pickerMode !== null}
        currentToken={pickerMode === 'input' ? inputToken : outputToken}
        onClose={() => setPickerMode(null)}
        onSelect={(token) => {
          if (pickerMode === 'input') {
            setInputToken(token)
            if (outputToken && outputToken.address.toLowerCase() === token.address.toLowerCase()) {
              setOutputToken(inputToken)
            }
            return
          }
          setOutputToken(token)
          if (token.address.toLowerCase() === inputToken.address.toLowerCase()) {
            setInputToken(outputToken ?? NATIVE_TOKEN)
          }
        }}
        tokens={tokenOptions}
      />

      <TxStatusModal
        isOpen={txOpen}
        onClose={() => setTxOpen(false)}
        status={txStatus}
        txHash={txHash}
        message={txMessage}
      />

      {(() => {
        if (!showSettlementPreview || parsedAmountIn === null || minimumAmountOut === null || resolvedOutput === null) return null
        const { fn, data, target } = buildSwapCallData()
        return (
          <SettlementPreview
            isOpen={showSettlementPreview}
            onClose={() => setShowSettlementPreview(false)}
            onConfirm={handleSettlementConfirm}
            confirming={settlementConfirming}
            inputSymbol={resolvedInput.symbol}
            inputAmount={normalizedAmountIn || '0'}
            inputAmountRaw={parsedAmountIn.toString()}
            outputSymbol={resolvedOutput.symbol}
            outputAmount={formatTokenAmount(minimumAmountOut, resolvedOutput.decimals)}
            outputAmountRaw={minimumAmountOut.toString()}
            priceImpact={priceImpactText}
            pairAddress={pairAddress}
            route="Direct pair"
            estimatedGas="≈ gas"
            callData={data}
            targetContract={target}
            functionName={fn}
          />
        )
      })()}
    </div>
  )
}

// ── Wrap in Suspense for useSearchParams (Next.js 16 requirement) ───────────
export default function SwapPage() {
  return (
    <Suspense>
      <SwapPageInner />
    </Suspense>
  )
}

