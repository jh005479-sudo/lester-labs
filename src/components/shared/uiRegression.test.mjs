import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()

async function source(file) {
  return readFile(path.join(root, file), 'utf8')
}

describe('shared UI regression contracts', () => {
  it('tears down homepage observers and pointer listeners without injecting fonts', async () => {
    const page = await source('src/app/page.tsx')

    assert.doesNotMatch(page, /fonts\.googleapis\.com/)
    assert.match(page, /revealObserver\.disconnect\(\)/)
    assert.match(page, /bgObserver\.disconnect\(\)/)
    assert.match(page, /removeEventListener\('mousemove'/)
    assert.match(page, /removeEventListener\('scroll'/)
  })

  it('keeps keyboard focus, reduced motion, and the mobile hero in the global contract', async () => {
    const css = await source('src/app/globals.css')

    assert.match(css, /:focus-visible/)
    assert.match(css, /prefers-reduced-motion:\s*reduce/)
    assert.match(css, /\.scroll-hero-spacer\s*\{[^}]*84svh/s)
  })

  it('uses a responsive launch rail instead of a fixed 880px surface', async () => {
    const rail = await source('src/components/shared/LaunchFlowRail.tsx')

    assert.doesNotMatch(rail, /min-w-\[880px\]/)
    assert.match(rail, /aria-label="Launch workflow"/)
    assert.match(rail, /aria-current=/)
    assert.match(rail, /launch-flow-grid/)
  })

  it('serves a smaller WebP for every carousel hero while retaining fallbacks', async () => {
    const hero = await source('src/components/shared/ToolHero.tsx')
    const names = [
      'airdrop',
      'governance',
      'launchpad',
      'liquidity-locker',
      'pool',
      'swap',
      'token-factory',
      'token-vesting',
    ]

    assert.match(hero, /<picture>/)
    assert.match(hero, /type="image\/webp"/)

    for (const name of names) {
      const original = await stat(path.join(root, `public/images/carousel/${name}.png`))
      const modern = await stat(path.join(root, `public/images/carousel/${name}.webp`))
      assert.ok(modern.size < original.size, `${name}.webp should be smaller than its fallback`)
    }
  })
})
