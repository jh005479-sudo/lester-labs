import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { assertNoContractTargetEnvironmentOverrides } from "./src/config/contracts";
import approvedPublicReplacement from "./src/config/approvedPublicReplacement.json" with { type: "json" };
import { assertPlatformActivityConfiguration } from "./src/config/platformActivity";

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
    activityCutover: value.activityCutover,
  };
  const actualPayload = `0x${createHash("sha256")
    .update(`${JSON.stringify(canonicalizeJson(payload), null, 2)}\n`)
    .digest("hex")}`;
  if (actualPayload !== expectedPayload) {
    throw new Error(`Approved public replacement payload digest is ${actualPayload}; expected ${expectedPayload}.`);
  }
}

assertApprovedPublicReplacementIntegrity();

const isDevelopment = process.env.NODE_ENV === 'development';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://raw.githubusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://liteforge.rpc.caldera.xyz wss://liteforge.rpc.caldera.xyz",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(!isDevelopment ? ['upgrade-insecure-requests'] : []),
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'X-XSS-Protection', value: '0' },
        ],
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
