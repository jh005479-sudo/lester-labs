import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const defaultEvidencePath = resolve(
  repositoryRoot,
  'docs/security/evidence/production-control-plane-recovery.json',
)

export const REQUIRED_CONTROL_PLANES = Object.freeze([
  'github',
  'hosting',
  'registrarDns',
  'email',
  'npmRegistry',
  'rpc',
  'monitoring',
])

export const REQUIRED_CREDENTIAL_TYPES = Object.freeze({
  github: Object.freeze([
    'accountPasswordOrSso',
    'personalAccessTokens',
    'sshAndSigningKeys',
    'oauthAndGitHubApps',
    'deployKeysAndHooks',
    'actionsSecrets',
    'recoveryMethods',
  ]),
  hosting: Object.freeze([
    'accountPasswordOrSso',
    'accessTokens',
    'oauthIntegrations',
    'deployHooks',
    'projectAndTeamSecrets',
    'recoveryMethods',
  ]),
  registrarDns: Object.freeze([
    'accountPasswordOrSso',
    'apiCredentials',
    'oauthIntegrations',
    'dnsChangeCredentials',
    'domainTransferCredentials',
    'recoveryMethods',
  ]),
  email: Object.freeze([
    'accountPasswordOrSso',
    'activeSessions',
    'appPasswords',
    'oauthGrants',
    'mailRulesAndForwarding',
    'recoveryMethods',
  ]),
  npmRegistry: Object.freeze([
    'accountPasswordOrSso',
    'accessTokens',
    'automationTokens',
    'trustedPublishers',
    'organizationIntegrations',
    'recoveryMethods',
  ]),
  rpc: Object.freeze([
    'accountPasswordOrSso',
    'apiKeys',
    'webhooks',
    'allowlists',
    'billingOrTeamTokens',
    'recoveryMethods',
  ]),
  monitoring: Object.freeze([
    'accountPasswordOrSso',
    'apiTokens',
    'ingestKeys',
    'webhooks',
    'integrations',
    'recoveryMethods',
  ]),
})

export const REDACTED_EVIDENCE_BUNDLE_FILE = 'production-control-plane-redacted-evidence.json'
export const MAX_REVIEW_VALIDITY_MS = 72 * 60 * 60 * 1000
const MAX_SYSTEM_REVIEW_SPAN_MS = 24 * 60 * 60 * 1000
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/
const ZERO_SHA256 = `sha256:${'0'.repeat(64)}`
const REVIEWER_KEYS = ['identity', 'role', 'decision', 'approvedAt', 'evidenceSha256']
const SYSTEM_KEYS = [
  'provider',
  'accountReference',
  'reviewedAt',
  'sessionDisposition',
  'credentialDisposition',
  'accessReviewed',
  'integrationsReviewed',
  'configurationReviewed',
  'auditLogSha256',
  'findings',
  'residualRisks',
  'approvedBy',
]
const REDACTED_BUNDLE_KEYS = [
  'kind',
  'schemaVersion',
  'caseId',
  'generatedAt',
  'claimSetSha256',
  'externalEvidenceBundleSha256',
  'systemAuditLogSha256',
  'reviewerEvidence',
]
const REDACTED_REVIEWER_KEYS = ['identity', 'role', 'approvedAt', 'evidenceSha256']

function assertExactObjectKeys(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly the reviewed fields.`)
  }
}

function assertBoundedText(value, label, maximum = 240) {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) throw new Error(`${label} must be non-empty bounded text without surrounding whitespace or control characters.`)
}

function parseUtcTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) throw new Error(`${label} must be an ISO-8601 UTC timestamp.`)
  const timestamp = Date.parse(value)
  const normalized = value.includes('.') ? value : value.replace(/Z$/, '.000Z')
  if (Number.isNaN(timestamp) || new Date(timestamp).toISOString() !== normalized) {
    throw new Error(`${label} must be a real canonical ISO-8601 UTC timestamp.`)
  }
  return timestamp
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => {
    try {
      assertBoundedText(item, `${label} entry`, 500)
      return false
    } catch {
      return true
    }
  })) throw new Error(`${label} must be an array of bounded text entries.`)
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  throw new Error('The control-plane claim set contains a non-canonical JSON value.')
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function controlPlaneClaimSetSha256(value) {
  const { redactedEvidenceBundleSha256: omittedDigest, ...claimSet } = value
  void omittedDigest
  return sha256(canonicalJson(claimSet))
}

function registerUniqueDigest(digest, label, digests) {
  if (!SHA256_PATTERN.test(digest) || digest === ZERO_SHA256) {
    throw new Error(`${label} must have a nonzero lower-case SHA-256 digest.`)
  }
  if (digests.has(digest)) {
    throw new Error(`${label} must be unique; the same digest cannot prove two evidence records.`)
  }
  digests.add(digest)
}

function verifyRedactedEvidenceBundle(filePath, value, digests) {
  if (value.redactedEvidenceBundlePath !== REDACTED_EVIDENCE_BUNDLE_FILE) {
    throw new Error(`The redacted evidence bundle path must be ${REDACTED_EVIDENCE_BUNDLE_FILE}.`)
  }
  const bundlePath = resolve(dirname(resolve(filePath)), value.redactedEvidenceBundlePath)
  if (dirname(bundlePath) !== dirname(resolve(filePath))) {
    throw new Error('The redacted evidence bundle must be a sibling of the recovery inventory.')
  }

  let bundleSource
  try {
    const bundleStat = lstatSync(bundlePath)
    if (!bundleStat.isFile() || bundleStat.isSymbolicLink()) {
      throw new Error('not a regular file')
    }
    bundleSource = readFileSync(bundlePath)
  } catch {
    throw new Error(`The redacted evidence bundle is missing or not a regular file: ${value.redactedEvidenceBundlePath}.`)
  }
  const actualBundleDigest = sha256(bundleSource)
  if (actualBundleDigest !== value.redactedEvidenceBundleSha256) {
    throw new Error(`The redacted evidence bundle digest is ${actualBundleDigest}; expected ${value.redactedEvidenceBundleSha256}.`)
  }

  let bundle
  try {
    bundle = JSON.parse(bundleSource.toString('utf8'))
  } catch {
    throw new Error('The redacted evidence bundle must be valid JSON.')
  }
  assertExactObjectKeys(bundle, REDACTED_BUNDLE_KEYS, 'The redacted evidence bundle')
  if (
    bundle.kind !== 'lester-labs-control-plane-redacted-evidence-bundle' ||
    bundle.schemaVersion !== 1 ||
    bundle.caseId !== value.caseId ||
    bundle.generatedAt !== value.reviewedAt ||
    bundle.externalEvidenceBundleSha256 !== value.evidenceBundleSha256
  ) throw new Error('The redacted evidence bundle identity does not match the reviewed recovery inventory.')

  const expectedClaimSetSha256 = controlPlaneClaimSetSha256(value)
  registerUniqueDigest(bundle.claimSetSha256, 'The redacted evidence claim-set digest', digests)
  if (bundle.claimSetSha256 !== expectedClaimSetSha256) {
    throw new Error(`The redacted evidence claim-set digest is ${expectedClaimSetSha256}; expected ${bundle.claimSetSha256}.`)
  }

  assertExactObjectKeys(
    bundle.systemAuditLogSha256,
    REQUIRED_CONTROL_PLANES,
    'The redacted evidence system audit-log inventory',
  )
  for (const systemName of REQUIRED_CONTROL_PLANES) {
    if (bundle.systemAuditLogSha256[systemName] !== value.systems[systemName].auditLogSha256) {
      throw new Error(`The redacted evidence bundle does not bind the ${systemName} audit-log digest.`)
    }
  }

  if (!Array.isArray(bundle.reviewerEvidence) || bundle.reviewerEvidence.length !== value.reviewers.length) {
    throw new Error('The redacted evidence bundle must bind every recovery reviewer evidence record.')
  }
  for (let index = 0; index < value.reviewers.length; index += 1) {
    const bundledReviewer = bundle.reviewerEvidence[index]
    const reviewer = value.reviewers[index]
    assertExactObjectKeys(bundledReviewer, REDACTED_REVIEWER_KEYS, 'A bundled recovery reviewer')
    for (const key of REDACTED_REVIEWER_KEYS) {
      if (bundledReviewer[key] !== reviewer[key]) {
        throw new Error('The redacted evidence bundle reviewer records do not match the recovery inventory.')
      }
    }
  }
}

export function verifyControlPlaneRecoveryEvidence(
  filePath = defaultEvidencePath,
  { requireReviewed = false, now = new Date() } = {},
) {
  const value = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The control-plane recovery evidence must be a JSON object.')
  }

  if (value.status === 'NOT_REVIEWED') {
    if (Object.keys(value).length !== 1) {
      throw new Error('The NOT_REVIEWED sentinel must not contain recovery claims.')
    }
    if (requireReviewed) {
      throw new Error('Production control-plane recovery is NOT_REVIEWED.')
    }
    return { status: 'NOT_REVIEWED' }
  }

  assertExactObjectKeys(value, [
    'status',
    'schemaVersion',
    'caseId',
    'incidentDetectedAt',
    'reviewedAt',
    'reviewValidUntil',
    'evidenceBundleSha256',
    'redactedEvidenceBundlePath',
    'redactedEvidenceBundleSha256',
    'reviewers',
    'systems',
  ], 'The reviewed control-plane recovery evidence')

  if (value.status !== 'REVIEWED' || value.schemaVersion !== 2) {
    throw new Error('Control-plane recovery must use REVIEWED schema version 2.')
  }
  assertBoundedText(value.caseId, 'The incident case ID', 120)
  const incidentDetectedAt = parseUtcTimestamp(value.incidentDetectedAt, 'The incident detection time')
  const reviewedAt = parseUtcTimestamp(value.reviewedAt, 'The global recovery review time')
  const reviewValidUntil = parseUtcTimestamp(value.reviewValidUntil, 'The recovery review expiry time')
  if (incidentDetectedAt > reviewedAt) {
    throw new Error('The incident detection time must not be after the global recovery review time.')
  }
  if (reviewValidUntil <= reviewedAt || reviewValidUntil - reviewedAt > MAX_REVIEW_VALIDITY_MS) {
    throw new Error('The recovery review expiry must be after review and no more than 72 hours later.')
  }

  const digests = new Set()
  registerUniqueDigest(value.evidenceBundleSha256, 'The external recovery evidence bundle', digests)
  registerUniqueDigest(value.redactedEvidenceBundleSha256, 'The redacted recovery evidence bundle', digests)

  if (!Array.isArray(value.reviewers) || value.reviewers.length < 2) {
    throw new Error('At least two independent recovery reviewers are required.')
  }
  const reviewerIdentities = new Set()
  const reviewerRoles = new Set()
  const reviewerApprovalTimes = []
  for (const reviewer of value.reviewers) {
    assertExactObjectKeys(reviewer, REVIEWER_KEYS, 'A recovery reviewer')
    assertBoundedText(reviewer.identity, 'A recovery reviewer identity', 120)
    assertBoundedText(reviewer.role, 'A recovery reviewer role', 120)
    if (reviewer.decision !== 'APPROVE') {
      throw new Error('Every recovery reviewer must explicitly APPROVE.')
    }
    const approvedAt = parseUtcTimestamp(reviewer.approvedAt, 'A recovery reviewer approval time')
    if (approvedAt > reviewedAt) {
      throw new Error('A recovery reviewer approval cannot occur after the global recovery review closes.')
    }
    reviewerApprovalTimes.push(approvedAt)
    registerUniqueDigest(reviewer.evidenceSha256, 'A recovery reviewer evidence record', digests)
    const normalizedIdentity = reviewer.identity.toLowerCase()
    const normalizedRole = reviewer.role.toLowerCase()
    if (reviewerIdentities.has(normalizedIdentity)) {
      throw new Error('Recovery reviewer identities must be distinct.')
    }
    if (reviewerRoles.has(normalizedRole)) {
      throw new Error('Recovery reviewer roles must be distinct.')
    }
    reviewerIdentities.add(normalizedIdentity)
    reviewerRoles.add(normalizedRole)
  }

  assertExactObjectKeys(value.systems, REQUIRED_CONTROL_PLANES, 'The recovered control-plane inventory')
  const systemReviewTimes = []
  for (const systemName of REQUIRED_CONTROL_PLANES) {
    const system = value.systems[systemName]
    assertExactObjectKeys(system, SYSTEM_KEYS, `The ${systemName} recovery record`)
    assertBoundedText(system.provider, `The ${systemName} provider`, 120)
    assertBoundedText(system.accountReference, `The ${systemName} account reference`, 180)
    if (!system.accountReference.startsWith('redacted:') || system.accountReference.length === 'redacted:'.length) {
      throw new Error(`The ${systemName} account reference must be explicitly and meaningfully redacted.`)
    }
    const systemReviewedAt = parseUtcTimestamp(system.reviewedAt, `The ${systemName} review time`)
    if (systemReviewedAt < incidentDetectedAt || systemReviewedAt > reviewedAt) {
      throw new Error(`The ${systemName} review time must be between incident detection and global review closure.`)
    }
    systemReviewTimes.push(systemReviewedAt)
    if (!['REVOKED_ALL', 'REVIEWED_NO_ACTIVE_SESSIONS'].includes(system.sessionDisposition)) {
      throw new Error(`The ${systemName} session disposition is not release-safe.`)
    }
    assertExactObjectKeys(
      system.credentialDisposition,
      REQUIRED_CREDENTIAL_TYPES[systemName],
      `The ${systemName} credential disposition`,
    )
    let disposedCredentialCount = 0
    for (const credentialType of REQUIRED_CREDENTIAL_TYPES[systemName]) {
      const disposition = system.credentialDisposition[credentialType]
      if (!['ROTATED', 'REVOKED', 'REVIEWED_NOT_PRESENT'].includes(disposition)) {
        throw new Error(`The ${systemName} ${credentialType} credential disposition is not release-safe.`)
      }
      if (disposition !== 'REVIEWED_NOT_PRESENT') disposedCredentialCount += 1
    }
    if (disposedCredentialCount === 0) {
      throw new Error(`The ${systemName} credential review cannot mark every provider credential type not present.`)
    }
    if (
      system.accessReviewed !== true ||
      system.integrationsReviewed !== true ||
      system.configurationReviewed !== true
    ) throw new Error(`The ${systemName} access, integrations, and configuration must all be reviewed.`)
    registerUniqueDigest(system.auditLogSha256, `The ${systemName} audit-log evidence`, digests)
    assertStringArray(system.findings, `The ${systemName} findings`)
    assertStringArray(system.residualRisks, `The ${systemName} residual risks`)
    if (system.residualRisks.length !== 0) {
      throw new Error(`The ${systemName} record has unresolved residual risks.`)
    }
    if (
      !Array.isArray(system.approvedBy) ||
      system.approvedBy.length < 2 ||
      new Set(system.approvedBy.map((identity) => String(identity).toLowerCase())).size !== system.approvedBy.length
    ) throw new Error(`The ${systemName} record requires distinct reviewer approvals.`)
    for (const identity of system.approvedBy) {
      assertBoundedText(identity, `A ${systemName} approving reviewer`, 120)
      if (!reviewerIdentities.has(identity.toLowerCase())) {
        throw new Error(`The ${systemName} approval names an unknown reviewer.`)
      }
    }
  }

  const earliestSystemReview = Math.min(...systemReviewTimes)
  const latestSystemReview = Math.max(...systemReviewTimes)
  if (reviewedAt - earliestSystemReview > MAX_SYSTEM_REVIEW_SPAN_MS) {
    throw new Error('All provider reviews must be completed within 24 hours of global review closure.')
  }
  if (reviewerApprovalTimes.some((approvedAt) => approvedAt < latestSystemReview)) {
    throw new Error('Every recovery reviewer must approve after all provider reviews are complete.')
  }

  verifyRedactedEvidenceBundle(filePath, value, digests)

  if (requireReviewed) {
    const nowTimestamp = now instanceof Date ? now.getTime() : Number.NaN
    if (Number.isNaN(nowTimestamp)) throw new Error('The recovery verifier clock must be a valid Date.')
    if (reviewedAt > nowTimestamp + CLOCK_SKEW_TOLERANCE_MS) {
      throw new Error('The global recovery review time is unacceptably in the future.')
    }
    if (nowTimestamp > reviewValidUntil || nowTimestamp - reviewedAt > MAX_REVIEW_VALIDITY_MS) {
      throw new Error('The production control-plane recovery review has expired and must be repeated.')
    }
  }

  return {
    status: 'REVIEWED',
    caseId: value.caseId,
    evidenceBundleSha256: value.evidenceBundleSha256,
    redactedEvidenceBundleSha256: value.redactedEvidenceBundleSha256,
    reviewValidUntil: value.reviewValidUntil,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argumentsList = process.argv.slice(2)
    let requireReviewed = false
    for (let index = 0; index < argumentsList.length; index += 1) {
      const argument = argumentsList[index]
      if (argument === '--require-reviewed' && !requireReviewed) {
        requireReviewed = true
        continue
      }
      throw new Error(`Unknown, duplicate, or incomplete option: ${String(argument)}`)
    }
    const result = verifyControlPlaneRecoveryEvidence(defaultEvidencePath, {
      requireReviewed,
    })
    console.log(
      result.status === 'REVIEWED'
        ? `Production control-plane recovery verified for case ${result.caseId}; review expires ${result.reviewValidUntil}.`
        : 'Production control-plane recovery remains fail-closed: NOT_REVIEWED.',
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
