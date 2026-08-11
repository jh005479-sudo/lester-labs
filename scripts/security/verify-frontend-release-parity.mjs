import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertHash,
  assertExactKeys,
  assertProductionFrontendReleasePolicy,
  canonicalJson,
  fetchBounded,
  headersForPolicy,
  observeResponseBody,
  readJson,
  sha256Bytes,
  sha256Canonical,
  validateFrontendReleasePolicy,
  validateRouteSourceCoverageAgainstSources,
  verifyResponsePolicy,
} from "./frontend-release-common.mjs";
import {
  validateFrontendApprovalEnvelope,
  validateFrontendReleaseAttestation,
} from "./frontend-release-attestation.mjs";
import {
  assertReleaseProfile,
  assertVerificationProfile,
  assertVantageId,
  releaseProfileForVerification,
  vantageIdsForVerification,
} from "./release-profiles.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultPolicyPath = join(repositoryRoot, "src/config/frontendReleasePolicy.json");
const defaultManifestPath = join(repositoryRoot, "docs/security/frontend-release/approved-manifest.json");
const APPROVAL_FILES = Object.freeze({
  "source-security": Object.freeze({
    envelope: "source-security-approval.json",
    provenance: "source-security-approval.provenance.jsonl",
  }),
  "release-operations": Object.freeze({
    envelope: "release-operations-approval.json",
    provenance: "release-operations-approval.provenance.jsonl",
  }),
});
const MAXIMUM_PROMOTION_EVIDENCE_BYTES = 1024 * 1024;
const MAXIMUM_PROMOTION_PROVENANCE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_PROMOTION_VERIFICATION_BYTES = 32 * 1024 * 1024;
const MAXIMUM_PRODUCTION_PARITY_DELAY_MS = 30 * 60 * 1000;
const PRODUCTION_DOMAINS = Object.freeze([
  "lester-labs.com",
  "www.lester-labs.com",
]);
const REVIEWED_REPOSITORY = "jh005479-sudo/lester-labs";
const REVIEWED_SOURCE_REF = "refs/heads/main";
const REVIEWED_PROMOTION_WORKFLOW = ".github/workflows/vercel-production-release.yml";
const REVIEWED_SOURCE_REPOSITORY_URI = `https://github.com/${REVIEWED_REPOSITORY}`;
const REVIEWED_PROMOTION_SIGNER_URI =
  `${REVIEWED_SOURCE_REPOSITORY_URI}/${REVIEWED_PROMOTION_WORKFLOW}@${REVIEWED_SOURCE_REF}`;
const SLSA_PROVENANCE_PREDICATE = "https://slsa.dev/provenance/v1";
const SIGSTORE_VERIFICATION_RESULT_MEDIA_TYPE =
  "application/vnd.dev.sigstore.verificationresult+json;version=0.1";

// These are credential-free HTTP request profiles. They exercise CDN/origin
// user-agent variation, but they are not browser engines and do not execute JS.
export const HTTP_USER_AGENT_PROFILES = Object.freeze([
  Object.freeze({
    id: "chromium-desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  }),
  Object.freeze({
    id: "firefox-desktop",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0",
  }),
  Object.freeze({
    id: "metamask-mobile",
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 MetaMaskMobile",
  }),
]);

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalTimestamp(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) throw new Error(`${label} must be a canonical UTC timestamp.`);
  return value;
}

function parseJsonBytes(bytes, label, maximumBytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > maximumBytes) {
    throw new Error(`${label} is empty or exceeds its reviewed byte limit.`);
  }
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error(`${label} is not valid UTF-8.`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function parsePromotionBundle(bytes) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length === 0 ||
    bytes.length > MAXIMUM_PROMOTION_PROVENANCE_BYTES
  ) throw new Error("Frontend promotion provenance is empty or exceeds its reviewed byte limit.");
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new Error("Frontend promotion provenance is not valid UTF-8 JSONL.");
  }
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  if (lines.length !== 1 || lines[0].trim().length === 0) {
    throw new Error("Frontend promotion provenance must contain exactly one Sigstore JSONL bundle.");
  }
  let bundle;
  try {
    bundle = JSON.parse(lines[0]);
  } catch {
    throw new Error("Frontend promotion provenance is not valid Sigstore JSONL.");
  }
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new Error("Frontend promotion provenance bundle is not a JSON object.");
  }
  return bundle;
}

function requiredString(value, label, { pattern, exact } = {}) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2048 ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    (pattern && !pattern.test(value)) ||
    (exact !== undefined && value !== exact)
  ) throw new Error(`${label} is not the reviewed value.`);
  return value;
}

function validatePromotionVerification({
  promotionEvidenceBytes,
  promotionProvenanceBytes,
  promotionVerificationBytes,
  sourceCommit,
}) {
  const subjectSha256 = sha256Bytes(promotionEvidenceBytes);
  const provenanceBundle = parsePromotionBundle(promotionProvenanceBytes);
  const verification = parseJsonBytes(
    promotionVerificationBytes,
    "GitHub frontend-promotion verification result",
    MAXIMUM_PROMOTION_VERIFICATION_BYTES,
  );
  if (!Array.isArray(verification) || verification.length !== 1) {
    throw new Error("GitHub frontend-promotion verification must contain exactly one verified attestation.");
  }
  const entry = verification[0];
  assertExactKeys(entry, ["attestation", "verificationResult"], "GitHub frontend-promotion verification entry");
  if (!entry.attestation || typeof entry.attestation !== "object" || Array.isArray(entry.attestation)) {
    throw new Error("GitHub frontend-promotion verification omits its verified attestation bundle.");
  }
  if (sha256Canonical(entry.attestation.bundle) !== sha256Canonical(provenanceBundle)) {
    throw new Error("GitHub frontend-promotion verification is bound to different provenance bytes.");
  }
  const result = entry.verificationResult;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("GitHub frontend-promotion verification omits its machine-verifiable result.");
  }
  requiredString(result.mediaType, "GitHub verification-result media type", {
    exact: SIGSTORE_VERIFICATION_RESULT_MEDIA_TYPE,
  });
  const statement = result.statement;
  if (!statement || typeof statement !== "object" || Array.isArray(statement)) {
    throw new Error("Frontend promotion verification omits its in-toto statement.");
  }
  requiredString(statement._type, "Frontend promotion in-toto statement type", {
    exact: "https://in-toto.io/Statement/v1",
  });
  requiredString(statement.predicateType, "Frontend promotion attestation predicate type", {
    exact: SLSA_PROVENANCE_PREDICATE,
  });
  if (!Array.isArray(statement.subject) || statement.subject.length !== 1) {
    throw new Error("Frontend promotion attestation must contain exactly one subject.");
  }
  const [subject] = statement.subject;
  if (!subject || typeof subject !== "object" || Array.isArray(subject)) {
    throw new Error("Frontend promotion attestation subject is invalid.");
  }
  requiredString(subject.name, "Frontend promotion attestation subject name");
  if (
    !subject.digest ||
    typeof subject.digest !== "object" ||
    Array.isArray(subject.digest) ||
    subject.digest.sha256 !== subjectSha256
  ) throw new Error("Frontend promotion attestation subject digest does not match the exact promotion evidence bytes.");
  const certificate = result.signature?.certificate;
  if (!certificate || typeof certificate !== "object" || Array.isArray(certificate)) {
    throw new Error("GitHub frontend-promotion verification omits its verified signing certificate.");
  }
  for (const [field, label, exact] of [
    ["issuer", "OIDC issuer", "https://token.actions.githubusercontent.com"],
    ["sourceRepositoryURI", "source repository", REVIEWED_SOURCE_REPOSITORY_URI],
    ["sourceRepositoryRef", "source ref", REVIEWED_SOURCE_REF],
    ["sourceRepositoryDigest", "source commit", sourceCommit],
    ["subjectAlternativeName", "workflow identity", REVIEWED_PROMOTION_SIGNER_URI],
    ["buildSignerURI", "signer workflow", REVIEWED_PROMOTION_SIGNER_URI],
    ["buildSignerDigest", "signer commit", sourceCommit],
    ["buildConfigURI", "build workflow", REVIEWED_PROMOTION_SIGNER_URI],
    ["buildConfigDigest", "build commit", sourceCommit],
    ["runnerEnvironment", "runner environment", "github-hosted"],
  ]) requiredString(certificate[field], `Frontend promotion certificate ${label}`, { exact });
  if (!Array.isArray(result.verifiedTimestamps) || result.verifiedTimestamps.length === 0) {
    throw new Error("GitHub frontend-promotion verification has no cryptographically verified timestamp.");
  }
  for (const timestamp of result.verifiedTimestamps) {
    if (
      !timestamp ||
      typeof timestamp !== "object" ||
      Array.isArray(timestamp) ||
      typeof timestamp.type !== "string" ||
      typeof timestamp.uri !== "string" ||
      typeof timestamp.timestamp !== "string" ||
      Number.isNaN(Date.parse(timestamp.timestamp))
    ) throw new Error("GitHub frontend-promotion verification contains an invalid verified timestamp.");
  }
  const payload = {
    verifier: "gh-attestation-verify",
    predicateType: SLSA_PROVENANCE_PREDICATE,
    subjectSha256,
    provenanceSha256: sha256Bytes(promotionProvenanceBytes),
    verificationResultSha256: sha256Bytes(promotionVerificationBytes),
    repository: REVIEWED_REPOSITORY,
    signerWorkflow: REVIEWED_PROMOTION_WORKFLOW,
    sourceRef: REVIEWED_SOURCE_REF,
    sourceCommit,
    signerCommit: sourceCommit,
    runnerEnvironment: "github-hosted",
  };
  return { ...payload, bindingSha256: sha256Canonical(payload) };
}

function validateFrontendPromotionEvidence(value, {
  sourceCommit,
  manifestSha256,
  artifactSha256,
}) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "status", "promotedAt", "sourceCommit", "releaseProfile", "artifactKind",
    "manifestSha256", "artifactSha256", "stageEvidenceSha256", "stageProvenanceSha256",
    "promotionApprovalSha256", "promotionApprovalProvenanceSha256", "parityEvidenceSha256",
    "parityProvenanceSha256", "confirmation", "project", "deployment", "priorDeploymentId",
    "rollbackDisposition", "evidenceSha256",
  ], "Frontend promotion evidence");
  if (
    value.kind !== "lester-labs-vercel-promotion-evidence" ||
    value.schemaVersion !== 3 ||
    value.status !== "CURRENT" ||
    !["DIRECT", "RECOVERED_AFTER_AMBIGUOUS_RESPONSE"].includes(value.confirmation) ||
    value.artifactKind !== "next-standalone-container" ||
    value.sourceCommit !== sourceCommit ||
    value.manifestSha256 !== manifestSha256 ||
    value.artifactSha256 !== artifactSha256
  ) throw new Error("Frontend production parity is bound to a different promotion or approved artifact.");
  canonicalTimestamp(value.promotedAt, "Frontend promotion timestamp");
  assertReleaseProfile(value.releaseProfile, "Frontend promotion release profile");
  const { evidenceSha256, ...payload } = value;
  assertHash(evidenceSha256, "Frontend promotion evidence digest");
  if (evidenceSha256 !== sha256Canonical(payload)) {
    throw new Error("Frontend promotion evidence digest is invalid.");
  }
  for (const field of [
    "manifestSha256", "artifactSha256", "stageEvidenceSha256", "stageProvenanceSha256",
    "promotionApprovalSha256", "promotionApprovalProvenanceSha256", "parityEvidenceSha256",
    "parityProvenanceSha256",
  ]) assertHash(value[field], `Frontend promotion ${field}`);
  assertExactKeys(value.project, ["teamId", "projectId", "name", "autoAssignCustomDomains"], "Frontend promotion project");
  if (
    !/^team_[A-Za-z0-9]{8,80}$/u.test(value.project.teamId ?? "") ||
    !/^prj_[A-Za-z0-9]{8,80}$/u.test(value.project.projectId ?? "") ||
    !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/u.test(value.project.name ?? "") ||
    value.project.autoAssignCustomDomains !== false
  ) throw new Error("Frontend promotion project identity or domain-assignment policy is invalid.");
  assertExactKeys(value.deployment, [
    "id", "url", "target", "readyState", "readySubstate", "aliasAssigned", "aliases",
  ], "Frontend promoted deployment");
  let deploymentUrl;
  try {
    deploymentUrl = new URL(value.deployment.url);
  } catch {
    throw new Error("Frontend promoted deployment URL is invalid.");
  }
  if (
    !/^dpl_[A-Za-z0-9]{8,96}$/u.test(value.deployment.id ?? "") ||
    deploymentUrl.protocol !== "https:" ||
    deploymentUrl.username ||
    deploymentUrl.password ||
    deploymentUrl.port ||
    deploymentUrl.pathname !== "/" ||
    deploymentUrl.search ||
    deploymentUrl.hash ||
    !deploymentUrl.hostname.endsWith(".vercel.app") ||
    value.deployment.target !== "production" ||
    value.deployment.readyState !== "READY" ||
    value.deployment.readySubstate !== "PROMOTED" ||
    value.deployment.aliasAssigned !== true ||
    canonicalJson(value.deployment.aliases) !== canonicalJson(PRODUCTION_DOMAINS)
  ) throw new Error("Frontend promotion does not bind the exact current production aliases.");
  if (
    !/^dpl_[A-Za-z0-9]{8,96}$/u.test(value.priorDeploymentId ?? "") ||
    value.priorDeploymentId === value.deployment.id
  ) throw new Error("Frontend promotion prior deployment identity is invalid.");
  const disposition = value.rollbackDisposition;
  assertExactKeys(disposition, [
    "mode", "priorClassification", "targetDeploymentId", "safetyEvidence",
  ], "Frontend promotion rollback disposition");
  if (
    disposition.mode !== "ROLLBACK_TO_SAFE_CONTAINMENT" ||
    disposition.priorClassification !== "SAFE_CONTAINMENT" ||
    disposition.targetDeploymentId !== value.priorDeploymentId
  ) throw new Error("Frontend promotion lacks the exact safe-containment rollback disposition.");
  assertExactKeys(disposition.safetyEvidence, [
    "promotionEvidenceSha256", "promotionProvenanceSha256", "servedParityEvidenceSha256",
    "servedParityProvenanceSha256", "sourceCommit", "artifactSha256", "servedReleaseSha256",
  ], "Frontend promotion safe rollback evidence");
  for (const field of [
    "promotionEvidenceSha256", "promotionProvenanceSha256", "servedParityEvidenceSha256",
    "servedParityProvenanceSha256", "artifactSha256", "servedReleaseSha256",
  ]) assertHash(disposition.safetyEvidence[field], `Frontend safe rollback ${field}`);
  requiredString(disposition.safetyEvidence.sourceCommit, "Frontend safe rollback source commit", {
    pattern: /^[0-9a-f]{40}$/u,
  });
  return value;
}

function validatePromotionVerificationBinding(value, sourceCommit, provenanceSha256) {
  assertExactKeys(value, [
    "verifier", "predicateType", "subjectSha256", "provenanceSha256",
    "verificationResultSha256", "repository", "signerWorkflow", "sourceRef",
    "sourceCommit", "signerCommit", "runnerEnvironment", "bindingSha256",
  ], "Frontend promotion-verification binding");
  const { bindingSha256, ...payload } = value;
  if (
    value.verifier !== "gh-attestation-verify" ||
    value.predicateType !== SLSA_PROVENANCE_PREDICATE ||
    value.repository !== REVIEWED_REPOSITORY ||
    value.signerWorkflow !== REVIEWED_PROMOTION_WORKFLOW ||
    value.sourceRef !== REVIEWED_SOURCE_REF ||
    value.sourceCommit !== sourceCommit ||
    value.signerCommit !== sourceCommit ||
    value.runnerEnvironment !== "github-hosted" ||
    value.provenanceSha256 !== provenanceSha256
  ) throw new Error("Frontend promotion-verification binding names a different trust policy.");
  for (const [digest, label] of [
    [value.subjectSha256, "subject"],
    [value.provenanceSha256, "provenance"],
    [value.verificationResultSha256, "verification result"],
    [bindingSha256, "binding"],
  ]) assertHash(digest, `Frontend promotion-verification ${label}`);
  if (bindingSha256 !== sha256Canonical(payload)) {
    throw new Error("Frontend promotion-verification binding digest is invalid.");
  }
  return value;
}

function assertSnapshotMatches(path, expected, actual) {
  for (const field of ["finalPath", "bodySha256", "bytes", "contentType"]) {
    if (actual[field] !== expected[field]) {
      throw new Error(
        `Served route ${path} ${field} is ${JSON.stringify(actual[field])}; reviewed value is ${JSON.stringify(expected[field])}.`,
      );
    }
  }
  for (const field of [
    "securityHeaders",
    "thirdPartyOrigins",
    "activeResourceOrigins",
    "referencedActiveResourcePaths",
  ]) {
    if (canonicalJson(actual[field]) !== canonicalJson(expected[field])) {
      throw new Error(`Served route ${path} changed its reviewed ${field}.`);
    }
  }
}

async function verifyRoute(origin, path, expected, policy, profile, fetchImpl, allowedOrigins) {
  const response = await fetchBounded(new URL(path, origin).href, {
    allowedOrigins,
    maximumResponseBytes: policy.maximumResponseBytes,
    fetchImpl,
    attempts: 2,
    retryDelayMs: 500,
    userAgent: profile.userAgent,
  });
  const body = response.bytes.toString("utf8");
  const observation = observeResponseBody(body, response.finalUrl, response.headers, policy);
  const securityHeaders = verifyResponsePolicy(response.headers, observation, policy);
  const actual = {
    path,
    finalPath: new URL(response.finalUrl).pathname,
    bodySha256: sha256Bytes(response.bytes),
    bytes: response.bytes.length,
    contentType: response.headers["content-type"] ?? "",
    securityHeaders: headersForPolicy(securityHeaders, policy),
    thirdPartyOrigins: observation.thirdPartyOrigins,
    activeResourceOrigins: observation.activeResourceOrigins,
    referencedActiveResourcePaths: observation.referencedActiveResourcePaths,
  };
  assertSnapshotMatches(path, expected, actual);
  return { ...actual, requestedUrl: response.requestedUrl, finalUrl: response.finalUrl };
}

async function mapWithConcurrency(values, concurrency, operation) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

async function verifyAssets(origin, publicArtifacts, policy, profile, fetchImpl, allowedOrigins) {
  const results = await mapWithConcurrency(publicArtifacts.files, 8, async (expected) => {
    const response = await fetchBounded(new URL(expected.urlPath, origin).href, {
      allowedOrigins,
      maximumResponseBytes: policy.maximumResponseBytes,
      fetchImpl,
      attempts: 2,
      retryDelayMs: 500,
      userAgent: profile.userAgent,
    });
    const actualDigest = sha256Bytes(response.bytes);
    if (actualDigest !== expected.sha256 || response.bytes.length !== expected.bytes) {
      throw new Error(
        `Served asset ${origin}${expected.urlPath} differs from reviewed ${expected.sourcePath}.`,
      );
    }
    return {
      sourcePath: expected.sourcePath,
      urlPath: expected.urlPath,
      finalUrl: response.finalUrl,
      bytes: response.bytes.length,
      sha256: actualDigest,
    };
  });
  return {
    sha256: sha256Canonical(results.map(({ sourcePath, urlPath, bytes, sha256 }) => ({
      sourcePath,
      urlPath,
      bytes,
      sha256,
    }))),
    fileCount: results.length,
    totalBytes: results.reduce((total, file) => total + file.bytes, 0),
    files: results,
  };
}

const PLATFORM_METRICS = [
  "tokensMinted",
  "walletsAirdropped",
  "presalesCreated",
  "swapsCompleted",
  "onChainMessages",
];

function assertBoundedText(value, label, maximum = 1024) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    throw new Error(`${label} must be a non-empty bounded string.`);
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
}

function validatePlatformStatsSchema(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The platform-stats API did not return a JSON object.");
  }
  for (const metric of PLATFORM_METRICS) assertNonNegativeInteger(value[metric], `platform-stats.${metric}`);
  if (typeof value.fetchedAt !== "string" || Number.isNaN(Date.parse(value.fetchedAt))) {
    throw new Error("platform-stats.fetchedAt must be an ISO timestamp.");
  }
  for (const field of ["baseline", "breakdown", "coverage"]) {
    if (!value[field] || typeof value[field] !== "object" || Array.isArray(value[field])) {
      throw new Error(`platform-stats.${field} must be a JSON object.`);
    }
  }
  for (const metric of PLATFORM_METRICS) {
    const breakdown = value.breakdown[metric];
    const coverage = value.coverage[metric];
    if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) {
      throw new Error(`platform-stats.breakdown.${metric} is missing.`);
    }
    for (const field of ["baseline", "postCutover", "total"]) {
      assertNonNegativeInteger(breakdown[field], `platform-stats.breakdown.${metric}.${field}`);
    }
    if (breakdown.total !== value[metric] || breakdown.baseline + breakdown.postCutover !== breakdown.total) {
      throw new Error(`platform-stats.breakdown.${metric} does not reconcile to the published total.`);
    }
    if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) {
      throw new Error(`platform-stats.coverage.${metric} is missing.`);
    }
    if (!["live", "bounded", "historical-baseline", "fallback"].includes(coverage.status)) {
      throw new Error(`platform-stats.coverage.${metric}.status is unsupported.`);
    }
    assertBoundedText(coverage.note, `platform-stats.coverage.${metric}.note`, 4096);
  }
  return {
    schema: "platform-stats-v1",
    requiredMetrics: PLATFORM_METRICS,
    breakdownReconciled: true,
    coverageStatusesReviewed: true,
  };
}

function validateExplorerSummarySchema(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The explorer-summary API did not return a JSON object.");
  }
  assertNonNegativeInteger(value.latestBlock, "explorer-summary.latestBlock");
  if (!Array.isArray(value.blocks) || value.blocks.length > 8) {
    throw new Error("explorer-summary.blocks must be an array of at most eight records.");
  }
  if (!Array.isArray(value.transactions) || value.transactions.length > 8) {
    throw new Error("explorer-summary.transactions must be an array of at most eight records.");
  }
  for (const block of value.blocks) {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      throw new Error("explorer-summary contains a malformed block.");
    }
    for (const field of ["number", "txCount", "sizeKB"]) {
      assertNonNegativeInteger(block[field], `explorer-summary.blocks.${field}`);
    }
    assertBoundedText(block.time, "explorer-summary.blocks.time", 128);
    assertBoundedText(block.validator, "explorer-summary.blocks.validator", 256);
  }
  for (const transaction of value.transactions) {
    if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
      throw new Error("explorer-summary contains a malformed transaction.");
    }
    if (!/^0x[0-9a-fA-F]{64}$/u.test(transaction.hash ?? "")) {
      throw new Error("explorer-summary transaction hash is invalid.");
    }
    for (const field of ["from", "to"]) {
      if (!/^0x[0-9a-fA-F]{40}$/u.test(transaction[field] ?? "")) {
        throw new Error(`explorer-summary transaction ${field} is invalid.`);
      }
    }
    assertBoundedText(transaction.value, "explorer-summary.transactions.value", 128);
    assertBoundedText(transaction.time, "explorer-summary.transactions.time", 128);
    if (!["Success", "Failed", "Pending"].includes(transaction.status)) {
      throw new Error("explorer-summary transaction status is unsupported.");
    }
  }
  if (value.updatedAt !== null && (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt)))) {
    throw new Error("explorer-summary.updatedAt must be null or an ISO timestamp.");
  }
  if (value.error !== undefined) assertBoundedText(value.error, "explorer-summary.error", 512);
  return {
    schema: "explorer-summary-v1",
    maximumBlocks: 8,
    maximumTransactions: 8,
    typedRecords: true,
  };
}

function validateLiveJsonSchema(schema, value) {
  if (schema === "platform-stats-v1") return validatePlatformStatsSchema(value);
  if (schema === "explorer-summary-v1") return validateExplorerSummarySchema(value);
  throw new Error(`Unsupported live-JSON response schema ${schema}.`);
}

async function verifyLiveJsonRoute(origin, entry, policy, profile, fetchImpl, allowedOrigins) {
  const response = await fetchBounded(new URL(entry.probePath, origin).href, {
    allowedOrigins,
    maximumResponseBytes: policy.maximumResponseBytes,
    fetchImpl,
    attempts: 2,
    retryDelayMs: 500,
    userAgent: profile.userAgent,
  });
  const contentType = response.headers["content-type"] ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    throw new Error(`${entry.probePath} did not return application/json.`);
  }
  const observation = observeResponseBody("", response.finalUrl, response.headers, policy);
  const securityHeaders = verifyResponsePolicy(response.headers, observation, policy);
  let parsed;
  try {
    parsed = JSON.parse(response.bytes.toString("utf8"));
  } catch {
    throw new Error(`${entry.probePath} returned malformed JSON.`);
  }
  const schemaSummary = validateLiveJsonSchema(entry.responseSchema, parsed);
  return {
    path: entry.probePath,
    finalUrl: response.finalUrl,
    contentType,
    bytes: response.bytes.length,
    bodySha256: sha256Bytes(response.bytes),
    securityHeaders: headersForPolicy(securityHeaders, policy),
    schema: entry.responseSchema,
    schemaSha256: sha256Canonical(schemaSummary),
  };
}

export function verifyGitHubFrontendProvenance({ artifactPath, bundlePath, sourceCommit }) {
  const output = execFileSync(
    "gh",
    [
      "attestation",
      "verify",
      artifactPath,
      "--repo",
      "jh005479-sudo/lester-labs",
      "--bundle",
      bundlePath,
      "--signer-workflow",
      "github.com/jh005479-sudo/lester-labs/.github/workflows/frontend-release-attestation.yml",
      "--source-ref",
      "refs/heads/main",
      "--source-digest",
      sourceCommit,
      "--signer-digest",
      sourceCommit,
      "--deny-self-hosted-runners",
      "--format",
      "json",
    ],
    {
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "" },
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("GitHub did not verify a matching frontend provenance statement.");
  }
  return parsed;
}

function reconstructedCandidate(manifest) {
  const candidate = structuredClone(manifest);
  candidate.status = "CANDIDATE";
  candidate.approvalEnvelopes = [];
  return validateFrontendReleaseAttestation(candidate);
}

function loadApprovedManifest(
  path,
  {
    approvalEvidenceDirectory = dirname(path),
    verifyProvenance = verifyGitHubFrontendProvenance,
  } = {},
) {
  const value = readJson(path);
  if (value?.status === "NOT_APPROVED") {
    assertExactKeys(value, ["status"], "The NOT_APPROVED frontend release sentinel");
    throw new Error("Frontend release parity is fail-closed: no reviewed APPROVED manifest exists.");
  }
  const manifest = validateFrontendReleaseAttestation(value, {
    requireApproved: true,
    requireReleaseRuntime: true,
  });
  const approvedProvenancePath = join(approvalEvidenceDirectory, "approved-manifest.provenance.jsonl");
  verifyProvenance({
    artifactPath: path,
    bundlePath: approvedProvenancePath,
    sourceCommit: manifest.sourceCommit,
  });
  const candidate = reconstructedCandidate(manifest);
  const candidatePath = join(approvalEvidenceDirectory, "frontend-release-candidate.json");
  const candidateProvenancePath = join(approvalEvidenceDirectory, "github-sigstore-provenance.jsonl");
  const candidateBytes = readFileSync(candidatePath);
  if (candidateBytes.toString("utf8") !== canonicalJson(candidate)) {
    throw new Error("The preserved signed candidate does not exactly reconstruct the approved manifest.");
  }
  const candidateProvenanceBytes = readFileSync(candidateProvenancePath);
  const candidateProvenanceSha256 = sha256Bytes(candidateProvenanceBytes);
  verifyProvenance({
    artifactPath: candidatePath,
    bundlePath: candidateProvenancePath,
    sourceCommit: manifest.sourceCommit,
  });
  const deploymentArchivePath = join(approvalEvidenceDirectory, "frontend-standalone.tar");
  const deploymentArchiveBytes = readFileSync(deploymentArchivePath);
  if (
    deploymentArchiveBytes.length !== manifest.deploymentArtifact.archiveBytes ||
    sha256Bytes(deploymentArchiveBytes) !== manifest.deploymentArtifact.archiveSha256
  ) throw new Error("The deployable standalone archive differs from the approved manifest.");
  const deploymentInventoryPath = join(approvalEvidenceDirectory, "deployment-payload.inventory.json");
  const deploymentInventory = readJson(deploymentInventoryPath);
  assertExactKeys(
    deploymentInventory,
    ["sha256", "fileCount", "totalBytes", "files"],
    "The deployable payload inventory",
  );
  if (
    !Array.isArray(deploymentInventory.files) ||
    deploymentInventory.sha256 !== sha256Canonical(deploymentInventory.files) ||
    deploymentInventory.sha256 !== manifest.deploymentArtifact.payloadInventorySha256 ||
    deploymentInventory.fileCount !== deploymentInventory.files.length ||
    deploymentInventory.fileCount !== manifest.deploymentArtifact.fileCount ||
    deploymentInventory.totalBytes !== deploymentInventory.files.reduce((total, file) => total + file.bytes, 0) ||
    deploymentInventory.totalBytes !== manifest.deploymentArtifact.totalBytes
  ) throw new Error("The deployable payload inventory differs from the approved manifest.");
  for (const signedArtifactPath of [deploymentArchivePath, deploymentInventoryPath]) {
    verifyProvenance({
      artifactPath: signedArtifactPath,
      bundlePath: candidateProvenancePath,
      sourceCommit: manifest.sourceCommit,
    });
  }
  const references = new Map(manifest.approvalEnvelopes.map((entry) => [entry.reviewRole, entry]));
  const workflowRuns = new Set();
  for (const [role, filenames] of Object.entries(APPROVAL_FILES)) {
    const reference = references.get(role);
    const envelopePath = join(approvalEvidenceDirectory, filenames.envelope);
    const provenancePath = join(approvalEvidenceDirectory, filenames.provenance);
    const envelopeBytes = readFileSync(envelopePath);
    const provenanceBytes = readFileSync(provenancePath);
    if (
      sha256Bytes(envelopeBytes) !== reference?.rawSha256 ||
      sha256Bytes(provenanceBytes) !== reference?.provenanceSha256
    ) throw new Error(`The ${role} approval evidence differs from the approved manifest.`);
    const envelope = validateFrontendApprovalEnvelope(
      JSON.parse(envelopeBytes.toString("utf8")),
      candidate,
    );
    if (envelope.reviewRole !== role || envelope.candidateProvenanceSha256 !== candidateProvenanceSha256) {
      throw new Error(`The ${role} approval envelope is bound to different candidate provenance.`);
    }
    workflowRuns.add(`${envelope.workflowRunId}:${envelope.workflowRunAttempt}`);
    verifyProvenance({
      artifactPath: envelopePath,
      bundlePath: provenancePath,
      sourceCommit: manifest.sourceCommit,
    });
  }
  if (workflowRuns.size !== 1) {
    throw new Error("The protected frontend approvals came from different workflow runs.");
  }
  return manifest;
}

function servedProfilePayload(routes, liveJsonRoutes, assets) {
  return {
    routes: routes.map(({
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
      sha256: assets.sha256,
      fileCount: assets.fileCount,
      totalBytes: assets.totalBytes,
    },
    liveJsonSchemas: liveJsonRoutes.map(({ path, securityHeaders, schema, schemaSha256 }) => ({
      path,
      securityHeaders,
      schema,
      schemaSha256,
    })),
  };
}

export async function verifyFrontendReleaseParity({
  manifestPath = defaultManifestPath,
  policyPath = defaultPolicyPath,
  fetchImpl = globalThis.fetch,
  enforceProductionOrigins = true,
  checkedAt = new Date().toISOString(),
  vantageId,
  verificationProfile,
  approvalEvidenceDirectory,
  verifyProvenance = verifyGitHubFrontendProvenance,
  expectedSourceCommit,
  requestOrigins,
  promotionEvidenceBytes,
  promotionProvenanceBytes,
  promotionVerificationBytes,
} = {}) {
  canonicalTimestamp(checkedAt, "Served frontend parity timestamp");
  if (enforceProductionOrigins) {
    assertVerificationProfile(verificationProfile, "Served frontend verification profile");
    assertVantageId(verificationProfile, vantageId);
  } else if (
    typeof vantageId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/u.test(vantageId)
  ) throw new Error("A bounded non-secret vantage ID is required for served parity evidence.");
  const policy = validateFrontendReleasePolicy(readJson(policyPath));
  if (enforceProductionOrigins) assertProductionFrontendReleasePolicy(policy);
  let origins = policy.deploymentOrigins;
  if (requestOrigins !== undefined) {
    if (
      enforceProductionOrigins ||
      !Array.isArray(requestOrigins) ||
      requestOrigins.length < 1 ||
      requestOrigins.length > 2
    ) {
      throw new Error("Explicit parity request origins require one or two non-production probe origins.");
    }
    origins = requestOrigins.map((rawOrigin, index) => {
      let parsed;
      try {
        parsed = new URL(rawOrigin);
      } catch {
        throw new Error(`Explicit parity request origin ${index} is invalid.`);
      }
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      ) throw new Error(`Explicit parity request origin ${index} must be a bare HTTPS origin.`);
      return parsed.origin;
    });
    if (new Set(origins).size !== origins.length) {
      throw new Error("Explicit parity request origins must be unique.");
    }
  }
  const manifest = loadApprovedManifest(manifestPath, {
    approvalEvidenceDirectory,
    verifyProvenance,
  });
  const releaseProfile = manifest.releaseProfile;
  if (
    enforceProductionOrigins &&
    releaseProfile !== releaseProfileForVerification(verificationProfile)
  ) throw new Error("The served frontend verification profile differs from the signed release profile.");
  const manifestBytes = readFileSync(manifestPath);
  if (manifestBytes.toString("utf8") !== canonicalJson(manifest)) {
    throw new Error("The approved frontend manifest must use exact canonical JSON bytes.");
  }
  const manifestSha256 = sha256Bytes(manifestBytes);
  if (expectedSourceCommit !== undefined && manifest.sourceCommit !== expectedSourceCommit) {
    throw new Error("The approved frontend manifest is bound to a different expected source commit.");
  }
  if (manifest.policySha256 !== sha256Canonical(policy)) {
    throw new Error("The approved frontend manifest is bound to a different release policy.");
  }
  const allowedEmbeddedOrigins = new Set(policy.allowedArtifactEmbeddedOrigins);
  for (const origin of manifest.artifactEmbeddedOrigins) {
    if (!allowedEmbeddedOrigins.has(origin)) {
      throw new Error(`The approved artifacts embed unreviewed network origin ${origin}.`);
    }
  }
  validateRouteSourceCoverageAgainstSources(
    policy,
    manifest.sourceTree.files.map(({ path }) => path),
  );
  if (!arraysEqual(manifest.routeSnapshots.map(({ path }) => path), policy.routes)) {
    throw new Error("The approved frontend manifest does not snapshot every reviewed critical route in order.");
  }
  let promotion;
  let promotionVerification;
  if (enforceProductionOrigins) {
    const parsedPromotion = parseJsonBytes(
      promotionEvidenceBytes,
      "Canonical frontend promotion evidence",
      MAXIMUM_PROMOTION_EVIDENCE_BYTES,
    );
    if (canonicalJson(parsedPromotion) !== promotionEvidenceBytes.toString("utf8")) {
      throw new Error("Frontend promotion evidence must use canonical JSON bytes.");
    }
    promotion = validateFrontendPromotionEvidence(parsedPromotion, {
      sourceCommit: manifest.sourceCommit,
      manifestSha256,
      artifactSha256: manifest.deploymentArtifact.archiveSha256,
    });
    if (promotion.releaseProfile !== releaseProfile) {
      throw new Error("The frontend promotion differs from the signed release profile.");
    }
    promotionVerification = validatePromotionVerification({
      promotionEvidenceBytes,
      promotionProvenanceBytes,
      promotionVerificationBytes,
      sourceCommit: manifest.sourceCommit,
    });
    const checkedAtMs = Date.parse(checkedAt);
    const promotedAtMs = Date.parse(promotion.promotedAt);
    if (checkedAtMs < promotedAtMs || checkedAtMs - promotedAtMs > MAXIMUM_PRODUCTION_PARITY_DELAY_MS) {
      throw new Error("Production served frontend parity must run within 30 minutes after the exact promotion.");
    }
  }
  const expectedRoutes = new Map(manifest.routeSnapshots.map((snapshot) => [snapshot.path, snapshot]));
  const liveJsonEntries = policy.routeSourceCoverage.filter(
    ({ verificationMode }) => verificationMode === "live-json",
  );
  const allowedRequestOrigins = new Set(origins);
  const originResults = [];
  for (const origin of origins) {
    const profiles = [];
    for (const profile of HTTP_USER_AGENT_PROFILES) {
      const routes = [];
      for (const path of policy.routes) {
        routes.push(await verifyRoute(
          origin,
          path,
          expectedRoutes.get(path),
          policy,
          profile,
          fetchImpl,
          allowedRequestOrigins,
        ));
      }
      const liveJsonRoutes = [];
      for (const entry of liveJsonEntries) {
        liveJsonRoutes.push(await verifyLiveJsonRoute(
          origin,
          entry,
          policy,
          profile,
          fetchImpl,
          allowedRequestOrigins,
        ));
      }
      const assets = await verifyAssets(
        origin,
        manifest.publicArtifacts,
        policy,
        profile,
        fetchImpl,
        allowedRequestOrigins,
      );
      profiles.push({
        profile: profile.id,
        routes,
        liveJsonRoutes,
        assets,
        servedProfileSha256: sha256Canonical(servedProfilePayload(routes, liveJsonRoutes, assets)),
      });
    }
    if (new Set(profiles.map(({ servedProfileSha256 }) => servedProfileSha256)).size !== 1) {
      throw new Error(`${origin} serves different reviewed bytes to HTTP user-agent profiles.`);
    }
    originResults.push({ origin, profiles });
  }
  const originProfileDigests = originResults.map(({ profiles }) =>
    profiles.map(({ servedProfileSha256 }) => servedProfileSha256),
  );
  if (
    originProfileDigests.length > 1 &&
    !originProfileDigests.slice(1).every((digests) => arraysEqual(originProfileDigests[0], digests))
  ) {
    throw new Error("Apex and www route/public-asset bytes are not equivalent across HTTP user-agent profiles.");
  }
  const capturedThirdPartyOrigins = [...new Set(
    originResults.flatMap((result) => result.profiles.flatMap((profile) =>
      profile.routes.flatMap((route) => route.thirdPartyOrigins))),
  )].sort();
  const observationSha256 = sha256Canonical(normalizedFrontendObservation(originResults));
  const sharedResult = {
    kind: "lester-labs-served-frontend-parity",
    checkedAt,
    vantageId,
    verificationProfile: enforceProductionOrigins ? verificationProfile : "local-development",
    releaseProfile,
    sourceCommit: manifest.sourceCommit,
    reviewPayloadSha256: manifest.reviewPayloadSha256,
    policySha256: manifest.policySha256,
    publicArtifactsSha256: manifest.publicArtifacts.sha256,
    apexAndWwwByteEquivalent: requestOrigins === undefined,
    liveJsonSchemaEquivalent: true,
    capturedThirdPartyOrigins,
    origins: originResults,
  };
  if (!enforceProductionOrigins) {
    const servedReleaseSha256 = sha256Canonical({
      releaseProfile,
      sourceCommit: manifest.sourceCommit,
      reviewPayloadSha256: manifest.reviewPayloadSha256,
      policySha256: manifest.policySha256,
      publicArtifactsSha256: manifest.publicArtifacts.sha256,
      origins: originResults.map(({ origin, profiles }) => ({
        origin,
        profiles: profiles.map(({ profile, servedProfileSha256 }) => ({ profile, servedProfileSha256 })),
      })),
    });
    const result = { ...sharedResult, schemaVersion: 1, servedReleaseSha256 };
    return { ...result, evidenceSha256: sha256Canonical(result) };
  }
  const servedReleaseSha256 = sha256Canonical({
    verificationProfile,
    releaseProfile,
    sourceCommit: manifest.sourceCommit,
    manifestSha256,
    deploymentId: promotion.deployment.id,
    promotionEvidenceSha256: promotion.evidenceSha256,
    promotionProvenanceSha256: promotionVerification.provenanceSha256,
    promotionVerificationBindingSha256: promotionVerification.bindingSha256,
    reviewPayloadSha256: manifest.reviewPayloadSha256,
    policySha256: manifest.policySha256,
    publicArtifactsSha256: manifest.publicArtifacts.sha256,
    observationSha256,
  });
  const result = {
    ...sharedResult,
    schemaVersion: 3,
    manifestSha256,
    promotedAt: promotion.promotedAt,
    deploymentId: promotion.deployment.id,
    promotionEvidenceSha256: promotion.evidenceSha256,
    promotionProvenanceSha256: promotionVerification.provenanceSha256,
    promotionVerification,
    observationSha256,
    servedReleaseSha256,
  };
  return { ...result, evidenceSha256: sha256Canonical(result) };
}

function validateRecordedSecurityHeaders(value, policy, label) {
  const expected = headersForPolicy(policy.criticalResponseHeaders, policy);
  assertExactKeys(value, Object.keys(expected), label);
  for (const [name, expectedValue] of Object.entries(expected)) {
    if (value[name] !== expectedValue) throw new Error(`${label} differs at ${name}.`);
  }
}

function validateSortedUniqueStrings(values, label, { allowed, path = false } = {}) {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== "string" || value.length === 0 || value.length > 2048) ||
    new Set(values).size !== values.length ||
    !arraysEqual(values, [...values].sort())
  ) throw new Error(`${label} must be a sorted unique bounded string list.`);
  for (const value of values) {
    if (allowed && !allowed.has(value)) throw new Error(`${label} contains unreviewed value ${value}.`);
    if (path) {
      let parsed;
      try {
        parsed = new URL(value, "https://www.lester-labs.com");
      } catch {
        throw new Error(`${label} contains invalid active-resource path ${value}.`);
      }
      if (
        !value.startsWith("/") ||
        value.startsWith("//") ||
        parsed.origin !== "https://www.lester-labs.com" ||
        parsed.pathname !== value ||
        parsed.search ||
        parsed.hash
      ) throw new Error(`${label} contains unsafe active-resource path ${value}.`);
    }
  }
  return values;
}

function validateFinalUrl(value, expectedPathAndQuery, allowedOrigins, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is invalid.`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    !allowedOrigins.has(parsed.origin) ||
    `${parsed.pathname}${parsed.search}` !== expectedPathAndQuery
  ) throw new Error(`${label} escaped the exact reviewed production route.`);
  return parsed;
}

function validateFrontendRouteEvidence(route, expectedPath, origin, policy, allowedOrigins, label) {
  assertExactKeys(route, [
    "path", "finalPath", "bodySha256", "bytes", "contentType", "securityHeaders",
    "thirdPartyOrigins", "activeResourceOrigins", "referencedActiveResourcePaths",
    "requestedUrl", "finalUrl",
  ], label);
  if (
    route.path !== expectedPath ||
    route.finalPath !== expectedPath ||
    route.requestedUrl !== new URL(expectedPath, origin).href ||
    !Number.isSafeInteger(route.bytes) ||
    route.bytes <= 0 ||
    route.bytes > policy.maximumResponseBytes ||
    typeof route.contentType !== "string" ||
    route.contentType.length === 0 ||
    route.contentType.length > 256
  ) throw new Error(`${label} does not identify the exact reviewed route response.`);
  assertHash(route.bodySha256, `${label} body digest`);
  validateFinalUrl(route.finalUrl, expectedPath, allowedOrigins, `${label} final URL`);
  validateRecordedSecurityHeaders(route.securityHeaders, policy, `${label} security headers`);
  validateSortedUniqueStrings(route.thirdPartyOrigins, `${label} third-party origins`, {
    allowed: new Set(policy.allowedThirdPartyOrigins),
  });
  validateSortedUniqueStrings(route.activeResourceOrigins, `${label} active-resource origins`, {
    allowed: new Set(policy.allowedActiveResourceOrigins),
  });
  validateSortedUniqueStrings(route.referencedActiveResourcePaths, `${label} active-resource paths`, {
    path: true,
  });
  return route;
}

function validateFrontendAssetsEvidence(assets, expectedPublicArtifactsSha256, policy, allowedOrigins, label) {
  assertExactKeys(assets, ["sha256", "fileCount", "totalBytes", "files"], label);
  assertHash(assets.sha256, `${label} inventory digest`);
  if (!Array.isArray(assets.files) || assets.files.length === 0) {
    throw new Error(`${label} must contain every reviewed public asset.`);
  }
  const paths = [];
  let totalBytes = 0;
  for (let index = 0; index < assets.files.length; index += 1) {
    const file = assets.files[index];
    assertExactKeys(file, ["sourcePath", "urlPath", "finalUrl", "bytes", "sha256"], `${label} file ${index}`);
    let requested;
    try {
      requested = new URL(file.urlPath, "https://www.lester-labs.com");
    } catch {
      throw new Error(`${label} file ${index} has an invalid URL path.`);
    }
    if (
      typeof file.sourcePath !== "string" ||
      !/^(?:build|public|source)\/[A-Za-z0-9._@+\-/]{1,1024}$/u.test(file.sourcePath) ||
      file.sourcePath.split("/").some((segment) => segment === "." || segment === "..") ||
      !file.urlPath.startsWith("/") ||
      file.urlPath.startsWith("//") ||
      requested.origin !== "https://www.lester-labs.com" ||
      `${requested.pathname}${requested.search}` !== file.urlPath ||
      requested.hash ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      file.bytes > policy.maximumResponseBytes
    ) throw new Error(`${label} file ${index} metadata is invalid.`);
    validateFinalUrl(file.finalUrl, file.urlPath, allowedOrigins, `${label} file ${file.urlPath} final URL`);
    assertHash(file.sha256, `${label} file ${file.urlPath} digest`);
    paths.push(file.urlPath);
    totalBytes += file.bytes;
  }
  if (
    new Set(paths).size !== paths.length ||
    !arraysEqual(paths, [...paths].sort()) ||
    assets.fileCount !== assets.files.length ||
    assets.totalBytes !== totalBytes ||
    assets.sha256 !== expectedPublicArtifactsSha256 ||
    assets.sha256 !== sha256Canonical(
      assets.files.map(({ sourcePath, urlPath, bytes, sha256 }) => ({
        sourcePath,
        urlPath,
        bytes,
        sha256,
      })),
    )
  ) throw new Error(`${label} summary or ordering is invalid.`);
  return assets;
}

function liveJsonSchemaSummary(schema) {
  if (schema === "platform-stats-v1") {
    return {
      schema: "platform-stats-v1",
      requiredMetrics: PLATFORM_METRICS,
      breakdownReconciled: true,
      coverageStatusesReviewed: true,
    };
  }
  if (schema === "explorer-summary-v1") {
    return {
      schema: "explorer-summary-v1",
      maximumBlocks: 8,
      maximumTransactions: 8,
      typedRecords: true,
    };
  }
  throw new Error(`Unsupported live-JSON response schema ${schema}.`);
}

function validateLiveJsonEvidence(value, expected, policy, allowedOrigins, label) {
  assertExactKeys(value, [
    "path", "finalUrl", "contentType", "bytes", "bodySha256", "securityHeaders",
    "schema", "schemaSha256",
  ], label);
  if (
    value.path !== expected.probePath ||
    value.schema !== expected.responseSchema ||
    value.schemaSha256 !== sha256Canonical(liveJsonSchemaSummary(expected.responseSchema)) ||
    typeof value.contentType !== "string" ||
    !/^application\/json(?:;|$)/iu.test(value.contentType) ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes <= 0 ||
    value.bytes > policy.maximumResponseBytes
  ) throw new Error(`${label} does not prove the exact reviewed live-JSON schema.`);
  assertHash(value.bodySha256, `${label} body digest`);
  validateFinalUrl(value.finalUrl, expected.probePath, allowedOrigins, `${label} final URL`);
  validateRecordedSecurityHeaders(value.securityHeaders, policy, `${label} security headers`);
  return value;
}

function validateFrontendProfileEvidence(
  profile,
  expectedProfile,
  origin,
  publicArtifactsSha256,
  policy,
  allowedOrigins,
  label,
) {
  assertExactKeys(profile, [
    "profile", "routes", "liveJsonRoutes", "assets", "servedProfileSha256",
  ], label);
  if (profile.profile !== expectedProfile) throw new Error(`${label} uses an unexpected HTTP profile.`);
  if (!Array.isArray(profile.routes) || profile.routes.length !== policy.routes.length) {
    throw new Error(`${label} omits reviewed frontend routes.`);
  }
  profile.routes.forEach((route, index) => validateFrontendRouteEvidence(
    route,
    policy.routes[index],
    origin,
    policy,
    allowedOrigins,
    `${label} route ${policy.routes[index]}`,
  ));
  const liveEntries = policy.routeSourceCoverage.filter(
    ({ verificationMode }) => verificationMode === "live-json",
  );
  if (!Array.isArray(profile.liveJsonRoutes) || profile.liveJsonRoutes.length !== liveEntries.length) {
    throw new Error(`${label} omits reviewed live-JSON routes.`);
  }
  profile.liveJsonRoutes.forEach((value, index) => validateLiveJsonEvidence(
    value,
    liveEntries[index],
    policy,
    allowedOrigins,
    `${label} live JSON ${liveEntries[index].probePath}`,
  ));
  validateFrontendAssetsEvidence(
    profile.assets,
    publicArtifactsSha256,
    policy,
    allowedOrigins,
    `${label} assets`,
  );
  assertHash(profile.servedProfileSha256, `${label} served profile digest`);
  if (
    profile.servedProfileSha256 !== sha256Canonical(servedProfilePayload(
      profile.routes,
      profile.liveJsonRoutes,
      profile.assets,
    ))
  ) throw new Error(`${label} served profile digest is invalid.`);
  return profile.servedProfileSha256;
}

function normalizedFrontendObservation(origins) {
  return origins.map(({ origin, profiles }) => ({
    origin,
    profiles: profiles.map(({ profile, servedProfileSha256 }) => ({ profile, servedProfileSha256 })),
  }));
}

function validateFrontendVantageEvidence(value, label) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "checkedAt", "vantageId", "verificationProfile", "releaseProfile",
    "sourceCommit", "reviewPayloadSha256",
    "policySha256", "publicArtifactsSha256", "manifestSha256", "promotedAt", "deploymentId",
    "promotionEvidenceSha256", "promotionProvenanceSha256", "promotionVerification",
    "observationSha256", "servedReleaseSha256", "apexAndWwwByteEquivalent",
    "liveJsonSchemaEquivalent", "capturedThirdPartyOrigins", "origins", "evidenceSha256",
  ], `${label} frontend vantage evidence`);
  if (
    value.kind !== "lester-labs-served-frontend-parity" ||
    value.schemaVersion !== 3 ||
    typeof value.sourceCommit !== "string" ||
    !/^[0-9a-f]{40}$/u.test(value.sourceCommit) ||
    typeof value.deploymentId !== "string" ||
    !/^dpl_[A-Za-z0-9]{8,96}$/u.test(value.deploymentId) ||
    value.apexAndWwwByteEquivalent !== true ||
    value.liveJsonSchemaEquivalent !== true
  ) throw new Error(`The ${label} frontend vantage kind, identity, or required results are invalid.`);
  assertVerificationProfile(value.verificationProfile, `${label} frontend verification profile`);
  assertVantageId(value.verificationProfile, value.vantageId);
  if (value.releaseProfile !== releaseProfileForVerification(value.verificationProfile)) {
    throw new Error(`The ${label} frontend release and verification profiles differ.`);
  }
  canonicalTimestamp(value.checkedAt, `${label} frontend vantage timestamp`);
  canonicalTimestamp(value.promotedAt, `${label} frontend promotion timestamp`);
  const delay = Date.parse(value.checkedAt) - Date.parse(value.promotedAt);
  if (delay < 0 || delay > MAXIMUM_PRODUCTION_PARITY_DELAY_MS) {
    throw new Error(`The ${label} frontend vantage is not within 30 minutes after promotion.`);
  }
  for (const [digest, digestLabel] of [
    [value.reviewPayloadSha256, "review payload"],
    [value.policySha256, "policy"],
    [value.publicArtifactsSha256, "public artifacts"],
    [value.manifestSha256, "manifest"],
    [value.promotionEvidenceSha256, "promotion evidence"],
    [value.promotionProvenanceSha256, "promotion provenance"],
    [value.observationSha256, "observation"],
    [value.servedReleaseSha256, "served release"],
    [value.evidenceSha256, "evidence"],
  ]) assertHash(digest, `${label} frontend vantage ${digestLabel}`);
  validatePromotionVerificationBinding(
    value.promotionVerification,
    value.sourceCommit,
    value.promotionProvenanceSha256,
  );
  const policy = validateFrontendReleasePolicy(readJson(defaultPolicyPath));
  assertProductionFrontendReleasePolicy(policy);
  if (value.policySha256 !== sha256Canonical(policy)) {
    throw new Error(`The ${label} frontend vantage is bound to a different reviewed policy.`);
  }
  if (!Array.isArray(value.origins) || value.origins.length !== policy.deploymentOrigins.length) {
    throw new Error(`The ${label} frontend vantage omits exact apex/www observations.`);
  }
  const expectedProfiles = HTTP_USER_AGENT_PROFILES.map(({ id }) => id);
  const allowedOrigins = new Set(policy.deploymentOrigins);
  const originProfileDigests = [];
  for (let originIndex = 0; originIndex < policy.deploymentOrigins.length; originIndex += 1) {
    const origin = value.origins[originIndex];
    assertExactKeys(origin, ["origin", "profiles"], `${label} frontend origin ${originIndex}`);
    if (origin.origin !== policy.deploymentOrigins[originIndex]) {
      throw new Error(`The ${label} frontend observations are not exact ordered apex/www origins.`);
    }
    if (!Array.isArray(origin.profiles) || origin.profiles.length !== expectedProfiles.length) {
      throw new Error(`The ${label} ${origin.origin} observation omits reviewed profiles.`);
    }
    const digests = origin.profiles.map((profile, profileIndex) => validateFrontendProfileEvidence(
      profile,
      expectedProfiles[profileIndex],
      origin.origin,
      value.publicArtifactsSha256,
      policy,
      allowedOrigins,
      `${label} ${origin.origin} ${expectedProfiles[profileIndex]}`,
    ));
    if (new Set(digests).size !== 1) {
      throw new Error(`The ${label} ${origin.origin} HTTP profiles are not byte/schema equivalent.`);
    }
    originProfileDigests.push(digests);
  }
  if (!originProfileDigests.slice(1).every((digests) => arraysEqual(originProfileDigests[0], digests))) {
    throw new Error(`The ${label} apex/www observations are not byte/schema equivalent.`);
  }
  const capturedThirdPartyOrigins = [...new Set(
    value.origins.flatMap(({ profiles }) => profiles.flatMap(({ routes }) =>
      routes.flatMap(({ thirdPartyOrigins }) => thirdPartyOrigins))),
  )].sort();
  if (!arraysEqual(value.capturedThirdPartyOrigins, capturedThirdPartyOrigins)) {
    throw new Error(`The ${label} captured third-party origin summary is incomplete.`);
  }
  const observationSha256 = sha256Canonical(normalizedFrontendObservation(value.origins));
  if (value.observationSha256 !== observationSha256) {
    throw new Error(`The ${label} frontend observation digest is invalid.`);
  }
  const servedReleaseSha256 = sha256Canonical({
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
    observationSha256,
  });
  if (value.servedReleaseSha256 !== servedReleaseSha256) {
    throw new Error(`The ${label} frontend served-release digest is invalid.`);
  }
  const { evidenceSha256, ...payload } = value;
  if (evidenceSha256 !== sha256Canonical(payload)) {
    throw new Error(`The ${label} frontend vantage evidence digest is invalid.`);
  }
  return value;
}

export function compareFrontendVantageEvidence(left, right) {
  validateFrontendVantageEvidence(left, "left");
  validateFrontendVantageEvidence(right, "right");
  if (left.verificationProfile !== right.verificationProfile) {
    throw new Error("Independent frontend vantages use different verification profiles.");
  }
  const expectedVantageIds = vantageIdsForVerification(left.verificationProfile);
  if (
    new Set([left.vantageId, right.vantageId]).size !== expectedVantageIds.length ||
    expectedVantageIds.some((vantageId) => ![left.vantageId, right.vantageId].includes(vantageId))
  ) throw new Error("Independent served parity requires the exact verification-profile vantage IDs.");
  if (Math.abs(Date.parse(left.checkedAt) - Date.parse(right.checkedAt)) > MAXIMUM_PRODUCTION_PARITY_DELAY_MS) {
    throw new Error("Independent frontend vantages exceed the reviewed 30-minute timestamp skew.");
  }
  for (const field of [
    "verificationProfile", "releaseProfile", "sourceCommit", "reviewPayloadSha256", "policySha256", "publicArtifactsSha256",
    "manifestSha256", "promotedAt", "deploymentId", "promotionEvidenceSha256",
    "promotionProvenanceSha256", "observationSha256", "servedReleaseSha256",
  ]) {
    if (left[field] !== right[field]) throw new Error(`Independent vantage evidence differs at ${field}.`);
  }
  if (left.promotionVerification.bindingSha256 !== right.promotionVerification.bindingSha256) {
    throw new Error("Independent vantage evidence differs at promotionVerification.");
  }
  const payload = {
    kind: "lester-labs-independent-vantage-comparison",
    schemaVersion: 3,
    verificationProfile: left.verificationProfile,
    releaseProfile: left.releaseProfile,
    sourceCommit: left.sourceCommit,
    manifestSha256: left.manifestSha256,
    leftVantageId: left.vantageId,
    rightVantageId: right.vantageId,
    servedReleaseSha256: left.servedReleaseSha256,
    identical: true,
  };
  return { ...payload, evidenceSha256: sha256Canonical(payload) };
}

function parseOptions(argumentsList) {
  const options = new Map();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!name?.startsWith("--") || !value || options.has(name)) {
      throw new Error(`Invalid or duplicate command-line option ${JSON.stringify(name)}.`);
    }
    options.set(name, value);
  }
  for (const name of options.keys()) {
    if (![
      "--manifest", "--policy", "--output", "--vantage-id", "--approval-evidence-dir",
      "--expected-source-commit", "--promotion-evidence", "--promotion-provenance",
      "--promotion-verification", "--verification-profile",
    ].includes(name)) {
      throw new Error(`Unknown option ${name}.`);
    }
  }
  return options;
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList[0] === "compare") {
    if (argumentsList.length !== 3) {
      throw new Error("Usage: verify-frontend-release-parity.mjs compare VANTAGE_ONE.json VANTAGE_TWO.json");
    }
    console.log(canonicalJson(compareFrontendVantageEvidence(
      readJson(resolve(argumentsList[1])),
      readJson(resolve(argumentsList[2])),
    )).trimEnd());
    return;
  }
  const options = parseOptions(argumentsList);
  if (options.get("--promotion-verification") !== "-") {
    throw new Error(
      "Production frontend parity requires --promotion-verification - from a pipefail-protected gh verification pipe.",
    );
  }
  const promotionEvidencePath = options.get("--promotion-evidence");
  const promotionProvenancePath = options.get("--promotion-provenance");
  if (!promotionEvidencePath || !promotionProvenancePath) {
    throw new Error("Production frontend parity requires exact promotion evidence and provenance paths.");
  }
  const result = await verifyFrontendReleaseParity({
    manifestPath: resolve(options.get("--manifest") ?? defaultManifestPath),
    policyPath: resolve(options.get("--policy") ?? defaultPolicyPath),
    vantageId: options.get("--vantage-id"),
    verificationProfile: options.get("--verification-profile"),
    approvalEvidenceDirectory: options.has("--approval-evidence-dir")
      ? resolve(options.get("--approval-evidence-dir"))
      : undefined,
    expectedSourceCommit: options.get("--expected-source-commit"),
    promotionEvidenceBytes: readFileSync(resolve(promotionEvidencePath)),
    promotionProvenanceBytes: readFileSync(resolve(promotionProvenancePath)),
    promotionVerificationBytes: readFileSync(0),
  });
  const rendered = canonicalJson(result);
  const output = options.get("--output");
  if (output) {
    const outputPath = resolve(output);
    writeFileSync(outputPath, rendered, { flag: "wx" });
    console.log(`Served frontend parity verified; evidence ${result.evidenceSha256} written to ${outputPath}.`);
  } else {
    console.log(rendered.trimEnd());
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
