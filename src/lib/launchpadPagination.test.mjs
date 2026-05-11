import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getRecentWindowIndices } from './launchpadPagination.ts'

describe('getRecentWindowIndices', () => {
  it('returns newest ILO indices first for a visible page', () => {
    assert.deepEqual(getRecentWindowIndices(77, 5), [76n, 75n, 74n, 73n, 72n])
  })

  it('caps the visible window at the available count', () => {
    assert.deepEqual(getRecentWindowIndices(3, 10), [2n, 1n, 0n])
  })

  it('keeps large presale collections limited to the requested visible page', () => {
    const indices = getRecentWindowIndices(1_250, 24)

    assert.equal(indices.length, 24)
    assert.equal(indices[0], 1249n)
    assert.equal(indices[23], 1226n)
  })

  it('returns no indices when there are no presales', () => {
    assert.deepEqual(getRecentWindowIndices(0, 24), [])
  })
})
