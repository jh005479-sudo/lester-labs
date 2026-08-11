import {
  APPROVED_PUBLIC_REPLACEMENT_PACKAGE,
  APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK,
  LITVM_CURRENT_ACTIVITY_START_BLOCKS,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
} from './contracts'
import { PLATFORM_ACTIVITY_BASELINE } from './platformActivitySnapshot'

export { PLATFORM_ACTIVITY_BASELINE } from './platformActivitySnapshot'

const BLOCK_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

export function assertPlatformActivityConfiguration(): void {
  if (!BLOCK_HASH_PATTERN.test(PLATFORM_ACTIVITY_BASELINE.blockHash)) {
    throw new Error('The platform activity baseline must pin a full LitVM block hash.')
  }

  const firstPostBaselineBlock = BigInt(PLATFORM_ACTIVITY_BASELINE.throughBlock) + 1n
  for (const [name, startBlock] of Object.entries(LITVM_CURRENT_ACTIVITY_START_BLOCKS)) {
    if (startBlock < firstPostBaselineBlock) {
      throw new Error(`${name} activity starts inside the immutable legacy baseline and would be double counted.`)
    }
  }

  if (
    POST_COMPROMISE_REPLACEMENTS_ACTIVE &&
    PLATFORM_ACTIVITY_BASELINE.snapshotKind !== ('post-replacement-cutover' as string)
  ) {
    throw new Error('Replacement analytics require an exact post-replacement cutover snapshot before live deltas can be enabled.')
  }

  if (POST_COMPROMISE_REPLACEMENTS_ACTIVE) {
    const cutover = APPROVED_PUBLIC_REPLACEMENT_PACKAGE?.activityCutover
    if (
      !cutover ||
      PLATFORM_ACTIVITY_BASELINE.chainId !== 4441 ||
      PLATFORM_ACTIVITY_BASELINE.throughBlock !== cutover.throughBlock ||
      PLATFORM_ACTIVITY_BASELINE.blockHash.toLowerCase() !== cutover.blockHash.toLowerCase() ||
      Object.keys(PLATFORM_ACTIVITY_BASELINE.totals).length !== Object.keys(cutover.totals).length ||
      Object.entries(PLATFORM_ACTIVITY_BASELINE.totals).some(
        ([name, value]) => cutover.totals[name as keyof typeof cutover.totals] !== value,
      )
    ) {
      throw new Error('The approved replacement payload and analytics baseline must pin the same LitVM cutover block and totals.')
    }
    for (const [name, startBlock] of Object.entries(LITVM_CURRENT_ACTIVITY_START_BLOCKS)) {
      if (startBlock !== firstPostBaselineBlock) {
        throw new Error(`${name} activity must start at the first block after the approved cutover.`)
      }
    }
    if (APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK !== firstPostBaselineBlock) {
      throw new Error('Replacement ILO activity must start at the first block after the approved cutover.')
    }
  }

  if (
    APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK !== undefined &&
    APPROVED_ILO_CREATION_ACTIVITY_START_BLOCK < firstPostBaselineBlock
  ) {
    throw new Error('The future ILO factory activity start would overlap the immutable legacy baseline.')
  }

  for (const [name, value] of Object.entries(PLATFORM_ACTIVITY_BASELINE.totals)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Platform activity baseline total is invalid: ${name}.`)
    }
  }
}

assertPlatformActivityConfiguration()
