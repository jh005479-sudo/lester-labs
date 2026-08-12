import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { PUBLIC_RELEASE_STATUS, getPublicReleaseStatus } from './publicReleaseStatus.ts'

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function filesBelow(directory, suffix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(path, suffix) : entry.name.endsWith(suffix) ? [path] : []
  })
}

const inactiveSignals = Object.freeze({
  replacementsActive: false,
  governanceActive: false,
  approvedPackagePresent: false,
  publicTestnetRelease: false,
})

const activeSignals = Object.freeze({
  replacementsActive: true,
  governanceActive: true,
  approvedPackagePresent: true,
  publicTestnetRelease: false,
})

const publicTestnetSignals = Object.freeze({
  replacementsActive: true,
  governanceActive: false,
  approvedPackagePresent: true,
  publicTestnetRelease: true,
})

describe('public release status', () => {
  it('preserves fail-closed containment presentation for a fully inactive package', () => {
    const status = getPublicReleaseStatus(inactiveSignals)

    assert.equal(status.mode, 'containment')
    assert.equal(status.ordinaryWritesEnabled, false)
    assert.match(status.banner, /ordinary contract writes are disabled/i)
    assert.match(status.security.gatesSummary, /only after both gates pass/i)
    assert.equal(status.security.rows.find((row) => row.area === 'Application writes')?.status, 'Contained')
  })

  it('publishes the exact immutable public-testnet authority model while governance remains disabled', () => {
    const status = getPublicReleaseStatus(publicTestnetSignals)
    assert.equal(status, PUBLIC_RELEASE_STATUS)
    assert.equal(status.mode, 'approved-public-testnet')
    assert.equal(status.ordinaryWritesEnabled, true)
    assert.match(status.banner, /live on LitVM LiteForge testnet.*chain 4441/i)
    assert.match(status.security.gateADetail, /production multisig and independent-reviewer requirements remain reserved/i)
    assert.equal(status.security.rows.find((row) => row.area === 'Governance writes')?.status, 'Disabled')
  })

  it('switches every key status surface to the reviewed candidate without claiming served parity', () => {
    const status = getPublicReleaseStatus(activeSignals)
    const publicCopy = [
      status.banner,
      status.footer,
      status.metadataDescription,
      ...Object.values(status.homepage),
      status.security.heading,
      status.security.introduction,
      status.security.gatesHeading,
      status.security.gatesSummary,
      ...status.security.rows.flatMap((row) => [row.status, row.detail]),
    ].join('\n')

    assert.equal(status.mode, 'approved-production')
    assert.equal(status.ordinaryWritesEnabled, true)
    assert.match(status.security.gatesSummary, /protected frontend approval and served parity remain mandatory/i)
    assert.match(publicCopy, /must not be served publicly|not authorized for public serving/i)
    assert.doesNotMatch(publicCopy, /both independent release gates passed|served-build evidence passed|production release is active/i)
    assert.doesNotMatch(publicCopy, /containment is active|ordinary (?:contract )?writes (?:stay |remain |are )?disabled|replacement deployments remain pending/i)
  })

  it('fails the build for a partial activation instead of publishing contradictory copy', () => {
    for (const partial of [
      { ...inactiveSignals, replacementsActive: true },
      { ...inactiveSignals, approvedPackagePresent: true },
      { ...activeSignals, governanceActive: false },
      { ...publicTestnetSignals, governanceActive: true },
    ]) {
      assert.throws(() => getPublicReleaseStatus(partial), /must match the approved production or bounded public-testnet/i)
    }
  })

  it('routes the homepage, global banner, footer, metadata, and navigation copy through the model', () => {
    for (const relativePath of [
      '../app/page.tsx',
      '../app/layout.tsx',
      '../components/home/ScrollHero.tsx',
      '../components/LTCBanner.tsx',
      '../components/layout/SiteFooter.tsx',
      './product-flow.ts',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
      assert.match(source, /PUBLIC_RELEASE_STATUS/, `${relativePath} must derive release copy from the central model`)
    }
  })

  it('keeps release-sensitive route copy behind the central invariant and rejects known stale absolute claims', () => {
    const explicitLegacyRouteAllowlist = new Set([
      'app/launchpad/[address]/page.tsx',
    ])
    const releaseSensitive = /post-compromise containment|ordinary (?:contract )?writes|new (?:swaps|pools|locks|schedules|presales).*disabled|replacement (?:active|pending)|served[- ]build/i
    const forbiddenAbsoluteClaims = /both independent release gates passed|served-build evidence passed|production release is active|served build (?:is|and .* are) source-pinned to the reviewed replacement/i

    for (const filePath of filesBelow(join(sourceRoot, 'app'), '.tsx')) {
      const source = readFileSync(filePath, 'utf8')
      const relativePath = relative(sourceRoot, filePath)
      assert.doesNotMatch(source, forbiddenAbsoluteClaims, `${relativePath} contains an unproven absolute release claim`)
      if (releaseSensitive.test(source) && !explicitLegacyRouteAllowlist.has(relativePath)) {
        assert.match(source, /PUBLIC_RELEASE_STATUS/, `${relativePath} must derive release-sensitive copy from PUBLIC_RELEASE_STATUS`)
      }
    }

    const staleDocumentationClaims = /No replacement address is approved yet|No replacement is active until|A replacement factory is prepared but not active/i
    for (const filePath of filesBelow(join(sourceRoot, 'content/docs'), '.md')) {
      assert.doesNotMatch(
        readFileSync(filePath, 'utf8'),
        staleDocumentationClaims,
        `${relative(sourceRoot, filePath)} contains a false-after-activation absolute claim`,
      )
    }
  })
})
