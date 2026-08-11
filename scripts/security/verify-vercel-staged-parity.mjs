#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalJson,
  sha256Canonical,
} from "./frontend-release-common.mjs";
import {
  HTTP_USER_AGENT_PROFILES,
  verifyFrontendReleaseParity,
} from "./verify-frontend-release-parity.mjs";
import { observeEmergencyServedParity } from "./verify-emergency-served-parity.mjs";
import { validateStageEvidence, validateStagedParityEvidence } from "./vercel-rest-release.mjs";

function authenticatedFetch(trustedOidcToken, fetchImpl = globalThis.fetch) {
  if (trustedOidcToken === undefined) return fetchImpl;
  if (
    typeof trustedOidcToken !== "string" ||
    trustedOidcToken.length < 64 ||
    trustedOidcToken.length > 16_384 ||
    /[\u0000-\u0020\u007f]/u.test(trustedOidcToken)
  ) throw new Error("The short-lived Vercel Trusted Sources OIDC token is malformed.");
  return (url, init = {}) => {
    const headers = new Headers(init.headers);
    if (headers.has("authorization") || headers.has("cookie") || headers.has("proxy-authorization")) {
      throw new Error("Staged parity refuses cookies and long-lived authorization credentials.");
    }
    headers.set("x-vercel-trusted-oidc-idp-token", trustedOidcToken);
    return fetchImpl(url, { ...init, headers: Object.fromEntries(headers.entries()) });
  };
}

function assertStageUrl(stage) {
  let parsed;
  try {
    parsed = new URL(stage?.deployment?.url);
  } catch {
    throw new Error("The staged release omits a valid deployment URL.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !parsed.hostname.endsWith(".vercel.app")
  ) throw new Error("Staged parity only probes the exact bare Vercel deployment origin.");
  return parsed.origin;
}

function profileSummariesFromFrontend(result) {
  if (result.origins.length !== 1) {
    throw new Error("Staged frontend parity must probe exactly one immutable deployment origin.");
  }
  return result.origins[0].profiles
    .map(({ profile, servedProfileSha256 }) => ({ id: profile, evidenceSha256: servedProfileSha256 }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function profileSummariesFromEmergency(result) {
  if (result.observations.length !== 1) {
    throw new Error("Staged emergency parity must probe exactly one immutable deployment origin.");
  }
  return result.observations[0].profiles
    .map(({ profile, profileEvidenceSha256 }) => ({ id: profile, evidenceSha256: profileEvidenceSha256 }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function verifyVercelStagedParity({
  stageEvidence,
  releaseDirectory,
  sourceDirectory,
  policyPath,
  expectedSourceCommit,
  fetchImpl = globalThis.fetch,
  trustedOidcToken,
  checkedAt = new Date().toISOString(),
  verifyProvenance,
} = {}) {
  validateStageEvidence(structuredClone(stageEvidence));
  const stageOrigin = assertStageUrl(stageEvidence);
  if (stageEvidence.source?.commit !== expectedSourceCommit) {
    throw new Error("Staged parity source commit differs from the exact reviewed commit.");
  }
  let profiles;
  let results;
  if (stageEvidence.artifactKind === "emergency-static") {
    const observation = await observeEmergencyServedParity({
      origins: [stageOrigin],
      sourceDirectory,
      fetchImpl,
      trustedOidcToken,
    });
    profiles = profileSummariesFromEmergency(observation);
    results = {
      deploymentIdentityMatched: true,
      servedArtifactMatched: observation.artifactBytesMatch,
      securityPolicyMatched: observation.securityHeadersMatch,
      networkPolicyMatched: observation.profilesEquivalent && observation.originsEquivalent,
      interactionPolicyMatched: observation.inactiveWalletRoutes,
      providerResourcePolicyMatched: observation.noCookiesOrLongLivedCredentials,
    };
  } else if (stageEvidence.artifactKind === "next-standalone-container") {
    const result = await verifyFrontendReleaseParity({
      manifestPath: resolve(releaseDirectory, "approved-manifest.json"),
      policyPath,
      fetchImpl: authenticatedFetch(trustedOidcToken, fetchImpl),
      enforceProductionOrigins: false,
      checkedAt,
      vantageId: "vercel-staged-deployment",
      approvalEvidenceDirectory: releaseDirectory,
      verifyProvenance,
      expectedSourceCommit,
      requestOrigins: [stageOrigin],
    });
    profiles = profileSummariesFromFrontend(result);
    results = {
      deploymentIdentityMatched: true,
      servedArtifactMatched: true,
      securityPolicyMatched: true,
      networkPolicyMatched: true,
      interactionPolicyMatched: true,
      providerResourcePolicyMatched: true,
    };
  } else {
    throw new Error("Staged parity refuses an unsupported release artifact kind.");
  }
  if (
    profiles.length !== HTTP_USER_AGENT_PROFILES.length ||
    profiles.some((profile, index) => profile.id !== [...HTTP_USER_AGENT_PROFILES]
      .map(({ id }) => id)
      .sort()[index])
  ) throw new Error("Staged parity did not complete every reviewed HTTP request profile.");
  const payload = {
    kind: "lester-labs-vercel-staged-parity",
    schemaVersion: 1,
    status: "PASSED",
    checkedAt,
    stageEvidenceSha256: stageEvidence.evidenceSha256,
    sourceCommit: stageEvidence.source.commit,
    artifactKind: stageEvidence.artifactKind,
    artifactSha256: stageEvidence.artifact.sha256,
    deploymentId: stageEvidence.deployment.id,
    deploymentUrl: stageEvidence.deployment.url,
    profiles,
    results,
  };
  const evidence = { ...payload, evidenceSha256: sha256Canonical(payload) };
  return validateStagedParityEvidence(evidence, stageEvidence);
}

function parseOptions(argumentsList) {
  const options = new Map();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (
      !name?.startsWith("--") ||
      value === undefined ||
      options.has(name) ||
      ![
        "--stage-evidence", "--release-dir", "--source-dir", "--policy",
        "--expected-source-commit", "--output",
      ].includes(name)
    ) throw new Error(`Invalid staged-parity option ${JSON.stringify(name)}.`);
    options.set(name, value);
  }
  return options;
}

function requiredOption(options, name) {
  const value = options.get(name);
  if (!value) throw new Error(`Staged parity requires ${name}.`);
  return value;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const stageEvidencePath = resolve(requiredOption(options, "--stage-evidence"));
  const stageBytes = readFileSync(stageEvidencePath);
  const stageEvidence = JSON.parse(stageBytes.toString("utf8"));
  if (canonicalJson(stageEvidence) !== stageBytes.toString("utf8")) {
    throw new Error("Staged release evidence is not canonical JSON.");
  }
  const releaseDirectory = resolve(requiredOption(options, "--release-dir"));
  const result = await verifyVercelStagedParity({
    stageEvidence,
    releaseDirectory,
    sourceDirectory: resolve(requiredOption(options, "--source-dir")),
    policyPath: resolve(requiredOption(options, "--policy")),
    expectedSourceCommit: requiredOption(options, "--expected-source-commit"),
    trustedOidcToken: process.env.VERCEL_TRUSTED_OIDC_TOKEN,
  });
  const output = resolve(requiredOption(options, "--output"));
  writeFileSync(output, canonicalJson(result), { flag: "wx", mode: 0o600 });
  process.stdout.write(`Exact Vercel staged parity verified: ${result.evidenceSha256}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
