import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_TOKEN_METADATA_ADDRESSES,
  MAX_TOKEN_METADATA_TEXT_LENGTH,
  buildTokenMetadataRequest,
  getTokenMetadataRequestKey,
  normalizeTokenMetadataAddresses,
  sanitizeTokenMetadataText,
} from './tokenMetadataRequest.ts'

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

describe('buildTokenMetadataRequest', () => {
  it('bounds unique metadata reads and reports when the request is partial', () => {
    const addresses = Array.from({ length: MAX_TOKEN_METADATA_ADDRESSES + 4 }, (_, index) =>
      `0x${index.toString(16).padStart(40, '0')}`,
    )
    const request = buildTokenMetadataRequest(addresses)

    assert.equal(request.addresses.length, MAX_TOKEN_METADATA_ADDRESSES)
    assert.equal(request.requestedCount, MAX_TOKEN_METADATA_ADDRESSES + 4)
    assert.equal(request.truncated, true)
  })
})

describe('sanitizeTokenMetadataText', () => {
  it('removes control characters and caps adversarial metadata strings', () => {
    const value = sanitizeTokenMetadataText(`\u0000  Token ${'x'.repeat(200)}`, 'Unknown')

    assert.equal(value.includes('\u0000'), false)
    assert.equal(value.length, MAX_TOKEN_METADATA_TEXT_LENGTH)
  })

  it('uses a fallback for empty metadata', () => {
    assert.equal(sanitizeTokenMetadataText('\u0000\n', 'Unknown'), 'Unknown')
  })
})
