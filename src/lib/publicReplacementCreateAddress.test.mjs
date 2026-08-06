import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getContractAddress } from 'viem'

import { assertDeterministicCreateDeploymentSequence } from './publicReplacementCreateAddress.ts'

const DISCLOSED_DISPOSABLE_SIGNER = '0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28'
const FRESH_PRODUCTION_SIGNER = '0x1000000000000000000000000000000000000001'

describe('public replacement CREATE provenance', () => {
  it('rejects Cbf-derived disposable addresses relabelled with a fresh production signer', () => {
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
