import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LITVM_TESTNET_CONTRACTS, isCanonicalLitvmContract } from '../config/contracts.ts'

describe('LitVM transaction target integrity', () => {
  it('accepts canonical addresses without relying on checksum casing', () => {
    assert.equal(
      isCanonicalLitvmContract(
        LITVM_TESTNET_CONTRACTS.liquidityLocker.toLowerCase(),
        LITVM_TESTNET_CONTRACTS.liquidityLocker,
      ),
      true,
    )
  })

  it('fails closed for missing and alternate valid-looking deployments', () => {
    assert.equal(isCanonicalLitvmContract(undefined, LITVM_TESTNET_CONTRACTS.ledger), false)
    assert.equal(
      isCanonicalLitvmContract(
        '0x1111111111111111111111111111111111111111',
        LITVM_TESTNET_CONTRACTS.ledger,
      ),
      false,
    )
  })
})
