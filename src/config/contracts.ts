// Contract addresses loaded from environment variables
// Utility addresses default to zero if not set; DEX addresses default to the live LitVM testnet deployment.

const LITVM_TESTNET_UNISWAP_V2_FACTORY_ADDRESS = '0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8'
const LITVM_TESTNET_UNISWAP_V2_ROUTER_ADDRESS = '0xD56a623890b083d876D47c3b1c5343b7f983FA62'
const LITVM_TESTNET_WRAPPED_ZKLTC_ADDRESS = '0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97'

export const ILO_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_ILO_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const TOKEN_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const VESTING_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_VESTING_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const LIQUIDITY_LOCKER_ADDRESS = (process.env.NEXT_PUBLIC_LIQUIDITY_LOCKER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const DISPERSE_ADDRESS = (process.env.NEXT_PUBLIC_DISPERSE_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const LEDGER_ADDRESS = (process.env.NEXT_PUBLIC_LEDGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const UNISWAP_V2_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_UNISWAP_V2_FACTORY_ADDRESS || LITVM_TESTNET_UNISWAP_V2_FACTORY_ADDRESS) as `0x${string}`

export const UNISWAP_V2_ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_UNISWAP_V2_ROUTER_ADDRESS || LITVM_TESTNET_UNISWAP_V2_ROUTER_ADDRESS) as `0x${string}`

export const WRAPPED_ZKLTC_ADDRESS = (process.env.NEXT_PUBLIC_WRAPPED_ZKLTC_ADDRESS || LITVM_TESTNET_WRAPPED_ZKLTC_ADDRESS) as `0x${string}`

export const LESTER_TREASURY_ADDRESS = '0xDD221FBbCb0f6092AfE51183d964AA89A968eE13' as const

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Runtime guard: returns true if the address is valid (non-zero and properly formatted)
 */
export function isValidContractAddress(address: string | undefined): boolean {
  if (!address) return false
  if (address === ZERO_ADDRESS) return false
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

/**
 * Throws if any required contract address is not configured
 */
export function requireContractAddresses(addresses: Record<string, string>): void {
  for (const [name, address] of Object.entries(addresses)) {
    if (!isValidContractAddress(address)) {
      throw new Error(`Contract address not configured: ${name}. Please set the corresponding NEXT_PUBLIC_* environment variable.`)
    }
  }
}
