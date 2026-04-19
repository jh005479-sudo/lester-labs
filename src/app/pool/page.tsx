'use client'

import Link from 'next/link'
import { Droplets, ExternalLink, Layers3, Plus, Wallet } from 'lucide-react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { ToolHero } from '@/components/shared/ToolHero'
import { ConnectWalletPrompt } from '@/components/shared/ConnectWalletPrompt'
import { ERC20_ABI, UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI } from '@/config/abis'
import { UNISWAP_V2_FACTORY_ADDRESS, UNISWAP_V2_ROUTER_ADDRESS, WRAPPED_ZKLTC_ADDRESS, isValidContractAddress } from '@/config/contracts'

const ACCENT = '#E44FB5'
const MAX_PAIRS_TO_SCAN = 50

// ── Pinned tokens always shown first in the dropdown ──────────────────────────
export const PINNED_TOKENS: { address: string; symbol: string; name: string }[] = [
  { address: ZERO_ADDRESS(), symbol: 'zkLTC', name: 'zkLTC (Native)' },
  { address: WRAPPED_ZKLTC_ADDRESS, symbol: 'WZKLTC', name: 'Wrapped zkLTC' },
  { address: '0xdaf8bdc2b197c2f0fab9d7359bdf482f8332b21f', symbol: 'WETH', name: 'LL wEth' },
  { address: '0x3bce48a3b30414176e796af997bb1ed5e1dc5b22', symbol: 'WBTC', name: 'LL wBTC' },
  { address: '0x4af16cfb61fe9a2c6d1452d85b25e7ca49748f16', symbol: 'USDT', name: 'LL USDT' },
  { address: '0x7f837d1b20c6ff20d8c6f396760c4f1f1f17babf', symbol: 'USDC', name: 'LL USDC' },
]

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

// ── Pool card for unauthenticated view ──────────────────────────────────────
function PoolCard({ pairAddress, token0Meta, token1Meta, r0, r1 }: {
  pairAddress: `0x${string}`
  token0Meta: TokenMeta
  token1Meta: TokenMeta
  r0: bigint
  r1: bigint
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
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
            href={`/swap?addLiquidity=${pairAddress}`}
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
        <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">Reserve 0</p>
          <p className="mt-1.5 text-sm font-semibold text-white">
            {formatAmount(r0, token0Meta.decimals)} {token0Meta.symbol}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-white/35">Reserve 1</p>
          <p className="mt-1.5 text-sm font-semibold text-white">
            {formatAmount(r1, token1Meta.decimals)} {token1Meta.symbol}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-[#120f1d] p-3">
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
function PositionCard({ position, onAddLiquidity }: {
  position: {
    pairAddress: `0x${string}`
    token0Meta: TokenMeta
    token1Meta: TokenMeta
    lpBalance: bigint
    pooled0: bigint
    pooled1: bigint
    share: number
  }
  onAddLiquidity: (pairAddress: `0x${string}`) => void
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/25">
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
            onClick={() => onAddLiquidity(position.pairAddress)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
          >
            <Plus size={12} />
            Add Liquidity
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
  )
}

export default function PoolPage() {
  const { address, isConnected } = useAccount()

  const isDexConfigured = isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS) && isValidContractAddress(WRAPPED_ZKLTC_ADDRESS)

  // ── Always read all factory pairs (no auth required) ──────────────────────
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

  // ── Read pair metadata (no wallet required) ─────────────────────────────
  const pairStateReads = useReadContracts({
    contracts: pairAddresses.flatMap((pairAddress) => [
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token0' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token1' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves' as const },
      { address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: 'totalSupply' as const },
    ]),
    query: { enabled: pairAddresses.length > 0 },
  })

  // ── Only read LP balance when connected ─────────────────────────────────
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

  const tokenMetadataReads = useReadContracts({
    contracts: Array.from(tokenAddresses)
      .filter((tokenAddress) => tokenAddress !== WRAPPED_ZKLTC_ADDRESS.toLowerCase() && tokenAddress !== ZERO_ADDRESS().toLowerCase())
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
    .filter((tokenAddress) => tokenAddress !== WRAPPED_ZKLTC_ADDRESS.toLowerCase() && tokenAddress !== ZERO_ADDRESS().toLowerCase())
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
      const token0Address = pairStateReads.data?.[base]?.status === 'success' ? (pairStateReads.data[base].result as `0x${string}`) : null
      const token1Address = pairStateReads.data?.[base + 1]?.status === 'success' ? (pairStateReads.data[base + 1].result as `0x${string}`) : null
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

      const token0Meta = tokenMetaMap.get(token0Address.toLowerCase()) ?? { name: 'Unknown', symbol: 'UNK', decimals: 18 }
      const token1Meta = tokenMetaMap.get(token1Address.toLowerCase()) ?? { name: 'Unknown', symbol: 'UNK', decimals: 18 }

      return {
        pairAddress,
        token0Address,
        token1Address,
        token0Meta,
        token1Meta,
        reserves,
        totalSupply,
        // LP position data (only populated when connected)
        lpBalance: lpBalanceReads.data?.[index]?.status === 'success'
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
        lpBalance,
        pooled0,
        pooled1,
        share,
      }
    })

  const visiblePools = pools.filter(
    (p) => !(p.lpBalance > 0n && p.totalSupply > 0n) // exclude pools where user already has LP
  )

  function handleAddLiquidity(pairAddress: `0x${string}`) {
    window.location.href = `/swap?addLiquidity=${pairAddress}`
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <ToolHero
        category="Dex"
        title="Liquidity"
        titleHighlight="Pool"
        subtitle="Browse all factory pools, view reserves, and manage your LP positions."
        color={ACCENT}
        image="/images/carousel/liquidity-locker.png"
        imagePosition="center 45%"
        compact
        stats={[
          { label: 'Factory pairs', value: totalPairs.toString() },
          { label: 'Scanned', value: `${scannedPairCount}/${Math.max(totalPairs, scannedPairCount)}` },
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
            <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-10 text-center">
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
                  r0={pool.reserves[0]}
                  r1={pool.reserves[1]}
                />
              ))}
            </div>
          )
        ) : (
          <>
            {/* ── Connected: wallet positions + CTA ─────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Wallet</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Wallet size={18} className="text-white/70" />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-white">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'}</p>
                    <p className="text-sm text-white/45">Connected</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Pairs scanned</p>
                <p className="mt-3 text-3xl font-semibold text-white">{scannedPairCount}</p>
                <p className="mt-2 text-sm text-white/45">
                  {totalPairs > MAX_PAIRS_TO_SCAN
                    ? `Showing first ${MAX_PAIRS_TO_SCAN} pools.`
                    : 'All factory pools included.'}
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
              </div>
            </div>

            {/* ── LP positions ───────────────────────────────────────────── */}
            {positions.length === 0 ? (
              <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <Layers3 size={22} className="text-white/65" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-white">No LP positions</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">
                  You don't hold any Lester Labs V2 LP tokens yet. Add liquidity to a pair to earn from trades.
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
                  <PositionCard
                    key={position.pairAddress}
                    position={position}
                    onAddLiquidity={handleAddLiquidity}
                  />
                ))}
              </div>
            )}

            {/* ── Other pools (no LP position) ────────────────────────────── */}
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
                      r0={pool.reserves[0]}
                      r1={pool.reserves[1]}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}