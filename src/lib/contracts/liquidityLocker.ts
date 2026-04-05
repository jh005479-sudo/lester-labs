export const LIQUIDITY_LOCKER_ABI = [
  {
    name: 'lockLiquidity',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'withdrawer', type: 'address' },
    ],
    outputs: [{ name: 'lockId', type: 'uint256' }],
  },
  // RP-003: Fee getter view function
  {
    name: 'lockFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getLock',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'lockId', type: 'uint256' }],
    outputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'withdrawer', type: 'address' },
      { name: 'withdrawn', type: 'bool' },
    ],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'lockId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'event',
    name: 'LockCreated',
    inputs: [
      { name: 'lockId', type: 'uint256', indexed: true },
      { name: 'lpToken', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'unlockTime', type: 'uint256', indexed: false },
      { name: 'withdrawer', type: 'address', indexed: false },
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
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Re-export from centralized config
export { LIQUIDITY_LOCKER_ADDRESS } from '@/config/contracts'

// Flat fee: 0.03 zkLTC
export const LOCK_FEE = BigInt('30000000000000000')
