import { decodeFunctionData, type Abi } from 'viem'

export interface GovernanceCall {
  method: string
  detail: string
  proposalId?: string
}

export function decodeGovernanceInput(input: string, abi: Abi): GovernanceCall | null {
  if (!/^0x[0-9a-fA-F]{8,}$/.test(input)) return null

  try {
    const decoded = decodeFunctionData({
      abi,
      data: input as `0x${string}`,
    })
    const args = decoded.args as readonly unknown[] | undefined
    const proposalId = typeof args?.[0] === 'bigint' ? args[0].toString() : undefined

    if (decoded.functionName === 'castVote' || decoded.functionName === 'castVoteWithReason') {
      const support = Number(args?.[1])
      const supportLabel = ['Against', 'For', 'Abstain'][support] ?? `Option ${support}`
      return {
        method: decoded.functionName,
        detail: `${supportLabel} - Proposal #${proposalId}`,
        proposalId,
      }
    }

    if (decoded.functionName === 'propose') {
      return { method: decoded.functionName, detail: 'New governance proposal submitted' }
    }

    if (decoded.functionName === 'queue' || decoded.functionName === 'execute' || decoded.functionName === 'cancel') {
      const verb = decoded.functionName[0].toUpperCase() + decoded.functionName.slice(1)
      return {
        method: decoded.functionName,
        detail: `${verb} Proposal #${proposalId}`,
        proposalId,
      }
    }

    return { method: decoded.functionName, detail: decoded.functionName }
  } catch {
    return null
  }
}
