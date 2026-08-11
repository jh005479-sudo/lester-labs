import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getContractAddress } from 'viem'

import {
  DEPLOYMENTS,
  LEGACY_ADDRESSES,
  LEGACY_RUNTIME_HASHES,
  REVIEWED_PARAMETERS,
  canonicalApprovalPayloadSha256,
  canonicalIndependentReplacementVerificationSha256,
  canonicalManifestSha256,
  verifyApprovedPublicReplacementPackage,
} from '../../scripts/security/verify-approved-public-replacement.mjs'
import { assertExactApprovedPublicReplacementPackageShape } from '../config/contracts.ts'
import {
  REDACTED_EVIDENCE_BUNDLE_FILE,
  REQUIRED_CONTROL_PLANES,
  REQUIRED_CREDENTIAL_TYPES,
  controlPlaneClaimSetSha256,
} from '../../scripts/security/verify-control-plane-recovery.mjs'

const HASH_A = `0x${'11'.repeat(32)}`
const HASH_B = `0x${'22'.repeat(32)}`
const CONTROLLER = '0x1000000000000000000000000000000000000001'
const TREASURY = '0x2000000000000000000000000000000000000002'
const GAS_ONLY_DEPLOYER = '0x3000000000000000000000000000000000000003'
const SAFE_IMPLEMENTATION = '0x4000000000000000000000000000000000000004'
const SAFE_FACTORY = '0x4100000000000000000000000000000000000004'
const CONTROLLER_CREATION_TRANSACTION = `0x${'81'.repeat(32)}`
const TREASURY_CREATION_TRANSACTION = `0x${'82'.repeat(32)}`
const CONTROLLER_CREATION_BLOCK_HASH = `0x${'83'.repeat(32)}`
const TREASURY_CREATION_BLOCK_HASH = `0x${'84'.repeat(32)}`
const CONTROLLER_OWNERS = [
  '0x5000000000000000000000000000000000000005',
  '0x6000000000000000000000000000000000000006',
]
const TREASURY_OWNERS = [
  '0x8000000000000000000000000000000000000008',
  '0x9000000000000000000000000000000000000009',
]
const SAFE_PROXY_RUNTIME_HASH = '0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c'
const SAFE_IMPLEMENTATION_RUNTIME_HASH = '0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff'
const AUTHORITY_VERIFICATION_BLOCK_TIMESTAMP = Date.parse('2026-08-10T20:02:00Z') / 1_000
const AUTHORITY_CREATION_BLOCK_TIMESTAMP = Date.parse('2026-08-10T19:59:00Z') / 1_000
const AUTHORITY_REVIEW_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const CONTROL_PLANE_TEST_NOW = new Date('2026-08-10T21:30:00Z')
const REVIEWERS = [
  {
    identity: '@incident-lead',
    role: 'Incident lead',
    decision: 'APPROVE',
    approvedAt: '2026-08-10T20:30:00Z',
    evidenceSha256: `sha256:${'51'.repeat(32)}`,
  },
  {
    identity: '@independent-reviewer',
    role: 'Independent security reviewer',
    decision: 'APPROVE',
    approvedAt: '2026-08-10T20:31:00Z',
    evidenceSha256: `sha256:${'52'.repeat(32)}`,
  },
]

function rawSha256(filePath) {
  return `0x${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`
}

function rawEvidenceSha256(filePath) {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`
}

function credentialDisposition(systemName) {
  return Object.fromEntries(REQUIRED_CREDENTIAL_TYPES[systemName].map((credentialType, index) => [
    credentialType,
    index === 0 ? 'ROTATED' : 'REVIEWED_NOT_PRESENT',
  ]))
}

function writeReviewedSourceEvidence(directory) {
  const productionAuthorities = join(directory, 'production-authorities.json')
  const controlPlaneRecovery = join(directory, 'control-plane-recovery.json')
  const reviewedAuthority = (
    address,
    owners,
    transactionHash,
    blockNumber,
    blockHash,
    saltNonce,
  ) => ({
    address,
    deployment: {
      factoryAddress: SAFE_FACTORY,
      transactionHash,
      blockNumber,
      blockHash,
      saltNonce,
    },
    safeVersion: '1.4.1',
    proxy: {
      kind: 'safe-proxy-storage-slot-0',
      runtimeCodeHash: SAFE_PROXY_RUNTIME_HASH,
      implementationStorageSlot: `0x${'00'.repeat(32)}`,
      implementationAddress: SAFE_IMPLEMENTATION,
      implementationRuntimeCodeHash: SAFE_IMPLEMENTATION_RUNTIME_HASH,
      sourceRepository: 'https://github.com/safe-fndn/safe-smart-account',
      sourceRelease: 'v1.4.1',
      sourceCommit: 'bf943f80fec5ac647159d26161446ac5d716a294',
    },
    owners,
    threshold: 2,
    enabledModules: [],
    guard: { mode: 'none' },
    fallbackHandler: { mode: 'none' },
  })
  writeFileSync(productionAuthorities, `${JSON.stringify({
    kind: 'lester-labs-production-authority-inventory',
    schemaVersion: 1,
    status: 'REVIEWED_FOR_PRODUCTION',
    chainId: '4441',
    review: {
      approvals: [
        {
          reviewer: 'authority-reviewer-one@example.invalid',
          approvedAt: '2026-08-10T20:00:00Z',
          evidenceSha256: `0x${'66'.repeat(32)}`,
        },
        {
          reviewer: 'authority-reviewer-two@example.invalid',
          approvedAt: '2026-08-10T20:01:00Z',
          evidenceSha256: `0x${'77'.repeat(32)}`,
        },
      ],
    },
    controller: reviewedAuthority(
      CONTROLLER,
      CONTROLLER_OWNERS,
      CONTROLLER_CREATION_TRANSACTION,
      90,
      CONTROLLER_CREATION_BLOCK_HASH,
      '101',
    ),
    treasury: reviewedAuthority(
      TREASURY,
      TREASURY_OWNERS,
      TREASURY_CREATION_TRANSACTION,
      91,
      TREASURY_CREATION_BLOCK_HASH,
      '102',
    ),
  }, null, 2)}\n`)
  const systems = Object.fromEntries(REQUIRED_CONTROL_PLANES.map((name, index) => [name, {
    provider: `Reviewed ${name} provider`,
    accountReference: `redacted:${name}-account`,
    reviewedAt: `2026-08-10T20:0${index}:00Z`,
    sessionDisposition: 'REVOKED_ALL',
    credentialDisposition: credentialDisposition(name),
    accessReviewed: true,
    integrationsReviewed: true,
    configurationReviewed: true,
    auditLogSha256: `sha256:${String(30 + index).repeat(64).slice(0, 64)}`,
    findings: [],
    residualRisks: [],
    approvedBy: REVIEWERS.map((reviewer) => reviewer.identity),
  }]))
  const recovery = {
    status: 'REVIEWED',
    schemaVersion: 2,
    caseId: 'LL-INCIDENT-TEST',
    incidentDetectedAt: '2026-08-10T18:00:00Z',
    reviewedAt: '2026-08-10T21:00:00Z',
    reviewValidUntil: '2026-08-12T21:00:00Z',
    evidenceBundleSha256: `sha256:${'44'.repeat(32)}`,
    redactedEvidenceBundlePath: REDACTED_EVIDENCE_BUNDLE_FILE,
    redactedEvidenceBundleSha256: `sha256:${'ff'.repeat(32)}`,
    reviewers: REVIEWERS,
    systems,
  }
  const redactedEvidenceBundle = join(directory, REDACTED_EVIDENCE_BUNDLE_FILE)
  writeFileSync(redactedEvidenceBundle, `${JSON.stringify({
    kind: 'lester-labs-control-plane-redacted-evidence-bundle',
    schemaVersion: 1,
    caseId: recovery.caseId,
    generatedAt: recovery.reviewedAt,
    claimSetSha256: controlPlaneClaimSetSha256(recovery),
    externalEvidenceBundleSha256: recovery.evidenceBundleSha256,
    systemAuditLogSha256: Object.fromEntries(REQUIRED_CONTROL_PLANES.map((systemName) => [
      systemName,
      recovery.systems[systemName].auditLogSha256,
    ])),
    reviewerEvidence: recovery.reviewers.map((reviewer) => ({
      identity: reviewer.identity,
      role: reviewer.role,
      approvedAt: reviewer.approvedAt,
      evidenceSha256: reviewer.evidenceSha256,
    })),
  }, null, 2)}\n`)
  recovery.redactedEvidenceBundleSha256 = rawEvidenceSha256(redactedEvidenceBundle)
  writeFileSync(controlPlaneRecovery, `${JSON.stringify(recovery, null, 2)}\n`)
  return {
    paths: { productionAuthorities, controlPlaneRecovery, now: CONTROL_PLANE_TEST_NOW },
    digests: {
      productionAuthoritiesRawSha256: rawSha256(productionAuthorities),
      controlPlaneRecoveryRawSha256: rawSha256(controlPlaneRecovery),
    },
  }
}

function verifiedSafe(
  address,
  implementationAddress,
  owners,
  deploymentTransactionHash,
  deploymentBlockNumber,
  deploymentBlockHash,
  saltNonce,
) {
  return {
    address,
    factoryAddress: SAFE_FACTORY,
    deploymentTransactionHash,
    deploymentBlockNumber,
    deploymentBlockHash,
    deploymentBlockTimestamp: AUTHORITY_CREATION_BLOCK_TIMESTAMP,
    saltNonce,
    proxyRuntimeCodeHash: SAFE_PROXY_RUNTIME_HASH,
    implementationAddress,
    implementationRuntimeCodeHash: SAFE_IMPLEMENTATION_RUNTIME_HASH,
    safeVersion: '1.4.1',
    owners,
    threshold: 2,
    nonce: 0,
    enabledModules: [],
    guard: '0x0000000000000000000000000000000000000000',
    fallbackHandler: '0x0000000000000000000000000000000000000000',
    benignSafeReceivedLogCount: 0,
  }
}

function makeApprovedFixture(sourceDigests = {
  productionAuthoritiesRawSha256: HASH_A,
  controlPlaneRecoveryRawSha256: HASH_B,
}) {
  const deploymentManifest = {
    kind: 'lester-labs-post-compromise-replacement',
    schemaVersion: 2,
    chainId: '4441',
    deploymentProfile: 'production-separated-authority',
    controller: CONTROLLER,
    treasury: TREASURY,
    parameters: { ...REVIEWED_PARAMETERS },
    planHash: HASH_A,
    buildAttestationSha256: HASH_A,
    buildSourceCommit: '1'.repeat(40),
    gasOnlyDeployer: GAS_ONLY_DEPLOYER,
    startingNonce: 0,
    confirmations: 1,
    legacyRecovery: {
      addresses: { ...LEGACY_ADDRESSES },
      runtimeCodeHashes: { ...LEGACY_RUNTIME_HASHES },
      iloFactoryProvenance: [
        {
          label: 'production-build-hidden-factory',
          address: LEGACY_ADDRESSES.productionBuildIloFactory,
          runtimeCodeHash: LEGACY_RUNTIME_HASHES.productionBuildIloFactory,
          observedChildCount: '8330',
          observedOn: '2026-08-04',
        },
        {
          label: 'canonical-legacy-factory',
          address: LEGACY_ADDRESSES.iloFactory,
          runtimeCodeHash: LEGACY_RUNTIME_HASHES.iloFactory,
          observedChildCount: '121',
          observedOn: '2026-08-04',
        },
      ],
    },
    deployments: DEPLOYMENTS.map(([name, artifact], nonce) => ({
      name,
      artifact,
      address: getContractAddress({ from: GAS_ONLY_DEPLOYER, nonce: BigInt(nonce) }),
      nonce,
      transactionHash: `0x${(nonce + 1).toString(16).padStart(64, '0')}`,
      blockNumber: nonce + 100,
      runtimeCodeHash: HASH_A,
      runtimeCodeBytes: 1,
    })),
    verifiedAtBlock: 112,
  }
  const deploymentManifestSha256 = canonicalManifestSha256(deploymentManifest)
  const productionAuthorityVerification = {
    inventorySha256: sourceDigests.productionAuthoritiesRawSha256,
    chainId: '4441',
    blockNumber: 123,
    blockHash: HASH_A,
    blockTimestamp: AUTHORITY_VERIFICATION_BLOCK_TIMESTAMP,
    authorityReviewMaxAgeSeconds: AUTHORITY_REVIEW_MAX_AGE_SECONDS,
    gasOnlyDeployer: GAS_ONLY_DEPLOYER,
    controller: verifiedSafe(
      CONTROLLER,
      SAFE_IMPLEMENTATION,
      CONTROLLER_OWNERS,
      CONTROLLER_CREATION_TRANSACTION,
      90,
      CONTROLLER_CREATION_BLOCK_HASH,
      '101',
    ),
    treasury: verifiedSafe(
      TREASURY,
      SAFE_IMPLEMENTATION,
      TREASURY_OWNERS,
      TREASURY_CREATION_TRANSACTION,
      91,
      TREASURY_CREATION_BLOCK_HASH,
      '102',
    ),
  }
  const replacementCountersAtCutover = {
    tokensMinted: 0,
    walletsAirdropped: 0,
    presalesCreated: 0,
    swapsCompleted: 0,
    onChainMessages: 0,
  }
  const independentReplacementVerificationPayload = {
    status: 'VERIFIED_INDEPENDENT_RPC',
    primaryRpcOrigin: 'https://primary-rpc.example',
    rpcUrl: 'https://independent-rpc.example/liteforge',
    chainId: '4441',
    blockNumber: 123,
    blockHash: HASH_A,
    deploymentManifestSha256,
    verifiedChecks: [
      'source-and-build-attestation',
      'legacy-runtime-anchors',
      'deployment-transactions-and-receipts',
      'replacement-runtime-code-and-byte-lengths',
      'constructor-parameters-and-role-bindings',
      'production-safe-creation-history-and-owner-eoas',
      'production-safe-authorities',
      'zero-replacement-counters-at-cutover',
    ],
    productionAuthorityVerification: structuredClone(productionAuthorityVerification),
    replacementCountersAtCutover: { ...replacementCountersAtCutover },
  }
  const independentReplacementVerification = {
    reportSha256: canonicalIndependentReplacementVerificationSha256(
      independentReplacementVerificationPayload,
    ),
    ...independentReplacementVerificationPayload,
  }
  const value = {
    status: 'APPROVED',
    approvalPayloadSha256: '',
    deploymentManifestSha256,
    deploymentManifest,
    frontendRuntimeAttestations: {
      uniswapV2Pair: HASH_A,
      vestingWallet: {
        normalizedRuntimeCodeHash: HASH_B,
        runtimeCodeBytes: 96,
        immutableReferences: [{ start: 12, length: 32 }],
      },
      iloChild: HASH_B,
    },
    sourceEvidence: {
      ...sourceDigests,
      productionAuthorityVerification,
      independentReplacementVerification,
    },
    activityCutover: {
      throughBlock: 123,
      blockHash: HASH_A,
      totals: {
        tokensMinted: 1,
        walletsAirdropped: 2,
        presalesCreated: 3,
        swapsCompleted: 4,
        onChainMessages: 5,
      },
      independentSecondRpc: {
        candidateRawSha256: HASH_A,
        candidatePayloadSha256: HASH_B,
        proofRawSha256: `0x${'33'.repeat(32)}`,
        rpcUrl: 'https://independent-rpc.example/liteforge',
      },
      replacementCountersAtCutover,
    },
    reviewerApprovals: [],
  }
  value.approvalPayloadSha256 = canonicalApprovalPayloadSha256(value)
  value.reviewerApprovals = [
    {
      reviewer: '@source-reviewer',
      reviewRole: 'source-security',
      approvalPayloadSha256: value.approvalPayloadSha256,
      evidenceSha256: `0x${'44'.repeat(32)}`,
      approvedAt: '2026-08-10T20:00:00.000Z',
    },
    {
      reviewer: '@release-reviewer',
      reviewRole: 'release-operations',
      approvalPayloadSha256: value.approvalPayloadSha256,
      evidenceSha256: `0x${'55'.repeat(32)}`,
      approvedAt: '2026-08-10T20:01:00.000Z',
    },
  ]
  return value
}

describe('approved public replacement package', () => {
  it('keeps the checked-in sentinel fail-closed until production evidence exists', () => {
    assert.deepEqual(verifyApprovedPublicReplacementPackage(), { status: 'NOT_APPROVED' })
  })

  it('uses deterministic pretty-JSON plus newline for manifest evidence digests', () => {
    assert.equal(
      canonicalManifestSha256({ chainId: '4441', deployments: [] }),
      '0x6553d327a2343b1b72eae66be28953c8f9bb4efa538cfb3e3c2001119067ac7c',
    )
  })

  it('keeps the exporter on canonical live verification and a fail-closed two-pass review', () => {
    const exporter = readFileSync(
      new URL('../../contracts/scripts/export_public_frontend_replacement.ts', import.meta.url),
      'utf8',
    )
    assert.match(exporter, /requirePlatformActivityCutoverCandidate\(activity\)/)
    assert.match(exporter, /verifyPlatformActivityCutoverCandidate\([\s\S]*createJsonRpcReader\(secondRpcUrl\)/)
    assert.match(exporter, /verifyReplacementManifest\(manifest, ethers, independentProvider\)/)
    assert.match(exporter, /verifySourcePinnedProductionAuthorities\([\s\S]*blockNumber: activity\.throughBlock/)
    assert.match(exporter, /verifyControlPlaneRecoveryEvidence\([\s\S]*requireReviewed: true/)
    assert.match(exporter, /productionAuthorityVerification/)
    assert.match(exporter, /independentReplacementVerificationPayload/)
    assert.match(exporter, /reportSha256: canonicalApprovalPayloadSha256\(independentReplacementVerificationPayload\)/)
    assert.match(exporter, /Primary and independent replacement verification RPC origins must be distinct/)
    assert.match(exporter, /swapCount !== 0n[\s\S]*recipientEntries !== 0n[\s\S]*messageCount !== 0n[\s\S]*iloCount !== 0n/)
    assert.match(exporter, /status: reviewerApprovalsPath \? "APPROVED" : "CANDIDATE"/)
    assert.doesNotMatch(exporter, /Number\((?:recipientEntries|swapCount|messageCount|iloCount)\)/)
  })

  it('binds child-runtime attestations, cutover identity, and baseline totals into one digest', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lester-public-approval-'))
    const packagePath = join(directory, 'approved.json')
    try {
      const source = writeReviewedSourceEvidence(directory)
      const approved = makeApprovedFixture(source.digests)
      writeFileSync(packagePath, `${JSON.stringify(approved, null, 2)}\n`)
      assert.deepEqual(verifyApprovedPublicReplacementPackage(packagePath, source.paths), {
        status: 'APPROVED',
        approvalPayloadSha256: approved.approvalPayloadSha256,
        deploymentManifestSha256: approved.deploymentManifestSha256,
      })

      const mutations = [
        (value) => { value.frontendRuntimeAttestations.uniswapV2Pair = HASH_B },
        (value) => { value.frontendRuntimeAttestations.vestingWallet.immutableReferences[0].start = 13 },
        (value) => { value.activityCutover.throughBlock = 124 },
        (value) => { value.activityCutover.totals.tokensMinted = 2 },
      ]
      for (const mutate of mutations) {
        const altered = structuredClone(approved)
        mutate(altered)
        writeFileSync(packagePath, `${JSON.stringify(altered, null, 2)}\n`)
        assert.throws(
          () => verifyApprovedPublicReplacementPackage(packagePath, source.paths),
          /public replacement payload digest|authority verification is not bound/i,
        )
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects omitted or unreviewed nested approval fields before address activation', () => {
    const approved = makeApprovedFixture()
    assert.doesNotThrow(() => assertExactApprovedPublicReplacementPackageShape(approved))

    const mutations = [
      (value) => { value.deploymentManifest.unreviewed = true },
      (value) => { delete value.deploymentManifest.legacyRecovery },
      (value) => { value.deploymentManifest.deployments[0].extra = 'redirect' },
      (value) => { value.frontendRuntimeAttestations.vestingWallet.immutableReferences[0].extra = 1 },
      (value) => { value.activityCutover.totals.unreviewed = 1 },
      (value) => { value.sourceEvidence.productionAuthorityVerification.controller.unreviewed = true },
      (value) => { delete value.sourceEvidence.productionAuthorityVerification.blockTimestamp },
      (value) => { delete value.sourceEvidence.productionAuthorityVerification.controller.deploymentBlockTimestamp },
      (value) => { delete value.sourceEvidence.productionAuthorityVerification.treasury.benignSafeReceivedLogCount },
      (value) => { value.sourceEvidence.independentReplacementVerification.unreviewed = true },
      (value) => {
        value.sourceEvidence.independentReplacementVerification.productionAuthorityVerification.controller.unreviewed = true
      },
      (value) => { value.reviewerApprovals[0].unreviewed = true },
    ]
    for (const mutate of mutations) {
      const altered = structuredClone(approved)
      mutate(altered)
      assert.throws(
        () => assertExactApprovedPublicReplacementPackageShape(altered),
        /exactly the reviewed fields|legacy-recovery inventory/i,
      )
    }
  })

  it('rejects duplicate reviewers, mismatched approvals, changed source evidence, and nonzero replacement counters', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lester-public-reviewers-'))
    const packagePath = join(directory, 'approved.json')
    try {
      const source = writeReviewedSourceEvidence(directory)
      const writeAndVerify = (value, pattern) => {
        writeFileSync(packagePath, `${JSON.stringify(value, null, 2)}\n`)
        assert.throws(
          () => verifyApprovedPublicReplacementPackage(packagePath, source.paths),
          pattern,
        )
      }
      const rehash = (value) => {
        value.approvalPayloadSha256 = canonicalApprovalPayloadSha256(value)
        for (const approval of value.reviewerApprovals) {
          approval.approvalPayloadSha256 = value.approvalPayloadSha256
        }
      }

      const duplicateReviewer = makeApprovedFixture(source.digests)
      duplicateReviewer.reviewerApprovals[1].reviewer = duplicateReviewer.reviewerApprovals[0].reviewer
      writeAndVerify(duplicateReviewer, /distinct reviewers/i)

      const duplicateEvidence = makeApprovedFixture(source.digests)
      duplicateEvidence.reviewerApprovals[1].evidenceSha256 = duplicateEvidence.reviewerApprovals[0].evidenceSha256
      writeAndVerify(duplicateEvidence, /distinct reviewers.*evidence|distinct evidence/i)

      const mismatchedApproval = makeApprovedFixture(source.digests)
      mismatchedApproval.reviewerApprovals[0].approvalPayloadSha256 = HASH_A
      writeAndVerify(mismatchedApproval, /bind the exact approval payload/i)

      const nonzeroReplacement = makeApprovedFixture(source.digests)
      nonzeroReplacement.activityCutover.replacementCountersAtCutover.swapsCompleted = 1
      rehash(nonzeroReplacement)
      writeAndVerify(nonzeroReplacement, /every replacement activity counter.*zero/i)

      const wrongAuthorityBlock = makeApprovedFixture(source.digests)
      wrongAuthorityBlock.sourceEvidence.productionAuthorityVerification.blockNumber -= 1
      rehash(wrongAuthorityBlock)
      writeAndVerify(wrongAuthorityBlock, /authority verification is not bound/i)

      const wrongAuthorityReviewWindow = makeApprovedFixture(source.digests)
      wrongAuthorityReviewWindow.sourceEvidence.productionAuthorityVerification.authorityReviewMaxAgeSeconds = 1
      wrongAuthorityReviewWindow.sourceEvidence.independentReplacementVerification
        .productionAuthorityVerification.authorityReviewMaxAgeSeconds = 1
      wrongAuthorityReviewWindow.sourceEvidence.independentReplacementVerification.reportSha256 =
        canonicalIndependentReplacementVerificationSha256(
          wrongAuthorityReviewWindow.sourceEvidence.independentReplacementVerification,
        )
      rehash(wrongAuthorityReviewWindow)
      writeAndVerify(wrongAuthorityReviewWindow, /authority verification is not bound/i)

      const preCreationApproval = makeApprovedFixture(source.digests)
      for (const verification of [
        preCreationApproval.sourceEvidence.productionAuthorityVerification,
        preCreationApproval.sourceEvidence.independentReplacementVerification.productionAuthorityVerification,
      ]) {
        verification.controller.deploymentBlockTimestamp = Date.parse('2026-08-10T20:01:30Z') / 1_000
        verification.treasury.deploymentBlockTimestamp = Date.parse('2026-08-10T20:01:30Z') / 1_000
      }
      preCreationApproval.sourceEvidence.independentReplacementVerification.reportSha256 =
        canonicalIndependentReplacementVerificationSha256(
          preCreationApproval.sourceEvidence.independentReplacementVerification,
        )
      rehash(preCreationApproval)
      writeAndVerify(preCreationApproval, /fresh post-creation authority approvals/i)

      const invalidBenignLogCount = makeApprovedFixture(source.digests)
      invalidBenignLogCount.sourceEvidence.productionAuthorityVerification.controller.benignSafeReceivedLogCount = -1
      invalidBenignLogCount.sourceEvidence.independentReplacementVerification
        .productionAuthorityVerification.controller.benignSafeReceivedLogCount = -1
      invalidBenignLogCount.sourceEvidence.independentReplacementVerification.reportSha256 =
        canonicalIndependentReplacementVerificationSha256(
          invalidBenignLogCount.sourceEvidence.independentReplacementVerification,
        )
      rehash(invalidBenignLogCount)
      writeAndVerify(invalidBenignLogCount, /Safe facts are invalid/i)

      const expiredControlPlane = makeApprovedFixture(source.digests)
      writeFileSync(packagePath, `${JSON.stringify(expiredControlPlane, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath, {
          ...source.paths,
          now: new Date('2026-08-13T21:00:01Z'),
        }),
        /control-plane recovery review has expired/i,
      )

      const wrongSourceDigest = makeApprovedFixture(source.digests)
      wrongSourceDigest.sourceEvidence.productionAuthoritiesRawSha256 = HASH_A
      wrongSourceDigest.sourceEvidence.productionAuthorityVerification.inventorySha256 = HASH_A
      wrongSourceDigest.sourceEvidence.independentReplacementVerification
        .productionAuthorityVerification.inventorySha256 = HASH_A
      wrongSourceDigest.sourceEvidence.independentReplacementVerification.reportSha256 =
        canonicalIndependentReplacementVerificationSha256(
          wrongSourceDigest.sourceEvidence.independentReplacementVerification,
        )
      rehash(wrongSourceDigest)
      writeAndVerify(wrongSourceDigest, /authority inventory digest/i)

      const alteredIndependentReport = makeApprovedFixture(source.digests)
      alteredIndependentReport.sourceEvidence.independentReplacementVerification.verifiedChecks[0] =
        'unreviewed-check'
      rehash(alteredIndependentReport)
      writeAndVerify(alteredIndependentReport, /independent replacement verification report/i)

      const staleIndependentReportDigest = makeApprovedFixture(source.digests)
      staleIndependentReportDigest.sourceEvidence.independentReplacementVerification.primaryRpcOrigin =
        'https://other-primary-rpc.example'
      rehash(staleIndependentReportDigest)
      writeAndVerify(staleIndependentReportDigest, /verification report digest/i)

      const sameRpcOrigin = makeApprovedFixture(source.digests)
      sameRpcOrigin.sourceEvidence.independentReplacementVerification.primaryRpcOrigin =
        'https://independent-rpc.example'
      sameRpcOrigin.sourceEvidence.independentReplacementVerification.reportSha256 =
        canonicalIndependentReplacementVerificationSha256(
          sameRpcOrigin.sourceEvidence.independentReplacementVerification,
        )
      rehash(sameRpcOrigin)
      writeAndVerify(sameRpcOrigin, /distinct-rpc manifest|distinct reviewed HTTPS RPC origins/i)

      const contradictorySafe = makeApprovedFixture(source.digests)
      contradictorySafe.sourceEvidence.productionAuthorityVerification.controller.owners.reverse()
      contradictorySafe.sourceEvidence.independentReplacementVerification
        .productionAuthorityVerification.controller.owners.reverse()
      contradictorySafe.sourceEvidence.independentReplacementVerification.reportSha256 =
        canonicalIndependentReplacementVerificationSha256(
          contradictorySafe.sourceEvidence.independentReplacementVerification,
        )
      rehash(contradictorySafe)
      writeAndVerify(contradictorySafe, /contradict.*reviewed authority inventory/i)

      const contradictoryCreation = makeApprovedFixture(source.digests)
      const substitutedFactory = '0x4200000000000000000000000000000000000004'
      contradictoryCreation.sourceEvidence.productionAuthorityVerification.controller.factoryAddress =
        substitutedFactory
      contradictoryCreation.sourceEvidence.productionAuthorityVerification.treasury.factoryAddress =
        substitutedFactory
      contradictoryCreation.sourceEvidence.independentReplacementVerification
        .productionAuthorityVerification.controller.factoryAddress = substitutedFactory
      contradictoryCreation.sourceEvidence.independentReplacementVerification
        .productionAuthorityVerification.treasury.factoryAddress = substitutedFactory
      contradictoryCreation.sourceEvidence.independentReplacementVerification.reportSha256 =
        canonicalIndependentReplacementVerificationSha256(
          contradictoryCreation.sourceEvidence.independentReplacementVerification,
        )
      rehash(contradictoryCreation)
      writeAndVerify(contradictoryCreation, /contradict.*reviewed authority inventory/i)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects fully rehashed malformed and disposable packages in the standalone release gate', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lester-public-semantics-'))
    const packagePath = join(directory, 'approved.json')
    const rehash = (value) => {
      value.deploymentManifestSha256 = canonicalManifestSha256(value.deploymentManifest)
      value.approvalPayloadSha256 = canonicalApprovalPayloadSha256(value)
      value.reviewerApprovals.forEach((approval) => {
        approval.approvalPayloadSha256 = value.approvalPayloadSha256
      })
    }
    try {
      const source = writeReviewedSourceEvidence(directory)
      const malformed = makeApprovedFixture(source.digests)
      malformed.deploymentManifest.deployments[0].extra = 'unreviewed'
      rehash(malformed)
      writeFileSync(packagePath, `${JSON.stringify(malformed, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath, source.paths),
        /exactly the reviewed fields/i,
      )

      const disposable = makeApprovedFixture(source.digests)
      disposable.deploymentManifest.deploymentProfile = 'testnet-immutable-disposable'
      disposable.deploymentManifest.controller = '0x0000000000000000000000000000000000000001'
      disposable.deploymentManifest.treasury = '0x439945924515218061b644901a31aC4A6c00957c'
      disposable.deploymentManifest.gasOnlyDeployer = disposable.deploymentManifest.treasury
      disposable.deploymentManifest.deployments.forEach((deployment, nonce) => {
        deployment.address = getContractAddress({
          from: disposable.deploymentManifest.gasOnlyDeployer,
          nonce: BigInt(nonce),
        })
      })
      rehash(disposable)
      writeFileSync(packagePath, `${JSON.stringify(disposable, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath, source.paths),
        /production-separated-authority/i,
      )

      for (const rejectedAddress of [
        '0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28',
        '0x439945924515218061b644901a31aC4A6c00957c',
      ]) {
        for (const role of ['controller', 'treasury', 'gasOnlyDeployer']) {
          const rejectedRole = makeApprovedFixture(source.digests)
          rejectedRole.deploymentManifest[role] = rejectedAddress
          rehash(rejectedRole)
          writeFileSync(packagePath, `${JSON.stringify(rejectedRole, null, 2)}\n`)
          assert.throws(
            () => verifyApprovedPublicReplacementPackage(packagePath, source.paths),
            /distinct fresh addresses/i,
          )
        }
      }

      const zeroRole = makeApprovedFixture(source.digests)
      zeroRole.deploymentManifest.controller = '0x0000000000000000000000000000000000000000'
      rehash(zeroRole)
      writeFileSync(packagePath, `${JSON.stringify(zeroRole, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath, source.paths),
        /distinct fresh addresses/i,
      )

      const recasedLegacy = makeApprovedFixture(source.digests)
      recasedLegacy.deploymentManifest.legacyRecovery.addresses.iloFactory =
        recasedLegacy.deploymentManifest.legacyRecovery.addresses.iloFactory.toUpperCase().replace('0X', '0x')
      rehash(recasedLegacy)
      writeFileSync(packagePath, `${JSON.stringify(recasedLegacy, null, 2)}\n`)
      assert.throws(
        () => verifyApprovedPublicReplacementPackage(packagePath, source.paths),
        /legacy-recovery inventory differs/i,
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
