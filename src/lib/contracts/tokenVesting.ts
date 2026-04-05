export const VESTING_FACTORY_ABI = [
  {
    name: 'createVestingSchedule',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'beneficiary', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'cliffDuration', type: 'uint256' },
      { name: 'vestingDuration', type: 'uint256' },
      { name: 'revocable', type: 'bool' }, // Contract param exists but is ignored on-chain (F-011)
    ],
    outputs: [{ name: 'vestingId', type: 'uint256' }],
  },
  // RP-003: Fee getter view function
  {
    name: 'vestingFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'VestingCreated',
    inputs: [
      { name: 'vestingId', type: 'uint256', indexed: true },
      { name: 'vestingWallet', type: 'address', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
    ],
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
export { VESTING_FACTORY_ADDRESS } from '@/config/contracts'

// Flat fee: 0.03 zkLTC
export const VESTING_FEE = BigInt('30000000000000000')
