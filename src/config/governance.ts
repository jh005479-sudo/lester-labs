// Governance contract addresses — deployed on LitVM testnet (chain 4441)
// Deploy with: cd contracts && npm run deploy:governance:litvm

import { erc20Abi } from 'viem'
import {
  APPROVED_GOVERNANCE_TIMELOCK_ADDRESS,
  APPROVED_GOVERNANCE_TOKEN_ADDRESS,
  APPROVED_GOVERNOR_ADDRESS,
  LITVM_COMPROMISED_LEGACY_GOVERNANCE,
  POST_COMPROMISE_GOVERNANCE_ACTIVE,
} from './contracts.ts'

// Extended ERC20 ABI covering both standard ERC20 and ERC20Votes (delegation/voting power)
const VOTES_ABI = [
  // Standard ERC20
  ...erc20Abi,
  // ERC20Votes: delegation
  {
    name: 'delegate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'delegatee', type: 'address' }],
    outputs: [],
  },
  {
    name: 'delegateBySig',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'delegatee', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  // ERC20Votes: voting power
  {
    name: 'getVotes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getPastVotes',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'blockNumber', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getPastTotalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'blockNumber', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const GOVERNANCE_CONFIG = {
  // Single on-chain governance space
  space: {
    name: 'LitVM Governance',
    slug: 'litvm.gov',
    description: 'On-chain governance for the LitVM ecosystem',
    icon: 'bolt' as const,
    explorerUrl: 'https://lester-labs.com/explorer',
  },

  // Governance token (ERC20Votes)
  token: {
    address: APPROVED_GOVERNANCE_TOKEN_ADDRESS ?? LITVM_COMPROMISED_LEGACY_GOVERNANCE.token,
    symbol: 'LGT',
    name: 'Lit Governance Token',
    decimals: 18,
    abi: VOTES_ABI,
  },

  // Governor + Timelock
  governor: {
    address: APPROVED_GOVERNOR_ADDRESS ?? LITVM_COMPROMISED_LEGACY_GOVERNANCE.governor,
  },
  timelock: {
    address: APPROVED_GOVERNANCE_TIMELOCK_ADDRESS ?? LITVM_COMPROMISED_LEGACY_GOVERNANCE.timelock,
  },
  deploymentStatus: POST_COMPROMISE_GOVERNANCE_ACTIVE
    ? 'reviewed-post-compromise-active'
    : 'retired-compromised-read-only',
} as const

// Governor ABI (subset of IGovernor + LitGovernor view functions)
export const GOVERNOR_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'proposalCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  {
    name: 'proposals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'tuple', components: [
      { name: 'snapshotBlock', type: 'uint64' },
      { name: 'startBlock', type: 'uint64' },
      { name: 'endBlock', type: 'uint64' },
      { name: 'proposer', type: 'address' },
      { name: 'canceled', type: 'bool' },
    ]}],
  },
  {
    name: 'proposalDetails',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'tuple', components: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'calldatas', type: 'bytes[]' },
      { name: 'description', type: 'string' },
    ]}],
  },
  { name: 'state', type: 'function', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'castVote', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'support', type: 'uint8' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'castVoteWithReason', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'support', type: 'uint8' }, { name: 'reason', type: 'string' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'quorum', type: 'function', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'proposalThreshold', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'votingDelay', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'votingPeriod', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'hasVoted', type: 'function', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'account', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'propose', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'targets', type: 'address[]' },
    { name: 'values', type: 'uint256[]' },
    { name: 'calldatas', type: 'bytes[]' },
    { name: 'description', type: 'string' },
  ], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'queue', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [] },
  { name: 'execute', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [] },
  { name: 'timelockId', type: 'function', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ name: '', type: 'bytes32' }] },
  { name: 'cancel', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [] },
] as const

export const PROPOSAL_STATES = ['Pending', 'Active', 'Defeated', 'Succeeded', 'Queued', 'Executed', 'Canceled'] as const
export type ProposalState = (typeof PROPOSAL_STATES)[number]

export const SUPPORT_LABELS: Record<number, string> = { 0: 'Against', 1: 'For', 2: 'Abstain' }
