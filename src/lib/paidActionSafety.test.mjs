import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  hasApprovedLesterControl,
  LESTER_TREASURY_ADDRESS,
} from '../config/contracts.ts'

const retiredAuthority = '0xDD221FBbCb0f6092AfE51183d964AA89A968eE13'

describe('paid contract authority gates', () => {
  it('accepts an ownable paid contract only when its owner is the approved treasury', () => {
    assert.equal(hasApprovedLesterControl({ owner: LESTER_TREASURY_ADDRESS.toLowerCase() }), true)
    assert.equal(hasApprovedLesterControl({ owner: retiredAuthority }), false)
    assert.equal(hasApprovedLesterControl({ owner: undefined }), false)
  })

  it('requires both owner and treasury when the paid contract routes funds directly', () => {
    assert.equal(hasApprovedLesterControl({
      owner: LESTER_TREASURY_ADDRESS,
      treasury: LESTER_TREASURY_ADDRESS.toLowerCase(),
      treasuryRequired: true,
    }), true)
    assert.equal(hasApprovedLesterControl({
      owner: LESTER_TREASURY_ADDRESS,
      treasury: retiredAuthority,
      treasuryRequired: true,
    }), false)
    assert.equal(hasApprovedLesterControl({
      owner: retiredAuthority,
      treasury: LESTER_TREASURY_ADDRESS,
      treasuryRequired: true,
    }), false)
    assert.equal(hasApprovedLesterControl({
      owner: LESTER_TREASURY_ADDRESS,
      treasuryRequired: true,
    }), false)
  })
})
