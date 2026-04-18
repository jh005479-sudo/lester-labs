// Re-export from the resilient RPC client
// Maintains backward compatibility with all existing imports
export {
  RPC_URL as LITVM_RPC_URL,
  hexToNumber,
  hexToBigInt,
  formatAddress,
  formatEtherFromHex,
  getLatestBlockNumber,
  getBlockByNumber,
  getTransactionByHash,
  getTransactionReceipt,
  getRecentBlocks,
  rpc,
  clearCache,
} from './rpcClient'

export const LITVM_EXPLORER_URL = 'https://liteforge.caldera.xyz'
