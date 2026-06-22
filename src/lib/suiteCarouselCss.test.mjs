import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`))
  assert.ok(match, `Expected to find ${selector} rule`)
  return match[1]
}

describe('suite ecosystem responsive sizing', () => {
  it('uses stable grid tracks so product stages do not depend on content width', () => {
    const flow = ruleBody('.ecosystem-flow')
    const product = ruleBody('.ecosystem-product')

    assert.ok(flow.includes('grid-template-columns:repeat(6,minmax(0,1fr))'), 'desktop ecosystem flow should use six bounded tracks')
    assert.ok(product.includes('display:block'), 'product links should have stable block boxes')
    assert.ok(product.includes('min-width:0'), 'product links should be allowed to shrink without overflowing')
  })

  it('stacks the ecosystem map and directory cleanly on mobile', () => {
    assert.ok(css.includes('@media(max-width:768px)'), 'Expected tablet/mobile ecosystem rules')
    assert.ok(css.includes('.ecosystem-flow{grid-template-columns:1fr}'), 'mobile flow should stack to one column')
    assert.ok(css.includes('.ecosystem-stage{min-height:0}'), 'mobile stages should not retain desktop height')
    assert.ok(css.includes('.ecosystem-tool-grid{grid-template-columns:1fr 1fr}'), 'mobile directory should use two compact columns')
    assert.ok(css.includes('@media(max-width:430px)'), 'Expected narrow-phone ecosystem rules')
    assert.ok(css.includes('.ecosystem-tool-grid{grid-template-columns:1fr}'), 'narrow phones should use one directory column')
  })
})
