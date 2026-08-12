import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  approveFrontendReleaseCandidate,
  createFrontendApprovalEnvelope,
  REVIEWED_FRONTEND_BUILDER_IMAGE,
} from '../../scripts/security/frontend-release-attestation.mjs'
import {
  REVIEWED_CONTAINER_DOCKERFILE,
  createPromotionApproval,
  inspectTarArchive,
  prepareEmergencyRelease,
  prepareNextContainerRelease,
  promoteVercelRelease,
  recoverVercelPromotion,
  rollbackVercelRelease,
  runProviderCanary,
  stageEmergencyRelease,
  stageNextContainerRelease,
  validateStageEvidence,
  validateStagedParityEvidence,
} from '../../scripts/security/vercel-rest-release.mjs'
import {
  canonicalJson,
  sha256Bytes,
  sha256Canonical,
} from '../../scripts/security/frontend-release-common.mjs'
import { verifyEmergencyContainment } from '../../scripts/security/verify-emergency-containment.mjs'

const repositoryEmergencyRoot = fileURLToPath(new URL('../../emergency-site', import.meta.url))
const TOKEN = 'vercel_test_token_that_is_never_logged_1234567890'
const TRUSTED_OIDC_TOKEN = `${Buffer.from('{"alg":"RS256","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"repo:jh005479-sudo/lester-labs:ref:refs/heads/main"}').toString('base64url')}.${'s'.repeat(86)}`
const TEAM_ID = 'team_12345678'
const CANARY_PROJECT_ID = 'prj_canary123'
const PRODUCTION_PROJECT_ID = 'prj_product123'
const REVIEWED_CANARY_TEAM_ID = 'team_vnMG4DPuSLlOs9bEi7QcRjhx'
const REVIEWED_CANARY_PROJECT_ID = 'prj_sUhxc4VDzA9cWn2rv7gr1cwJOo6K'
const REVIEWED_CANARY_PROJECT_NAME = 'lester-labs-release-canary'
const REVIEWED_CANARY_PROVIDER_ALIASES = [
  'lester-labs-release-canary-jh005479-8603-lester-labs.vercel.app',
  'lester-labs-release-canary-lester-labs.vercel.app',
]
const REVIEWED_PRODUCTION_TEAM_ID = 'team_vnMG4DPuSLlOs9bEi7QcRjhx'
const REVIEWED_PRODUCTION_PROJECT_ID = 'prj_dbAIzvnFWLzxkt2dpphAWbserIG7'
const REVIEWED_PRODUCTION_PROVIDER_ALIASES = [
  'lester-labs-jh005479-8603-lester-labs.vercel.app',
  'lester-labs-lester-labs.vercel.app',
]
const REVIEWED_PRODUCTION_PROMOTED_ALIASES = [
  'lester-labs-jh005479-8603-lester-labs.vercel.app',
  'lester-labs-lester-labs.vercel.app',
  'lester-labs-psi.vercel.app',
  'www.lester-labs.com',
]
const OLD_DEPLOYMENT_ID = 'dpl_old000001'
const NEW_DEPLOYMENT_ID = 'dpl_new000001'
const THIRD_DEPLOYMENT_ID = 'dpl_third00001'
const SOURCE_COMMIT = 'a'.repeat(40)
const RELEASE_PROFILE = 'production-separated-authority'
const CANARY_WORKFLOW_IDENTITY = Object.freeze({
  releaseProfile: RELEASE_PROFILE,
  workflowRunId: '111111',
  workflowRunAttempt: 1,
  sourceAttestationRunId: '222222',
  sourceAttestationRunAttempt: 1,
})
const STAGE_WORKFLOW_IDENTITY = Object.freeze({
  releaseProfile: RELEASE_PROFILE,
  workflowRunId: '333333',
  workflowRunAttempt: 1,
  sourceAttestationRunId: '222222',
  sourceAttestationRunAttempt: 1,
  providerCanaryRunId: '111111',
  providerCanaryRunAttempt: 1,
})
const SECURITY_HEADERS = JSON.parse(readFileSync(join(repositoryEmergencyRoot, 'vercel.json'), 'utf8'))
  .headers[0].headers.reduce((result, { key, value }) => ({ ...result, [key]: value }), {})

function writeFixtureFile(root, relativePath, contents) {
  const destination = join(root, relativePath)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, contents)
}

function tarOctal(value, width) {
  return `${value.toString(8).padStart(width - 1, '0')}\0`
}

function createTar(entries) {
  const blocks = []
  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    const header = Buffer.alloc(512)
    assert.ok(Buffer.byteLength(entry.path) <= 100)
    header.write(entry.path, 0, 'utf8')
    header.write(tarOctal(0o644, 8), 100, 'ascii')
    header.write(tarOctal(0, 8), 108, 'ascii')
    header.write(tarOctal(0, 8), 116, 'ascii')
    header.write(tarOctal(entry.bytes.length, 12), 124, 'ascii')
    header.write(tarOctal(0, 12), 136, 'ascii')
    header.fill(0x20, 148, 156)
    header[156] = 0x30
    header.write('ustar\0', 257, 'binary')
    header.write('00', 263, 'ascii')
    header.write('root', 265, 'ascii')
    header.write('root', 297, 'ascii')
    const checksum = header.reduce((sum, byte) => sum + byte, 0)
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii')
    blocks.push(header, entry.bytes)
    const padding = entry.bytes.length % 512
    if (padding !== 0) blocks.push(Buffer.alloc(512 - padding))
  }
  blocks.push(Buffer.alloc(1024))
  return Buffer.concat(blocks)
}

function createEmergencyPackage() {
  const root = mkdtempSync(join(tmpdir(), 'lester-vercel-emergency-'))
  const sourceDirectory = join(root, 'source')
  const releaseDirectory = join(root, 'release')
  cpSync(repositoryEmergencyRoot, sourceDirectory, { recursive: true })
  mkdirSync(releaseDirectory)
  const inventory = verifyEmergencyContainment({ root: sourceDirectory })
  const archive = createTar(inventory.files.map((file) => ({
    path: file.path,
    bytes: readFileSync(join(sourceDirectory, file.path)),
  })))
  writeFixtureFile(releaseDirectory, 'emergency-containment.inventory.json', canonicalJson(inventory))
  writeFixtureFile(releaseDirectory, 'emergency-containment.tar', archive)
  writeFixtureFile(releaseDirectory, 'emergency-containment.inventory.provenance.jsonl', 'signed inventory\n')
  writeFixtureFile(releaseDirectory, 'emergency-containment.archive.provenance.jsonl', 'signed archive\n')
  return { root, sourceDirectory, releaseDirectory, archive }
}

function inventory(files) {
  return {
    sha256: sha256Canonical(files),
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  }
}

function createNextPackage() {
  const root = mkdtempSync(join(tmpdir(), 'lester-vercel-next-'))
  const releaseDirectory = join(root, 'release')
  mkdirSync(releaseDirectory)
  const serverBytes = Buffer.from('export default "reviewed standalone"\n')
  const archive = createTar([{ path: 'server.js', bytes: serverBytes }])
  const payloadFiles = [{ path: 'server.js', bytes: serverBytes.length, sha256: sha256Bytes(serverBytes) }]
  const payloadInventory = inventory(payloadFiles)
  const sourceMaterials = [
    'next.config.ts',
    'package-lock.json',
    'package.json',
    'src/config/frontendReleasePolicy.json',
    'vercel.json',
  ].map((path) => ({ path, bytes: 1, sha256: '1'.repeat(64) }))
  const sourceTree = inventory([{ path: 'src/app/page.tsx', bytes: 1, sha256: '2'.repeat(64) }])
  const artifactFiles = [{ path: 'build/static/chunk.js', bytes: 1, sha256: '3'.repeat(64) }]
  const artifactInventory = inventory(artifactFiles)
  const publicArtifactFiles = [{
    sourcePath: 'build/static/chunk.js',
    urlPath: '/chunk.js',
    bytes: 1,
    sha256: '3'.repeat(64),
  }]
  const publicArtifacts = inventory(publicArtifactFiles)
  const routeBody = Buffer.from('<!doctype html><p>reviewed route</p>')
  const base = {
    kind: 'lester-labs-frontend-release-attestation',
    schemaVersion: 1,
    releaseProfile: RELEASE_PROFILE,
    sourceCommit: SOURCE_COMMIT,
    buildId: SOURCE_COMMIT,
    builderImage: REVIEWED_FRONTEND_BUILDER_IMAGE,
    runtime: { node: 'v24.18.0', npm: '11.16.0', os: 'linux', arch: 'x64' },
    policySha256: '4'.repeat(64),
    sourceMaterials,
    sourceTree,
    artifactEmbeddedOrigins: [],
    sbom: { format: 'CycloneDX', specVersion: '1.6', bytes: 1, sha256: '5'.repeat(64) },
    deploymentArtifact: {
      format: 'application/vnd.lester-labs.next-standalone.tar',
      archiveBytes: archive.length,
      archiveSha256: sha256Bytes(archive),
      payloadInventorySha256: payloadInventory.sha256,
      fileCount: payloadInventory.fileCount,
      totalBytes: payloadInventory.totalBytes,
    },
    artifactInventory,
    publicArtifacts,
    routeSnapshots: [{
      path: '/',
      finalPath: '/',
      bodySha256: sha256Bytes(routeBody),
      bytes: routeBody.length,
      contentType: 'text/html; charset=utf-8',
      securityHeaders: SECURITY_HEADERS,
      thirdPartyOrigins: [],
      activeResourceOrigins: [],
      referencedActiveResourcePaths: [],
    }],
  }
  const candidate = {
    status: 'CANDIDATE',
    ...base,
    reviewPayloadSha256: sha256Canonical(base),
    approvalEnvelopes: [],
  }
  const candidateProvenancePath = join(releaseDirectory, 'github-sigstore-provenance.jsonl')
  writeFixtureFile(releaseDirectory, 'frontend-release-candidate.json', canonicalJson(candidate))
  writeFixtureFile(releaseDirectory, 'github-sigstore-provenance.jsonl', 'signed candidate and tar\n')
  const approvalInputs = [
    ['source-security', 'frontend-release-source-security', 'source-security-approval'],
    ['release-operations', 'frontend-release-operations', 'release-operations-approval'],
  ].map(([reviewRole, protectedEnvironment, fileStem], index) => {
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
      requestedBy: '@release-reviewer',
      createdAt: `2026-08-11T00:0${index}:00.000Z`,
    })
    const envelopePath = join(releaseDirectory, `${fileStem}.json`)
    const provenancePath = join(releaseDirectory, `${fileStem}.provenance.jsonl`)
    writeFixtureFile(releaseDirectory, `${fileStem}.json`, canonicalJson(envelope))
    writeFixtureFile(releaseDirectory, `${fileStem}.provenance.jsonl`, `${reviewRole} signed\n`)
    return { envelopePath, provenancePath }
  })
  const approved = approveFrontendReleaseCandidate({ candidate, approvals: approvalInputs })
  writeFixtureFile(releaseDirectory, 'approved-manifest.json', canonicalJson(approved))
  writeFixtureFile(releaseDirectory, 'approved-manifest.provenance.jsonl', 'approved manifest signed\n')
  writeFixtureFile(releaseDirectory, 'deployment-payload.inventory.json', canonicalJson(payloadInventory))
  writeFixtureFile(releaseDirectory, 'frontend-standalone.tar', archive)
  return { root, releaseDirectory, archive, routeBody }
}

function makeVercelMock({
  teamId = TEAM_ID,
  projectId,
  projectName,
  publicRoutes,
  productionAliases = [],
  autoAssignCustomDomains = false,
  errorBody,
  expectedTrustedOidcToken,
  failPromotionProjectPollOnce = false,
  failPromotionResponseOnce = false,
  replacePromotionWithThirdDeployment = false,
  failStageCreateResponseOnce = false,
  failRollbackResponseOnce = false,
  createdAliases = [],
  creationResponseAliases = createdAliases,
  creationResponseAliasAssigned = false,
  stagedAliasAssigned = false,
  promotionSubstateLagReads = 0,
  emptyDeploymentListsAfterCreate = 0,
  failDeploymentListOnce = false,
} = {}) {
  const state = {
    currentDeploymentId: OLD_DEPLOYMENT_ID,
    created: false,
    deleted: false,
    phase: 'initial',
    calls: [],
    uploads: [],
    createBody: null,
    promotionPollFailed: false,
    promotionResponseFailed: false,
    promotionSuperseded: false,
    stageCreateResponseFailed: false,
    rollbackResponseFailed: false,
    promotionDeploymentReads: 0,
    deploymentListReads: 0,
    deploymentListFailed: false,
  }
  const deployment = (id) => {
    if (id === OLD_DEPLOYMENT_ID) {
      return {
        id,
        projectId,
        target: 'production',
        readyState: 'READY',
        readySubstate: state.currentDeploymentId === id ? 'PROMOTED' : 'PROMOTED',
        aliasAssigned: state.currentDeploymentId === id,
        alias: state.currentDeploymentId === id ? productionAliases : [],
        url: `old-${projectName}.vercel.app`,
      }
    }
    assert.equal(id, NEW_DEPLOYMENT_ID)
    const promoted = state.currentDeploymentId === id
    if (promoted) state.promotionDeploymentReads += 1
    const promotionSettled = promoted && state.promotionDeploymentReads > promotionSubstateLagReads
    return {
      id,
      projectId,
      target: 'production',
      readyState: 'READY',
      readySubstate: promotionSettled ? 'PROMOTED' : 'STAGED',
      aliasAssigned: promotionSettled || stagedAliasAssigned,
      alias: promotionSettled ? productionAliases : createdAliases,
      url: `new-${projectName}.vercel.app`,
      meta: state.createBody?.meta,
    }
  }
  async function fetchImpl(input, options = {}) {
    const url = input instanceof URL ? input : new URL(input)
    const method = options.method ?? 'GET'
    const headers = new Headers(options.headers)
    state.calls.push({ method, url: url.href, headers, body: options.body })
    if (url.origin !== 'https://api.vercel.com') {
      assert.equal(headers.has('authorization'), false, 'the Vercel bearer token reached a public probe')
      assert.equal(
        headers.get('x-vercel-trusted-oidc-idp-token'),
        expectedTrustedOidcToken ?? null,
        'the public probe used the wrong trusted-source OIDC token',
      )
      const route = publicRoutes.get(url.pathname)
      if (!route) return new Response('not found', { status: 404 })
      return new Response(route.body, { status: route.status ?? 200, headers: route.headers })
    }
    assert.equal(headers.get('authorization'), `Bearer ${TOKEN}`)
    assert.equal(headers.has('x-vercel-trusted-oidc-idp-token'), false, 'the trusted-source OIDC token reached the Vercel API')
    assert.equal(url.searchParams.get('teamId'), teamId)
    if (errorBody) return new Response(errorBody, { status: 500 })
    if (method === 'GET' && url.pathname === `/v9/projects/${projectId}`) {
      if (failPromotionProjectPollOnce && state.phase === 'promoted' && !state.promotionPollFailed) {
        state.promotionPollFailed = true
        return new Response('transient failure', { status: 503 })
      }
      if (replacePromotionWithThirdDeployment && state.phase === 'promoted' && !state.promotionSuperseded) {
        state.promotionSuperseded = true
        state.currentDeploymentId = THIRD_DEPLOYMENT_ID
        state.phase = 'superseded'
      }
      return Response.json({
        id: projectId,
        name: projectName,
        accountId: teamId,
        autoAssignCustomDomains,
        targets: { production: { id: state.currentDeploymentId } },
      })
    }
    if (method === 'GET' && url.pathname.startsWith('/v13/deployments/')) {
      return Response.json(deployment(url.pathname.split('/').at(-1)))
    }
    if (method === 'GET' && url.pathname === '/v6/deployments') {
      assert.equal(url.searchParams.get('projectId'), projectId)
      assert.equal(url.searchParams.get('target'), 'production')
      state.deploymentListReads += 1
      if (failDeploymentListOnce && !state.deploymentListFailed) {
        state.deploymentListFailed = true
        return new Response('transient deployment-list failure', { status: 503 })
      }
      const deploymentVisible = (
        state.created && state.deploymentListReads > emptyDeploymentListsAfterCreate
      )
      return Response.json({ deployments: deploymentVisible ? [deployment(NEW_DEPLOYMENT_ID)] : [] })
    }
    if (method === 'POST' && url.pathname === '/v2/files') {
      const bytes = Buffer.from(options.body)
      const expected = createHash('sha1').update(bytes).digest('hex')
      assert.equal(headers.get('x-vercel-digest'), expected)
      assert.equal(headers.get('content-length'), String(bytes.length))
      state.uploads.push({ bytes, sha1: expected })
      return Response.json({})
    }
    if (method === 'POST' && url.pathname === '/v13/deployments') {
      assert.equal(url.searchParams.get('forceNew'), '1')
      assert.equal(url.searchParams.get('skipAutoDetectionConfirmation'), '1')
      state.createBody = JSON.parse(options.body)
      assert.equal(state.createBody.version, 2)
      assert.equal(state.createBody.autoAssignCustomDomains, false)
      assert.equal(state.createBody.project, projectId)
      assert.equal(state.createBody.target, 'production')
      state.created = true
      state.phase = 'staged'
      if (failStageCreateResponseOnce && !state.stageCreateResponseFailed) {
        state.stageCreateResponseFailed = true
        throw new Error('simulated lost stage-create response')
      }
      return Response.json({
        id: NEW_DEPLOYMENT_ID,
        projectId,
        target: 'production',
        aliasAssigned: creationResponseAliasAssigned,
        alias: creationResponseAliases,
      }, { status: 201 })
    }
    if (method === 'POST' && url.pathname.endsWith(`/promote/${NEW_DEPLOYMENT_ID}`)) {
      state.currentDeploymentId = NEW_DEPLOYMENT_ID
      state.phase = 'promoted'
      if (failPromotionResponseOnce && !state.promotionResponseFailed) {
        state.promotionResponseFailed = true
        throw new Error('simulated lost promotion response')
      }
      return Response.json({ accepted: true })
    }
    if (method === 'POST' && url.pathname.endsWith(`/rollback/${OLD_DEPLOYMENT_ID}`)) {
      state.currentDeploymentId = OLD_DEPLOYMENT_ID
      state.phase = 'rolled-back'
      if (failRollbackResponseOnce && !state.rollbackResponseFailed) {
        state.rollbackResponseFailed = true
        throw new Error('simulated lost rollback response')
      }
      return Response.json({ accepted: true })
    }
    if (method === 'DELETE' && url.pathname === `/v13/deployments/${NEW_DEPLOYMENT_ID}`) {
      assert.equal(state.currentDeploymentId, OLD_DEPLOYMENT_ID)
      state.deleted = true
      return Response.json({ deleted: true })
    }
    throw new Error(`Unexpected mock request ${method} ${url.pathname}`)
  }
  return { fetchImpl, state }
}

function emergencyPublicRoutes(sourceDirectory) {
  return new Map([
    ['/', { body: readFileSync(join(sourceDirectory, 'index.html')), headers: SECURITY_HEADERS }],
    ['/.well-known/security.txt', { body: readFileSync(join(sourceDirectory, '.well-known/security.txt')), headers: SECURITY_HEADERS }],
    ['/robots.txt', { body: readFileSync(join(sourceDirectory, 'robots.txt')), headers: SECURITY_HEADERS }],
  ])
}

function nextPublicRoutes(routeBody) {
  return new Map([['/', { body: routeBody, headers: SECURITY_HEADERS }]])
}

function writeCanaryPackage(root, evidence) {
  const evidencePath = join(root, 'provider-canary.json')
  const provenancePath = join(root, 'provider-canary.provenance.jsonl')
  writeFixtureFile(root, 'provider-canary.json', canonicalJson(evidence))
  writeFixtureFile(root, 'provider-canary.provenance.jsonl', 'provider canary signed\n')
  return { evidencePath, provenancePath }
}

function writeStageAndParity(root, stage) {
  const stageEvidencePath = join(root, 'stage.json')
  const stageProvenancePath = join(root, 'stage.provenance.jsonl')
  writeFixtureFile(root, 'stage.json', canonicalJson(stage))
  writeFixtureFile(root, 'stage.provenance.jsonl', 'stage signed\n')
  const parityPayload = {
    kind: 'lester-labs-vercel-staged-parity',
    schemaVersion: 1,
    status: 'PASSED',
    checkedAt: '2026-08-11T02:00:00.000Z',
    stageEvidenceSha256: stage.evidenceSha256,
    sourceCommit: stage.source.commit,
    artifactKind: stage.artifactKind,
    artifactSha256: stage.artifact.sha256,
    deploymentId: stage.deployment.id,
    deploymentUrl: stage.deployment.url,
    profiles: [
      { id: 'credential-free-http', evidenceSha256: '6'.repeat(64) },
      { id: 'isolated-chromium', evidenceSha256: '7'.repeat(64) },
    ],
    results: {
      deploymentIdentityMatched: true,
      servedArtifactMatched: true,
      securityPolicyMatched: true,
      networkPolicyMatched: true,
      interactionPolicyMatched: true,
      providerResourcePolicyMatched: true,
    },
  }
  const parity = { ...parityPayload, evidenceSha256: sha256Canonical(parityPayload) }
  const parityEvidencePath = join(root, 'parity.json')
  const parityProvenancePath = join(root, 'parity.provenance.jsonl')
  writeFixtureFile(root, 'parity.json', canonicalJson(parity))
  writeFixtureFile(root, 'parity.provenance.jsonl', 'parity signed\n')
  return { stageEvidencePath, stageProvenancePath, parity, parityEvidencePath, parityProvenancePath }
}

function writeSafeRollbackPackage(root) {
  const promotionPayload = {
    kind: 'lester-labs-vercel-promotion-evidence',
    schemaVersion: 3,
    status: 'CURRENT',
    confirmation: 'DIRECT',
    promotedAt: '2026-08-10T20:00:00.000Z',
    sourceCommit: 'b'.repeat(40),
    releaseProfile: RELEASE_PROFILE,
    artifactKind: 'emergency-static',
    manifestSha256: '1'.repeat(64),
    artifactSha256: '2'.repeat(64),
    stageEvidenceSha256: '3'.repeat(64),
    stageProvenanceSha256: '4'.repeat(64),
    promotionApprovalSha256: '5'.repeat(64),
    promotionApprovalProvenanceSha256: '6'.repeat(64),
    parityEvidenceSha256: '7'.repeat(64),
    parityProvenanceSha256: '8'.repeat(64),
    project: {
      teamId: TEAM_ID,
      projectId: PRODUCTION_PROJECT_ID,
      name: 'lester-labs',
      autoAssignCustomDomains: false,
    },
    deployment: {
      id: OLD_DEPLOYMENT_ID,
      url: 'https://old-lester-labs.vercel.app',
      target: 'production',
      readyState: 'READY',
      readySubstate: 'PROMOTED',
      aliasAssigned: true,
      aliases: ['lester-labs.com', 'www.lester-labs.com'],
    },
    priorDeploymentId: 'dpl_unsafe0001',
    rollbackDisposition: {
      mode: 'HOLD_PROMOTED',
      priorClassification: 'UNSAFE_PRECONTAINMENT',
      targetDeploymentId: null,
      safetyEvidence: null,
    },
  }
  const promotion = { ...promotionPayload, evidenceSha256: sha256Canonical(promotionPayload) }
  const promotionEvidencePath = join(root, 'safe-promotion.json')
  const promotionProvenancePath = join(root, 'safe-promotion.provenance.jsonl')
  const promotionProvenance = Buffer.from('safe promotion signed\n')
  writeFixtureFile(root, 'safe-promotion.json', canonicalJson(promotion))
  writeFixtureFile(root, 'safe-promotion.provenance.jsonl', promotionProvenance)
  const parityPayload = {
    kind: 'lester-labs-independent-emergency-vantage-comparison',
    schemaVersion: 3,
    verificationProfile: 'production-independent-network',
    leftVantageId: 'protected-eu-network',
    rightVantageId: 'protected-us-network',
    sourceCommit: promotion.sourceCommit,
    artifactSha256: promotion.artifactSha256,
    deploymentId: promotion.deployment.id,
    promotionEvidenceSha256: promotion.evidenceSha256,
    promotionProvenanceSha256: sha256Bytes(promotionProvenance),
    promotionVerificationBindingSha256: '9'.repeat(64),
    servedReleaseSha256: 'a'.repeat(64),
    identical: true,
  }
  const parity = { ...parityPayload, evidenceSha256: sha256Canonical(parityPayload) }
  const parityEvidencePath = join(root, 'safe-parity.json')
  const parityProvenancePath = join(root, 'safe-parity.provenance.jsonl')
  writeFixtureFile(root, 'safe-parity.json', canonicalJson(parity))
  writeFixtureFile(root, 'safe-parity.provenance.jsonl', 'safe parity signed\n')
  return {
    safeRollbackPromotionEvidencePath: promotionEvidencePath,
    safeRollbackPromotionProvenancePath: promotionProvenancePath,
    safeRollbackParityEvidencePath: parityEvidencePath,
    safeRollbackParityProvenancePath: parityProvenancePath,
  }
}

async function prepareEmergencyPromotionScenario(mockOptions = {}) {
  const fixture = createEmergencyPackage()
  const canaryMock = makeVercelMock({
    projectId: CANARY_PROJECT_ID,
    projectName: 'lester-provider-canary',
    publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
  })
  const canary = await runProviderCanary({
    ...CANARY_WORKFLOW_IDENTITY,
    artifactKind: 'emergency-static',
    releaseDirectory: fixture.releaseDirectory,
    sourceDirectory: fixture.sourceDirectory,
    sourceCommit: SOURCE_COMMIT,
    maximumUploadBytes: 128_000,
    token: TOKEN,
    teamId: TEAM_ID,
    projectId: CANARY_PROJECT_ID,
    projectName: 'lester-provider-canary',
    productionProjectId: PRODUCTION_PROJECT_ID,
    fetchImpl: canaryMock.fetchImpl,
    now: () => '2026-08-11T00:30:00.000Z',
    delay: async () => {},
    maxPollAttempts: 3,
    pollIntervalMs: 0,
  })
  const canaryPackage = writeCanaryPackage(fixture.root, canary)
  const productionMock = makeVercelMock({
    projectId: PRODUCTION_PROJECT_ID,
    projectName: 'lester-labs',
    publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
    productionAliases: ['lester-labs.com', 'www.lester-labs.com'],
    ...mockOptions,
  })
  const stage = await stageEmergencyRelease({
    ...STAGE_WORKFLOW_IDENTITY,
    releaseDirectory: fixture.releaseDirectory,
    sourceDirectory: fixture.sourceDirectory,
    sourceCommit: SOURCE_COMMIT,
    maximumUploadBytes: 128_000,
    providerCanaryEvidencePath: canaryPackage.evidencePath,
    providerCanaryProvenancePath: canaryPackage.provenancePath,
    token: TOKEN,
    teamId: TEAM_ID,
    projectId: PRODUCTION_PROJECT_ID,
    projectName: 'lester-labs',
    fetchImpl: productionMock.fetchImpl,
    now: () => '2026-08-11T01:00:00.000Z',
    delay: async () => {},
    maxPollAttempts: 3,
    pollIntervalMs: 0,
  })
  const releaseEvidence = writeStageAndParity(fixture.root, stage)
  const approval = createPromotionApproval({
    stageEvidence: stage,
    stageProvenancePath: releaseEvidence.stageProvenancePath,
    parityEvidencePath: releaseEvidence.parityEvidencePath,
    parityProvenancePath: releaseEvidence.parityProvenancePath,
    workflowRunId: '987654',
    workflowRunAttempt: 1,
    requestedBy: '@release-owner',
    approvedAt: '2026-08-11T03:00:00.000Z',
    expiresAt: '2026-08-11T04:00:00.000Z',
  })
  const approvalPath = join(fixture.root, 'promotion-approval.json')
  const approvalProvenancePath = join(fixture.root, 'promotion-approval.provenance.jsonl')
  writeFixtureFile(fixture.root, 'promotion-approval.json', canonicalJson(approval))
  writeFixtureFile(fixture.root, 'promotion-approval.provenance.jsonl', 'promotion approval signed\n')
  return {
    fixture,
    productionMock,
    promotionArguments: {
      ...releaseEvidence,
      approvalPath,
      approvalProvenancePath,
      token: TOKEN,
      fetchImpl: productionMock.fetchImpl,
      now: () => '2026-08-11T03:30:00.000Z',
      delay: async () => {},
      maxPollAttempts: 3,
      pollIntervalMs: 0,
    },
  }
}

async function prepareNextPromotionScenario(mockOptions = {}) {
  const fixture = createNextPackage()
  const canaryMock = makeVercelMock({
    projectId: CANARY_PROJECT_ID,
    projectName: 'lester-next-canary',
    publicRoutes: nextPublicRoutes(fixture.routeBody),
  })
  const canary = await runProviderCanary({
    ...CANARY_WORKFLOW_IDENTITY,
    artifactKind: 'next-standalone-container',
    releaseDirectory: fixture.releaseDirectory,
    maximumUploadBytes: 128_000,
    token: TOKEN,
    teamId: TEAM_ID,
    projectId: CANARY_PROJECT_ID,
    projectName: 'lester-next-canary',
    productionProjectId: PRODUCTION_PROJECT_ID,
    fetchImpl: canaryMock.fetchImpl,
    now: () => '2026-08-11T00:30:00.000Z',
    delay: async () => {},
    maxPollAttempts: 3,
    pollIntervalMs: 0,
  })
  const canaryPackage = writeCanaryPackage(fixture.root, canary)
  const productionMock = makeVercelMock({
    projectId: PRODUCTION_PROJECT_ID,
    projectName: 'lester-labs',
    publicRoutes: nextPublicRoutes(fixture.routeBody),
    productionAliases: ['lester-labs.com', 'www.lester-labs.com'],
    ...mockOptions,
  })
  const stage = await stageNextContainerRelease({
    ...STAGE_WORKFLOW_IDENTITY,
    ...writeSafeRollbackPackage(fixture.root),
    releaseDirectory: fixture.releaseDirectory,
    maximumUploadBytes: 128_000,
    providerCanaryEvidencePath: canaryPackage.evidencePath,
    providerCanaryProvenancePath: canaryPackage.provenancePath,
    token: TOKEN,
    teamId: TEAM_ID,
    projectId: PRODUCTION_PROJECT_ID,
    projectName: 'lester-labs',
    fetchImpl: productionMock.fetchImpl,
    now: () => '2026-08-11T01:00:00.000Z',
    delay: async () => {},
    maxPollAttempts: 3,
    pollIntervalMs: 0,
  })
  const releaseEvidence = writeStageAndParity(fixture.root, stage)
  const approval = createPromotionApproval({
    stageEvidence: stage,
    stageProvenancePath: releaseEvidence.stageProvenancePath,
    parityEvidencePath: releaseEvidence.parityEvidencePath,
    parityProvenancePath: releaseEvidence.parityProvenancePath,
    workflowRunId: '987654',
    workflowRunAttempt: 1,
    requestedBy: '@release-owner',
    approvedAt: '2026-08-11T03:00:00.000Z',
    expiresAt: '2026-08-11T04:00:00.000Z',
  })
  const approvalPath = join(fixture.root, 'promotion-approval.json')
  const approvalProvenancePath = join(fixture.root, 'promotion-approval.provenance.jsonl')
  writeFixtureFile(fixture.root, 'promotion-approval.json', canonicalJson(approval))
  writeFixtureFile(fixture.root, 'promotion-approval.provenance.jsonl', 'promotion approval signed\n')
  return {
    fixture,
    productionMock,
    promotionArguments: {
      ...releaseEvidence,
      approvalPath,
      approvalProvenancePath,
      token: TOKEN,
      fetchImpl: productionMock.fetchImpl,
      now: () => '2026-08-11T03:30:00.000Z',
      delay: async () => {},
      maxPollAttempts: 3,
      pollIntervalMs: 0,
    },
  }
}

describe('dependency-free Vercel REST release adapter', () => {
  it('uses the authoritative deployment read when creation reports a generated URL as an alias', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        createdAliases: ['new-lester-provider-canary.vercel.app'],
        creationResponseAliases: ['generated-lester-provider-canary.vercel.app'],
        creationResponseAliasAssigned: true,
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: canaryMock.fetchImpl,
        now: () => '2026-08-11T00:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(canary.status, 'PASSED')
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
      assert.equal(canaryMock.state.deleted, true)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('accepts only the exact provider metadata aliases bound to the reviewed canary identity', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        teamId: REVIEWED_CANARY_TEAM_ID,
        projectId: REVIEWED_CANARY_PROJECT_ID,
        projectName: REVIEWED_CANARY_PROJECT_NAME,
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        createdAliases: [
          `new-${REVIEWED_CANARY_PROJECT_NAME}.vercel.app`,
          ...REVIEWED_CANARY_PROVIDER_ALIASES,
        ],
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: REVIEWED_CANARY_TEAM_ID,
        projectId: REVIEWED_CANARY_PROJECT_ID,
        projectName: REVIEWED_CANARY_PROJECT_NAME,
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: canaryMock.fetchImpl,
        now: () => '2026-08-11T00:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(canary.status, 'PASSED')
      assert.equal(canary.results.customProductionAliasesAbsent, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
      assert.equal(canaryMock.state.deleted, true)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects the reviewed canary aliases when the project name binding differs', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        teamId: REVIEWED_CANARY_TEAM_ID,
        projectId: REVIEWED_CANARY_PROJECT_ID,
        projectName: 'lookalike-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        createdAliases: REVIEWED_CANARY_PROVIDER_ALIASES,
      })
      await assert.rejects(
        runProviderCanary({
          ...CANARY_WORKFLOW_IDENTITY,
          artifactKind: 'emergency-static',
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          maximumUploadBytes: 128_000,
          token: TOKEN,
          teamId: REVIEWED_CANARY_TEAM_ID,
          projectId: REVIEWED_CANARY_PROJECT_ID,
          projectName: 'lookalike-canary',
          productionProjectId: PRODUCTION_PROJECT_ID,
          fetchImpl: canaryMock.fetchImpl,
          delay: async () => {},
          maxPollAttempts: 3,
          pollIntervalMs: 0,
        }),
        /differs from its reviewed staged-alias binding/i,
      )
      assert.equal(canaryMock.state.deleted, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('accepts exact assigned provider hostnames only for the reviewed READY/STAGED canary', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        teamId: REVIEWED_CANARY_TEAM_ID,
        projectId: REVIEWED_CANARY_PROJECT_ID,
        projectName: REVIEWED_CANARY_PROJECT_NAME,
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        createdAliases: REVIEWED_CANARY_PROVIDER_ALIASES,
        stagedAliasAssigned: true,
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: REVIEWED_CANARY_TEAM_ID,
        projectId: REVIEWED_CANARY_PROJECT_ID,
        projectName: REVIEWED_CANARY_PROJECT_NAME,
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: canaryMock.fetchImpl,
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(canary.status, 'PASSED')
      assert.equal(canary.schemaVersion, 3)
      assert.equal(canary.results.customProductionAliasesAbsent, true)
      assert.equal(canaryMock.state.deleted, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('keeps aliasAssigned fail-closed for every unreviewed project identity', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'unreviewed-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        stagedAliasAssigned: true,
      })
      await assert.rejects(
        runProviderCanary({
          ...CANARY_WORKFLOW_IDENTITY,
          artifactKind: 'emergency-static',
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          maximumUploadBytes: 128_000,
          token: TOKEN,
          teamId: TEAM_ID,
          projectId: CANARY_PROJECT_ID,
          projectName: 'unreviewed-canary',
          productionProjectId: PRODUCTION_PROJECT_ID,
          fetchImpl: canaryMock.fetchImpl,
          delay: async () => {},
          maxPollAttempts: 3,
          pollIntervalMs: 0,
        }),
        (error) => /unexpectedly has aliases assigned/i.test(error.message) && !error.message.includes(TOKEN),
      )
      assert.equal(canaryMock.state.deleted, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('waits for the exact promoted substate after the canary project target switches', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'canary-project',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        promotionSubstateLagReads: 2,
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: CANARY_PROJECT_ID,
        projectName: 'canary-project',
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: canaryMock.fetchImpl,
        delay: async () => {},
        maxPollAttempts: 5,
        pollIntervalMs: 0,
      })
      assert.equal(canary.status, 'PASSED')
      assert.equal(canaryMock.state.promotionDeploymentReads, 3)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
      assert.equal(canaryMock.state.deleted, true)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('reports only the public HTTP status when a protected canary probe is rejected', async () => {
    const fixture = createEmergencyPackage()
    try {
      const publicRoutes = emergencyPublicRoutes(fixture.sourceDirectory)
      publicRoutes.get('/').status = 403
      const canaryMock = makeVercelMock({
        teamId: REVIEWED_CANARY_TEAM_ID,
        projectId: REVIEWED_CANARY_PROJECT_ID,
        projectName: REVIEWED_CANARY_PROJECT_NAME,
        expectedTrustedOidcToken: TRUSTED_OIDC_TOKEN,
        publicRoutes,
        createdAliases: REVIEWED_CANARY_PROVIDER_ALIASES,
        stagedAliasAssigned: true,
      })
      await assert.rejects(
        runProviderCanary({
          ...CANARY_WORKFLOW_IDENTITY,
          artifactKind: 'emergency-static',
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          maximumUploadBytes: 128_000,
          token: TOKEN,
          teamId: REVIEWED_CANARY_TEAM_ID,
          projectId: REVIEWED_CANARY_PROJECT_ID,
          projectName: REVIEWED_CANARY_PROJECT_NAME,
          productionProjectId: PRODUCTION_PROJECT_ID,
          trustedOidcToken: TRUSTED_OIDC_TOKEN,
          fetchImpl: canaryMock.fetchImpl,
          delay: async () => {},
          maxPollAttempts: 3,
          pollIntervalMs: 0,
        }),
        (error) => /returned status 403; expected 200/i.test(error.message) &&
          !error.message.includes(TOKEN) && !error.message.includes(TRUSTED_OIDC_TOKEN),
      )
      assert.equal(canaryMock.state.deleted, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('accepts the exact public-testnet READY/STAGED production system-hostname assignment, records raw state, promotes, and refuses the unsafe pre-containment rollback', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        expectedTrustedOidcToken: TRUSTED_OIDC_TOKEN,
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        releaseProfile: 'public-testnet-immutable',
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        productionProjectId: PRODUCTION_PROJECT_ID,
        trustedOidcToken: TRUSTED_OIDC_TOKEN,
        fetchImpl: canaryMock.fetchImpl,
        now: () => '2026-08-11T00:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(canary.status, 'PASSED')
      assert.equal(canonicalJson(canary).includes(TRUSTED_OIDC_TOKEN), false)
      assert.equal(canary.providerMode, 'build-output-api-v3-static')
      assert.equal(canaryMock.state.deleted, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
      assert.deepEqual(
        canaryMock.state.createBody.files.map(({ file }) => file),
        [
          '.vercel/output/config.json',
          '.vercel/output/static/.well-known/security.txt',
          '.vercel/output/static/index.html',
          '.vercel/output/static/robots.txt',
        ],
      )
      assert.deepEqual(canaryMock.state.createBody.projectSettings, {
        buildCommand: '',
        framework: null,
        installCommand: '',
        outputDirectory: '.vercel/output',
        rootDirectory: null,
      })
      const canaryPackage = writeCanaryPackage(fixture.root, canary)
      const productionMock = makeVercelMock({
        teamId: REVIEWED_PRODUCTION_TEAM_ID,
        projectId: REVIEWED_PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        productionAliases: REVIEWED_PRODUCTION_PROMOTED_ALIASES,
        createdAliases: REVIEWED_PRODUCTION_PROVIDER_ALIASES,
        stagedAliasAssigned: true,
      })
      const stage = await stageEmergencyRelease({
        ...STAGE_WORKFLOW_IDENTITY,
        releaseProfile: 'public-testnet-immutable',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        providerCanaryEvidencePath: canaryPackage.evidencePath,
        providerCanaryProvenancePath: canaryPackage.provenancePath,
        token: TOKEN,
        teamId: REVIEWED_PRODUCTION_TEAM_ID,
        projectId: REVIEWED_PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        fetchImpl: productionMock.fetchImpl,
        now: () => '2026-08-11T01:00:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(stage.status, 'STAGED')
      assert.equal(stage.priorDeploymentId, OLD_DEPLOYMENT_ID)
      assert.equal(stage.rollbackDisposition.mode, 'HOLD_PROMOTED')
      assert.equal(stage.rollbackDisposition.priorClassification, 'UNSAFE_PRECONTAINMENT')
      assert.equal(stage.schemaVersion, 4)
      assert.equal(stage.deployment.aliasAssigned, true)
      assert.deepEqual(stage.deployment.aliases, REVIEWED_PRODUCTION_PROVIDER_ALIASES)
      const apexAssigned = structuredClone(stage)
      apexAssigned.deployment.aliases.push('lester-labs.com')
      const { evidenceSha256: ignoredEvidenceSha256, ...apexAssignedPayload } = apexAssigned
      apexAssigned.evidenceSha256 = sha256Canonical(apexAssignedPayload)
      assert.throws(
        () => validateStageEvidence(apexAssigned),
        /assigned an unexpected alias/i,
      )
      const realProductionProfile = structuredClone(stage)
      realProductionProfile.source.releaseProfile = 'production-separated-authority'
      const { evidenceSha256: ignoredProfileSha256, ...realProductionPayload } = realProductionProfile
      realProductionProfile.evidenceSha256 = sha256Canonical(realProductionPayload)
      assert.throws(
        () => validateStageEvidence(realProductionProfile),
        /unexpectedly has aliases assigned/i,
      )
      assert.equal(stage.sourceUpload.files.every(({ securitySha256 }) => /^[0-9a-f]{64}$/u.test(securitySha256)), true)
      assert.equal(stage.sourceUpload.files.every(({ providerSha1 }) => /^[0-9a-f]{40}$/u.test(providerSha1)), true)

      const releaseEvidence = writeStageAndParity(fixture.root, stage)
      validateStagedParityEvidence(releaseEvidence.parity, stage)
      const approval = createPromotionApproval({
        stageEvidence: stage,
        stageProvenancePath: releaseEvidence.stageProvenancePath,
        parityEvidencePath: releaseEvidence.parityEvidencePath,
        parityProvenancePath: releaseEvidence.parityProvenancePath,
        workflowRunId: '987654',
        workflowRunAttempt: 1,
        requestedBy: '@release-owner',
        approvedAt: '2026-08-11T03:00:00.000Z',
        expiresAt: '2026-08-11T04:00:00.000Z',
      })
      const approvalPath = join(fixture.root, 'promotion-approval.json')
      const approvalProvenancePath = join(fixture.root, 'promotion-approval.provenance.jsonl')
      writeFixtureFile(fixture.root, 'promotion-approval.json', canonicalJson(approval))
      writeFixtureFile(fixture.root, 'promotion-approval.provenance.jsonl', 'promotion approval signed\n')
      const promotion = await promoteVercelRelease({
        ...releaseEvidence,
        approvalPath,
        approvalProvenancePath,
        token: TOKEN,
        fetchImpl: productionMock.fetchImpl,
        now: () => '2026-08-11T03:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(promotion.deployment.id, NEW_DEPLOYMENT_ID)
      assert.deepEqual(promotion.deployment.aliases, REVIEWED_PRODUCTION_PROMOTED_ALIASES)
      const recovery = await recoverVercelPromotion({
        stageEvidencePath: releaseEvidence.stageEvidencePath,
        stageProvenancePath: releaseEvidence.stageProvenancePath,
        token: TOKEN,
        fetchImpl: productionMock.fetchImpl,
        now: () => '2026-08-11T03:40:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(recovery.action, 'HELD_PROMOTED')
      assert.equal(recovery.currentDeploymentId, NEW_DEPLOYMENT_ID)
      const promotionEvidencePath = join(fixture.root, 'promotion.json')
      writeFixtureFile(fixture.root, 'promotion.json', canonicalJson(promotion))
      await assert.rejects(
        rollbackVercelRelease({
          promotionEvidencePath,
          token: TOKEN,
          fetchImpl: productionMock.fetchImpl,
          now: () => '2026-08-11T03:40:00.000Z',
          delay: async () => {},
          maxPollAttempts: 3,
          pollIntervalMs: 0,
        }),
        /does not authorize rollback/i,
      )
      assert.equal(productionMock.state.currentDeploymentId, NEW_DEPLOYMENT_ID)
      assert.ok(productionMock.state.calls.some(({ url }) => url.includes(`/promote/${NEW_DEPLOYMENT_ID}`)))
      assert.equal(productionMock.state.calls.some(({ url }) => url.includes(`/rollback/${OLD_DEPLOYMENT_ID}`)), false)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('rolls a canary back when promotion succeeds but its first confirmation request fails', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        failPromotionProjectPollOnce: true,
      })
      await assert.rejects(
        runProviderCanary({
          ...CANARY_WORKFLOW_IDENTITY,
          artifactKind: 'emergency-static',
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          maximumUploadBytes: 128_000,
          token: TOKEN,
          teamId: TEAM_ID,
          projectId: CANARY_PROJECT_ID,
          projectName: 'lester-provider-canary',
          productionProjectId: PRODUCTION_PROJECT_ID,
          fetchImpl: canaryMock.fetchImpl,
          delay: async () => {},
          maxPollAttempts: 3,
          pollIntervalMs: 0,
        }),
        /routing mutation could not be confirmed/i,
      )
      assert.equal(canaryMock.state.promotionPollFailed, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
      assert.ok(canaryMock.state.calls.some(({ url }) => url.includes(`/rollback/${OLD_DEPLOYMENT_ID}`)))
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('polls an eventually consistent ambiguous canary creation and deletes the exact aliased deployment', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        failStageCreateResponseOnce: true,
        createdAliases: ['unexpected.example'],
        emptyDeploymentListsAfterCreate: 1,
      })
      await assert.rejects(
        runProviderCanary({
          ...CANARY_WORKFLOW_IDENTITY,
          artifactKind: 'emergency-static',
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          maximumUploadBytes: 128_000,
          token: TOKEN,
          teamId: TEAM_ID,
          projectId: CANARY_PROJECT_ID,
          projectName: 'lester-provider-canary',
          productionProjectId: PRODUCTION_PROJECT_ID,
          fetchImpl: canaryMock.fetchImpl,
          delay: async () => {},
          maxPollAttempts: 3,
          pollIntervalMs: 0,
        }),
        /assigned an unexpected alias/i,
      )
      assert.equal(canaryMock.state.stageCreateResponseFailed, true)
      assert.equal(canaryMock.state.deleted, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
      assert.equal(canaryMock.state.deploymentListReads, 2)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('polls an eventually consistent ambiguous production stage and deletes the exact aliased deployment', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: canaryMock.fetchImpl,
        now: () => '2026-08-11T00:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      const canaryPackage = writeCanaryPackage(fixture.root, canary)
      const productionMock = makeVercelMock({
        projectId: PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        productionAliases: ['lester-labs.com', 'www.lester-labs.com'],
        failStageCreateResponseOnce: true,
        createdAliases: ['unexpected.example'],
        emptyDeploymentListsAfterCreate: 1,
      })
      await assert.rejects(
        stageEmergencyRelease({
          ...STAGE_WORKFLOW_IDENTITY,
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          maximumUploadBytes: 128_000,
          providerCanaryEvidencePath: canaryPackage.evidencePath,
          providerCanaryProvenancePath: canaryPackage.provenancePath,
          token: TOKEN,
          teamId: TEAM_ID,
          projectId: PRODUCTION_PROJECT_ID,
          projectName: 'lester-labs',
          fetchImpl: productionMock.fetchImpl,
          now: () => '2026-08-11T01:00:00.000Z',
          delay: async () => {},
          maxPollAttempts: 3,
          pollIntervalMs: 0,
        }),
        /assigned an unexpected alias/i,
      )
      assert.equal(productionMock.state.stageCreateResponseFailed, true)
      assert.equal(productionMock.state.deleted, true)
      assert.equal(productionMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
      assert.equal(productionMock.state.deploymentListReads, 2)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('retries a transient deployment-list error while reconciling an ambiguous canary creation', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        failStageCreateResponseOnce: true,
        failDeploymentListOnce: true,
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: canaryMock.fetchImpl,
        now: () => '2026-08-11T00:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(canary.status, 'PASSED')
      assert.equal(canaryMock.state.stageCreateResponseFailed, true)
      assert.equal(canaryMock.state.deploymentListFailed, true)
      assert.equal(canaryMock.state.deploymentListReads, 2)
      assert.equal(canaryMock.state.deleted, true)
      assert.equal(canaryMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('retries a transient deployment-list error while reconciling an ambiguous production stage', async () => {
    const scenario = await prepareEmergencyPromotionScenario({
      failStageCreateResponseOnce: true,
      failDeploymentListOnce: true,
    })
    try {
      assert.equal(scenario.productionMock.state.stageCreateResponseFailed, true)
      assert.equal(scenario.productionMock.state.deploymentListFailed, true)
      assert.equal(scenario.productionMock.state.deploymentListReads, 2)
      assert.equal(scenario.productionMock.state.deleted, false)
      assert.equal(scenario.productionMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
    } finally {
      rmSync(scenario.fixture.root, { recursive: true, force: true })
    }
  })

  it('holds and confirms emergency containment when promotion is accepted but its response is lost', async () => {
    const scenario = await prepareEmergencyPromotionScenario({ failPromotionResponseOnce: true })
    try {
      const promotion = await promoteVercelRelease(scenario.promotionArguments)
      assert.equal(scenario.productionMock.state.promotionResponseFailed, true)
      assert.equal(promotion.confirmation, 'RECOVERED_AFTER_AMBIGUOUS_RESPONSE')
      assert.equal(scenario.productionMock.state.currentDeploymentId, NEW_DEPLOYMENT_ID)
      assert.equal(
        scenario.productionMock.state.calls.some(({ url }) => url.includes(`/rollback/${OLD_DEPLOYMENT_ID}`)),
        false,
      )
    } finally {
      rmSync(scenario.fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects a stale provider canary immediately before promotion without mutating production', async () => {
    const scenario = await prepareEmergencyPromotionScenario()
    try {
      const callsBefore = scenario.productionMock.state.calls.length
      await assert.rejects(
        promoteVercelRelease({
          ...scenario.promotionArguments,
          now: () => '2026-08-11T07:00:01.000Z',
        }),
        /no older than six hours/i,
      )
      assert.equal(scenario.productionMock.state.calls.length, callsBefore)
      assert.equal(scenario.productionMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
    } finally {
      rmSync(scenario.fixture.root, { recursive: true, force: true })
    }
  })

  it('recovers from a post-promotion evidence-pipeline failure by holding emergency containment', async () => {
    const scenario = await prepareEmergencyPromotionScenario()
    try {
      scenario.productionMock.state.currentDeploymentId = NEW_DEPLOYMENT_ID
      scenario.productionMock.state.phase = 'promoted'
      const recovery = await recoverVercelPromotion({
        stageEvidencePath: scenario.promotionArguments.stageEvidencePath,
        stageProvenancePath: scenario.promotionArguments.stageProvenancePath,
        token: TOKEN,
        fetchImpl: scenario.productionMock.fetchImpl,
        now: () => '2026-08-11T03:40:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(recovery.action, 'HELD_PROMOTED')
      assert.equal(recovery.currentDeploymentId, NEW_DEPLOYMENT_ID)
      assert.equal(scenario.productionMock.state.currentDeploymentId, NEW_DEPLOYMENT_ID)
      assert.equal(
        scenario.productionMock.state.calls.some(({ url }) => url.includes(`/rollback/${OLD_DEPLOYMENT_ID}`)),
        false,
      )
    } finally {
      rmSync(scenario.fixture.root, { recursive: true, force: true })
    }
  })

  it('confirms a safe full-frontend rollback when the provider accepts it but loses the response', async () => {
    const scenario = await prepareNextPromotionScenario({ failRollbackResponseOnce: true })
    try {
      const promotion = await promoteVercelRelease(scenario.promotionArguments)
      const promotionEvidencePath = join(scenario.fixture.root, 'next-promotion.json')
      writeFixtureFile(scenario.fixture.root, 'next-promotion.json', canonicalJson(promotion))
      const rollback = await rollbackVercelRelease({
        promotionEvidencePath,
        token: TOKEN,
        fetchImpl: scenario.productionMock.fetchImpl,
        now: () => '2026-08-11T03:40:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(scenario.productionMock.state.rollbackResponseFailed, true)
      assert.equal(rollback.status, 'ROLLED_BACK')
      assert.equal(rollback.rollbackDeployment.id, OLD_DEPLOYMENT_ID)
      assert.equal(scenario.productionMock.state.currentDeploymentId, OLD_DEPLOYMENT_ID)
    } finally {
      rmSync(scenario.fixture.root, { recursive: true, force: true })
    }
  })

  it('does not overwrite an unexpected concurrent production deployment during promotion recovery', async () => {
    const scenario = await prepareEmergencyPromotionScenario({ replacePromotionWithThirdDeployment: true })
    try {
      await assert.rejects(
        promoteVercelRelease(scenario.promotionArguments),
        /treat production routing as an incident/i,
      )
      assert.equal(scenario.productionMock.state.promotionSuperseded, true)
      assert.equal(scenario.productionMock.state.currentDeploymentId, THIRD_DEPLOYMENT_ID)
      assert.equal(
        scenario.productionMock.state.calls.some(({ url }) => url.includes(`/rollback/${OLD_DEPLOYMENT_ID}`)),
        false,
      )
    } finally {
      rmSync(scenario.fixture.root, { recursive: true, force: true })
    }
  })

  it('validates and canaries the approved standalone tar with the digest-pinned no-install Dockerfile', async () => {
    const fixture = createNextPackage()
    try {
      assert.match(REVIEWED_CONTAINER_DOCKERFILE, /^FROM .+@sha256:[0-9a-f]{64}$/mu)
      assert.doesNotMatch(REVIEWED_CONTAINER_DOCKERFILE, /\b(?:RUN|npm|npx|curl|wget)\b/u)
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-next-canary',
        publicRoutes: nextPublicRoutes(fixture.routeBody),
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'next-standalone-container',
        releaseDirectory: fixture.releaseDirectory,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-next-canary',
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: canaryMock.fetchImpl,
        now: () => '2026-08-11T00:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(canary.providerMode, 'vercel-container-public-beta')
      assert.deepEqual(canaryMock.state.createBody.projectSettings, {
        buildCommand: null,
        framework: 'container',
        installCommand: '',
        outputDirectory: null,
        rootDirectory: null,
      })
      assert.deepEqual(canaryMock.state.createBody.files.map(({ file }) => file), [
        'Dockerfile.vercel',
        'frontend-standalone.tar',
      ])
      const canaryPackage = writeCanaryPackage(fixture.root, canary)
      const prepared = prepareNextContainerRelease({
        releaseDirectory: fixture.releaseDirectory,
        maximumUploadBytes: 128_000,
        providerCanaryEvidencePath: canaryPackage.evidencePath,
        providerCanaryProvenancePath: canaryPackage.provenancePath,
      })
      assert.equal(prepared.artifact.sha256, sha256Bytes(fixture.archive))
      const productionMock = makeVercelMock({
        projectId: PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        publicRoutes: nextPublicRoutes(fixture.routeBody),
        productionAliases: ['lester-labs.com', 'www.lester-labs.com'],
      })
      const stage = await stageNextContainerRelease({
        ...STAGE_WORKFLOW_IDENTITY,
        ...writeSafeRollbackPackage(fixture.root),
        releaseDirectory: fixture.releaseDirectory,
        maximumUploadBytes: 128_000,
        providerCanaryEvidencePath: canaryPackage.evidencePath,
        providerCanaryProvenancePath: canaryPackage.provenancePath,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        fetchImpl: productionMock.fetchImpl,
        now: () => '2026-08-11T01:00:00.000Z',
        delay: async () => {},
        maxPollAttempts: 3,
        pollIntervalMs: 0,
      })
      assert.equal(stage.artifactKind, 'next-standalone-container')
      assert.equal(stage.projectSettings.framework, 'container')
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects tar traversal, tampering, missing canary evidence, and upload-cap violations locally', () => {
    const traversal = createTar([{ path: '../escape', bytes: Buffer.from('x') }])
    assert.throws(() => inspectTarArchive(traversal), /unsafe/i)
    const fixture = createEmergencyPackage()
    try {
      const tarPath = join(fixture.releaseDirectory, 'emergency-containment.tar')
      const changed = Buffer.from(readFileSync(tarPath))
      changed[600] ^= 1
      writeFileSync(tarPath, changed)
      assert.throws(
        () => prepareEmergencyRelease({
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          releaseProfile: RELEASE_PROFILE,
          maximumUploadBytes: 128_000,
        }),
        /tar|canary/i,
      )
      assert.throws(
        () => prepareEmergencyRelease({
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          releaseProfile: RELEASE_PROFILE,
          maximumUploadBytes: 1,
        }),
        /byte limit|empty|cap/i,
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('fails project preflight before uploads and never exposes an API error body', async () => {
    const fixture = createEmergencyPackage()
    try {
      const bootstrapMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: bootstrapMock.fetchImpl,
        now: () => '2026-08-11T00:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 2,
        pollIntervalMs: 0,
      })
      const canaryPackage = writeCanaryPackage(fixture.root, canary)
      const unsafeMock = makeVercelMock({
        projectId: PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        autoAssignCustomDomains: true,
      })
      await assert.rejects(
        stageEmergencyRelease({
          ...STAGE_WORKFLOW_IDENTITY,
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          maximumUploadBytes: 128_000,
          providerCanaryEvidencePath: canaryPackage.evidencePath,
          providerCanaryProvenancePath: canaryPackage.provenancePath,
          token: TOKEN,
          teamId: TEAM_ID,
          projectId: PRODUCTION_PROJECT_ID,
          projectName: 'lester-labs',
          fetchImpl: unsafeMock.fetchImpl,
          delay: async () => {},
          maxPollAttempts: 2,
          pollIntervalMs: 0,
        }),
        /auto-assignment/i,
      )
      assert.equal(unsafeMock.state.calls.some(({ url }) => url.includes('/v2/files')), false)

      const secretMarker = 'provider-response-secret-marker'
      const errorMock = makeVercelMock({
        projectId: PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        errorBody: `{"secret":"${secretMarker}"}`,
      })
      await assert.rejects(
        stageEmergencyRelease({
          ...STAGE_WORKFLOW_IDENTITY,
          releaseDirectory: fixture.releaseDirectory,
          sourceDirectory: fixture.sourceDirectory,
          sourceCommit: SOURCE_COMMIT,
          maximumUploadBytes: 128_000,
          providerCanaryEvidencePath: canaryPackage.evidencePath,
          providerCanaryProvenancePath: canaryPackage.provenancePath,
          token: TOKEN,
          teamId: TEAM_ID,
          projectId: PRODUCTION_PROJECT_ID,
          projectName: 'lester-labs',
          fetchImpl: errorMock.fetchImpl,
          delay: async () => {},
          maxPollAttempts: 2,
          pollIntervalMs: 0,
        }),
        (error) => !error.message.includes(secretMarker) && /status 500/i.test(error.message),
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects parity or approval rebinding before the promotion endpoint is called', async () => {
    const fixture = createEmergencyPackage()
    try {
      const canaryMock = makeVercelMock({
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
      })
      const canary = await runProviderCanary({
        ...CANARY_WORKFLOW_IDENTITY,
        artifactKind: 'emergency-static',
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: CANARY_PROJECT_ID,
        projectName: 'lester-provider-canary',
        productionProjectId: PRODUCTION_PROJECT_ID,
        fetchImpl: canaryMock.fetchImpl,
        now: () => '2026-08-11T00:30:00.000Z',
        delay: async () => {},
        maxPollAttempts: 2,
        pollIntervalMs: 0,
      })
      const canaryPackage = writeCanaryPackage(fixture.root, canary)
      const productionMock = makeVercelMock({
        projectId: PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        publicRoutes: emergencyPublicRoutes(fixture.sourceDirectory),
        productionAliases: ['lester-labs.com', 'www.lester-labs.com'],
      })
      const stage = await stageEmergencyRelease({
        ...STAGE_WORKFLOW_IDENTITY,
        releaseDirectory: fixture.releaseDirectory,
        sourceDirectory: fixture.sourceDirectory,
        sourceCommit: SOURCE_COMMIT,
        maximumUploadBytes: 128_000,
        providerCanaryEvidencePath: canaryPackage.evidencePath,
        providerCanaryProvenancePath: canaryPackage.provenancePath,
        token: TOKEN,
        teamId: TEAM_ID,
        projectId: PRODUCTION_PROJECT_ID,
        projectName: 'lester-labs',
        fetchImpl: productionMock.fetchImpl,
        now: () => '2026-08-11T01:00:00.000Z',
        delay: async () => {},
        maxPollAttempts: 2,
        pollIntervalMs: 0,
      })
      const evidence = writeStageAndParity(fixture.root, stage)
      const tamperedParity = structuredClone(evidence.parity)
      tamperedParity.deploymentId = OLD_DEPLOYMENT_ID
      const tamperedPayload = structuredClone(tamperedParity)
      delete tamperedPayload.evidenceSha256
      tamperedParity.evidenceSha256 = sha256Canonical(tamperedPayload)
      writeFileSync(evidence.parityEvidencePath, canonicalJson(tamperedParity))
      assert.throws(() => validateStagedParityEvidence(tamperedParity, stage), /exact staged release/i)
      const callsBefore = productionMock.state.calls.length
      await assert.rejects(
        promoteVercelRelease({
          ...evidence,
          approvalPath: join(fixture.root, 'missing-approval.json'),
          approvalProvenancePath: join(fixture.root, 'missing-approval.provenance.jsonl'),
          token: TOKEN,
          fetchImpl: productionMock.fetchImpl,
          now: () => '2026-08-11T03:30:00.000Z',
          delay: async () => {},
          maxPollAttempts: 2,
          pollIntervalMs: 0,
        }),
      )
      assert.equal(productionMock.state.calls.length, callsBefore)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})
