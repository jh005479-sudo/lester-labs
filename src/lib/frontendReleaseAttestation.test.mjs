import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'

import {
  compareFrontendArtifactInventories,
  approveFrontendReleaseCandidate,
  createFrontendApprovalEnvelope,
  createFrontendArtifactInventory,
  createFrontendReleaseAttestation,
  packageFrontendDeployment,
  REVIEWED_FRONTEND_BUILDER_IMAGE,
  validateFrontendReleaseAttestation,
} from '../../scripts/security/frontend-release-attestation.mjs'
import {
  canonicalJson,
  fetchBounded,
  observeResponseBody,
  sha256Bytes,
  sha256Canonical,
  validateFrontendReleasePolicy,
  validateRouteSourceCoverageAgainstSources,
} from '../../scripts/security/frontend-release-common.mjs'
import {
  HTTP_USER_AGENT_PROFILES,
  compareFrontendVantageEvidence,
  verifyFrontendReleaseParity,
} from '../../scripts/security/verify-frontend-release-parity.mjs'

const ROUTE_BODY = '<!doctype html><script src=/_next/static/chunks/app.js></script><img src=/robots.txt><a href="https://x.com/lesterlabshq">X</a>'
const CHUNK_BODY = 'globalThis.__reviewedChunk=true;\n'

function writeFixtureFile(root, relativePath, contents) {
  const path = join(root, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents)
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'lester-frontend-release-'))
  const policyContents = readFileSync(
    new URL('../config/frontendReleasePolicy.json', import.meta.url),
    'utf8',
  )
  const reviewedOriginNoiseContents = readFileSync(
    new URL('../config/reviewedEmbeddedOriginNoise.json', import.meta.url),
    'utf8',
  )
  const policyValue = JSON.parse(policyContents)
  for (const [path, contents] of [
    ['package.json', '{"name":"fixture","packageManager":"npm@11.16.0"}\n'],
    ['package-lock.json', '{"name":"fixture","lockfileVersion":3,"packages":{}}\n'],
    ['next.config.ts', 'export default {}\n'],
    ['vercel.json', '{"framework":"nextjs"}\n'],
    ['src/config/frontendReleasePolicy.json', policyContents],
    ['src/config/reviewedEmbeddedOriginNoise.json', reviewedOriginNoiseContents],
    ['.next/static/chunks/app.js', CHUNK_BODY],
    ['.next/server/app/page.js', 'export default 1\n'],
    ['.next/standalone/server.js', 'export default 1\n'],
    ['.next/standalone/package.json', '{"name":"fixture-runtime"}\n'],
    ['.next/cache/nondeterministic.bin', 'ignored-cache'],
    ['.next/diagnostics/build-diagnostics.json', '{"ignored":true}'],
    ['.next/trace', 'ignored-trace'],
    ['.next/types/routes.d.ts', 'ignored-types'],
    ['public/robots.txt', 'User-agent: *\n'],
    ['public/.well-known/security.txt', ROUTE_BODY],
    ['application.cdx.json', '{"bomFormat":"CycloneDX","specVersion":"1.6"}\n'],
    ['.gitignore', '.next/\napplication.cdx.json\nfrontend-standalone.tar\ndeployment-payload.inventory.json\n'],
  ]) writeFixtureFile(root, path, contents)
  for (const { sourcePath } of policyValue.routeSourceCoverage) {
    writeFixtureFile(root, sourcePath, `export default ${JSON.stringify(sourcePath)}\n`)
  }
  for (const sourcePath of policyValue.reviewedSharedExecutionSources) {
    writeFixtureFile(root, sourcePath, `export default ${JSON.stringify(sourcePath)}\n`)
  }
  execFileSync('git', ['init', '--quiet'], { cwd: root })
  execFileSync('git', ['add', '.'], { cwd: root })
  execFileSync(
    'git',
    ['-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@invalid.example', 'commit', '--quiet', '-m', 'fixture'],
    {
      cwd: root,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: '2026-08-10T00:00:00Z',
        GIT_COMMITTER_DATE: '2026-08-10T00:00:00Z',
      },
    },
  )
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  writeFixtureFile(root, '.next/BUILD_ID', `${sourceCommit}\n`)
  writeFixtureFile(root, '.next/standalone/.next/BUILD_ID', `${sourceCommit}\n`)
  const deploymentPayloadFiles = [{ path: 'server.js', bytes: 17, sha256: 'a'.repeat(64) }]
  writeFixtureFile(root, 'deployment-payload.inventory.json', canonicalJson({
    sha256: sha256Canonical(deploymentPayloadFiles),
    fileCount: deploymentPayloadFiles.length,
    totalBytes: deploymentPayloadFiles.reduce((total, file) => total + file.bytes, 0),
    files: deploymentPayloadFiles,
  }))
  writeFixtureFile(root, 'frontend-standalone.tar', 'reviewed deployment archive\n')
  return {
    root,
    buildDirectory: join(root, '.next'),
    publicDirectory: join(root, 'public'),
    policyPath: join(root, 'src/config/frontendReleasePolicy.json'),
    sbomPath: join(root, 'application.cdx.json'),
    deploymentArtifactPath: join(root, 'frontend-standalone.tar'),
    deploymentInventoryPath: join(root, 'deployment-payload.inventory.json'),
    builderImage: REVIEWED_FRONTEND_BUILDER_IMAGE,
    releaseProfile: 'production-separated-authority',
    sourceCommit,
  }
}

function routeResponse(policy, body = ROUTE_BODY) {
  return new Response(body, {
    status: 200,
    headers: {
      ...policy.criticalResponseHeaders,
      'content-type': 'text/html; charset=utf-8',
    },
  })
}

function jsonResponse(policy, value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      ...policy.criticalResponseHeaders,
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

function platformStatsFixture() {
  const metrics = ['tokensMinted', 'walletsAirdropped', 'presalesCreated', 'swapsCompleted', 'onChainMessages']
  const value = {
    tokensMinted: 1,
    walletsAirdropped: 2,
    presalesCreated: 3,
    swapsCompleted: 4,
    onChainMessages: 5,
    fetchedAt: '2026-08-10T00:00:00.000Z',
    baseline: {},
    breakdown: {},
    coverage: {},
  }
  for (const metric of metrics) {
    value.breakdown[metric] = { baseline: value[metric], postCutover: 0, total: value[metric] }
    value.coverage[metric] = { status: 'historical-baseline', note: 'Reviewed fixture.' }
  }
  return value
}

function approve(candidate, fixture) {
  candidate.runtime = { node: 'v24.18.0', npm: '11.16.0', os: 'linux', arch: 'x64' }
  const candidateBase = { ...candidate }
  delete candidateBase.status
  delete candidateBase.reviewPayloadSha256
  delete candidateBase.approvalEnvelopes
  candidate.reviewPayloadSha256 = sha256Canonical(candidateBase)
  const candidatePath = join(fixture.root, 'frontend-release-candidate.json')
  const candidateProvenancePath = join(fixture.root, 'github-sigstore-provenance.jsonl')
  writeFileSync(candidatePath, canonicalJson(candidate))
  writeFileSync(candidateProvenancePath, 'candidate provenance\n')
  const approvals = [
    ['source-security', 'frontend-release-source-security', 'source'],
    ['release-operations', 'frontend-release-operations', 'operations'],
  ].map(([reviewRole, protectedEnvironment, marker], index) => {
    const envelope = createFrontendApprovalEnvelope({
      candidate,
      candidateProvenancePath,
      reviewRole,
      protectedEnvironment,
      repository: 'jh005479-sudo/lester-labs',
      ref: 'refs/heads/main',
      workflowPath: '.github/workflows/frontend-release-attestation.yml',
      workflowRunId: '123456',
      workflowRunAttempt: 1,
      requestedBy: '@release-requester',
      createdAt: `2026-08-10T20:0${index}:00.000Z`,
    })
    const envelopePath = join(fixture.root, `${reviewRole}-approval.json`)
    const provenancePath = join(fixture.root, `${reviewRole}-approval.provenance.jsonl`)
    writeFileSync(envelopePath, canonicalJson(envelope))
    writeFileSync(provenancePath, `${marker} approval provenance\n`)
    return { envelopePath, provenancePath }
  })
  const approved = approveFrontendReleaseCandidate({ candidate, approvals })
  writeFileSync(join(fixture.root, 'approved-manifest.provenance.jsonl'), 'approved provenance\n')
  return approved
}

function frontendPromotionFixture(approved, promotedAt = '2026-08-10T20:04:00.000Z') {
  const payload = {
    kind: 'lester-labs-vercel-promotion-evidence',
    schemaVersion: 3,
    status: 'CURRENT',
    promotedAt,
    sourceCommit: approved.sourceCommit,
    releaseProfile: approved.releaseProfile,
    artifactKind: 'next-standalone-container',
    manifestSha256: sha256Bytes(canonicalJson(approved)),
    artifactSha256: approved.deploymentArtifact.archiveSha256,
    stageEvidenceSha256: '1'.repeat(64),
    stageProvenanceSha256: '2'.repeat(64),
    promotionApprovalSha256: '3'.repeat(64),
    promotionApprovalProvenanceSha256: '4'.repeat(64),
    parityEvidenceSha256: '5'.repeat(64),
    parityProvenanceSha256: '6'.repeat(64),
    confirmation: 'DIRECT',
    project: {
      teamId: 'team_abcdefgh',
      projectId: 'prj_abcdefgh',
      name: 'lester-labs',
      autoAssignCustomDomains: false,
    },
    deployment: {
      id: 'dpl_frontend1',
      url: 'https://reviewed-frontend.vercel.app',
      target: 'production',
      readyState: 'READY',
      readySubstate: 'PROMOTED',
      aliasAssigned: true,
      aliases: ['lester-labs.com', 'www.lester-labs.com'],
    },
    priorDeploymentId: 'dpl_contain1',
    rollbackDisposition: {
      mode: 'ROLLBACK_TO_SAFE_CONTAINMENT',
      priorClassification: 'SAFE_CONTAINMENT',
      targetDeploymentId: 'dpl_contain1',
      safetyEvidence: {
        promotionEvidenceSha256: '7'.repeat(64),
        promotionProvenanceSha256: '8'.repeat(64),
        servedParityEvidenceSha256: '9'.repeat(64),
        servedParityProvenanceSha256: 'a'.repeat(64),
        sourceCommit: 'b'.repeat(40),
        artifactSha256: 'c'.repeat(64),
        servedReleaseSha256: 'd'.repeat(64),
      },
    },
  }
  return { ...payload, evidenceSha256: sha256Canonical(payload) }
}

function verifiedFrontendPromotionFiles(promotionEvidence, {
  subjectSha256 = sha256Bytes(canonicalJson(promotionEvidence)),
  certificateOverrides = {},
} = {}) {
  const sourceCommit = promotionEvidence.sourceCommit
  const signerUri = 'https://github.com/jh005479-sudo/lester-labs/.github/workflows/vercel-production-release.yml@refs/heads/main'
  const bundle = {
    mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
    verificationMaterial: { fixture: 'already verified by gh attestation verify' },
    dsseEnvelope: { fixture: 'bound into captured gh verification result' },
  }
  const verification = [{
    attestation: { bundle, bundle_url: '', initiator: 'jh005479-sudo' },
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
        timestamp: '2026-08-10T20:04:30.000Z',
      }],
    },
  }]
  return {
    promotionEvidenceBytes: Buffer.from(canonicalJson(promotionEvidence)),
    promotionProvenanceBytes: Buffer.from(`${JSON.stringify(bundle)}\n`),
    promotionVerificationBytes: Buffer.from(JSON.stringify(verification)),
  }
}

function recomputeFrontendVantage(value) {
  for (const origin of value.origins) {
    for (const profile of origin.profiles) {
      const profilePayload = {
        routes: profile.routes.map(({
          path,
          bodySha256,
          bytes,
          securityHeaders,
          thirdPartyOrigins,
          activeResourceOrigins,
          referencedActiveResourcePaths,
        }) => ({
          path,
          bodySha256,
          bytes,
          securityHeaders,
          thirdPartyOrigins,
          activeResourceOrigins,
          referencedActiveResourcePaths,
        })),
        assets: {
          sha256: profile.assets.sha256,
          fileCount: profile.assets.fileCount,
          totalBytes: profile.assets.totalBytes,
        },
        liveJsonSchemas: profile.liveJsonRoutes.map(({
          path,
          securityHeaders,
          schema,
          schemaSha256,
        }) => ({ path, securityHeaders, schema, schemaSha256 })),
      }
      profile.servedProfileSha256 = sha256Canonical(profilePayload)
    }
  }
  value.observationSha256 = sha256Canonical(value.origins.map(({ origin, profiles }) => ({
    origin,
    profiles: profiles.map(({ profile, servedProfileSha256 }) => ({ profile, servedProfileSha256 })),
  })))
  value.servedReleaseSha256 = sha256Canonical({
    verificationProfile: value.verificationProfile,
    releaseProfile: value.releaseProfile,
    sourceCommit: value.sourceCommit,
    manifestSha256: value.manifestSha256,
    deploymentId: value.deploymentId,
    promotionEvidenceSha256: value.promotionEvidenceSha256,
    promotionProvenanceSha256: value.promotionProvenanceSha256,
    promotionVerificationBindingSha256: value.promotionVerification.bindingSha256,
    reviewPayloadSha256: value.reviewPayloadSha256,
    policySha256: value.policySha256,
    publicArtifactsSha256: value.publicArtifactsSha256,
    observationSha256: value.observationSha256,
  })
  delete value.evidenceSha256
  value.evidenceSha256 = sha256Canonical(value)
  return value
}

describe('frontend release artifact attestation', () => {
  it('creates identical inventories for identical builds and excludes build-only ephemera', () => {
    const first = makeFixture()
    const second = makeFixture()
    try {
      const left = createFrontendArtifactInventory(first)
      const right = createFrontendArtifactInventory(second)
      assert.deepEqual(compareFrontendArtifactInventories(left, right), {
        reproducible: true,
        sourceCommit: first.sourceCommit,
        artifactInventorySha256: left.artifactInventory.sha256,
        publicArtifactsSha256: left.publicArtifacts.sha256,
        fileCount: left.artifactInventory.fileCount,
      })
      assert.equal(left.artifactInventory.files.some(({ path }) => path.includes('/cache/')), false)
      assert.equal(left.artifactInventory.files.some(({ path }) => path === 'build/trace'), false)
      assert.deepEqual(
        left.sourceTree.files.map(({ path }) => path),
        execFileSync('git', ['ls-files'], { cwd: first.root, encoding: 'utf8' }).trim().split('\n').sort(),
      )
      assert.deepEqual(
        left.publicArtifacts.files.map(({ urlPath }) => urlPath),
        ['/.well-known/security.txt', '/_next/static/chunks/app.js', '/robots.txt'],
      )
      const deployableDirectory = join(first.root, 'deployable-fixture')
      const deployable = packageFrontendDeployment(
        first.buildDirectory,
        first.publicDirectory,
        deployableDirectory,
      )
      assert.ok(deployable.files.some(({ path }) => path === 'server.js'))
      assert.ok(deployable.files.some(({ path }) => path === '.next/static/chunks/app.js'))
      assert.ok(deployable.files.some(({ path }) => path === 'public/robots.txt'))

      writeFixtureFile(second.root, '.next/server/app/page.js', 'export default 2\n')
      const changed = createFrontendArtifactInventory(second)
      assert.throws(
        () => compareFrontendArtifactInventories(left, changed),
        /repeated frontend builds differ.*server\/app\/page\.js/i,
      )

      const omittedMaterial = structuredClone(left)
      omittedMaterial.sourceMaterials.shift()
      assert.throws(
        () => compareFrontendArtifactInventories(omittedMaterial, right),
        /exactly the reviewed release-control paths/i,
      )
    } finally {
      rmSync(first.root, { recursive: true, force: true })
      rmSync(second.root, { recursive: true, force: true })
    }
  })

  it('binds the claimed source commit to a clean Git HEAD and every tracked file', () => {
    const fixture = makeFixture()
    try {
      writeFixtureFile(fixture.root, 'next.config.ts', 'export default { unreviewed: true }\n')
      assert.throws(
        () => createFrontendArtifactInventory(fixture),
        /requires a clean tracked and untracked Git checkout/i,
      )
      execFileSync('git', ['checkout', '--', 'next.config.ts'], { cwd: fixture.root })
      const wrongCommit = 'b'.repeat(40)
      writeFixtureFile(fixture.root, '.next/BUILD_ID', `${wrongCommit}\n`)
      assert.throws(
        () => createFrontendArtifactInventory({ ...fixture, sourceCommit: wrongCommit }),
        /does not match clean Git HEAD/i,
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('accepts reviewed origin noise only at the exact path and byte hash', () => {
    const fixture = makeFixture()
    try {
      const reviewedPath = 'build/server/reviewed-origin-noise.js'
      const reviewedContents = 'const documentation = "https://docs.example.invalid"\n'
      writeFixtureFile(fixture.root, '.next/server/reviewed-origin-noise.js', reviewedContents)
      const reviewPath = join(fixture.root, 'src/config/reviewedEmbeddedOriginNoise.json')
      const review = JSON.parse(readFileSync(reviewPath, 'utf8'))
      review.observations.push({
        path: reviewedPath,
        sha256: sha256Bytes(reviewedContents),
        origins: ['https://docs.example.invalid'],
      })
      review.observations.sort((left, right) => left.path.localeCompare(right.path))
      writeFixtureFile(fixture.root, 'src/config/reviewedEmbeddedOriginNoise.json', canonicalJson(review))
      execFileSync('git', ['add', 'src/config/reviewedEmbeddedOriginNoise.json'], { cwd: fixture.root })
      execFileSync(
        'git',
        ['-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@invalid.example', 'commit', '--quiet', '-m', 'review exact origin noise'],
        {
          cwd: fixture.root,
          env: {
            ...process.env,
            GIT_AUTHOR_DATE: '2026-08-10T00:02:00Z',
            GIT_COMMITTER_DATE: '2026-08-10T00:02:00Z',
          },
        },
      )
      fixture.sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture.root, encoding: 'utf8' }).trim()
      writeFixtureFile(fixture.root, '.next/BUILD_ID', `${fixture.sourceCommit}\n`)
      writeFixtureFile(fixture.root, '.next/standalone/.next/BUILD_ID', `${fixture.sourceCommit}\n`)
      const inventory = createFrontendArtifactInventory(fixture)
      assert.ok(inventory.artifactEmbeddedOrigins.includes('https://docs.example.invalid'))

      writeFixtureFile(fixture.root, '.next/server/reviewed-origin-noise.js', `${reviewedContents}// changed bytes\n`)
      assert.throws(
        () => createFrontendArtifactInventory(fixture),
        /docs\.example\.invalid.*reviewed-origin-noise\.js.*sha256/i,
      )
      writeFixtureFile(fixture.root, '.next/server/reviewed-origin-noise.js', reviewedContents)
      writeFixtureFile(fixture.root, '.next/server/moved-origin-noise.js', reviewedContents)
      assert.throws(
        () => createFrontendArtifactInventory(fixture),
        /docs\.example\.invalid.*moved-origin-noise\.js.*sha256/i,
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects unreviewed Next server actions from the attested source tree', () => {
    const fixture = makeFixture()
    try {
      const directive = ["\uFEFF   'use", " server'\nexport async function mutate() {}\n"].join('')
      writeFixtureFile(fixture.root, 'src/actions.ts', directive)
      execFileSync('git', ['add', 'src/actions.ts'], { cwd: fixture.root })
      execFileSync(
        'git',
        ['-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@invalid.example', 'commit', '--quiet', '-m', 'server action'],
        {
          cwd: fixture.root,
          env: {
            ...process.env,
            GIT_AUTHOR_DATE: '2026-08-10T00:01:00Z',
            GIT_COMMITTER_DATE: '2026-08-10T00:01:00Z',
          },
        },
      )
      fixture.sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture.root, encoding: 'utf8' }).trim()
      writeFixtureFile(fixture.root, '.next/BUILD_ID', `${fixture.sourceCommit}\n`)
      writeFixtureFile(fixture.root, '.next/standalone/.next/BUILD_ID', `${fixture.sourceCommit}\n`)
      assert.throws(
        () => createFrontendArtifactInventory(fixture),
        /unsupported Next server actions.*src\/actions\.ts/i,
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects symlinks and a build ID that is not the reviewed source commit', () => {
    const fixture = makeFixture()
    try {
      writeFixtureFile(fixture.root, 'outside.txt', 'not part of build')
      symlinkSync(join(fixture.root, 'outside.txt'), join(fixture.buildDirectory, 'static/chunks/link.js'))
      assert.throws(
        () => createFrontendArtifactInventory(fixture),
        /refuses symbolic link/i,
      )
      rmSync(join(fixture.buildDirectory, 'static/chunks/link.js'))
      writeFixtureFile(fixture.root, '.next/BUILD_ID', `${'b'.repeat(40)}\n`)
      assert.throws(
        () => createFrontendArtifactInventory(fixture),
        /expected source commit/i,
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('binds local route bodies, security headers, third-party origins, chunks, and the SBOM', async () => {
    const fixture = makeFixture()
    try {
      const policy = validateFrontendReleasePolicy(JSON.parse(readFileSync(fixture.policyPath, 'utf8')))
      assert.throws(
        () => validateRouteSourceCoverageAgainstSources(policy, [
          ...policy.routeSourceCoverage.map(({ sourcePath }) => sourcePath),
          ...policy.reviewedSharedExecutionSources,
          'src/app/unreviewed/page.tsx',
        ]),
        /unreviewed.*src\/app\/unreviewed\/page\.tsx/i,
      )
      assert.throws(
        () => validateRouteSourceCoverageAgainstSources(policy, [
          ...policy.routeSourceCoverage.map(({ sourcePath }) => sourcePath),
          ...policy.reviewedSharedExecutionSources,
          'src/proxy.ts',
        ]),
        /unsupported Next execution surfaces.*src\/proxy\.ts/i,
      )
      const candidate = await createFrontendReleaseAttestation({
        ...fixture,
        localOrigin: 'http://127.0.0.1:3100',
        fetchImpl: async () => routeResponse(policy),
      })
      assert.equal(candidate.status, 'CANDIDATE')
      assert.equal(candidate.runtime.npm, '11.16.0')
      assert.equal(candidate.routeSnapshots.length, policy.routes.length)
      assert.deepEqual(candidate.routeSnapshots[0].thirdPartyOrigins, [
        'https://liteforge.explorer.caldera.xyz',
        'https://liteforge.rpc.caldera.xyz',
        'https://raw.githubusercontent.com',
        'https://x.com',
        'wss://liteforge.rpc.caldera.xyz',
      ])
      assert.deepEqual(candidate.routeSnapshots[0].referencedActiveResourcePaths, [
        '/_next/static/chunks/app.js',
        '/robots.txt',
      ])
      const altered = structuredClone(candidate)
      altered.sbom.sha256 = 'b'.repeat(64)
      assert.throws(
        () => validateFrontendReleaseAttestation(altered),
        /review payload digest/i,
      )
      const insufficientApproval = approve(candidate, fixture)
      insufficientApproval.approvalEnvelopes.pop()
      assert.throws(
        () => validateFrontendReleaseAttestation(insufficientApproval, { requireApproved: true }),
        /exactly two protected approval envelopes/i,
      )
      const duplicateReviewer = approve(candidate, fixture)
      duplicateReviewer.approvalEnvelopes[1] = structuredClone(duplicateReviewer.approvalEnvelopes[0])
      assert.throws(
        () => validateFrontendReleaseAttestation(duplicateReviewer, { requireApproved: true }),
        /distinct role-specific protected evidence/i,
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})

describe('credential-free served frontend parity', () => {
  it('validates dispatch inputs on GitHub-hosted infrastructure before self-hosted work', () => {
    const workflow = readFileSync(
      new URL('../../.github/workflows/frontend-served-parity.yml', import.meta.url),
      'utf8',
    )
    assert.match(workflow, /validate-inputs:\n[\s\S]*?runs-on: ubuntu-24\.04/)
    assert.match(workflow, /vantage-eu:\n[\s\S]*?needs: validate-inputs/)
    assert.match(workflow, /vantage-us:\n[\s\S]*?needs: validate-inputs/)
    assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*inputs\./)
    assert.doesNotMatch(workflow, /run-id:\s*\$\{\{\s*inputs\./)
    assert.doesNotMatch(workflow, /frontend-(?:release|parity)[^\n]*\$\{\{\s*inputs\./)
    assert.match(workflow, /ref:\s*\$\{\{\s*needs\.validate-inputs\.outputs\.reviewed_commit\s*\}\}/)
  })

  it('decodes browser URL entities and rejects alternate active-resource execution surfaces', () => {
    const policy = validateFrontendReleasePolicy(JSON.parse(readFileSync(
      new URL('../config/frontendReleasePolicy.json', import.meta.url),
      'utf8',
    )))
    const headers = Object.fromEntries(
      Object.entries(policy.criticalResponseHeaders).map(([name, value]) => [name.toLowerCase(), value]),
    )
    const observation = observeResponseBody(
      '<script src="&#47;_next&#47;static&#47;chunks&#47;app.js"></script>' +
        '<track src="/captions.vtt"><object data="/reviewed.bin"></object>' +
        '<svg><image href="/logo.png"/></svg>',
      'https://www.lester-labs.com/',
      headers,
      policy,
    )
    assert.deepEqual(observation.referencedActiveResourcePaths, [
      '/_next/static/chunks/app.js',
      '/captions.vtt',
      '/logo.png',
      '/reviewed.bin',
    ])
    const ordinaryInlineStyles = observeResponseBody(
      '<div style="background-image:url(&#47;reviewed-background.png)"></div>' +
        '<span/style="mask-image:url(/reviewed-mask.svg)"></span>',
      'https://www.lester-labs.com/',
      headers,
      policy,
    )
    assert.deepEqual(ordinaryInlineStyles.referencedActiveResourcePaths, [
      '/reviewed-background.png',
      '/reviewed-mask.svg',
    ])
    const externalInlineStyle = observeResponseBody(
      '<section style="background:url(//attacker.invalid/tracker.png)"></section>',
      'https://www.lester-labs.com/',
      headers,
      policy,
    )
    assert.deepEqual(externalInlineStyle.activeResourceOrigins, ['https://attacker.invalid'])
    for (const dangerous of [
      '<base href="https://attacker.invalid/"><script src="/ok.js"></script>',
      '<iframe srcdoc="<script src=/evil.js></script>"></iframe>',
      '<iframe/srcdoc="<script src=/evil.js></script>"></iframe>',
      '<meta http-equiv="refresh" content="0;url=/evil"><script src="/ok.js"></script>',
      '<meta/http-equiv="refresh" content="0;url=/evil"><script src="/ok.js"></script>',
      '<script src="/ok.js?variant=evil"></script>',
      '<div style="background:url(/ok.png?variant=evil)"></div>',
    ]) {
      assert.throws(
        () => observeResponseBody(dangerous, 'https://www.lester-labs.com/', headers, policy),
        /base element|srcdoc|meta refresh|active-resource URL/i,
      )
    }
    const slashSeparated = observeResponseBody(
      '<script/src="/evil.js"></script>',
      'https://www.lester-labs.com/',
      headers,
      policy,
    )
    assert.deepEqual(slashSeparated.referencedActiveResourcePaths, ['/evil.js'])
  })

  it('rejects malformed lengths and cancels chunked bodies at the reviewed byte cap', async () => {
    const allowedOrigins = new Set(['https://www.lester-labs.com'])
    for (const declaredLength of ['-1', 'NaN', '1.5', '1, 2']) {
      await assert.rejects(
        fetchBounded('https://www.lester-labs.com/', {
          allowedOrigins,
          maximumResponseBytes: 1024,
          attempts: 1,
          fetchImpl: async () => new Response('reviewed', {
            headers: { 'content-length': declaredLength },
          }),
        }),
        /malformed Content-Length/i,
      )
    }
    let canceled = false
    let pulls = 0
    const body = new ReadableStream({
      pull(controller) {
        pulls += 1
        controller.enqueue(new Uint8Array(800))
        if (pulls >= 3) controller.close()
      },
      cancel() { canceled = true },
    })
    await assert.rejects(
      fetchBounded('https://www.lester-labs.com/', {
        allowedOrigins,
        maximumResponseBytes: 1024,
        attempts: 1,
        fetchImpl: async () => new Response(body),
      }),
      /above the reviewed limit/i,
    )
    assert.equal(canceled, true)
    assert.ok(pulls <= 3)
  })

  it('refuses the checked-in NOT_APPROVED sentinel before attempting a network request', async () => {
    const fixture = makeFixture()
    let requests = 0
    try {
      const sentinelPath = join(fixture.root, 'sentinel.json')
      writeFileSync(sentinelPath, '{"status":"NOT_APPROVED"}\n')
      await assert.rejects(
        verifyFrontendReleaseParity({
          manifestPath: sentinelPath,
          policyPath: fixture.policyPath,
          fetchImpl: async () => { requests += 1; throw new Error('must not run') },
          checkedAt: '2026-08-10T00:00:00.000Z',
          vantageId: 'protected-eu-network',
          verificationProfile: 'production-independent-network',
        }),
        /fail-closed/i,
      )
      assert.equal(requests, 0)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('proves approved apex/www route and public-asset bytes without cookies or authorization', async () => {
    const fixture = makeFixture()
    try {
      const policy = validateFrontendReleasePolicy(JSON.parse(readFileSync(fixture.policyPath, 'utf8')))
      const candidate = await createFrontendReleaseAttestation({
        ...fixture,
        localOrigin: 'http://127.0.0.1:3100',
        fetchImpl: async () => routeResponse(policy),
      })
      const approved = approve(candidate, fixture)
      const manifestPath = join(fixture.root, 'approved.json')
      writeFileSync(manifestPath, canonicalJson(approved))
      const promotionEvidence = frontendPromotionFixture(approved)
      const verifiedPromotion = verifiedFrontendPromotionFiles(promotionEvidence)
      const requested = []
      const fetchImpl = async (url, init) => {
        requested.push({ url: url.href, init })
        assert.equal(init.credentials, 'omit')
        assert.equal('authorization' in init.headers, false)
        assert.equal('cookie' in init.headers, false)
        if (url.origin === 'https://lester-labs.com') {
          return new Response(null, {
            status: 308,
            headers: { location: `https://www.lester-labs.com${url.pathname}${url.search}` },
          })
        }
        if (url.pathname === '/api/platform-stats') return jsonResponse(policy, platformStatsFixture())
        if (url.pathname === '/api/explorer/summary') {
          return jsonResponse(policy, { latestBlock: 1, blocks: [], transactions: [], updatedAt: null })
        }
        if (policy.routes.includes(url.pathname)) return routeResponse(policy)
        if (url.pathname === '/_next/static/chunks/app.js') return new Response(CHUNK_BODY)
        if (url.pathname === '/robots.txt') return new Response('User-agent: *\n')
        throw new Error(`Unexpected fixture request ${url.href}`)
      }
      const result = await verifyFrontendReleaseParity({
        manifestPath,
        policyPath: fixture.policyPath,
        fetchImpl,
        approvalEvidenceDirectory: fixture.root,
        verifyProvenance: () => [{ verified: true }],
        checkedAt: '2026-08-10T20:05:00.000Z',
        vantageId: 'protected-eu-network',
        verificationProfile: 'production-independent-network',
        ...verifiedPromotion,
      })
      assert.equal(result.apexAndWwwByteEquivalent, true)
      assert.equal(result.origins.length, 2)
      assert.equal(result.origins[0].profiles.length, HTTP_USER_AGENT_PROFILES.length)
      assert.equal(
        result.origins[0].profiles[0].assets.sha256,
        result.origins[1].profiles[0].assets.sha256,
      )
      assert.deepEqual(
        [...new Set(requested.map(({ init }) => init.headers['user-agent']))].sort(),
        HTTP_USER_AGENT_PROFILES.map(({ userAgent }) => userAgent).sort(),
      )
      assert.deepEqual(result.capturedThirdPartyOrigins, [
        'https://liteforge.explorer.caldera.xyz',
        'https://liteforge.rpc.caldera.xyz',
        'https://raw.githubusercontent.com',
        'https://x.com',
        'wss://liteforge.rpc.caldera.xyz',
      ])
      assert.ok(requested.length > 0)

      const stagedRequests = []
      const stagedResult = await verifyFrontendReleaseParity({
        manifestPath,
        policyPath: fixture.policyPath,
        fetchImpl: async (url) => {
          stagedRequests.push(url.href)
          assert.equal(url.origin, 'https://reviewed-stage.vercel.app')
          if (url.pathname === '/api/platform-stats') return jsonResponse(policy, platformStatsFixture())
          if (url.pathname === '/api/explorer/summary') {
            return jsonResponse(policy, { latestBlock: 1, blocks: [], transactions: [], updatedAt: null })
          }
          if (policy.routes.includes(url.pathname)) return routeResponse(policy)
          if (url.pathname === '/_next/static/chunks/app.js') return new Response(CHUNK_BODY)
          if (url.pathname === '/robots.txt') return new Response('User-agent: *\n')
          throw new Error(`Unexpected staged fixture request ${url.href}`)
        },
        approvalEvidenceDirectory: fixture.root,
        verifyProvenance: () => [{ verified: true }],
        checkedAt: '2026-08-10T00:00:00.000Z',
        vantageId: 'staged-network',
        enforceProductionOrigins: false,
        requestOrigins: ['https://reviewed-stage.vercel.app'],
      })
      assert.equal(stagedResult.apexAndWwwByteEquivalent, false)
      assert.deepEqual(stagedResult.origins.map(({ origin }) => origin), [
        'https://reviewed-stage.vercel.app',
      ])
      assert.ok(stagedRequests.length > 0)
      await assert.rejects(
        verifyFrontendReleaseParity({
          manifestPath,
          policyPath: fixture.policyPath,
          fetchImpl: async () => { throw new Error('must not run') },
          approvalEvidenceDirectory: fixture.root,
          verifyProvenance: () => [{ verified: true }],
          checkedAt: '2026-08-10T00:00:00.000Z',
          vantageId: 'protected-eu-network',
          verificationProfile: 'production-independent-network',
          requestOrigins: ['https://reviewed-stage.vercel.app'],
        }),
        /non-production probe origins/i,
      )

      const secondVantage = structuredClone(result)
      secondVantage.vantageId = 'protected-us-network'
      secondVantage.checkedAt = '2026-08-10T20:06:00.000Z'
      delete secondVantage.evidenceSha256
      secondVantage.evidenceSha256 = sha256Canonical(secondVantage)
      const comparisonPayload = {
        kind: 'lester-labs-independent-vantage-comparison',
        schemaVersion: 3,
        verificationProfile: 'production-independent-network',
        releaseProfile: 'production-separated-authority',
        sourceCommit: result.sourceCommit,
        manifestSha256: result.manifestSha256,
        leftVantageId: 'protected-eu-network',
        rightVantageId: 'protected-us-network',
        servedReleaseSha256: result.servedReleaseSha256,
        identical: true,
      }
      assert.deepEqual(compareFrontendVantageEvidence(result, secondVantage), {
        ...comparisonPayload,
        evidenceSha256: sha256Canonical(comparisonPayload),
      })
      assert.throws(
        () => compareFrontendVantageEvidence(result, result),
        /exact verification-profile vantage IDs/i,
      )
      const digestConsistentTamper = (mutate) => {
        const value = structuredClone(result)
        mutate(value)
        return recomputeFrontendVantage(value)
      }
      assert.throws(
        () => compareFrontendVantageEvidence(digestConsistentTamper((value) => {
          value.apexAndWwwByteEquivalent = false
        }), secondVantage),
        /required results are invalid/i,
      )
      assert.throws(
        () => compareFrontendVantageEvidence(digestConsistentTamper((value) => {
          value.checkedAt = '2026-08-10 20:05:00Z'
        }), secondVantage),
        /canonical UTC timestamp/i,
      )
      assert.throws(
        () => compareFrontendVantageEvidence(digestConsistentTamper((value) => {
          value.origins = []
        }), secondVantage),
        /omits exact apex\/www observations/i,
      )
      assert.throws(
        () => compareFrontendVantageEvidence(digestConsistentTamper((value) => {
          value.origins[0].profiles[0].routes.pop()
        }), secondVantage),
        /omits reviewed frontend routes/i,
      )
      assert.throws(
        () => compareFrontendVantageEvidence(digestConsistentTamper((value) => {
          value.origins[0].profiles[0].liveJsonRoutes.pop()
        }), secondVantage),
        /omits reviewed live-JSON routes/i,
      )
      assert.throws(
        () => compareFrontendVantageEvidence(digestConsistentTamper((value) => {
          const assets = value.origins[0].profiles[0].assets
          assets.files.pop()
          assets.fileCount = assets.files.length
          assets.totalBytes = assets.files.reduce((total, file) => total + file.bytes, 0)
          assets.sha256 = sha256Canonical(assets.files.map(({
            sourcePath,
            urlPath,
            bytes,
            sha256,
          }) => ({ sourcePath, urlPath, bytes, sha256 })))
        }), secondVantage),
        /assets summary or ordering is invalid/i,
      )

      const preProbe = {
        manifestPath,
        policyPath: fixture.policyPath,
        fetchImpl: async () => assert.fail('production must not be probed before promotion validation'),
        approvalEvidenceDirectory: fixture.root,
        verifyProvenance: () => [{ verified: true }],
        checkedAt: '2026-08-10T20:05:00.000Z',
        vantageId: 'protected-eu-network',
        verificationProfile: 'production-independent-network',
      }
      await assert.rejects(
        verifyFrontendReleaseParity({
          ...preProbe,
          ...verifiedPromotion,
          promotionProvenanceBytes: Buffer.from('arbitrary provenance\n'),
        }),
        /Sigstore JSONL/i,
      )
      await assert.rejects(
        verifyFrontendReleaseParity({
          ...preProbe,
          ...verifiedFrontendPromotionFiles(promotionEvidence, { subjectSha256: 'e'.repeat(64) }),
        }),
        /subject digest does not match/i,
      )
      await assert.rejects(
        verifyFrontendReleaseParity({
          ...preProbe,
          ...verifiedPromotion,
          checkedAt: '2026-08-10T20:34:00.001Z',
        }),
        /within 30 minutes/i,
      )
      const unsafePromotion = structuredClone(promotionEvidence)
      unsafePromotion.rollbackDisposition = {
        mode: 'HOLD_PROMOTED',
        priorClassification: 'UNSAFE_PRECONTAINMENT',
        targetDeploymentId: null,
        safetyEvidence: null,
      }
      delete unsafePromotion.evidenceSha256
      unsafePromotion.evidenceSha256 = sha256Canonical(unsafePromotion)
      await assert.rejects(
        verifyFrontendReleaseParity({
          ...preProbe,
          ...verifiedFrontendPromotionFiles(unsafePromotion),
        }),
        /safe-containment rollback disposition/i,
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})
