import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  UNISWAP_V2_SYNC_TOPIC,
  buildReserveHistory,
  calculateTokenPriceInQuote,
  formatCompactUsd,
  getNextPairScanCount,
  getPairDisplaySymbol,
  parseEvmAddress,
  parsePairReserves,
} from './dexCharts.ts'
import { keccak256, toBytes } from 'viem'

describe('UNISWAP_V2_SYNC_TOPIC', () => {
  it('matches keccak256 of the canonical Sync event signature', () => {
    assert.equal(UNISWAP_V2_SYNC_TOPIC, keccak256(toBytes('Sync(uint112,uint112)')))
  })
})

describe('calculateTokenPriceInQuote', () => {
  it('uses reserve ratios and token decimals for token0 priced in token1', () => {
    const price = calculateTokenPriceInQuote({
      baseTokenAddress: '0x1111111111111111111111111111111111111111',
      token0Address: '0x1111111111111111111111111111111111111111',
      token1Address: '0x2222222222222222222222222222222222222222',
      reserve0: 100n * 10n ** 18n,
      reserve1: 25n * 10n ** 18n,
      token0Decimals: 18,
      token1Decimals: 18,
    })

    assert.equal(price, 0.25)
  })

  it('uses the inverse ratio when the base token is token1', () => {
    const price = calculateTokenPriceInQuote({
      baseTokenAddress: '0x2222222222222222222222222222222222222222',
      token0Address: '0x1111111111111111111111111111111111111111',
      token1Address: '0x2222222222222222222222222222222222222222',
      reserve0: 100n * 10n ** 18n,
      reserve1: 25n * 10n ** 18n,
      token0Decimals: 18,
      token1Decimals: 18,
    })

    assert.equal(price, 4)
  })
})

describe('buildReserveHistory', () => {
  it('creates a stable fallback line when only current reserves are available', () => {
    const rows = buildReserveHistory(2.5, 6)

    assert.equal(rows.length, 6)
    assert.equal(rows.at(-1)?.price, 2.5)
    assert.equal(rows.every((row) => typeof row.time === 'string'), true)
  })
})

describe('getPairDisplaySymbol', () => {
  it('formats pair symbols', () => {
    assert.equal(getPairDisplaySymbol('BETA', 'zkLTC'), 'BETA / zkLTC')
  })
})

describe('getNextPairScanCount', () => {
  it('loads explicit bounded pages without enumerating the full factory', () => {
    assert.equal(getNextPairScanCount(18, 6_097, 18, 72), 36)
    assert.equal(getNextPairScanCount(72, 6_097, 18, 72), 72)
    assert.equal(getNextPairScanCount(18, 22, 18, 72), 22)
  })
})

describe('pair RPC result parsing', () => {
  it('rejects shifted or malformed cached contract results', () => {
    const address = '0x1111111111111111111111111111111111111111'
    assert.equal(parseEvmAddress(address), address)
    assert.equal(parseEvmAddress(12n), null)
    assert.equal(parseEvmAddress('0x1234'), null)
    assert.deepEqual(parsePairReserves([1n, 2n, 3]), [1n, 2n, 3])
    assert.equal(parsePairReserves(address), null)
    assert.equal(parsePairReserves([1n, '2', 3]), null)
  })
})

describe('formatCompactUsd', () => {
  it('formats compact values without overprecision', () => {
    assert.equal(formatCompactUsd(1250000), '$1.25M')
    assert.equal(formatCompactUsd(0.00042), '$0.00042')
  })
})
