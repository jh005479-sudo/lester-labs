import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { shouldLoadPresaleBrowseData } from './launchpadTab.ts'

describe('shouldLoadPresaleBrowseData', () => {
  it('loads presale browsing data only while the browse tab is active', () => {
    assert.equal(shouldLoadPresaleBrowseData('browse'), true)
    assert.equal(shouldLoadPresaleBrowseData('create'), false)
  })
})
