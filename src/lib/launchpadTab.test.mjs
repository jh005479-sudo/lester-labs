import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getLaunchpadReadPlan, shouldLoadPresaleBrowseData } from './launchpadTab.ts'

describe('shouldLoadPresaleBrowseData', () => {
  it('loads presale browsing data only while the browse tab is active', () => {
    assert.equal(shouldLoadPresaleBrowseData('browse'), true)
    assert.equal(shouldLoadPresaleBrowseData('create'), false)
  })
})

describe('getLaunchpadReadPlan', () => {
  it('disables browse-side contract reads while the create tab is active', () => {
    assert.deepEqual(getLaunchpadReadPlan('browse'), {
      factoryCount: true,
      presaleAddresses: true,
      presaleData: true,
      tokenMetadata: true,
      tokenImages: true,
    })
    assert.deepEqual(getLaunchpadReadPlan('create'), {
      factoryCount: false,
      presaleAddresses: false,
      presaleData: false,
      tokenMetadata: false,
      tokenImages: false,
    })
  })
})
