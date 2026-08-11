import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertNoContractTargetEnvironmentOverrides } from "./src/config/contracts";
import approvedPublicReplacement from "./src/config/approvedPublicReplacement.json" with { type: "json" };
import frontendReleasePolicy from "./src/config/frontendReleasePolicy.json" with { type: "json" };
import { assertPlatformActivityConfiguration } from "./src/config/platformActivity";
import {
  assertProductionBuildControlPlane,
  resolveProductionReleaseBuildId,
} from "./src/config/productionBuildControlPlane";

assertNoContractTargetEnvironmentOverrides(process.env);
assertPlatformActivityConfiguration();

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeJson(child)]),
    );
  }
  return value;
}

function assertApprovedPublicReplacementIntegrity(): void {
  const value = approvedPublicReplacement as unknown as Record<string, unknown>;
  if (value.status === "NOT_APPROVED") {
    if (Object.keys(value).length !== 1) {
      throw new Error("The NOT_APPROVED public replacement sentinel must not contain deployment data.");
    }
    return;
  }
  if (value.status !== "APPROVED" || !value.deploymentManifest) {
    throw new Error("Public replacement activation requires an APPROVED complete deployment manifest.");
  }
  const approvedKeys = [
    "activityCutover",
    "approvalPayloadSha256",
    "deploymentManifest",
    "deploymentManifestSha256",
    "frontendRuntimeAttestations",
    "reviewerApprovals",
    "sourceEvidence",
    "status",
  ];
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== approvedKeys.length || actualKeys.some((key, index) => key !== approvedKeys[index])) {
    throw new Error("The APPROVED public replacement package must contain exactly the reviewed top-level fields.");
  }
  const expected = value.deploymentManifestSha256;
  if (typeof expected !== "string" || !/^0x[0-9a-f]{64}$/.test(expected)) {
    throw new Error("The approved deployment manifest SHA-256 is invalid.");
  }
  const actual = `0x${createHash("sha256")
    .update(`${JSON.stringify(value.deploymentManifest, null, 2)}\n`)
    .digest("hex")}`;
  if (actual !== expected) {
    throw new Error(`Approved deployment manifest digest is ${actual}; expected ${expected}.`);
  }
  const expectedPayload = value.approvalPayloadSha256;
  if (typeof expectedPayload !== "string" || !/^0x[0-9a-f]{64}$/.test(expectedPayload)) {
    throw new Error("The approved public replacement payload SHA-256 is invalid.");
  }
  const payload = {
    deploymentManifestSha256: value.deploymentManifestSha256,
    deploymentManifest: value.deploymentManifest,
    frontendRuntimeAttestations: value.frontendRuntimeAttestations,
    sourceEvidence: value.sourceEvidence,
    activityCutover: value.activityCutover,
  };
  const actualPayload = `0x${createHash("sha256")
    .update(`${JSON.stringify(canonicalizeJson(payload), null, 2)}\n`)
    .digest("hex")}`;
  if (actualPayload !== expectedPayload) {
    throw new Error(`Approved public replacement payload digest is ${actualPayload}; expected ${expectedPayload}.`);
  }

  const sourceEvidence = value.sourceEvidence as Record<string, unknown> | undefined;
  const sourceEvidenceKeys = sourceEvidence ? Object.keys(sourceEvidence).sort() : [];
  if (
    !sourceEvidence ||
    JSON.stringify(sourceEvidenceKeys) !== JSON.stringify([
      "controlPlaneRecoveryRawSha256",
      "independentReplacementVerification",
      "productionAuthoritiesRawSha256",
      "productionAuthorityVerification",
    ])
  ) throw new Error("The approved public replacement must bind the exact source evidence and independent verification report.");
  const rawSha256 = (relativePath: string) => `0x${createHash("sha256")
    .update(readFileSync(new URL(relativePath, import.meta.url)))
    .digest("hex")}`;
  if (sourceEvidence.productionAuthoritiesRawSha256 !== rawSha256("./contracts/deployment/production-authorities.json")) {
    throw new Error("The approved public replacement binds a different production authority inventory.");
  }
  if (sourceEvidence.controlPlaneRecoveryRawSha256 !== rawSha256("./docs/security/evidence/production-control-plane-recovery.json")) {
    throw new Error("The approved public replacement binds different control-plane recovery evidence.");
  }
  const activity = value.activityCutover as Record<string, unknown>;
  const replacementCounters = activity.replacementCountersAtCutover as Record<string, unknown> | undefined;
  const metricNames = ["tokensMinted", "walletsAirdropped", "presalesCreated", "swapsCompleted", "onChainMessages"];
  if (
    !replacementCounters ||
    Object.keys(replacementCounters).length !== metricNames.length ||
    metricNames.some((name) => replacementCounters[name] !== 0)
  ) throw new Error("Every replacement activity counter must be exactly zero at the approved cutover block.");

  const approvals = value.reviewerApprovals;
  if (!Array.isArray(approvals) || approvals.length < 2) {
    throw new Error("Approved activation requires at least two structured reviewer approval records.");
  }
  const reviewers = new Set<string>();
  const roles = new Set<string>();
  const evidence = new Set<string>();
  for (const entry of approvals) {
    const approval = entry as Record<string, unknown>;
    if (
      approval.approvalPayloadSha256 !== expectedPayload ||
      typeof approval.reviewer !== "string" || approval.reviewer.length < 2 ||
      typeof approval.reviewRole !== "string" || approval.reviewRole.length < 2 ||
      typeof approval.evidenceSha256 !== "string" || !/^0x[0-9a-f]{64}$/.test(approval.evidenceSha256) ||
      typeof approval.approvedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(approval.approvedAt)
    ) throw new Error("A public replacement reviewer approval is malformed or bound to another payload.");
    reviewers.add(approval.reviewer.toLowerCase());
    roles.add(approval.reviewRole.toLowerCase());
    evidence.add(approval.evidenceSha256);
  }
  if (reviewers.size !== approvals.length || roles.size < 2 || evidence.size !== approvals.length) {
    throw new Error("Public replacement approvals require distinct reviewers, roles, and evidence identities.");
  }
}

const requestedReleaseBuildId = process.env.LESTER_RELEASE_BUILD_ID;
const providerReleaseBuildId = process.env.VERCEL_GIT_COMMIT_SHA;
const releaseBuildId = resolveProductionReleaseBuildId(
  requestedReleaseBuildId,
  providerReleaseBuildId,
);
if (releaseBuildId !== undefined && !/^[0-9a-f]{40}$/.test(releaseBuildId)) {
  throw new Error('LESTER_RELEASE_BUILD_ID/VERCEL_GIT_COMMIT_SHA must be a lowercase 40-character Git commit.');
}

assertApprovedPublicReplacementIntegrity();
// For APPROVED packages this invokes the complete dependency-free public
// verifier, including exact raw-inventory/report and independent-RPC binding.
assertProductionBuildControlPlane({
  publicReplacementStatus: approvedPublicReplacement.status,
  releaseBuildId,
});

const isDevelopment = process.env.NODE_ENV === 'development';
const productionContentSecurityPolicy = frontendReleasePolicy.criticalResponseHeaders['Content-Security-Policy'];
const contentSecurityPolicy = isDevelopment
  ? productionContentSecurityPolicy
      .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'")
      .replace('; upgrade-insecure-requests', '')
  : productionContentSecurityPolicy;
const productionHeaders = Object.entries(frontendReleasePolicy.criticalResponseHeaders).map(([key, value]) => ({
  key,
  value: key === 'Content-Security-Policy' ? contentSecurityPolicy : value,
}));

const nextConfig: NextConfig = {
  output: 'standalone',
  ...(releaseBuildId ? { generateBuildId: async () => releaseBuildId } : {}),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: productionHeaders,
      },
    ]
  },
  async redirects() {
    return [
      { source: '/docs/dex-swap', destination: '/docs', permanent: true },
      { source: '/docs/airdrop-tool', destination: '/docs', permanent: true },
      { source: '/docs/token-factory', destination: '/docs', permanent: true },
      { source: '/docs/liquidity-locker', destination: '/docs', permanent: true },
      { source: '/docs/token-vesting', destination: '/docs', permanent: true },
      { source: '/docs/governance', destination: '/docs', permanent: true },
      { source: '/docs/launchpad', destination: '/docs', permanent: true },
      { source: '/docs/ledger', destination: '/docs', permanent: true },
    ]
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
