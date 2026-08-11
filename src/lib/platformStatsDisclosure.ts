export const PROVISIONAL_ACTIVITY_SNAPSHOT_KIND = 'provisional-pre-replacement-floor' as const
export const APPROVED_ACTIVITY_SNAPSHOT_KIND = 'post-replacement-cutover' as const

const BLOCK_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/
const METRIC_NAMES = Object.freeze([
  'tokensMinted',
  'walletsAirdropped',
  'presalesCreated',
  'swapsCompleted',
  'onChainMessages',
]) as readonly string[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function isKnownPlatformActivitySnapshotKind(value: unknown): value is
  | typeof PROVISIONAL_ACTIVITY_SNAPSHOT_KIND
  | typeof APPROVED_ACTIVITY_SNAPSHOT_KIND {
  return value === PROVISIONAL_ACTIVITY_SNAPSHOT_KIND || value === APPROVED_ACTIVITY_SNAPSHOT_KIND
}

export function matchesCompiledPlatformActivityBaseline(candidate: unknown, compiled: unknown): boolean {
  if (!isRecord(candidate) || !isRecord(compiled)) return false
  if (
    !isKnownPlatformActivitySnapshotKind(candidate.snapshotKind) ||
    candidate.snapshotKind !== compiled.snapshotKind ||
    candidate.chainId !== compiled.chainId ||
    candidate.throughBlock !== compiled.throughBlock ||
    typeof candidate.blockHash !== 'string' ||
    typeof compiled.blockHash !== 'string' ||
    !BLOCK_HASH_PATTERN.test(candidate.blockHash) ||
    candidate.blockHash.toLowerCase() !== compiled.blockHash.toLowerCase() ||
    !isRecord(candidate.totals) ||
    !isRecord(compiled.totals)
  ) return false

  const candidateTotals = candidate.totals
  const compiledTotals = compiled.totals

  return METRIC_NAMES.every((name) => (
    Number.isSafeInteger(candidateTotals[name]) &&
    candidateTotals[name] === compiledTotals[name]
  ))
}

export function getPlatformStatsSessionCacheKey(compiled: unknown): string {
  if (!isRecord(compiled) || !isKnownPlatformActivitySnapshotKind(compiled.snapshotKind)) {
    throw new Error('The compiled platform activity snapshot kind is invalid.')
  }
  if (
    compiled.chainId !== 4441 ||
    !Number.isSafeInteger(compiled.throughBlock) ||
    typeof compiled.blockHash !== 'string' ||
    !BLOCK_HASH_PATTERN.test(compiled.blockHash) ||
    !isRecord(compiled.totals)
  ) throw new Error('The compiled platform activity baseline identity is invalid.')

  const compiledTotals = compiled.totals
  if (!METRIC_NAMES.every((name) => Number.isSafeInteger(compiledTotals[name]))) {
    throw new Error('The compiled platform activity baseline totals are invalid.')
  }

  return [
    'lester_platform_stats_v5',
    compiled.snapshotKind,
    compiled.chainId,
    compiled.throughBlock,
    compiled.blockHash.toLowerCase(),
    ...METRIC_NAMES.map((name) => compiledTotals[name]),
  ].join(':')
}

const PROVISIONAL_DISCLOSURE = Object.freeze({
  headline: 'Provisional first-party historical action counts—not users or an independent audit.',
  summary: 'The preserved floor may include repeated, automated, bot, or spam-heavy activity. The permissionless swap counter can also be increased by valid low-value swaps and is not a volume or unique-user metric. New activity is added only from source-pinned replacement counters after the reviewed cutover; no compromised-deployment activity is added.',
  detail: 'This provisional floor preserves the production display without counting further compromised-deployment activity. It must be replaced by an atomic, overlap-safe capture of every legacy source—including both ILO factory series—at the exact replacement cutover block. Live deltas remain zero until that reviewed capture.',
})

const APPROVED_DISCLOSURE = Object.freeze({
  headline: 'Preserved historical action counts plus source-pinned post-cutover activity—not users or an independent audit.',
  summary: 'The approved historical floor may include repeated, automated, bot, or spam-heavy activity. The permissionless swap counter can also be increased by valid low-value swaps and is not a volume or unique-user metric. Only activity from source-pinned replacement counters after the reviewed cutover is added.',
  detail: 'The approved overlap-safe cutover captures every reviewed legacy source—including both ILO factory series—at one exact LitVM block. Live deltas begin at the following block and are counted only from the source-pinned replacement contracts.',
})

export function getPlatformStatsDisclosure(snapshotKind: unknown) {
  return snapshotKind === APPROVED_ACTIVITY_SNAPSHOT_KIND
    ? APPROVED_DISCLOSURE
    : PROVISIONAL_DISCLOSURE
}
