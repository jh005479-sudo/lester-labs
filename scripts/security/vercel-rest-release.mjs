#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  approveFrontendReleaseCandidate,
  validateFrontendReleaseAttestation,
} from "./frontend-release-attestation.mjs";
import {
  assertExactKeys,
  canonicalJson,
  sha256Bytes,
  sha256Canonical,
} from "./frontend-release-common.mjs";
import {
  assertReleaseProfile,
  releaseProfileForVerification,
  vantageIdsForVerification,
  verificationProfileForRelease,
} from "./release-profiles.mjs";
import { verifyEmergencyContainment } from "./verify-emergency-containment.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const VERCEL_API_ORIGIN = "https://api.vercel.com";
const VERCEL_TRUSTED_OIDC_HEADER = "x-vercel-trusted-oidc-idp-token";
const RESPONSE_BYTE_LIMIT = 1024 * 1024;
const PROVENANCE_BYTE_LIMIT = 16 * 1024 * 1024;
const HARD_UPLOAD_BYTE_LIMIT = 512 * 1024 * 1024;
const DEFAULT_POLL_ATTEMPTS = 180;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MAXIMUM_POLL_ATTEMPTS = 360;
const MAXIMUM_APPROVAL_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAXIMUM_PROVIDER_CANARY_AGE_MS = 6 * 60 * 60 * 1000;
const PRODUCTION_DOMAINS = Object.freeze(["lester-labs.com", "www.lester-labs.com"]);
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SHA1_PATTERN = /^[0-9a-f]{40}$/u;
const TEAM_ID_PATTERN = /^team_[A-Za-z0-9]{8,80}$/u;
const PROJECT_ID_PATTERN = /^prj_[A-Za-z0-9]{8,80}$/u;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]{8,96}$/u;
const PROJECT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/u;
const REVIEWED_REPOSITORY = "jh005479-sudo/lester-labs";
const REVIEWED_REF = "refs/heads/main";
const REVIEWED_PROMOTION_WORKFLOW = ".github/workflows/vercel-production-release.yml";
const REVIEWED_PROMOTION_ENVIRONMENT = "frontend-production-promotion";
const REVIEWED_STAGED_PROVIDER_ALIASES = Object.freeze({
  "prj_dbAIzvnFWLzxkt2dpphAWbserIG7": Object.freeze({
    teamId: "team_vnMG4DPuSLlOs9bEi7QcRjhx",
    projectName: "lester-labs",
    allowExactReadyStagedAssignmentForReleaseProfile: "public-testnet-immutable",
    aliases: Object.freeze([
      "lester-labs-jh005479-8603-lester-labs.vercel.app",
      "lester-labs-lester-labs.vercel.app",
    ]),
  }),
  "prj_sUhxc4VDzA9cWn2rv7gr1cwJOo6K": Object.freeze({
    teamId: "team_vnMG4DPuSLlOs9bEi7QcRjhx",
    projectName: "lester-labs-release-canary",
    allowExactReadyStagedAssignment: true,
    aliases: Object.freeze([
      "lester-labs-release-canary-jh005479-8603-lester-labs.vercel.app",
      "lester-labs-release-canary-lester-labs.vercel.app",
    ]),
  }),
});
const REVIEWED_PROMOTED_PROVIDER_ALIASES = Object.freeze({
  "prj_dbAIzvnFWLzxkt2dpphAWbserIG7": Object.freeze({
    teamId: "team_vnMG4DPuSLlOs9bEi7QcRjhx",
    projectName: "lester-labs",
    releaseProfile: "public-testnet-immutable",
    aliases: Object.freeze([
      "lester-labs-jh005479-8603-lester-labs.vercel.app",
      "lester-labs-lester-labs.vercel.app",
      "lester-labs-psi.vercel.app",
      "www.lester-labs.com",
    ]),
  }),
});
const PROVIDER_CANARY_BOOTSTRAP = Symbol("provider-canary-bootstrap");
const NEXT_ARCHIVE_NAME = "frontend-standalone.tar";
const NEXT_INVENTORY_NAME = "deployment-payload.inventory.json";
const NEXT_BASE_IMAGE =
  "docker.io/library/node:24.18.0-bookworm@sha256:4e9cb555d708e0829c9d93e5eeae9dfab0617b832ca436a690680e0fca735ef5";

export const REVIEWED_CONTAINER_DOCKERFILE = `FROM ${NEXT_BASE_IMAGE}\nENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1\nWORKDIR /app\nADD --chown=node:node ${NEXT_ARCHIVE_NAME} /app/\nUSER node\nCMD ["node", "server.js"]\n`;

const REVIEWED_STATIC_PROJECT_SETTINGS = Object.freeze({
  framework: null,
  buildCommand: "",
  installCommand: "",
  outputDirectory: ".vercel/output",
  rootDirectory: null,
});
const REVIEWED_CONTAINER_PROJECT_SETTINGS = Object.freeze({
  framework: "container",
  buildCommand: null,
  installCommand: "",
  outputDirectory: null,
  rootDirectory: null,
});

const EMERGENCY_FILES = Object.freeze([
  ".well-known/security.txt",
  "index.html",
  "robots.txt",
  "vercel.json",
]);

const NEXT_RELEASE_FILES = Object.freeze({
  approvedManifest: "approved-manifest.json",
  approvedManifestProvenance: "approved-manifest.provenance.jsonl",
  candidate: "frontend-release-candidate.json",
  candidateProvenance: "github-sigstore-provenance.jsonl",
  sourceEnvelope: "source-security-approval.json",
  sourceProvenance: "source-security-approval.provenance.jsonl",
  operationsEnvelope: "release-operations-approval.json",
  operationsProvenance: "release-operations-approval.provenance.jsonl",
  archive: NEXT_ARCHIVE_NAME,
  inventory: NEXT_INVENTORY_NAME,
});

function hash(algorithm, bytes) {
  return createHash(algorithm).update(bytes).digest("hex");
}

function assertHash(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${label} must be a lowercase hexadecimal digest.`);
  }
}

function assertIdentifier(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function assertCanonicalTimestamp(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    Number.isNaN(Date.parse(value))
  ) throw new Error(`${label} must be a canonical UTC timestamp.`);
  return value;
}

function readRegularFile(path, label, maximumBytes, { nonempty = true } = {}) {
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${label} must be a regular file, not a symlink or special file.`);
  }
  if ((nonempty && metadata.size === 0) || metadata.size > maximumBytes) {
    throw new Error(`${label} is empty or exceeds its reviewed byte limit.`);
  }
  return readFileSync(path);
}

function readCanonicalJsonFile(path, label, maximumBytes = PROVENANCE_BYTE_LIMIT) {
  const bytes = readRegularFile(path, label, maximumBytes);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  if (canonicalJson(value) !== bytes.toString("utf8")) {
    throw new Error(`${label} must use the repository canonical JSON encoding.`);
  }
  return { bytes, value, sha256: sha256Bytes(bytes) };
}

function provenanceRecord(path, kind) {
  const bytes = readRegularFile(path, `${kind} provenance`, PROVENANCE_BYTE_LIMIT);
  return { kind, sha256: sha256Bytes(bytes) };
}

function assertUploadLimit(maximumUploadBytes) {
  if (
    !Number.isSafeInteger(maximumUploadBytes) ||
    maximumUploadBytes <= 0 ||
    maximumUploadBytes > HARD_UPLOAD_BYTE_LIMIT
  ) {
    throw new Error(
      `maximumUploadBytes must be an explicit positive integer no greater than ${HARD_UPLOAD_BYTE_LIMIT}.`,
    );
  }
  return maximumUploadBytes;
}

function safeRelativePath(path, label, { allowRoot = false } = {}) {
  if (typeof path !== "string") throw new Error(`${label} must be a string.`);
  let normalized = path;
  while (normalized.startsWith("./")) normalized = normalized.slice(2);
  if (allowRoot && (normalized === "" || normalized === ".")) return ".";
  const segments = normalized.split("/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(normalized) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) throw new Error(`${label} is unsafe.`);
  return normalized;
}

function parseTarString(field, label) {
  const zero = field.indexOf(0);
  const end = zero === -1 ? field.length : zero;
  if (zero !== -1 && field.subarray(zero).some((byte) => byte !== 0)) {
    throw new Error(`${label} has non-zero bytes after its terminator.`);
  }
  return field.subarray(0, end).toString("utf8");
}

function parseTarNumber(field, label) {
  if ((field[0] & 0x80) !== 0) {
    throw new Error(`${label} uses an unsupported base-256 tar number.`);
  }
  const rendered = field.toString("ascii").replace(/\0.*$/u, "").trim();
  if (rendered === "") return 0;
  if (!/^[0-7]+$/u.test(rendered)) throw new Error(`${label} is not a valid octal tar number.`);
  const value = Number.parseInt(rendered, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} is outside the safe range.`);
  return value;
}

function parsePaxRecords(bytes) {
  const records = new Map();
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(0x20, offset);
    if (space === -1) throw new Error("A PAX record omits its byte length.");
    const lengthText = bytes.subarray(offset, space).toString("ascii");
    if (!/^[1-9][0-9]{0,8}$/u.test(lengthText)) throw new Error("A PAX record length is invalid.");
    const length = Number(lengthText);
    const end = offset + length;
    if (end > bytes.length || bytes[end - 1] !== 0x0a) throw new Error("A PAX record is truncated.");
    const record = bytes.subarray(space + 1, end - 1).toString("utf8");
    const equals = record.indexOf("=");
    if (equals <= 0) throw new Error("A PAX record omits its key or value separator.");
    const key = record.slice(0, equals);
    const value = record.slice(equals + 1);
    if (records.has(key)) throw new Error(`A PAX record duplicates ${key}.`);
    if (!["path", "mtime", "size"].includes(key)) {
      throw new Error(`The release tar contains unsupported PAX metadata ${key}.`);
    }
    records.set(key, value);
    offset = end;
  }
  return records;
}

function tarHeaderChecksum(header) {
  let sum = 0;
  for (let index = 0; index < header.length; index += 1) {
    sum += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  return sum;
}

export function inspectTarArchive(archiveBytes, { maximumBytes = HARD_UPLOAD_BYTE_LIMIT } = {}) {
  if (!Buffer.isBuffer(archiveBytes) || archiveBytes.length === 0 || archiveBytes.length > maximumBytes) {
    throw new Error("The release tar is empty or above the reviewed byte limit.");
  }
  if (archiveBytes.length % 512 !== 0) throw new Error("The release tar length is not block-aligned.");
  const files = [];
  const seen = new Set();
  let offset = 0;
  let pendingPax = null;
  let zeroBlocks = 0;
  while (offset < archiveBytes.length) {
    const header = archiveBytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      zeroBlocks += 1;
      offset += 512;
      if (pendingPax) throw new Error("The release tar ends with unapplied PAX metadata.");
      if (archiveBytes.subarray(offset).some((byte) => byte !== 0)) {
        throw new Error("The release tar contains data after its end marker.");
      }
      zeroBlocks += (archiveBytes.length - offset) / 512;
      offset = archiveBytes.length;
      break;
    }
    const storedChecksum = parseTarNumber(header.subarray(148, 156), "Tar checksum");
    if (storedChecksum !== tarHeaderChecksum(header)) throw new Error("The release tar checksum is invalid.");
    const magic = header.subarray(257, 263).toString("ascii");
    if (magic !== "ustar\0" && magic !== "ustar ") throw new Error("The release tar is not POSIX ustar.");
    const rawName = parseTarString(header.subarray(0, 100), "Tar entry name");
    const prefix = parseTarString(header.subarray(345, 500), "Tar entry prefix");
    const headerPath = prefix ? `${prefix}/${rawName}` : rawName;
    const mode = parseTarNumber(header.subarray(100, 108), "Tar entry mode");
    if ((mode & 0o7000) !== 0) throw new Error("The release tar contains privileged mode bits.");
    const size = parseTarNumber(header.subarray(124, 136), "Tar entry size");
    if (size > maximumBytes) throw new Error("A release tar entry exceeds the reviewed byte limit.");
    const type = String.fromCharCode(header[156] || 0x30);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    const nextOffset = bodyStart + Math.ceil(size / 512) * 512;
    if (bodyEnd > archiveBytes.length || nextOffset > archiveBytes.length) {
      throw new Error("The release tar contains a truncated entry.");
    }
    const body = archiveBytes.subarray(bodyStart, bodyEnd);
    if (type === "x") {
      if (pendingPax) throw new Error("The release tar contains stacked PAX headers.");
      pendingPax = parsePaxRecords(body);
      offset = nextOffset;
      continue;
    }
    if (type === "g" || type === "L" || type === "K") {
      throw new Error("The release tar contains unsupported global or GNU metadata.");
    }
    let effectivePath = pendingPax?.get("path") ?? headerPath;
    if (pendingPax?.has("size") && Number(pendingPax.get("size")) !== size) {
      throw new Error("The release tar PAX size differs from its header.");
    }
    pendingPax = null;
    const isDirectory = type === "5";
    effectivePath = safeRelativePath(effectivePath.replace(/\/$/u, ""), "Tar entry path", {
      allowRoot: isDirectory,
    });
    if (isDirectory) {
      if (size !== 0) throw new Error("A release tar directory has a non-zero body.");
    } else if (type === "0") {
      if (seen.has(effectivePath)) throw new Error(`The release tar duplicates ${effectivePath}.`);
      seen.add(effectivePath);
      files.push({ path: effectivePath, bytes: size, sha256: sha256Bytes(body) });
    } else {
      throw new Error(`The release tar contains unsupported entry type ${JSON.stringify(type)}.`);
    }
    offset = nextOffset;
  }
  if (zeroBlocks < 2) throw new Error("The release tar omits its two-block end marker.");
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function validateInventory(value, label) {
  assertExactKeys(value, ["sha256", "fileCount", "totalBytes", "files"], label);
  assertHash(value.sha256, SHA256_PATTERN, `${label} digest`);
  if (!Array.isArray(value.files)) throw new Error(`${label} files must be an array.`);
  let previous = "";
  let totalBytes = 0;
  for (const file of value.files) {
    assertExactKeys(file, ["path", "bytes", "sha256"], `${label} file`);
    const path = safeRelativePath(file.path, `${label} file path`);
    if (previous && path <= previous) throw new Error(`${label} files must be sorted and unique.`);
    previous = path;
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) throw new Error(`${label} has invalid file bytes.`);
    assertHash(file.sha256, SHA256_PATTERN, `${label} file digest`);
    totalBytes += file.bytes;
  }
  if (
    !Number.isSafeInteger(value.fileCount) ||
    value.fileCount !== value.files.length ||
    !Number.isSafeInteger(value.totalBytes) ||
    value.totalBytes !== totalBytes ||
    value.sha256 !== sha256Canonical(value.files)
  ) throw new Error(`${label} summary does not match its files.`);
  return value;
}

function compareTarToInventory(archiveBytes, inventory, maximumBytes) {
  const observed = inspectTarArchive(archiveBytes, { maximumBytes });
  if (canonicalJson(observed) !== canonicalJson(inventory.files)) {
    throw new Error("The signed release tar does not byte-match its reviewed payload inventory.");
  }
}

function uploadFile(path, bytes) {
  safeRelativePath(path, "Vercel upload path");
  if (!Buffer.isBuffer(bytes)) throw new Error("Vercel upload contents must be a Buffer.");
  return {
    path,
    bytes,
    providerSha1: hash("sha1", bytes),
    securitySha256: sha256Bytes(bytes),
  };
}

function summarizeUploadFiles(files, maximumUploadBytes) {
  assertUploadLimit(maximumUploadBytes);
  const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path));
  const seen = new Set();
  let totalBytes = 0;
  for (const file of sorted) {
    safeRelativePath(file.path, "Vercel upload path");
    if (seen.has(file.path)) throw new Error(`Vercel upload path ${file.path} is duplicated.`);
    seen.add(file.path);
    if (!Buffer.isBuffer(file.bytes)) throw new Error("Vercel upload contents must be a Buffer.");
    if (file.providerSha1 !== hash("sha1", file.bytes) || file.securitySha256 !== sha256Bytes(file.bytes)) {
      throw new Error(`Vercel upload digests do not match ${file.path}.`);
    }
    totalBytes += file.bytes.length;
  }
  if (totalBytes > maximumUploadBytes) {
    throw new Error(`The Vercel source upload is ${totalBytes} bytes, above the explicit ${maximumUploadBytes}-byte cap.`);
  }
  const publicFiles = sorted.map(({ path, bytes, providerSha1, securitySha256 }) => ({
    path,
    bytes: bytes.length,
    providerSha1,
    securitySha256,
  }));
  return {
    maximumBytes: maximumUploadBytes,
    totalBytes,
    sha256: sha256Canonical(publicFiles),
    files: publicFiles,
  };
}

function validateProviderCanary(
  value,
  { providerMode, releaseProfile, sourceUploadSha256, projectSettingsSha256 },
) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "status", "providerMode", "releaseProfile", "checkedAt", "sourceUploadSha256",
    "projectSettingsSha256", "canaryProject", "stagedDeploymentId", "rollbackDeploymentId",
    "workflow", "results", "evidenceSha256",
  ], "Vercel provider-canary evidence");
  if (
    value.kind !== "lester-labs-vercel-provider-canary" ||
    value.schemaVersion !== 3 ||
    value.status !== "PASSED" ||
    value.providerMode !== providerMode ||
    value.releaseProfile !== releaseProfile ||
    value.sourceUploadSha256 !== sourceUploadSha256 ||
    value.projectSettingsSha256 !== projectSettingsSha256
  ) throw new Error("The Vercel provider canary is not bound to the exact reviewed provider input.");
  assertReleaseProfile(value.releaseProfile, "Provider-canary release profile");
  assertCanonicalTimestamp(value.checkedAt, "Vercel provider-canary timestamp");
  assertHash(value.sourceUploadSha256, SHA256_PATTERN, "Provider-canary upload digest");
  assertHash(value.projectSettingsSha256, SHA256_PATTERN, "Provider-canary settings digest");
  assertExactKeys(value.canaryProject, ["teamId", "projectId", "name"], "Provider-canary project");
  assertIdentifier(value.canaryProject.teamId, TEAM_ID_PATTERN, "Provider-canary team ID");
  assertIdentifier(value.canaryProject.projectId, PROJECT_ID_PATTERN, "Provider-canary project ID");
  assertIdentifier(value.canaryProject.name, PROJECT_NAME_PATTERN, "Provider-canary project name");
  assertIdentifier(value.stagedDeploymentId, DEPLOYMENT_ID_PATTERN, "Provider-canary staged deployment ID");
  assertIdentifier(value.rollbackDeploymentId, DEPLOYMENT_ID_PATTERN, "Provider-canary rollback deployment ID");
  if (value.stagedDeploymentId === value.rollbackDeploymentId) {
    throw new Error("Provider-canary staged and rollback deployment IDs must differ.");
  }
  assertExactKeys(value.workflow, [
    "repository", "ref", "path", "runId", "runAttempt",
    "sourceAttestationRunId", "sourceAttestationRunAttempt",
  ], "Provider-canary workflow identity");
  if (
    value.workflow.repository !== REVIEWED_REPOSITORY ||
    value.workflow.ref !== REVIEWED_REF ||
    value.workflow.path !== ".github/workflows/vercel-provider-canary.yml" ||
    !/^[1-9][0-9]{0,19}$/u.test(value.workflow.runId) ||
    !Number.isSafeInteger(value.workflow.runAttempt) ||
    value.workflow.runAttempt < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(value.workflow.sourceAttestationRunId) ||
    !Number.isSafeInteger(value.workflow.sourceAttestationRunAttempt) ||
    value.workflow.sourceAttestationRunAttempt < 1
  ) throw new Error("Provider-canary workflow identity is invalid.");
  assertExactKeys(value.results, [
    "deploymentReachedReadyStaged", "customProductionAliasesAbsent", "providerModeAccepted",
    "providerResourcesMatched", "exactIdPromotionNoRebuildVerified", "exactIdRollbackVerified",
  ], "Vercel provider-canary results");
  if (Object.values(value.results).some((result) => result !== true)) {
    throw new Error("Every reviewed Vercel provider-canary result must pass.");
  }
  const { evidenceSha256, ...payload } = value;
  assertHash(evidenceSha256, SHA256_PATTERN, "Vercel provider-canary evidence digest");
  if (evidenceSha256 !== sha256Canonical(payload)) {
    throw new Error("The Vercel provider-canary evidence digest is invalid.");
  }
  return value;
}

function readProviderCanary({
  providerCanaryEvidencePath,
  providerCanaryProvenancePath,
  providerMode,
  releaseProfile,
  sourceUploadSha256,
  projectSettings,
}) {
  const evidence = readCanonicalJsonFile(
    providerCanaryEvidencePath,
    "Signed Vercel provider-canary evidence",
  );
  validateProviderCanary(evidence.value, {
    providerMode,
    releaseProfile,
    sourceUploadSha256,
    projectSettingsSha256: sha256Canonical(projectSettings),
  });
  const provenance = provenanceRecord(
    providerCanaryProvenancePath,
    "provider-canary-sigstore",
  );
  return {
    providerBoundary: {
      mode: providerMode,
      checkedAt: evidence.value.checkedAt,
      canaryEvidenceSha256: evidence.sha256,
      canaryProvenanceSha256: provenance.sha256,
      canaryWorkflow: evidence.value.workflow,
    },
    reviewEvidence: [
      { kind: "provider-canary", sha256: evidence.sha256 },
      provenance,
    ],
  };
}

function preparedRelease({
  artifactKind,
  releaseProfile,
  sourceCommit,
  manifestSha256,
  artifact,
  reviewEvidence,
  uploadFiles,
  maximumUploadBytes,
  projectSettings,
  providerMode,
  providerCanaryEvidencePath,
  providerCanaryProvenancePath,
  providerCanaryBootstrap,
  canaryProbes,
}) {
  assertReleaseProfile(releaseProfile);
  assertIdentifier(sourceCommit, COMMIT_PATTERN, "Release source commit");
  assertHash(manifestSha256, SHA256_PATTERN, "Release manifest digest");
  const sourceUpload = summarizeUploadFiles(uploadFiles, maximumUploadBytes);
  const providerCanary = providerCanaryBootstrap === PROVIDER_CANARY_BOOTSTRAP
    ? { providerBoundary: null, reviewEvidence: [] }
    : readProviderCanary({
      providerCanaryEvidencePath,
      providerCanaryProvenancePath,
      providerMode,
      releaseProfile,
      sourceUploadSha256: sourceUpload.sha256,
      projectSettings,
    });
  const review = {
    evidence: [...reviewEvidence, ...providerCanary.reviewEvidence]
      .sort((left, right) => left.kind.localeCompare(right.kind)),
  };
  const reviewKinds = new Set();
  for (const item of review.evidence) {
    assertExactKeys(item, ["kind", "sha256"], "Release review evidence");
    if (typeof item.kind !== "string" || !/^[a-z0-9][a-z0-9-]{2,79}$/u.test(item.kind)) {
      throw new Error("Release review evidence kind is invalid.");
    }
    if (reviewKinds.has(item.kind)) throw new Error("Release review evidence kinds must be unique.");
    reviewKinds.add(item.kind);
    assertHash(item.sha256, SHA256_PATTERN, "Release review evidence digest");
  }
  if (review.evidence.length < 2) throw new Error("Release review evidence is incomplete.");
  const source = {
    commit: sourceCommit,
    manifestSha256,
    releaseProfile,
    sourceReviewSha256: sha256Canonical(review),
  };
  return {
    artifactKind,
    source,
    review,
    artifact,
    sourceUpload,
    projectSettings,
    providerBoundary: providerCanary.providerBoundary,
    providerMode,
    canaryProbes,
    uploadFiles: [...uploadFiles].sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function prepareEmergencyRelease({
  releaseDirectory,
  sourceDirectory = join(repositoryRoot, "emergency-site"),
  sourceCommit,
  releaseProfile,
  maximumUploadBytes,
  providerCanaryEvidencePath,
  providerCanaryProvenancePath,
  [PROVIDER_CANARY_BOOTSTRAP]: providerCanaryBootstrap,
} = {}) {
  assertUploadLimit(maximumUploadBytes);
  const manifest = readCanonicalJsonFile(
    join(releaseDirectory, "emergency-containment.inventory.json"),
    "Signed emergency inventory",
  );
  const verified = verifyEmergencyContainment({ root: sourceDirectory });
  if (canonicalJson(manifest.value) !== canonicalJson(verified)) {
    throw new Error("The signed emergency inventory does not match the reviewed four-file source directory.");
  }
  const archiveBytes = readRegularFile(
    join(releaseDirectory, "emergency-containment.tar"),
    "Signed emergency archive",
    maximumUploadBytes,
  );
  const inventory = validateInventory({
    sha256: sha256Canonical(manifest.value.files),
    fileCount: manifest.value.files.length,
    totalBytes: manifest.value.files.reduce((total, file) => total + file.bytes, 0),
    files: manifest.value.files,
  }, "Emergency payload inventory");
  compareTarToInventory(archiveBytes, inventory, maximumUploadBytes);
  const sourceFiles = Object.fromEntries(EMERGENCY_FILES.map((path) => [
    path,
    readRegularFile(join(sourceDirectory, path), `Emergency source file ${path}`, maximumUploadBytes),
  ]));
  const sourceConfiguration = JSON.parse(sourceFiles["vercel.json"].toString("utf8"));
  const headers = Object.fromEntries(
    sourceConfiguration.headers[0].headers.map(({ key, value }) => [key, value]),
  );
  // The signed source tar remains the security artifact. Vercel receives a
  // deterministic Build Output API v3 tree derived from it, so the recovered
  // project's historical Next/npm commands are not the deployment input.
  const buildOutputConfiguration = Buffer.from(canonicalJson({
    version: 3,
    routes: [
      { src: "/.*", headers, continue: true },
      { src: "/$", dest: "/index.html" },
    ],
  }));
  const uploads = [
    uploadFile(".vercel/output/config.json", buildOutputConfiguration),
    uploadFile(".vercel/output/static/.well-known/security.txt", sourceFiles[".well-known/security.txt"]),
    uploadFile(".vercel/output/static/index.html", sourceFiles["index.html"]),
    uploadFile(".vercel/output/static/robots.txt", sourceFiles["robots.txt"]),
  ];
  const manifestProvenance = provenanceRecord(
    join(releaseDirectory, "emergency-containment.inventory.provenance.jsonl"),
    "emergency-inventory-sigstore",
  );
  const artifactProvenance = provenanceRecord(
    join(releaseDirectory, "emergency-containment.archive.provenance.jsonl"),
    "emergency-archive-sigstore",
  );
  return preparedRelease({
    artifactKind: "emergency-static",
    releaseProfile,
    sourceCommit,
    manifestSha256: manifest.sha256,
    artifact: {
      format: "application/vnd.lester-labs.emergency-containment.tar",
      bytes: archiveBytes.length,
      sha256: sha256Bytes(archiveBytes),
    },
    reviewEvidence: [manifestProvenance, artifactProvenance],
    uploadFiles: uploads,
    maximumUploadBytes,
    projectSettings: REVIEWED_STATIC_PROJECT_SETTINGS,
    providerMode: "build-output-api-v3-static",
    providerCanaryEvidencePath,
    providerCanaryProvenancePath,
    providerCanaryBootstrap,
    canaryProbes: [
      { path: "/", status: 200, bytes: sourceFiles["index.html"], headers },
      { path: "/.well-known/security.txt", status: 200, bytes: sourceFiles[".well-known/security.txt"], headers },
      { path: "/robots.txt", status: 200, bytes: sourceFiles["robots.txt"], headers },
    ],
  });
}

export function prepareNextContainerRelease({
  releaseDirectory,
  maximumUploadBytes,
  providerCanaryEvidencePath,
  providerCanaryProvenancePath,
  [PROVIDER_CANARY_BOOTSTRAP]: providerCanaryBootstrap,
} = {}) {
  assertUploadLimit(maximumUploadBytes);
  const paths = Object.fromEntries(
    Object.entries(NEXT_RELEASE_FILES).map(([key, name]) => [key, join(releaseDirectory, name)]),
  );
  const approved = readCanonicalJsonFile(paths.approvedManifest, "Approved frontend manifest");
  validateFrontendReleaseAttestation(approved.value, {
    requireApproved: true,
    requireReleaseRuntime: true,
  });
  const candidate = readCanonicalJsonFile(paths.candidate, "Frontend release candidate");
  const candidateProvenance = provenanceRecord(paths.candidateProvenance, "frontend-build-sigstore");
  const approvals = [
    {
      envelopePath: paths.sourceEnvelope,
      provenancePath: paths.sourceProvenance,
      envelope: readCanonicalJsonFile(paths.sourceEnvelope, "Source-security approval envelope"),
      provenance: provenanceRecord(paths.sourceProvenance, "source-security-sigstore"),
    },
    {
      envelopePath: paths.operationsEnvelope,
      provenancePath: paths.operationsProvenance,
      envelope: readCanonicalJsonFile(paths.operationsEnvelope, "Release-operations approval envelope"),
      provenance: provenanceRecord(paths.operationsProvenance, "release-operations-sigstore"),
    },
  ];
  for (const approval of approvals) {
    if (approval.envelope.value.candidateProvenanceSha256 !== candidateProvenance.sha256) {
      throw new Error("A protected frontend approval does not bind the supplied build-provenance bundle.");
    }
  }
  const reconstructed = approveFrontendReleaseCandidate({ candidate: candidate.value, approvals });
  if (canonicalJson(reconstructed) !== canonicalJson(approved.value)) {
    throw new Error("The approved frontend manifest does not reconstruct from the supplied protected approvals.");
  }
  const approvedProvenance = provenanceRecord(
    paths.approvedManifestProvenance,
    "approved-manifest-sigstore",
  );
  const inventory = readCanonicalJsonFile(paths.inventory, "Standalone payload inventory");
  validateInventory(inventory.value, "Standalone payload inventory");
  const archiveBytes = readRegularFile(paths.archive, "Signed standalone archive", maximumUploadBytes);
  if (
    approved.value.deploymentArtifact.archiveBytes !== archiveBytes.length ||
    approved.value.deploymentArtifact.archiveSha256 !== sha256Bytes(archiveBytes) ||
    approved.value.deploymentArtifact.payloadInventorySha256 !== inventory.value.sha256
  ) throw new Error("The signed standalone archive or inventory differs from the approved frontend manifest.");
  compareTarToInventory(archiveBytes, inventory.value, maximumUploadBytes);
  const uploadFiles = [
    uploadFile("Dockerfile.vercel", Buffer.from(REVIEWED_CONTAINER_DOCKERFILE)),
    uploadFile(NEXT_ARCHIVE_NAME, archiveBytes),
  ];
  return preparedRelease({
    artifactKind: "next-standalone-container",
    releaseProfile: approved.value.releaseProfile,
    sourceCommit: approved.value.sourceCommit,
    manifestSha256: approved.sha256,
    artifact: {
      format: approved.value.deploymentArtifact.format,
      bytes: archiveBytes.length,
      sha256: approved.value.deploymentArtifact.archiveSha256,
    },
    reviewEvidence: [
      approvedProvenance,
      candidateProvenance,
      ...approvals.flatMap((approval) => [
        { kind: `${approval.envelope.value.reviewRole}-approval`, sha256: approval.envelope.sha256 },
        approval.provenance,
      ]),
    ],
    uploadFiles,
    maximumUploadBytes,
    projectSettings: REVIEWED_CONTAINER_PROJECT_SETTINGS,
    providerMode: "vercel-container-public-beta",
    providerCanaryEvidencePath,
    providerCanaryProvenancePath,
    providerCanaryBootstrap,
    canaryProbes: approved.value.routeSnapshots.map((snapshot) => ({
      path: snapshot.path,
      status: 200,
      bodySha256: snapshot.bodySha256,
      headers: snapshot.securityHeaders,
    })),
  });
}

function tokenHeader(token) {
  if (
    typeof token !== "string" ||
    token.length < 16 ||
    token.length > 4096 ||
    /[\u0000-\u0020\u007f]/u.test(token)
  ) throw new Error("VERCEL_TOKEN is missing or malformed.");
  return `Bearer ${token}`;
}

function trustedOidcProbeHeaders(token) {
  if (token === undefined) return {};
  if (
    typeof token !== "string" ||
    token.length < 64 ||
    token.length > 16_384 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(token)
  ) throw new Error("VERCEL_TRUSTED_OIDC_TOKEN is malformed.");
  return { [VERCEL_TRUSTED_OIDC_HEADER]: token };
}

async function readResponseBounded(response, maximumBytes = RESPONSE_BYTE_LIMIT) {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]{0,9})$/u.test(contentLength) || Number(contentLength) > maximumBytes) {
      throw new Error("The Vercel API response exceeds the reviewed byte limit.");
    }
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("The Vercel API response exceeds the reviewed byte limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function makeApi({ token, fetchImpl = globalThis.fetch, requestTimeoutMs = 30_000 } = {}) {
  const authorization = tokenHeader(token);
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1_000 || requestTimeoutMs > 120_000) {
    throw new Error("The Vercel request timeout is outside the reviewed range.");
  }
  async function request(method, pathname, {
    teamId,
    body,
    headers = {},
    expectedStatuses = [200],
    parseJson = true,
  } = {}) {
    assertIdentifier(teamId, TEAM_ID_PATTERN, "Vercel team ID");
    const url = new URL(pathname, VERCEL_API_ORIGIN);
    if (url.origin !== VERCEL_API_ORIGIN || !url.pathname.startsWith("/")) {
      throw new Error("The Vercel API endpoint is invalid.");
    }
    url.searchParams.set("teamId", teamId);
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(requestTimeoutMs),
        headers: {
          authorization,
          ...headers,
        },
        body,
      });
    } catch {
      throw new Error(`Vercel API ${method} ${url.pathname} did not complete.`);
    }
    const bytes = await readResponseBounded(response);
    if (!expectedStatuses.includes(response.status)) {
      throw new Error(`Vercel API ${method} ${url.pathname} failed with status ${response.status}.`);
    }
    if (!parseJson) return null;
    if (bytes.length === 0) return {};
    try {
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new Error(`Vercel API ${method} ${url.pathname} returned malformed JSON.`);
    }
  }
  return { request };
}

function projectTargetId(project) {
  return project?.targets?.production?.id;
}

function validateProject(project, expected, { expectedCurrentDeploymentId } = {}) {
  if (
    !project ||
    project.id !== expected.projectId ||
    project.name !== expected.projectName ||
    project.accountId !== expected.teamId
  ) throw new Error("Vercel returned a different team or project than the reviewed target.");
  if (project.autoAssignCustomDomains !== false) {
    throw new Error("Vercel production-domain auto-assignment must be explicitly disabled.");
  }
  const currentDeploymentId = projectTargetId(project);
  assertIdentifier(currentDeploymentId, DEPLOYMENT_ID_PATTERN, "Current production deployment ID");
  if (expectedCurrentDeploymentId !== undefined && currentDeploymentId !== expectedCurrentDeploymentId) {
    throw new Error("The Vercel current production deployment changed during the reviewed operation.");
  }
  return currentDeploymentId;
}

function normalizeAliases(deployment) {
  const values = [];
  for (const field of [deployment?.alias, deployment?.aliases]) {
    if (field === undefined || field === null) continue;
    if (!Array.isArray(field) || field.some((alias) => typeof alias !== "string")) {
      throw new Error("Vercel returned malformed deployment aliases.");
    }
    values.push(...field.map((alias) => alias.toLowerCase().replace(/^https?:\/\//u, "").replace(/\/$/u, "")));
  }
  return [...new Set(values)].sort();
}

function deploymentUrl(deployment) {
  const raw = deployment?.url;
  if (typeof raw !== "string" || raw.length === 0) throw new Error("Vercel omitted the deployment URL.");
  let parsed;
  try {
    parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new Error("Vercel returned an invalid deployment URL.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !parsed.hostname.endsWith(".vercel.app")
  ) throw new Error("Vercel returned an unreviewed deployment URL.");
  return parsed.href.replace(/\/$/u, "");
}

function validateDeploymentIdentity(deployment, expected) {
  if (
    !deployment ||
    deployment.id !== expected.deploymentId ||
    deployment.projectId !== expected.projectId ||
    deployment.target !== "production"
  ) throw new Error("Vercel returned a deployment outside the reviewed project or target.");
  return deployment;
}

function reviewedStagedProviderAliases(target) {
  const reviewed = REVIEWED_STAGED_PROVIDER_ALIASES[target.projectId];
  if (!reviewed) return undefined;
  if (reviewed.teamId !== target.teamId || reviewed.projectName !== target.projectName) {
    throw new Error("The Vercel target identity differs from its reviewed staged-alias binding.");
  }
  return reviewed;
}

function assertNoProductionAliases(deployment, target) {
  const aliases = normalizeAliases(deployment);
  const immutableDeploymentHost = new URL(deploymentUrl(deployment)).hostname;
  const reviewed = reviewedStagedProviderAliases(target);
  const reviewedProviderAliases = reviewed?.aliases ?? [];
  const allowedProviderMetadata = new Set([immutableDeploymentHost, ...reviewedProviderAliases]);
  const unexpectedAliases = aliases.filter((alias) => !allowedProviderMetadata.has(alias));
  if (unexpectedAliases.length !== 0) {
    throw new Error(
      `The staged deployment was assigned an unexpected alias: ${canonicalJson({
        deploymentUrl: deploymentUrl(deployment),
        aliases: unexpectedAliases,
      }).trim()}`,
    );
  }
  const exactReviewedAssignment = (
    (
      reviewed?.allowExactReadyStagedAssignment === true ||
      (
        typeof reviewed?.allowExactReadyStagedAssignmentForReleaseProfile === "string" &&
        reviewed.allowExactReadyStagedAssignmentForReleaseProfile === target.releaseProfile
      )
    ) &&
    deployment.aliasAssigned === true &&
    deployment.readyState === "READY" &&
    deployment.readySubstate === "STAGED" &&
    aliases.length === reviewedProviderAliases.length &&
    aliases.every((alias, index) => alias === reviewedProviderAliases[index])
  );
  if (deployment.aliasAssigned !== false && !exactReviewedAssignment) {
    throw new Error(
      `The staged deployment unexpectedly has aliases assigned: ${canonicalJson({
        deploymentUrl: deploymentUrl(deployment),
        readyState: deployment?.readyState,
        readySubstate: deployment?.readySubstate,
        aliases: normalizeAliases(deployment),
      }).trim()}`,
    );
  }
  return aliases;
}

function promotedAliasesForTarget(target) {
  const reviewed = REVIEWED_PROMOTED_PROVIDER_ALIASES[target.projectId];
  if (!reviewed) return PRODUCTION_DOMAINS;
  if (
    reviewed.teamId === target.teamId &&
    reviewed.projectName === target.projectName &&
    reviewed.releaseProfile === target.releaseProfile
  ) return reviewed.aliases;
  return PRODUCTION_DOMAINS;
}

function assertCurrentProductionDeployment(deployment, target) {
  if (deployment.aliasAssigned !== true) {
    throw new Error("The promoted deployment is not marked as alias-assigned.");
  }
  const aliases = normalizeAliases(deployment);
  const expectedAliases = promotedAliasesForTarget(target);
  if (
    aliases.length !== expectedAliases.length ||
    aliases.some((alias, index) => alias !== expectedAliases[index])
  ) {
    throw new Error("The current deployment aliases differ from the exact reviewed production set.");
  }
  return aliases;
}

async function getProject(api, target) {
  return api.request("GET", `/v9/projects/${encodeURIComponent(target.projectId)}`, {
    teamId: target.teamId,
  });
}

async function getDeployment(api, target, deploymentId) {
  return api.request("GET", `/v13/deployments/${encodeURIComponent(deploymentId)}`, {
    teamId: target.teamId,
  });
}

async function preflight(api, target, { expectedCurrentDeploymentId } = {}) {
  const project = await getProject(api, target);
  const currentDeploymentId = validateProject(project, target, { expectedCurrentDeploymentId });
  const currentDeployment = await getDeployment(api, target, currentDeploymentId);
  validateDeploymentIdentity(currentDeployment, {
    projectId: target.projectId,
    deploymentId: currentDeploymentId,
  });
  if (currentDeployment.readyState !== "READY") {
    throw new Error("The recorded rollback deployment is not READY.");
  }
  return { project, currentDeploymentId, currentDeployment };
}

function validatePolling(maxPollAttempts, pollIntervalMs) {
  if (
    !Number.isSafeInteger(maxPollAttempts) ||
    maxPollAttempts < 1 ||
    maxPollAttempts > MAXIMUM_POLL_ATTEMPTS ||
    !Number.isSafeInteger(pollIntervalMs) ||
    pollIntervalMs < 0 ||
    pollIntervalMs > 60_000
  ) throw new Error("Vercel polling controls are outside the reviewed bounds.");
}

async function sleep(milliseconds) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function pollStagedDeployment(api, target, deploymentId, {
  maxPollAttempts,
  pollIntervalMs,
  delay,
}) {
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const deployment = await getDeployment(api, target, deploymentId);
    validateDeploymentIdentity(deployment, { projectId: target.projectId, deploymentId });
    const aliases = assertNoProductionAliases(deployment, target);
    if (["ERROR", "CANCELED"].includes(deployment.readyState)) {
      throw new Error(`The staged Vercel deployment entered terminal state ${deployment.readyState}.`);
    }
    if (deployment.readyState === "READY") {
      if (deployment.readySubstate !== "STAGED") {
        throw new Error("A READY Vercel deployment is not in the required STAGED substate.");
      }
      return { deployment, aliases };
    }
    if (attempt + 1 < maxPollAttempts) await delay(pollIntervalMs);
  }
  throw new Error("The staged Vercel deployment did not become READY/STAGED within the bounded poll window.");
}

async function uploadSources(api, target, files) {
  const uploaded = new Set();
  for (const file of files) {
    if (uploaded.has(file.providerSha1)) continue;
    await api.request("POST", "/v2/files", {
      teamId: target.teamId,
      body: file.bytes,
      headers: {
        "content-length": String(file.bytes.length),
        "content-type": "application/octet-stream",
        "x-vercel-digest": file.providerSha1,
      },
      expectedStatuses: [200, 201],
    });
    uploaded.add(file.providerSha1);
  }
}

function validateRollbackDisposition(value, artifactKind, priorDeploymentId) {
  assertExactKeys(value, [
    "mode", "priorClassification", "targetDeploymentId", "safetyEvidence",
  ], "Rollback disposition");
  if (artifactKind === "emergency-static") {
    if (
      value.mode !== "HOLD_PROMOTED" ||
      value.priorClassification !== "UNSAFE_PRECONTAINMENT" ||
      value.targetDeploymentId !== null ||
      value.safetyEvidence !== null
    ) throw new Error("Emergency containment must never authorize rollback to the pre-containment deployment.");
    return value;
  }
  if (
    artifactKind !== "next-standalone-container" ||
    value.mode !== "ROLLBACK_TO_SAFE_CONTAINMENT" ||
    value.priorClassification !== "SAFE_CONTAINMENT" ||
    value.targetDeploymentId !== priorDeploymentId
  ) throw new Error("The full frontend requires an exact safe-containment rollback disposition.");
  assertIdentifier(value.targetDeploymentId, DEPLOYMENT_ID_PATTERN, "Safe rollback target deployment ID");
  assertExactKeys(value.safetyEvidence, [
    "promotionEvidenceSha256", "promotionProvenanceSha256", "servedParityEvidenceSha256",
    "servedParityProvenanceSha256", "sourceCommit", "artifactSha256", "servedReleaseSha256",
  ], "Safe rollback evidence");
  for (const field of [
    "promotionEvidenceSha256", "promotionProvenanceSha256", "servedParityEvidenceSha256",
    "servedParityProvenanceSha256", "artifactSha256", "servedReleaseSha256",
  ]) assertHash(value.safetyEvidence[field], SHA256_PATTERN, `Safe rollback ${field}`);
  assertIdentifier(value.safetyEvidence.sourceCommit, COMMIT_PATTERN, "Safe rollback source commit");
  return value;
}

function validateSafeEmergencyParityComparison(
  value,
  promotion,
  promotionProvenanceSha256,
  releaseProfile,
) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "verificationProfile", "leftVantageId", "rightVantageId", "sourceCommit",
    "artifactSha256", "deploymentId", "promotionEvidenceSha256", "promotionProvenanceSha256",
    "promotionVerificationBindingSha256", "servedReleaseSha256", "identical", "evidenceSha256",
  ], "Safe-containment served-parity comparison");
  const { evidenceSha256, ...payload } = value;
  const verificationProfile = verificationProfileForRelease(releaseProfile);
  const vantageIds = vantageIdsForVerification(verificationProfile);
  if (
    value.kind !== "lester-labs-independent-emergency-vantage-comparison" ||
    value.schemaVersion !== 3 ||
    value.verificationProfile !== verificationProfile ||
    releaseProfileForVerification(value.verificationProfile) !== releaseProfile ||
    value.identical !== true ||
    value.sourceCommit !== promotion.sourceCommit ||
    value.artifactSha256 !== promotion.artifactSha256 ||
    value.deploymentId !== promotion.deployment.id ||
    value.promotionEvidenceSha256 !== promotion.evidenceSha256 ||
    value.promotionProvenanceSha256 !== promotionProvenanceSha256 ||
    new Set([value.leftVantageId, value.rightVantageId]).size !== 2 ||
    !vantageIds.every((id) => (
      value.leftVantageId === id || value.rightVantageId === id
    ))
  ) throw new Error("Safe-containment parity is not bound to the exact prior emergency promotion.");
  for (const field of [
    "artifactSha256", "promotionEvidenceSha256", "promotionProvenanceSha256",
    "promotionVerificationBindingSha256", "servedReleaseSha256", "evidenceSha256",
  ]) assertHash(value[field], SHA256_PATTERN, `Safe-containment parity ${field}`);
  if (evidenceSha256 !== sha256Canonical(payload)) {
    throw new Error("Safe-containment served-parity comparison digest is invalid.");
  }
  return value;
}

function resolveRollbackDisposition({
  artifactKind,
  releaseProfile,
  target,
  priorDeploymentId,
  safeRollbackPromotionEvidencePath,
  safeRollbackPromotionProvenancePath,
  safeRollbackParityEvidencePath,
  safeRollbackParityProvenancePath,
}) {
  const paths = [
    safeRollbackPromotionEvidencePath,
    safeRollbackPromotionProvenancePath,
    safeRollbackParityEvidencePath,
    safeRollbackParityProvenancePath,
  ];
  if (artifactKind === "emergency-static") {
    if (paths.some((path) => path !== undefined)) {
      throw new Error("Initial emergency containment does not accept a rollback target override.");
    }
    return {
      mode: "HOLD_PROMOTED",
      priorClassification: "UNSAFE_PRECONTAINMENT",
      targetDeploymentId: null,
      safetyEvidence: null,
    };
  }
  if (paths.some((path) => typeof path !== "string" || path.length === 0)) {
    throw new Error("The full frontend requires four signed safe-containment rollback inputs.");
  }
  const promotionRecord = readCanonicalJsonFile(
    safeRollbackPromotionEvidencePath,
    "Safe-containment promotion evidence",
  );
  const promotion = validatePromotionEvidence(promotionRecord.value);
  const promotionProvenance = provenanceRecord(
    safeRollbackPromotionProvenancePath,
    "safe-containment-promotion-sigstore",
  );
  const parityRecord = readCanonicalJsonFile(
    safeRollbackParityEvidencePath,
    "Safe-containment served-parity comparison",
  );
  const parityProvenance = provenanceRecord(
    safeRollbackParityProvenancePath,
    "safe-containment-parity-sigstore",
  );
  validateSafeEmergencyParityComparison(
    parityRecord.value,
    promotion,
    promotionProvenance.sha256,
    releaseProfile,
  );
  if (
    promotion.artifactKind !== "emergency-static" ||
    promotion.releaseProfile !== releaseProfile ||
    promotion.rollbackDisposition.mode !== "HOLD_PROMOTED" ||
    promotion.project.teamId !== target.teamId ||
    promotion.project.projectId !== target.projectId ||
    promotion.project.name !== target.projectName ||
    promotion.deployment.id !== priorDeploymentId
  ) throw new Error("The safe rollback evidence does not identify the exact current containment deployment.");
  return {
    mode: "ROLLBACK_TO_SAFE_CONTAINMENT",
    priorClassification: "SAFE_CONTAINMENT",
    targetDeploymentId: priorDeploymentId,
    safetyEvidence: {
      promotionEvidenceSha256: promotion.evidenceSha256,
      promotionProvenanceSha256: promotionProvenance.sha256,
      servedParityEvidenceSha256: parityRecord.sha256,
      servedParityProvenanceSha256: parityProvenance.sha256,
      sourceCommit: promotion.sourceCommit,
      artifactSha256: promotion.artifactSha256,
      servedReleaseSha256: parityRecord.value.servedReleaseSha256,
    },
  };
}

function stageEvidencePayload(
  prepared,
  target,
  priorDeploymentId,
  rollbackDisposition,
  deployment,
  aliases,
  stagedAt,
  workflow,
) {
  return {
    kind: "lester-labs-vercel-stage-evidence",
    schemaVersion: 4,
    status: "STAGED",
    artifactKind: prepared.artifactKind,
    stagedAt,
    source: prepared.source,
    review: prepared.review,
    artifact: prepared.artifact,
    sourceUpload: prepared.sourceUpload,
    providerBoundary: prepared.providerBoundary,
    project: {
      teamId: target.teamId,
      projectId: target.projectId,
      name: target.projectName,
      autoAssignCustomDomains: false,
    },
    projectSettings: prepared.projectSettings,
    workflow,
    deployment: {
      id: deployment.id,
      url: deploymentUrl(deployment),
      target: "production",
      readyState: "READY",
      readySubstate: "STAGED",
      aliasAssigned: deployment.aliasAssigned,
      aliases,
    },
    priorDeploymentId,
    rollbackDisposition,
  };
}

function deploymentMatchesOperation(deployment, target, metadata) {
  if (
    !deployment || deployment.projectId !== target.projectId || deployment.target !== "production" ||
    !deployment.meta || typeof deployment.meta !== "object"
  ) return false;
  return Object.entries(metadata).every(([key, value]) => deployment.meta[key] === value);
}

async function reconcileAmbiguousStageCreate(api, target, metadata, controls) {
  let lastRequestError;
  for (let attempt = 0; attempt < controls.maxPollAttempts; attempt += 1) {
    let result;
    try {
      result = await api.request(
        "GET",
        `/v6/deployments?projectId=${encodeURIComponent(target.projectId)}&target=production&limit=20`,
        { teamId: target.teamId },
      );
    } catch (error) {
      lastRequestError = error;
      if (attempt + 1 < controls.maxPollAttempts) await controls.delay(controls.pollIntervalMs);
      continue;
    }
    if (!Array.isArray(result?.deployments)) {
      throw new Error("Vercel returned a malformed deployment list during create reconciliation.");
    }
    const matches = result.deployments.filter((deployment) => (
      deploymentMatchesOperation(deployment, target, metadata)
    ));
    if (matches.length > 1) {
      throw new Error("Ambiguous stage creation matched more than one operation-bound deployment.");
    }
    if (matches.length === 1) return matches[0];
    if (attempt + 1 < controls.maxPollAttempts) await controls.delay(controls.pollIntervalMs);
  }
  throw new Error(
    "Ambiguous stage creation found no operation-bound deployment within the bounded poll window.",
    { cause: lastRequestError },
  );
}

async function deleteExactNoncurrentDeployment(api, target, deploymentId, priorDeploymentId) {
  const project = await getProject(api, target);
  const current = validateProject(project, target);
  if (current !== priorDeploymentId) {
    throw new Error("Refusing staged cleanup because the exact prior deployment is no longer current.");
  }
  const deployment = await getDeployment(api, target, deploymentId);
  validateDeploymentIdentity(deployment, { projectId: target.projectId, deploymentId });
  await api.request("DELETE", `/v13/deployments/${encodeURIComponent(deploymentId)}`, {
    teamId: target.teamId,
    expectedStatuses: [200, 202],
    parseJson: false,
  });
  await preflight(api, target, { expectedCurrentDeploymentId: priorDeploymentId });
}

export async function stageVercelRelease({
  prepared,
  releaseProfile,
  token,
  teamId,
  projectId,
  projectName,
  workflowRunId,
  workflowRunAttempt,
  sourceAttestationRunId,
  sourceAttestationRunAttempt,
  providerCanaryRunId,
  providerCanaryRunAttempt,
  safeRollbackPromotionEvidencePath,
  safeRollbackPromotionProvenancePath,
  safeRollbackParityEvidencePath,
  safeRollbackParityProvenancePath,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  delay = sleep,
  maxPollAttempts = DEFAULT_POLL_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  requestTimeoutMs,
} = {}) {
  validatePolling(maxPollAttempts, pollIntervalMs);
  assertReleaseProfile(releaseProfile);
  const target = {
    teamId: assertIdentifier(teamId, TEAM_ID_PATTERN, "Vercel team ID"),
    projectId: assertIdentifier(projectId, PROJECT_ID_PATTERN, "Vercel project ID"),
    projectName: assertIdentifier(projectName, PROJECT_NAME_PATTERN, "Vercel project name"),
    releaseProfile,
  };
  const workflow = {
    repository: REVIEWED_REPOSITORY,
    ref: REVIEWED_REF,
    path: REVIEWED_PROMOTION_WORKFLOW,
    runId: String(workflowRunId),
    runAttempt: Number(workflowRunAttempt),
    sourceAttestationRunId: String(sourceAttestationRunId),
    sourceAttestationRunAttempt: Number(sourceAttestationRunAttempt),
    providerCanaryRunId: String(providerCanaryRunId),
    providerCanaryRunAttempt: Number(providerCanaryRunAttempt),
  };
  if (
    !/^[1-9][0-9]{0,19}$/u.test(workflow.runId) ||
    !Number.isSafeInteger(workflow.runAttempt) || workflow.runAttempt < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(workflow.sourceAttestationRunId) ||
    !Number.isSafeInteger(workflow.sourceAttestationRunAttempt) || workflow.sourceAttestationRunAttempt < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(workflow.providerCanaryRunId) ||
    !Number.isSafeInteger(workflow.providerCanaryRunAttempt) || workflow.providerCanaryRunAttempt < 1
  ) throw new Error("Production staging workflow identity is invalid.");
  if (!prepared || !Array.isArray(prepared.uploadFiles) || prepared.uploadFiles.length === 0) {
    throw new Error("A locally validated release package is required.");
  }
  if (prepared.source.releaseProfile !== releaseProfile) {
    throw new Error("The staged release package differs from the selected release profile.");
  }
  if (!prepared.providerBoundary) {
    throw new Error("Production staging requires signed provider-canary evidence.");
  }
  if (
    prepared.providerBoundary.canaryWorkflow.runId !== workflow.providerCanaryRunId ||
    prepared.providerBoundary.canaryWorkflow.runAttempt !== workflow.providerCanaryRunAttempt ||
    prepared.providerBoundary.canaryWorkflow.sourceAttestationRunId !== workflow.sourceAttestationRunId ||
    prepared.providerBoundary.canaryWorkflow.sourceAttestationRunAttempt !== workflow.sourceAttestationRunAttempt
  ) throw new Error("Production staging workflow identity differs from signed provider-canary evidence.");
  summarizeUploadFiles(prepared.uploadFiles, prepared.sourceUpload.maximumBytes);
  const api = makeApi({ token, fetchImpl, requestTimeoutMs });
  const controls = { maxPollAttempts, pollIntervalMs, delay };

  // This authenticated read must complete before the first source byte is uploaded.
  const initial = await preflight(api, target);
  const priorDeploymentId = initial.currentDeploymentId;
  const rollbackDisposition = resolveRollbackDisposition({
    artifactKind: prepared.artifactKind,
    releaseProfile: prepared.source.releaseProfile,
    target,
    priorDeploymentId,
    safeRollbackPromotionEvidencePath,
    safeRollbackPromotionProvenancePath,
    safeRollbackParityEvidencePath,
    safeRollbackParityProvenancePath,
  });
  await uploadSources(api, target, prepared.uploadFiles);

  // Close the preflight/upload race before the mutating create call.
  await preflight(api, target, { expectedCurrentDeploymentId: priorDeploymentId });
  const metadata = {
    lesterArtifactKind: prepared.artifactKind,
    lesterArtifactSha256: prepared.artifact.sha256,
    lesterManifestSha256: prepared.source.manifestSha256,
    lesterOperation: "production-stage",
    lesterReleaseProfile: prepared.source.releaseProfile,
    lesterReleaseRunAttempt: String(workflow.runAttempt),
    lesterReleaseRunId: workflow.runId,
    lesterSourceCommit: prepared.source.commit,
    lesterSourceReviewSha256: prepared.source.sourceReviewSha256,
  };
  let created;
  let createdDeploymentId;
  try {
    try {
      created = await api.request(
        "POST",
        "/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1",
        {
          teamId,
          body: canonicalJson({
            name: projectName,
            project: projectId,
            target: "production",
            version: 2,
            autoAssignCustomDomains: false,
            files: prepared.uploadFiles.map((file) => ({
              file: file.path,
              sha: file.providerSha1,
              size: file.bytes.length,
            })),
            projectSettings: prepared.projectSettings,
            meta: metadata,
          }),
          headers: { "content-type": "application/json" },
          expectedStatuses: [200, 201, 202],
        },
      );
      assertIdentifier(created?.id, DEPLOYMENT_ID_PATTERN, "Created Vercel deployment ID");
    } catch (createError) {
      try {
        created = await reconcileAmbiguousStageCreate(api, target, metadata, controls);
      } catch (reconciliationError) {
        throw new Error(
          "Vercel stage creation failed and could not be reconciled to exactly one operation-bound deployment.",
          { cause: new AggregateError([createError, reconciliationError]) },
        );
      }
    }
    createdDeploymentId = assertIdentifier(created?.id, DEPLOYMENT_ID_PATTERN, "Created Vercel deployment ID");
    if (created.projectId !== projectId || created.target !== "production") {
      throw new Error("Vercel created a deployment outside the reviewed project or target.");
    }
    // The create response can contain Vercel's generated deployment URL in its
    // alias fields even when no routing mutation occurred. Treat the subsequent
    // deployment read as authoritative: pollStagedDeployment requires
    // READY/STAGED and no hostname outside the immutable deployment URL plus an
    // exact project-bound provider-metadata allow-list. Vercel can report
    // aliasAssigned=true for those system hostnames even though
    // autoAssignCustomDomains=false and neither reviewed custom domain is routed.
    const { deployment, aliases } = await pollStagedDeployment(
      api,
      target,
      createdDeploymentId,
      controls,
    );
    await preflight(api, target, { expectedCurrentDeploymentId: priorDeploymentId });
    const stagedAt = assertCanonicalTimestamp(now(), "Staged evidence timestamp");
    if (Date.parse(prepared.providerBoundary.checkedAt) > Date.parse(stagedAt)) {
      throw new Error("The reviewed provider canary is dated after the staged deployment.");
    }
    if (Date.parse(stagedAt) - Date.parse(prepared.providerBoundary.checkedAt) > MAXIMUM_PROVIDER_CANARY_AGE_MS) {
      throw new Error("The reviewed provider canary is older than the six-hour staging limit.");
    }
    const payload = stageEvidencePayload(
      prepared,
      target,
      priorDeploymentId,
      rollbackDisposition,
      deployment,
      aliases,
      stagedAt,
      workflow,
    );
    return { ...payload, evidenceSha256: sha256Canonical(payload) };
  } catch (operationError) {
    if (createdDeploymentId) {
      try {
        await deleteExactNoncurrentDeployment(api, target, createdDeploymentId, priorDeploymentId);
      } catch (cleanupError) {
        throw new Error(
          "Production staging failed and exact staged-deployment cleanup could not be confirmed.",
          { cause: new AggregateError([operationError, cleanupError]) },
        );
      }
    }
    throw operationError;
  }
}

export async function stageEmergencyRelease(options = {}) {
  return stageVercelRelease({
    ...options,
    prepared: prepareEmergencyRelease(options),
  });
}

export async function stageNextContainerRelease(options = {}) {
  return stageVercelRelease({
    ...options,
    prepared: prepareNextContainerRelease(options),
  });
}

async function cleanupStagedValue({
  stageEvidence,
  stageEvidenceSha256,
  stageProvenanceSha256,
  token,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  requestTimeoutMs,
}) {
  const stage = validateStageEvidence(structuredClone(stageEvidence));
  const target = {
    teamId: stage.project.teamId,
    projectId: stage.project.projectId,
    projectName: stage.project.name,
  };
  const api = makeApi({ token, fetchImpl, requestTimeoutMs });
  await deleteExactNoncurrentDeployment(
    api,
    target,
    stage.deployment.id,
    stage.priorDeploymentId,
  );
  const payload = {
    kind: "lester-labs-vercel-stage-cleanup",
    schemaVersion: 1,
    status: "DELETED",
    deletedAt: assertCanonicalTimestamp(now(), "Stage cleanup timestamp"),
    stageEvidenceSha256,
    stageProvenanceSha256,
    sourceCommit: stage.source.commit,
    artifactKind: stage.artifactKind,
    project: stage.project,
    deletedDeploymentId: stage.deployment.id,
    currentDeploymentId: stage.priorDeploymentId,
  };
  return { ...payload, evidenceSha256: sha256Canonical(payload) };
}

export async function cleanupStagedVercelRelease({
  stageEvidencePath,
  stageProvenancePath,
  ...options
} = {}) {
  const stageRecord = readCanonicalJsonFile(stageEvidencePath, "Vercel stage evidence");
  const stageProvenance = stageProvenancePath
    ? provenanceRecord(stageProvenancePath, "vercel-stage-sigstore")
    : null;
  return cleanupStagedValue({
    ...options,
    stageEvidence: stageRecord.value,
    stageEvidenceSha256: stageRecord.value.evidenceSha256,
    stageProvenanceSha256: stageProvenance?.sha256 ?? null,
  });
}

async function fetchCanaryProbe(origin, probe, fetchImpl, trustedProbeHeaders) {
  const url = new URL(probe.path, `${origin}/`);
  if (url.origin !== origin || !probe.path.startsWith("/") || probe.path.startsWith("//")) {
    throw new Error("A provider-canary probe path is unsafe.");
  }
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.1",
        "user-agent": "Lester-Labs-Provider-Canary/1",
        ...trustedProbeHeaders,
      },
    });
  } catch {
    throw new Error(`The provider-canary HTTP probe for ${probe.path} did not complete.`);
  }
  const bytes = await readResponseBounded(response, 16 * 1024 * 1024);
  if (response.status !== probe.status) {
    throw new Error(
      `The provider-canary HTTP probe for ${probe.path} returned status ${response.status}; expected ${probe.status}.`,
    );
  }
  if (probe.bytes && !bytes.equals(probe.bytes)) {
    throw new Error(`The provider-canary HTTP probe for ${probe.path} returned different bytes.`);
  }
  if (probe.bodySha256 && sha256Bytes(bytes) !== probe.bodySha256) {
    throw new Error(`The provider-canary HTTP probe for ${probe.path} returned a different digest.`);
  }
  for (const [name, expected] of Object.entries(probe.headers)) {
    if (response.headers.get(name) !== expected) {
      throw new Error(`The provider-canary HTTP probe for ${probe.path} differs at header ${name}.`);
    }
  }
  return {
    path: probe.path,
    status: response.status,
    bytes: bytes.length,
    sha256: sha256Bytes(bytes),
  };
}

async function verifyCanaryHttp(deployment, prepared, fetchImpl, trustedProbeHeaders) {
  const origin = deploymentUrl(deployment);
  const observations = [];
  for (const probe of prepared.canaryProbes) {
    observations.push(await fetchCanaryProbe(origin, probe, fetchImpl, trustedProbeHeaders));
  }
  return sha256Canonical(observations);
}

async function createProviderDeployment(api, target, prepared, workflow, controls) {
  const metadata = {
    lesterArtifactKind: prepared.artifactKind,
    lesterArtifactSha256: prepared.artifact.sha256,
    lesterManifestSha256: prepared.source.manifestSha256,
    lesterOperation: "provider-canary",
    lesterReleaseRunAttempt: String(workflow.runAttempt),
    lesterReleaseRunId: workflow.runId,
    lesterSourceCommit: prepared.source.commit,
    lesterSourceReviewSha256: prepared.source.sourceReviewSha256,
  };
  let created;
  try {
    created = await api.request(
      "POST",
      "/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1",
      {
        teamId: target.teamId,
        body: canonicalJson({
          name: target.projectName,
          project: target.projectId,
          target: "production",
          version: 2,
          autoAssignCustomDomains: false,
          files: prepared.uploadFiles.map((file) => ({
            file: file.path,
            sha: file.providerSha1,
            size: file.bytes.length,
          })),
          projectSettings: prepared.projectSettings,
          meta: metadata,
        }),
        headers: { "content-type": "application/json" },
        expectedStatuses: [200, 201, 202],
      },
    );
  } catch (createError) {
    try {
      created = await reconcileAmbiguousStageCreate(api, target, metadata, controls);
    } catch (reconciliationError) {
      throw new Error(
        "Vercel provider-canary creation failed and could not be reconciled to exactly one operation-bound deployment.",
        { cause: new AggregateError([createError, reconciliationError]) },
      );
    }
  }
  return created;
}

async function pollCanaryCurrent(api, target, fromDeploymentId, toDeploymentId, controls) {
  for (let attempt = 0; attempt < controls.maxPollAttempts; attempt += 1) {
    const project = await getProject(api, target);
    const current = validateProject(project, target);
    if (![fromDeploymentId, toDeploymentId].includes(current)) {
      throw new Error("A different deployment became current during the provider canary.");
    }
    if (current === toDeploymentId) {
      const deployment = await getDeployment(api, target, current);
      validateDeploymentIdentity(deployment, { projectId: target.projectId, deploymentId: current });
      if (["ERROR", "CANCELED"].includes(deployment.readyState)) {
        throw new Error(`The provider-canary current deployment entered terminal state ${deployment.readyState}.`);
      }
      if (deployment.readyState === "READY" && deployment.readySubstate === "PROMOTED") {
        return deployment;
      }
    }
    if (attempt + 1 < controls.maxPollAttempts) await controls.delay(controls.pollIntervalMs);
  }
  throw new Error(
    "The provider canary did not switch to the exact READY/PROMOTED deployment within the bounded poll window.",
  );
}

async function routeCanaryProject(api, target, endpoint, fromDeploymentId, toDeploymentId, controls) {
  let requestError;
  try {
    await api.request("POST", endpoint, {
      teamId: target.teamId,
      body: "{}\n",
      headers: { "content-type": "application/json" },
      expectedStatuses: [200, 201, 202],
      parseJson: false,
    });
  } catch (error) {
    // The provider can accept a mutation even when its HTTP response is lost.
    requestError = error;
  }
  try {
    return await pollCanaryCurrent(api, target, fromDeploymentId, toDeploymentId, controls);
  } catch (pollError) {
    throw new Error("The provider-canary routing mutation could not be confirmed.", {
      cause: requestError ? new AggregateError([requestError, pollError]) : pollError,
    });
  }
}

async function cleanFailedCanaryStage(api, target, stagedDeploymentId, rollbackDeploymentId, controls) {
  const project = await getProject(api, target);
  const current = validateProject(project, target);
  if (current === stagedDeploymentId) {
    await routeCanaryProject(
      api,
      target,
      `/v1/projects/${encodeURIComponent(target.projectId)}/rollback/${encodeURIComponent(rollbackDeploymentId)}`,
      stagedDeploymentId,
      rollbackDeploymentId,
      controls,
    );
  } else if (current !== rollbackDeploymentId) {
    throw new Error("A different deployment became current while cleaning a failed provider canary.");
  }
  await preflight(api, target, { expectedCurrentDeploymentId: rollbackDeploymentId });
  await api.request("DELETE", `/v13/deployments/${encodeURIComponent(stagedDeploymentId)}`, {
    teamId: target.teamId,
    expectedStatuses: [200, 202],
    parseJson: false,
  });
}

export async function runProviderCanary({
  artifactKind,
  releaseProfile,
  releaseDirectory,
  sourceDirectory,
  sourceCommit,
  maximumUploadBytes,
  token,
  teamId,
  projectId,
  projectName,
  productionProjectId,
  workflowRunId,
  workflowRunAttempt,
  sourceAttestationRunId,
  sourceAttestationRunAttempt,
  trustedOidcToken,
  fetchImpl = globalThis.fetch,
  publicFetchImpl = fetchImpl,
  now = () => new Date().toISOString(),
  delay = sleep,
  maxPollAttempts = DEFAULT_POLL_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  requestTimeoutMs,
} = {}) {
  validatePolling(maxPollAttempts, pollIntervalMs);
  const target = {
    teamId: assertIdentifier(teamId, TEAM_ID_PATTERN, "Vercel canary team ID"),
    projectId: assertIdentifier(projectId, PROJECT_ID_PATTERN, "Vercel canary project ID"),
    projectName: assertIdentifier(projectName, PROJECT_NAME_PATTERN, "Vercel canary project name"),
  };
  assertIdentifier(productionProjectId, PROJECT_ID_PATTERN, "Vercel production project ID");
  if (projectId === productionProjectId) throw new Error("Provider canaries must use a distinct disposable project.");
  const workflow = {
    repository: REVIEWED_REPOSITORY,
    ref: REVIEWED_REF,
    path: ".github/workflows/vercel-provider-canary.yml",
    runId: String(workflowRunId),
    runAttempt: Number(workflowRunAttempt),
    sourceAttestationRunId: String(sourceAttestationRunId),
    sourceAttestationRunAttempt: Number(sourceAttestationRunAttempt),
  };
  if (
    !/^[1-9][0-9]{0,19}$/u.test(workflow.runId) ||
    !Number.isSafeInteger(workflow.runAttempt) ||
    workflow.runAttempt < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(workflow.sourceAttestationRunId) ||
    !Number.isSafeInteger(workflow.sourceAttestationRunAttempt) ||
    workflow.sourceAttestationRunAttempt < 1
  ) throw new Error("Provider-canary workflow identity is invalid.");
  const trustedProbeHeaders = trustedOidcProbeHeaders(trustedOidcToken);
  assertReleaseProfile(releaseProfile);
  const bootstrap = { [PROVIDER_CANARY_BOOTSTRAP]: PROVIDER_CANARY_BOOTSTRAP };
  const prepared = artifactKind === "emergency-static"
    ? prepareEmergencyRelease({
      releaseDirectory,
      sourceDirectory,
      sourceCommit,
      releaseProfile,
      maximumUploadBytes,
      ...bootstrap,
    })
    : artifactKind === "next-standalone-container"
      ? prepareNextContainerRelease({ releaseDirectory, maximumUploadBytes, ...bootstrap })
      : (() => { throw new Error("The provider-canary artifact kind is unsupported."); })();
  if (prepared.source.releaseProfile !== releaseProfile) {
    throw new Error("The provider canary release package differs from the selected release profile.");
  }
  const api = makeApi({ token, fetchImpl, requestTimeoutMs });
  const initial = await preflight(api, target);
  const rollbackDeploymentId = initial.currentDeploymentId;
  await uploadSources(api, target, prepared.uploadFiles);
  await preflight(api, target, { expectedCurrentDeploymentId: rollbackDeploymentId });
  let stagedDeploymentId;
  const controls = { maxPollAttempts, pollIntervalMs, delay };
  let stagedHttpSha256;
  try {
    const created = await createProviderDeployment(api, target, prepared, workflow, controls);
    stagedDeploymentId = assertIdentifier(
      created?.id,
      DEPLOYMENT_ID_PATTERN,
      "Created Vercel deployment ID",
    );
    if (created.projectId !== target.projectId || created.target !== "production") {
      throw new Error("Vercel created a deployment outside the reviewed canary project or target.");
    }
    // Creation responses may describe the immutable per-deployment URL as an
    // alias. The authoritative deployment read below accepts only the exact
    // reviewed READY/STAGED provider-system-hostname state before probing.
    const { deployment: staged } = await pollStagedDeployment(api, target, stagedDeploymentId, controls);
    await preflight(api, target, { expectedCurrentDeploymentId: rollbackDeploymentId });
    stagedHttpSha256 = await verifyCanaryHttp(staged, prepared, publicFetchImpl, trustedProbeHeaders);
  } catch (operationError) {
    if (stagedDeploymentId) {
      try {
        await cleanFailedCanaryStage(api, target, stagedDeploymentId, rollbackDeploymentId, controls);
      } catch (cleanupError) {
        throw new Error("Provider canary staging failed and exact cleanup could not be confirmed.", {
          cause: new AggregateError([operationError, cleanupError]),
        });
      }
    }
    throw operationError;
  }

  let promotionRequested = false;
  let promotionHttpSha256;
  let operationError;
  try {
    promotionRequested = true;
    const current = await routeCanaryProject(
      api,
      target,
      `/v10/projects/${encodeURIComponent(target.projectId)}/promote/${encodeURIComponent(stagedDeploymentId)}`,
      rollbackDeploymentId,
      stagedDeploymentId,
      controls,
    );
    if (current.id !== stagedDeploymentId || current.readySubstate !== "PROMOTED") {
      throw new Error("Provider canary promotion did not preserve the exact deployment ID/substate.");
    }
    promotionHttpSha256 = await verifyCanaryHttp(current, prepared, publicFetchImpl, trustedProbeHeaders);
    if (promotionHttpSha256 !== stagedHttpSha256) {
      throw new Error("Provider canary bytes changed during same-ID promotion.");
    }
  } catch (error) {
    operationError = error;
  } finally {
    if (promotionRequested) {
      try {
        const project = await getProject(api, target);
        const currentDeploymentId = validateProject(project, target);
        if (currentDeploymentId === stagedDeploymentId) {
          await routeCanaryProject(
            api,
            target,
            `/v1/projects/${encodeURIComponent(target.projectId)}/rollback/${encodeURIComponent(rollbackDeploymentId)}`,
            stagedDeploymentId,
            rollbackDeploymentId,
            controls,
          );
        } else if (currentDeploymentId !== rollbackDeploymentId) {
          throw new Error("A different deployment became current while recovering the provider canary.");
        }
        await preflight(api, target, { expectedCurrentDeploymentId: rollbackDeploymentId });
      } catch (rollbackError) {
        throw new Error(
          `Provider canary rollback failed after promotion${operationError ? " and an earlier canary failure" : ""}.`,
          { cause: rollbackError },
        );
      }
    }
  }
  await preflight(api, target, { expectedCurrentDeploymentId: rollbackDeploymentId });
  await api.request("DELETE", `/v13/deployments/${encodeURIComponent(stagedDeploymentId)}`, {
    teamId: target.teamId,
    expectedStatuses: [200, 202],
    parseJson: false,
  });
  if (operationError) throw operationError;
  const checkedAt = assertCanonicalTimestamp(now(), "Provider-canary evidence timestamp");
  const payload = {
    kind: "lester-labs-vercel-provider-canary",
    schemaVersion: 3,
    status: "PASSED",
    providerMode: prepared.providerMode,
    releaseProfile: prepared.source.releaseProfile,
    checkedAt,
    sourceUploadSha256: prepared.sourceUpload.sha256,
    projectSettingsSha256: sha256Canonical(prepared.projectSettings),
    canaryProject: {
      teamId: target.teamId,
      projectId: target.projectId,
      name: target.projectName,
    },
    stagedDeploymentId,
    rollbackDeploymentId,
    workflow,
    results: {
      deploymentReachedReadyStaged: true,
      customProductionAliasesAbsent: true,
      providerModeAccepted: true,
      providerResourcesMatched: promotionHttpSha256 === stagedHttpSha256,
      exactIdPromotionNoRebuildVerified: true,
      exactIdRollbackVerified: true,
    },
  };
  const value = { ...payload, evidenceSha256: sha256Canonical(payload) };
  validateProviderCanary(value, {
    providerMode: prepared.providerMode,
    releaseProfile: prepared.source.releaseProfile,
    sourceUploadSha256: prepared.sourceUpload.sha256,
    projectSettingsSha256: sha256Canonical(prepared.projectSettings),
  });
  return value;
}

export function validateStageEvidence(value) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "status", "artifactKind", "stagedAt", "source", "review",
    "artifact", "sourceUpload", "providerBoundary", "project", "projectSettings", "workflow", "deployment",
    "priorDeploymentId", "rollbackDisposition", "evidenceSha256",
  ], "Vercel stage evidence");
  if (
    value.kind !== "lester-labs-vercel-stage-evidence" ||
    value.schemaVersion !== 4 ||
    value.status !== "STAGED" ||
    !["emergency-static", "next-standalone-container"].includes(value.artifactKind)
  ) throw new Error("The Vercel stage evidence kind, schema, status, or artifact kind is unsupported.");
  const { evidenceSha256, ...payload } = value;
  assertHash(evidenceSha256, SHA256_PATTERN, "Vercel stage evidence digest");
  if (evidenceSha256 !== sha256Canonical(payload)) throw new Error("The Vercel stage evidence digest is invalid.");
  assertCanonicalTimestamp(value.stagedAt, "Vercel stage timestamp");
  assertExactKeys(value.source, ["commit", "manifestSha256", "releaseProfile", "sourceReviewSha256"], "Stage source");
  assertIdentifier(value.source.commit, COMMIT_PATTERN, "Stage source commit");
  assertHash(value.source.manifestSha256, SHA256_PATTERN, "Stage manifest digest");
  assertReleaseProfile(value.source.releaseProfile, "Stage release profile");
  assertHash(value.source.sourceReviewSha256, SHA256_PATTERN, "Stage source-review digest");
  assertExactKeys(value.review, ["evidence"], "Stage review");
  if (!Array.isArray(value.review.evidence) || value.review.evidence.length < 2) {
    throw new Error("Stage review evidence is incomplete.");
  }
  if (value.source.sourceReviewSha256 !== sha256Canonical(value.review)) {
    throw new Error("Stage source-review digest does not match the review evidence.");
  }
  const reviewKinds = new Set();
  for (const item of value.review.evidence) {
    assertExactKeys(item, ["kind", "sha256"], "Stage review evidence item");
    if (typeof item.kind !== "string" || !/^[a-z0-9][a-z0-9-]{2,79}$/u.test(item.kind) || reviewKinds.has(item.kind)) {
      throw new Error("Stage review evidence kinds are invalid or duplicated.");
    }
    reviewKinds.add(item.kind);
    assertHash(item.sha256, SHA256_PATTERN, "Stage review evidence item digest");
  }
  assertExactKeys(value.artifact, ["format", "bytes", "sha256"], "Stage artifact");
  if (typeof value.artifact.format !== "string" || !Number.isSafeInteger(value.artifact.bytes) || value.artifact.bytes <= 0) {
    throw new Error("Stage artifact metadata is invalid.");
  }
  assertHash(value.artifact.sha256, SHA256_PATTERN, "Stage artifact digest");
  assertExactKeys(value.sourceUpload, ["maximumBytes", "totalBytes", "sha256", "files"], "Stage source upload");
  assertUploadLimit(value.sourceUpload.maximumBytes);
  if (
    !Number.isSafeInteger(value.sourceUpload.totalBytes) ||
    value.sourceUpload.totalBytes <= 0 ||
    value.sourceUpload.totalBytes > value.sourceUpload.maximumBytes ||
    !Array.isArray(value.sourceUpload.files)
  ) throw new Error("Stage source-upload size metadata is invalid.");
  let uploadTotal = 0;
  for (const file of value.sourceUpload.files) {
    assertExactKeys(file, ["path", "bytes", "providerSha1", "securitySha256"], "Stage source-upload file");
    safeRelativePath(file.path, "Stage source-upload path");
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) throw new Error("Stage source-upload file size is invalid.");
    assertHash(file.providerSha1, SHA1_PATTERN, "Stage provider SHA-1");
    assertHash(file.securitySha256, SHA256_PATTERN, "Stage security SHA-256");
    uploadTotal += file.bytes;
  }
  if (
    uploadTotal !== value.sourceUpload.totalBytes ||
    value.sourceUpload.sha256 !== sha256Canonical(value.sourceUpload.files)
  ) throw new Error("Stage source-upload summary is invalid.");
  assertExactKeys(value.providerBoundary, [
    "mode", "checkedAt", "canaryEvidenceSha256", "canaryProvenanceSha256", "canaryWorkflow",
  ], "Stage provider boundary");
  const expectedProviderMode = value.artifactKind === "emergency-static"
    ? "build-output-api-v3-static"
    : "vercel-container-public-beta";
  if (value.providerBoundary.mode !== expectedProviderMode) {
    throw new Error("Stage evidence names an unreviewed Vercel provider mode.");
  }
  assertCanonicalTimestamp(value.providerBoundary.checkedAt, "Stage provider-canary timestamp");
  if (Date.parse(value.providerBoundary.checkedAt) > Date.parse(value.stagedAt)) {
    throw new Error("Stage provider-canary evidence is dated after staging.");
  }
  if (Date.parse(value.stagedAt) - Date.parse(value.providerBoundary.checkedAt) > MAXIMUM_PROVIDER_CANARY_AGE_MS) {
    throw new Error("Stage provider-canary evidence exceeds the six-hour maximum age.");
  }
  assertHash(value.providerBoundary.canaryEvidenceSha256, SHA256_PATTERN, "Stage provider-canary evidence digest");
  assertHash(value.providerBoundary.canaryProvenanceSha256, SHA256_PATTERN, "Stage provider-canary provenance digest");
  assertExactKeys(value.providerBoundary.canaryWorkflow, [
    "repository", "ref", "path", "runId", "runAttempt", "sourceAttestationRunId",
    "sourceAttestationRunAttempt",
  ], "Stage provider-canary workflow identity");
  if (
    value.providerBoundary.canaryWorkflow.repository !== REVIEWED_REPOSITORY ||
    value.providerBoundary.canaryWorkflow.ref !== REVIEWED_REF ||
    value.providerBoundary.canaryWorkflow.path !== ".github/workflows/vercel-provider-canary.yml" ||
    value.providerBoundary.canaryWorkflow.runId !== value.workflow.providerCanaryRunId ||
    value.providerBoundary.canaryWorkflow.runAttempt !== value.workflow.providerCanaryRunAttempt ||
    value.providerBoundary.canaryWorkflow.sourceAttestationRunId !== value.workflow.sourceAttestationRunId ||
    value.providerBoundary.canaryWorkflow.sourceAttestationRunAttempt !== value.workflow.sourceAttestationRunAttempt
  ) throw new Error("Stage provider-canary workflow identity differs from the production workflow binding.");
  if (
    !value.review.evidence.some((item) => item.kind === "provider-canary" && item.sha256 === value.providerBoundary.canaryEvidenceSha256) ||
    !value.review.evidence.some((item) => item.kind === "provider-canary-sigstore" && item.sha256 === value.providerBoundary.canaryProvenanceSha256)
  ) throw new Error("Stage provider-canary evidence is not bound into source review.");
  assertExactKeys(value.project, ["teamId", "projectId", "name", "autoAssignCustomDomains"], "Stage project");
  assertIdentifier(value.project.teamId, TEAM_ID_PATTERN, "Stage team ID");
  assertIdentifier(value.project.projectId, PROJECT_ID_PATTERN, "Stage project ID");
  assertIdentifier(value.project.name, PROJECT_NAME_PATTERN, "Stage project name");
  if (value.project.autoAssignCustomDomains !== false) throw new Error("Stage evidence permits domain auto-assignment.");
  const expectedSettings = value.artifactKind === "emergency-static"
    ? REVIEWED_STATIC_PROJECT_SETTINGS
    : REVIEWED_CONTAINER_PROJECT_SETTINGS;
  if (canonicalJson(value.projectSettings) !== canonicalJson(expectedSettings)) {
    throw new Error("Stage evidence contains unreviewed Vercel project settings.");
  }
  assertExactKeys(value.workflow, [
    "repository", "ref", "path", "runId", "runAttempt", "sourceAttestationRunId",
    "sourceAttestationRunAttempt", "providerCanaryRunId", "providerCanaryRunAttempt",
  ], "Stage workflow identity");
  if (
    value.workflow.repository !== REVIEWED_REPOSITORY ||
    value.workflow.ref !== REVIEWED_REF ||
    value.workflow.path !== REVIEWED_PROMOTION_WORKFLOW ||
    !/^[1-9][0-9]{0,19}$/u.test(value.workflow.runId) ||
    !Number.isSafeInteger(value.workflow.runAttempt) || value.workflow.runAttempt < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(value.workflow.sourceAttestationRunId) ||
    !Number.isSafeInteger(value.workflow.sourceAttestationRunAttempt) || value.workflow.sourceAttestationRunAttempt < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(value.workflow.providerCanaryRunId) ||
    !Number.isSafeInteger(value.workflow.providerCanaryRunAttempt) || value.workflow.providerCanaryRunAttempt < 1
  ) throw new Error("Stage workflow identity is invalid.");
  assertExactKeys(value.deployment, [
    "id", "url", "target", "readyState", "readySubstate", "aliasAssigned", "aliases",
  ], "Stage deployment");
  assertIdentifier(value.deployment.id, DEPLOYMENT_ID_PATTERN, "Stage deployment ID");
  deploymentUrl(value.deployment);
  const stagedTarget = {
    teamId: value.project.teamId,
    projectId: value.project.projectId,
    projectName: value.project.name,
    releaseProfile: value.source.releaseProfile,
  };
  if (
    value.deployment.target !== "production" ||
    value.deployment.readyState !== "READY" ||
    value.deployment.readySubstate !== "STAGED" ||
    typeof value.deployment.aliasAssigned !== "boolean" ||
    !Array.isArray(value.deployment.aliases)
  ) throw new Error("Stage deployment is not a custom-domain-free READY/STAGED production build.");
  assertNoProductionAliases(value.deployment, stagedTarget);
  assertIdentifier(value.priorDeploymentId, DEPLOYMENT_ID_PATTERN, "Stage prior deployment ID");
  if (value.priorDeploymentId === value.deployment.id) {
    throw new Error("The staged and prior deployment IDs must differ.");
  }
  validateRollbackDisposition(value.rollbackDisposition, value.artifactKind, value.priorDeploymentId);
  return value;
}

function validatePromotionApproval(
  value,
  stage,
  stageProvenanceSha256,
  parity,
  parityProvenanceSha256,
  nowMs,
) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "status", "artifactKind", "sourceCommit", "stageEvidenceSha256",
    "stageProvenanceSha256",
    "manifestSha256", "artifactSha256", "teamId", "projectId", "projectName", "deploymentId",
    "priorDeploymentId", "rollbackDisposition", "parityEvidenceSha256", "parityProvenanceSha256", "repository", "ref",
    "workflowPath", "protectedEnvironment", "workflowRunId", "workflowRunAttempt", "requestedBy",
    "approvedAt", "expiresAt",
  ], "Vercel promotion approval");
  if (
    value.kind !== "lester-labs-vercel-promotion-approval" ||
    value.schemaVersion !== 2 ||
    value.status !== "APPROVED"
  ) throw new Error("The Vercel promotion approval kind, schema, or status is unsupported.");
  const bindings = {
    artifactKind: stage.artifactKind,
    sourceCommit: stage.source.commit,
    stageEvidenceSha256: stage.evidenceSha256,
    stageProvenanceSha256,
    manifestSha256: stage.source.manifestSha256,
    artifactSha256: stage.artifact.sha256,
    teamId: stage.project.teamId,
    projectId: stage.project.projectId,
    projectName: stage.project.name,
    deploymentId: stage.deployment.id,
    priorDeploymentId: stage.priorDeploymentId,
    parityEvidenceSha256: sha256Bytes(parity.bytes),
    parityProvenanceSha256,
  };
  for (const [field, expected] of Object.entries(bindings)) {
    if (value[field] !== expected) throw new Error(`The promotion approval is bound to another ${field}.`);
  }
  if (canonicalJson(value.rollbackDisposition) !== canonicalJson(stage.rollbackDisposition)) {
    throw new Error("The promotion approval is bound to another rollback disposition.");
  }
  validateRollbackDisposition(value.rollbackDisposition, stage.artifactKind, stage.priorDeploymentId);
  if (
    value.repository !== REVIEWED_REPOSITORY ||
    value.ref !== REVIEWED_REF ||
    value.workflowPath !== REVIEWED_PROMOTION_WORKFLOW ||
    value.protectedEnvironment !== REVIEWED_PROMOTION_ENVIRONMENT
  ) throw new Error("The promotion approval has an unreviewed protected workflow identity.");
  if (typeof value.workflowRunId !== "string" || !/^[1-9][0-9]{0,19}$/u.test(value.workflowRunId)) {
    throw new Error("The promotion approval workflow run ID is invalid.");
  }
  if (!Number.isSafeInteger(value.workflowRunAttempt) || value.workflowRunAttempt < 1) {
    throw new Error("The promotion approval workflow run attempt is invalid.");
  }
  if (typeof value.requestedBy !== "string" || !/^@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u.test(value.requestedBy)) {
    throw new Error("The promotion approval requester is invalid.");
  }
  const approvedAt = Date.parse(assertCanonicalTimestamp(value.approvedAt, "Promotion approval timestamp"));
  const expiresAt = Date.parse(assertCanonicalTimestamp(value.expiresAt, "Promotion approval expiry"));
  if (
    expiresAt <= approvedAt ||
    expiresAt - approvedAt > MAXIMUM_APPROVAL_LIFETIME_MS ||
    nowMs < approvedAt ||
    nowMs >= expiresAt
  ) throw new Error("The promotion approval is expired, premature, or valid for too long.");
  return value;
}

const STAGED_PARITY_RESULT_FIELDS = Object.freeze([
  "deploymentIdentityMatched",
  "servedArtifactMatched",
  "securityPolicyMatched",
  "networkPolicyMatched",
  "interactionPolicyMatched",
  "providerResourcePolicyMatched",
]);

export function validateStagedParityEvidence(value, stageEvidence) {
  const stage = validateStageEvidence(structuredClone(stageEvidence));
  assertExactKeys(value, [
    "kind", "schemaVersion", "status", "checkedAt", "stageEvidenceSha256", "sourceCommit",
    "artifactKind", "artifactSha256", "deploymentId", "deploymentUrl", "profiles", "results",
    "evidenceSha256",
  ], "Vercel staged-parity evidence");
  if (
    value.kind !== "lester-labs-vercel-staged-parity" ||
    value.schemaVersion !== 1 ||
    value.status !== "PASSED" ||
    value.stageEvidenceSha256 !== stage.evidenceSha256 ||
    value.sourceCommit !== stage.source.commit ||
    value.artifactKind !== stage.artifactKind ||
    value.artifactSha256 !== stage.artifact.sha256 ||
    value.deploymentId !== stage.deployment.id ||
    value.deploymentUrl !== stage.deployment.url
  ) throw new Error("Staged-parity evidence is not bound to the exact staged release.");
  assertCanonicalTimestamp(value.checkedAt, "Staged-parity timestamp");
  if (Date.parse(value.checkedAt) < Date.parse(stage.stagedAt)) {
    throw new Error("Staged-parity evidence predates the staged deployment.");
  }
  if (!Array.isArray(value.profiles) || value.profiles.length < 2 || value.profiles.length > 16) {
    throw new Error("Staged-parity evidence requires two to sixteen reviewed observation profiles.");
  }
  let previousProfile = "";
  for (const profile of value.profiles) {
    assertExactKeys(profile, ["id", "evidenceSha256"], "Staged-parity profile");
    if (
      typeof profile.id !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/u.test(profile.id) ||
      (previousProfile && profile.id <= previousProfile)
    ) throw new Error("Staged-parity profiles must have sorted unique bounded IDs.");
    previousProfile = profile.id;
    assertHash(profile.evidenceSha256, SHA256_PATTERN, "Staged-parity profile evidence digest");
  }
  assertExactKeys(value.results, STAGED_PARITY_RESULT_FIELDS, "Staged-parity results");
  if (STAGED_PARITY_RESULT_FIELDS.some((field) => value.results[field] !== true)) {
    throw new Error("Every staged-parity policy result must pass.");
  }
  const { evidenceSha256, ...payload } = value;
  assertHash(evidenceSha256, SHA256_PATTERN, "Staged-parity evidence digest");
  if (evidenceSha256 !== sha256Canonical(payload)) throw new Error("Staged-parity evidence digest is invalid.");
  return value;
}

function readParityEvidence(path, stage) {
  const record = readCanonicalJsonFile(path, "Signed staged-parity evidence", 32 * 1024 * 1024);
  validateStagedParityEvidence(record.value, stage);
  return record;
}

export function createPromotionApproval({
  stageEvidence,
  stageProvenancePath,
  parityEvidencePath,
  parityProvenancePath,
  workflowRunId,
  workflowRunAttempt,
  requestedBy,
  approvedAt,
  expiresAt,
} = {}) {
  const stage = validateStageEvidence(structuredClone(stageEvidence));
  const stageProvenance = provenanceRecord(stageProvenancePath, "vercel-stage-sigstore");
  const parity = readParityEvidence(parityEvidencePath, stage);
  const parityProvenance = provenanceRecord(parityProvenancePath, "staged-parity-sigstore");
  const value = {
    kind: "lester-labs-vercel-promotion-approval",
    schemaVersion: 2,
    status: "APPROVED",
    artifactKind: stage.artifactKind,
    sourceCommit: stage.source.commit,
    stageEvidenceSha256: stage.evidenceSha256,
    stageProvenanceSha256: stageProvenance.sha256,
    manifestSha256: stage.source.manifestSha256,
    artifactSha256: stage.artifact.sha256,
    teamId: stage.project.teamId,
    projectId: stage.project.projectId,
    projectName: stage.project.name,
    deploymentId: stage.deployment.id,
    priorDeploymentId: stage.priorDeploymentId,
    rollbackDisposition: stage.rollbackDisposition,
    parityEvidenceSha256: parity.sha256,
    parityProvenanceSha256: parityProvenance.sha256,
    repository: REVIEWED_REPOSITORY,
    ref: REVIEWED_REF,
    workflowPath: REVIEWED_PROMOTION_WORKFLOW,
    protectedEnvironment: REVIEWED_PROMOTION_ENVIRONMENT,
    workflowRunId: String(workflowRunId),
    workflowRunAttempt: Number(workflowRunAttempt),
    requestedBy: requestedBy?.startsWith("@") ? requestedBy : `@${requestedBy}`,
    approvedAt,
    expiresAt,
  };
  validatePromotionApproval(
    value,
    stage,
    stageProvenance.sha256,
    parity,
    parityProvenance.sha256,
    Date.parse(approvedAt),
  );
  return value;
}

async function pollPromoted(api, target, stage, {
  maxPollAttempts,
  pollIntervalMs,
  delay,
}) {
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const project = await getProject(api, target);
    const current = validateProject(project, target);
    if (![stage.priorDeploymentId, stage.deployment.id].includes(current)) {
      throw new Error("A different deployment became current during promotion.");
    }
    const deployment = await getDeployment(api, target, stage.deployment.id);
    validateDeploymentIdentity(deployment, { projectId: target.projectId, deploymentId: stage.deployment.id });
    if (["ERROR", "CANCELED"].includes(deployment.readyState)) {
      throw new Error(`The promotion target entered terminal state ${deployment.readyState}.`);
    }
    if (current === stage.deployment.id) {
      if (deployment.readyState !== "READY" || deployment.readySubstate !== "PROMOTED") {
        throw new Error("The exact current deployment is not READY/PROMOTED.");
      }
      const aliases = assertCurrentProductionDeployment(deployment, target);
      return { deployment, aliases };
    }
    if (attempt + 1 < maxPollAttempts) await delay(pollIntervalMs);
  }
  throw new Error("The exact staged deployment did not become current within the bounded poll window.");
}

async function readPromotionRecoveryCurrent(api, target, stage, {
  maxPollAttempts,
  pollIntervalMs,
  delay,
}) {
  let lastRequestError;
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    let project;
    try {
      project = await getProject(api, target);
    } catch (error) {
      lastRequestError = error;
      if (attempt + 1 < maxPollAttempts) await delay(pollIntervalMs);
      continue;
    }
    const current = validateProject(project, target);
    if (![stage.priorDeploymentId, stage.deployment.id].includes(current)) {
      throw new Error(
        "A different deployment became current while recovering an incomplete promotion; refusing to overwrite it.",
      );
    }
    return current;
  }
  throw new Error(
    "Vercel recovery could not determine the exact current production deployment within the bounded poll window.",
    { cause: lastRequestError },
  );
}

async function confirmPromotionRecoveryTarget(api, target, stage, controls) {
  let lastRequestError;
  for (let attempt = 0; attempt < controls.maxPollAttempts; attempt += 1) {
    let project;
    try {
      project = await getProject(api, target);
    } catch (error) {
      lastRequestError = error;
      if (attempt + 1 < controls.maxPollAttempts) await controls.delay(controls.pollIntervalMs);
      continue;
    }
    const current = validateProject(project, target);
    if (![stage.priorDeploymentId, stage.deployment.id].includes(current)) {
      throw new Error(
        "A different deployment became current while confirming promotion recovery; refusing to overwrite it.",
      );
    }
    if (current === stage.deployment.id) {
      if (attempt + 1 < controls.maxPollAttempts) await controls.delay(controls.pollIntervalMs);
      continue;
    }
    let deployment;
    try {
      deployment = await getDeployment(api, target, stage.priorDeploymentId);
    } catch (error) {
      lastRequestError = error;
      if (attempt + 1 < controls.maxPollAttempts) await controls.delay(controls.pollIntervalMs);
      continue;
    }
    validateDeploymentIdentity(deployment, {
      projectId: target.projectId,
      deploymentId: stage.priorDeploymentId,
    });
    if (deployment.readyState !== "READY") {
      throw new Error("The exact promotion recovery deployment is not READY.");
    }
    assertCurrentProductionDeployment(deployment, target);
    return;
  }
  throw new Error(
    "Vercel recovery did not restore and confirm the exact prior deployment within the bounded poll window.",
    { cause: lastRequestError },
  );
}

async function recoverIncompletePromotion(api, target, stage, controls) {
  const current = await readPromotionRecoveryCurrent(api, target, stage, controls);
  if (current === stage.priorDeploymentId) {
    await confirmPromotionRecoveryTarget(api, target, stage, controls);
    return { state: "PRIOR_CURRENT" };
  }

  if (stage.rollbackDisposition.mode === "HOLD_PROMOTED") {
    const deployment = await getDeployment(api, target, stage.deployment.id);
    validateDeploymentIdentity(deployment, {
      projectId: target.projectId,
      deploymentId: stage.deployment.id,
    });
    if (deployment.readyState !== "READY" || deployment.readySubstate !== "PROMOTED") {
      throw new Error("The held emergency containment deployment is not READY/PROMOTED.");
    }
    const aliases = assertCurrentProductionDeployment(deployment, target);
    return { state: "PROMOTED_CURRENT", deployment, aliases };
  }

  let rollbackTarget;
  try {
    rollbackTarget = await getDeployment(api, target, stage.priorDeploymentId);
  } catch (error) {
    throw new Error("Vercel recovery could not read the exact prior deployment.", { cause: error });
  }
  validateDeploymentIdentity(rollbackTarget, {
    projectId: target.projectId,
    deploymentId: stage.priorDeploymentId,
  });
  if (rollbackTarget.readyState !== "READY") {
    throw new Error("The exact promotion recovery deployment is not READY.");
  }

  let rollbackRequestError;
  try {
    await api.request(
      "POST",
      `/v1/projects/${encodeURIComponent(target.projectId)}/rollback/${encodeURIComponent(stage.priorDeploymentId)}`,
      {
        teamId: target.teamId,
        body: "{}\n",
        headers: { "content-type": "application/json" },
        expectedStatuses: [200, 201, 202],
        parseJson: false,
      },
    );
  } catch (error) {
    // A failed response can still follow a provider-accepted mutation. Confirmation below is authoritative.
    rollbackRequestError = error;
  }
  try {
    await confirmPromotionRecoveryTarget(api, target, stage, controls);
  } catch (error) {
    throw new Error(
      "Vercel recovery could not confirm the exact prior deployment after requesting rollback.",
      { cause: rollbackRequestError ?? error },
    );
  }
  return { state: "PRIOR_CURRENT" };
}

export async function promoteVercelRelease({
  stageEvidencePath,
  stageProvenancePath,
  approvalPath,
  approvalProvenancePath,
  parityEvidencePath,
  parityProvenancePath,
  token,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  delay = sleep,
  maxPollAttempts = DEFAULT_POLL_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  requestTimeoutMs,
} = {}) {
  validatePolling(maxPollAttempts, pollIntervalMs);
  const stageRecord = readCanonicalJsonFile(stageEvidencePath, "Vercel stage evidence");
  const stage = validateStageEvidence(stageRecord.value);
  const stageProvenance = provenanceRecord(stageProvenancePath, "vercel-stage-sigstore");
  const approvalRecord = readCanonicalJsonFile(approvalPath, "Signed Vercel promotion approval");
  const approvalProvenance = provenanceRecord(
    approvalProvenancePath,
    "promotion-approval-sigstore",
  );
  const parity = readParityEvidence(parityEvidencePath, stage);
  const parityProvenance = provenanceRecord(parityProvenancePath, "staged-parity-sigstore");
  const operationTime = assertCanonicalTimestamp(now(), "Promotion evidence timestamp");
  if (
    Date.parse(stage.providerBoundary.checkedAt) > Date.parse(operationTime) ||
    Date.parse(operationTime) - Date.parse(stage.providerBoundary.checkedAt) > MAXIMUM_PROVIDER_CANARY_AGE_MS
  ) throw new Error("Promotion requires provider-canary evidence no older than six hours.");
  validatePromotionApproval(
    approvalRecord.value,
    stage,
    stageProvenance.sha256,
    parity,
    parityProvenance.sha256,
    Date.parse(operationTime),
  );
  const target = {
    teamId: stage.project.teamId,
    projectId: stage.project.projectId,
    projectName: stage.project.name,
    releaseProfile: stage.source.releaseProfile,
  };
  const api = makeApi({ token, fetchImpl, requestTimeoutMs });
  await preflight(api, target, { expectedCurrentDeploymentId: stage.priorDeploymentId });
  const staged = await getDeployment(api, target, stage.deployment.id);
  validateDeploymentIdentity(staged, { projectId: target.projectId, deploymentId: stage.deployment.id });
  if (staged.readyState !== "READY" || staged.readySubstate !== "STAGED") {
    throw new Error("The exact approved deployment is no longer READY/STAGED.");
  }
  assertNoProductionAliases(staged, target);
  const controls = {
    maxPollAttempts,
    pollIntervalMs,
    delay,
  };
  let deployment;
  let aliases;
  let confirmation = "DIRECT";
  try {
    await api.request(
      "POST",
      `/v10/projects/${encodeURIComponent(target.projectId)}/promote/${encodeURIComponent(stage.deployment.id)}`,
      {
        teamId: target.teamId,
        body: "{}\n",
        headers: { "content-type": "application/json" },
        expectedStatuses: [200, 201, 202],
        parseJson: false,
      },
    );
    ({ deployment, aliases } = await pollPromoted(api, target, stage, controls));
  } catch (operationError) {
    let recovery;
    try {
      recovery = await recoverIncompletePromotion(api, target, stage, controls);
    } catch (recoveryError) {
      throw new Error(
        "Vercel promotion failed and recovery could not establish an allowed exact deployment; treat production routing as an incident.",
        { cause: new AggregateError([operationError, recoveryError]) },
      );
    }
    if (recovery.state === "PROMOTED_CURRENT") {
      ({ deployment, aliases } = recovery);
      confirmation = "RECOVERED_AFTER_AMBIGUOUS_RESPONSE";
    } else {
      throw new Error(
        "Vercel promotion failed with its exact prior deployment current and confirmed.",
        { cause: operationError },
      );
    }
  }
  const payload = {
    kind: "lester-labs-vercel-promotion-evidence",
    schemaVersion: 3,
    status: "CURRENT",
    confirmation,
    promotedAt: operationTime,
    sourceCommit: stage.source.commit,
    releaseProfile: stage.source.releaseProfile,
    artifactKind: stage.artifactKind,
    manifestSha256: stage.source.manifestSha256,
    artifactSha256: stage.artifact.sha256,
    stageEvidenceSha256: stage.evidenceSha256,
    stageProvenanceSha256: stageProvenance.sha256,
    promotionApprovalSha256: approvalRecord.sha256,
    promotionApprovalProvenanceSha256: approvalProvenance.sha256,
    parityEvidenceSha256: parity.sha256,
    parityProvenanceSha256: parityProvenance.sha256,
    project: stage.project,
    deployment: {
      id: deployment.id,
      url: deploymentUrl(deployment),
      target: "production",
      readyState: "READY",
      readySubstate: "PROMOTED",
      aliasAssigned: true,
      aliases,
    },
    priorDeploymentId: stage.priorDeploymentId,
    rollbackDisposition: stage.rollbackDisposition,
  };
  return { ...payload, evidenceSha256: sha256Canonical(payload) };
}

export async function recoverVercelPromotion({
  stageEvidencePath,
  stageProvenancePath,
  token,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  delay = sleep,
  maxPollAttempts = DEFAULT_POLL_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  requestTimeoutMs,
} = {}) {
  validatePolling(maxPollAttempts, pollIntervalMs);
  const stageRecord = readCanonicalJsonFile(stageEvidencePath, "Vercel stage evidence");
  const stage = validateStageEvidence(stageRecord.value);
  const stageProvenance = provenanceRecord(stageProvenancePath, "vercel-stage-sigstore");
  const target = {
    teamId: stage.project.teamId,
    projectId: stage.project.projectId,
    projectName: stage.project.name,
  };
  const api = makeApi({ token, fetchImpl, requestTimeoutMs });
  const controls = { maxPollAttempts, pollIntervalMs, delay };
  const observed = await readPromotionRecoveryCurrent(api, target, stage, controls);
  let action;
  let currentDeploymentId;
  if (observed === stage.deployment.id) {
    const recovery = await recoverIncompletePromotion(api, target, stage, controls);
    if (recovery.state === "PROMOTED_CURRENT") {
      action = "HELD_PROMOTED";
      currentDeploymentId = stage.deployment.id;
    } else {
      action = "ROLLED_BACK_TO_SAFE_CONTAINMENT";
      currentDeploymentId = stage.priorDeploymentId;
    }
  } else {
    await confirmPromotionRecoveryTarget(api, target, stage, controls);
    action = stage.rollbackDisposition.mode === "HOLD_PROMOTED"
      ? "UNSAFE_PRIOR_STILL_CURRENT"
      : "SAFE_CONTAINMENT_ALREADY_CURRENT";
    currentDeploymentId = stage.priorDeploymentId;
  }
  const payload = {
    kind: "lester-labs-vercel-promotion-recovery",
    schemaVersion: 1,
    observedAt: assertCanonicalTimestamp(now(), "Promotion recovery timestamp"),
    action,
    stageEvidenceSha256: stage.evidenceSha256,
    stageProvenanceSha256: stageProvenance.sha256,
    sourceCommit: stage.source.commit,
    artifactKind: stage.artifactKind,
    project: stage.project,
    stagedDeploymentId: stage.deployment.id,
    priorDeploymentId: stage.priorDeploymentId,
    rollbackDisposition: stage.rollbackDisposition,
    currentDeploymentId,
  };
  return { ...payload, evidenceSha256: sha256Canonical(payload) };
}

function validatePromotionEvidence(value) {
  assertExactKeys(value, [
    "kind", "schemaVersion", "status", "promotedAt", "sourceCommit", "releaseProfile", "artifactKind",
    "manifestSha256", "artifactSha256", "stageEvidenceSha256", "stageProvenanceSha256", "promotionApprovalSha256",
    "promotionApprovalProvenanceSha256", "parityEvidenceSha256", "parityProvenanceSha256",
    "confirmation", "project", "deployment", "priorDeploymentId", "rollbackDisposition", "evidenceSha256",
  ], "Vercel promotion evidence");
  if (
    value.kind !== "lester-labs-vercel-promotion-evidence" ||
    value.schemaVersion !== 3 ||
    value.status !== "CURRENT" ||
    !["DIRECT", "RECOVERED_AFTER_AMBIGUOUS_RESPONSE"].includes(value.confirmation)
  ) throw new Error("The Vercel promotion evidence kind, schema, or status is unsupported.");
  const { evidenceSha256, ...payload } = value;
  assertHash(evidenceSha256, SHA256_PATTERN, "Vercel promotion evidence digest");
  if (evidenceSha256 !== sha256Canonical(payload)) throw new Error("The Vercel promotion evidence digest is invalid.");
  assertCanonicalTimestamp(value.promotedAt, "Vercel promotion timestamp");
  assertIdentifier(value.sourceCommit, COMMIT_PATTERN, "Promotion source commit");
  assertReleaseProfile(value.releaseProfile, "Promotion release profile");
  for (const field of [
    "manifestSha256", "artifactSha256", "stageEvidenceSha256", "stageProvenanceSha256", "promotionApprovalSha256",
    "promotionApprovalProvenanceSha256", "parityEvidenceSha256", "parityProvenanceSha256",
  ]) assertHash(value[field], SHA256_PATTERN, `Promotion ${field}`);
  assertIdentifier(value.project.teamId, TEAM_ID_PATTERN, "Promotion team ID");
  assertIdentifier(value.project.projectId, PROJECT_ID_PATTERN, "Promotion project ID");
  assertIdentifier(value.project.name, PROJECT_NAME_PATTERN, "Promotion project name");
  if (value.project.autoAssignCustomDomains !== false) throw new Error("Promotion evidence permits domain auto-assignment.");
  assertIdentifier(value.deployment.id, DEPLOYMENT_ID_PATTERN, "Promoted deployment ID");
  if (
    value.deployment.readyState !== "READY" ||
    value.deployment.readySubstate !== "PROMOTED" ||
    value.deployment.aliasAssigned !== true ||
    canonicalJson(normalizeAliases(value.deployment)) !== canonicalJson(promotedAliasesForTarget({
      teamId: value.project.teamId,
      projectId: value.project.projectId,
      projectName: value.project.name,
      releaseProfile: value.releaseProfile,
    }))
  ) throw new Error("Promotion evidence does not identify the current production aliases.");
  deploymentUrl(value.deployment);
  assertIdentifier(value.priorDeploymentId, DEPLOYMENT_ID_PATTERN, "Prior deployment ID");
  if (value.priorDeploymentId === value.deployment.id) throw new Error("Prior deployment equals the promoted deployment.");
  if (!["emergency-static", "next-standalone-container"].includes(value.artifactKind)) {
    throw new Error("Promotion artifact kind is unsupported.");
  }
  validateRollbackDisposition(value.rollbackDisposition, value.artifactKind, value.priorDeploymentId);
  return value;
}

export async function rollbackVercelRelease({
  promotionEvidencePath,
  token,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  delay = sleep,
  maxPollAttempts = DEFAULT_POLL_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  requestTimeoutMs,
} = {}) {
  validatePolling(maxPollAttempts, pollIntervalMs);
  const promotionRecord = readCanonicalJsonFile(promotionEvidencePath, "Vercel promotion evidence");
  const promotion = validatePromotionEvidence(promotionRecord.value);
  if (promotion.rollbackDisposition.mode !== "ROLLBACK_TO_SAFE_CONTAINMENT") {
    throw new Error("This promotion does not authorize rollback to its unsafe pre-containment prior deployment.");
  }
  const rollbackDeploymentId = promotion.rollbackDisposition.targetDeploymentId;
  const target = {
    teamId: promotion.project.teamId,
    projectId: promotion.project.projectId,
    projectName: promotion.project.name,
  };
  const api = makeApi({ token, fetchImpl, requestTimeoutMs });
  await preflight(api, target, { expectedCurrentDeploymentId: promotion.deployment.id });
  const rollbackTarget = await getDeployment(api, target, rollbackDeploymentId);
  validateDeploymentIdentity(rollbackTarget, {
    projectId: target.projectId,
    deploymentId: rollbackDeploymentId,
  });
  if (rollbackTarget.readyState !== "READY") throw new Error("The exact rollback target is not READY.");
  const requestRollback = () => api.request(
    "POST",
    `/v1/projects/${encodeURIComponent(target.projectId)}/rollback/${encodeURIComponent(rollbackDeploymentId)}`,
    {
      teamId: target.teamId,
      body: "{}\n",
      headers: { "content-type": "application/json" },
      expectedStatuses: [200, 201, 202],
      parseJson: false,
    },
  );
  let rollbackRequestError;
  let rollbackRequestAttempts = 1;
  try {
    await requestRollback();
  } catch (error) {
    rollbackRequestError = error;
  }
  let currentDeployment;
  let aliases;
  let lastReadError;
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    let project;
    try {
      project = await getProject(api, target);
    } catch (error) {
      lastReadError = error;
      if (attempt + 1 < maxPollAttempts) await delay(pollIntervalMs);
      continue;
    }
    const current = validateProject(project, target);
    if (![promotion.deployment.id, rollbackDeploymentId].includes(current)) {
      throw new Error("A different deployment became current during rollback.");
    }
    if (current === rollbackDeploymentId) {
      currentDeployment = await getDeployment(api, target, current);
      validateDeploymentIdentity(currentDeployment, { projectId: target.projectId, deploymentId: current });
      if (currentDeployment.readyState !== "READY") throw new Error("The exact rollback target is no longer READY.");
      aliases = assertCurrentProductionDeployment(currentDeployment, target);
      break;
    }
    if (rollbackRequestError && rollbackRequestAttempts < Math.min(3, maxPollAttempts)) {
      rollbackRequestAttempts += 1;
      try {
        await requestRollback();
        rollbackRequestError = undefined;
      } catch (error) {
        rollbackRequestError = error;
      }
    }
    if (attempt + 1 < maxPollAttempts) await delay(pollIntervalMs);
  }
  if (!currentDeployment) {
    throw new Error("Vercel did not route to the exact rollback ID within the bounded poll window.", {
      cause: rollbackRequestError ?? lastReadError,
    });
  }
  const rolledBackAt = assertCanonicalTimestamp(now(), "Rollback evidence timestamp");
  const payload = {
    kind: "lester-labs-vercel-rollback-evidence",
    schemaVersion: 1,
    status: "ROLLED_BACK",
    rolledBackAt,
    promotionEvidenceSha256: promotion.evidenceSha256,
    project: promotion.project,
    fromDeploymentId: promotion.deployment.id,
    rollbackDeployment: {
      id: currentDeployment.id,
      url: deploymentUrl(currentDeployment),
      target: "production",
      readyState: "READY",
      aliasAssigned: true,
      aliases,
    },
  };
  return { ...payload, evidenceSha256: sha256Canonical(payload) };
}

function parseOptions(argumentsList, allowed) {
  const options = new Map();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!name?.startsWith("--") || value === undefined || options.has(name) || !allowed.includes(name)) {
      throw new Error(`Invalid, duplicate, or unknown option ${JSON.stringify(name)}.`);
    }
    options.set(name, value);
  }
  return options;
}

function requireOption(options, name) {
  const value = options.get(name);
  if (!value) throw new Error(`Missing required option ${name}.`);
  return value;
}

function writeEvidence(path, value, label) {
  writeFileSync(resolve(path), canonicalJson(value), { flag: "wx", mode: 0o600 });
  process.stdout.write(`${label}: ${value.evidenceSha256 ?? sha256Bytes(canonicalJson(value))}\n`);
}

async function main() {
  const [command, ...argumentsList] = process.argv.slice(2);
  const token = process.env.VERCEL_TOKEN;
  if ([
    "provider-canary-emergency", "provider-canary-next", "stage-emergency", "stage-next",
    "cleanup-stage", "promote", "recover-promotion", "rollback",
  ].includes(command)) tokenHeader(token);
  if (command === "provider-canary-emergency" || command === "provider-canary-next") {
    const options = parseOptions(argumentsList, [
      "--release-dir", "--source-dir", "--source-commit", "--team-id", "--project-id",
      "--project-name", "--production-project-id", "--maximum-upload-bytes", "--workflow-run-id",
      "--workflow-run-attempt", "--source-attestation-run-id", "--source-attestation-run-attempt",
      "--release-profile", "--output",
    ]);
    const common = {
      artifactKind: command === "provider-canary-emergency"
        ? "emergency-static"
        : "next-standalone-container",
      releaseProfile: requireOption(options, "--release-profile"),
      releaseDirectory: resolve(requireOption(options, "--release-dir")),
      maximumUploadBytes: Number(requireOption(options, "--maximum-upload-bytes")),
      teamId: requireOption(options, "--team-id"),
      projectId: requireOption(options, "--project-id"),
      projectName: requireOption(options, "--project-name"),
      productionProjectId: requireOption(options, "--production-project-id"),
      workflowRunId: requireOption(options, "--workflow-run-id"),
      workflowRunAttempt: requireOption(options, "--workflow-run-attempt"),
      sourceAttestationRunId: requireOption(options, "--source-attestation-run-id"),
      sourceAttestationRunAttempt: requireOption(options, "--source-attestation-run-attempt"),
      trustedOidcToken: process.env.VERCEL_TRUSTED_OIDC_TOKEN,
      token,
    };
    const result = await runProviderCanary(command === "provider-canary-emergency"
      ? {
        ...common,
        sourceDirectory: resolve(requireOption(options, "--source-dir")),
        sourceCommit: requireOption(options, "--source-commit"),
      }
      : common);
    writeEvidence(requireOption(options, "--output"), result, "Unsigned provider-canary evidence written for Sigstore signing");
    return;
  }
  if (command === "stage-emergency" || command === "stage-next") {
    const allowed = [
      "--release-dir", "--source-dir", "--source-commit", "--team-id", "--project-id",
      "--project-name", "--maximum-upload-bytes", "--provider-canary-evidence",
      "--provider-canary-provenance", "--workflow-run-id", "--workflow-run-attempt",
      "--source-attestation-run-id", "--source-attestation-run-attempt", "--provider-canary-run-id",
      "--provider-canary-run-attempt", "--safe-rollback-promotion-evidence",
      "--safe-rollback-promotion-provenance", "--safe-rollback-parity-evidence",
      "--safe-rollback-parity-provenance", "--release-profile", "--output",
    ];
    const options = parseOptions(argumentsList, allowed);
    const common = {
      releaseDirectory: resolve(requireOption(options, "--release-dir")),
      releaseProfile: requireOption(options, "--release-profile"),
      maximumUploadBytes: Number(requireOption(options, "--maximum-upload-bytes")),
      teamId: requireOption(options, "--team-id"),
      projectId: requireOption(options, "--project-id"),
      projectName: requireOption(options, "--project-name"),
      providerCanaryEvidencePath: resolve(requireOption(options, "--provider-canary-evidence")),
      providerCanaryProvenancePath: resolve(requireOption(options, "--provider-canary-provenance")),
      workflowRunId: requireOption(options, "--workflow-run-id"),
      workflowRunAttempt: requireOption(options, "--workflow-run-attempt"),
      sourceAttestationRunId: requireOption(options, "--source-attestation-run-id"),
      sourceAttestationRunAttempt: requireOption(options, "--source-attestation-run-attempt"),
      providerCanaryRunId: requireOption(options, "--provider-canary-run-id"),
      providerCanaryRunAttempt: requireOption(options, "--provider-canary-run-attempt"),
      token,
    };
    const result = command === "stage-emergency"
      ? await stageEmergencyRelease({
        ...common,
        sourceDirectory: resolve(requireOption(options, "--source-dir")),
        sourceCommit: requireOption(options, "--source-commit"),
      })
      : await stageNextContainerRelease({
        ...common,
        safeRollbackPromotionEvidencePath: resolve(requireOption(options, "--safe-rollback-promotion-evidence")),
        safeRollbackPromotionProvenancePath: resolve(requireOption(options, "--safe-rollback-promotion-provenance")),
        safeRollbackParityEvidencePath: resolve(requireOption(options, "--safe-rollback-parity-evidence")),
        safeRollbackParityProvenancePath: resolve(requireOption(options, "--safe-rollback-parity-provenance")),
      });
    try {
      writeEvidence(requireOption(options, "--output"), result, "Staged Vercel evidence written");
    } catch (evidenceError) {
      try {
        await cleanupStagedValue({
          stageEvidence: result,
          stageEvidenceSha256: result.evidenceSha256,
          stageProvenanceSha256: null,
          token,
        });
      } catch (cleanupError) {
        throw new Error("Stage evidence writing failed and exact staged cleanup could not be confirmed.", {
          cause: new AggregateError([evidenceError, cleanupError]),
        });
      }
      throw new Error("Stage evidence writing failed after the exact staged deployment was deleted.", {
        cause: evidenceError,
      });
    }
    return;
  }
  if (command === "cleanup-stage") {
    const options = parseOptions(argumentsList, ["--stage-evidence", "--stage-provenance", "--output"]);
    const result = await cleanupStagedVercelRelease({
      stageEvidencePath: resolve(requireOption(options, "--stage-evidence")),
      stageProvenancePath: options.has("--stage-provenance")
        ? resolve(options.get("--stage-provenance"))
        : undefined,
      token,
    });
    writeEvidence(requireOption(options, "--output"), result, "Vercel stage cleanup evidence written");
    return;
  }
  if (command === "create-promotion-approval") {
    const options = parseOptions(argumentsList, [
      "--stage-evidence", "--stage-provenance", "--parity-evidence", "--parity-provenance", "--workflow-run-id",
      "--workflow-run-attempt", "--requested-by", "--approved-at", "--expires-at", "--output",
    ]);
    const stage = readCanonicalJsonFile(
      resolve(requireOption(options, "--stage-evidence")),
      "Vercel stage evidence",
    );
    const approval = createPromotionApproval({
      stageEvidence: stage.value,
      stageProvenancePath: resolve(requireOption(options, "--stage-provenance")),
      parityEvidencePath: resolve(requireOption(options, "--parity-evidence")),
      parityProvenancePath: resolve(requireOption(options, "--parity-provenance")),
      workflowRunId: requireOption(options, "--workflow-run-id"),
      workflowRunAttempt: requireOption(options, "--workflow-run-attempt"),
      requestedBy: requireOption(options, "--requested-by"),
      approvedAt: requireOption(options, "--approved-at"),
      expiresAt: requireOption(options, "--expires-at"),
    });
    writeEvidence(requireOption(options, "--output"), approval, "Unsigned promotion approval written for Sigstore signing");
    return;
  }
  if (command === "promote") {
    const options = parseOptions(argumentsList, [
      "--stage-evidence", "--stage-provenance", "--approval", "--approval-provenance", "--parity-evidence",
      "--parity-provenance", "--output",
    ]);
    const result = await promoteVercelRelease({
      stageEvidencePath: resolve(requireOption(options, "--stage-evidence")),
      stageProvenancePath: resolve(requireOption(options, "--stage-provenance")),
      approvalPath: resolve(requireOption(options, "--approval")),
      approvalProvenancePath: resolve(requireOption(options, "--approval-provenance")),
      parityEvidencePath: resolve(requireOption(options, "--parity-evidence")),
      parityProvenancePath: resolve(requireOption(options, "--parity-provenance")),
      token,
    });
    writeEvidence(requireOption(options, "--output"), result, "Vercel promotion evidence written");
    return;
  }
  if (command === "recover-promotion") {
    const options = parseOptions(argumentsList, ["--stage-evidence", "--stage-provenance", "--output"]);
    const result = await recoverVercelPromotion({
      stageEvidencePath: resolve(requireOption(options, "--stage-evidence")),
      stageProvenancePath: resolve(requireOption(options, "--stage-provenance")),
      token,
    });
    writeEvidence(requireOption(options, "--output"), result, "Vercel promotion recovery evidence written");
    return;
  }
  if (command === "rollback") {
    const options = parseOptions(argumentsList, ["--promotion-evidence", "--output"]);
    const result = await rollbackVercelRelease({
      promotionEvidencePath: resolve(requireOption(options, "--promotion-evidence")),
      token,
    });
    writeEvidence(requireOption(options, "--output"), result, "Vercel rollback evidence written");
    return;
  }
  throw new Error(
    "Usage: vercel-rest-release.mjs <provider-canary-emergency|provider-canary-next|stage-emergency|stage-next|cleanup-stage|create-promotion-approval|promote|recover-promotion|rollback> [options]",
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown failure.";
    process.stderr.write(`Vercel release operation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
