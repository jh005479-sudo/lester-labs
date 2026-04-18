'use client'

import Link from 'next/link'
import { Droplets, ExternalLink, Layers3, Wallet } from 'lucide-react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { ToolHero } from '@/components/shared/ToolHero'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { ERC20_ABI, UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI } from '@/config/abis'
import { UNISWAP_V2_FACTORY_ADDRESS, WRAPPED_ZKLTC_ADDRESS, isValidContractAddress } from '@/config/contracts'

const ACCENT = '#E44FB5'
const MAX_PAIRS_TO_SCAN = 50

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

export default function PoolPage() {
  const { address, isConnected } = useAccount()

  const isDexConfigured = isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS) && isValidContractAddress(WRAPPED_ZKLTC_ADDRESS)

  const allPairsLengthRead = useReadContract({
    address: UNISWAP_V2_FACTORY_ADDRESS,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'allPairsLength',
    query: { enabled: isDexConfigured },
  })

  const totalPairs = Number(allPairsLengthRead.data ?? 0n)
  const scannedPairCount = Math.min(totalPairs, MAX_PAIRS_TO_SCAN)

  const pairAddressReads = useReadContracts({
    contracts: isDexConfigured
      ? Array.from({ length: scannedPairCount }, (_, index) => ({
          address: UNISWAP_V2_FACTORY_ADDRESS,
          abi: UNISWAP_V2_FACTORY_ABI,
          functionName: 'allPairs' as const,
          args: [BigInt(index)],
        }))
      : [],
    query: { enabled: isDexConfigured && scannedPairCount > 0 },
  })

  const pairAddresses =
    pairAddressReads.data
      ?.map((result) => (result.status === 'success' ? (result.result as `0x${string}`) : null))
      .filter((result): result is `0x${string}` => result !== null) ?? []

  const pairStateReads = useReadContracts({
    contracts:
      isConnected && address
        ? pairAddresses.flatMap((pairAddress) => [
            { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token0' as const },
            { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token1' as const },
            { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves' as const },
            { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'totalSupply' as const },
            { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'balanceOf' as const, args: [address] },
          ])
        : [],
    query: { enabled: isConnected && Boolean(address) && pairAddresses.length > 0 },
  })

  const tokenAddresses = new Set<string>()
  for (const result of pairStateReads.data ?? []) {
    if (result.status !== 'success' || typeof result.result !== 'string') continue
    if (/^0x[a-fA-F0-9]{40}$/.test(result.result)) {
      tokenAddresses.add((result.result as string).toLowerCase())
    }
  }

  const tokenMetadataReads = useReadContracts({
    contracts: Array.from(tokenAddresses)
      .filter((tokenAddress) => tokenAddress !== WRAPPED_ZKLTC_ADDRESS.toLowerCase())
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

  Array.from(tokenAddresses)
    .filter((tokenAddress) => tokenAddress !== WRAPPED_ZKLTC_ADDRESS.toLowerCase())
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

  const positions = pairAddresses
    .map((pairAddress, index) => {
      const base = index * 5
      const token0Address = pairStateReads.data?.[base]?.status === 'success' ? (pairStateReads.data[base].result as `0x${string}`) : null
      const token1Address = pairStateReads.data?.[base + 1]?.status === 'success' ? (pairStateReads.data[base + 1].result as `0x${string}`) : null
      const reservesResult = pairStateReads.data?.[base + 2]
      const totalSupplyResult = pairStateReads.data?.[base + 3]
      const balanceResult = pairStateReads.data?.[base + 4]

      if (
        token0Address === null ||
        token1Address === null ||
        reservesResult?.status !== 'success' ||
        totalSupplyResult?.status !== 'success' ||
        balanceResult?.status !== 'success'
      ) {
        return null
      }

      const reserves = reservesResult.result as readonly [bigint, bigint, number]
      const totalSupply = totalSupplyResult.result as bigint
      const lpBalance = balanceResult.result as bigint

      if (lpBalance === 0n || totalSupply === 0n) {
        return null
      }

      const token0Meta = tokenMetaMap.get(token0Address.toLowerCase()) ?? { name: 'Unknown token', symbol: 'UNK', decimals: 18 }
      const token1Meta = tokenMetaMap.get(token1Address.toLowerCase()) ?? { name: 'Unknown token', symbol: 'UNK', decimals: 18 }

      const pooled0 = (reserves[0] * lpBalance) / totalSupply
      const pooled1 = (reserves[1] * lpBalance) / totalSupply
      const share = Number((lpBalance * 10_000n) / totalSupply) / 100

      return {
        pairAddress,
        token0Address,
        token1Address,
        token0Meta,
        token1Meta,
        lpBalance,
        pooled0,
        pooled1,
        share,
      }
    })
    .filter((position): position is NonNullable<typeof position> => position !== null)

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <ToolHero
        category="Dex"
        title="Liquidity"
        titleHighlight="Pool"
        subtitle="View LP balances from the Lester Labs V2 factory, along with the underlying token amounts represented by each position."
        color={ACCENT}
        image="/images/carousel/liquidity-locker.png"
        imagePosition="center 45%"
        compact
        stats={[
          { label: 'Factory pairs', value: totalPairs.toString() },
          { label: 'Scan window', value: `${scannedPairCount}/${Math.max(totalPairs, scannedPairCount)}` },
          { label: 'LP positions', value: positions.length.toString() },
        ]}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {!isDexConfigured && (
          <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
            Configure `NEXT_PUBLIC_UNISWAP_V2_FACTORY_ADDRESS` and `NEXT_PUBLIC_WRAPPED_ZKLTC_ADDRESS` before using the pool page.
          </div>
        )}

        {!isConnected ? (
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-2">
            <ConnectWalletPrompt />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Wallet</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Wallet size={18} className="text-white/70" />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-white">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}</p>
                    <p className="text-sm text-white/45">Connected for LP discovery</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Pairs scanned</p>
                <p className="mt-3 text-3xl font-semibold text-white">{scannedPairCount}</p>
                <p className="mt-2 text-sm text-white/45">
                  {totalPairs > MAX_PAIRS_TO_SCAN
                    ? `Showing the first ${MAX_PAIRS_TO_SCAN} pools for a fast initial view.`
                    : 'All current factory pools are included.'}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Next action</p>
                <Link
                  href="/swap"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  <Droplets size={14} />
                  Open Swap
                </Link>
                <p className="mt-2 text-sm text-white/45">Swap into a pair or seed a new one from the DEX flow.</p>
              </div>
            </div>

            {positions.length === 0 ? (
              <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <Layers3 size={22} className="text-white/65" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-white">No LP positions found</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">
                  This wallet does not currently hold any Lester Labs V2 LP tokens in the scanned pool set. Add liquidity to a pair and it will appear here automatically.
                </p>
                <Link
                  href="/swap"
                  className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #b43684 100%)` }}
                >
                  <Droplets size={14} />
                  Go to Swap
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {positions.map((position) => (
                  <div
                    key={position.pairAddress}
                    className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/25"
                  >
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

                      <a
                        href={`/explorer/address/${position.pairAddress}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                      >
                        View pair
                        <ExternalLink size={14} />
                      </a>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/35">LP balance</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatAmount(position.lpBalance, 18)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/35">Pool share</p>
                        <p className="mt-2 text-lg font-semibold text-white">{formatPercent(position.share)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/35">Pair address</p>
                        <p className="mt-2 font-mono text-sm text-white/75">
                          {position.pairAddress.slice(0, 6)}…{position.pairAddress.slice(-4)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/35">{position.token0Meta.symbol} exposure</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {formatAmount(position.pooled0, position.token0Meta.decimals)} {position.token0Meta.symbol}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-white/35">{position.token1Meta.symbol} exposure</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {formatAmount(position.pooled1, position.token1Meta.decimals)} {position.token1Meta.symbol}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
