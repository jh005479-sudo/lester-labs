import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseCSVRecipients, parseManualRecipients } from './airdropRecipients.ts'

describe('parseManualRecipients', () => {
  it('does not split EVM addresses at lowercase b characters', () => {
    const recipients = parseManualRecipients('0x1e02Be4Bd0688Bc072022c0C4Fb5E48dff0ad6B5,1000')

    assert.deepEqual(recipients, [
      {
        address: '0x1e02be4bd0688bc072022c0c4fb5e48dff0ad6b5',
        amount: '1000',
      },
    ])
  })

  it('accepts comma, whitespace, and tab separators without corrupting addresses', () => {
    assert.deepEqual(parseManualRecipients('0xabc000000000000000000000000000000000000b 42'), [
      {
        address: '0xabc000000000000000000000000000000000000b',
        amount: '42',
      },
    ])

    assert.deepEqual(parseManualRecipients('0xdef000000000000000000000000000000000000b\t99'), [
      {
        address: '0xdef000000000000000000000000000000000000b',
        amount: '99',
      },
    ])
  })
})

describe('parseCSVRecipients', () => {
  it('skips a header and preserves address casing only through lowercase normalization', () => {
    const recipients = parseCSVRecipients('address,amount\n0xBb00000000000000000000000000000000000002,5')

    assert.deepEqual(recipients, [
      {
        address: '0xbb00000000000000000000000000000000000002',
        amount: '5',
      },
    ])
  })
})
