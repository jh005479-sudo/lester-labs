import { decodeEventLog, formatEther, hexToBytes, keccak256, stringToHex, type Address, type Hex } from 'viem'
import { litvm } from '@/config/chains'
import { LEDGER_ABI } from '@/config/abis'

export { LEDGER_ABI } from '@/config/abis'
export { LEDGER_ADDRESS } from '@/config/contracts'

export const LEDGER_MAX_MESSAGE_BYTES = 1024
export const LEDGER_PAGE_SIZE = 50
export const LEDGER_POLL_INTERVAL_MS = 30_000
export const LEDGER_RECONNECT_DELAY_MS = 5_000
export const LEDGER_HISTORY_BLOCK_WINDOW = 20_000
export const LEDGER_DEFAULT_FEE = 10_000_000_000_000_000n
export const LEDGER_POST_GAS_LIMIT = 150_000n
export const LEDGER_MESSAGE_POSTED_SIGNATURE = 'MessagePosted(address,uint256,uint256,bytes)'
export const LEDGER_MESSAGE_POSTED_TOPIC = keccak256(stringToHex(LEDGER_MESSAGE_POSTED_SIGNATURE))
export const LEDGER_EXPLORER_BASE_URL = litvm.blockExplorers.default.url
export const LEDGER_WS_URL = litvm.rpcUrls.default.webSocket?.[0] ?? 'wss://liteforge.rpc.caldera.xyz/ws'

const utf8Decoder = new TextDecoder()

export type LedgerRpcLog = {
  address?: Address
  blockHash?: Hex | null
  blockNumber?: Hex | null
  data: Hex
  logIndex?: Hex | null
  removed?: boolean
  topics: Hex[]
  transactionHash?: Hex | null
}

export type LedgerMessage = {
  id: string
  sender: Address
  index: bigint
  timestamp: number
  text: string
  txHash?: Hex
  blockHash?: Hex
  blockNumber?: bigint
  logIndex?: bigint
  isHighlighted?: boolean
}

export function formatLedgerFee(fee?: bigint | null): string {
  return formatEther(fee ?? LEDGER_DEFAULT_FEE)
}

export function padAddressTopic(address: Address): Hex {
  return `0x${address.slice(2).padStart(64, '0')}` as Hex
}

export function decodeLedgerMessage(data: Hex): string {
  try {
    return utf8Decoder.decode(hexToBytes(data)).replace(/\0+$/, '')
  } catch {
    return ''
  }
}

export function decodeLedgerLog(log: LedgerRpcLog): LedgerMessage | null {
  if (log.removed) return null
  if (!log.topics.length) return null

  try {
    const decoded = decodeEventLog({
      abi: LEDGER_ABI,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
      strict: false,
    })

    if (decoded.eventName !== 'MessagePosted') {
      return null
    }

    const sender = decoded.args.sender as Address
    const index = decoded.args.index as bigint
    const timestamp = Number(decoded.args.timestamp as bigint)
    const messageData = decoded.args.data as Hex

    return {
      id: index.toString(),
      sender,
      index,
      timestamp,
      text: decodeLedgerMessage(messageData),
      txHash: log.transactionHash ?? undefined,
      blockHash: log.blockHash ?? undefined,
      blockNumber: log.blockNumber ? BigInt(log.blockNumber) : undefined,
      logIndex: log.logIndex ? BigInt(log.logIndex) : undefined,
      isHighlighted: false,
    }
  } catch {
    return null
  }
}

export function compareLedgerMessages(a: LedgerMessage, b: LedgerMessage): number {
  if (a.index !== b.index) {
    return a.index > b.index ? -1 : 1
  }

  if ((a.blockNumber ?? 0n) !== (b.blockNumber ?? 0n)) {
    return (a.blockNumber ?? 0n) > (b.blockNumber ?? 0n) ? -1 : 1
  }

  if ((a.logIndex ?? 0n) !== (b.logIndex ?? 0n)) {
    return (a.logIndex ?? 0n) > (b.logIndex ?? 0n) ? -1 : 1
  }

  return 0
}
