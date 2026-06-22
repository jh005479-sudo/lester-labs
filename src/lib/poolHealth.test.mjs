import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPoolHealth } from './poolHealth.ts'

describe('getPoolHealth', () => {
  it('scores pools by liquidity depth and metadata completeness', () => {
    const health = getPoolHealth({
      reserve0: 10_000n * 10n ** 18n,
      reserve1: 500n * 10n ** 18n,
      token0Decimals: 18,
      token1Decimals: 18,
      token0Name: 'Example Token',
      token1Name: 'Wrapped zkLTC',
      token0Symbol: 'EX',
      token1Symbol: 'zkLTC',
      ageHours: 72,
      hasRecentSync: true,
    })

    assert.equal(health.label, 'Strong')
    assert.ok(health.score >= 80)
    assert.ok(health.reasons.includes('recent reserve activity'))
  })

  it('flags thin and incomplete pools', () => {
    const health = getPoolHealth({
      reserve0: 0n,
      reserve1: 0n,
      token0Decimals: 18,
      token1Decimals: 18,
      token0Name: 'Token 0xabc',
      token1Name: 'TOKEN',
      token0Symbol: 'TOKEN',
      token1Symbol: 'TOKEN',
      ageHours: 1,
      hasRecentSync: false,
    })

    assert.equal(health.label, 'Thin')
    assert.ok(health.score < 40)
    assert.ok(health.reasons.includes('metadata needs review'))
  })
})
