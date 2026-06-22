import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildReserveHistory,
  calculateTokenPriceInQuote,
  formatCompactUsd,
  getPairDisplaySymbol,
} from './dexCharts.ts'

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

describe('formatCompactUsd', () => {
  it('formats compact values without overprecision', () => {
    assert.equal(formatCompactUsd(1250000), '$1.25M')
    assert.equal(formatCompactUsd(0.00042), '$0.00042')
  })
})
