import { createPublicClient, http, parseAbiItem, toFunctionSelector, type Address, type Hex } from 'viem'
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
import { DISPERSE_ABI } from '@/lib/contracts/airdrop'
import { RPC_URL } from '@/lib/rpcClient'

// Deployed DISPERSE selector hashes (confirmed from bytecode PUSH4 opcodes on-chain)
const DISPERSE_TOKEN_SELECTOR = toFunctionSelector('disperseToken(address,address[],uint256[])').toLowerCase()
const DISPERSE_ETHER_SELECTOR = toFunctionSelector('disperseEther(address[],uint256[])').toLowerCase()

/**
 * Decode recipient addresses from raw DISPERSE calldata.
 * Uses manual parsing to avoid viem's BigInt safe-integer overflow on large uint256 values.
 */
function decodeAirdropRecipients(calldata: Hex): string[] {
  const h = calldata.slice(10)
  const selector = calldata.slice(0, 10).toLowerCase()

  try {
    if (selector === DISPERSE_TOKEN_SELECTOR) {
      // disperseToken(address token, address[] recipients, uint256[] values)
      // Layout: token(32b) | offset_recip(32b) | offset_vals(32b) | count_recip | recipients | count_vals | values
      const offsetRecip = Number(BigInt('0x' + h.slice(64, 128)))
      const countRecip = Number(BigInt('0x' + h.slice(offsetRecip * 2, offsetRecip * 2 + 64)))
      const result: string[] = []
      for (let i = 0; i < Math.min(countRecip, 500); i++) {
        const charPos = (offsetRecip + 32 + i * 32) * 2
        if (charPos + 64 > h.length) break
        const addr = h.slice(charPos + 24, charPos + 64)
        if (!addr.startsWith('0000')) result.push('0x' + addr)
      }
      return result
    } else if (selector === DISPERSE_ETHER_SELECTOR) {
      // disperseEther(address[] recipients, uint256[] values)
      // Layout: offset_recip(32b) | offset_vals(32b) | count_recip | recipients
      const offsetRecip = Number(BigInt('0x' + h.slice(0, 64)))
      const countRecip = Number(BigInt('0x' + h.slice(offsetRecip * 2, offsetRecip * 2 + 64)))
      const result: string[] = []
      for (let i = 0; i < Math.min(countRecip, 500); i++) {
        const charPos = (offsetRecip + 32 + i * 32) * 2
        if (charPos + 64 > h.length) break
        const addr = h.slice(charPos + 24, charPos + 64)
        if (!addr.startsWith('0000')) result.push('0x' + addr)
      }
      return result
    }
  } catch {
    // Malformed calldata — skip
  }
  return []
}

const EXPLORER_API_BASE_URL = 'https://liteforge.explorer.caldera.xyz/api'
const LEGACY_ILO_FACTORY_ADDRESS = '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' as const
const DEFAULT_TOKEN_FACTORY_ADDRESS = '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' as const
const DEFAULT_DISPERSE_ADDRESS = '0x3cc66cb4713dca78564df512922adb331ac5ee04' as const
const DEFAULT_LEDGER_ADDRESS = '0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079' as const
const DEFAULT_UNISWAP_V2_FACTORY_ADDRESS = '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8' as const
const DEFAULT_UNISWAP_V2_ROUTER_ADDRESS = '0xD56a623890b083d876D47c3b1c5343b7f983FA62' as const

const RESPONSE_TTL_MS = 60_000
const RPC_TIMEOUT_MS = 30_000
const EXPLORER_REQUEST_TIMEOUT_MS = 7_000
const EXPLORER_REQUEST_RETRIES = 3
const EXPLORER_TXLIST_PAGE_SIZE = 100
const EXPLORER_TXLIST_MAX_PAGES = 50
const SWAP_ADDRESS_BATCH_SIZE = 20

const TOKEN_CREATED_EVENT = parseAbiItem(
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)',
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

interface ExplorerTransactionItem {
  hash?: string | null
  to?: string | null
  input?: string | null
  isError?: string | null
  txreceipt_status?: string | null
}

interface ExplorerTxListResponse {
  status?: string
  message?: string
  result?: ExplorerTransactionItem[] | string
}

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

function resolveContractAddress(configuredAddress: Address, fallbackAddress?: Address): Address | null {
  if (isValidContractAddress(configuredAddress)) return configuredAddress
  if (fallbackAddress && isValidContractAddress(fallbackAddress)) return fallbackAddress
  return null
}

function buildTxListUrl(address: Address, page: number): string {
  const url = new URL(EXPLORER_API_BASE_URL)
  url.searchParams.set('module', 'account')
  url.searchParams.set('action', 'txlist')
  url.searchParams.set('address', address)
  url.searchParams.set('page', String(page))
  url.searchParams.set('offset', String(EXPLORER_TXLIST_PAGE_SIZE))
  url.searchParams.set('sort', 'asc')
  return url.toString()
}

async function fetchTxListPage(address: Address, page: number): Promise<ExplorerTransactionItem[]> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= EXPLORER_REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), EXPLORER_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(buildTxListUrl(address, page), {
        signal: controller.signal,
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Explorer HTTP ${response.status} for txlist ${address} page ${page}`)
      }

      const payload = (await response.json()) as ExplorerTxListResponse

      if (Array.isArray(payload.result)) {
        return payload.result
      }

      if (typeof payload.result === 'string' && payload.result.toLowerCase().includes('no transactions')) {
        return []
      }

      throw new Error(payload.message || `Unexpected txlist payload for ${address} page ${page}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt === EXPLORER_REQUEST_RETRIES) break
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError ?? new Error(`Explorer txlist failed for ${address} page ${page}`)
}

async function walkExplorerTransactions(
  address: Address,
  onPage: (items: ExplorerTransactionItem[]) => void | boolean | Promise<void | boolean>,
): Promise<void> {
  for (let page = 1; page <= EXPLORER_TXLIST_MAX_PAGES; page += 1) {
    const items = await fetchTxListPage(address, page)
    if (items.length === 0) return

    const shouldContinue = await onPage(items)
    if (shouldContinue === false) return

    if (items.length < EXPLORER_TXLIST_PAGE_SIZE) return
  }

  throw new Error(`Explorer txlist pagination limit exceeded for ${address}`)
}

function isSuccessfulExplorerTransaction(transaction: ExplorerTransactionItem): boolean {
  if (transaction.isError !== '0') return false
  return transaction.txreceipt_status === null || transaction.txreceipt_status === undefined || transaction.txreceipt_status === '1'
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

  const logs = await client.getLogs({
    address: tokenFactoryAddress,
    event: TOKEN_CREATED_EVENT,
    fromBlock: 0n,
    toBlock: 'latest',
  })

  return logs.length
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

  const pairAddresses = await getPairAddresses(factoryAddress)
  if (pairAddresses.length === 0) return 0

  let count = 0

  for (const batch of chunk(pairAddresses, SWAP_ADDRESS_BATCH_SIZE)) {
    const logs = await client.getLogs({
      address: batch,
      event: SWAP_EVENT,
      fromBlock: 0n,
      toBlock: 'latest',
    })
    count += logs.length
  }

  return count
}

async function getAirdropWalletCount(): Promise<number> {
  const disperseAddress = resolveContractAddress(DISPERSE_ADDRESS, DEFAULT_DISPERSE_ADDRESS)
  if (!disperseAddress) return 0

  const recipients = new Set<string>()
  const seenHashes = new Set<string>()

  await walkExplorerTransactions(disperseAddress, (items) => {
    let newHashes = 0

    for (const item of items) {
      if (item.to?.toLowerCase() !== disperseAddress.toLowerCase()) continue
      if (!isSuccessfulExplorerTransaction(item)) continue
      if (typeof item.input !== 'string' || item.input === '0x') continue
      if (typeof item.hash === 'string') {
        if (seenHashes.has(item.hash)) continue
        seenHashes.add(item.hash)
        newHashes += 1
      }

      const recipientsArg = decodeAirdropRecipients(item.input as Hex)
      for (const recipient of recipientsArg) {
        if (typeof recipient === 'string') {
          recipients.add(recipient.toLowerCase())
        }
      }
    }

    if (newHashes === 0) {
      return false
    }
  })

  return recipients.size
}

async function getOnChainMessageCount(): Promise<number> {
  const ledgerAddress = resolveContractAddress(LEDGER_ADDRESS, DEFAULT_LEDGER_ADDRESS)
  if (!ledgerAddress) return 0

  return safeReadCount(ledgerAddress, LEDGER_ABI, 'messageCount')
}

async function computeSnapshot(): Promise<PlatformStatsSnapshot> {
  const previous = responseCache?.snapshot

  const [tokensResult, presalesResult, swapsResult, airdropsResult, messagesResult] = await Promise.allSettled([
    getTokenCount(),
    getPresalesCount(),
    getSwapCount(),
    getAirdropWalletCount(),
    getOnChainMessageCount(),
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
