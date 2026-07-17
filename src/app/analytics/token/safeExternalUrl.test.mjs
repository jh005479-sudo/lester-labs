import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { safeExternalUrl } from './safeExternalUrl.ts'

describe('safeExternalUrl', () => {
  it('allows absolute http and https project links', () => {
    assert.equal(safeExternalUrl('https://example.com/docs'), 'https://example.com/docs')
    assert.equal(safeExternalUrl('http://example.com'), 'http://example.com/')
  })

  it('rejects script, data, credentialed, relative, and oversized URLs', () => {
    assert.equal(safeExternalUrl('javascript:alert(1)'), null)
    assert.equal(safeExternalUrl('data:text/html,hello'), null)
    assert.equal(safeExternalUrl('https://user:pass@example.com'), null)
    assert.equal(safeExternalUrl('/relative/path'), null)
    assert.equal(safeExternalUrl(`https://example.com/${'x'.repeat(2_100)}`), null)
  })
})
