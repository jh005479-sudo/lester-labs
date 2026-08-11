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
import {
  getPlatformStatsDisclosure,
  getPlatformStatsSessionCacheKey,
  isKnownPlatformActivitySnapshotKind,
  matchesCompiledPlatformActivityBaseline,
} from './platformStatsDisclosure.ts'
import { requirePlatformActivityApiCoverage } from '../../scripts/security/platform-activity-coverage.mjs'

function coveragePayload(status) {
  return Object.fromEntries([
    'tokensMinted',
    'walletsAirdropped',
    'presalesCreated',
    'swapsCompleted',
    'onChainMessages',
  ].map((name) => [name, { status, note: `${name} coverage` }]))
}

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

describe('platform activity cutover compatibility', () => {
  it('accepts the remediated containment API status and the legacy rollout spelling', () => {
    assert.equal(
      requirePlatformActivityApiCoverage(coveragePayload('historical-baseline')).tokensMinted.status,
      'historical-baseline',
    )
    assert.equal(
      requirePlatformActivityApiCoverage(coveragePayload('audited-baseline')).tokensMinted.status,
      'audited-baseline',
    )
  })

  it('continues to reject unknown coverage states', () => {
    assert.throws(
      () => requirePlatformActivityApiCoverage(coveragePayload('unreviewed')),
      /coverage is invalid/i,
    )
  })
})

describe('platform activity disclosure', () => {
  it('uses provisional language for containment, missing, or unknown snapshot kinds', () => {
    const provisional = getPlatformStatsDisclosure('provisional-pre-replacement-floor')
    assert.match(provisional.headline, /provisional/i)
    assert.match(provisional.detail, /must be replaced/i)
    assert.deepEqual(getPlatformStatsDisclosure(undefined), provisional)
    assert.deepEqual(getPlatformStatsDisclosure('unreviewed'), provisional)
    assert.equal(isKnownPlatformActivitySnapshotKind('unreviewed'), false)
  })

  it('uses approved language only for the exact post-replacement cutover kind', () => {
    const approved = getPlatformStatsDisclosure('post-replacement-cutover')
    assert.doesNotMatch(approved.headline, /provisional/i)
    assert.doesNotMatch(approved.detail, /must be replaced|remain zero/i)
    assert.match(approved.detail, /following block/i)
    assert.equal(isKnownPlatformActivitySnapshotKind('post-replacement-cutover'), true)
  })

  it('rejects a future approved cache after rollback to the compiled provisional baseline', () => {
    const futureApproved = {
      ...PLATFORM_ACTIVITY_BASELINE,
      snapshotKind: 'post-replacement-cutover',
      throughBlock: PLATFORM_ACTIVITY_BASELINE.throughBlock + 1,
      blockHash: `0x${'ab'.repeat(32)}`,
      totals: {
        ...PLATFORM_ACTIVITY_BASELINE.totals,
        tokensMinted: PLATFORM_ACTIVITY_BASELINE.totals.tokensMinted + 1,
      },
    }

    assert.equal(
      matchesCompiledPlatformActivityBaseline(PLATFORM_ACTIVITY_BASELINE, PLATFORM_ACTIVITY_BASELINE),
      true,
    )
    assert.equal(matchesCompiledPlatformActivityBaseline(futureApproved, PLATFORM_ACTIVITY_BASELINE), false)
    assert.notEqual(
      getPlatformStatsSessionCacheKey(futureApproved),
      getPlatformStatsSessionCacheKey(PLATFORM_ACTIVITY_BASELINE),
    )
  })

  it('rejects cached totals that do not match the compiled baseline identity', () => {
    const tampered = {
      ...PLATFORM_ACTIVITY_BASELINE,
      totals: {
        ...PLATFORM_ACTIVITY_BASELINE.totals,
        swapsCompleted: PLATFORM_ACTIVITY_BASELINE.totals.swapsCompleted + 1,
      },
    }
    assert.equal(matchesCompiledPlatformActivityBaseline(tampered, PLATFORM_ACTIVITY_BASELINE), false)
  })
})
