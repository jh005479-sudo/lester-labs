import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getDescendingLedgerIndexPage, padUint256Topic } from '../ledgerPagination.ts'

describe('padUint256Topic', () => {
  it('encodes bigint event indexes as 32-byte topic hex', () => {
    assert.equal(
      padUint256Topic(7330n),
      '0x0000000000000000000000000000000000000000000000000000000000001ca2',
    )
  })
})

describe('getDescendingLedgerIndexPage', () => {
  it('returns the newest message indexes first from a total count cursor', () => {
    assert.deepEqual(getDescendingLedgerIndexPage(7331n, 5), [7330n, 7329n, 7328n, 7327n, 7326n])
  })

  it('caps the page at zero without underflowing', () => {
    assert.deepEqual(getDescendingLedgerIndexPage(3n, 10), [2n, 1n, 0n])
  })
})
