import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  canonicalJson,
  sha256Bytes,
  sha256Canonical,
} from '../../scripts/security/frontend-release-common.mjs'
import {
  EMERGENCY_DENIED_ROUTE_PROBES,
  compareEmergencyVantageEvidence,
  observeEmergencyServedParity,
  verifyEmergencyProductionParity,
} from '../../scripts/security/verify-emergency-served-parity.mjs'
import { verifyVercelStagedParity } from '../../scripts/security/verify-vercel-staged-parity.mjs'
import { PUBLIC_TESTNET_VERCEL_TARGET } from '../../scripts/security/release-profiles.mjs'

const repositoryRoot = new URL('../..', import.meta.url).pathname
const sourceDirectory = join(repositoryRoot, 'emergency-site')

function sourceBodies() {
  return new Map([
    ['/', readFileSync(join(sourceDirectory, 'index.html'))],
    ['/index.html', readFileSync(join(sourceDirectory, 'index.html'))],
    ['/robots.txt', readFileSync(join(sourceDirectory, 'robots.txt'))],
    ['/.well-known/security.txt', readFileSync(join(sourceDirectory, '.well-known/security.txt'))],
  ])
}

function securityHeaders() {
  const configuration = JSON.parse(readFileSync(join(sourceDirectory, 'vercel.json'), 'utf8'))
  return Object.fromEntries(configuration.headers[0].headers.map(({ key, value }) => [key, value]))
}

function fixtureFetch({
  changedRoot = false,
  setCookie = false,
  trusted = true,
  liveRetiredRoute,
} = {}) {
  const bodies = sourceBodies()
  const expectedHeaders = securityHeaders()
  return async (url, init) => {
    assert.equal(init.credentials, 'omit')
    assert.equal(init.redirect, 'manual')
    assert.equal('authorization' in init.headers, false)
    assert.equal('cookie' in init.headers, false)
    assert.equal(
      init.headers['x-vercel-trusted-oidc-idp-token'],
      trusted ? 'x'.repeat(80) : undefined,
    )
    if (url.origin === 'https://lester-labs.com') {
      return new Response(null, {
        status: 308,
        headers: { location: `https://www.lester-labs.com${url.pathname}${url.search}` },
      })
    }
    const baseHeaders = {
      ...expectedHeaders,
      ...(setCookie ? { 'Set-Cookie': 'unexpected=1' } : {}),
    }
    if (`${url.pathname}${url.search}` === liveRetiredRoute) {
      return new Response('retired route is unexpectedly live', {
        status: 200,
        headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
    if (bodies.has(url.pathname)) {
      const body = changedRoot && url.pathname === '/' ? Buffer.from('changed') : bodies.get(url.pathname)
      return new Response(body, {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Type': url.pathname.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8',
        },
      })
    }
    return new Response('not found', {
      status: 404,
      headers: { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

function verifiedPromotionFiles(promotionEvidence, {
  subjectSha256 = sha256Bytes(canonicalJson(promotionEvidence)),
  certificateOverrides = {},
} = {}) {
  const sourceCommit = promotionEvidence.sourceCommit
  const signerUri = 'https://github.com/jh005479-sudo/lester-labs/.github/workflows/vercel-production-release.yml@refs/heads/main'
  const bundle = {
    mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
    verificationMaterial: { fixture: 'already verified by gh attestation verify' },
    dsseEnvelope: { fixture: 'bound into the captured gh verification result' },
  }
  const verification = [{
    attestation: {
      bundle,
      bundle_url: '',
      initiator: 'jh005479-sudo',
    },
    verificationResult: {
      mediaType: 'application/vnd.dev.sigstore.verificationresult+json;version=0.1',
      statement: {
        _type: 'https://in-toto.io/Statement/v1',
        subject: [{ name: 'promotion-evidence.json', digest: { sha256: subjectSha256 } }],
        predicateType: 'https://slsa.dev/provenance/v1',
        predicate: {},
      },
      signature: {
        certificate: {
          certificateIssuer: 'CN=sigstore-intermediate,O=sigstore.dev',
          subjectAlternativeName: signerUri,
          issuer: 'https://token.actions.githubusercontent.com',
          buildSignerURI: signerUri,
          buildSignerDigest: sourceCommit,
          runnerEnvironment: 'github-hosted',
          sourceRepositoryURI: 'https://github.com/jh005479-sudo/lester-labs',
          sourceRepositoryDigest: sourceCommit,
          sourceRepositoryRef: 'refs/heads/main',
          buildConfigURI: signerUri,
          buildConfigDigest: sourceCommit,
          ...certificateOverrides,
        },
      },
      verifiedTimestamps: [{
        type: 'Tlog',
        uri: 'https://rekor.sigstore.dev',
        timestamp: '2026-08-11T01:00:30.000Z',
      }],
    },
  }]
  return {
    promotionEvidenceBytes: Buffer.from(canonicalJson(promotionEvidence)),
    promotionProvenanceBytes: Buffer.from(`${JSON.stringify(bundle)}\n`),
    promotionVerificationBytes: Buffer.from(JSON.stringify(verification)),
  }
}

function promotionEvidenceFixture(sourceCommit = 'a'.repeat(40)) {
  const payload = {
    kind: 'lester-labs-vercel-promotion-evidence',
    schemaVersion: 3,
    status: 'CURRENT',
    promotedAt: '2026-08-11T01:00:00.000Z',
    sourceCommit,
    releaseProfile: 'production-separated-authority',
    artifactKind: 'emergency-static',
    manifestSha256: '1'.repeat(64),
    artifactSha256: '2'.repeat(64),
    stageEvidenceSha256: '3'.repeat(64),
    stageProvenanceSha256: '4'.repeat(64),
    promotionApprovalSha256: '5'.repeat(64),
    promotionApprovalProvenanceSha256: '6'.repeat(64),
    parityEvidenceSha256: '7'.repeat(64),
    parityProvenanceSha256: '8'.repeat(64),
    confirmation: 'DIRECT',
    project: {
      teamId: 'team_abcdefgh',
      projectId: 'prj_abcdefgh',
      name: 'lester-labs',
      autoAssignCustomDomains: false,
    },
    deployment: {
      id: 'dpl_abcdefgh',
      url: 'https://reviewed-stage.vercel.app',
      target: 'production',
      readyState: 'READY',
      readySubstate: 'PROMOTED',
      aliasAssigned: true,
      aliases: ['lester-labs.com', 'www.lester-labs.com'],
    },
    priorDeploymentId: 'dpl_rollback1',
    rollbackDisposition: {
      mode: 'HOLD_PROMOTED',
      priorClassification: 'UNSAFE_PRECONTAINMENT',
      targetDeploymentId: null,
      safetyEvidence: null,
    },
  }
  return { ...payload, evidenceSha256: sha256Canonical(payload) }
}

describe('wallet-free emergency served parity', () => {
  it('accepts both exact production origins through the real CLI parser', () => {
    const script = fileURLToPath(new URL(
      '../../scripts/security/verify-emergency-served-parity.mjs',
      import.meta.url,
    ))
    const result = spawnSync(process.execPath, [
      script,
      'production',
      '--origin',
      'https://lester-labs.com',
      '--origin',
      'https://www.lester-labs.com',
      '--output',
      '/tmp/not-written-emergency-parity.json',
      '--promotion-verification',
      '/untrusted-file-handoff.json',
    ], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /requires --promotion-verification -/i)
    assert.doesNotMatch(result.stderr, /duplicate|unknown option/i)
  })

  it('requires exact content, security headers, inactive wallet routes, and profile equivalence', async () => {
    const result = await observeEmergencyServedParity({
      origins: ['https://lester-labs.com', 'https://www.lester-labs.com'],
      sourceDirectory,
      trustedOidcToken: 'x'.repeat(80),
      fetchImpl: fixtureFetch(),
    })
    assert.equal(result.artifactBytesMatch, true)
    assert.equal(result.securityHeadersMatch, true)
    assert.equal(result.profilesEquivalent, true)
    assert.equal(result.originsEquivalent, true)
    assert.equal(result.inactiveWalletRoutes, true)
    assert.equal(result.noCookiesOrLongLivedCredentials, true)
    assert.equal(result.observations.length, 2)
    assert.equal(result.observations[0].profiles.length, 3)
    assert.ok(EMERGENCY_DENIED_ROUTE_PROBES.length >= 60)
    const frontendPolicy = JSON.parse(readFileSync(
      join(repositoryRoot, 'src/config/frontendReleasePolicy.json'),
      'utf8',
    ))
    const reviewedPolicyPaths = new Set([
      ...frontendPolicy.routes,
      ...frontendPolicy.routeSourceCoverage.map(({ probePath }) => probePath),
    ])
    reviewedPolicyPaths.delete('/')
    reviewedPolicyPaths.delete('/.well-known/security.txt')
    assert.deepEqual(
      [...reviewedPolicyPaths].filter((path) => !EMERGENCY_DENIED_ROUTE_PROBES.includes(path)),
      [],
    )
    for (const observation of result.observations) {
      for (const profile of observation.profiles) {
        assert.deepEqual(
          profile.inactivePaths.map(({ path }) => path),
          EMERGENCY_DENIED_ROUTE_PROBES,
        )
      }
    }
  })

  it('fails closed on changed content or cookies', async () => {
    await assert.rejects(
      observeEmergencyServedParity({
        origins: ['https://www.lester-labs.com'],
        sourceDirectory,
        trustedOidcToken: 'x'.repeat(80),
        fetchImpl: fixtureFetch({ changedRoot: true }),
      }),
      /does not byte-match/i,
    )
    await assert.rejects(
      observeEmergencyServedParity({
        origins: ['https://www.lester-labs.com'],
        sourceDirectory,
        trustedOidcToken: 'x'.repeat(80),
        fetchImpl: fixtureFetch({ setCookie: true }),
      }),
      /sets a cookie/i,
    )
    const retiredChildRoute = `/launchpad/0x${'0'.repeat(40)}?tab=recover`
    await assert.rejects(
      observeEmergencyServedParity({
        origins: ['https://www.lester-labs.com'],
        sourceDirectory,
        trustedOidcToken: 'x'.repeat(80),
        fetchImpl: fixtureFetch({ liveRetiredRoute: retiredChildRoute }),
      }),
      /must remain inactive with status 404/i,
    )
  })

  it('binds two production vantages to the exact signed promotion', async () => {
    const sourceCommit = 'a'.repeat(40)
    const promotionEvidence = promotionEvidenceFixture(sourceCommit)
    const verifiedPromotion = verifiedPromotionFiles(promotionEvidence)
    const first = await verifyEmergencyProductionParity({
      ...verifiedPromotion,
      verificationProfile: 'production-independent-network',
      expectedSourceCommit: sourceCommit,
      vantageId: 'protected-eu-network',
      sourceDirectory,
      fetchImpl: fixtureFetch({ trusted: false }),
      checkedAt: '2026-08-11T01:01:00.000Z',
    })
    const second = await verifyEmergencyProductionParity({
      ...verifiedPromotion,
      verificationProfile: 'production-independent-network',
      expectedSourceCommit: sourceCommit,
      vantageId: 'protected-us-network',
      sourceDirectory,
      fetchImpl: fixtureFetch({ trusted: false }),
      checkedAt: '2026-08-11T01:02:00.000Z',
    })
    const comparisonPayload = {
      kind: 'lester-labs-independent-emergency-vantage-comparison',
      schemaVersion: 3,
      verificationProfile: 'production-independent-network',
      leftVantageId: 'protected-eu-network',
      rightVantageId: 'protected-us-network',
      sourceCommit,
      artifactSha256: promotionEvidence.artifactSha256,
      deploymentId: 'dpl_abcdefgh',
      promotionEvidenceSha256: promotionEvidence.evidenceSha256,
      promotionProvenanceSha256: first.promotionProvenanceSha256,
      promotionVerificationBindingSha256: first.promotionVerification.bindingSha256,
      servedReleaseSha256: first.servedReleaseSha256,
      identical: true,
    }
    assert.deepEqual(compareEmergencyVantageEvidence(first, second), {
      ...comparisonPayload,
      evidenceSha256: sha256Canonical(comparisonPayload),
    })
    assert.throws(
      () => compareEmergencyVantageEvidence(first, first),
      /exact verification-profile vantage IDs/i,
    )
    const digestConsistentTamper = (mutate) => {
      const value = structuredClone(first)
      mutate(value)
      delete value.evidenceSha256
      value.evidenceSha256 = sha256Canonical(value)
      return value
    }
    assert.throws(
      () => compareEmergencyVantageEvidence(digestConsistentTamper((value) => {
        value.checkedAt = '2026-08-11 01:01:00Z'
      }), second),
      /canonical UTC timestamp/i,
    )
    assert.throws(
      () => compareEmergencyVantageEvidence(digestConsistentTamper((value) => {
        value.deploymentId = 'not-a-deployment'
      }), second),
      /deployment ID is invalid/i,
    )
    assert.throws(
      () => compareEmergencyVantageEvidence(digestConsistentTamper((value) => {
        value.results.inactiveWalletRoutes = false
      }), second),
      /did not pass every required result/i,
    )
    assert.throws(
      () => compareEmergencyVantageEvidence(digestConsistentTamper((value) => {
        value.observations = []
      }), second),
      /omits exact apex\/www observations/i,
    )
    assert.throws(
      () => compareEmergencyVantageEvidence(digestConsistentTamper((value) => {
        value.checkedAt = '2026-08-11T03:00:00.000Z'
      }), second),
      /30-minute timestamp skew/i,
    )
  })

  it('accepts only the exact public-testnet provider alias metadata while still probing apex and www', async () => {
    const sourceCommit = 'a'.repeat(40)
    const promotionEvidence = promotionEvidenceFixture(sourceCommit)
    promotionEvidence.releaseProfile = 'public-testnet-immutable'
    promotionEvidence.project = {
      teamId: PUBLIC_TESTNET_VERCEL_TARGET.teamId,
      projectId: PUBLIC_TESTNET_VERCEL_TARGET.projectId,
      name: PUBLIC_TESTNET_VERCEL_TARGET.projectName,
      autoAssignCustomDomains: false,
    }
    promotionEvidence.deployment.aliases = [...PUBLIC_TESTNET_VERCEL_TARGET.promotedApiAliases]
    delete promotionEvidence.evidenceSha256
    promotionEvidence.evidenceSha256 = sha256Canonical(promotionEvidence)
    const observed = await verifyEmergencyProductionParity({
      ...verifiedPromotionFiles(promotionEvidence),
      verificationProfile: 'public-testnet-github-hosted',
      expectedSourceCommit: sourceCommit,
      vantageId: 'github-hosted-a',
      sourceDirectory,
      fetchImpl: fixtureFetch({ trusted: false }),
      checkedAt: '2026-08-11T01:01:00.000Z',
    })
    assert.deepEqual(observed.observations.map(({ origin }) => origin), [
      'https://lester-labs.com',
      'https://www.lester-labs.com',
    ])
    const wrongProject = structuredClone(promotionEvidence)
    wrongProject.project.projectId = 'prj_unreviewed'
    delete wrongProject.evidenceSha256
    wrongProject.evidenceSha256 = sha256Canonical(wrongProject)
    await assert.rejects(
      verifyEmergencyProductionParity({
        ...verifiedPromotionFiles(wrongProject),
        verificationProfile: 'public-testnet-github-hosted',
        expectedSourceCommit: sourceCommit,
        vantageId: 'github-hosted-a',
        sourceDirectory,
        fetchImpl: async () => assert.fail('wrong target must fail before probing apex or www'),
        checkedAt: '2026-08-11T01:01:00.000Z',
      }),
      /different Vercel target/i,
    )
  })

  it('rejects arbitrary provenance, mismatched subjects, and unreviewed identities before probing production', async () => {
    const sourceCommit = 'a'.repeat(40)
    const promotionEvidence = promotionEvidenceFixture(sourceCommit)
    const verifiedPromotion = verifiedPromotionFiles(promotionEvidence)
    const common = {
      verificationProfile: 'production-independent-network',
      expectedSourceCommit: sourceCommit,
      vantageId: 'protected-eu-network',
      sourceDirectory,
      fetchImpl: async () => assert.fail('production must not be probed before provenance validation'),
      checkedAt: '2026-08-11T01:01:00.000Z',
    }
    await assert.rejects(
      verifyEmergencyProductionParity({
        ...verifiedPromotion,
        ...common,
        promotionProvenanceBytes: Buffer.from('arbitrary nonempty provenance bytes\n'),
      }),
      /Sigstore JSONL|valid UTF-8 JSONL/i,
    )
    await assert.rejects(
      verifyEmergencyProductionParity({
        ...verifiedPromotion,
        ...common,
        checkedAt: '2026-08-11T00:59:59.999Z',
      }),
      /cannot predate the exact signed promotion/i,
    )
    await assert.rejects(
      verifyEmergencyProductionParity({
        ...verifiedPromotionFiles(promotionEvidence, { subjectSha256: 'f'.repeat(64) }),
        ...common,
      }),
      /subject digest does not match/i,
    )
    await assert.rejects(
      verifyEmergencyProductionParity({
        ...verifiedPromotionFiles(promotionEvidence, {
          certificateOverrides: {
            sourceRepositoryURI: 'https://github.com/attacker/unreviewed',
          },
        }),
        ...common,
      }),
      /source repository is not the reviewed value/i,
    )
    const unsafeRollback = structuredClone(promotionEvidence)
    unsafeRollback.rollbackDisposition = {
      mode: 'ROLLBACK_TO_SAFE_CONTAINMENT',
      priorClassification: 'SAFE_CONTAINMENT',
      targetDeploymentId: unsafeRollback.priorDeploymentId,
      safetyEvidence: {},
    }
    delete unsafeRollback.evidenceSha256
    unsafeRollback.evidenceSha256 = sha256Canonical(unsafeRollback)
    await assert.rejects(
      verifyEmergencyProductionParity({
        ...verifiedPromotionFiles(unsafeRollback),
        ...common,
      }),
      /hold-promoted disposition|must not authorize pre-containment rollback/i,
    )
    const extraAlias = structuredClone(promotionEvidence)
    extraAlias.deployment.aliases.push('attacker.example')
    delete extraAlias.evidenceSha256
    extraAlias.evidenceSha256 = sha256Canonical(extraAlias)
    await assert.rejects(
      verifyEmergencyProductionParity({
        ...verifiedPromotionFiles(extraAlias),
        ...common,
      }),
      /does not bind both current production aliases/i,
    )
  })

  it('emits the strict staged-parity schema bound to an immutable Vercel ID and URL', async () => {
    const review = {
      evidence: [
        { kind: 'emergency-archive-sigstore', sha256: '1'.repeat(64) },
        { kind: 'emergency-inventory-sigstore', sha256: '2'.repeat(64) },
        { kind: 'provider-canary', sha256: '3'.repeat(64) },
        { kind: 'provider-canary-sigstore', sha256: '4'.repeat(64) },
      ],
    }
    const sourceFiles = [{
      path: '.vercel/output/config.json',
      bytes: 1,
      providerSha1: '5'.repeat(40),
      securitySha256: '6'.repeat(64),
    }]
    const stagePayload = {
      kind: 'lester-labs-vercel-stage-evidence',
      schemaVersion: 4,
      status: 'STAGED',
      artifactKind: 'emergency-static',
      stagedAt: '2026-08-11T01:00:00.000Z',
      source: {
        commit: 'a'.repeat(40),
        manifestSha256: '7'.repeat(64),
        releaseProfile: 'production-separated-authority',
        sourceReviewSha256: sha256Canonical(review),
      },
      review,
      artifact: {
        format: 'application/vnd.lester-labs.emergency-containment.tar',
        bytes: 1,
        sha256: '8'.repeat(64),
      },
      sourceUpload: {
        maximumBytes: 128000,
        totalBytes: 1,
        sha256: sha256Canonical(sourceFiles),
        files: sourceFiles,
      },
      providerBoundary: {
        mode: 'build-output-api-v3-static',
        checkedAt: '2026-08-11T00:30:00.000Z',
        canaryEvidenceSha256: '3'.repeat(64),
        canaryProvenanceSha256: '4'.repeat(64),
        canaryWorkflow: {
          repository: 'jh005479-sudo/lester-labs',
          ref: 'refs/heads/main',
          path: '.github/workflows/vercel-provider-canary.yml',
          runId: '123456781',
          runAttempt: 1,
          sourceAttestationRunId: '123456780',
          sourceAttestationRunAttempt: 1,
        },
      },
      project: {
        teamId: 'team_abcdefgh',
        projectId: 'prj_abcdefgh',
        name: 'lester-labs',
        autoAssignCustomDomains: false,
      },
      projectSettings: {
        framework: null,
        buildCommand: '',
        installCommand: '',
        outputDirectory: '.vercel/output',
        rootDirectory: null,
      },
      workflow: {
        repository: 'jh005479-sudo/lester-labs',
        ref: 'refs/heads/main',
        path: '.github/workflows/vercel-production-release.yml',
        runId: '123456789',
        runAttempt: 1,
        sourceAttestationRunId: '123456780',
        sourceAttestationRunAttempt: 1,
        providerCanaryRunId: '123456781',
        providerCanaryRunAttempt: 1,
      },
      deployment: {
        id: 'dpl_abcdefgh',
        url: 'https://reviewed-stage.vercel.app',
        target: 'production',
        readyState: 'READY',
        readySubstate: 'STAGED',
        aliasAssigned: false,
        aliases: [],
      },
      priorDeploymentId: 'dpl_rollback1',
      rollbackDisposition: {
        mode: 'HOLD_PROMOTED',
        priorClassification: 'UNSAFE_PRECONTAINMENT',
        targetDeploymentId: null,
        safetyEvidence: null,
      },
    }
    const stageEvidence = {
      ...stagePayload,
      evidenceSha256: sha256Canonical(stagePayload),
    }
    const result = await verifyVercelStagedParity({
      stageEvidence,
      releaseDirectory: sourceDirectory,
      sourceDirectory,
      policyPath: join(repositoryRoot, 'src/config/frontendReleasePolicy.json'),
      expectedSourceCommit: 'a'.repeat(40),
      trustedOidcToken: 'x'.repeat(80),
      fetchImpl: fixtureFetch(),
      checkedAt: '2026-08-11T01:01:00.000Z',
    })
    assert.equal(result.kind, 'lester-labs-vercel-staged-parity')
    assert.equal(result.stageEvidenceSha256, stageEvidence.evidenceSha256)
    assert.equal(result.deploymentId, 'dpl_abcdefgh')
    assert.deepEqual(result.profiles.map(({ id }) => id), [
      'chromium-desktop',
      'firefox-desktop',
      'metamask-mobile',
    ])
    assert.deepEqual(Object.values(result.results), [true, true, true, true, true, true])
  })
})
