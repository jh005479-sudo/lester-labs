import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  assertProductionBuildControlPlane,
  resolveProductionReleaseBuildId,
} from '../config/productionBuildControlPlane.ts'

const SOURCE_COMMIT = 'a'.repeat(40)

describe('production build control-plane gate', () => {
  it('disables Vercel Git auto-deployments so approval cannot race a merge', () => {
    const configuration = JSON.parse(readFileSync(
      new URL('../../vercel.json', import.meta.url),
      'utf8',
    ))
    assert.deepEqual(configuration.git, { deploymentEnabled: false })
  })

  it('prefers the provider commit and rejects an inconsistent operator build ID', () => {
    assert.equal(resolveProductionReleaseBuildId(undefined, SOURCE_COMMIT), SOURCE_COMMIT)
    assert.equal(resolveProductionReleaseBuildId(SOURCE_COMMIT, SOURCE_COMMIT), SOURCE_COMMIT)
    assert.throws(
      () => resolveProductionReleaseBuildId('b'.repeat(40), SOURCE_COMMIT),
      /must match VERCEL_GIT_COMMIT_SHA/i,
    )
  })

  it('does not block the current fail-closed containment build', () => {
    let calls = 0
    assert.doesNotThrow(() => assertProductionBuildControlPlane({
      publicReplacementStatus: 'NOT_APPROVED',
      releaseBuildId: undefined,
      verifyRecovery: () => { calls += 1 },
      verifyPublicReplacement: () => { calls += 1; return { status: 'APPROVED' } },
    }))
    assert.equal(calls, 0)
  })

  it('requires an exact build identity when replacement writes are approved', () => {
    assert.throws(
      () => assertProductionBuildControlPlane({
        publicReplacementStatus: 'APPROVED',
        releaseBuildId: undefined,
        verifyRecovery: () => {},
        verifyPublicReplacement: () => ({ status: 'APPROVED' }),
      }),
      /requires LESTER_RELEASE_BUILD_ID or VERCEL_GIT_COMMIT_SHA/i,
    )
  })

  it('requires reviewed recovery evidence bound to the exact release source', () => {
    let invocation
    assert.doesNotThrow(() => assertProductionBuildControlPlane({
      publicReplacementStatus: 'APPROVED',
      releaseBuildId: SOURCE_COMMIT,
      verifyRecovery: (filePath, options) => { invocation = { filePath, options } },
      verifyPublicReplacement: () => ({ status: 'APPROVED' }),
    }))
    assert.deepEqual(invocation, {
      filePath: undefined,
      options: { requireReviewed: true },
    })

    assert.throws(
      () => assertProductionBuildControlPlane({
        publicReplacementStatus: 'APPROVED',
        releaseBuildId: SOURCE_COMMIT,
        verifyRecovery: () => { throw new Error('Production control-plane recovery is NOT_REVIEWED.') },
        verifyPublicReplacement: () => ({ status: 'APPROVED' }),
      }),
      /NOT_REVIEWED/,
    )
  })

  it('runs the complete approved public replacement verifier', () => {
    assert.throws(
      () => assertProductionBuildControlPlane({
        publicReplacementStatus: 'APPROVED',
        releaseBuildId: SOURCE_COMMIT,
        verifyRecovery: () => ({ status: 'REVIEWED' }),
        verifyPublicReplacement: () => { throw new Error('source-pinned authority digest mismatch') },
      }),
      /authority digest mismatch/i,
    )
  })

  it('binds the ordinary security-CI production build to the exact checked-out event SHA', () => {
    const packageManifest = JSON.parse(readFileSync(
      new URL('../../package.json', import.meta.url),
      'utf8',
    ))
    assert.equal(packageManifest.scripts.build, 'next build --webpack')

    const workflow = readFileSync(
      new URL('../../.github/workflows/security-ci.yml', import.meta.url),
      'utf8',
    )
    const buildStep = workflow.match(
      /- name: Build the production application[\s\S]*?(?=\n      - name:|$)/,
    )?.[0]
    assert.ok(buildStep, 'security-ci must contain the production build step')
    assert.match(buildStep, /LESTER_RELEASE_BUILD_ID: \$\{\{ github\.sha \}\}/)
    assert.match(buildStep, /test "\$LESTER_RELEASE_BUILD_ID" = "\$GITHUB_SHA"/)
    assert.match(buildStep, /git rev-parse --verify HEAD/)
    assert.match(buildStep, /\^\[0-9a-f\]\{40\}\$/)
    assert.match(buildStep, /npm run build/)
  })
})
