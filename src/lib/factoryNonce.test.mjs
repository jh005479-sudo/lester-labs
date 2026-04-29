import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { tokenCountFromFactoryNonce } from './factoryNonce.ts'

describe('tokenCountFromFactoryNonce', () => {
  it('subtracts the contract creation nonce from TokenFactory account nonce', () => {
    assert.equal(tokenCountFromFactoryNonce(44_125), 44_124)
  })

  it('never reports a negative token count', () => {
    assert.equal(tokenCountFromFactoryNonce(0), 0)
  })
})
