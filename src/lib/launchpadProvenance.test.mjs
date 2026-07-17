import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isCanonicalLitvmContract, LITVM_TESTNET_CONTRACTS } from '../config/contracts.ts'

describe('launchpad contract provenance', () => {
  it('accepts only the canonical LitVM factory address regardless of casing', () => {
    assert.equal(
      isCanonicalLitvmContract(
        LITVM_TESTNET_CONTRACTS.iloFactory.toLowerCase(),
        LITVM_TESTNET_CONTRACTS.iloFactory,
      ),
      true,
    )
    assert.equal(
      isCanonicalLitvmContract('0x0000000000000000000000000000000000000001', LITVM_TESTNET_CONTRACTS.iloFactory),
      false,
    )
    assert.equal(isCanonicalLitvmContract(undefined, LITVM_TESTNET_CONTRACTS.iloFactory), false)
  })

})
