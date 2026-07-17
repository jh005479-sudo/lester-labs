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
import { tokenCountFromFactoryNonce } from '@/lib/factoryNonce'
import {
  applyCounterFloor,
  describeSwapCoverage,
  getAuditedCounterBaseline,
  getBoundedStatsLogRange,
  selectNewestPairIndices,
  sumCompleteCounts,
} from '@/lib/platformStatsBounds'

const LEGACY_ILO_FACTORY_ADDRESS = '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' as const
const DEFAULT_TOKEN_FACTORY_ADDRESS = '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' as const
const DEFAULT_DISPERSE_ADDRESS = '0x3cc66cb4713dca78564df512922adb331ac5ee04' as const
const DEFAULT_LEDGER_ADDRESS = '0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079' as const
const DEFAULT_UNISWAP_V2_FACTORY_ADDRESS = '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8' as const
const DEFAULT_UNISWAP_V2_ROUTER_ADDRESS = '0xD56a623890b083d876D47c3b1c5343b7f983FA62' as const

// Full historical log scans are too slow for the landing API, so these audited
// totals anchor launch-to-block counts and the live API only adds new deltas.
const TOKEN_COUNT_AUDIT_BLOCK = 3_412_247n
const TOKEN_COUNT_AUDIT_TOTAL = 72_882
const SWAP_COUNT_AUDIT_BLOCK = 3_412_247n
const SWAP_COUNT_AUDIT_TOTAL = 12_975
const AIRDROP_WALLET_AUDIT_BLOCK = 3_412_247n
const AIRDROP_WALLET_AUDIT_TOTAL = 16_433

const FALLBACK_STATS = {
  tokensMinted: TOKEN_COUNT_AUDIT_TOTAL,
  walletsAirdropped: AIRDROP_WALLET_AUDIT_TOTAL,
  presalesCreated: 77,
  swapsCompleted: SWAP_COUNT_AUDIT_TOTAL,
  onChainMessages: 3_392,
}

const RESPONSE_TTL_MS = 60_000
const RPC_TIMEOUT_MS = 3_000
const METRIC_TIMEOUT_MS = 3_500
const SWAP_ADDRESS_BATCH_SIZE = 50
const MAX_PAIR_ENUMERATION = 200
const MAX_STATS_LOG_BLOCKS = 10_000n
const MAX_METRIC_LOGS = 25_000

const TOKEN_CREATED_EVENT = parseAbiItem(
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)',
)
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
  coverage: Record<PlatformMetricName, PlatformMetricCoverage>
}

export type PlatformMetricName = 'tokensMinted' | 'walletsAirdropped' | 'presalesCreated' | 'swapsCompleted' | 'onChainMessages'
export type PlatformMetricCoverageStatus = 'live' | 'bounded' | 'audited-baseline' | 'fallback'

export interface PlatformMetricCoverage {
  status: PlatformMetricCoverageStatus
  note: string
}

interface CountMetric {
  value: number
  coverage: PlatformMetricCoverage
}

function countMetric(value: number, status: PlatformMetricCoverageStatus, note: string): CountMetric {
  return { value, coverage: { status, note } }
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

async function safeReadCount(address: Address, abi: typeof ILO_FACTORY_ABI, functionName: 'getILOCount'): Promise<number | null>
async function safeReadCount(address: Address, abi: typeof LEDGER_ABI, functionName: 'messageCount'): Promise<number | null>
async function safeReadCount(
  address: Address,
  abi: typeof ILO_FACTORY_ABI | typeof LEDGER_ABI,
  functionName: 'getILOCount' | 'messageCount',
): Promise<number | null> {
  if (!isValidContractAddress(address)) return null

  try {
    const result = await client.readContract({
      address,
      abi,
      functionName,
    })
    return Number(result)
  } catch {
    return null
  }
}

async function getTokenCount(): Promise<CountMetric> {
  const tokenFactoryAddress = resolveContractAddress(TOKEN_FACTORY_ADDRESS, DEFAULT_TOKEN_FACTORY_ADDRESS)
  if (!tokenFactoryAddress) return countMetric(0, 'fallback', 'Token factory is not configured.')

  try {
    const nonce = await client.getTransactionCount({
      address: tokenFactoryAddress,
      blockTag: 'latest',
    })

    return countMetric(tokenCountFromFactoryNonce(nonce), 'live', 'Factory deployment nonce read at latest block.')
  } catch {
    // Fall back to the event-log audit path if the RPC cannot return contract nonce.
  }

  const useAuditBaseline = tokenFactoryAddress.toLowerCase() === DEFAULT_TOKEN_FACTORY_ADDRESS.toLowerCase()
  const latestBlock = await client.getBlockNumber()
  const range = getBoundedStatsLogRange(
    useAuditBaseline ? TOKEN_COUNT_AUDIT_BLOCK + 1n : 0n,
    latestBlock,
    MAX_STATS_LOG_BLOCKS,
  )
  const logs = await client.getLogs({
    address: tokenFactoryAddress,
    event: TOKEN_CREATED_EVENT,
    fromBlock: range.scannedFromBlock,
    toBlock: range.toBlock,
  })

  return countMetric(
    (useAuditBaseline ? TOKEN_COUNT_AUDIT_TOTAL : 0) + logs.length,
    range.truncated ? 'bounded' : 'live',
    range.truncated ? 'Factory log fallback is limited to the newest 10,000 blocks.' : 'Factory creation logs cover the requested range.',
  )
}

async function getPresalesCount(): Promise<CountMetric> {
  const addresses = new Map<string, Address>()

  const currentFactory = resolveContractAddress(ILO_FACTORY_ADDRESS, LEGACY_ILO_FACTORY_ADDRESS)
  if (currentFactory) addresses.set(currentFactory.toLowerCase(), currentFactory)

  addresses.set(LEGACY_ILO_FACTORY_ADDRESS.toLowerCase(), LEGACY_ILO_FACTORY_ADDRESS)

  const counts = await Promise.all(
    Array.from(addresses.values()).map((address) => safeReadCount(address, ILO_FACTORY_ABI, 'getILOCount')),
  )
  const total = sumCompleteCounts(counts)
  if (total === null) throw new Error('Unable to read every canonical launchpad factory counter.')

  return countMetric(total, 'live', 'Canonical launchpad factory counters.')
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

async function getPairAddresses(factoryAddress: Address): Promise<{
  addresses: Address[]
  total: number
  pairEnumerationCapped: boolean
  pairResolutionIncomplete: boolean
}> {
  const pairCount = Number(
    await client.readContract({
      address: factoryAddress,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: 'allPairsLength',
    }),
  )

  if (pairCount === 0) {
    return {
      addresses: [],
      total: 0,
      pairEnumerationCapped: false,
      pairResolutionIncomplete: false,
    }
  }

  const indices = selectNewestPairIndices(pairCount, MAX_PAIR_ENUMERATION)
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

  return {
    addresses: pairAddresses,
    total: pairCount,
    pairEnumerationCapped: pairCount > indices.length,
    pairResolutionIncomplete: pairAddresses.length < indices.length,
  }
}

async function getSwapCount(): Promise<CountMetric> {
  const factoryAddress = await resolveUniswapFactoryAddress()
  if (!factoryAddress) return countMetric(0, 'fallback', 'DEX factory is not configured.')

  const useAuditBaseline = factoryAddress.toLowerCase() === DEFAULT_UNISWAP_V2_FACTORY_ADDRESS.toLowerCase()
  const pairResult = await getPairAddresses(factoryAddress)
  if (pairResult.total === 0) return countMetric(0, 'live', 'Canonical factory currently has no pairs.')
  if (pairResult.addresses.length === 0) throw new Error('Unable to resolve canonical factory pair addresses.')
  const latestBlock = await client.getBlockNumber()
  const range = getBoundedStatsLogRange(
    useAuditBaseline ? SWAP_COUNT_AUDIT_BLOCK + 1n : 0n,
    latestBlock,
    MAX_STATS_LOG_BLOCKS,
  )

  let count = useAuditBaseline ? SWAP_COUNT_AUDIT_TOTAL : 0
  let countedLogs = 0
  let logLimitReached = false

  for (const batch of chunk(pairResult.addresses, SWAP_ADDRESS_BATCH_SIZE)) {
    const logs = await client.getLogs({
      address: batch,
      event: SWAP_EVENT,
      fromBlock: range.scannedFromBlock,
      toBlock: range.toBlock,
    })
    const remaining = MAX_METRIC_LOGS - countedLogs
    countedLogs += Math.min(logs.length, remaining)
    count += Math.min(logs.length, remaining)
    if (logs.length >= remaining) {
      logLimitReached = true
      break
    }
  }

  const coverageNote = describeSwapCoverage({
    scannedPairs: pairResult.addresses.length,
    totalPairs: pairResult.total,
    pairEnumerationCapped: pairResult.pairEnumerationCapped,
    pairResolutionIncomplete: pairResult.pairResolutionIncomplete,
    logWindowCapped: range.truncated,
    logCountCapped: logLimitReached,
  })
  const partial = pairResult.pairEnumerationCapped
    || pairResult.pairResolutionIncomplete
    || range.truncated
    || logLimitReached
  return countMetric(
    count,
    partial ? 'bounded' : 'live',
    coverageNote,
  )
}

async function getAirdropWalletCount(): Promise<CountMetric> {
  const disperseAddress = resolveContractAddress(DISPERSE_ADDRESS, DEFAULT_DISPERSE_ADDRESS)
  if (!disperseAddress) return countMetric(0, 'fallback', 'Disperse contract is not configured.')

  // ERC-20 Transfer topics can be emitted by arbitrary contracts. Until the
  // Disperse contract emits an authenticated recipient event, retain the
  // audited baseline rather than allowing third parties to inflate this count.
  const baseline = getAuditedCounterBaseline(AIRDROP_WALLET_AUDIT_TOTAL, AIRDROP_WALLET_AUDIT_BLOCK)
  return countMetric(
    baseline.value,
    'audited-baseline',
    baseline.note,
  )
}

async function getOnChainMessageCount(): Promise<CountMetric> {
  const ledgerAddress = resolveContractAddress(LEDGER_ADDRESS, DEFAULT_LEDGER_ADDRESS)
  if (!ledgerAddress) return countMetric(0, 'fallback', 'Ledger contract is not configured.')
  const count = await safeReadCount(ledgerAddress, LEDGER_ABI, 'messageCount')
  if (count === null) throw new Error('Unable to read the canonical Ledger message counter.')

  return countMetric(count, 'live', 'Canonical Ledger message counter.')
}

async function computeSnapshot(): Promise<PlatformStatsSnapshot> {
  const previous = responseCache?.snapshot
  const floor = previous ?? FALLBACK_STATS
  const fallbackMetric = (value: number, note: string) => countMetric(value, 'fallback', note)

  const [tokensResult, presalesResult, swapsResult, airdropsResult, messagesResult] = await Promise.allSettled([
    withMetricTimeout(getTokenCount(), fallbackMetric(floor.tokensMinted, 'Token metric timed out; serving the last known value.')),
    withMetricTimeout(getPresalesCount(), fallbackMetric(floor.presalesCreated, 'Presale metric timed out; serving the last known value.')),
    withMetricTimeout(getSwapCount(), fallbackMetric(floor.swapsCompleted, 'Swap metric timed out; serving the last known value.')),
    withMetricTimeout(getAirdropWalletCount(), fallbackMetric(floor.walletsAirdropped, 'Airdrop metric timed out; serving the audited baseline.')),
    withMetricTimeout(getOnChainMessageCount(), fallbackMetric(floor.onChainMessages, 'Ledger metric timed out; serving the last known value.')),
  ])

  const tokens = tokensResult.status === 'fulfilled' ? tokensResult.value : fallbackMetric(floor.tokensMinted, 'Token metric failed.')
  const presales = presalesResult.status === 'fulfilled' ? presalesResult.value : fallbackMetric(floor.presalesCreated, 'Presale metric failed.')
  const swaps = swapsResult.status === 'fulfilled' ? swapsResult.value : fallbackMetric(floor.swapsCompleted, 'Swap metric failed.')
  const airdrops = airdropsResult.status === 'fulfilled' ? airdropsResult.value : fallbackMetric(floor.walletsAirdropped, 'Airdrop metric failed.')
  const messages = messagesResult.status === 'fulfilled' ? messagesResult.value : fallbackMetric(floor.onChainMessages, 'Ledger metric failed.')
  const applyMetricFloor = (metric: CountMetric, valueFloor: number): CountMetric => {
    const result = applyCounterFloor(metric.value, valueFloor)
    if (!result.floorApplied) return metric
    return countMetric(
      result.value,
      'fallback',
      `Serving the last known counter floor because the current ${metric.coverage.status} result was lower. ${metric.coverage.note}`,
    )
  }
  const displayedTokens = applyMetricFloor(tokens, floor.tokensMinted)
  const displayedPresales = applyMetricFloor(presales, floor.presalesCreated)
  const displayedSwaps = applyMetricFloor(swaps, floor.swapsCompleted)
  const displayedAirdrops = applyMetricFloor(airdrops, floor.walletsAirdropped)
  const displayedMessages = applyMetricFloor(messages, floor.onChainMessages)

  return {
    tokensMinted: displayedTokens.value,
    presalesCreated: displayedPresales.value,
    swapsCompleted: displayedSwaps.value,
    walletsAirdropped: displayedAirdrops.value,
    onChainMessages: displayedMessages.value,
    fetchedAt: new Date().toISOString(),
    coverage: {
      tokensMinted: displayedTokens.coverage,
      presalesCreated: displayedPresales.coverage,
      swapsCompleted: displayedSwaps.coverage,
      walletsAirdropped: displayedAirdrops.coverage,
      onChainMessages: displayedMessages.coverage,
    },
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
