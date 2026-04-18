'use client'

import Link from 'next/link'
import { useEffect, useDeferredValue, useState, startTransition } from 'react'
import { ArrowDownUp, ChevronDown, Droplets, Loader2, Settings2, ShieldCheck, Wallet, X } from 'lucide-react'
import { useAccount, useBalance, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { Pair, Route, Trade } from '@uniswap/v2-sdk'
import { formatUnits, maxUint256, parseUnits, zeroAddress } from 'viem'
import { ToolHero } from '@/components/shared/ToolHero'
import { TxStatusModal } from '@/components/shared/TxStatusModal'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import {
  ERC20_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V2_ROUTER_ABI,
} from '@/config/abis'
import {
  LESTER_TREASURY_ADDRESS,
  UNISWAP_V2_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_ADDRESS,
  WRAPPED_ZKLTC_ADDRESS,
  isValidContractAddress,
} from '@/config/contracts'
import { useAllTokenMetadata } from '@/hooks/useTokenMetadata'

const ACCENT = '#E44FB5'
const DEFAULT_SLIPPAGE_BPS = 50n
const NATIVE_GAS_RESERVE = parseUnits('0.01', 18) // 0.01 zkLTC gas buffer for native swaps
const DEFAULT_DEADLINE_SECONDS = 20 * 60
const ZERO_ADDRESS = zeroAddress as `0x${string}`
const CHAIN_ID = 4441

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
  const deferredSearch = useDeferredValue(search)

  if (!open) return null

  const query = deferredSearch.trim().toLowerCase()
  const filteredTokens = tokens.filter((token) => {
    if (!query) return true
    return (
      token.name.toLowerCase().includes(query) ||
      token.symbol.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    )
  })

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

        <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
          {filteredTokens.map((token) => {
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
                }}
              >
                <div>
                  <p className="font-medium text-white">{token.symbol}</p>
                  <p className="text-sm text-white/45">{token.name}</p>
                </div>
                <div className="text-right">
                  {token.isNative ? (
                    <p className="text-xs uppercase tracking-[0.12em] text-white/45">Native</p>
                  ) : (
                    <p className="font-mono text-xs text-white/35">{`${token.address.slice(0, 6)}...${token.address.slice(-4)}`}</p>
                  )}
                </div>
              </button>
            )
          })}

          {filteredTokens.length === 0 && (
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

export default function SwapPage() {
  const { address, isConnected } = useAccount()
  const { tokens: discoveredTokens, loading: tokensLoading } = useAllTokenMetadata()
  const { writeContractAsync } = useWriteContract()

  const [inputToken, setInputToken] = useState<TokenOption>(NATIVE_TOKEN)
  const [outputToken, setOutputToken] = useState<TokenOption | null>(null)
  const [amountIn, setAmountIn] = useState('')
  const [pickerMode, setPickerMode] = useState<'input' | 'output' | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [txOpen, setTxOpen] = useState(false)
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [txMessage, setTxMessage] = useState<string | undefined>()
  const [txAction, setTxAction] = useState<'approve' | 'swap' | null>(null)

  const isDexConfigured =
    isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS) &&
    isValidContractAddress(UNISWAP_V2_ROUTER_ADDRESS) &&
    isValidContractAddress(WRAPPED_ZKLTC_ADDRESS)

  useEffect(() => {
    if (outputToken || discoveredTokens.length === 0) return

    const firstToken = discoveredTokens[0]
    setOutputToken({
      address: firstToken.address,
      name: firstToken.name,
      symbol: firstToken.symbol,
      isNative: false,
    })
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

  const pairAddressRead = useReadContract({
    address: UNISWAP_V2_FACTORY_ADDRESS,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'getPair',
    args: pairLookupEnabled ? [wrappedInputAddress, wrappedOutputAddress] : undefined,
    query: { enabled: pairLookupEnabled },
  })

  const pairAddress = (pairAddressRead.data ?? ZERO_ADDRESS) as `0x${string}`
  const pairExists = isValidContractAddress(pairAddress)

  const quoteRead = useReadContract({
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

  const quoteAmounts = Array.isArray(quoteRead.data) ? quoteRead.data : null
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

  let priceImpactText = '—'
  let executionPriceText = '—'

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
      priceImpactText = '—'
      executionPriceText = '—'
    }
  }

  const allowance = (allowanceRead.data ?? 0n) as bigint
  const needsApproval = !resolvedInput.isNative && parsedAmountIn !== null && allowance < parsedAmountIn
  const inputBalance =
    resolvedInput.isNative
      ? nativeBalance.data?.value ?? 0n
      : ((inputTokenBalanceRead.data ?? 0n) as bigint)

  const minimumAmountOut =
    quotedAmountOut === null ? null : (quotedAmountOut * (10_000n - DEFAULT_SLIPPAGE_BPS)) / 10_000n

  const { isLoading: isConfirming, isSuccess: txConfirmed, error: txError } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  })

  useEffect(() => {
    if (!txHash) return
    if (isConfirming) {
      setTxStatus('pending')
      setTxMessage(txAction === 'approve' ? 'Approval transaction pending…' : 'Swap transaction pending…')
    }
  }, [isConfirming, txAction, txHash])

  useEffect(() => {
    if (!txHash || !txConfirmed) return

    setTxStatus('success')
    setTxMessage(txAction === 'approve' ? 'Approval confirmed.' : 'Swap confirmed on LitVM.')

    if (txAction === 'swap') {
      setAmountIn('')
    }

    // WARN-5 fix: refetch allowance after approval so needsApproval flips correctly
    if (txAction === 'approve') {
      allowanceRead.refetch()
    }
  }, [txAction, txConfirmed, txHash])

  useEffect(() => {
    if (!txHash || !txError) return

    setTxStatus('error')
    setTxMessage(txError.message.slice(0, 180))
  }, [txError, txHash])

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
        subtitle="Direct token swaps on Lester Labs’ Uniswap V2 fork for LitVM. Quotes come from the live router, and every trade keeps 0.20% flowing to the Lester Labs treasury while LPs retain 0.10%."
        color={ACCENT}
        image="/images/carousel/governance.png"
        imagePosition="center 46%"
        compact
        stats={[
          { label: 'Network', value: 'LitVM · 4441' },
          { label: 'Swap Fee', value: '0.30%' },
          { label: 'Treasury', value: `${LESTER_TREASURY_ADDRESS.slice(0, 6)}…${LESTER_TREASURY_ADDRESS.slice(-4)}` },
        ]}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {!isDexConfigured && (
          <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
            Configure `NEXT_PUBLIC_UNISWAP_V2_FACTORY_ADDRESS`, `NEXT_PUBLIC_UNISWAP_V2_ROUTER_ADDRESS`, and `NEXT_PUBLIC_WRAPPED_ZKLTC_ADDRESS` before using the swap page.
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/30 sm:p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-white">Swap</h1>
                <p className="mt-1 text-sm text-white/45">Direct pairs from the Lester Labs factory.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65">
                  <Settings2 size={14} />
                  <span>{(Number(DEFAULT_SLIPPAGE_BPS) / 100).toFixed(2)}% slippage</span>
                </div>
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
              <div className="rounded-[26px] border border-white/8 bg-[#120f1d] p-4">
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

              <div className="rounded-[26px] border border-white/8 bg-[#120f1d] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.14em] text-white/35">You receive</span>
                  <TokenButton label="To" token={outputToken} onClick={() => setPickerMode('output')} />
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <div className="text-[2rem] font-semibold text-white">
                      {quotedAmountOutText || '0.0'}
                    </div>
                    <p className="mt-2 text-sm text-white/40">
                      Live quote via `getAmountsOut`
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.12em] text-white/50">
                    Direct route
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Price</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {resolvedOutput ? `1 ${resolvedInput.symbol} = ${executionPriceText} ${resolvedOutput.symbol}` : '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Price impact</p>
                <p className="mt-2 text-lg font-semibold text-white">{priceImpactText}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Fee split</p>
                <p className="mt-2 text-lg font-semibold text-white">0.30% total</p>
                <p className="text-sm text-white/45">0.20% to Lester Labs treasury, 0.10% to LPs</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Liquidity</p>
                <p className="mt-2 text-lg font-semibold text-white">{pairExists ? 'Pool available' : 'No direct pool'}</p>
                <p className="text-sm text-white/45">Add liquidity on the Pool page if this pair is missing.</p>
              </div>
            </div>

            <button
              onClick={handlePrimaryAction}
              disabled={primaryButtonDisabled || isConfirming}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-[18px] px-5 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)`,
                boxShadow: '0 16px 40px rgba(228,79,181,0.28)',
              }}
            >
              {isConfirming ? <Loader2 size={18} className="animate-spin" /> : <ArrowDownUp size={18} />}
              <span>{primaryButtonText}</span>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
              <div className="inline-flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: ACCENT }} />
                <span>Treasury routing enforced on-chain via factory `feeTo` / `feeToSetter` checks.</span>
              </div>
              <Link href="/pool" className="text-white/70 transition hover:text-white">
                Manage LP positions
              </Link>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-white/35">Token discovery</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Factory-backed list</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Tokens are pulled from Lester Labs token factory events on LitVM, so the swap page stays local to the platform rather than depending on an external list.
              </p>
              <div className="mt-4 rounded-2xl border border-white/8 bg-[#120f1d] p-4 text-sm text-white/55">
                {tokensLoading ? 'Loading token index…' : `${tokenOptions.length} swappable assets detected, including native zkLTC.`}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-white/35">How fees work</p>
              <ul className="mt-3 space-y-3 text-sm text-white/55">
                <li className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">Every swap is priced with the standard 0.30% V2 curve.</li>
                <li className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">0.20% of the input token is transferred directly to `{LESTER_TREASURY_ADDRESS.slice(0, 6)}…{LESTER_TREASURY_ADDRESS.slice(-4)}` on each trade.</li>
                <li className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">The remaining 0.10% stays in the pool and accrues to LP positions.</li>
              </ul>
            </div>

            {!isConnected && (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-2">
                <ConnectWalletPrompt />
              </div>
            )}

            {isConnected && (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Connected wallet</p>
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/8 bg-[#120f1d] p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Wallet size={18} className="text-white/70" />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-white">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}</p>
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
    </div>
  )
}
