import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addSavedSearch,
  addWatchlistItem,
  addAddressBookEntry,
  buildResumeActivity,
  parseAddressBookCsv,
  recordRecentActivity,
  removeAddressBookEntry,
  removeWatchlistItem,
} from './localEngagement.ts'

describe('watchlist helpers', () => {
  it('dedupes watchlist items by type and lowercase id', () => {
    const items = addWatchlistItem([], { type: 'token', id: '0xABC', label: 'ABC', href: '/explorer/token/0xABC' }, 1)
    const next = addWatchlistItem(items, { type: 'token', id: '0xabc', label: 'ABC v2', href: '/explorer/token/0xabc' }, 2)

    assert.equal(next.length, 1)
    assert.equal(next[0].label, 'ABC v2')
    assert.equal(next[0].updatedAt, 2)
  })

  it('removes only the matching watchlist item', () => {
    const items = [
      { type: 'token', id: '0xabc', label: 'ABC', href: '/explorer/token/0xabc', updatedAt: 1 },
      { type: 'pool', id: '0xabc', label: 'ABC / zkLTC', href: '/charts?pair=0xabc', updatedAt: 1 },
    ]

    assert.deepEqual(removeWatchlistItem(items, 'token', '0xABC'), [items[1]])
  })
})

describe('address book helpers', () => {
  it('parses csv rows, dedupes addresses, and ignores invalid rows', () => {
    const csv = [
      'Treasury,0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222,Rewards',
      'not-an-address,Nope',
      'Treasury v2,0x1111111111111111111111111111111111111111',
    ].join('\n')

    const entries = parseAddressBookCsv(csv, 10)

    assert.equal(entries.length, 2)
    assert.equal(entries[0].label, 'Treasury v2')
    assert.equal(entries[0].address, '0x1111111111111111111111111111111111111111')
    assert.equal(entries[1].label, 'Rewards')
  })

  it('adds and removes address book entries by normalized address', () => {
    const entries = addAddressBookEntry([], {
      address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      label: 'Alice',
    }, 1)

    assert.equal(entries.length, 1)
    assert.equal(removeAddressBookEntry(entries, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').length, 0)
  })
})

describe('saved searches and resume activity', () => {
  it('keeps saved searches newest first and scoped by surface', () => {
    const searches = addSavedSearch([], { surface: 'explorer', query: '0xABC' }, 1)
    const next = addSavedSearch(searches, { surface: 'explorer', query: '0xabc' }, 2)

    assert.equal(next.length, 1)
    assert.equal(next[0].query, '0xabc')
    assert.equal(next[0].updatedAt, 2)
  })

  it('builds a resume dashboard from newest activity, watchlist, and saved searches', () => {
    const activity = recordRecentActivity([], { type: 'presale', id: '0x123', label: 'Launch', href: '/launchpad/0x123', action: 'View presale' }, 10)
    const resume = buildResumeActivity({
      activities: activity,
      watchlist: [{ type: 'token', id: '0xabc', label: 'ABC', href: '/explorer/token/0xabc', updatedAt: 9 }],
      searches: [{ surface: 'pool', query: 'ABC', updatedAt: 8 }],
    })

    assert.equal(resume[0].kind, 'activity')
    assert.equal(resume[1].kind, 'watchlist')
    assert.equal(resume[2].kind, 'search')
  })
})
