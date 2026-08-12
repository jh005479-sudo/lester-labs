export const RELEASE_PROFILES = Object.freeze({
  PRODUCTION: "production-separated-authority",
  PUBLIC_TESTNET: "public-testnet-immutable",
});

export const VERIFICATION_PROFILES = Object.freeze({
  PRODUCTION: "production-independent-network",
  PUBLIC_TESTNET: "public-testnet-github-hosted",
});

export const PRODUCTION_DOMAINS = Object.freeze([
  "lester-labs.com",
  "www.lester-labs.com",
]);

export const PUBLIC_TESTNET_VERCEL_TARGET = Object.freeze({
  teamId: "team_vnMG4DPuSLlOs9bEi7QcRjhx",
  projectId: "prj_dbAIzvnFWLzxkt2dpphAWbserIG7",
  projectName: "lester-labs",
  promotedApiAliases: Object.freeze([
    "lester-labs-jh005479-8603-lester-labs.vercel.app",
    "lester-labs-lester-labs.vercel.app",
  ]),
});

const VANTAGE_IDS_BY_VERIFICATION_PROFILE = Object.freeze({
  [VERIFICATION_PROFILES.PRODUCTION]: Object.freeze([
    "protected-eu-network",
    "protected-us-network",
  ]),
  [VERIFICATION_PROFILES.PUBLIC_TESTNET]: Object.freeze([
    "github-hosted-a",
    "github-hosted-b",
  ]),
});

export function assertReleaseProfile(value, label = "Release profile") {
  if (!Object.values(RELEASE_PROFILES).includes(value)) {
    throw new Error(`${label} is unsupported.`);
  }
  return value;
}

export function assertVerificationProfile(value, label = "Verification profile") {
  if (!Object.values(VERIFICATION_PROFILES).includes(value)) {
    throw new Error(`${label} is unsupported.`);
  }
  return value;
}

export function verificationProfileForRelease(releaseProfile) {
  assertReleaseProfile(releaseProfile);
  return releaseProfile === RELEASE_PROFILES.PRODUCTION
    ? VERIFICATION_PROFILES.PRODUCTION
    : VERIFICATION_PROFILES.PUBLIC_TESTNET;
}

export function releaseProfileForVerification(verificationProfile) {
  assertVerificationProfile(verificationProfile);
  return verificationProfile === VERIFICATION_PROFILES.PRODUCTION
    ? RELEASE_PROFILES.PRODUCTION
    : RELEASE_PROFILES.PUBLIC_TESTNET;
}

export function vantageIdsForVerification(verificationProfile) {
  assertVerificationProfile(verificationProfile);
  return VANTAGE_IDS_BY_VERIFICATION_PROFILE[verificationProfile];
}

export function assertVantageId(verificationProfile, vantageId) {
  const expected = vantageIdsForVerification(verificationProfile);
  if (!expected.includes(vantageId)) {
    throw new Error(`Vantage ID is not approved for ${verificationProfile}.`);
  }
  return vantageId;
}

export function promotedApiAliasesForReleaseProfile(releaseProfile, project) {
  assertReleaseProfile(releaseProfile);
  if (releaseProfile === RELEASE_PROFILES.PRODUCTION) return PRODUCTION_DOMAINS;
  if (
    project?.teamId !== PUBLIC_TESTNET_VERCEL_TARGET.teamId ||
    project?.projectId !== PUBLIC_TESTNET_VERCEL_TARGET.projectId ||
    project?.name !== PUBLIC_TESTNET_VERCEL_TARGET.projectName
  ) throw new Error("Public-testnet promoted aliases are bound to a different Vercel target.");
  return PUBLIC_TESTNET_VERCEL_TARGET.promotedApiAliases;
}
