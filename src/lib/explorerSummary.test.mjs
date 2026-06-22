import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildExplorerSummary,
  createEmptyExplorerSummary,
  getExplorerSummaryCacheControl,
} from './explorerSummary.ts'

describe('buildExplorerSummary', () => {
  it('maps recent blocks and sampled transaction receipts into a compact summary', () => {
    const summary = buildExplorerSummary({
      latestBlock: 1234,
      nowMs: 1_700_000_120_000,
      blocks: [
        {
          number: '0x4d2',
          timestamp: '0x6553f100',
          transactions: [
            { hash: '0xaaa', from: '0x1111111111111111111111111111111111111111', to: '0x2222222222222222222222222222222222222222', value: '0xde0b6b3a7640000' },
          ],
          miner: '0x3333333333333333333333333333333333333333',
          size: '0x1000',
        },
      ],
      receiptsByHash: new Map([['0xaaa', { status: '0x1' }]]),
    })

    assert.equal(summary.latestBlock, 1234)
    assert.equal(summary.blocks[0].number, 1234)
    assert.equal(summary.blocks[0].txCount, 1)
    assert.equal(summary.blocks[0].time, '2m ago')
    assert.equal(summary.transactions[0].status, 'Success')
    assert.equal(summary.transactions[0].value, '1')
  })

  it('keeps search usable while live data is still loading', () => {
    const summary = createEmptyExplorerSummary()
    assert.equal(summary.latestBlock, 0)
    assert.deepEqual(summary.blocks, [])
    assert.deepEqual(summary.transactions, [])
    assert.equal(summary.updatedAt, null)
  })
})

describe('getExplorerSummaryCacheControl', () => {
  it('uses a short server cache and stale-while-revalidate window', () => {
    assert.equal(
      getExplorerSummaryCacheControl(),
      'public, s-maxage=4, stale-while-revalidate=20',
    )
  })
})
