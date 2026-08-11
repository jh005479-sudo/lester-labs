import { createPublicClient, http, type Address } from 'viem'
import { litvm } from '@/config/chains'
import {
  APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK,
  APPROVED_ILO_CREATION_FACTORY_ADDRESS,
  DISPERSE_ADDRESS,
  LEDGER_ADDRESS,
  LITVM_CURRENT_ACTIVITY_START_BLOCKS,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
  TOKEN_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_ADDRESS,
  isValidContractAddress,
} from '@/config/contracts'
import { PLATFORM_ACTIVITY_BASELINE } from '@/config/platformActivity'
import { ILO_FACTORY_ABI, LEDGER_ABI, UNISWAP_V2_ROUTER_ABI } from '@/config/abis'
import { DISPERSE_ABI } from '@/lib/contracts/airdrop'
import { RPC_URL } from '@/lib/rpcClient'
import { tokenCountFromFactoryNonce } from '@/lib/factoryNonce'
import { applyCounterFloor } from '@/lib/platformStatsBounds'

const FALLBACK_STATS = PLATFORM_ACTIVITY_BASELINE.totals

const RESPONSE_TTL_MS = 60_000
const RPC_TIMEOUT_MS = 3_000
const METRIC_TIMEOUT_MS = 3_500
const client = createPublicClient({
  chain: litvm,
  transport: http(RPC_URL, {
    retryCount: 0,
    timeout: RPC_TIMEOUT_MS,
  }),
})

export type PlatformMetricName = 'tokensMinted' | 'walletsAirdropped' | 'presalesCreated' | 'swapsCompleted' | 'onChainMessages'
export type PlatformMetricCoverageStatus = 'live' | 'bounded' | 'historical-baseline' | 'fallback'
export type PlatformActivityBaseline = typeof PLATFORM_ACTIVITY_BASELINE

export interface PlatformMetricCoverage {
  status: PlatformMetricCoverageStatus
  note: string
}

export interface PlatformMetricBreakdown {
  baseline: number
  postCutover: number
  total: number
}

export interface PlatformStatsSnapshot {
  tokensMinted: number
  walletsAirdropped: number
  presalesCreated: number
  swapsCompleted: number
  onChainMessages: number
  fetchedAt: string
  baseline: PlatformActivityBaseline
  breakdown: Record<PlatformMetricName, PlatformMetricBreakdown>
  coverage: Record<PlatformMetricName, PlatformMetricCoverage>
}

interface CountMetric {
  value: number
  coverage: PlatformMetricCoverage
}

function countMetric(value: number, status: PlatformMetricCoverageStatus, note: string): CountMetric {
  return { value, coverage: { status, note } }
}

function buildBreakdown(values: Pick<PlatformStatsSnapshot, PlatformMetricName>): Record<PlatformMetricName, PlatformMetricBreakdown> {
  const makeBreakdown = (total: number, baseline: number): PlatformMetricBreakdown => ({
    baseline,
    postCutover: Math.max(0, total - baseline),
    total,
  })

  return {
    tokensMinted: makeBreakdown(values.tokensMinted, PLATFORM_ACTIVITY_BASELINE.totals.tokensMinted),
    walletsAirdropped: makeBreakdown(values.walletsAirdropped, PLATFORM_ACTIVITY_BASELINE.totals.walletsAirdropped),
    presalesCreated: makeBreakdown(values.presalesCreated, PLATFORM_ACTIVITY_BASELINE.totals.presalesCreated),
    swapsCompleted: makeBreakdown(values.swapsCompleted, PLATFORM_ACTIVITY_BASELINE.totals.swapsCompleted),
    onChainMessages: makeBreakdown(values.onChainMessages, PLATFORM_ACTIVITY_BASELINE.totals.onChainMessages),
  }
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

async function verifyBaselineBlock(): Promise<boolean> {
  try {
    const block = await client.getBlock({
      blockNumber: BigInt(PLATFORM_ACTIVITY_BASELINE.throughBlock),
      includeTransactions: false,
    })
    return block.hash?.toLowerCase() === PLATFORM_ACTIVITY_BASELINE.blockHash.toLowerCase()
  } catch {
    return false
  }
}

async function safeReadCount(
  address: Address,
  functionName: 'getILOCount' | 'messageCount',
): Promise<number | null> {
  if (!isValidContractAddress(address)) return null

  try {
    if (functionName === 'getILOCount') {
      const result = await client.readContract({
        address,
        abi: ILO_FACTORY_ABI,
        functionName,
      })
      return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null
    }

    const result = await client.readContract({
      address,
      abi: LEDGER_ABI,
      functionName,
    })
    return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : null
  } catch {
    return null
  }
}

async function getTokenCount(): Promise<CountMetric> {
  const activityStartBlock = LITVM_CURRENT_ACTIVITY_START_BLOCKS.tokenFactory
  if (await client.getBlockNumber() < activityStartBlock) {
    return countMetric(
      PLATFORM_ACTIVITY_BASELINE.totals.tokensMinted,
      'historical-baseline',
      'The chain tip precedes the configured replacement TokenFactory activity start block.',
    )
  }
  const latestNonce = await client.getTransactionCount({
    address: TOKEN_FACTORY_ADDRESS,
    blockTag: 'latest',
  })
  const delta = tokenCountFromFactoryNonce(latestNonce)

  return countMetric(
    PLATFORM_ACTIVITY_BASELINE.totals.tokensMinted + delta,
    'live',
    `Source-pinned baseline through block ${PLATFORM_ACTIVITY_BASELINE.throughBlock.toLocaleString()} plus ${delta.toLocaleString()} creations by the fresh replacement TokenFactory.`,
  )
}

async function getPresalesCount(): Promise<CountMetric> {
  if (!APPROVED_ILO_CREATION_FACTORY_ADDRESS || APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK === undefined) {
    return countMetric(
      PLATFORM_ACTIVITY_BASELINE.totals.presalesCreated,
      'historical-baseline',
      'Creation is disabled. Legacy factory activity is represented once in the source-pinned floor and later legacy activity is excluded.',
    )
  }

  if (await client.getBlockNumber() < APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK) {
    return countMetric(
      PLATFORM_ACTIVITY_BASELINE.totals.presalesCreated,
      'historical-baseline',
      'The chain tip precedes the configured replacement ILOFactory activity start block.',
    )
  }
  const current = await safeReadCount(APPROVED_ILO_CREATION_FACTORY_ADDRESS, 'getILOCount')
  if (current === null) throw new Error('Unable to read the source-pinned current launchpad factory counter.')

  return countMetric(
    PLATFORM_ACTIVITY_BASELINE.totals.presalesCreated + current,
    'live',
    `Source-pinned baseline plus ${current.toLocaleString()} creations by the fresh replacement ILOFactory.`,
  )
}

async function getSwapCount(): Promise<CountMetric> {
  const latestBlock = await client.getBlockNumber()
  const activityStartBlock = LITVM_CURRENT_ACTIVITY_START_BLOCKS.uniswapV2Factory
  if (latestBlock < activityStartBlock) {
    return countMetric(
      PLATFORM_ACTIVITY_BASELINE.totals.swapsCompleted,
      'historical-baseline',
      'The chain tip precedes the configured current DEX activity start block.',
    )
  }
  if (!isValidContractAddress(UNISWAP_V2_ROUTER_ADDRESS)) {
    throw new Error('The source-pinned replacement Router address is invalid.')
  }
  const current = await client.readContract({
    address: UNISWAP_V2_ROUTER_ADDRESS,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: 'totalSwapCount',
  })
  if (current > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Router swap-action counter exceeds the safe analytics range.')
  }
  const delta = Number(current)

  return countMetric(
    PLATFORM_ACTIVITY_BASELINE.totals.swapsCompleted + delta,
    'live',
    `Source-pinned baseline plus ${delta.toLocaleString()} successful replacement Router swap actions. The permissionless counter records one action per successful public Router swap call regardless of route hops; direct Pair calls are excluded, and valid low-value swaps can deliberately increase it. It is not a volume or unique-user metric.`,
  )
}

async function getAirdropWalletCount(): Promise<CountMetric> {
  if (!isValidContractAddress(DISPERSE_ADDRESS)) {
    throw new Error('The source-pinned Disperse contract is invalid.')
  }

  const latestBlock = await client.getBlockNumber()
  if (latestBlock < LITVM_CURRENT_ACTIVITY_START_BLOCKS.disperse) {
    return countMetric(
      PLATFORM_ACTIVITY_BASELINE.totals.walletsAirdropped,
      'historical-baseline',
      'The chain tip precedes the configured replacement Disperse activity start block.',
    )
  }

  const current = await client.readContract({
    address: DISPERSE_ADDRESS,
    abi: DISPERSE_ABI,
    functionName: 'totalRecipientEntries',
  })
  if (current > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Disperse recipient-entry counter exceeds the safe analytics range.')
  }
  const delta = Number(current)

  return countMetric(
    PLATFORM_ACTIVITY_BASELINE.totals.walletsAirdropped + delta,
    'live',
    `Source-pinned historical recipient-address floor plus ${delta.toLocaleString()} successful recipient entries recorded by the replacement Disperse contract. Entries may repeat and are not unique users.`,
  )
}

async function getOnChainMessageCount(): Promise<CountMetric> {
  const activityStartBlock = LITVM_CURRENT_ACTIVITY_START_BLOCKS.ledger
  if (await client.getBlockNumber() < activityStartBlock) {
    return countMetric(
      PLATFORM_ACTIVITY_BASELINE.totals.onChainMessages,
      'historical-baseline',
      'The chain tip precedes the configured replacement Ledger activity start block.',
    )
  }
  const current = await safeReadCount(LEDGER_ADDRESS, 'messageCount')
  if (current === null) throw new Error('Unable to read the source-pinned replacement Ledger counter.')

  return countMetric(
    PLATFORM_ACTIVITY_BASELINE.totals.onChainMessages + current,
    'live',
    `Source-pinned baseline plus ${current.toLocaleString()} messages posted to the fresh replacement Ledger.`,
  )
}

function buildFallbackSnapshot(
  floor: Pick<PlatformStatsSnapshot, PlatformMetricName>,
  note: string,
): PlatformStatsSnapshot {
  const coverage = {
    tokensMinted: countMetric(floor.tokensMinted, 'fallback', note).coverage,
    walletsAirdropped: countMetric(floor.walletsAirdropped, 'fallback', note).coverage,
    presalesCreated: countMetric(floor.presalesCreated, 'fallback', note).coverage,
    swapsCompleted: countMetric(floor.swapsCompleted, 'fallback', note).coverage,
    onChainMessages: countMetric(floor.onChainMessages, 'fallback', note).coverage,
  }

  return {
    ...floor,
    fetchedAt: new Date().toISOString(),
    baseline: PLATFORM_ACTIVITY_BASELINE,
    breakdown: buildBreakdown(floor),
    coverage,
  }
}

function buildHistoricalSnapshot(): PlatformStatsSnapshot {
  const values = { ...PLATFORM_ACTIVITY_BASELINE.totals }
  const note = 'Provisional historical on-chain activity floor. It preserves the production counters while post-cutover counting remains disabled until reviewed replacements and an exact overlap-safe cutover capture are source-pinned.'
  return {
    ...values,
    fetchedAt: new Date().toISOString(),
    baseline: PLATFORM_ACTIVITY_BASELINE,
    breakdown: buildBreakdown(values),
    coverage: {
      tokensMinted: { status: 'historical-baseline', note },
      walletsAirdropped: { status: 'historical-baseline', note: `${note} Recipient addresses are not unique people or users.` },
      presalesCreated: { status: 'historical-baseline', note },
      swapsCompleted: { status: 'historical-baseline', note },
      onChainMessages: { status: 'historical-baseline', note },
    },
  }
}

async function computeSnapshot(): Promise<PlatformStatsSnapshot> {
  const previous = responseCache?.snapshot
  const floor = previous ?? FALLBACK_STATS
  const baselineVerified = await withMetricTimeout(verifyBaselineBlock(), false)
  if (!baselineVerified) {
    return buildFallbackSnapshot(
      floor,
      'Serving the source-pinned counter floor because its contemporaneous block hash could not be reverified.',
    )
  }
  if (!POST_COMPROMISE_REPLACEMENTS_ACTIVE) {
    return buildHistoricalSnapshot()
  }

  const fallbackMetric = (value: number, note: string) => countMetric(value, 'fallback', note)
  const [tokensResult, presalesResult, swapsResult, airdropsResult, messagesResult] = await Promise.allSettled([
    withMetricTimeout(getTokenCount(), fallbackMetric(floor.tokensMinted, 'Token metric timed out; serving the last known value.')),
    withMetricTimeout(getPresalesCount(), fallbackMetric(floor.presalesCreated, 'Presale metric timed out; serving the source-pinned baseline.')),
    withMetricTimeout(getSwapCount(), fallbackMetric(floor.swapsCompleted, 'Swap metric timed out; serving the last known value.')),
    withMetricTimeout(getAirdropWalletCount(), fallbackMetric(floor.walletsAirdropped, 'Airdrop metric timed out; serving the source-pinned baseline.')),
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

  const values = {
    tokensMinted: displayedTokens.value,
    presalesCreated: displayedPresales.value,
    swapsCompleted: displayedSwaps.value,
    walletsAirdropped: displayedAirdrops.value,
    onChainMessages: displayedMessages.value,
  }

  return {
    ...values,
    fetchedAt: new Date().toISOString(),
    baseline: PLATFORM_ACTIVITY_BASELINE,
    breakdown: buildBreakdown(values),
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
