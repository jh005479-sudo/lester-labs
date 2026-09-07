import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem'
import { ArrowUpRight, Droplets, Rocket, LockKeyhole, CalendarClock, Send } from 'lucide-react'
import { litvm } from '@/config/chains'
import { UNISWAP_V2_FACTORY_ADDRESS, WRAPPED_ZKLTC_ADDRESS } from '@/config/contracts'
import { UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI } from '@/config/abis'
import { ProjectActivity } from '@/components/projects/ProjectActivity'
import { projectLinks, validAddress } from '@/lib/projectJourney'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Project workspace | Lester Labs' }
const client = createPublicClient({ chain: litvm, transport: http(litvm.rpcUrls.default.http[0], { timeout: 6_000, retryCount: 0 }) })

export default async function ProjectPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params
  if (!validAddress(address)) notFound()
  const links = projectLinks(address)
  let name = 'Your token'
  let symbol = ''
  let supply = ''
  let pair: string | undefined
  let problem = ''
  let poolStatus = 'Pool not checked'
  let tokenChecked = false
  try {
    const blockNumber = await client.getBlockNumber()
    const [tokenName, tokenSymbol, decimals, totalSupply] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: 'name', blockNumber }),
      client.readContract({ address, abi: erc20Abi, functionName: 'symbol', blockNumber }),
      client.readContract({ address, abi: erc20Abi, functionName: 'decimals', blockNumber }),
      client.readContract({ address, abi: erc20Abi, functionName: 'totalSupply', blockNumber }),
    ])
    tokenChecked = true
    name = tokenName.slice(0, 80); symbol = tokenSymbol.slice(0, 20)
    supply = decimals <= 36 ? formatUnits(totalSupply, decimals) : `${totalSupply} base units`
    try {
      const candidate = await client.readContract({ address: UNISWAP_V2_FACTORY_ADDRESS, abi: UNISWAP_V2_FACTORY_ABI, functionName: 'getPair', args: [address, WRAPPED_ZKLTC_ADDRESS], blockNumber })
      if (validAddress(candidate)) {
        pair = candidate
        const reserves = await client.readContract({ address: candidate, abi: UNISWAP_V2_PAIR_ABI, functionName: 'getReserves', blockNumber })
        poolStatus = reserves[0] > 0n && reserves[1] > 0n ? 'Pool has liquidity' : 'Pool is empty'
      } else poolStatus = 'No zkLTC pool found'
    } catch { /* Pair lookup failure is not proof that no pair exists. */ }
  } catch { problem = 'We couldn’t load token details. Check the address or try again shortly.' }
  const steps = [
    { title: 'Add liquidity', detail: 'Pair your token with test zkLTC so people can swap.', href: pair ? `/swap?addLiquidity=${pair}&token0=${address}&token1=${WRAPPED_ZKLTC_ADDRESS}` : links.pool, action: pair ? 'Manage liquidity' : 'Set up a pool', icon: Droplets },
    { title: 'Plan a presale', detail: 'Set your goal, dates, and token allocation.', href: links.presale, action: 'Create a presale', icon: Rocket },
    { title: 'Lock liquidity', detail: 'Choose how long your LP tokens stay locked.', href: pair ? `/locker?lpToken=${pair}` : links.pool, action: pair ? 'Create a lock' : 'Set up liquidity first', icon: LockKeyhole },
    { title: 'Schedule vesting', detail: 'Release team or community tokens over time.', href: links.vesting, action: 'Set up vesting', icon: CalendarClock },
    { title: 'Distribute tokens', detail: 'Review your recipient list and send in batches.', href: links.airdrop, action: 'Prepare a distribution', icon: Send },
  ]
  return <main className="workspace-page">
    <Link href="/projects" className="text-sm text-violet-300">← All projects</Link>
    <header className="workspace-heading mt-6"><div><p className="workspace-eyebrow">Project workspace · LitVM testnet</p><h1>{name}</h1><p>{symbol && `${symbol} · `}{supply ? `${supply} total supply` : 'Build your launch, one step at a time.'}</p></div><Link href={links.explorer} className="workspace-button secondary">View token <ArrowUpRight size={16} /></Link></header>
    {problem && <div className="workspace-notice mb-6" role="alert">{problem}</div>}
    <div className="workspace-panel mb-6"><p className="workspace-eyebrow">Token address</p><p className="my-3 break-all font-mono text-sm">{address}</p><p className="workspace-note">Share this page so others can inspect the token. Token details are read from the chain; listing here is not an endorsement.</p>{pair && <Link href={`/charts?pair=${pair}`} className="workspace-button secondary mt-4">View zkLTC pool <ArrowUpRight size={16} /></Link>}</div>
    <section className="workspace-panel mb-6"><h2>Launch progress</h2><div className="mt-4 flex flex-wrap gap-3"><span className="workspace-badge">{tokenChecked ? '✓ Token found on LitVM' : 'Token not checked'}</span><span className="workspace-badge">{poolStatus}</span></div><p className="workspace-note mt-3">Status is checked when you open this page. Your next steps are below.</p></section>
    <div className="workspace-grid">{steps.map((step, index) => <section key={step.title} className="workspace-panel workspace-step"><div className="flex justify-between"><step.icon size={24} className="text-violet-300" /><span className="workspace-eyebrow">0{index + 1}</span></div><h2>{step.title}</h2><p>{step.detail}</p><Link className="workspace-button secondary" href={step.href}>{step.action} <ArrowUpRight size={15} /></Link></section>)}</div>
    <ProjectActivity token={address} pair={pair} />
    <details className="workspace-details"><summary>Project and verification details</summary><p>Each step is optional and requires your review before signing. This page never marks a step complete just because you opened it.</p><p>A listed pool confirms a factory pairing, not its current liquidity. Use the pool page for reserves.</p><p><Link href="/locker/verify">Verify a lock certificate</Link> · <Link href="/transactions">Check transaction history</Link></p></details>
  </main>
}
