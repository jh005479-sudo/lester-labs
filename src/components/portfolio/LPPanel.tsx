'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem'
import { UNISWAP_V2_FACTORY_ADDRESS } from '@/config/contracts'
import { UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI } from '@/config/abis'
import { litvm } from '@/config/chains'
import { underlyingLPAmount } from '@/lib/dexCharts'

const client = createPublicClient({ chain: litvm, transport: http(litvm.rpcUrls.default.http[0], { timeout: 6_000, retryCount: 0 }) })
const PAGE_SIZE = 12

export function LPPanel({ viewedAddress }: { viewedAddress?: `0x${string}` }) {
  const { address: connectedAddress } = useAccount()
  const address = viewedAddress ?? connectedAddress
  const [page, setPage] = useState(0)
  const query = useQuery({
    queryKey: ['portfolio-lp', address, page], enabled: Boolean(address), staleTime: 30_000, retry: 1,
    queryFn: async () => {
      const blockNumber = await client.getBlockNumber()
      const total = Number(await client.readContract({ address: UNISWAP_V2_FACTORY_ADDRESS, abi: UNISWAP_V2_FACTORY_ABI, functionName: 'allPairsLength', blockNumber }))
      if (!Number.isSafeInteger(total)) throw new Error('The pool count could not be checked.')
      const start = Math.max(0, total - page * PAGE_SIZE)
      const end = Math.max(0, start - PAGE_SIZE)
      const positions = []
      for (let index = start - 1; index >= end; index--) {
        const pair = await client.readContract({ address: UNISWAP_V2_FACTORY_ADDRESS, abi: UNISWAP_V2_FACTORY_ABI, functionName: 'allPairs', args: [BigInt(index)], blockNumber })
        const balance = await client.readContract({ address: pair, abi: erc20Abi, functionName: 'balanceOf', args: [address!], blockNumber })
        if (balance === 0n) continue
        const [token0, token1, reserves, supply] = await Promise.all([
          client.readContract({ address: pair, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token0', blockNumber }),
          client.readContract({ address: pair, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token1', blockNumber }),
          client.readContract({ address: pair, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves', blockNumber }),
          client.readContract({ address: pair, abi: erc20Abi, functionName: 'totalSupply', blockNumber }),
        ])
        const tokens = await Promise.all([token0, token1].map(async (token, i) => {
          const [symbol, decimals] = await Promise.all([
            client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol', blockNumber }),
            client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals', blockNumber }),
          ])
          const raw = underlyingLPAmount(balance, reserves[i === 0 ? 0 : 1], supply)
          return { address: token, symbol: symbol.slice(0, 20), amount: decimals <= 36 ? formatUnits(raw, decimals) : `${raw} base units` }
        }))
        positions.push({ pair, balance: formatUnits(balance, 18), share: supply > 0n ? Number(balance * 1_000_000n / supply) / 10_000 : 0, tokens })
      }
      return { positions, total, hasOlder: end > 0, checked: new Date().toLocaleTimeString(), blockNumber: blockNumber.toString() }
    },
  })
  return <section>
    <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Liquidity positions</h2><button className="workspace-button secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh</button></div>
    {query.isError ? <p className="workspace-notice" role="alert">We couldn’t check your liquidity positions. Try again shortly.</p> : query.isPending ? <p role="status" className="workspace-note">Checking pool balances…</p> : <>
      {query.data.positions.length === 0 && <p className="workspace-note my-6">No balances in these pools. Check the next page for older pools.</p>}
      <div className="workspace-grid">{query.data.positions.map((position) => <article className="workspace-panel" key={position.pair}>
        <h3 className="text-lg font-semibold">{position.tokens.map((token) => token.symbol).join(' / ')}</h3>
        <p className="workspace-note">{position.balance} LP tokens · {position.share}% of the pool</p>
        <dl className="workspace-facts">{position.tokens.map((token) => <div key={token.address}><dt>{token.symbol} share</dt><dd className="break-all">{token.amount}</dd></div>)}</dl>
        <Link href={`/pool?q=${position.pair}`} className="workspace-button secondary">Manage position</Link>
      </article>)}</div>
      <p className="workspace-note mt-5">Checked at {query.data.checked} · Block {query.data.blockNumber} · Page {page + 1} of {Math.max(1, Math.ceil(query.data.total / PAGE_SIZE))}</p>
      <div className="mt-4 flex justify-between"><button className="workspace-button secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer pools</button><button className="workspace-button secondary" disabled={!query.data.hasOlder} onClick={() => setPage(page + 1)}>Older pools</button></div>
    </>}
    <details className="workspace-details"><summary>About these balances</summary><p>Your share uses balances, reserves, and supply from the same block. It may change before withdrawal.</p><p>No price oracle, reserve valuation, cost basis, fees, tax data, or investment return is fetched or inferred.</p></details>
  </section>
}
