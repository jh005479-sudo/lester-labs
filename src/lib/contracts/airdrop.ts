export const DISPERSE_ABI = [
  {
    // Send ETH/native token to multiple addresses
    name: 'disperseEther',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    // Send ERC-20 tokens to multiple addresses
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

export const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Re-export from centralized config
export { DISPERSE_ADDRESS } from '@/config/contracts'

// Fee: 0.01 zkLTC per batch
export const AIRDROP_FEE = BigInt('10000000000000000')
