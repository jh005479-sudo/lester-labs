import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encodeFunctionData } from 'viem'
import { GOVERNOR_ABI } from '../../../config/governance.ts'
import { decodeGovernanceInput } from './governanceDecode.ts'

describe('decodeGovernanceInput', () => {
  it('decodes the deployed castVote selector and ABI-aligned support slot', () => {
    const input = encodeFunctionData({
      abi: GOVERNOR_ABI,
      functionName: 'castVote',
      args: [42n, 1],
    })

    assert.deepEqual(decodeGovernanceInput(input, GOVERNOR_ABI), {
      method: 'castVote',
      detail: 'For - Proposal #42',
      proposalId: '42',
    })
  })

  it('decodes queue(uint256) and rejects unknown selectors', () => {
    const input = encodeFunctionData({
      abi: GOVERNOR_ABI,
      functionName: 'queue',
      args: [9n],
    })

    assert.equal(decodeGovernanceInput(input, GOVERNOR_ABI)?.detail, 'Queue Proposal #9')
    assert.equal(decodeGovernanceInput('0xdeadbeef', GOVERNOR_ABI), null)
  })
})
