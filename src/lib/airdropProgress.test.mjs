import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createAirdropProgress,
  isAirdropProgressForSnapshot,
  markBatchConfirmed,
  markBatchSubmitted,
  parseAirdropProgress,
  restoreAirdropProgress,
  splitAirdropBatches,
} from './airdropProgress.ts'

const txHash = (digit) => `0x${digit.repeat(64)}`

function recipients(count) {
  return Array.from({ length: count }, (_, index) => ({
    address: `0x${index.toString(16).padStart(40, '0')}`,
    amount: `${index + 1}`,
  }))
}

describe('airdrop retry cursor', () => {
  it('persists confirmed hashes and resumes at only the unconfirmed suffix', () => {
    const snapshot = recipients(450)
    const batches = splitAirdropBatches(snapshot, 200)
    let progress = createAirdropProgress(snapshot, 200)

    progress = markBatchSubmitted(progress, 0, txHash('1'))
    progress = markBatchConfirmed(progress, 0, txHash('1'))
    progress = markBatchSubmitted(progress, 1, txHash('2'))
    progress = markBatchConfirmed(progress, 1, txHash('2'))

    const restored = parseAirdropProgress(JSON.stringify(progress))
    assert.ok(restored)
    assert.equal(restored.nextBatchIndex, 2)
    assert.deepEqual(restored.confirmedBatches, [
      { index: 0, txHash: txHash('1') },
      { index: 1, txHash: txHash('2') },
    ])
    assert.deepEqual(batches.slice(restored.nextBatchIndex), [snapshot.slice(400)])
  })

  it('retains an in-flight hash so retry resolves it instead of broadcasting a duplicate', () => {
    const snapshot = recipients(250)
    const progress = markBatchSubmitted(createAirdropProgress(snapshot, 200), 0, txHash('a'))
    const restored = parseAirdropProgress(JSON.stringify(progress))

    assert.deepEqual(restored?.pendingBatch, { index: 0, txHash: txHash('a') })
    assert.equal(restored?.nextBatchIndex, 0)
    assert.throws(
      () => markBatchSubmitted(restored, 0, txHash('b')),
      /must be resolved/,
    )
  })

  it('rejects replayed, skipped, corrupted, and different-snapshot progress', () => {
    const snapshot = recipients(250)
    let progress = createAirdropProgress(snapshot, 200)
    progress = markBatchConfirmed(progress, 0, txHash('c'))

    assert.throws(() => markBatchSubmitted(progress, 0, txHash('d')), /Expected batch 2/)
    assert.throws(() => markBatchSubmitted(progress, 2, txHash('d')), /Expected batch 2/)
    assert.equal(isAirdropProgressForSnapshot(progress, snapshot.slice(1), 200), false)
    assert.equal(parseAirdropProgress(JSON.stringify({ ...progress, nextBatchIndex: 0 })), null)
    assert.throws(
      () => restoreAirdropProgress(JSON.stringify(progress), snapshot.slice(1), 200),
      /different recipient list/,
    )
    assert.throws(
      () => restoreAirdropProgress('{corrupt', snapshot, 200),
      /invalid/,
    )
  })
})
