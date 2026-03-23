export const TOKEN_FACTORY_ABI = [
  {
    name: 'createToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'decimals', type: 'uint8' },
      { name: 'mintable', type: 'bool' },
      { name: 'burnable', type: 'bool' },
      { name: 'pausable', type: 'bool' },
    ],
    outputs: [{ name: 'tokenAddress', type: 'address' }],
  },
  // RP-003: Fee getter view function
  {
    name: 'creationFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'TokenCreated',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
  },
] as const

// Re-export from centralized config
export { TOKEN_FACTORY_ADDRESS } from '@/config/contracts'

// Creation fee: 0.05 zkLTC (in wei)
export const CREATION_FEE = BigInt('50000000000000000') // 0.05 * 10^18
