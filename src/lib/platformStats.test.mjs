import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyCounterFloor,
  describeSwapCoverage,
  getAuthenticatedCounterBaseline,
  getBoundedStatsLogRange,
  getPostCutoverCounterDelta,
  selectNewestPairIndices,
  sumCompleteCounts,
} from './platformStatsBounds.ts'
import { PLATFORM_ACTIVITY_BASELINE } from '../config/platformActivitySnapshot.ts'

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

describe('getAuthenticatedCounterBaseline', () => {
  it('keeps unauthenticated event lookalikes out of cumulative counters', () => {
    const baseline = getAuthenticatedCounterBaseline(16_433, 3_412_247n)

    assert.equal(baseline.value, 16_433)
    assert.match(baseline.note, /unauthenticated event lookalikes are excluded/i)
    assert.match(baseline.note, /not an independent audit/i)
  })
})

describe('getPostCutoverCounterDelta', () => {
  it('adds only activity after the pinned counter snapshot', () => {
    assert.deepEqual(getPostCutoverCounterDelta(112, 77), { delta: 35, resetDetected: false })
  })

  it('does not turn a reset or mismatched deployment into a negative total', () => {
    assert.deepEqual(getPostCutoverCounterDelta(2, 77), { delta: 0, resetDetected: true })
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

describe('provisional historical platform floor', () => {
  it('preserves production counters without claiming a replacement cutover or independent audit', () => {
    assert.equal(PLATFORM_ACTIVITY_BASELINE.snapshotKind, 'provisional-pre-replacement-floor')
    assert.equal(PLATFORM_ACTIVITY_BASELINE.throughBlock, 36_723_038)
    assert.equal(
      PLATFORM_ACTIVITY_BASELINE.blockHash,
      '0x137d1e60f771a7686ed81f77bcf8c4f4a71e6af7bb96620eda11e34031534552',
    )
    assert.deepEqual(PLATFORM_ACTIVITY_BASELINE.totals, {
      tokensMinted: 500_139,
      walletsAirdropped: 16_433,
      presalesCreated: 8_451,
      swapsCompleted: 12_975,
      onChainMessages: 66_776,
    })
    assert.match(PLATFORM_ACTIVITY_BASELINE.provenance.countingRule, /live deltas stay disabled/i)
    assert.match(PLATFORM_ACTIVITY_BASELINE.provenance.disclaimer, /not an independent audit/i)
    assert.match(PLATFORM_ACTIVITY_BASELINE.provenance.disclaimer, /bot|spam/i)
  })
})
