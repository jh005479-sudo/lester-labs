// Governance contract addresses — deployed on LitVM testnet (chain 4441)
// Deploy with: cd contracts && npx hardhat run scripts/deploy_governance.ts --network litvm
// Updated post-deployment with real addresses.

import { erc20Abi } from 'viem'

export const GOVERNANCE_CONFIG = {
  // Single on-chain governance space
  space: {
    name: 'LitVM Governance',
    slug: 'litvm.gov',
    description: 'On-chain governance for the LitVM ecosystem',
    icon: 'bolt' as const,
  },

  // Governance token (ERC20Votes)
  token: {
    address: '0x0000000000000000000000000000000000000001' as const, // TODO: update after deploy
    symbol: 'LGT',
    name: 'Lit Governance Token',
    decimals: 18,
    abi: erc20Abi,
  },

  // Governor + Timelock
  governor: {
    address: '0x0000000000000000000000000000000000000002' as const, // TODO: update after deploy
  },
  timelock: {
    address: '0x0000000000000000000000000000000000000003' as const, // TODO: update after deploy
  },
} as const

// Governor ABI (subset of IGovernor + LitGovernor custom view functions)
export const GOVERNOR_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'proposalCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'proposals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'snapshotBlock', type: 'uint64' },
          { name: 'startTime', type: 'uint64' },
          { name: 'endTime', type: 'uint64' },
          { name: 'proposer', type: 'address' },
          { name: 'canceled', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'proposalDetails',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'targets', type: 'address[]' },
          { name: 'values', type: 'uint256[]' },
          { name: 'calldatas', type: 'bytes[]' },
          { name: 'description', type: 'string' },
        ],
      },
    ],
  },
  {
    name: 'state',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'castVote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'castVoteWithReason',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'quorum',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'proposalThreshold',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'votingDelay',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'votingPeriod',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'hasVoted',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'propose',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'description', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const PROPOSAL_STATES = [
  'Pending',
  'Active',
  'Defeated',
  'Succeeded',
  'Queued',
  'Executed',
  'Canceled',
] as const

export type ProposalState = (typeof PROPOSAL_STATES)[number]

export const SUPPORT_LABELS: Record<number, string> = {
  0: 'Against',
  1: 'For',
  2: 'Abstain',
}
