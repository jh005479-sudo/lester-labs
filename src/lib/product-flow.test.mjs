import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isActivePath, launchFlow } from './product-flow.ts'

describe('launchFlow', () => {
  it('links the presale step directly to create mode', () => {
    assert.equal(launchFlow.find((step) => step.key === 'launchpad')?.href, '/launchpad?tab=create')
  })
})

describe('isActivePath', () => {
  it('matches active paths when flow links include query parameters', () => {
    assert.equal(isActivePath('/launchpad', '/launchpad?tab=create'), true)
    assert.equal(isActivePath('/launchpad/0xabc', '/launchpad?tab=create'), true)
  })
})
