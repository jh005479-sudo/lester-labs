import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  filterPresales,
  getPresaleStatus,
  getPresaleTimeLabel,
  sortPresales,
} from './launchpadDisplay.ts'

const basePresale = {
  address: '0x1000000000000000000000000000000000000000',
  name: 'Alpha Labs',
  symbol: 'ALPHA',
  token: '0x2000000000000000000000000000000000000000',
  softCap: '5',
  hardCap: '20',
  raised: '0',
  startTime: 100_000_000,
  endTime: 200_000_000,
  finalized: false,
  cancelled: false,
  liquidityBps: 6000,
  lpLockDuration: 15_552_000,
  contributorCount: '—',
  userContribution: 0n,
}

describe('getPresaleStatus', () => {
  it('reports upcoming before start time instead of live', () => {
    assert.equal(getPresaleStatus(basePresale, 99_999_000), 'Upcoming')
  })

  it('reports live only inside the active window', () => {
    assert.equal(getPresaleStatus(basePresale, 150_000_000), 'Live')
  })

  it('prioritizes finalized and cancelled terminal states', () => {
    assert.equal(getPresaleStatus({ ...basePresale, finalized: true }, 150_000_000), 'Finalized')
    assert.equal(getPresaleStatus({ ...basePresale, cancelled: true }, 150_000_000), 'Cancelled')
  })
})

describe('getPresaleTimeLabel', () => {
  it('describes starts-in and ends-in windows', () => {
    assert.equal(getPresaleTimeLabel(basePresale, 13_600_000), 'Starts in 1d 0h')
    assert.equal(getPresaleTimeLabel(basePresale, 113_600_000), 'Ends in 1d 0h')
  })
})

describe('filterPresales', () => {
  const presales = [
    basePresale,
    {
      ...basePresale,
      address: '0x3000000000000000000000000000000000000000',
      name: 'Beta Market',
      symbol: 'BETA',
      token: '0x4000000000000000000000000000000000000000',
      userContribution: 10n,
    },
  ]

  it('filters by token/project name, symbol, presale address, or token address', () => {
    assert.deepEqual(filterPresales(presales, { query: 'beta', status: 'All', participatedOnly: false }, 150_000_000).map((p) => p.symbol), ['BETA'])
    assert.deepEqual(filterPresales(presales, { query: '0x2000', status: 'All', participatedOnly: false }, 150_000_000).map((p) => p.symbol), ['ALPHA'])
  })

  it('filters to connected-wallet participation', () => {
    assert.deepEqual(filterPresales(presales, { query: '', status: 'All', participatedOnly: true }, 150_000_000).map((p) => p.symbol), ['BETA'])
  })
})

describe('sortPresales', () => {
  it('keeps live sales first, then upcoming, then ended/finalized', () => {
    const now = 150_000_000
    const ordered = sortPresales([
      { ...basePresale, symbol: 'DONE', finalized: true },
      { ...basePresale, symbol: 'SOON', startTime: 170_000_000, endTime: 250_000_000 },
      { ...basePresale, symbol: 'LIVE' },
    ], now)

    assert.deepEqual(ordered.map((p) => p.symbol), ['LIVE', 'SOON', 'DONE'])
  })
})
