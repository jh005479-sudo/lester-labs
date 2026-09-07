import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { parseUsageEvent } from './usageMetrics.ts'
import { createUsageStore } from '../../services/metrics/store.mjs'

const event = () => ({ id: randomUUID(), device: randomUUID(), session: randomUUID(), kind: 'task_started', surface: 'projects', traffic: 'browser' })
test('metrics accepts only the fixed schema and never wallet data or URLs', () => {
  const value = event()
  assert.deepEqual(parseUsageEvent(value), value)
  assert.throws(() => parseUsageEvent({ ...value, address: '0x123' }))
  assert.throws(() => parseUsageEvent({ ...value, surface: 'https://example.com' }))
})
test('stored metrics deduplicate, exclude development, aggregate return visits and expire after 30 days', () => {
  const store = createUsageStore(':memory:')
  try {
    const now = 90 * 86_400_000
    const value = event()
    assert.equal(store.insert(value, now - 86_400_000), 1)
    assert.equal(store.insert(value, now), 0)
    store.insert({ ...value, id: randomUUID(), kind: 'transaction_confirmed' }, now)
    store.insert({ ...event(), kind: 'transaction_confirmed', traffic: 'development' }, now)
    assert.equal(store.report(now).returningBrowsers, 1)
    assert.equal(store.report(now).completedSessions, 1)
    assert.equal(store.report(now + 31 * 86_400_000).lastSevenDays.length, 0)
  } finally { store.close() }
})
