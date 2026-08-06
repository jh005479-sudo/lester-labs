/**
 * Provisional continuity floor for public platform activity counters.
 *
 * These are the exact values returned by the production platform-stats API at
 * the initial incident-review observation, pinned to a contemporaneous LitVM
 * block identity. They preserve a visible lower floor, but the stale public
 * deployment and legacy contracts remained callable afterward. They are not
 * the final cutover values or an independently reconstructed on-chain audit.
 *
 * Replacement deployment must atomically recapture every historical source,
 * including both legacy ILO factory series, then replace this provisional floor
 * with a post-replacement cutover block/hash/totals snapshot. Runtime analytics
 * may only add activity from source-pinned replacements after that cutover.
 */
export const PLATFORM_ACTIVITY_BASELINE = Object.freeze({
  schemaVersion: 1,
  snapshotKind: 'provisional-pre-replacement-floor',
  chainId: 4441,
  throughBlock: 36_723_038,
  blockHash: '0x137d1e60f771a7686ed81f77bcf8c4f4a71e6af7bb96620eda11e34031534552',
  blockTimestamp: '2026-08-04T16:42:21Z',
  totals: Object.freeze({
    tokensMinted: 500_139,
    walletsAirdropped: 16_433,
    presalesCreated: 8_451,
    swapsCompleted: 12_975,
    onChainMessages: 66_776,
  }),
  metricMethods: Object.freeze({
    tokensMinted: 'Production API continuity floor observed during initial incident review; later legacy activity is deliberately deferred to the replacement cutover capture.',
    walletsAirdropped: 'Production API historical recipient-address floor; addresses may repeat across actions and are not unique people or independently verified users.',
    presalesCreated: 'Production API aggregate: 8,330 from 0xC9B1961def0cC5bc1ffe3cFe37a4988D7987A43f plus 121 from 0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB.',
    swapsCompleted: 'Production API historical swap-action floor; exact event provenance must be recaptured at replacement cutover. This is not volume or unique users, and permissionless valid low-value swaps can inflate action counts.',
    onChainMessages: 'Production API historical on-chain message-action floor observed immediately before containment.',
  }),
  provenance: Object.freeze({
    label: 'Lester Labs provisional initial-incident production-counter floor',
    repositoryUrl: 'https://github.com/jh005479-sudo/lester-labs',
    productionSnapshotObservedAt: '2026-08-04T16:42:11.165Z',
    blockReverifiedAt: '2026-08-04T16:42:21Z',
    disclaimer: 'First-party provisional continuity record, not an independent audit. Historical counts may contain repeated, automated, bot, or spam-heavy on-chain actions.',
    countingRule: 'Freeze the observed production values. Live deltas stay disabled until replacements deploy and an atomic, overlap-safe cutover block/hash/totals capture replaces this provisional floor.',
  }),
} as const)
