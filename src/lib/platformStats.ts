import { createPublicClient, decodeFunctionData, http, parseAbiItem, toFunctionSelector, type Address, type Hex } from 'viem'
import { litvm } from '@/config/chains'
import {
  DISPERSE_ADDRESS,
  ILO_FACTORY_ADDRESS,
  LEDGER_ADDRESS,
  TOKEN_FACTORY_ADDRESS,
  UNISWAP_V2_ROUTER_ADDRESS,
  isValidContractAddress,
} from '@/config/contracts'
import { ILO_FACTORY_ABI, LEDGER_ABI } from '@/config/abis'
import { DISPERSE_ABI } from '@/lib/contracts/airdrop'
import { RPC_URL } from '@/lib/rpcClient'

// Public RPC fallback — use when infra RPC eth_call reverts
const PUBLIC_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http'

// Explorer-based event counting constants
const EXPLORER_API_BASE_URL = 'https://liteforge.explorer.caldera.xyz/api'

const MESSAGE_POSTED_EVENT = parseAbiItem(
  'event MessagePosted(address indexed sender, uint256 indexed index, uint256 timestamp, bytes data)',
)

const LEGACY_ILO_FACTORY_ADDRESS = '0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB' as const
const DEFAULT_TOKEN_FACTORY_ADDRESS = '0x93acc61fcdc2e3407A0c03450Adfd8aE78964948' as const
const DEFAULT_DISPERSE_ADDRESS = '0x3cc66cb4713dca78564df512922adb331ac5ee04' as const
const DEFAULT_LEDGER_ADDRESS = '0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079' as const
const DEFAULT_UNISWAP_V2_ROUTER_ADDRESS = '0xD56a623890b083d876D47c3b1c5343b7f983FA62' as const

const RESPONSE_TTL_MS = 60_000
const RPC_TIMEOUT_MS = 30_000
const EXPLORER_REQUEST_TIMEOUT_MS = 15_000
const EXPLORER_TXLIST_PAGE_SIZE = 10_000
const EXPLORER_TXLIST_MAX_PAGES = 25

// Public RPC client — fallback when infra RPC eth_call reverts
const publicClient = createPublicClient({
  chain: litvm,
  transport: http(PUBLIC_RPC_URL, {
    retryCount: 2,
    timeout: RPC_TIMEOUT_MS,
  }),
})

// Infra RPC client — primary
const client = createPublicClient({
  chain: litvm,
  transport: http(RPC_URL, {
    retryCount: 2,
    timeout: RPC_TIMEOUT_MS,
  }),
})

const CREATE_TOKEN_FUNCTION_SELECTOR = toFunctionSelector(
  'createToken(string,string,uint256,uint8,bool,bool,bool)',
).toLowerCase()

const CREATE_ILO_FUNCTION_SELECTOR = toFunctionSelector(
  'createILO(address,uint256,uint256,uint256,uint256,uint256,uint256,bool)',
).toLowerCase()

const SWAP_FUNCTION_SELECTORS = new Set<string>([
  'swapExactETHForTokens(uint256,address[],address,uint256)',
  'swapETHForExactTokens(uint256,address[],address,uint256)',
  'swapExactTokensForETH(uint256,uint256,address[],address,uint256)',
  'swapTokensForExactETH(uint256,uint256,address[],address,uint256)',
  'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
  'swapTokensForExactTokens(uint256,uint256,address[],address,uint256)',
  'swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)',
  'swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)',
  'swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)',
].map((signature) => toFunctionSelector(signature).toLowerCase()))



export interface PlatformStatsSnapshot {
  tokensMinted: number
  walletsAirdropped: number
  presalesCreated: number
  swapsCompleted: number
  onChainMessages: number
  fetchedAt: string
}

interface ExplorerTransactionItem {
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
  url.searchParams.set('sort', 'desc')
  return url.toString()
}

async function fetchTxListPage(address: Address, page: number): Promise<ExplorerTransactionItem[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), EXPLORER_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(buildTxListUrl(address, page), {
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Explorer HTTP ${response.status} for txlist ${address}`)
    }

    const payload = (await response.json()) as ExplorerTxListResponse

    if (Array.isArray(payload.result)) {
      return payload.result
    }

    if (typeof payload.result === 'string' && payload.result.toLowerCase().includes('no transactions')) {
      return []
    }

    throw new Error(payload.message || `Unexpected txlist payload for ${address}`)
  } finally {
    clearTimeout(timeoutId)
  }
}

async function walkExplorerTransactions(
  address: Address,
  onPage: (items: ExplorerTransactionItem[]) => void | Promise<void>,
): Promise<void> {
  for (let page = 1; page <= EXPLORER_TXLIST_MAX_PAGES; page += 1) {
    const items = await fetchTxListPage(address, page)
    if (items.length === 0) return

    await onPage(items)

    if (items.length < EXPLORER_TXLIST_PAGE_SIZE) return
  }

  throw new Error(`Explorer txlist pagination limit exceeded for ${address}`)
}

function isSuccessfulExplorerTransaction(transaction: ExplorerTransactionItem): boolean {
  // Caldera explorer: isError='0' means no error (success), isError='1' means error
  // txreceipt_status='1' means success, '0' means failed
  if (transaction.isError === '1') return false
  return transaction.txreceipt_status === null || transaction.txreceipt_status === undefined || transaction.txreceipt_status === '1'
}

function getFunctionSelector(rawInput?: string | null): string | null {
  if (typeof rawInput !== 'string' || rawInput.length < 10) return null
  return rawInput.slice(0, 10).toLowerCase()
}

// eth_call via infra RPC with public RPC fallback
async function rpcCall<T>(fn: (client: ReturnType<typeof createPublicClient>) => Promise<T>, fallbackValue: T): Promise<T> {
  try {
    return await fn(client)
  } catch {
    // Fallback to public RPC if infra RPC reverts
    try {
      return await fn(publicClient)
    } catch {
      return fallbackValue
    }
  }
}

async function safeReadCount(address: Address, abi: typeof ILO_FACTORY_ABI, functionName: 'getILOCount'): Promise<number>
async function safeReadCount(address: Address, abi: typeof LEDGER_ABI, functionName: 'messageCount'): Promise<number>
async function safeReadCount(
  address: Address,
  abi: typeof ILO_FACTORY_ABI | typeof LEDGER_ABI,
  functionName: 'getILOCount' | 'messageCount',
): Promise<number> {
  if (!isValidContractAddress(address)) return 0

  return rpcCall(
    (c) =>
      c.readContract({
        address,
        abi,
        functionName,
      }).then((r) => Number(r)),
    0,
  )
}

async function getTokenCount(): Promise<number> {
  const tokenFactoryAddress = resolveContractAddress(TOKEN_FACTORY_ADDRESS, DEFAULT_TOKEN_FACTORY_ADDRESS)
  if (!tokenFactoryAddress) return 0

  let count = 0

  await walkExplorerTransactions(tokenFactoryAddress, (items) => {
    for (const item of items) {
      if (item.to?.toLowerCase() !== tokenFactoryAddress.toLowerCase()) continue
      if (!isSuccessfulExplorerTransaction(item)) continue

      const selector = getFunctionSelector(item.input)
      if (selector === CREATE_TOKEN_FUNCTION_SELECTOR) {
        count += 1
      }
    }
  })

  return count
}

async function getPresalesCount(): Promise<number> {
  // Primary: eth_call via getILOCount() with RPC fallback
  const addresses = new Map<string, Address>()
  const currentFactory = resolveContractAddress(ILO_FACTORY_ADDRESS, LEGACY_ILO_FACTORY_ADDRESS)
  if (currentFactory) addresses.set(currentFactory.toLowerCase(), currentFactory)
  addresses.set(LEGACY_ILO_FACTORY_ADDRESS.toLowerCase(), LEGACY_ILO_FACTORY_ADDRESS)

  const counts = await Promise.all(
    Array.from(addresses.values()).map((address) => safeReadCount(address, ILO_FACTORY_ABI, 'getILOCount')),
  )
  const rpcCount = counts.reduce((sum, value) => sum + value, 0)
  if (rpcCount > 0) return rpcCount

  // Fallback: count successful createILO txs from explorer
  let explorerCount = 0
  try {
    for (const address of Array.from(addresses.values())) {
      await walkExplorerTransactions(address, (items) => {
        for (const item of items) {
          if (item.to?.toLowerCase() !== address.toLowerCase()) continue
          if (!isSuccessfulExplorerTransaction(item)) continue
          const selector = getFunctionSelector(item.input)
          if (selector === CREATE_ILO_FUNCTION_SELECTOR) {
            explorerCount += 1
          }
        }
      })
    }
  } catch {
    // Explorer unavailable — return 0 rather than throwing
  }

  return explorerCount
}

async function getSwapCount(): Promise<number> {
  const routerAddress = resolveContractAddress(UNISWAP_V2_ROUTER_ADDRESS, DEFAULT_UNISWAP_V2_ROUTER_ADDRESS)
  if (!routerAddress) return 0

  let count = 0

  await walkExplorerTransactions(routerAddress, (items) => {
    for (const item of items) {
      if (item.to?.toLowerCase() !== routerAddress.toLowerCase()) continue
      if (!isSuccessfulExplorerTransaction(item)) continue

      const selector = getFunctionSelector(item.input)
      if (selector && SWAP_FUNCTION_SELECTORS.has(selector)) {
        count += 1
      }
    }
  })

  return count
}

// Both common DISPERSE parameter orderings for disperseToken:
// A: (address token, address[] recipients, uint256[] values) — current codebase
// B: (address token, uint256[] values, address[] recipients) — original DISPERSE.sol
const DISPERSE_ABI_VARIANT_A = [
  {
    name: 'disperseToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    outputs: [],
  },
] as const

const DISPERSE_ABI_VARIANT_B = [
  {
    name: 'disperseToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'values', type: 'uint256[]' },
      { name: 'recipients', type: 'address[]' },
    ],
    outputs: [],
  },
] as const

async function getAirdropWalletCount(): Promise<number> {
  const disperseAddress = resolveContractAddress(DISPERSE_ADDRESS, DEFAULT_DISPERSE_ADDRESS)
  if (!disperseAddress) return 0

  const recipients = new Set<string>()
  let decodeSucceeded = false

  for (const abiVariant of [DISPERSE_ABI_VARIANT_A, DISPERSE_ABI_VARIANT_B] as const) {
    try {
      await walkExplorerTransactions(disperseAddress, (items) => {
        for (const item of items) {
          if (item.to?.toLowerCase() !== disperseAddress.toLowerCase()) continue
          if (!isSuccessfulExplorerTransaction(item)) continue
          if (typeof item.input !== 'string' || item.input === '0x') continue

          try {
            const decoded = decodeFunctionData({
              abi: abiVariant,
              data: item.input as Hex,
            })

            if (decoded.functionName === 'disperseToken') {
              // args[0] = recipients (variant A), args[1] = values
              const rawArgs = decoded.args as unknown as readonly unknown[]
              const recipientsArg = rawArgs[0]
              if (Array.isArray(recipientsArg)) {
                for (const recipient of recipientsArg) {
                  if (typeof recipient === 'string') {
                    recipients.add(recipient.toLowerCase())
                  }
                }
                decodeSucceeded = true
              }
            }
          } catch {
            // Try next variant
          }
        }
      })
      if (decodeSucceeded) break
    } catch {
      // Explorer unavailable
    }
  }

  return recipients.size
}

async function getOnChainMessageCount(): Promise<number> {
  const ledgerAddress = resolveContractAddress(LEDGER_ADDRESS, DEFAULT_LEDGER_ADDRESS)
  if (!ledgerAddress) return 0

  // Primary: eth_call
  const rpcCount = await safeReadCount(ledgerAddress, LEDGER_ABI, 'messageCount')
  if (rpcCount > 0) return rpcCount

  // Fallback: count MessagePosted events via explorer
  let explorerCount = 0
  try {
    await walkExplorerTransactions(ledgerAddress, (items) => {
      for (const item of items) {
        if (item.to?.toLowerCase() !== ledgerAddress.toLowerCase()) continue
        if (!isSuccessfulExplorerTransaction(item)) continue
        // Successful tx to ledger that isn't a simple transfer = post() call
        if (typeof item.input === 'string' && item.input !== '0x' && item.input.length > 10) {
          explorerCount += 1
        }
      }
    })
  } catch {
    // Explorer unavailable
  }

  return explorerCount
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
