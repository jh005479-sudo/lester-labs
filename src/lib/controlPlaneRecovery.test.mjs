import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  REDACTED_EVIDENCE_BUNDLE_FILE,
  REQUIRED_CONTROL_PLANES,
  REQUIRED_CREDENTIAL_TYPES,
  controlPlaneClaimSetSha256,
  verifyControlPlaneRecoveryEvidence,
} from '../../scripts/security/verify-control-plane-recovery.mjs'

const NOW = new Date('2026-08-11T12:00:00Z')
const REVIEWERS = [
  {
    identity: '@incident-lead',
    role: 'Incident lead',
    decision: 'APPROVE',
    approvedAt: '2026-08-10T20:30:00Z',
    evidenceSha256: `sha256:${'21'.repeat(32)}`,
  },
  {
    identity: '@independent-reviewer',
    role: 'Independent security reviewer',
    decision: 'APPROVE',
    approvedAt: '2026-08-10T20:31:00Z',
    evidenceSha256: `sha256:${'22'.repeat(32)}`,
  },
]

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function credentialDisposition(systemName) {
  return Object.fromEntries(REQUIRED_CREDENTIAL_TYPES[systemName].map((credentialType, index) => [
    credentialType,
    index === 0 ? 'ROTATED' : 'REVIEWED_NOT_PRESENT',
  ]))
}

function reviewedFixture() {
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
  return {
    status: 'REVIEWED',
    schemaVersion: 2,
    caseId: 'LL-INCIDENT-TEST',
    incidentDetectedAt: '2026-08-10T18:00:00Z',
    reviewedAt: '2026-08-10T21:00:00Z',
    reviewValidUntil: '2026-08-12T21:00:00Z',
    evidenceBundleSha256: `sha256:${'11'.repeat(32)}`,
    redactedEvidenceBundlePath: REDACTED_EVIDENCE_BUNDLE_FILE,
    redactedEvidenceBundleSha256: `sha256:${'ff'.repeat(32)}`,
    reviewers: structuredClone(REVIEWERS),
    systems,
  }
}

function redactedBundle(value) {
  return {
    kind: 'lester-labs-control-plane-redacted-evidence-bundle',
    schemaVersion: 1,
    caseId: value.caseId,
    generatedAt: value.reviewedAt,
    claimSetSha256: controlPlaneClaimSetSha256(value),
    externalEvidenceBundleSha256: value.evidenceBundleSha256,
    systemAuditLogSha256: Object.fromEntries(REQUIRED_CONTROL_PLANES.map((systemName) => [
      systemName,
      value.systems[systemName].auditLogSha256,
    ])),
    reviewerEvidence: value.reviewers.map((reviewer) => ({
      identity: reviewer.identity,
      role: reviewer.role,
      approvedAt: reviewer.approvedAt,
      evidenceSha256: reviewer.evidenceSha256,
    })),
  }
}

function withEvidence(value, callback, { mutateBundle } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'lester-control-plane-'))
  const filePath = join(directory, 'evidence.json')
  const bundlePath = join(directory, REDACTED_EVIDENCE_BUNDLE_FILE)
  try {
    const bundle = redactedBundle(value)
    if (mutateBundle) mutateBundle(bundle)
    writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`)
    value.redactedEvidenceBundleSha256 = sha256(readFileSync(bundlePath))
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
    return callback(filePath, bundlePath, value)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('production control-plane recovery evidence', () => {
  it('keeps the checked-in sentinel fail-closed for a production release', () => {
    assert.deepEqual(verifyControlPlaneRecoveryEvidence(), { status: 'NOT_REVIEWED' })
    assert.throws(
      () => verifyControlPlaneRecoveryEvidence(undefined, { requireReviewed: true, now: NOW }),
      /NOT_REVIEWED/,
    )
  })

  it('accepts only a complete, fresh, independently approved redacted inventory', () => {
    withEvidence(reviewedFixture(), (filePath, _bundlePath, value) => {
      assert.deepEqual(
        verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
        {
          status: 'REVIEWED',
          caseId: 'LL-INCIDENT-TEST',
          evidenceBundleSha256: value.evidenceBundleSha256,
          redactedEvidenceBundleSha256: value.redactedEvidenceBundleSha256,
          reviewValidUntil: '2026-08-12T21:00:00Z',
        },
      )
    })
  })

  it('rejects unknown fields, unresolved risks, unredacted accounts, and one-person approval', () => {
    const mutations = [
      (value) => { value.systems.github.unreviewed = true },
      (value) => { value.systems.hosting.residualRisks.push('Old deploy hook still active') },
      (value) => { value.systems.registrarDns.accountReference = 'owner@example.test' },
      (value) => { value.reviewers = value.reviewers.slice(0, 1) },
      (value) => { value.systems.email.approvedBy = ['@incident-lead'] },
    ]
    for (const mutate of mutations) {
      const value = reviewedFixture()
      mutate(value)
      withEvidence(value, (filePath) => {
        assert.throws(
          () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
          /reviewed fields|residual risks|redacted|two independent|reviewer approvals/i,
        )
      })
    }
  })

  it('requires distinct reviewer identities, roles, and nonzero unique evidence digests', () => {
    const mutations = [
      (value) => { value.reviewers[1].identity = value.reviewers[0].identity },
      (value) => { value.reviewers[1].role = value.reviewers[0].role.toUpperCase() },
      (value) => { value.reviewers[1].evidenceSha256 = value.reviewers[0].evidenceSha256 },
      (value) => { value.reviewers[0].evidenceSha256 = `sha256:${'0'.repeat(64)}` },
      (value) => { value.systems.hosting.auditLogSha256 = value.systems.github.auditLogSha256 },
      (value) => { value.systems.rpc.auditLogSha256 = value.evidenceBundleSha256 },
    ]
    for (const mutate of mutations) {
      const value = reviewedFixture()
      mutate(value)
      withEvidence(value, (filePath) => {
        assert.throws(
          () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
          /distinct|unique|nonzero/i,
        )
      })
    }
  })

  it('requires an explicit release-safe disposition for every system-specific credential type', () => {
    const missingType = reviewedFixture()
    delete missingType.systems.github.credentialDisposition.personalAccessTokens
    withEvidence(missingType, (filePath) => {
      assert.throws(
        () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
        /credential disposition.*reviewed fields/i,
      )
    })

    const unsafeStatus = reviewedFixture()
    unsafeStatus.systems.hosting.credentialDisposition.accessTokens = 'REVIEWED_NOT_APPLICABLE'
    withEvidence(unsafeStatus, (filePath) => {
      assert.throws(
        () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
        /credential disposition is not release-safe/i,
      )
    })

    const vacuousReview = reviewedFixture()
    for (const credentialType of REQUIRED_CREDENTIAL_TYPES.monitoring) {
      vacuousReview.systems.monitoring.credentialDisposition[credentialType] = 'REVIEWED_NOT_PRESENT'
    }
    withEvidence(vacuousReview, (filePath) => {
      assert.throws(
        () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
        /cannot mark every provider credential type not present/i,
      )
    })
  })

  it('enforces review ordering, bounded review duration, clock sanity, and expiry', () => {
    const cases = [
      [(value) => { value.systems.github.reviewedAt = '2026-08-10T17:59:59Z' }, /between incident detection/i],
      [(value) => { value.reviewers[0].approvedAt = '2026-08-10T19:00:00Z' }, /approve after all provider reviews/i],
      [(value) => { value.reviewValidUntil = '2026-08-14T21:00:01Z' }, /no more than 72 hours/i],
      [(value) => { value.systems.github.reviewedAt = '2026-08-09T20:59:59Z' }, /between incident detection|within 24 hours/i],
    ]
    for (const [mutate, expected] of cases) {
      const value = reviewedFixture()
      mutate(value)
      withEvidence(value, (filePath) => {
        assert.throws(
          () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
          expected,
        )
      })
    }

    withEvidence(reviewedFixture(), (filePath) => {
      assert.throws(
        () => verifyControlPlaneRecoveryEvidence(filePath, {
          requireReviewed: true,
          now: new Date('2026-08-13T21:00:01Z'),
        }),
        /expired/i,
      )
    })

    const future = reviewedFixture()
    future.incidentDetectedAt = '2026-08-11T17:00:00Z'
    future.systems = Object.fromEntries(Object.entries(future.systems).map(([name, system], index) => [name, {
      ...system,
      reviewedAt: `2026-08-11T18:0${index}:00Z`,
    }]))
    future.reviewers[0].approvedAt = '2026-08-11T18:30:00Z'
    future.reviewers[1].approvedAt = '2026-08-11T18:31:00Z'
    future.reviewedAt = '2026-08-11T19:00:00Z'
    future.reviewValidUntil = '2026-08-12T19:00:00Z'
    withEvidence(future, (filePath) => {
      assert.throws(
        () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
        /unacceptably in the future/i,
      )
    })
  })

  it('recomputes and binds the committed redacted evidence bundle', () => {
    withEvidence(reviewedFixture(), (filePath, bundlePath) => {
      const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'))
      bundle.systemAuditLogSha256.github = `sha256:${'ab'.repeat(32)}`
      writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`)
      assert.throws(
        () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
        /redacted evidence bundle digest/i,
      )
    })

    const value = reviewedFixture()
    withEvidence(value, (filePath) => {
      value.systems.github.provider = 'Changed after bundle creation'
      writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
      assert.throws(
        () => verifyControlPlaneRecoveryEvidence(filePath, { requireReviewed: true, now: NOW }),
        /claim-set digest/i,
      )
    })
  })

  it('rejects recovery claims attached to the sentinel', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lester-control-plane-sentinel-'))
    const filePath = join(directory, 'evidence.json')
    try {
      writeFileSync(filePath, `${JSON.stringify({ status: 'NOT_REVIEWED', systems: {} })}\n`)
      assert.throws(
        () => verifyControlPlaneRecoveryEvidence(filePath),
        /must not contain recovery claims/i,
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
