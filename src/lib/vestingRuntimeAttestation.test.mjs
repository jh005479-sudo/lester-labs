import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { keccak256 } from 'viem'

import {
  isAttestedVestingWalletRuntime,
  normalizeImmutableRuntime,
} from './vestingRuntimeAttestation.ts'

describe('VestingWallet immutable runtime attestation', () => {
  const template = '0x60000001600002'
  const references = [{ start: 1, length: 2 }, { start: 4, length: 2 }]
  const normalized = normalizeImmutableRuntime(template, 7, references)
  const attestation = {
    kind: 'immutable-template',
    normalizedRuntimeCodeHash: keccak256(normalized),
    runtimeCodeBytes: 7,
    immutableReferences: references,
  }

  it('accepts schedule-specific bytes only at compiler-attested immutable ranges', () => {
    assert.equal(isAttestedVestingWalletRuntime('0x60aabb01ccdd02', attestation), true)
  })

  it('rejects any mutation outside the immutable ranges', () => {
    assert.equal(isAttestedVestingWalletRuntime('0x61aabb01ccdd02', attestation), false)
  })

  it('fails closed on wrong lengths, missing ranges, and overlapping ranges', () => {
    assert.equal(isAttestedVestingWalletRuntime('0x60aabb01ccdd', attestation), false)
    assert.throws(() => normalizeImmutableRuntime(template, 7, [],), /missing/i)
    assert.throws(
      () => normalizeImmutableRuntime(template, 7, [{ start: 1, length: 2 }, { start: 2, length: 2 }]),
      /overlap/i,
    )
  })

  it('preserves exact-hash checks for historical runtime generations', () => {
    assert.equal(isAttestedVestingWalletRuntime(template, {
      kind: 'exact-runtime-hashes',
      runtimeCodeHashes: [keccak256(template)],
    }), true)
  })
})
