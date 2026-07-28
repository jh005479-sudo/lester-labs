import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  APPROVED_ILO_CREATION_FACTORY_ADDRESS,
  hasApprovedIloPaidWritePath,
  isApprovedIloCreationFactory,
  isApprovedLesterTreasury,
  isCanonicalLitvmContract,
  LESTER_TREASURY_ADDRESS,
  LITVM_TESTNET_CONTRACTS,
} from '../config/contracts.ts'

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

  it('fails closed unless the on-chain treasury is the approved replacement', () => {
    assert.equal(isApprovedLesterTreasury(LESTER_TREASURY_ADDRESS.toLowerCase()), true)
    assert.equal(isApprovedLesterTreasury('0xDD221FBbCb0f6092AfE51183d964AA89A968eE13'), false)
    assert.equal(isApprovedLesterTreasury(undefined), false)
  })

  it('never enables creation through the canonical legacy factory or an environment-selected address', () => {
    assert.equal(APPROVED_ILO_CREATION_FACTORY_ADDRESS, undefined)
    assert.equal(isApprovedIloCreationFactory(LITVM_TESTNET_CONTRACTS.iloFactory), false)
    assert.equal(isApprovedIloCreationFactory('0x1111111111111111111111111111111111111111'), false)
    assert.equal(isApprovedIloCreationFactory(undefined), false)
  })

  it('keeps every canonical legacy-factory child recovery-only after treasury rotation', () => {
    assert.equal(
      hasApprovedIloPaidWritePath({
        factory: LITVM_TESTNET_CONTRACTS.iloFactory,
        treasury: LESTER_TREASURY_ADDRESS,
      }),
      false,
    )
    assert.equal(
      hasApprovedIloPaidWritePath({
        factory: '0x1111111111111111111111111111111111111111',
        treasury: LESTER_TREASURY_ADDRESS,
      }),
      false,
    )
  })
})
