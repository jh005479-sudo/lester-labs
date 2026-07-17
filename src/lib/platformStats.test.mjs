import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyCounterFloor,
  describeSwapCoverage,
  getAuditedCounterBaseline,
  getBoundedStatsLogRange,
  selectNewestPairIndices,
  sumCompleteCounts,
} from './platformStatsBounds.ts'

describe('selectNewestPairIndices', () => {
  it('bounds enumeration to the newest canonical factory pairs', () => {
    assert.deepEqual(selectNewestPairIndices(10_000, 3), [9_997n, 9_998n, 9_999n])
  })

  it('does not invent indices when the factory is empty', () => {
    assert.deepEqual(selectNewestPairIndices(0, 200), [])
  })
})

describe('getBoundedStatsLogRange', () => {
  it('reports partial coverage when the audit delta exceeds the scan limit', () => {
    const range = getBoundedStatsLogRange(1n, 1_000_000n, 50_000n)
    assert.equal(range.scannedFromBlock, 950_001n)
    assert.equal(range.truncated, true)
  })
})

describe('getAuditedCounterBaseline', () => {
  it('keeps unauthenticated event lookalikes out of cumulative counters', () => {
    const baseline = getAuditedCounterBaseline(16_433, 3_412_247n)

    assert.equal(baseline.value, 16_433)
    assert.match(baseline.note, /unauthenticated event lookalikes are excluded/i)
  })
})

describe('sumCompleteCounts', () => {
  it('preserves a legitimate zero but rejects an RPC failure sentinel', () => {
    assert.equal(sumCompleteCounts([0, 12]), 12)
    assert.equal(sumCompleteCounts([null, 12]), null)
  })
})

describe('applyCounterFloor', () => {
  it('exposes when a stale monotonic floor replaces a lower or invalid read', () => {
    assert.deepEqual(applyCounterFloor(0, 77), { value: 77, floorApplied: true })
    assert.deepEqual(applyCounterFloor(Number.NaN, 77), { value: 77, floorApplied: true })
    assert.deepEqual(applyCounterFloor(81, 77), { value: 81, floorApplied: false })
  })
})

describe('describeSwapCoverage', () => {
  it('only claims complete coverage when no pair or log cap applies', () => {
    assert.match(describeSwapCoverage({
      scannedPairs: 12,
      totalPairs: 12,
      pairEnumerationCapped: false,
      pairResolutionIncomplete: false,
      logWindowCapped: false,
      logCountCapped: false,
    }), /fully covered/i)
  })

  it('names every active bound and labels the result partial', () => {
    const note = describeSwapCoverage({
      scannedPairs: 200,
      totalPairs: 500,
      pairEnumerationCapped: true,
      pairResolutionIncomplete: true,
      logWindowCapped: true,
      logCountCapped: true,
    })

    assert.match(note, /newest 200 of 500/i)
    assert.match(note, /could not be validated/i)
    assert.match(note, /block window/i)
    assert.match(note, /event cap/i)
    assert.match(note, /partial/i)
    assert.doesNotMatch(note, /fully covered/i)
  })
})
