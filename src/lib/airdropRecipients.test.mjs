import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildValidatedRecipientSnapshot,
  getRecipientPage,
  parseCSVRecipients,
  parseManualRecipients,
} from './airdropRecipients.ts'

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

describe('validated recipient review', () => {
  it('paginates the complete exact snapshot without hiding submitted recipients', () => {
    const recipients = Array.from({ length: 125 }, (_, index) => ({
      address: `0x${index.toString(16).padStart(40, '0')}`,
      amount: `${index + 1}.25`,
    }))
    recipients.splice(60, 0, { address: 'not-an-address', amount: '10' })
    recipients.push({ address: `0x${'f'.repeat(40)}`, amount: '10tokens' })

    const snapshot = buildValidatedRecipientSnapshot(recipients)
    const reviewed = [0, 1, 2].flatMap((page) => getRecipientPage(snapshot, page, 50).rows)

    assert.equal(snapshot.length, 125)
    assert.deepEqual(reviewed, snapshot)
    assert.deepEqual(getRecipientPage(snapshot, 2, 50), {
      rows: snapshot.slice(100),
      page: 2,
      pageCount: 3,
      startIndex: 100,
      endIndex: 125,
      totalRows: 125,
    })
  })

  it('keeps the exact trimmed address and display amount used by submission', () => {
    const snapshot = buildValidatedRecipientSnapshot([
      { address: `  0x${'a'.repeat(40)}  `, amount: '  0.005  ' },
      { address: `0x${'b'.repeat(40)}`, amount: '0' },
      { address: `0x${'c'.repeat(40)}`, amount: '0.0001' },
    ], 3)

    assert.deepEqual(snapshot, [
      { address: `0x${'a'.repeat(40)}`, amount: '0.005' },
    ])
  })
})
