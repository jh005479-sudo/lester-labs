import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getContractAddress } from 'viem'

import { assertDeterministicCreateDeploymentSequence } from './publicReplacementCreateAddress.ts'

const DISCLOSED_DISPOSABLE_SIGNER = '0x439945924515218061b644901a31aC4A6c00957c'
const FRESH_PRODUCTION_SIGNER = '0x1000000000000000000000000000000000000001'

describe('public replacement CREATE provenance', () => {
  it('rejects disclosed-key disposable addresses relabelled with a fresh production signer', () => {
    const disposableDeployments = Array.from({ length: 13 }, (_, nonce) => ({
      name: `Deployment${nonce}`,
      nonce,
      address: getContractAddress({ from: DISCLOSED_DISPOSABLE_SIGNER, nonce: BigInt(nonce) }),
    }))

    assert.doesNotThrow(() => assertDeterministicCreateDeploymentSequence(
      DISCLOSED_DISPOSABLE_SIGNER,
      0,
      disposableDeployments,
    ))
    assert.throws(
      () => assertDeterministicCreateDeploymentSequence(
        FRESH_PRODUCTION_SIGNER,
        0,
        disposableDeployments,
      ),
      /not created by the declared gas-only deployer/i,
    )
  })
})
