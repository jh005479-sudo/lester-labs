import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeExplorerLedgerHistoryPage } from './ledgerHistoryParsing.ts'

const ledger = '0xEdf195A557EaAE7829f867d6f84316908A65D9B1'
const eventTopic = '0x6253c4239a235930c4597a4076cc8351362a2a8107a4acdeb5e2f7aeafb87e49'

function validItem(overrides = {}) {
  return {
    address: { hash: ledger },
    block_hash: `0x${'11'.repeat(32)}`,
    block_number: 39_164_496,
    data: '0x00',
    index: 4,
    topics: [eventTopic, `0x${'22'.repeat(32)}`, `0x${'00'.repeat(32)}`, null],
    transaction_hash: `0x${'33'.repeat(32)}`,
    ...overrides,
  }
}

describe('normalizeLedgerHistoryPage', () => {
  it('accepts only logs for the pinned contract and MessagePosted signature', () => {
    const page = normalizeExplorerLedgerHistoryPage({
      items: [
        validItem(),
        validItem({ address: { hash: '0x0000000000000000000000000000000000000001' } }),
        validItem({ topics: [`0x${'44'.repeat(32)}`] }),
      ],
      next_page_params: { block_number: 39_000_000, index: 2, items_count: 50 },
    }, ledger, eventTopic, 50)

    assert.equal(page.logs.length, 1)
    assert.equal(page.logs[0].address, ledger)
    assert.equal(page.logs[0].blockNumber, '0x2559a50')
    assert.deepEqual(page.nextCursor, { block_number: 39_000_000, index: 2, items_count: 50 })
  })

  it('fails closed on malformed cursors and log fields', () => {
    const page = normalizeExplorerLedgerHistoryPage({
      items: [validItem({ data: 'not-hex' }), validItem({ block_number: -1 })],
      next_page_params: { block_number: '39000000' },
    }, ledger, eventTopic, 50)

    assert.deepEqual(page, { logs: [], nextCursor: null })
  })
})
