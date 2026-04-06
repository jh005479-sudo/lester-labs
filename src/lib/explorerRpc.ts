export const LITVM_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http'
export const LITVM_EXPLORER_URL = 'https://liteforge.explorer.caldera.xyz'

type JsonRpcResponse<T> = {
  jsonrpc: string
  id: number
  result?: T
  error?: { code: number; message: string }
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(LITVM_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`)
  const data = (await res.json()) as JsonRpcResponse<T>
  if (data.error) throw new Error(data.error.message)
  if (data.result === undefined) throw new Error('RPC returned no result')
  return data.result
}

export const hexToNumber = (value?: string | null) => (value ? parseInt(value, 16) : 0)
export const hexToBigInt = (value?: string | null) => (value ? BigInt(value) : 0n)

export const formatAddress = (addr?: string | null) => {
  if (!addr) return 'Contract Creation'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export const formatEtherFromHex = (value?: string | null) => {
  const wei = hexToBigInt(value)
  const whole = Number(wei) / 1e18
  if (whole === 0) return '0'
  if (whole < 0.0001) return whole.toExponential(2)
  return whole.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

export async function getLatestBlockNumber() {
  return hexToNumber(await rpc<string>('eth_blockNumber', []))
}

export async function getBlockByNumber(blockNumber: number, full = true) {
  return rpc<any>('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, full])
}

export async function getTransactionByHash(hash: string) {
  return rpc<any>('eth_getTransactionByHash', [hash])
}

export async function getTransactionReceipt(hash: string) {
  return rpc<any>('eth_getTransactionReceipt', [hash])
}

export async function getRecentBlocks(count = 8) {
  const latest = await getLatestBlockNumber()
  const numbers = Array.from({ length: count }, (_, i) => latest - i).filter((n) => n >= 0)
  return Promise.all(numbers.map((n) => getBlockByNumber(n, true)))
}
