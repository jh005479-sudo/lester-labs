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

  it('does not present the activated replacement launchpad as unconditionally disabled', async () => {
    const launchpad = await source('src/app/launchpad/page.tsx')

    assert.match(launchpad, /PUBLIC_RELEASE_STATUS\.ordinaryWritesEnabled \? 'Create a presale'/)
    assert.match(launchpad, /PUBLIC_RELEASE_STATUS\.ordinaryWritesEnabled[\s\S]*\? 'Create Presale'/)
    assert.match(launchpad, /source-pinned immutable replacement factory/i)
    assert.match(launchpad, /Current replacement presales/)
    assert.match(launchpad, /LITVM_LEGACY_ILO_FACTORIES/)
    assert.match(launchpad, /aria-label="Presale source"/)
    assert.match(launchpad, /approved replacement ILO Factory is unavailable/)
    assert.doesNotMatch(launchpad, />\s*Presale creation disabled\s*</)
    assert.doesNotMatch(launchpad, /The legacy ILO Factory is retired/)
  })

  it('does not reject valid ERC-20 metadata after one bursty RPC failure', async () => {
    const indexer = await source('src/lib/token-indexer.ts')

    assert.match(indexer, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/)
    assert.match(indexer, /const name = await client\.readContract/)
    assert.doesNotMatch(indexer, /const \[name, symbol, decimals, totalSupply\] = await Promise\.all/)
    assert.doesNotMatch(indexer, /Not a valid ERC-20 token/)
  })

  it('describes replacement launchpad actions according to their authenticated write policy', async () => {
    const detail = await source('src/app/launchpad/[address]/page.tsx')

    assert.match(detail, /paidWritesApproved[\s\S]*source-pinned replacement sale is live/)
    assert.match(detail, /paidWritesApproved[\s\S]*Contributions are available only while this replacement sale is live/)
    assert.match(detail, /source-pinned replacement and legacy Lester Labs ILO factories/)
  })

  it('presents the active replacement swap and applies URL-selected pair tokens', async () => {
    const swap = await source('src/app/swap/page.tsx')

    assert.match(swap, /PUBLIC_RELEASE_STATUS\.ordinaryWritesEnabled \? 'Swap' : 'Read-only legacy quote'/)
    assert.match(swap, /setInputToken\(initialCreatePoolToken0\)/)
    assert.match(swap, /setOutputToken\(initialCreatePoolToken1\)/)
    assert.match(swap, /source-pinned replacement DEX quote on chain 4441/)
    assert.match(swap, /Source-pinned Replacement Reserve Quote/)
    assert.doesNotMatch(swap, />Legacy Reserve Quote</)
  })

  it('loads Ledger history from a bounded validated index instead of an unbounded block-one RPC scan', async () => {
    const hook = await source('src/hooks/useLedgerFeed.ts')
    const history = await source('src/lib/contracts/ledgerHistory.ts')
    const page = await source('src/app/ledger/page.tsx')
    const activityRail = await source('src/components/shared/LiveActivityRail.tsx')

    assert.match(hook, /fetchLedgerHistoryPage/)
    assert.doesNotMatch(hook, /topics: \[LEDGER_MESSAGE_POSTED_TOPIC, null, indices\.map/)
    assert.match(history, /normalizeExplorerLedgerHistoryPage/)
    const parsing = await source('src/lib/contracts/ledgerHistoryParsing.ts')
    assert.match(parsing, /returnedAddress\.toLowerCase\(\) !== expectedAddress\.toLowerCase\(\)/)
    assert.match(parsing, /topics\[0\]\.toLowerCase\(\) !== expectedTopic\.toLowerCase\(\)/)
    assert.match(hook, /older event.*currently unavailable from the provider archive/)
    assert.match(page, />Posting Fee</)
    assert.match(activityRail, /Validated public index/)
    assert.doesNotMatch(activityRail, /Paginated RPC view/)

    const transaction = await source('src/app/explorer/tx/[hash]/page.tsx')
    assert.match(transaction, /source-pinned replacement Ledger transaction/)
    assert.doesNotMatch(transaction, /Decoded from a legacy Ledger transaction/)

    const releasePolicy = JSON.parse(await source('src/config/frontendReleasePolicy.json'))
    assert.match(
      releasePolicy.criticalResponseHeaders['Content-Security-Policy'],
      /connect-src[^;]*https:\/\/liteforge\.explorer\.caldera\.xyz/,
    )
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
