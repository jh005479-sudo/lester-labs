import { createPublicClient, http } from 'viem'
import { LITVM_RPC_URL } from './explorerRpc'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  deployer: string
  creationTx: string
  creationBlock: number
  createdAt: number
  holderCount: number
  txCount24h: number
}

export interface TokenDetails extends TokenInfo {
  priceUsd?: number
  volume24h?: number
  priceChange24h?: number
}

export interface TokenTransfer {
  from: string
  to: string
  value: string
  txHash: string
  blockNumber: number
  timestamp: number
}

// ── ERC-20 ABI fragments ──────────────────────────────────────────────────

const ERC20_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const TRANSFER_EVENT = {
  type: 'event' as const,
  name: 'Transfer',
  inputs: [
    { type: 'address', name: 'from', indexed: true },
    { type: 'address', name: 'to', indexed: true },
    { type: 'uint256', name: 'value', indexed: false },
  ],
}

const transferTopic = `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`

// ── Client ─────────────────────────────────────────────────────────────────

const client = createPublicClient({
  transport: http(LITVM_RPC_URL),
})

// ── In-memory cache ────────────────────────────────────────────────────────

let tokenCache: TokenInfo[] = []
let lastScanBlock = 0
let cachePopulated = false

// ── Helpers ────────────────────────────────────────────────────────────────

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const

function formatBigInt(val: bigint, decimals: number): string {
  if (decimals === 0) return val.toString()
  const whole = val / BigInt(10 ** decimals)
  return whole.toLocaleString()
}

// ── Core scanning ──────────────────────────────────────────────────────────

async function readErc20Meta(address: `0x${string}`): Promise<{ name: string; symbol: string; decimals: number; totalSupply: bigint } | null> {
  try {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      client.readContract({ address, abi: ERC20_ABI, functionName: 'name' }),
      client.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address, abi: ERC20_ABI, functionName: 'totalSupply' }),
    ])
    if (!name || !symbol) return null
    return { name: String(name), symbol: String(symbol), decimals: Number(decimals), totalSupply: totalSupply as bigint }
  } catch {
    return null
  }
}

async function getBlockTimestamp(blockNumber: number): Promise<number> {
  try {
    const block = await client.getBlock({ blockNumber: BigInt(blockNumber) })
    return Number(block.timestamp)
  } catch {
    return Math.floor(Date.now() / 1000)
  }
}

async function getTxSender(txHash: string): Promise<string> {
  try {
    const tx = await client.getTransaction({ hash: txHash as `0x${string}` })
    return tx.from
  } catch {
    return ZERO_ADDR
  }
}

async function countHoldersAndTx(address: `0x${string}`, sinceBlock: number): Promise<{ holders: number; txCount: number }> {
  try {
    const logs = (await client.getLogs({
      address,
      event: TRANSFER_EVENT,
      fromBlock: BigInt(sinceBlock),
      toBlock: 'latest',
    })) as any[]
    const recipients = new Set<string>()
    for (const log of logs) {
      const to = (log.args as any)?.to as string | undefined
      if (to && to !== ZERO_ADDR) recipients.add(to.toLowerCase())
    }
    return { holders: recipients.size, txCount: logs.length }
  } catch {
    return { holders: 0, txCount: 0 }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function scanForTokens(fromBlock: number, toBlock: number): Promise<TokenInfo[]> {
  const newTokens: TokenInfo[] = []

  // Get Transfer events from address(0) — mints indicating potential token creation
  let logs: any[] = []
  try {
    logs = await client.getLogs({
      event: TRANSFER_EVENT,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
      args: { from: ZERO_ADDR },
    }) as any
  } catch {
    // Range too large — try smaller batches
    const BATCH = 1000
    for (let start = fromBlock; start <= toBlock; start += BATCH) {
      const end = Math.min(start + BATCH - 1, toBlock)
      try {
        const batch = (await client.getLogs({
          event: TRANSFER_EVENT,
          fromBlock: BigInt(start),
          toBlock: BigInt(end),
          args: { from: ZERO_ADDR },
        })) as any[]
        logs.push(...batch)
      } catch { /* skip batch */ }
    }
  }

  // Deduplicate by contract address
  const seen = new Set<string>()
  const uniqueAddresses: { address: `0x${string}`; txHash: string; blockNumber: number }[] = []

  for (const log of logs) {
    const addr = log.address?.toLowerCase()
    if (!addr || seen.has(addr)) continue
    seen.add(addr)
    uniqueAddresses.push({
      address: log.address as `0x${string}`,
      txHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
    })
  }

  // Validate each as ERC-20
  for (const { address, txHash, blockNumber } of uniqueAddresses) {
    if (tokenCache.some(t => t.address.toLowerCase() === address.toLowerCase())) continue

    const meta = await readErc20Meta(address)
    if (!meta) continue

    const [timestamp, deployer] = await Promise.all([
      getBlockTimestamp(blockNumber),
      getTxSender(txHash),
    ])

    const { holders, txCount } = await countHoldersAndTx(address, blockNumber)

    const token: TokenInfo = {
      address,
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
      totalSupply: formatBigInt(meta.totalSupply, meta.decimals),
      deployer,
      creationTx: txHash,
      creationBlock: blockNumber,
      createdAt: timestamp,
      holderCount: holders,
      txCount24h: txCount,
    }

    newTokens.push(token)
    tokenCache.push(token)
  }

  lastScanBlock = toBlock
  cachePopulated = true
  return newTokens
}

export async function getIndexedTokens(): Promise<TokenInfo[]> {
  if (!cachePopulated) {
    const latest = await client.getBlockNumber()
    // Scan last 50000 blocks initially (~7 days at 1s blocks, less if faster)
    const from = Math.max(0, Number(latest) - 50000)
    await scanForTokens(from, Number(latest))
  }
  return [...tokenCache].sort((a, b) => b.creationBlock - a.creationBlock)
}

export async function getTokenDetails(contractAddress: string): Promise<TokenDetails> {
  const addr = contractAddress as `0x${string}`
  const cached = tokenCache.find(t => t.address.toLowerCase() === contractAddress.toLowerCase())

  const meta = await readErc20Meta(addr)
  if (!meta) throw new Error('Not a valid ERC-20 token')

  const latest = await client.getBlockNumber()
  const fromBlock = cached ? cached.creationBlock : Math.max(0, Number(latest) - 50000)

  const { holders, txCount } = await countHoldersAndTx(addr, fromBlock)

  const base: TokenInfo = cached ?? {
    address: contractAddress,
    name: meta.name,
    symbol: meta.symbol,
    decimals: meta.decimals,
    totalSupply: formatBigInt(meta.totalSupply, meta.decimals),
    deployer: '',
    creationTx: '',
    creationBlock: fromBlock,
    createdAt: Math.floor(Date.now() / 1000),
    holderCount: holders,
    txCount24h: txCount,
  }

  base.holderCount = holders
  base.txCount24h = txCount

  return {
    ...base,
    priceUsd: undefined,
    volume24h: undefined,
    priceChange24h: undefined,
  }
}

export async function getTokenTransfers(contractAddress: string, limit: number): Promise<TokenTransfer[]> {
  const addr = contractAddress as `0x${string}`
  const latest = Number(await client.getBlockNumber())
  const from = Math.max(0, latest - 50000)

  const logs = (await client.getLogs({
    address: addr,
    event: TRANSFER_EVENT,
    fromBlock: BigInt(from),
    toBlock: 'latest',
  })) as any[]

  const recent = logs.slice(-limit).reverse()

  const transfers: TokenTransfer[] = await Promise.all(
    recent.map(async (log) => {
      const args = log.args as any
      const ts = await getBlockTimestamp(Number(log.blockNumber))
      return {
        from: args.from ?? ZERO_ADDR,
        to: args.to ?? ZERO_ADDR,
        value: (args.value as bigint)?.toString() ?? '0',
        txHash: log.transactionHash ?? '',
        blockNumber: Number(log.blockNumber),
        timestamp: ts,
      }
    }),
  )

  return transfers
}

export async function watchForNewTokens(callback: (token: TokenInfo) => void): Promise<() => void> {
  let running = true

  const poll = async () => {
    while (running) {
      try {
        const latest = Number(await client.getBlockNumber())
        const from = lastScanBlock > 0 ? lastScanBlock + 1 : Math.max(0, latest - 10)
        if (from <= latest) {
          const newTokens = await scanForTokens(from, latest)
          for (const t of newTokens) callback(t)
        }
      } catch { /* ignore, retry next cycle */ }
      await new Promise(r => setTimeout(r, 10_000))
    }
  }

  poll()
  return () => { running = false }
}
