'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { useReadContract, useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { ArrowUpRight, BarChart3, BookmarkCheck, BookmarkPlus, Droplets, ExternalLink, Loader2, RefreshCw, Search } from 'lucide-react'
import { useLocalEngagement } from '@/hooks/useLocalEngagement'
import { ERC20_ABI, UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI } from '@/config/abis'
import { UNISWAP_V2_FACTORY_ADDRESS, WRAPPED_ZKLTC_ADDRESS, isValidContractAddress } from '@/config/contracts'
import { LITVM_EXPLORER_URL, rpc, hexToNumber } from '@/lib/explorerRpc'
import {
  buildReserveHistory,
  calculateTokenPriceInQuote,
  formatCompactUsd,
  getPairDisplaySymbol,
  type PriceHistoryPoint,
} from '@/lib/dexCharts'
import { getRecentPoolIndices } from '@/lib/poolDisplay'

const PAIR_SCAN_LIMIT = 72
const HISTORY_BLOCK_LOOKBACK = 150_000
const HISTORY_POINT_LIMIT = 80
const SYNC_TOPIC = '0x1c411e9a96e071241ad3aaf1a85bb7f313f435f2f5bd414aa2b7f44c79888b'

type TokenMeta = {
  address: `0x${string}`
  name: string
  symbol: string
  decimals: number
}

type PairMarket = {
  pairAddress: `0x${string}`
  token0: TokenMeta
  token1: TokenMeta
  reserve0: bigint
  reserve1: bigint
  totalSupply: bigint
  base: TokenMeta
  quote: TokenMeta
  price: number | null
}

type SyncLog = {
  blockNumber: string
  data: string
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTokenAmount(value: bigint, decimals: number, maximumFractionDigits = 4) {
  const numeric = Number(formatUnits(value, decimals))
  if (!Number.isFinite(numeric)) return '0'
  if (numeric === 0) return '0'
  if (numeric < 0.0001) return numeric.toExponential(2)
  return numeric.toLocaleString(undefined, { maximumFractionDigits })
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value < 0.000001) return value.toExponential(3)
  return value.toLocaleString(undefined, { maximumFractionDigits: value < 0.01 ? 8 : 6 })
}

function decodeSyncReserves(data: string): [bigint, bigint] | null {
  const clean = data.replace(/^0x/, '')
  if (clean.length < 128) return null
  return [
    BigInt(`0x${clean.slice(0, 64)}`),
    BigInt(`0x${clean.slice(64, 128)}`),
  ]
}

async function fetchBlockTime(blockHex: string) {
  const block = await rpc<{ timestamp?: string }>(
    'eth_getBlockByNumber',
    [blockHex, false],
    { cacheKey: `chart-block:${blockHex}`, cacheTtl: 5 * 60_000 },
  )
  const timestamp = hexToNumber(block.timestamp)
  return timestamp > 0
    ? new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : `#${hexToNumber(blockHex).toLocaleString()}`
}

async function fetchSyncHistory(market: PairMarket): Promise<PriceHistoryPoint[]> {
  const latestHex = await rpc<string>('eth_blockNumber', [], {
    cacheKey: 'charts-latest-block',
    cacheTtl: 10_000,
  })
  const latest = hexToNumber(latestHex)
  const from = Math.max(0, latest - HISTORY_BLOCK_LOOKBACK)
  const logs = await rpc<SyncLog[]>(
    'eth_getLogs',
    [{
      address: market.pairAddress,
      topics: [SYNC_TOPIC],
      fromBlock: `0x${from.toString(16)}`,
      toBlock: 'latest',
    }],
    { cacheKey: `sync:${market.pairAddress}:${from}:${latest}`, cacheTtl: 30_000 },
  )

  const sampled = logs.slice(-HISTORY_POINT_LIMIT)
  if (sampled.length < 2) return buildReserveHistory(market.price, 24)

  const timeByBlock = new Map<string, string>()
  await Promise.all(
    Array.from(new Set(sampled.map((log) => log.blockNumber))).map(async (blockNumber) => {
      timeByBlock.set(blockNumber, await fetchBlockTime(blockNumber))
    }),
  )

  const points = sampled
    .map((log) => {
      const reserves = decodeSyncReserves(log.data)
      if (!reserves) return null
      const price = calculateTokenPriceInQuote({
        baseTokenAddress: market.base.address,
        token0Address: market.token0.address,
        token1Address: market.token1.address,
        reserve0: reserves[0],
        reserve1: reserves[1],
        token0Decimals: market.token0.decimals,
        token1Decimals: market.token1.decimals,
      })
      if (price === null) return null
      return {
        time: timeByBlock.get(log.blockNumber) ?? `#${hexToNumber(log.blockNumber).toLocaleString()}`,
        price: Number(price.toFixed(price < 0.01 ? 8 : 6)),
      }
    })
    .filter((point): point is PriceHistoryPoint => point !== null)

  return points.length >= 2 ? points : buildReserveHistory(market.price, 24)
}

function pickBaseQuote(token0: TokenMeta, token1: TokenMeta) {
  const wrapped = WRAPPED_ZKLTC_ADDRESS.toLowerCase()
  if (token0.address.toLowerCase() === wrapped) return { base: token1, quote: token0 }
  if (token1.address.toLowerCase() === wrapped) return { base: token0, quote: token1 }
  return { base: token0, quote: token1 }
}

function marketSearchText(market: PairMarket) {
  return [
    market.token0.name,
    market.token0.symbol,
    market.token0.address,
    market.token1.name,
    market.token1.symbol,
    market.token1.address,
    market.pairAddress,
  ].join(' ').toLowerCase()
}

function getMarketQuoteLiquidity(market: PairMarket) {
  const quoteReserve = market.quote.address.toLowerCase() === market.token0.address.toLowerCase()
    ? market.reserve0
    : market.reserve1
  return Number(formatUnits(quoteReserve, market.quote.decimals)) * 2
}

function ChartsFallback() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-[120px]">
        <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-8 text-center text-sm text-white/45">
          Loading LitVM charts...
        </div>
      </div>
    </main>
  )
}

function ChartsContent() {
  const searchParams = useSearchParams()
  const pairParam = searchParams.get('pair')
  const queryParam = searchParams.get('q')
  const [search, setSearch] = useState('')
  const [selectedPair, setSelectedPair] = useState<`0x${string}` | null>(null)
  const [history, setHistory] = useState<PriceHistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const chartFrameRef = useRef<HTMLDivElement | null>(null)
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 })
  const { addActivity, isWatched, saveSearch, scopedSearches, toggleWatchlist } = useLocalEngagement()
  const savedChartSearches = scopedSearches('charts')

  const isDexConfigured = isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS)
  const allPairsLengthRead = useReadContract({
    address: UNISWAP_V2_FACTORY_ADDRESS,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'allPairsLength',
    query: { enabled: isDexConfigured },
  })
  const totalPairs = Number(allPairsLengthRead.data ?? 0n)
  const displayedCount = Math.min(totalPairs, PAIR_SCAN_LIMIT)
  const indices = useMemo(() => getRecentPoolIndices(totalPairs, displayedCount), [totalPairs, displayedCount])

  const pairAddressReads = useReadContracts({
    contracts: indices.map((index) => ({
      address: UNISWAP_V2_FACTORY_ADDRESS,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: 'allPairs' as const,
      args: [index],
    })),
    query: { enabled: isDexConfigured && indices.length > 0 },
  })

  const pairAddresses = useMemo(() => (
    pairAddressReads.data
      ?.map((result) => (result.status === 'success' ? (result.result as `0x${string}`) : null))
      .filter((result): result is `0x${string}` => result !== null) ?? []
  ), [pairAddressReads.data])

  const pairStateReads = useReadContracts({
    contracts: pairAddresses.flatMap((pairAddress) => [
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token0' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token1' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'totalSupply' as const },
    ]),
    query: { enabled: pairAddresses.length > 0 },
  })

  const tokenMetadataAddresses = useMemo(() => {
    const tokenAddresses = new Set<string>()
    for (const result of pairStateReads.data ?? []) {
      if (result.status !== 'success' || typeof result.result !== 'string') continue
      if (/^0x[a-fA-F0-9]{40}$/.test(result.result)) tokenAddresses.add(result.result.toLowerCase())
    }

    return Array.from(tokenAddresses).filter(
      (address) => address !== WRAPPED_ZKLTC_ADDRESS.toLowerCase(),
    )
  }, [pairStateReads.data])

  const tokenMetadataReads = useReadContracts({
    contracts: tokenMetadataAddresses.flatMap((tokenAddress) => [
      { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'name' as const },
      { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' as const },
      { address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' as const },
    ]),
    query: { enabled: tokenMetadataAddresses.length > 0 },
  })

  const tokenMetaMap = useMemo(() => {
    const map = new Map<string, TokenMeta>()
    map.set(WRAPPED_ZKLTC_ADDRESS.toLowerCase(), {
      address: WRAPPED_ZKLTC_ADDRESS,
      name: 'Wrapped zkLTC',
      symbol: 'zkLTC',
      decimals: 18,
    })

    tokenMetadataAddresses.forEach((tokenAddress, index) => {
      const base = index * 3
      const name = tokenMetadataReads.data?.[base]
      const symbol = tokenMetadataReads.data?.[base + 1]
      const decimals = tokenMetadataReads.data?.[base + 2]
      map.set(tokenAddress, {
        address: tokenAddress as `0x${string}`,
        name: name?.status === 'success' ? String(name.result) : shortAddress(tokenAddress),
        symbol: symbol?.status === 'success' ? String(symbol.result) : 'TOKEN',
        decimals: decimals?.status === 'success' ? Number(decimals.result) : 18,
      })
    })

    return map
  }, [tokenMetadataAddresses, tokenMetadataReads.data])

  const markets = useMemo(() => (
    pairAddresses
      .map((pairAddress, index): PairMarket | null => {
        const base = index * 4
        const token0Address = pairStateReads.data?.[base]?.status === 'success'
          ? (pairStateReads.data[base].result as `0x${string}`)
          : null
        const token1Address = pairStateReads.data?.[base + 1]?.status === 'success'
          ? (pairStateReads.data[base + 1].result as `0x${string}`)
          : null
        const reserves = pairStateReads.data?.[base + 2]?.status === 'success'
          ? (pairStateReads.data[base + 2].result as readonly [bigint, bigint, number])
          : null
        const totalSupply = pairStateReads.data?.[base + 3]?.status === 'success'
          ? (pairStateReads.data[base + 3].result as bigint)
          : null

        if (!token0Address || !token1Address || !reserves || totalSupply === null) return null
        const token0 = tokenMetaMap.get(token0Address.toLowerCase()) ?? {
          address: token0Address,
          name: shortAddress(token0Address),
          symbol: 'TOKEN',
          decimals: 18,
        }
        const token1 = tokenMetaMap.get(token1Address.toLowerCase()) ?? {
          address: token1Address,
          name: shortAddress(token1Address),
          symbol: 'TOKEN',
          decimals: 18,
        }
        const { base: baseToken, quote } = pickBaseQuote(token0, token1)
        const price = calculateTokenPriceInQuote({
          baseTokenAddress: baseToken.address,
          token0Address: token0.address,
          token1Address: token1.address,
          reserve0: reserves[0],
          reserve1: reserves[1],
          token0Decimals: token0.decimals,
          token1Decimals: token1.decimals,
        })

        return {
          pairAddress,
          token0,
          token1,
          reserve0: reserves[0],
          reserve1: reserves[1],
          totalSupply,
          base: baseToken,
          quote,
          price,
        }
      })
      .filter((market): market is PairMarket => market !== null)
  ), [pairAddresses, pairStateReads.data, tokenMetaMap])

  const filteredMarkets = useMemo(() => markets.filter((market) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return marketSearchText(market).includes(query)
  }), [markets, search])
  const activeMarkets = useMemo(() => (
    [...markets]
      .sort((a, b) => getMarketQuoteLiquidity(b) - getMarketQuoteLiquidity(a))
      .slice(0, 3)
  ), [markets])

  useEffect(() => {
    if (queryParam) setSearch(queryParam)
  }, [queryParam])

  useEffect(() => {
    if (!pairParam || !/^0x[a-fA-F0-9]{40}$/.test(pairParam)) return
    const normalized = pairParam.toLowerCase()
    if (!markets.some((market) => market.pairAddress.toLowerCase() === normalized)) return
    setSelectedPair(pairParam as `0x${string}`)
  }, [markets, pairParam])

  useEffect(() => {
    if (selectedPair && markets.some((market) => market.pairAddress.toLowerCase() === selectedPair.toLowerCase())) return
    setSelectedPair(filteredMarkets[0]?.pairAddress ?? markets[0]?.pairAddress ?? null)
  }, [filteredMarkets, markets, selectedPair])

  const selectedMarket =
    markets.find((market) => selectedPair && market.pairAddress.toLowerCase() === selectedPair.toLowerCase()) ??
    filteredMarkets[0] ??
    markets[0] ??
    null
  const selectedMarketKey = selectedMarket
    ? `${selectedMarket.pairAddress}:${selectedMarket.reserve0.toString()}:${selectedMarket.reserve1.toString()}:${selectedMarket.price ?? 'na'}`
    : ''
  const selectedWatched = selectedMarket ? isWatched('pool', selectedMarket.pairAddress) : false

  useEffect(() => {
    if (!selectedMarket) return
    addActivity({
      type: 'pool',
      id: selectedMarket.pairAddress,
      label: getPairDisplaySymbol(selectedMarket.base.symbol, selectedMarket.quote.symbol),
      href: `/charts?pair=${selectedMarket.pairAddress}`,
      action: 'View market chart',
    })
  }, [addActivity, selectedMarket])

  const selectedBaseSupplyRead = useReadContract({
    address: selectedMarket?.base.address,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: Boolean(selectedMarket?.base.address && selectedMarket.base.address.toLowerCase() !== WRAPPED_ZKLTC_ADDRESS.toLowerCase()),
    },
  })

  useEffect(() => {
    const node = chartFrameRef.current
    if (!node) return

    const updateSize = () => {
      const rect = node.getBoundingClientRect()
      setChartSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!selectedMarket) return

    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    fetchSyncHistory(selectedMarket)
      .then((points) => {
        if (!cancelled) setHistory(points)
      })
      .catch((error) => {
        if (cancelled) return
        setHistory(buildReserveHistory(selectedMarket.price, 24))
        setHistoryError(error instanceof Error ? error.message : 'Unable to load chart history.')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  // selectedMarketKey includes the fields needed to refresh chart history.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarketKey])

  const selectedBaseSupply = (selectedBaseSupplyRead.data ?? 0n) as bigint
  const selectedBaseSupplyFloat = selectedMarket && selectedBaseSupply > 0n
    ? Number(formatUnits(selectedBaseSupply, selectedMarket.base.decimals))
    : 0
  const marketCapInQuote = selectedMarket?.price && selectedBaseSupplyFloat
    ? selectedMarket.price * selectedBaseSupplyFloat
    : null

  const quoteReserve = selectedMarket
    ? selectedMarket.quote.address.toLowerCase() === selectedMarket.token0.address.toLowerCase()
      ? selectedMarket.reserve0
      : selectedMarket.reserve1
    : 0n
  const quoteLiquidity = selectedMarket
    ? Number(formatUnits(quoteReserve, selectedMarket.quote.decimals)) * 2
    : 0

  const chartData = history.length > 0
    ? history
    : buildReserveHistory(selectedMarket?.price ?? null, 24)
  const pairTitle = selectedMarket
    ? getPairDisplaySymbol(selectedMarket.base.symbol, selectedMarket.quote.symbol)
    : 'Select a pair'
  const loadingMarkets = allPairsLengthRead.isLoading || pairAddressReads.isLoading || pairStateReads.isLoading

  return (
    <main className="min-h-screen bg-[var(--background)] text-white">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-[120px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
              <BarChart3 size={14} />
              LitVM Charts
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Market Charts</h1>
            <p className="mt-1 text-sm text-white/50">
              Search Lester DEX pairs by ticker, token, or address. Prices are derived from LitVM testnet reserves.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              {totalPairs.toLocaleString()} factory pairs
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              {displayedCount.toLocaleString()} newest scanned
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-4">
            {activeMarkets.length > 0 && (
              <div className="mb-4 rounded-lg border border-white/8 bg-white/[0.025] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200/65">Active markets</p>
                  <span className="text-[11px] text-white/35">by reserves</span>
                </div>
                <div className="space-y-2">
                  {activeMarkets.map((market) => (
                    <button
                      key={market.pairAddress}
                      type="button"
                      onClick={() => setSelectedPair(market.pairAddress)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-left transition hover:border-cyan-300/25"
                    >
                      <span className="min-w-0 truncate text-xs font-semibold text-white/75">
                        {getPairDisplaySymbol(market.base.symbol, market.quote.symbol)}
                      </span>
                      <span className="shrink-0 text-[11px] text-white/40">
                        {getMarketQuoteLiquidity(market).toLocaleString(undefined, { maximumFractionDigits: 2 })} {market.quote.symbol}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ticker, token, pair, or address"
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/35"
              />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveSearch('charts', search)}
                disabled={!search.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/55 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BookmarkPlus size={12} />
                Save
              </button>
              {savedChartSearches.slice(0, 3).map((item) => (
                <button
                  key={`${item.query}:${item.updatedAt}`}
                  type="button"
                  onClick={() => setSearch(item.query)}
                  className="rounded-lg border border-white/8 bg-white/[0.025] px-2.5 py-1.5 text-xs text-white/45 transition hover:border-white/15 hover:text-white/75"
                >
                  {item.query}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between text-xs text-white/40">
              <span>{filteredMarkets.length} matches</span>
              {loadingMarkets && (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" />
                  Loading pairs
                </span>
              )}
            </div>

            <div className="max-h-[610px] space-y-2 overflow-y-auto pr-1">
              {filteredMarkets.map((market) => {
                const active = selectedMarket?.pairAddress.toLowerCase() === market.pairAddress.toLowerCase()
                return (
                  <button
                    key={market.pairAddress}
                    type="button"
                    onClick={() => setSelectedPair(market.pairAddress)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active
                        ? 'border-cyan-300/35 bg-cyan-300/10'
                        : 'border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.045]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {getPairDisplaySymbol(market.base.symbol, market.quote.symbol)}
                        </p>
                        <p className="mt-1 truncate text-xs text-white/40">{market.base.name}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/45">
                        {formatPrice(market.price)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-white/35">
                      <span>{shortAddress(market.pairAddress)}</span>
                      <span>{market.quote.symbol}</span>
                    </div>
                  </button>
                )
              })}

              {!loadingMarkets && filteredMarkets.length === 0 && (
                <div className="rounded-lg border border-white/10 bg-white/[0.025] p-6 text-center text-sm text-white/40">
                  No matching LitVM pairs in the newest scanned window.
                </div>
              )}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-cyan-200/65">Selected market</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{pairTitle}</h2>
                  {selectedMarket && (
                    <p className="mt-1 font-mono text-xs text-white/35">{selectedMarket.pairAddress}</p>
                  )}
                </div>
                {selectedMarket && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleWatchlist({
                        type: 'pool',
                        id: selectedMarket.pairAddress,
                        label: getPairDisplaySymbol(selectedMarket.base.symbol, selectedMarket.quote.symbol),
                        href: `/charts?pair=${selectedMarket.pairAddress}`,
                      })}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        selectedWatched
                          ? 'border-violet-300/35 bg-violet-300/12 text-violet-100'
                          : 'border-white/10 bg-white/5 text-white/65 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {selectedWatched ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
                      {selectedWatched ? 'Watching' : 'Watch'}
                    </button>
                    <Link
                      href={`/swap?token0=${selectedMarket.quote.address}&token1=${selectedMarket.base.address}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/45"
                    >
                      <Droplets size={15} />
                      Swap
                    </Link>
                    <a
                      href={`${LITVM_EXPLORER_URL}/address/${selectedMarket.pairAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65 transition hover:border-white/20 hover:text-white"
                    >
                      Explorer
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/35">Price</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {formatPrice(selectedMarket?.price ?? null)} {selectedMarket?.quote.symbol ?? ''}
                  </p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/35">Liquidity</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {quoteLiquidity ? `${quoteLiquidity.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${selectedMarket?.quote.symbol}` : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/35">Market cap</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {marketCapInQuote ? `${formatCompactUsd(marketCapInQuote).replace('$', '')} ${selectedMarket?.quote.symbol}` : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/35">Base reserve</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {selectedMarket
                      ? `${formatTokenAmount(
                          selectedMarket.base.address.toLowerCase() === selectedMarket.token0.address.toLowerCase()
                            ? selectedMarket.reserve0
                            : selectedMarket.reserve1,
                          selectedMarket.base.decimals,
                        )} ${selectedMarket.base.symbol}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Price Chart</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Recent reserve updates from the LitVM V2 pair. Quiet markets show a reserve-based fallback line.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedMarket) return
                    setHistory([])
                    setHistoryLoading(true)
                    fetchSyncHistory(selectedMarket)
                      .then(setHistory)
                      .catch(() => setHistory(buildReserveHistory(selectedMarket.price, 24)))
                      .finally(() => setHistoryLoading(false))
                  }}
                  disabled={!selectedMarket || historyLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              <div ref={chartFrameRef} className="h-[360px] min-w-0">
                {chartSize.width > 0 && chartSize.height > 0 ? (
                  <AreaChart
                    width={chartSize.width}
                    height={chartSize.height}
                    data={chartData}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#36D1DC" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#5E6AD2" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.38)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={26} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.38)', fontSize: 11 }} tickLine={false} axisLine={false} width={72} tickFormatter={(value) => formatPrice(Number(value))} />
                    <Tooltip
                      formatter={(value: unknown) => [`${formatPrice(Number(value))} ${selectedMarket?.quote.symbol ?? ''}`, 'Price']}
                      contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.55)' }}
                    />
                    <Area type="monotone" dataKey="price" stroke="#36D1DC" strokeWidth={2} fill="url(#chartFill)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-white/8 bg-white/[0.025] text-sm text-white/35">
                    Loading chart...
                  </div>
                )}
              </div>
              {historyError && (
                <p className="mt-3 text-xs text-amber-300/80">
                  Live history fallback active: {historyError.slice(0, 140)}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/pool"
                className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5 no-underline transition hover:border-white/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Browse all pools</p>
                    <p className="mt-1 text-sm text-white/45">Search reserves and LP positions from the pool page.</p>
                  </div>
                  <ArrowUpRight size={18} className="text-cyan-200" />
                </div>
              </Link>
              <Link
                href="/explorer/tokens"
                className="analytics-card rounded-xl border border-white/10 bg-[var(--surface-1)] p-5 no-underline transition hover:border-white/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Token tracker</p>
                    <p className="mt-1 text-sm text-white/45">Find newly deployed LitVM assets and activity.</p>
                  </div>
                  <ArrowUpRight size={18} className="text-cyan-200" />
                </div>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default function ChartsPage() {
  return (
    <Suspense fallback={<ChartsFallback />}>
      <ChartsContent />
    </Suspense>
  )
}
