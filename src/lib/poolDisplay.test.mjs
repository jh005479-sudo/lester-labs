import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { filterPools, getPoolSearchText, getRecentPoolIndices } from './poolDisplay.ts'

const pool = {
  pairAddress: '0xabc0000000000000000000000000000000000001',
  token0Address: '0x1110000000000000000000000000000000000000',
  token1Address: '0x2220000000000000000000000000000000000000',
  token0Meta: { name: 'Wrapped zkLTC', symbol: 'zkLTC', decimals: 18 },
  token1Meta: { name: 'Beta Token', symbol: 'BETA', decimals: 18 },
  reserves: [1_000_000n, 2_000_000n],
  totalSupply: 10_000n,
  lpBalance: 0n,
}

describe('getRecentPoolIndices', () => {
  it('returns newest pair indexes first', () => {
    assert.deepEqual(getRecentPoolIndices(5, 3), [4n, 3n, 2n])
  })
})

describe('getPoolSearchText', () => {
  it('includes symbols, names, pair address, and token addresses', () => {
    const text = getPoolSearchText(pool)

    assert.equal(text.includes('beta token'), true)
    assert.equal(text.includes('0xabc0000000000000000000000000000000000001'), true)
    assert.equal(text.includes('0x2220000000000000000000000000000000000000'), true)
  })
})

describe('filterPools', () => {
  it('can find a pool by symbol, name, pair, or token address', () => {
    assert.equal(filterPools([pool], 'BETA', false).length, 1)
    assert.equal(filterPools([pool], 'wrapped', false).length, 1)
    assert.equal(filterPools([pool], '0xabc0', false).length, 1)
    assert.equal(filterPools([pool], '0x2220', false).length, 1)
  })

  it('can hide wallet positions from the general pool list', () => {
    assert.equal(filterPools([{ ...pool, lpBalance: 1n }], '', true).length, 0)
  })
})
