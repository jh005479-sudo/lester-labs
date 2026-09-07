import { createPublicClient, http, toEventSelector } from 'viem'
import { litvm } from '../../config/chains.ts'
import { LITVM_CURRENT_CONTRACTS, APPROVED_ILO_CREATION_FACTORY_ADDRESS } from '../../config/contracts.ts'
import { normalizeActivityLog, normalizeArchiveCursor, type ActivityCursor, type ActivityPage, type ActivitySource } from '../activityIndex.ts'

import { readBoundedJson } from '../httpBounds.ts'
import { UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI } from '../../config/abis.ts'
import { validAddress } from '../projectJourney.ts'

const sources = {
  tokens: { address: LITVM_CURRENT_CONTRACTS.tokenFactory, signature: 'TokenCreated(address,address,string,string)' },
  locks: { address: LITVM_CURRENT_CONTRACTS.liquidityLocker, signature: 'LockCreated(uint256,address,uint256,uint256,address)' },
  vesting: { address: LITVM_CURRENT_CONTRACTS.vestingFactory, signature: 'VestingCreated(uint256,address,address)' },
  presales: { address: APPROVED_ILO_CREATION_FACTORY_ADDRESS, signature: 'ILOCreated(address,address,address,uint256,uint256)' },
  pairs: { address: LITVM_CURRENT_CONTRACTS.uniswapV2Factory, signature: 'PairCreated(address,address,address,uint256)' },
  ledger: { address: LITVM_CURRENT_CONTRACTS.ledger, signature: 'MessagePosted(address,uint256,uint256,bytes)' },
} as const
const client = createPublicClient({ chain: litvm, transport: http(litvm.rpcUrls.default.http[0], { timeout: 6_000, retryCount: 0 }) })
const cache = new Map<string, { expires: number; page: ActivityPage }>()
const inFlight = new Map<string, Promise<ActivityPage>>()

/** A shared gateway over the existing persistent explorer archive. No wallet input controls a destination. */
export async function getActivityPage(source: ActivitySource, cursor?: ActivityCursor): Promise<ActivityPage> {
  const target = sources[source]
  if (!target?.address) throw new Error('This activity source is unavailable.')
  return readArchivePage(target.address, toEventSelector(target.signature), cursor)
}

export async function getPairHistory(pair: string): Promise<ActivityPage> {
  if (!validAddress(pair)) throw new Error('Invalid pair address.')
  const blockNumber = await client.getBlockNumber()
  const [token0, token1, factory] = await Promise.all([
    client.readContract({ address: pair, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token0', blockNumber }),
    client.readContract({ address: pair, abi: UNISWAP_V2_PAIR_ABI, functionName: 'token1', blockNumber }),
    client.readContract({ address: pair, abi: [{ type: 'function', name: 'factory', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }], functionName: 'factory', blockNumber }),
  ])
  if (factory.toLowerCase() !== LITVM_CURRENT_CONTRACTS.uniswapV2Factory.toLowerCase()) throw new Error('This pair is not in the current DEX.')
  const registered = await client.readContract({ address: LITVM_CURRENT_CONTRACTS.uniswapV2Factory, abi: UNISWAP_V2_FACTORY_ABI, functionName: 'getPair', args: [token0, token1], blockNumber })
  if (registered.toLowerCase() !== pair.toLowerCase()) throw new Error('This pair could not be verified.')
  return readArchivePage(pair, toEventSelector('Sync(uint112,uint112)'))
}

async function readArchivePage(targetAddress: `0x${string}`, topic: `0x${string}`, cursor?: ActivityCursor): Promise<ActivityPage> {
  const key = `${targetAddress.toLowerCase()}:${topic}:${JSON.stringify(cursor ?? {})}`
  const previous = cache.get(key)
  if (previous && previous.expires > Date.now()) return previous.page
  if (inFlight.has(key)) return inFlight.get(key)!
  if (inFlight.size >= 8) throw new Error('The activity service is busy. Try again shortly.')
  const load = async () => {
    const url = new URL(`/api/v2/addresses/${targetAddress}/logs`, litvm.blockExplorers.default.url)
    url.searchParams.set('topic', topic)
    for (const [name, value] of Object.entries(cursor ?? {})) url.searchParams.set(name, String(value))
    const response = await fetch(url, { headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8_000), cache: 'no-store' })
    if (!response.ok) throw new Error('Activity is temporarily unavailable.')
    const payload = await readBoundedJson(response, 2_000_000)
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) throw new Error('The activity archive returned an invalid page.')
    const data = payload as { items: unknown[]; next_page_params?: unknown }
    if (data.items.length > 100) throw new Error('The archive returned an oversized page.')
    const candidates = data.items.map((item) => normalizeActivityLog(item, targetAddress, topic))
    if (candidates.some((item) => item === null)) throw new Error('The activity archive returned an invalid record.')
    const seen = new Set<string>()
    const logs = candidates.filter((log) => {
      if (!log) return false
      const identity = `${log.transactionHash}:${log.logIndex}`
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    }).filter((log) => log !== null)
    const page: ActivityPage = {
      logs, nextCursor: normalizeArchiveCursor(data.next_page_params, topic),
      coverage: { source: 'LiteForge explorer archive', contract: targetAddress, checkedAt: new Date().toISOString(), indexedThroughBlock: logs.reduce((latest, log) => Math.max(latest, log.blockNumber), 0), verification: 'archive', complete: false },
    }
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(key, { page, expires: Date.now() + 30_000 })
    return page
  }
  const pending = load().finally(() => inFlight.delete(key))
  inFlight.set(key, pending)
  return pending
}
