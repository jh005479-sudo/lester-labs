import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  RELEASE_PROFILES,
  PUBLIC_TESTNET_VERCEL_TARGET,
  VERIFICATION_PROFILES,
  assertVantageId,
  promotedApiAliasesForReleaseProfile,
  releaseProfileForVerification,
  vantageIdsForVerification,
  verificationProfileForRelease,
} from '../../scripts/security/release-profiles.mjs'
import { verifyReleaseProfile } from '../../scripts/security/verify-release-profile.mjs'

describe('explicit release and parity profiles', () => {
  it('accepts only the checked-in immutable public-testnet exception', () => {
    assert.deepEqual(verifyReleaseProfile(RELEASE_PROFILES.PUBLIC_TESTNET), {
      releaseProfile: RELEASE_PROFILES.PUBLIC_TESTNET,
      chainId: '4441',
      controlPlaneRecoveryStatus: 'NOT_REVIEWED',
    })
    assert.throws(
      () => verifyReleaseProfile(RELEASE_PROFILES.PRODUCTION),
      /does not match the selected release profile/i,
    )
    assert.throws(() => verifyReleaseProfile('unreviewed'), /unsupported/i)
  })

  it('keeps production and GitHub-hosted testnet vantage identities disjoint', () => {
    assert.equal(
      verificationProfileForRelease(RELEASE_PROFILES.PRODUCTION),
      VERIFICATION_PROFILES.PRODUCTION,
    )
    assert.equal(
      releaseProfileForVerification(VERIFICATION_PROFILES.PUBLIC_TESTNET),
      RELEASE_PROFILES.PUBLIC_TESTNET,
    )
    assert.deepEqual(vantageIdsForVerification(VERIFICATION_PROFILES.PRODUCTION), [
      'protected-eu-network',
      'protected-us-network',
    ])
    assert.deepEqual(vantageIdsForVerification(VERIFICATION_PROFILES.PUBLIC_TESTNET), [
      'github-hosted-a',
      'github-hosted-b',
    ])
    assert.throws(
      () => assertVantageId(VERIFICATION_PROFILES.PUBLIC_TESTNET, 'protected-eu-network'),
      /not approved/i,
    )
  })

  it('binds promoted provider aliases to the exact release profile and Vercel target', () => {
    assert.deepEqual(
      promotedApiAliasesForReleaseProfile(RELEASE_PROFILES.PRODUCTION, {}),
      ['lester-labs.com', 'www.lester-labs.com'],
    )
    const publicTestnetProject = {
      teamId: PUBLIC_TESTNET_VERCEL_TARGET.teamId,
      projectId: PUBLIC_TESTNET_VERCEL_TARGET.projectId,
      name: PUBLIC_TESTNET_VERCEL_TARGET.projectName,
    }
    assert.deepEqual(
      promotedApiAliasesForReleaseProfile(RELEASE_PROFILES.PUBLIC_TESTNET, publicTestnetProject),
      PUBLIC_TESTNET_VERCEL_TARGET.promotedApiAliases,
    )
    assert.throws(
      () => promotedApiAliasesForReleaseProfile(RELEASE_PROFILES.PUBLIC_TESTNET, {
        ...publicTestnetProject,
        projectId: 'prj_unreviewed',
      }),
      /different Vercel target/i,
    )
  })
})
