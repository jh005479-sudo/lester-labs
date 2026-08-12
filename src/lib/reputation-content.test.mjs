import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { PUBLIC_RELEASE_STATUS } from './publicReleaseStatus.ts'

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('public release posture', () => {
  it('keeps release controls in the central model while product docs stay focused on the current suite', () => {
    const homepage = read('../app/page.tsx')
    const docs = [
      'index.md',
      'token-factory.md',
      'liquidity-locker.md',
      'token-vesting.md',
      'airdrop-tool.md',
      'governance.md',
      'launchpad.md',
      'dex-swap.md',
      'ledger.md',
    ].map((file) => read(`../content/docs/${file}`)).join('\n')

    assert.match(homepage, /PUBLIC_RELEASE_STATUS/)
    assert.match(docs, /Contract directory/i)
    assert.match(docs, /createToken\(name, symbol, totalSupply/i)
    assert.match(docs, /swapExactTokensForTokens/i)
    assert.doesNotMatch(docs, /compromis|legacy deployment|replacement status|authority model|remediation|served-site|MetaMask|cutover block/i)
    assert.equal(PUBLIC_RELEASE_STATUS.mode, 'approved-public-testnet')
    assert.match(PUBLIC_RELEASE_STATUS.security.gatesSummary, /does not weaken the future production profile/i)
    assert.match(PUBLIC_RELEASE_STATUS.security.rows.find((row) => row.area === 'Site reputation')?.detail ?? '', /MetaMask warning.*appeal/i)
  })

  it('does not market the public testnet as a real-value fee or grant service', () => {
    const homepage = read('../app/page.tsx')
    assert.match(PUBLIC_RELEASE_STATUS.homepage.ctaFinePrint, /test assets have no represented value/i)
    assert.doesNotMatch(homepage, /Fee capture layer|Docs, grants|audited unique-user/i)
  })
})

describe('bounded and factual public analytics', () => {
  it('contains no synthetic DEX or launchpad chart generator', () => {
    const dexCharts = read('./dexCharts.ts')
    const launchpadPage = read('../app/launchpad/page.tsx')
    const launchpadDisplay = read('./launchpadDisplay.ts')

    assert.doesNotMatch(dexCharts, /buildReserveHistory|Math\.sin/)
    assert.doesNotMatch(launchpadPage, /sparkPoints|formatPresaleMarketCap|>Market Cap</)
    assert.doesNotMatch(launchpadDisplay, /raised\s*\*\s*50|formatPresaleMarketCap/)
    assert.match(launchpadPage, /Historical raise progress/)
  })

  it('labels pair history and reserve metrics as bounded non-valuations', () => {
    const charts = read('../app/charts/page.tsx')
    assert.match(charts, /up to 72 newest/i)
    assert.match(charts, /not oracle prices/i)
    assert.match(charts, /not TVL/i)
    assert.match(charts, /No synthetic points are added/i)
  })

  it('does not present an incorrect impermanent-loss or profit calculator', () => {
    const lpPanel = read('../components/portfolio/LPPanel.tsx')
    assert.doesNotMatch(lpPanel, /Impermanent Loss Calculator|IL formula|Total PnL/)
    assert.match(lpPanel, /No price oracle, reserve valuation, cost basis, fees, tax data, or investment return is fetched or inferred/)
  })
})

describe('reputation-sensitive metadata and indexing', () => {
  it('describes transactional routes as disabled or recovery-only', () => {
    const metadata = [
      read('../app/airdrop/layout.tsx'),
      read('../app/launchpad/layout.tsx'),
      read('../app/pool/layout.tsx'),
      read('../app/swap/layout.tsx'),
    ].join('\n')

    assert.match(metadata, /disabled/i)
    assert.match(metadata, /containment|recovery/i)
    assert.doesNotMatch(metadata, /Trade any ERC-20|Create your own ILO/i)
  })

  it('uses a factual fixed sitemap revision and prioritizes security', () => {
    const sitemap = read('../app/sitemap.ts')
    assert.match(sitemap, /2026-08-04T00:00:00\.000Z/)
    assert.doesNotMatch(sitemap, /route: '\/security'/)
    assert.doesNotMatch(sitemap, /lastModified:\s*new Date\(\)/)
  })

  it('ships the local LitVM tutorial diagram without executable SVG surfaces', () => {
    const tutorials = read('./tutorials-content.ts')
    const diagram = read('../../public/images/tutorials/litvm-diagram.svg')
    assert.match(tutorials, /src: '\/images\/tutorials\/litvm-diagram\.svg'/)
    assert.match(diagram, /<title[^>]*>LitVM validity-rollup architecture<\/title>/)
    assert.doesNotMatch(diagram, /<(?:script|foreignObject|animate|set)\b/i)
    assert.doesNotMatch(diagram, /\son[a-z]+\s*=/i)
    assert.doesNotMatch(diagram, /(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)/i)
  })

  it('never labels the retired governance token canonical', () => {
    const indexer = read('./token-indexer-utils.ts')
    assert.match(indexer, /not canonical/i)
    assert.doesNotMatch(indexer, /Canonical LitVM governance token/)
  })
})
