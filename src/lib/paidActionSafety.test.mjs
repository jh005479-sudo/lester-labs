import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  APPROVED_LESTER_CONTROLLER_ADDRESS,
  APPROVED_LESTER_TREASURY_ADDRESS,
  DISPOSABLE_TESTNET_FROZEN_AUTHORITY,
  EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS,
  LITVM_COMPROMISED_LEGACY_GOVERNANCE,
  POST_COMPROMISE_GOVERNANCE_ACTIVE,
  hasApprovedLesterControl,
  hasApprovedGovernanceWritePath,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
} from '../config/contracts.ts'

const retiredAuthority = '0xDD221FBbCb0f6092AfE51183d964AA89A968eE13'

describe('paid contract authority gates', () => {
  it('accepts only the immutable public-testnet owner/treasury profile after replacement activation', () => {
    assert.equal(POST_COMPROMISE_REPLACEMENTS_ACTIVE, true)
    assert.equal(APPROVED_LESTER_CONTROLLER_ADDRESS, DISPOSABLE_TESTNET_FROZEN_AUTHORITY)
    assert.equal(APPROVED_LESTER_TREASURY_ADDRESS, '0x439945924515218061b644901a31aC4A6c00957c')
    assert.equal(EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS, APPROVED_LESTER_TREASURY_ADDRESS)
    assert.equal(hasApprovedLesterControl({ owner: '0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28' }), false)
    assert.equal(hasApprovedLesterControl({ owner: '0x439945924515218061b644901a31aC4A6c00957c' }), false)
    assert.equal(hasApprovedLesterControl({ owner: DISPOSABLE_TESTNET_FROZEN_AUTHORITY }), true)
    assert.equal(hasApprovedLesterControl({
      owner: DISPOSABLE_TESTNET_FROZEN_AUTHORITY,
      treasury: APPROVED_LESTER_TREASURY_ADDRESS,
      treasuryRequired: true,
    }), true)
    assert.equal(hasApprovedLesterControl({ owner: retiredAuthority }), false)
    assert.equal(hasApprovedLesterControl({ owner: undefined }), false)
  })

  it('does not accept matching but unapproved owner and treasury values', () => {
    const unapproved = '0x1111111111111111111111111111111111111111'
    assert.equal(hasApprovedLesterControl({
      owner: unapproved,
      treasury: unapproved,
      treasuryRequired: true,
    }), false)
    assert.equal(hasApprovedLesterControl({
      owner: unapproved,
      treasury: retiredAuthority,
      treasuryRequired: true,
    }), false)
    assert.equal(hasApprovedLesterControl({
      owner: retiredAuthority,
      treasury: unapproved,
      treasuryRequired: true,
    }), false)
    assert.equal(hasApprovedLesterControl({
      owner: unapproved,
      treasuryRequired: true,
    }), false)
  })

  it('keeps the independently compromised governance deployment read-only', () => {
    assert.equal(POST_COMPROMISE_GOVERNANCE_ACTIVE, false)
    assert.deepEqual(LITVM_COMPROMISED_LEGACY_GOVERNANCE, {
      token: '0xa5111cedc04554676DbCCA39F2268070008C7A8A',
      governor: '0x5b0092996BA897617B46D42B3F108B253be9Ad3d',
      timelock: '0xd38ed693730Db3eB22bA6d6F0050FC45Ac9240ba',
    })
    assert.equal(hasApprovedGovernanceWritePath({
      token: LITVM_COMPROMISED_LEGACY_GOVERNANCE.token,
      governor: LITVM_COMPROMISED_LEGACY_GOVERNANCE.governor,
      timelock: LITVM_COMPROMISED_LEGACY_GOVERNANCE.timelock,
    }), false)
    assert.equal(hasApprovedGovernanceWritePath({
      token: '0x1111111111111111111111111111111111111111',
      governor: '0x2222222222222222222222222222222222222222',
      timelock: '0x3333333333333333333333333333333333333333',
    }), false)
  })
})
