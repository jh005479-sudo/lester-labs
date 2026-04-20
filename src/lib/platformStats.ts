import { createPublicClient, decodeFunctionData, http, parseAbiItem, type Address, type Hex } from 'viem'
import { litvm } from '@/config/chains'
import {
  DISPERSE_ADDRESS,
  ILO_FACTORY_ADDRESS,
  LEDGER_ADDRESS,
  TOKEN_FACTORY_ADDRESS,
  UNISWAP_V2_FACTORY_ADDRESS,
  isValidContractAddress,
} from '@/config/contracts'
import { ILO_FACTORY_ABI, LEDGER_ABI } from '@/config/abis'
import { DISPERSE_ABI } from '@/lib/contracts/airdrop'
import { RPC_URL } from '@/lib/rpcClient'

const LEGACY_ILO_FACTORY_ADDRESS = '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' as const
const RESPONSE_TTL_MS = 30_000
const RPC_TIMEOUT_MS = 30_000
const SWAP_ADDRESS_BATCH_SIZE = 20
const BLOCK_SCAN_BATCH_SIZE = 100

const TOKEN_CREATED_EVENT = parseAbiItem(
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)',
)
const PAIR_CREATED_EVENT = parseAbiItem(
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
)
const SWAP_EVENT = parseAbiItem(
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
)

const client = createPublicClient({
  chain: litvm,
  transport: http(RPC_URL, {
    retryCount: 2,
    timeout: RPC_TIMEOUT_MS,
  }),
})

export interface PlatformStatsSnapshot {
  tokensMinted: number
  walletsAirdropped: number
  presalesCreated: number
  swapsCompleted: number
  onChainMessages: number
  fetchedAt: string
}

interface CountCache {
  count: number
  lastScannedBlock: bigint | null
}

interface SwapCountCache extends CountCache {
  pairAddresses: Set<string>
  pairScanBlock: bigint | null
}

interface AirdropCountCache extends CountCache {
  recipients: Set<string>
}

interface DisperseTransaction {
  hash: Hex
  input: Hex
}

const tokenCountCache: CountCache = {
  count: 0,
  lastScannedBlock: null,
}

const swapCountCache: SwapCountCache = {
  count: 0,
  lastScannedBlock: null,
  pairAddresses: new Set<string>(),
  pairScanBlock: null,
}

const airdropCountCache: AirdropCountCache = {
  count: 0,
  lastScannedBlock: null,
  recipients: new Set<string>(),
}

const deploymentBlockCache = new Map<string, bigint>()

let responseCache:
  | {
      snapshot: PlatformStatsSnapshot
      fetchedAtMs: number
    }
  | null = null

let inflightSnapshot: Promise<PlatformStatsSnapshot> | null = null

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function safeReadCount(address: Address, abi: typeof ILO_FACTORY_ABI, functionName: 'getILOCount'): Promise<number>
async function safeReadCount(address: Address, abi: typeof LEDGER_ABI, functionName: 'messageCount'): Promise<number>
async function safeReadCount(
  address: Address,
  abi: typeof ILO_FACTORY_ABI | typeof LEDGER_ABI,
  functionName: 'getILOCount' | 'messageCount',
): Promise<number> {
  if (!isValidContractAddress(address)) return 0

  try {
    const result = await client.readContract({
      address,
      abi,
      functionName,
    })
    return Number(result)
  } catch {
    return 0
  }
}

async function getDeploymentBlock(address: Address, latestBlock: bigint): Promise<bigint> {
  const cacheKey = address.toLowerCase()
  const cached = deploymentBlockCache.get(cacheKey)
  if (cached !== undefined) return cached

  const latestCode = await client.getCode({ address, blockNumber: latestBlock })
  if (!latestCode || latestCode === '0x') {
    deploymentBlockCache.set(cacheKey, latestBlock)
    return latestBlock
  }

  let low = 0n
  let high = latestBlock

  while (low < high) {
    const mid = low + (high - low) / 2n
    const code = await client.getCode({ address, blockNumber: mid })
    if (code && code !== '0x') {
      high = mid
    } else {
      low = mid + 1n
    }
  }

  deploymentBlockCache.set(cacheKey, low)
  return low
}

async function getTokenCount(latestBlock: bigint): Promise<number> {
  if (!isValidContractAddress(TOKEN_FACTORY_ADDRESS)) return 0

  const fromBlock =
    tokenCountCache.lastScannedBlock === null
      ? await getDeploymentBlock(TOKEN_FACTORY_ADDRESS, latestBlock)
      : tokenCountCache.lastScannedBlock + 1n

  if (fromBlock > latestBlock) return tokenCountCache.count

  const logs = await client.getLogs({
    address: TOKEN_FACTORY_ADDRESS,
    event: TOKEN_CREATED_EVENT,
    fromBlock,
    toBlock: latestBlock,
  })

  tokenCountCache.count += logs.length
  tokenCountCache.lastScannedBlock = latestBlock
  return tokenCountCache.count
}

async function getPairAddresses(latestBlock: bigint): Promise<Set<string>> {
  if (!isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS)) return new Set<string>()

  const fromBlock =
    swapCountCache.pairScanBlock === null
      ? await getDeploymentBlock(UNISWAP_V2_FACTORY_ADDRESS, latestBlock)
      : swapCountCache.pairScanBlock + 1n

  if (fromBlock <= latestBlock) {
    const logs = await client.getLogs({
      address: UNISWAP_V2_FACTORY_ADDRESS,
      event: PAIR_CREATED_EVENT,
      fromBlock,
      toBlock: latestBlock,
    })

    for (const log of logs) {
      const pairAddress = Array.isArray(log.args) ? log.args[2] : undefined
      if (typeof pairAddress === 'string') {
        swapCountCache.pairAddresses.add(pairAddress.toLowerCase())
      }
    }

    swapCountCache.pairScanBlock = latestBlock
  }

  return swapCountCache.pairAddresses
}

async function countSwapLogs(addresses: Address[], fromBlock: bigint, toBlock: bigint): Promise<number> {
  if (addresses.length === 0 || fromBlock > toBlock) return 0

  let count = 0
  for (const batch of chunk(addresses, SWAP_ADDRESS_BATCH_SIZE)) {
    const logs = await client.getLogs({
      address: batch,
      event: SWAP_EVENT,
      fromBlock,
      toBlock,
    })
    count += logs.length
  }

  return count
}

async function getSwapCount(latestBlock: bigint): Promise<number> {
  const previousPairs = new Set(Array.from(swapCountCache.pairAddresses))
  const pairAddresses = await getPairAddresses(latestBlock)
  if (pairAddresses.size === 0) {
    swapCountCache.count = 0
    swapCountCache.lastScannedBlock = latestBlock
    return 0
  }

  const currentPairs = Array.from(pairAddresses) as Address[]

  if (swapCountCache.lastScannedBlock === null) {
    const fullCount = await countSwapLogs(currentPairs, 0n, latestBlock)
    swapCountCache.count = fullCount
    swapCountCache.lastScannedBlock = latestBlock
    return fullCount
  }

  const newPairs = currentPairs.filter((pairAddress) => !previousPairs.has(pairAddress.toLowerCase()))
  const existingPairs = currentPairs.filter((pairAddress) => previousPairs.has(pairAddress.toLowerCase()))

  let nextCount = swapCountCache.count
  if (swapCountCache.lastScannedBlock < latestBlock) {
    nextCount += await countSwapLogs(existingPairs, swapCountCache.lastScannedBlock + 1n, latestBlock)
  }
  if (newPairs.length > 0) {
    nextCount += await countSwapLogs(newPairs, 0n, latestBlock)
  }

  swapCountCache.count = nextCount
  swapCountCache.lastScannedBlock = latestBlock
  return nextCount
}

async function getDisperseTransactions(fromBlock: bigint, toBlock: bigint): Promise<DisperseTransaction[]> {
  const transactions: DisperseTransaction[] = []

  for (let start = fromBlock; start <= toBlock; start += BigInt(BLOCK_SCAN_BATCH_SIZE)) {
    const end = start + BigInt(BLOCK_SCAN_BATCH_SIZE - 1)
    const blockNumbers: bigint[] = []
    for (let blockNumber = start; blockNumber <= end && blockNumber <= toBlock; blockNumber++) {
      blockNumbers.push(blockNumber)
    }

    const blocks = await Promise.all(
      blockNumbers.map((blockNumber) =>
        client.getBlock({
          blockNumber,
          includeTransactions: true,
        }),
      ),
    )

    for (const block of blocks) {
      for (const transaction of block.transactions) {
        if (
          transaction.to?.toLowerCase() === DISPERSE_ADDRESS.toLowerCase() &&
          transaction.input &&
          transaction.input !== '0x'
        ) {
          transactions.push({
            hash: transaction.hash,
            input: transaction.input,
          })
        }
      }
    }
  }

  return transactions
}

async function getAirdropWalletCount(latestBlock: bigint): Promise<number> {
  if (!isValidContractAddress(DISPERSE_ADDRESS)) return 0

  const fromBlock =
    airdropCountCache.lastScannedBlock === null
      ? await getDeploymentBlock(DISPERSE_ADDRESS, latestBlock)
      : airdropCountCache.lastScannedBlock + 1n

  if (fromBlock > latestBlock) return airdropCountCache.count

  const disperseTransactions = await getDisperseTransactions(fromBlock, latestBlock)
  if (disperseTransactions.length === 0) {
    airdropCountCache.lastScannedBlock = latestBlock
    return airdropCountCache.count
  }

  const transactions = await Promise.all(
    disperseTransactions.map((transaction) =>
      client.getTransactionReceipt({ hash: transaction.hash })
        .then((receipt) => ({
          input: transaction.input,
          receipt,
        }))
        .catch(() => null),
    ),
  )

  for (const entry of transactions) {
    if (!entry) continue

    const { input, receipt } = entry
    if (receipt.status !== 'success') continue

    try {
      const decoded = decodeFunctionData({
        abi: DISPERSE_ABI,
        data: input,
      })

      const recipientsArg =
        decoded.functionName === 'disperseToken'
          ? decoded.args[1]
          : decoded.args[0]

      if (!Array.isArray(recipientsArg)) continue

      for (const recipient of recipientsArg) {
        if (typeof recipient === 'string') {
          airdropCountCache.recipients.add(recipient.toLowerCase())
        }
      }
    } catch {
      // Ignore non-matching calldata.
    }
  }

  airdropCountCache.count = airdropCountCache.recipients.size
  airdropCountCache.lastScannedBlock = latestBlock
  return airdropCountCache.count
}

async function computeSnapshot(): Promise<PlatformStatsSnapshot> {
  const latestBlock = await client.getBlockNumber()
  const previous = responseCache?.snapshot

  const [
    tokensResult,
    presalesResult,
    swapsResult,
    airdropsResult,
    messagesResult,
  ] = await Promise.allSettled([
    getTokenCount(latestBlock),
    (async () => {
      const [currentCount, legacyCount] = await Promise.all([
        safeReadCount(ILO_FACTORY_ADDRESS, ILO_FACTORY_ABI, 'getILOCount'),
        safeReadCount(LEGACY_ILO_FACTORY_ADDRESS, ILO_FACTORY_ABI, 'getILOCount'),
      ])
      return currentCount + legacyCount
    })(),
    getSwapCount(latestBlock),
    getAirdropWalletCount(latestBlock),
    safeReadCount(LEDGER_ADDRESS, LEDGER_ABI, 'messageCount'),
  ])

  return {
    tokensMinted: tokensResult.status === 'fulfilled' ? tokensResult.value : previous?.tokensMinted ?? 0,
    presalesCreated: presalesResult.status === 'fulfilled' ? presalesResult.value : previous?.presalesCreated ?? 0,
    swapsCompleted: swapsResult.status === 'fulfilled' ? swapsResult.value : previous?.swapsCompleted ?? 0,
    walletsAirdropped: airdropsResult.status === 'fulfilled' ? airdropsResult.value : previous?.walletsAirdropped ?? 0,
    onChainMessages: messagesResult.status === 'fulfilled' ? messagesResult.value : previous?.onChainMessages ?? 0,
    fetchedAt: new Date().toISOString(),
  }
}

export async function getPlatformStatsSnapshot(): Promise<PlatformStatsSnapshot> {
  if (responseCache && Date.now() - responseCache.fetchedAtMs < RESPONSE_TTL_MS) {
    return responseCache.snapshot
  }

  if (inflightSnapshot) return inflightSnapshot

  inflightSnapshot = computeSnapshot()
    .then((snapshot) => {
      responseCache = {
        snapshot,
        fetchedAtMs: Date.now(),
      }
      return snapshot
    })
    .finally(() => {
      inflightSnapshot = null
    })

  return inflightSnapshot
}
