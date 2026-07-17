import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findByCanonicalAddress, getBoundedNewestBlockRange, inferFactoryProvenance } from './token-indexer-utils.ts'

describe('getBoundedNewestBlockRange', () => {
  it('keeps the newest bounded window and exposes truncation', () => {
    assert.deepEqual(getBoundedNewestBlockRange(1, 50_000, 10_000), {
      requestedFromBlock: 1,
      scannedFromBlock: 40_001,
      toBlock: 50_000,
      truncated: true,
    })
  })

  it('preserves a request that already fits within the limit', () => {
    assert.equal(getBoundedNewestBlockRange(900, 1_000, 500).truncated, false)
  })
})

describe('findByCanonicalAddress', () => {
  it('matches identity by address rather than a spoofable symbol', () => {
    const canonical = '0x0000000000000000000000000000000000000001'
    const tokens = [
      { address: '0x0000000000000000000000000000000000000002', symbol: 'LGT' },
      { address: canonical, symbol: 'OTHER' },
    ]

    assert.equal(findByCanonicalAddress(tokens, canonical)?.symbol, 'OTHER')
  })
})

describe('inferFactoryProvenance', () => {
  it('does not assert deployment provenance for direct metadata reads', () => {
    assert.equal(inferFactoryProvenance({ creationBlock: 50_000 }), 'unknown')
  })

  it('recognizes complete cached factory event provenance', () => {
    assert.equal(inferFactoryProvenance({
      deployer: '0x0000000000000000000000000000000000000001',
      creationTx: `0x${'ab'.repeat(32)}`,
      creationBlock: 50_000,
    }), 'verified')
  })
})
