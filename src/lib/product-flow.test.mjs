import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isActivePath, launchFlow } from './product-flow.ts'

describe('launchFlow', () => {
  it('links the presale step to the recovery-only launchpad', () => {
    assert.equal(launchFlow.find((step) => step.key === 'launchpad')?.href, '/launchpad')
  })
})

describe('isActivePath', () => {
  it('matches the recovery page and authenticated child routes', () => {
    assert.equal(isActivePath('/launchpad', '/launchpad'), true)
    assert.equal(isActivePath('/launchpad/0xabc', '/launchpad'), true)
  })
})
