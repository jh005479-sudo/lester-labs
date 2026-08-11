/**
 * Exact public-testnet cutover floor for public platform activity counters.
 *
 * The legacy on-chain counters were read at this block, the two explicitly
 * bounded first-party display counters were captured from the served API, and
 * a distinct RPC independently proved the exact block/counter identity. New
 * analytics add only source-pinned replacement activity from the next block.
 */
export const PLATFORM_ACTIVITY_BASELINE = Object.freeze({
  schemaVersion: 1,
  snapshotKind: 'post-replacement-cutover',
  chainId: 4441,
  throughBlock: 38_999_871,
  blockHash: '0x0f08a4e58106a4cd465555c5a3b0a2bf44e723277ff69f0a6c0b22de3c77c9da',
  blockTimestamp: '2026-08-11T07:27:41.000Z',
  totals: Object.freeze({
    tokensMinted: 517_422,
    walletsAirdropped: 16_433,
    presalesCreated: 8_511,
    swapsCompleted: 12_975,
    onChainMessages: 66_832,
  }),
  metricMethods: Object.freeze({
    tokensMinted: 'Block-pinned legacy TokenFactory CREATE nonce minus the EIP-161 initial contract nonce.',
    walletsAirdropped: 'First-party historical production display floor; the legacy Disperse contract has no authenticated counter or event and addresses may repeat.',
    presalesCreated: 'Sum of both source-pinned legacy ILOFactory getILOCount() values at the captured block.',
    swapsCompleted: 'First-party historical production display floor; the old API served its last known bounded value and this is not volume or distinct users.',
    onChainMessages: 'Source-pinned legacy Ledger messageCount() at the captured block.',
  }),
  provenance: Object.freeze({
    label: 'Lester Labs immutable public-testnet analytics cutover',
    repositoryUrl: 'https://github.com/jh005479-sudo/lester-labs',
    productionSnapshotObservedAt: '2026-08-11T07:27:46.106Z',
    blockReverifiedAt: '2026-08-11T07:27:46.305Z',
    secondRpcOrigin: 'https://rpc.lite-node.com',
    disclaimer: 'Historical counts may contain repeated, automated, bot, or spam-heavy on-chain actions. Wallet and swap figures are bounded first-party display counters, not unique users or volume.',
    countingRule: 'Freeze every legacy/display total through block 38,999,871 and add only verified replacement counters beginning at block 38,999,872.',
  }),
} as const)
