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

describe('suite carousel mobile sizing', () => {
  it('uses explicit flex sizing so card width cannot depend on each tool card content', () => {
    const baseSlide = ruleBody('.carousel-slide')
    const mobileSlide = css.match(/@media\(max-width:640px\)\{\.carousel-slide\{([^}]*)\}\}/)?.[1]

    assert.ok(baseSlide.includes('flex:0 0 70%'), 'desktop/base slide should have fixed flex basis')
    assert.ok(baseSlide.includes('width:70%'), 'desktop/base slide should have explicit width')
    assert.ok(mobileSlide, 'Expected mobile carousel slide override')
    assert.ok(mobileSlide.includes('flex-basis:90%'), 'mobile slide should keep a fixed flex basis')
    assert.ok(mobileSlide.includes('width:90%'), 'mobile slide should keep a fixed width')
    assert.ok(mobileSlide.includes('max-width:none'), 'mobile slide should not inherit desktop max width')
  })

  it('keeps the mobile visual preview tall enough to avoid cropping wide tool artwork', () => {
    const mobileVisual = css.match(/@media\(max-width:700px\)\{[^}]*\.c-card-visual\{([^}]*)\}/)?.[1]

    assert.ok(mobileVisual, 'Expected mobile visual card override')
    assert.ok(mobileVisual.includes('aspect-ratio:16/9'), 'mobile artwork should keep the source image ratio')
    assert.ok(mobileVisual.includes('min-height:160px'), 'mobile artwork should preserve a usable preview height')
  })
})
