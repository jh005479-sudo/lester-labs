'use client'

import { useState, useCallback } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther } from 'viem'
import { GOVERNANCE_CONFIG, GOVERNOR_ABI, PROPOSAL_STATES, SUPPORT_LABELS, type ProposalState } from '@/config/governance'
import { useLitvmNetwork } from '@/hooks/useLitvmNetwork'

export interface Proposal {
  id: number
  description: string
  state: ProposalState
  proposer: string
  forVotes: string
  againstVotes: string
  abstainVotes: string
  quorumMet: boolean
  startBlock: number
  endBlock: number
  hasVoted: boolean
  support: number // 0=against, 1=for, 2=abstain (user's vote)
}

export interface Space {
  name: string
  slug: string
  token: string
  members: number
  proposals: number
  icon: 'bolt' | 'diamond' | 'flask' | 'hardhat'
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useGovernance() {
  const { address, isConnected } = useAccount()

  // ── Static config ─────────────────────────────────────────────────────
  const { space, token: tokenConfig, governor: governorConfig } = GOVERNANCE_CONFIG

  // ── Contract reads ────────────────────────────────────────────────────
  const proposalCountRead = useReadContract({
    address: governorConfig.address,
    abi: GOVERNOR_ABI,
    functionName: 'proposalCount',
    query: { refetchInterval: 30_000 },
  })

  const proposalThresholdRead = useReadContract({
    address: governorConfig.address,
    abi: GOVERNOR_ABI,
    functionName: 'proposalThreshold',
    query: { refetchInterval: 60_000 },
  })

  // Use getVotes (delegated power), NOT balanceOf — the contract requires voting power, not raw balance
  const tokenBalanceRead = useReadContract({
    address: tokenConfig.address,
    abi: tokenConfig.abi,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  })

  // ── Derive proposals ───────────────────────────────────────────────────
  const proposalCount = Number(proposalCountRead.data ?? 0)

  // Build multi-call for all proposal IDs
  const proposalCalls = Array.from({ length: Math.max(0, proposalCount) }, (_, i) => [
    { address: governorConfig.address, abi: GOVERNOR_ABI, functionName: 'state', args: [BigInt(i + 1)] },
    { address: governorConfig.address, abi: GOVERNOR_ABI, functionName: 'proposals', args: [BigInt(i + 1)] },
    { address: governorConfig.address, abi: GOVERNOR_ABI, functionName: 'proposalDetails', args: [BigInt(i + 1)] },
  ]).flat()

  const allProposalData = useReadContracts({
    contracts: proposalCalls.map((call) => ({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
    })),
    query: { enabled: proposalCount > 0, refetchInterval: 30_000 },
  })

  // Build user-vote calls
  const userVoteCalls = address
    ? Array.from({ length: proposalCount }, (_, i) => ({
        address: governorConfig.address,
        abi: GOVERNOR_ABI,
        functionName: 'hasVoted',
        args: [BigInt(i + 1), address],
      }))
    : []

  const userVotesData = useReadContracts({
    contracts: userVoteCalls,
    query: { enabled: isConnected && !!address && proposalCount > 0, refetchInterval: 30_000 },
  })

  // ── Build proposal list ───────────────────────────────────────────────
  const proposals: Proposal[] = []
  for (let i = 0; i < proposalCount; i++) {
    const stateResult = allProposalData.data?.[i * 3]?.result as number | undefined
    const proposalResult = allProposalData.data?.[i * 3 + 1]?.result as
      | { snapshotBlock: bigint; startBlock: bigint; endBlock: bigint; proposer: string; canceled: boolean }
      | undefined
    const detailResult = allProposalData.data?.[i * 3 + 2]?.result as
      | { targets: `0x${string}`[]; values: bigint[]; calldatas: `0x${string}`[]; description: string }
      | undefined

    if (!proposalResult || !detailResult) continue

    const stateIndex = Math.min(stateResult ?? 0, PROPOSAL_STATES.length - 1)
    const description = detailResult.description.split('\n')[0] ?? `Proposal #${i + 1}`

    proposals.push({
      id: i + 1,
      description,
      state: PROPOSAL_STATES[stateIndex],
      proposer: proposalResult.proposer,
      forVotes: '—',
      againstVotes: '—',
      abstainVotes: '—',
      quorumMet: false,
      startBlock: Number(proposalResult.snapshotBlock),
      endBlock: Number(proposalResult.endBlock),
      hasVoted: (userVotesData.data?.[i]?.result as unknown) as boolean ?? false,
      support: 0,
    })
  }

  // ── Space ─────────────────────────────────────────────────────────────
  const currentSpace: Space = {
    name: space.name,
    slug: space.slug,
    token: tokenConfig.address,
    members: 0, // not tracked on-chain; could track delegate count
    proposals: proposalCount,
    icon: space.icon,
  }

  // ── Token balance ────────────────────────────────────────────────────
  // For display: also fetch raw balance so the UI can show both
  const rawBalanceRead = useReadContract({
    address: tokenConfig.address,
    abi: tokenConfig.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  })

  const tokenBalance = tokenBalanceRead.data ? formatEther(tokenBalanceRead.data as bigint) : '0'
  const rawBalance = rawBalanceRead.data ? formatEther(rawBalanceRead.data as bigint) : '0'
  const hasEnoughTokens = tokenBalanceRead.data
    ? (tokenBalanceRead.data as bigint) >= (proposalThresholdRead.data as bigint ?? 0n)
    : false

  return {
    space: currentSpace,
    spaces: [currentSpace],
    proposals: proposals.reverse(), // newest first
    proposalCount,
    tokenBalance,          // voting power (delegated)
    rawBalance,            // raw token balance
    tokenBalanceRaw: tokenBalanceRead.data as bigint | undefined,
    hasEnoughTokens,
    isConnected,
    isLoading: allProposalData.isLoading,
    refetch: () => {
      proposalCountRead.refetch()
      allProposalData.refetch()
      tokenBalanceRead.refetch()
    },
  }
}

// ── Write helpers ─────────────────────────────────────────────────────────

export function useGovernanceWrite() {
  const governorConfig = GOVERNANCE_CONFIG.governor
  const { isWrongNetwork, isSwitchingChain, switchToLitvm } = useLitvmNetwork()
  const [switchError, setSwitchError] = useState<string | null>(null)

  const voteWrite = useWriteContract()
  const proposeWrite = useWriteContract()

  const voteTx = useWaitForTransactionReceipt({ hash: voteWrite.data })
  const proposeTx = useWaitForTransactionReceipt({ hash: proposeWrite.data })

  const castVote = useCallback(
    async (proposalId: number, support: 0 | 1 | 2) => {
      setSwitchError(null)
      if (isWrongNetwork) {
        const result = await switchToLitvm()
        if (!result.switched) {
          setSwitchError(result.error ?? 'Network switch was not completed.')
        }
        return false
      }

      voteWrite.writeContract({
        address: governorConfig.address,
        abi: GOVERNOR_ABI,
        functionName: 'castVote',
        args: [BigInt(proposalId), support],
      })
      return true
    },
    [governorConfig.address, isWrongNetwork, switchToLitvm, voteWrite],
  )

  const castVoteWithReason = useCallback(
    async (proposalId: number, support: 0 | 1 | 2, reason: string) => {
      setSwitchError(null)
      if (isWrongNetwork) {
        const result = await switchToLitvm()
        if (!result.switched) {
          setSwitchError(result.error ?? 'Network switch was not completed.')
        }
        return false
      }

      voteWrite.writeContract({
        address: governorConfig.address,
        abi: GOVERNOR_ABI,
        functionName: 'castVoteWithReason',
        args: [BigInt(proposalId), support, reason],
      })
      return true
    },
    [governorConfig.address, isWrongNetwork, switchToLitvm, voteWrite],
  )

  const createProposal = useCallback(
    async (targets: `0x${string}`[], values: bigint[], calldatas: `0x${string}`[], description: string) => {
      setSwitchError(null)
      if (isWrongNetwork) {
        const result = await switchToLitvm()
        if (!result.switched) {
          setSwitchError(result.error ?? 'Network switch was not completed.')
        }
        return false
      }

      proposeWrite.writeContract({
        address: governorConfig.address,
        abi: GOVERNOR_ABI,
        functionName: 'propose',
        args: [targets, values, calldatas, description],
      })
      return true
    },
    [governorConfig.address, isWrongNetwork, proposeWrite, switchToLitvm],
  )

  return {
    // Vote
    castVote,
    castVoteWithReason,
    voteWrite,
    voteTx,
    switchError,
    isWrongNetwork,
    isSwitchingNetwork: isSwitchingChain,
    switchToLitvm,

    // Proposal creation
    createProposal,
    proposeWrite,
    proposeTx,

    // State helpers
    isVoting: voteWrite.isPending || voteTx.isLoading,
    isProposing: proposeWrite.isPending || proposeTx.isLoading,
    SUPPORT_LABELS,
  }
}
