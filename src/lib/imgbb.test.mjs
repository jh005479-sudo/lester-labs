import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  TOKEN_LOGO_LIMITS,
  hasValidImageSignature,
  validateImageDimensions,
  validateImageMetadata,
} from './imgbb.ts'

describe('token logo validation', () => {
  it('accepts only bounded JPEG, PNG, and WebP metadata', () => {
    assert.equal(validateImageMetadata({ type: 'image/png', size: 512_000 }), null)
    assert.match(validateImageMetadata({ type: 'image/gif', size: 512_000 }), /Only JPEG, PNG, or WebP/)
    assert.match(validateImageMetadata({ type: 'image/png', size: 0 }), /empty/)
    assert.match(
      validateImageMetadata({ type: 'image/png', size: TOKEN_LOGO_LIMITS.maxBytes + 1 }),
      /1MB or smaller/,
    )
  })

  it('checks that declared MIME types match file signatures', () => {
    assert.equal(
      hasValidImageSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      true,
    )
    assert.equal(hasValidImageSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), true)
    assert.equal(
      hasValidImageSignature(
        'image/webp',
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
      true,
    )
    assert.equal(hasValidImageSignature('image/png', new Uint8Array([0xff, 0xd8, 0xff])), false)
  })

  it('rejects tiny, oversized, and excessive-pixel images', () => {
    assert.equal(validateImageDimensions({ width: 512, height: 512 }), null)
    assert.match(validateImageDimensions({ width: 31, height: 512 }), /at least 32/)
    assert.match(validateImageDimensions({ width: 2049, height: 512 }), /must not exceed 2048/)
    assert.match(validateImageDimensions({ width: 2001, height: 2000 }), /must not exceed 2048/)
  })
})
