import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { litvm } from '@/config/chains'
import {
  DISPERSE_ADDRESS,
  ILO_FACTORY_ADDRESS,
  LEDGER_ADDRESS,
  TOKEN_FACTORY_ADDRESS,
  UNISWAP_V2_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_ADDRESS,
  isValidContractAddress,
} from '@/config/contracts'
import { ILO_FACTORY_ABI, LEDGER_ABI, UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_ROUTER_ABI } from '@/config/abis'
import { RPC_URL } from '@/lib/rpcClient'

const LEGACY_ILO_FACTORY_ADDRESS = '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' as const
const DEFAULT_TOKEN_FACTORY_ADDRESS = '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' as const
const DEFAULT_DISPERSE_ADDRESS = '0x3cc66cb4713dca78564df512922adb331ac5ee04' as const
const DEFAULT_LEDGER_ADDRESS = '0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079' as const
const DEFAULT_UNISWAP_V2_FACTORY_ADDRESS = '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8' as const
const DEFAULT_UNISWAP_V2_ROUTER_ADDRESS = '0xD56a623890b083d876D47c3b1c5343b7f983FA62' as const

// Full historical log scans are too slow for the landing API, so these audited
// totals anchor launch-to-block counts and the live API only adds new deltas.
const TOKEN_COUNT_AUDIT_BLOCK = 2_282_519n
const TOKEN_COUNT_AUDIT_TOTAL = 44_124
const SWAP_COUNT_AUDIT_BLOCK = 2_282_842n
const SWAP_COUNT_AUDIT_TOTAL = 9_750
const AIRDROP_WALLET_AUDIT_BLOCK = 2_278_304n
const AIRDROP_WALLET_AUDIT_TOTAL = 8_471

const FALLBACK_STATS = {
  tokensMinted: 44_130,
  walletsAirdropped: AIRDROP_WALLET_AUDIT_TOTAL,
  presalesCreated: 77,
  swapsCompleted: SWAP_COUNT_AUDIT_TOTAL,
  onChainMessages: 3_392,
} satisfies Omit<PlatformStatsSnapshot, 'fetchedAt'>

const RESPONSE_TTL_MS = 60_000
const RPC_TIMEOUT_MS = 3_000
const METRIC_TIMEOUT_MS = 3_500
const SWAP_ADDRESS_BATCH_SIZE = 20

const TOKEN_CREATED_EVENT = parseAbiItem(
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)',
)
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const SWAP_EVENT = parseAbiItem(
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
)

const client = createPublicClient({
  chain: litvm,
  transport: http(RPC_URL, {
    retryCount: 0,
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

let responseCache:
  | {
      snapshot: PlatformStatsSnapshot
      fetchedAtMs: number
    }
  | null = null

let inflightSnapshot: Promise<PlatformStatsSnapshot> | null = null

function withMetricTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), METRIC_TIMEOUT_MS)
  })

  return Promise.race([promise, timeout])
    .catch(() => fallback)
    .finally(() => {
      if (timeoutId) clearTimeout(timeoutId)
    })
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function resolveContractAddress(configuredAddress: Address, fallbackAddress?: Address): Address | null {
  if (isValidContractAddress(configuredAddress)) return configuredAddress
  if (fallbackAddress && isValidContractAddress(fallbackAddress)) return fallbackAddress
  return null
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

async function getTokenCount(): Promise<number> {
  const tokenFactoryAddress = resolveContractAddress(TOKEN_FACTORY_ADDRESS, DEFAULT_TOKEN_FACTORY_ADDRESS)
  if (!tokenFactoryAddress) return 0

  const useAuditBaseline = tokenFactoryAddress.toLowerCase() === DEFAULT_TOKEN_FACTORY_ADDRESS.toLowerCase()
  const logs = await client.getLogs({
    address: tokenFactoryAddress,
    event: TOKEN_CREATED_EVENT,
    fromBlock: useAuditBaseline ? TOKEN_COUNT_AUDIT_BLOCK + 1n : 0n,
    toBlock: 'latest',
  })

  return (useAuditBaseline ? TOKEN_COUNT_AUDIT_TOTAL : 0) + logs.length
}

async function getPresalesCount(): Promise<number> {
  const addresses = new Map<string, Address>()

  const currentFactory = resolveContractAddress(ILO_FACTORY_ADDRESS, LEGACY_ILO_FACTORY_ADDRESS)
  if (currentFactory) addresses.set(currentFactory.toLowerCase(), currentFactory)

  addresses.set(LEGACY_ILO_FACTORY_ADDRESS.toLowerCase(), LEGACY_ILO_FACTORY_ADDRESS)

  const counts = await Promise.all(
    Array.from(addresses.values()).map((address) => safeReadCount(address, ILO_FACTORY_ABI, 'getILOCount')),
  )

  return counts.reduce((sum, value) => sum + value, 0)
}

async function resolveUniswapFactoryAddress(): Promise<Address | null> {
  if (isValidContractAddress(UNISWAP_V2_FACTORY_ADDRESS)) {
    return UNISWAP_V2_FACTORY_ADDRESS
  }

  const routerAddress = resolveContractAddress(UNISWAP_V2_ROUTER_ADDRESS, DEFAULT_UNISWAP_V2_ROUTER_ADDRESS)
  if (routerAddress) {
    try {
      const factory = await client.readContract({
        address: routerAddress,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'factory',
      })

      if (typeof factory === 'string' && isValidContractAddress(factory)) {
        return factory as Address
      }
    } catch {
      // Fall through to the discovered default factory.
    }
  }

  return DEFAULT_UNISWAP_V2_FACTORY_ADDRESS
}

async function getPairAddresses(factoryAddress: Address): Promise<Address[]> {
  const pairCount = Number(
    await client.readContract({
      address: factoryAddress,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: 'allPairsLength',
    }),
  )

  if (pairCount === 0) return []

  const indices = Array.from({ length: pairCount }, (_, index) => BigInt(index))
  const pairAddresses: Address[] = []

  for (const batch of chunk(indices, SWAP_ADDRESS_BATCH_SIZE)) {
    const resolvedBatch = await Promise.all(
      batch.map((index) =>
        client.readContract({
          address: factoryAddress,
          abi: UNISWAP_V2_FACTORY_ABI,
          functionName: 'allPairs',
          args: [index],
        }),
      ),
    )

    for (const pairAddress of resolvedBatch) {
      if (typeof pairAddress === 'string' && isValidContractAddress(pairAddress)) {
        pairAddresses.push(pairAddress as Address)
      }
    }
  }

  return pairAddresses
}

async function getSwapCount(): Promise<number> {
  const factoryAddress = await resolveUniswapFactoryAddress()
  if (!factoryAddress) return 0

  const useAuditBaseline = factoryAddress.toLowerCase() === DEFAULT_UNISWAP_V2_FACTORY_ADDRESS.toLowerCase()
  const pairAddresses = await getPairAddresses(factoryAddress)
  if (pairAddresses.length === 0) return 0

  let count = useAuditBaseline ? SWAP_COUNT_AUDIT_TOTAL : 0

  for (const batch of chunk(pairAddresses, SWAP_ADDRESS_BATCH_SIZE)) {
    const logs = await client.getLogs({
      address: batch,
      event: SWAP_EVENT,
      fromBlock: useAuditBaseline ? SWAP_COUNT_AUDIT_BLOCK + 1n : 0n,
      toBlock: 'latest',
    })
    count += logs.length
  }

  return count
}

async function getAirdropWalletCount(): Promise<number> {
  const disperseAddress = resolveContractAddress(DISPERSE_ADDRESS, DEFAULT_DISPERSE_ADDRESS)
  if (!disperseAddress) return 0

  const useAuditBaseline = disperseAddress.toLowerCase() === DEFAULT_DISPERSE_ADDRESS.toLowerCase()
  const logs = await client.getLogs({
    event: TRANSFER_EVENT,
    args: {
      from: disperseAddress,
    },
    fromBlock: useAuditBaseline ? AIRDROP_WALLET_AUDIT_BLOCK + 1n : 0n,
    toBlock: 'latest',
  })

  const recipients = new Set<string>()
  for (const log of logs) {
    const recipient = log.args.to
    if (recipient) recipients.add(recipient.toLowerCase())
  }

  return (useAuditBaseline ? AIRDROP_WALLET_AUDIT_TOTAL : 0) + recipients.size
}

async function getOnChainMessageCount(): Promise<number> {
  const ledgerAddress = resolveContractAddress(LEDGER_ADDRESS, DEFAULT_LEDGER_ADDRESS)
  if (!ledgerAddress) return 0

  return safeReadCount(ledgerAddress, LEDGER_ABI, 'messageCount')
}

async function computeSnapshot(): Promise<PlatformStatsSnapshot> {
  const previous = responseCache?.snapshot
  const floor = previous ?? FALLBACK_STATS

  const [tokensResult, presalesResult, swapsResult, airdropsResult, messagesResult] = await Promise.allSettled([
    withMetricTimeout(getTokenCount(), floor.tokensMinted),
    withMetricTimeout(getPresalesCount(), floor.presalesCreated),
    withMetricTimeout(getSwapCount(), floor.swapsCompleted),
    withMetricTimeout(getAirdropWalletCount(), floor.walletsAirdropped),
    withMetricTimeout(getOnChainMessageCount(), floor.onChainMessages),
  ])

  return {
    tokensMinted: tokensResult.status === 'fulfilled' ? tokensResult.value : floor.tokensMinted,
    presalesCreated: presalesResult.status === 'fulfilled' ? presalesResult.value : floor.presalesCreated,
    swapsCompleted: swapsResult.status === 'fulfilled' ? swapsResult.value : floor.swapsCompleted,
    walletsAirdropped: airdropsResult.status === 'fulfilled' ? airdropsResult.value : floor.walletsAirdropped,
    onChainMessages: messagesResult.status === 'fulfilled' ? messagesResult.value : floor.onChainMessages,
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
