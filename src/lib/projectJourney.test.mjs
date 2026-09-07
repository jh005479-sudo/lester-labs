import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectLinks, lockVerificationLink, restoreFormDraft, safeReturnPath } from './projectJourney.ts'
import { parseTransactionHistory } from './transactionHistory.ts'

const address = '0x1111111111111111111111111111111111111111'
test('project handoffs carry one valid asset and cannot select external destinations', () => {
  assert.equal(projectLinks(address).vesting, `/vesting?token=${address}`)
  assert.match(projectLinks(address).pool, /createPool=1&token0=0x1/)
  assert.throws(() => projectLinks('bad'))
  for (const value of ['//example.com', '/swap\\evil', 'https://example.com', '/unknown']) assert.equal(safeReturnPath(value), '/projects')
})
test('certificate identity includes the chain, locker and bounded integer ID', () => {
  assert.equal(lockVerificationLink(address, '0'), `/locker/verify?chain=4441&contract=${address}&id=0`)
  for (const id of ['-1', '1e2', '01', (2n ** 256n).toString()]) assert.throws(() => lockVerificationLink(address, id))
})
test('draft restoration preserves schema and ignores unexpected or oversized values', () => {
  const defaults = { name: '', enabled: false, decimals: 18 }
  assert.deepEqual(restoreFormDraft('{"name":"Saved","enabled":"yes","decimals":6,"extra":1}', defaults), { name: 'Saved', enabled: false, decimals: 6 })
  assert.deepEqual(restoreFormDraft('broken', defaults), defaults)
})
test('confirmed history requires a hash and exact supported chain', () => {
  const entry = { id: 'test-1', chainId: 4441, account: address, target: address, action: 'approve', stage: 'submitted', createdAt: 1, updatedAt: 2 }
  assert.deepEqual(parseTransactionHistory(JSON.stringify([entry])), [])
  assert.equal(parseTransactionHistory(JSON.stringify([{ ...entry, hash: `0x${'1'.repeat(64)}` }])).length, 1)
  assert.deepEqual(parseTransactionHistory(JSON.stringify([{ ...entry, chainId: 1, stage: 'wallet' }])), [])
})
