import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { aggregateInboundTransferSample } from './transferSample.ts'

const topic = (address) => `0x${address.slice(2).padStart(64, '0')}`

describe('aggregateInboundTransferSample', () => {
  it('ranks sampled inbound volume without claiming current balances', () => {
    const first = '0x0000000000000000000000000000000000000001'
    const second = '0x0000000000000000000000000000000000000002'
    const logs = [
      { topics: ['0xevent', topic(first), topic(second)], data: '0x5' },
      { topics: ['0xevent', topic(second), topic(first)], data: '0x9' },
    ]
    const result = aggregateInboundTransferSample(logs)

    assert.equal(result.entries[0].address, first)
    assert.equal(result.entries[0].value, 9n)
    assert.equal(result.totalValue, 14n)
    assert.equal(result.recipientCount, 2)
  })

  it('ignores mint-to-zero and malformed log values', () => {
    const zero = '0x0000000000000000000000000000000000000000'
    const result = aggregateInboundTransferSample([
      { topics: ['0xevent', topic(zero), topic(zero)], data: '0x10' },
      { topics: ['0xevent', topic(zero), topic(zero)], data: 'not-hex' },
    ])

    assert.equal(result.totalValue, 0n)
    assert.deepEqual(result.entries, [])
  })
})
