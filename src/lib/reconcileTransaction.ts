import { keccak256, decodeEventLog, parseAbiItem } from 'viem'
import { TOKEN_FACTORY_ADDRESS } from '../config/contracts.ts'
import type { TrackedTransaction } from './transactionHistory.ts'

interface ReceiptReader {
  getTransactionReceipt(args: { hash: `0x${string}` }): Promise<{ from: string; to: string | null; blockNumber: bigint; blockHash: string; status: 'success' | 'reverted'; logs?: Array<{ address: string; topics: readonly `0x${string}`[]; data: `0x${string}` }> }>
  getBlockNumber(): Promise<bigint>
  getBlock(args: { blockNumber: bigint }): Promise<{ hash: string | null }>
  getTransaction(args: { hash: `0x${string}` }): Promise<{ input: `0x${string}`; value: bigint }>
}

/** Discovery failures leave the transaction pending. This function never submits or retries a write. */
export async function reconcileTransaction(entry: TrackedTransaction, client: ReceiptReader): Promise<TrackedTransaction | null> {
  if (entry.stage !== 'submitted' || !entry.hash) return null
  try {
    const receipt = await client.getTransactionReceipt({ hash: entry.hash })
    if (receipt.from.toLowerCase() !== entry.account.toLowerCase() || receipt.to?.toLowerCase() !== entry.target.toLowerCase()) return null
    if (await client.getBlockNumber() < receipt.blockNumber + 1n) return null
    const block = await client.getBlock({ blockNumber: receipt.blockNumber })
    if (block.hash !== receipt.blockHash) return null
    if (entry.inputHash) {
      const transaction = await client.getTransaction({ hash: entry.hash })
      if (keccak256(transaction.input) !== entry.inputHash || transaction.value.toString() !== entry.value) return null
    }
    let created: {asset?: string; projectName?: string} = {}
    if (receipt.status === 'success' && entry.action === 'createToken' && entry.target.toLowerCase() === TOKEN_FACTORY_ADDRESS.toLowerCase()) {
      for (const log of receipt.logs ?? []) {
        if (log.address.toLowerCase() !== TOKEN_FACTORY_ADDRESS.toLowerCase()) continue
        try {
          const {args} = decodeEventLog({abi:[parseAbiItem('event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)')],data:log.data,topics:log.topics as [`0x${string}`, ...`0x${string}`[]]})
          if (args.creator.toLowerCase() === entry.account.toLowerCase()) { created = {asset:args.tokenAddress,projectName:args.name.slice(0,50)}; break }
        } catch { /* Unrelated receipt event. */ }
      }
    }
    return { ...entry, ...created, stage: receipt.status === 'success' ? 'confirmed' : 'reverted', updatedAt: Date.now() }
  } catch { return null }
}
