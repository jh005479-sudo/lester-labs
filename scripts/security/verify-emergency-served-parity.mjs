#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertExactKeys,
  canonicalJson,
  readJson,
  sha256Bytes,
  sha256Canonical,
} from "./frontend-release-common.mjs";
import { HTTP_USER_AGENT_PROFILES } from "./verify-frontend-release-parity.mjs";
import { verifyEmergencyContainment } from "./verify-emergency-containment.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_SOURCE_DIRECTORY = join(repositoryRoot, "emergency-site");
const MAXIMUM_RESPONSE_BYTES = 512 * 1024;
const MAXIMUM_PROMOTION_EVIDENCE_BYTES = 1024 * 1024;
const MAXIMUM_PROMOTION_PROVENANCE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_PROMOTION_VERIFICATION_BYTES = 32 * 1024 * 1024;
const MAXIMUM_REDIRECTS = 3;
const MAXIMUM_VANTAGE_SKEW_MS = 30 * 60 * 1000;
const PRODUCTION_ORIGINS = Object.freeze([
  "https://lester-labs.com",
  "https://www.lester-labs.com",
]);
const PRODUCTION_DOMAINS = Object.freeze([
  "lester-labs.com",
  "www.lester-labs.com",
]);
const PRODUCTION_VANTAGE_IDS = Object.freeze([
  "protected-eu-network",
  "protected-us-network",
]);
const EMERGENCY_RESULT_FIELDS = Object.freeze([
  "artifactBytesMatch",
  "securityHeadersMatch",
  "profilesEquivalent",
  "originsEquivalent",
  "inactiveWalletRoutes",
  "noCookiesOrLongLivedCredentials",
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
const FORBIDDEN_REQUEST_HEADERS = new Set(["authorization", "cookie", "proxy-authorization"]);
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;
const ZERO_TRANSACTION_HASH = `0x${"0".repeat(64)}`;
const REVIEWED_POLICY_ADDRESS = "0xa5111cedc04554676dbcca39f2268070008c7a8a";
const REVIEWED_POLICY_LAUNCHPAD_ADDRESS = "0xa533bbe87bdcd91e4367de517e99bf8ba75fd0ab";
const REVIEWED_POLICY_TRANSACTION_HASH =
  "0xb1bfd0d18b8baed580ebbf405c240db36a49ef94d2bb591e7203a88525f32ebf";
export const EMERGENCY_DENIED_ROUTE_PROBES = Object.freeze([
  "/vercel.json",
  "/sw.js",
  "/service-worker.js",
  "/_next/static/chunks/main.js",
  "/_next/data/containment/index.json",
  "/_next/server/app-paths-manifest.json",
  "/airdrop",
  `/airdrop?mode=token&token=${ZERO_ADDRESS}`,
  "/governance",
  "/governance?proposal=0",
  "/launch",
  "/launch?template=erc20",
  "/swap",
  `/swap?inputCurrency=native&outputCurrency=${ZERO_ADDRESS}`,
  "/launchpad",
  `/launchpad/${REVIEWED_POLICY_LAUNCHPAD_ADDRESS}`,
  `/launchpad/${ZERO_ADDRESS}`,
  `/launchpad/${ZERO_ADDRESS}?tab=recover`,
  "/ledger",
  "/ledger?page=1",
  "/litvm-airdrop",
  "/litvm-dex",
  "/litvm-launchpad",
  "/litvm-swap",
  "/litvm-testnet",
  "/locker",
  "/locker?deployment=legacy&lockId=0",
  "/pool",
  `/pool?q=${ZERO_ADDRESS}`,
  "/portfolio",
  `/portfolio?address=${ZERO_ADDRESS}`,
  "/vesting",
  `/vesting?wallet=${ZERO_ADDRESS}`,
  "/analytics",
  `/analytics/token/${REVIEWED_POLICY_ADDRESS}`,
  `/analytics/token/${ZERO_ADDRESS}`,
  "/charts",
  "/docs",
  "/embed/stats",
  "/explorer",
  `/explorer/address/${REVIEWED_POLICY_ADDRESS}`,
  `/explorer/address/${ZERO_ADDRESS}`,
  "/explorer/block/1",
  "/explorer/block/0",
  "/explorer/health",
  `/explorer/token/${REVIEWED_POLICY_ADDRESS}`,
  `/explorer/token/${ZERO_ADDRESS}`,
  "/explorer/tokens",
  `/explorer/tx/${REVIEWED_POLICY_TRANSACTION_HASH}`,
  `/explorer/tx/${ZERO_TRANSACTION_HASH}`,
  "/security",
  "/sitemap.xml",
  "/tutorials",
  "/tutorials/what-is-litvm",
  "/tutorials/how-to-use-dex-swap",
  "/api",
  "/api/platform-stats",
  "/api/explorer/summary?stage=blocks",
  "/api/explorer/summary?stage=transactions",
  "/api/airdrop",
  "/api/airdrop/claim",
  "/api/claim",
  "/api/governance",
  "/api/launch",
  "/api/launchpad",
  "/api/ledger",
  "/api/locker",
  "/api/pool",
  "/api/swap",
  "/api/transactions",
  "/api/transactions/prepare",
  "/api/vesting",
  "/api/wallet",
  "/api/wallet/connect",
]);
if (new Set(EMERGENCY_DENIED_ROUTE_PROBES).size !== EMERGENCY_DENIED_ROUTE_PROBES.length) {
  throw new Error("Emergency denied-route probes must remain unique.");
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

function normalizeOrigins(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 2) {
    throw new Error("Emergency served parity requires one or two explicit origins.");
  }
  const origins = values.map((value, index) => {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`Emergency parity origin ${index} is invalid.`);
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.hostname.length > 253
    ) throw new Error(`Emergency parity origin ${index} must be a bare HTTPS origin.`);
    return parsed.origin;
  });
  if (new Set(origins).size !== origins.length) {
    throw new Error("Emergency parity origins must be unique.");
  }
  return origins;
}

function normalizeHeaders(headers) {
  const result = {};
  for (const [name, value] of headers.entries()) result[name.toLowerCase()] = value;
  return result;
}

async function boundedBody(response) {
  const renderedLength = response.headers.get("content-length");
  if (
    renderedLength !== null &&
    (!/^(?:0|[1-9][0-9]{0,8})$/u.test(renderedLength) || Number(renderedLength) > MAXIMUM_RESPONSE_BYTES)
  ) throw new Error("Emergency parity response exceeds its reviewed byte limit.");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAXIMUM_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Emergency parity response exceeds its reviewed byte limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length);
}

function requestHeaders(profile, trustedOidcToken) {
  const headers = {
    accept: "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.5",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "user-agent": profile.userAgent,
  };
  if (trustedOidcToken !== undefined) {
    if (
      typeof trustedOidcToken !== "string" ||
      trustedOidcToken.length < 64 ||
      trustedOidcToken.length > 16_384 ||
      /[\u0000-\u0020\u007f]/u.test(trustedOidcToken)
    ) throw new Error("The short-lived Vercel Trusted Sources OIDC token is malformed.");
    headers["x-vercel-trusted-oidc-idp-token"] = trustedOidcToken;
  }
  for (const name of Object.keys(headers)) {
    if (FORBIDDEN_REQUEST_HEADERS.has(name)) throw new Error(`Forbidden emergency request header ${name}.`);
  }
  return headers;
}

async function fetchControlled(startUrl, {
  allowedOrigins,
  fetchImpl,
  profile,
  trustedOidcToken,
}) {
  let current = new URL(startUrl);
  const redirects = [];
  for (let attempt = 0; attempt <= MAXIMUM_REDIRECTS; attempt += 1) {
    if (!allowedOrigins.has(current.origin)) {
      throw new Error(`Emergency parity refused redirect outside reviewed origins: ${current.origin}.`);
    }
    const response = await fetchImpl(current, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: requestHeaders(profile, trustedOidcToken),
      signal: AbortSignal.timeout(30_000),
    });
    const headers = normalizeHeaders(response.headers);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || attempt === MAXIMUM_REDIRECTS) {
        throw new Error("Emergency parity received an invalid or excessive redirect chain.");
      }
      const next = new URL(location, current);
      if (!allowedOrigins.has(next.origin) || next.protocol !== "https:") {
        throw new Error("Emergency parity redirect escaped the reviewed HTTPS origins.");
      }
      if (next.pathname !== current.pathname || next.search !== current.search) {
        throw new Error("Emergency parity redirect changed the exact reviewed route or query.");
      }
      redirects.push({ status: response.status, from: current.href, to: next.href });
      current = next;
      continue;
    }
    return {
      requestedUrl: startUrl,
      finalUrl: current.href,
      status: response.status,
      headers,
      redirects,
      bytes: await boundedBody(response),
    };
  }
  throw new Error("Emergency parity exhausted its redirect bound.");
}

function exactHeaderPolicy(sourceDirectory) {
  const configuration = JSON.parse(readFileSync(join(sourceDirectory, "vercel.json"), "utf8"));
  return Object.fromEntries(
    configuration.headers[0].headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );
}

function assertHeaders(observation, expectedHeaders, label) {
  for (const [name, expected] of Object.entries(expectedHeaders)) {
    if (observation.headers[name] !== expected) {
      throw new Error(`${label} response header ${name} differs from the signed containment policy.`);
    }
  }
  if (Object.hasOwn(observation.headers, "set-cookie")) {
    throw new Error(`${label} unexpectedly sets a cookie.`);
  }
  return Object.fromEntries(Object.keys(expectedHeaders).sort().map((name) => [name, observation.headers[name]]));
}

function publicObservation(value) {
  return {
    path: new URL(value.requestedUrl).pathname,
    finalUrl: value.finalUrl,
    status: value.status,
    redirects: value.redirects,
    bytes: value.bytes.length,
    bodySha256: sha256Bytes(value.bytes),
    contentType: value.headers["content-type"] ?? "",
  };
}

export async function observeEmergencyServedParity({
  origins,
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
  fetchImpl = globalThis.fetch,
  trustedOidcToken,
} = {}) {
  verifyEmergencyContainment({ root: sourceDirectory });
  if (typeof fetchImpl !== "function") throw new Error("Emergency parity requires a fetch implementation.");
  const normalizedOrigins = normalizeOrigins(origins);
  const allowedOrigins = new Set(normalizedOrigins);
  const expectedHeaders = exactHeaderPolicy(sourceDirectory);
  const expectedFiles = Object.freeze({
    "/": readFileSync(join(sourceDirectory, "index.html")),
    "/index.html": readFileSync(join(sourceDirectory, "index.html")),
    "/robots.txt": readFileSync(join(sourceDirectory, "robots.txt")),
    "/.well-known/security.txt": readFileSync(join(sourceDirectory, ".well-known/security.txt")),
  });
  const observations = [];
  for (const origin of normalizedOrigins) {
    const profiles = [];
    for (const profile of HTTP_USER_AGENT_PROFILES) {
      const files = [];
      for (const [path, expectedBytes] of Object.entries(expectedFiles)) {
        const response = await fetchControlled(new URL(path, origin).href, {
          allowedOrigins,
          fetchImpl,
          profile,
          trustedOidcToken,
        });
        if (response.status !== 200 || !response.bytes.equals(expectedBytes)) {
          throw new Error(`Emergency response ${origin}${path} does not byte-match the signed artifact.`);
        }
        files.push({
          ...publicObservation(response),
          securityHeaders: assertHeaders(response, expectedHeaders, `${origin}${path}`),
        });
      }
      const inactivePaths = [];
      for (const path of EMERGENCY_DENIED_ROUTE_PROBES) {
        const response = await fetchControlled(new URL(path, origin).href, {
          allowedOrigins,
          fetchImpl,
          profile,
          trustedOidcToken,
        });
        if (response.status !== 404) {
          throw new Error(`Emergency response ${origin}${path} must remain inactive with status 404.`);
        }
        const final = new URL(response.finalUrl);
        inactivePaths.push({
          path,
          finalPath: `${final.pathname}${final.search}`,
          status: response.status,
          bytes: response.bytes.length,
          bodySha256: sha256Bytes(response.bytes),
          contentType: response.headers["content-type"] ?? "",
          securityHeaders: assertHeaders(response, expectedHeaders, `${origin}${path}`),
        });
      }
      const profilePayload = {
        files: files.map((file) => ({
          path: file.path,
          finalPath: new URL(file.finalUrl).pathname,
          status: file.status,
          bytes: file.bytes,
          bodySha256: file.bodySha256,
          contentType: file.contentType,
          securityHeaders: file.securityHeaders,
        })),
        inactivePaths,
      };
      profiles.push({
        profile: profile.id,
        ...profilePayload,
        profileEvidenceSha256: sha256Canonical(profilePayload),
      });
    }
    if (new Set(profiles.map(({ profileEvidenceSha256 }) => profileEvidenceSha256)).size !== 1) {
      throw new Error(`${origin} varies emergency artifact behavior by HTTP request profile.`);
    }
    observations.push({ origin, profiles });
  }
  const contentDigests = observations.map(({ profiles }) => profiles[0].profileEvidenceSha256);
  if (new Set(contentDigests).size !== 1) {
    throw new Error("Emergency origins do not serve equivalent signed containment behavior.");
  }
  return {
    artifactBytesMatch: true,
    securityHeadersMatch: true,
    profilesEquivalent: true,
    originsEquivalent: true,
    inactiveWalletRoutes: true,
    noCookiesOrLongLivedCredentials: true,
    observations,
    observationSha256: sha256Canonical(observations),
  };
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

function parsePromotionBundles(bytes) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length === 0 ||
    bytes.length > MAXIMUM_PROMOTION_PROVENANCE_BYTES
  ) throw new Error("Emergency promotion provenance is empty or exceeds its reviewed byte limit.");
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new Error("Emergency promotion provenance is not valid UTF-8 JSONL.");
  }
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  if (lines.length !== 1 || lines[0].trim().length === 0) {
    throw new Error("Emergency promotion provenance must contain exactly one Sigstore JSONL bundle.");
  }
  let bundle;
  try {
    bundle = JSON.parse(lines[0]);
  } catch {
    throw new Error("Emergency promotion provenance is not valid Sigstore JSONL.");
  }
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new Error("Emergency promotion provenance bundle is not a JSON object.");
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
  const provenanceBundle = parsePromotionBundles(promotionProvenanceBytes);
  const verification = parseJsonBytes(
    promotionVerificationBytes,
    "GitHub promotion-attestation verification result",
    MAXIMUM_PROMOTION_VERIFICATION_BYTES,
  );
  if (!Array.isArray(verification) || verification.length !== 1) {
    throw new Error("GitHub promotion-attestation verification must contain exactly one verified attestation.");
  }
  const entry = verification[0];
  assertExactKeys(entry, ["attestation", "verificationResult"], "GitHub promotion verification entry");
  if (!entry.attestation || typeof entry.attestation !== "object" || Array.isArray(entry.attestation)) {
    throw new Error("GitHub promotion verification omits its verified attestation bundle.");
  }
  if (sha256Canonical(entry.attestation.bundle) !== sha256Canonical(provenanceBundle)) {
    throw new Error("GitHub promotion verification is bound to different provenance bytes.");
  }
  const result = entry.verificationResult;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("GitHub promotion verification omits its machine-verifiable result.");
  }
  requiredString(result.mediaType, "GitHub verification-result media type", {
    exact: SIGSTORE_VERIFICATION_RESULT_MEDIA_TYPE,
  });
  const statement = result.statement;
  if (!statement || typeof statement !== "object" || Array.isArray(statement)) {
    throw new Error("GitHub promotion verification omits its in-toto statement.");
  }
  requiredString(statement._type, "Promotion in-toto statement type", {
    exact: "https://in-toto.io/Statement/v1",
  });
  requiredString(statement.predicateType, "Promotion attestation predicate type", {
    exact: SLSA_PROVENANCE_PREDICATE,
  });
  if (!Array.isArray(statement.subject) || statement.subject.length !== 1) {
    throw new Error("Promotion attestation must contain exactly one subject.");
  }
  const [subject] = statement.subject;
  if (!subject || typeof subject !== "object" || Array.isArray(subject)) {
    throw new Error("Promotion attestation subject is invalid.");
  }
  requiredString(subject.name, "Promotion attestation subject name");
  if (
    !subject.digest ||
    typeof subject.digest !== "object" ||
    Array.isArray(subject.digest) ||
    subject.digest.sha256 !== subjectSha256
  ) throw new Error("Promotion attestation subject digest does not match the exact promotion evidence bytes.");

  const certificate = result.signature?.certificate;
  if (!certificate || typeof certificate !== "object" || Array.isArray(certificate)) {
    throw new Error("GitHub promotion verification omits its verified signing certificate.");
  }
  requiredString(certificate.issuer, "Promotion certificate OIDC issuer", {
    exact: "https://token.actions.githubusercontent.com",
  });
  requiredString(certificate.sourceRepositoryURI, "Promotion certificate source repository", {
    exact: REVIEWED_SOURCE_REPOSITORY_URI,
  });
  requiredString(certificate.sourceRepositoryRef, "Promotion certificate source ref", {
    exact: REVIEWED_SOURCE_REF,
  });
  requiredString(certificate.sourceRepositoryDigest, "Promotion certificate source commit", {
    exact: sourceCommit,
  });
  requiredString(certificate.subjectAlternativeName, "Promotion certificate workflow identity", {
    exact: REVIEWED_PROMOTION_SIGNER_URI,
  });
  requiredString(certificate.buildSignerURI, "Promotion certificate signer workflow", {
    exact: REVIEWED_PROMOTION_SIGNER_URI,
  });
  requiredString(certificate.buildSignerDigest, "Promotion certificate signer commit", {
    exact: sourceCommit,
  });
  requiredString(certificate.buildConfigURI, "Promotion certificate build workflow", {
    exact: REVIEWED_PROMOTION_SIGNER_URI,
  });
  requiredString(certificate.buildConfigDigest, "Promotion certificate build commit", {
    exact: sourceCommit,
  });
  requiredString(certificate.runnerEnvironment, "Promotion certificate runner environment", {
    exact: "github-hosted",
  });
  if (!Array.isArray(result.verifiedTimestamps) || result.verifiedTimestamps.length === 0) {
    throw new Error("GitHub promotion verification has no cryptographically verified timestamp.");
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
    ) throw new Error("GitHub promotion verification contains an invalid verified timestamp.");
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

function validateEmergencyPromotionEvidence(value, expectedSourceCommit) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "status", "promotedAt", "sourceCommit", "artifactKind",
    "manifestSha256", "artifactSha256", "stageEvidenceSha256", "stageProvenanceSha256",
    "promotionApprovalSha256", "promotionApprovalProvenanceSha256", "parityEvidenceSha256",
    "parityProvenanceSha256", "confirmation", "project", "deployment", "priorDeploymentId",
    "rollbackDisposition", "evidenceSha256",
  ], "Emergency promotion evidence");
  if (
    value.kind !== "lester-labs-vercel-promotion-evidence" ||
    value.schemaVersion !== 2 ||
    value.status !== "CURRENT" ||
    !["DIRECT", "RECOVERED_AFTER_AMBIGUOUS_RESPONSE"].includes(value.confirmation) ||
    value.artifactKind !== "emergency-static" ||
    value.sourceCommit !== expectedSourceCommit ||
    typeof value.promotedAt !== "string"
  ) throw new Error("Emergency production parity is bound to a different promotion.");
  canonicalTimestamp(value.promotedAt, "Emergency promotion timestamp");
  const { evidenceSha256, ...payload } = value;
  if (!/^[0-9a-f]{64}$/u.test(evidenceSha256) || evidenceSha256 !== sha256Canonical(payload)) {
    throw new Error("Emergency promotion evidence digest is invalid.");
  }
  for (const field of [
    "manifestSha256", "artifactSha256", "stageEvidenceSha256", "stageProvenanceSha256",
    "promotionApprovalSha256", "promotionApprovalProvenanceSha256", "parityEvidenceSha256",
    "parityProvenanceSha256",
  ]) {
    if (!/^[0-9a-f]{64}$/u.test(value[field])) throw new Error(`Emergency promotion ${field} is invalid.`);
  }
  assertExactKeys(value.project, ["teamId", "projectId", "name", "autoAssignCustomDomains"], "Emergency promotion project");
  if (
    typeof value.project.teamId !== "string" ||
    !/^team_[A-Za-z0-9]{8,80}$/u.test(value.project.teamId) ||
    typeof value.project.projectId !== "string" ||
    !/^prj_[A-Za-z0-9]{8,80}$/u.test(value.project.projectId) ||
    typeof value.project.name !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/u.test(value.project.name) ||
    value.project.autoAssignCustomDomains !== false
  ) {
    throw new Error("Emergency promotion project identity or domain-assignment policy is invalid.");
  }
  assertExactKeys(value.deployment, [
    "id", "url", "target", "readyState", "readySubstate", "aliasAssigned", "aliases",
  ], "Emergency promoted deployment");
  let deploymentUrl;
  try {
    deploymentUrl = new URL(value.deployment.url);
  } catch {
    throw new Error("Emergency promoted deployment URL is invalid.");
  }
  if (
    !/^dpl_[A-Za-z0-9]{8,96}$/u.test(value.deployment.id) ||
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
    !Array.isArray(value.deployment.aliases) ||
    canonicalJson(value.deployment.aliases) !== canonicalJson(PRODUCTION_DOMAINS)
  ) throw new Error("Emergency promotion evidence does not bind both current production aliases.");
  if (!/^dpl_[A-Za-z0-9]{8,96}$/u.test(value.priorDeploymentId) || value.priorDeploymentId === value.deployment.id) {
    throw new Error("Emergency promotion prior deployment identity is invalid.");
  }
  assertExactKeys(value.rollbackDisposition, [
    "mode", "priorClassification", "targetDeploymentId", "safetyEvidence",
  ], "Emergency promotion rollback disposition");
  if (
    value.rollbackDisposition.mode !== "HOLD_PROMOTED" ||
    value.rollbackDisposition.priorClassification !== "UNSAFE_PRECONTAINMENT" ||
    value.rollbackDisposition.targetDeploymentId !== null ||
    value.rollbackDisposition.safetyEvidence !== null
  ) {
    throw new Error(
      "Emergency production parity requires a hold-promoted disposition and must not authorize pre-containment rollback.",
    );
  }
  return value;
}

export async function verifyEmergencyProductionParity({
  promotionEvidenceBytes,
  promotionProvenanceBytes,
  promotionVerificationBytes,
  expectedSourceCommit,
  vantageId,
  origins = PRODUCTION_ORIGINS,
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
  fetchImpl = globalThis.fetch,
  checkedAt = new Date().toISOString(),
} = {}) {
  requiredString(expectedSourceCommit, "Expected emergency source commit", {
    pattern: /^[0-9a-f]{40}$/u,
  });
  const parsedPromotion = parseJsonBytes(
    promotionEvidenceBytes,
    "Canonical emergency promotion evidence",
    MAXIMUM_PROMOTION_EVIDENCE_BYTES,
  );
  if (canonicalJson(parsedPromotion) !== promotionEvidenceBytes.toString("utf8")) {
    throw new Error("Emergency promotion evidence must use canonical JSON bytes.");
  }
  const promotion = validateEmergencyPromotionEvidence(
    parsedPromotion,
    expectedSourceCommit,
  );
  const promotionVerification = validatePromotionVerification({
    promotionEvidenceBytes,
    promotionProvenanceBytes,
    promotionVerificationBytes,
    sourceCommit: expectedSourceCommit,
  });
  const productionOrigins = normalizeOrigins(origins);
  if (
    productionOrigins.length !== PRODUCTION_ORIGINS.length ||
    PRODUCTION_ORIGINS.some((origin) => !productionOrigins.includes(origin))
  ) throw new Error("Emergency production parity requires the exact reviewed apex and www origins.");
  if (!PRODUCTION_VANTAGE_IDS.includes(vantageId)) {
    throw new Error("Emergency production parity requires a reviewed EU or US vantage ID.");
  }
  canonicalTimestamp(checkedAt, "Emergency production parity timestamp");
  if (Date.parse(checkedAt) < Date.parse(promotion.promotedAt)) {
    throw new Error("Emergency production parity cannot predate the exact signed promotion.");
  }
  const observation = await observeEmergencyServedParity({
    origins: productionOrigins,
    sourceDirectory,
    fetchImpl,
  });
  const results = {
    artifactBytesMatch: observation.artifactBytesMatch,
    securityHeadersMatch: observation.securityHeadersMatch,
    profilesEquivalent: observation.profilesEquivalent,
    originsEquivalent: observation.originsEquivalent,
    inactiveWalletRoutes: observation.inactiveWalletRoutes,
    noCookiesOrLongLivedCredentials: observation.noCookiesOrLongLivedCredentials,
  };
  if (Object.values(results).some((result) => result !== true)) {
    throw new Error("Emergency production parity did not pass every reviewed result.");
  }
  const servedReleaseSha256 = sha256Canonical({
    sourceCommit: promotion.sourceCommit,
    artifactSha256: promotion.artifactSha256,
    deploymentId: promotion.deployment.id,
    observationSha256: observation.observationSha256,
  });
  const payload = {
    kind: "lester-labs-served-emergency-parity",
    schemaVersion: 1,
    checkedAt,
    vantageId,
    sourceCommit: promotion.sourceCommit,
    artifactSha256: promotion.artifactSha256,
    deploymentId: promotion.deployment.id,
    promotionEvidenceSha256: promotion.evidenceSha256,
    promotionProvenanceSha256: promotionVerification.provenanceSha256,
    promotionVerification,
    servedReleaseSha256,
    results,
    observations: observation.observations,
  };
  return { ...payload, evidenceSha256: sha256Canonical(payload) };
}

function validatePromotionVerificationBinding(value, sourceCommit, provenanceSha256) {
  assertExactKeys(value, [
    "verifier", "predicateType", "subjectSha256", "provenanceSha256",
    "verificationResultSha256", "repository", "signerWorkflow", "sourceRef",
    "sourceCommit", "signerCommit", "runnerEnvironment", "bindingSha256",
  ], "Emergency promotion-verification binding");
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
  ) throw new Error("Emergency promotion-verification binding names a different trust policy.");
  for (const [digest, label] of [
    [value.subjectSha256, "subject"],
    [value.provenanceSha256, "provenance"],
    [value.verificationResultSha256, "verification result"],
    [bindingSha256, "binding"],
  ]) {
    if (!/^[0-9a-f]{64}$/u.test(digest)) {
      throw new Error(`Emergency promotion-verification ${label} digest is invalid.`);
    }
  }
  if (bindingSha256 !== sha256Canonical(payload)) {
    throw new Error("Emergency promotion-verification binding digest is invalid.");
  }
  return value;
}

function validateSha256(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function expectedEmergencyFileEvidence() {
  return [
    ["/", readFileSync(join(DEFAULT_SOURCE_DIRECTORY, "index.html"))],
    ["/index.html", readFileSync(join(DEFAULT_SOURCE_DIRECTORY, "index.html"))],
    ["/robots.txt", readFileSync(join(DEFAULT_SOURCE_DIRECTORY, "robots.txt"))],
    [
      "/.well-known/security.txt",
      readFileSync(join(DEFAULT_SOURCE_DIRECTORY, ".well-known/security.txt")),
    ],
  ].map(([path, bytes]) => ({
    path,
    finalPath: path,
    status: 200,
    bytes: bytes.length,
    bodySha256: sha256Bytes(bytes),
    contentTypePrefix: path.endsWith(".txt") ? "text/plain" : "text/html",
  }));
}

function validateRecordedSecurityHeaders(value, expectedHeaders, label) {
  assertExactKeys(value, Object.keys(expectedHeaders), label);
  for (const [name, expected] of Object.entries(expectedHeaders)) {
    if (value[name] !== expected) throw new Error(`${label} differs at ${name}.`);
  }
}

function validateEmergencyProfile(profile, expectedProfileId, expectedFiles, expectedHeaders, label) {
  assertExactKeys(profile, [
    "profile", "files", "inactivePaths", "profileEvidenceSha256",
  ], label);
  if (profile.profile !== expectedProfileId) {
    throw new Error(`${label} uses an unexpected HTTP request profile.`);
  }
  if (!Array.isArray(profile.files) || profile.files.length !== expectedFiles.length) {
    throw new Error(`${label} omits reviewed emergency files.`);
  }
  for (let index = 0; index < expectedFiles.length; index += 1) {
    const file = profile.files[index];
    const expected = expectedFiles[index];
    assertExactKeys(file, [
      "path", "finalPath", "status", "bytes", "bodySha256", "contentType", "securityHeaders",
    ], `${label} file ${index}`);
    if (
      file.path !== expected.path ||
      file.finalPath !== expected.finalPath ||
      file.status !== expected.status ||
      file.bytes !== expected.bytes ||
      file.bodySha256 !== expected.bodySha256 ||
      typeof file.contentType !== "string" ||
      !file.contentType.toLowerCase().startsWith(expected.contentTypePrefix)
    ) throw new Error(`${label} file ${expected.path} differs from the exact containment artifact.`);
    validateRecordedSecurityHeaders(
      file.securityHeaders,
      expectedHeaders,
      `${label} file ${expected.path} security headers`,
    );
  }
  if (
    !Array.isArray(profile.inactivePaths) ||
    profile.inactivePaths.length !== EMERGENCY_DENIED_ROUTE_PROBES.length
  ) throw new Error(`${label} omits reviewed retired-route probes.`);
  for (let index = 0; index < EMERGENCY_DENIED_ROUTE_PROBES.length; index += 1) {
    const inactive = profile.inactivePaths[index];
    const expectedPath = EMERGENCY_DENIED_ROUTE_PROBES[index];
    assertExactKeys(inactive, [
      "path", "finalPath", "status", "bytes", "bodySha256", "contentType", "securityHeaders",
    ], `${label} retired-route probe ${index}`);
    if (
      inactive.path !== expectedPath ||
      inactive.finalPath !== expectedPath ||
      inactive.status !== 404 ||
      !Number.isSafeInteger(inactive.bytes) ||
      inactive.bytes < 0 ||
      typeof inactive.contentType !== "string"
    ) throw new Error(`${label} retired route ${expectedPath} is not proven inactive.`);
    validateSha256(inactive.bodySha256, `${label} retired route ${expectedPath} body`);
    validateRecordedSecurityHeaders(
      inactive.securityHeaders,
      expectedHeaders,
      `${label} retired route ${expectedPath} security headers`,
    );
  }
  validateSha256(profile.profileEvidenceSha256, `${label} profile evidence`);
  if (profile.profileEvidenceSha256 !== sha256Canonical({
    files: profile.files,
    inactivePaths: profile.inactivePaths,
  })) throw new Error(`${label} profile evidence digest is invalid.`);
  return profile.profileEvidenceSha256;
}

function validateEmergencyVantageEvidence(value, label) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "checkedAt", "vantageId", "sourceCommit", "artifactSha256",
    "deploymentId", "promotionEvidenceSha256", "promotionProvenanceSha256",
    "promotionVerification", "servedReleaseSha256", "results", "observations", "evidenceSha256",
  ], `${label} emergency vantage evidence`);
  if (value.kind !== "lester-labs-served-emergency-parity" || value.schemaVersion !== 1) {
    throw new Error(`The ${label} emergency vantage kind or schema is invalid.`);
  }
  canonicalTimestamp(value.checkedAt, `${label} emergency vantage timestamp`);
  if (!PRODUCTION_VANTAGE_IDS.includes(value.vantageId)) {
    throw new Error(`The ${label} emergency vantage ID is not a reviewed independent vantage.`);
  }
  if (typeof value.sourceCommit !== "string" || !/^[0-9a-f]{40}$/u.test(value.sourceCommit)) {
    throw new Error(`The ${label} emergency vantage source commit is invalid.`);
  }
  if (typeof value.deploymentId !== "string" || !/^dpl_[A-Za-z0-9]{8,96}$/u.test(value.deploymentId)) {
    throw new Error(`The ${label} emergency vantage deployment ID is invalid.`);
  }
  for (const [digest, digestLabel] of [
    [value.artifactSha256, "artifact"],
    [value.promotionEvidenceSha256, "promotion evidence"],
    [value.promotionProvenanceSha256, "promotion provenance"],
    [value.servedReleaseSha256, "served release"],
    [value.evidenceSha256, "evidence"],
  ]) validateSha256(digest, `${label} emergency vantage ${digestLabel}`);
  validatePromotionVerificationBinding(
    value.promotionVerification,
    value.sourceCommit,
    value.promotionProvenanceSha256,
  );
  assertExactKeys(value.results, EMERGENCY_RESULT_FIELDS, `${label} emergency parity results`);
  if (EMERGENCY_RESULT_FIELDS.some((field) => value.results[field] !== true)) {
    throw new Error(`The ${label} emergency vantage did not pass every required result.`);
  }
  if (!Array.isArray(value.observations) || value.observations.length !== PRODUCTION_ORIGINS.length) {
    throw new Error(`The ${label} emergency vantage omits exact apex/www observations.`);
  }
  const expectedFiles = expectedEmergencyFileEvidence();
  const expectedHeaders = exactHeaderPolicy(DEFAULT_SOURCE_DIRECTORY);
  const expectedProfiles = HTTP_USER_AGENT_PROFILES.map(({ id }) => id);
  const originProfileDigests = [];
  for (let originIndex = 0; originIndex < PRODUCTION_ORIGINS.length; originIndex += 1) {
    const observation = value.observations[originIndex];
    assertExactKeys(observation, ["origin", "profiles"], `${label} origin observation ${originIndex}`);
    if (observation.origin !== PRODUCTION_ORIGINS[originIndex]) {
      throw new Error(`The ${label} emergency vantage observations are not exact ordered apex/www origins.`);
    }
    if (!Array.isArray(observation.profiles) || observation.profiles.length !== expectedProfiles.length) {
      throw new Error(`The ${label} ${observation.origin} observation omits reviewed profiles.`);
    }
    const digests = observation.profiles.map((profile, profileIndex) => validateEmergencyProfile(
      profile,
      expectedProfiles[profileIndex],
      expectedFiles,
      expectedHeaders,
      `${label} ${observation.origin} ${expectedProfiles[profileIndex]}`,
    ));
    if (new Set(digests).size !== 1) {
      throw new Error(`The ${label} ${observation.origin} profiles are not equivalent.`);
    }
    originProfileDigests.push(digests[0]);
  }
  if (new Set(originProfileDigests).size !== 1) {
    throw new Error(`The ${label} apex/www observations are not equivalent.`);
  }
  const observationSha256 = sha256Canonical(value.observations);
  const expectedServedReleaseSha256 = sha256Canonical({
    sourceCommit: value.sourceCommit,
    artifactSha256: value.artifactSha256,
    deploymentId: value.deploymentId,
    observationSha256,
  });
  if (value.servedReleaseSha256 !== expectedServedReleaseSha256) {
    throw new Error(`The ${label} served-release digest is invalid.`);
  }
  const { evidenceSha256, ...payload } = value;
  if (evidenceSha256 !== sha256Canonical(payload)) {
    throw new Error(`The ${label} emergency vantage digest is invalid.`);
  }
  return value;
}

export function compareEmergencyVantageEvidence(left, right) {
  validateEmergencyVantageEvidence(left, "left");
  validateEmergencyVantageEvidence(right, "right");
  if (
    new Set([left.vantageId, right.vantageId]).size !== PRODUCTION_VANTAGE_IDS.length ||
    PRODUCTION_VANTAGE_IDS.some((vantageId) => ![left.vantageId, right.vantageId].includes(vantageId))
  ) throw new Error("Emergency production parity requires the exact EU and US vantage IDs.");
  if (Math.abs(Date.parse(left.checkedAt) - Date.parse(right.checkedAt)) > MAXIMUM_VANTAGE_SKEW_MS) {
    throw new Error("Emergency production parity vantages exceed the reviewed 30-minute timestamp skew.");
  }
  for (const field of [
    "sourceCommit", "artifactSha256", "deploymentId", "promotionEvidenceSha256",
    "promotionProvenanceSha256", "servedReleaseSha256",
  ]) {
    if (left[field] !== right[field]) throw new Error(`Emergency vantages differ at ${field}.`);
  }
  if (left.promotionVerification.bindingSha256 !== right.promotionVerification.bindingSha256) {
    throw new Error("Emergency vantages differ at promotionVerification.");
  }
  const payload = {
    kind: "lester-labs-independent-emergency-vantage-comparison",
    schemaVersion: 2,
    leftVantageId: left.vantageId,
    rightVantageId: right.vantageId,
    sourceCommit: left.sourceCommit,
    artifactSha256: left.artifactSha256,
    deploymentId: left.deploymentId,
    promotionEvidenceSha256: left.promotionEvidenceSha256,
    promotionProvenanceSha256: left.promotionProvenanceSha256,
    promotionVerificationBindingSha256: left.promotionVerification.bindingSha256,
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
    if (
      !name?.startsWith("--") ||
      value === undefined ||
      (name !== "--origin" && options.has(name)) ||
      ![
        "--origin", "--source-dir", "--output", "--promotion-evidence",
        "--promotion-provenance", "--promotion-verification", "--expected-source-commit",
        "--vantage-id",
      ].includes(name)
    ) throw new Error(`Invalid emergency parity option ${JSON.stringify(name)}.`);
    if (name === "--origin") {
      const values = options.get(name) ?? [];
      values.push(value);
      options.set(name, values);
    } else {
      options.set(name, value);
    }
  }
  return options;
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList[0] === "compare") {
    if (argumentsList.length !== 3) {
      throw new Error("Usage: verify-emergency-served-parity.mjs compare VANTAGE_ONE.json VANTAGE_TWO.json");
    }
    process.stdout.write(canonicalJson(compareEmergencyVantageEvidence(
      readJson(resolve(argumentsList[1])),
      readJson(resolve(argumentsList[2])),
    )));
    return;
  }
  const productionMode = argumentsList[0] === "production";
  const options = parseOptions(productionMode ? argumentsList.slice(1) : argumentsList);
  const output = options.get("--output");
  if (!output) throw new Error("Emergency parity requires --output.");
  let result;
  if (productionMode) {
    const promotionPath = resolve(options.get("--promotion-evidence") ?? "");
    const provenancePath = resolve(options.get("--promotion-provenance") ?? "");
    const verificationInput = options.get("--promotion-verification");
    if (verificationInput !== "-") {
      throw new Error(
        "Emergency production parity requires --promotion-verification - from a pipefail-protected gh verification pipe.",
      );
    }
    result = await verifyEmergencyProductionParity({
      promotionEvidenceBytes: readFileSync(promotionPath),
      promotionProvenanceBytes: readFileSync(provenancePath),
      promotionVerificationBytes: readFileSync(0),
      expectedSourceCommit: options.get("--expected-source-commit"),
      vantageId: options.get("--vantage-id"),
      origins: options.get("--origin"),
      sourceDirectory: resolve(options.get("--source-dir") ?? DEFAULT_SOURCE_DIRECTORY),
    });
  } else {
    result = await observeEmergencyServedParity({
      origins: options.get("--origin"),
      sourceDirectory: resolve(options.get("--source-dir") ?? DEFAULT_SOURCE_DIRECTORY),
      trustedOidcToken: process.env.VERCEL_TRUSTED_OIDC_TOKEN,
    });
  }
  writeFileSync(resolve(output), canonicalJson(result), { flag: "wx", mode: 0o600 });
  process.stdout.write(`Emergency served parity verified: ${result.evidenceSha256 ?? result.observationSha256}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
