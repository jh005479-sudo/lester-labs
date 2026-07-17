import type { ParsedRecipient } from './airdropRecipients'

export type AirdropMode = 'token' | 'native'

export interface ConfirmedAirdropBatch {
  index: number
  txHash: string
}

export interface PendingAirdropBatch {
  index: number
  txHash: string
}

export interface AirdropProgress {
  version: 1
  snapshot: string
  batchSize: number
  totalBatches: number
  nextBatchIndex: number
  confirmedBatches: ConfirmedAirdropBatch[]
  pendingBatch?: PendingAirdropBatch
  approvalConfirmed: boolean
  pendingApprovalTxHash?: string
  approvalTxHash?: string
}

const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

export function serializeAirdropSnapshot(recipients: ParsedRecipient[]): string {
  return JSON.stringify(recipients.map(({ address, amount }) => ({ address, amount })))
}

export function splitAirdropBatches<T>(items: T[], batchSize: number): T[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('Airdrop batch size must be a positive integer')
  }

  const batches: T[][] = []
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize))
  }
  return batches
}

export function createAirdropProgress(
  recipients: ParsedRecipient[],
  batchSize: number,
): AirdropProgress {
  return {
    version: 1,
    snapshot: serializeAirdropSnapshot(recipients),
    batchSize,
    totalBatches: Math.ceil(recipients.length / batchSize),
    nextBatchIndex: 0,
    confirmedBatches: [],
    approvalConfirmed: false,
  }
}

export function isAirdropProgressForSnapshot(
  progress: AirdropProgress,
  recipients: ParsedRecipient[],
  batchSize: number,
): boolean {
  return progress.version === 1
    && progress.batchSize === batchSize
    && progress.snapshot === serializeAirdropSnapshot(recipients)
    && progress.totalBatches === Math.ceil(recipients.length / batchSize)
}

export function markApprovalSubmitted(progress: AirdropProgress, txHash: string): AirdropProgress {
  assertTransactionHash(txHash)
  return {
    ...progress,
    pendingApprovalTxHash: txHash,
  }
}

export function markApprovalConfirmed(progress: AirdropProgress, txHash: string): AirdropProgress {
  assertTransactionHash(txHash)
  if (progress.pendingApprovalTxHash && progress.pendingApprovalTxHash !== txHash) {
    throw new Error('Confirmed approval does not match the submitted approval')
  }

  return {
    ...progress,
    approvalConfirmed: true,
    approvalTxHash: txHash,
    pendingApprovalTxHash: undefined,
  }
}

export function clearPendingApproval(progress: AirdropProgress): AirdropProgress {
  return {
    ...progress,
    pendingApprovalTxHash: undefined,
  }
}

export function markBatchSubmitted(
  progress: AirdropProgress,
  index: number,
  txHash: string,
): AirdropProgress {
  assertTransactionHash(txHash)
  if (index !== progress.nextBatchIndex) {
    throw new Error(`Expected batch ${progress.nextBatchIndex + 1}, received batch ${index + 1}`)
  }
  if (progress.pendingBatch) {
    throw new Error('A submitted batch must be resolved before another batch is sent')
  }

  return {
    ...progress,
    pendingBatch: { index, txHash },
  }
}

export function markBatchConfirmed(
  progress: AirdropProgress,
  index: number,
  txHash: string,
): AirdropProgress {
  assertTransactionHash(txHash)

  const existing = progress.confirmedBatches.find((batch) => batch.index === index)
  if (existing) {
    if (existing.txHash !== txHash) {
      throw new Error('Confirmed batch hash does not match stored progress')
    }
    return progress
  }

  if (index !== progress.nextBatchIndex) {
    throw new Error(`Expected confirmation for batch ${progress.nextBatchIndex + 1}`)
  }
  if (progress.pendingBatch
    && (progress.pendingBatch.index !== index || progress.pendingBatch.txHash !== txHash)) {
    throw new Error('Confirmed batch does not match the submitted batch')
  }

  return {
    ...progress,
    nextBatchIndex: index + 1,
    confirmedBatches: [...progress.confirmedBatches, { index, txHash }],
    pendingBatch: undefined,
  }
}

export function clearPendingBatch(progress: AirdropProgress): AirdropProgress {
  return {
    ...progress,
    pendingBatch: undefined,
  }
}

export function parseAirdropProgress(value: string | null): AirdropProgress | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<AirdropProgress>
    if (
      parsed.version !== 1
      || typeof parsed.snapshot !== 'string'
      || !Number.isInteger(parsed.batchSize)
      || (parsed.batchSize ?? 0) <= 0
      || !Number.isInteger(parsed.totalBatches)
      || (parsed.totalBatches ?? -1) < 0
      || !Number.isInteger(parsed.nextBatchIndex)
      || (parsed.nextBatchIndex ?? -1) < 0
      || (parsed.nextBatchIndex ?? 0) > (parsed.totalBatches ?? 0)
      || !Array.isArray(parsed.confirmedBatches)
      || typeof parsed.approvalConfirmed !== 'boolean'
    ) {
      return null
    }

    const confirmedBatches = parsed.confirmedBatches as ConfirmedAirdropBatch[]
    if (
      confirmedBatches.length !== parsed.nextBatchIndex
      || confirmedBatches.some((batch, index) => (
        batch.index !== index || !TRANSACTION_HASH_PATTERN.test(batch.txHash)
      ))
    ) {
      return null
    }

    if (parsed.pendingBatch && (
      parsed.pendingBatch.index !== parsed.nextBatchIndex
      || !TRANSACTION_HASH_PATTERN.test(parsed.pendingBatch.txHash)
    )) {
      return null
    }

    if (parsed.pendingApprovalTxHash && !TRANSACTION_HASH_PATTERN.test(parsed.pendingApprovalTxHash)) {
      return null
    }
    if (parsed.approvalTxHash && !TRANSACTION_HASH_PATTERN.test(parsed.approvalTxHash)) {
      return null
    }

    return parsed as AirdropProgress
  } catch {
    return null
  }
}

export function restoreAirdropProgress(
  value: string | null,
  recipients: ParsedRecipient[],
  batchSize: number,
): AirdropProgress | null {
  if (!value) return null

  const progress = parseAirdropProgress(value)
  if (!progress) {
    throw new Error('Saved airdrop progress is invalid and must be reviewed before another batch can be sent.')
  }
  if (!isAirdropProgressForSnapshot(progress, recipients, batchSize)) {
    throw new Error('Saved airdrop progress belongs to a different recipient list. Restore that list or explicitly discard its progress after checking the stored transactions.')
  }

  return progress
}

export function getAirdropProgressStorageKey(
  walletAddress: string,
  mode: AirdropMode,
  tokenAddress: string,
): string {
  const asset = mode === 'native' ? 'zkltc' : tokenAddress.trim().toLowerCase()
  return `lester-labs:airdrop-progress:4441:${walletAddress.toLowerCase()}:${mode}:${asset}`
}

function assertTransactionHash(txHash: string): void {
  if (!TRANSACTION_HASH_PATTERN.test(txHash)) {
    throw new Error('Invalid transaction hash in airdrop progress')
  }
}
