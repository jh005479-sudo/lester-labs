import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getTokenMetadataRequestKey, normalizeTokenMetadataAddresses } from './tokenMetadataRequest.ts'

describe('normalizeTokenMetadataAddresses', () => {
  it('normalizes addresses to a stable lowercase unique request list', () => {
    assert.deepEqual(
      normalizeTokenMetadataAddresses([
        '0xAa00000000000000000000000000000000000001',
        '0xaa00000000000000000000000000000000000001',
        '0xBb00000000000000000000000000000000000002',
      ]),
      [
        '0xaa00000000000000000000000000000000000001',
        '0xbb00000000000000000000000000000000000002',
      ],
    )
  })
})

describe('getTokenMetadataRequestKey', () => {
  it('uses address values instead of array identity for hook dependencies', () => {
    const first = ['0xCc00000000000000000000000000000000000003']
    const second = ['0xcc00000000000000000000000000000000000003']

    assert.equal(getTokenMetadataRequestKey([...first]), getTokenMetadataRequestKey([...second]))
  })

  it('returns an empty key for empty requests so the hook can skip network work', () => {
    assert.equal(getTokenMetadataRequestKey([]), '')
  })
})
