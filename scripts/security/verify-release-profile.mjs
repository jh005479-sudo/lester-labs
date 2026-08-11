#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { RELEASE_PROFILES, assertReleaseProfile } from "./release-profiles.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function verifyReleaseProfile(
  releaseProfile,
  {
    approvedReplacementPath = join(repositoryRoot, "src/config/approvedPublicReplacement.json"),
    recoveryPath = join(repositoryRoot, "docs/security/evidence/production-control-plane-recovery.json"),
    publicTestnetCutoverPath = join(
      repositoryRoot,
      "docs/security/evidence/frontend-production-cutover-2026-08-11.json",
    ),
  } = {},
) {
  assertReleaseProfile(releaseProfile);
  const replacement = readJson(approvedReplacementPath);
  const recovery = readJson(recoveryPath);
  if (replacement.status !== "APPROVED" || replacement.releaseProfile !== releaseProfile) {
    throw new Error("The approved replacement package does not match the selected release profile.");
  }
  if (releaseProfile === RELEASE_PROFILES.PRODUCTION) {
    if (
      replacement.deploymentManifest?.deploymentProfile !== "production-separated-authority" ||
      recovery.status !== "REVIEWED"
    ) {
      throw new Error("Real production requires separated authorities and reviewed control-plane recovery.");
    }
    return { releaseProfile, controlPlaneRecoveryStatus: recovery.status };
  }

  const manifest = replacement.deploymentManifest;
  const cutover = readJson(publicTestnetCutoverPath);
  if (
    manifest?.chainId !== "4441" ||
    manifest?.deploymentProfile !== "testnet-immutable-disposable" ||
    manifest?.controller !== "0x0000000000000000000000000000000000000001" ||
    manifest?.treasury !== manifest?.gasOnlyDeployer ||
    recovery.status !== "NOT_REVIEWED" ||
    cutover.status !== "LIVE_PUBLIC_TESTNET" ||
    cutover.releaseProfile !== RELEASE_PROFILES.PUBLIC_TESTNET ||
    !String(cutover.scope ?? "").includes("Valueless LitVM LiteForge testnet chain 4441 only")
  ) {
    throw new Error("The public-testnet exception is incomplete or claims real-production recovery.");
  }
  return {
    releaseProfile,
    chainId: manifest.chainId,
    controlPlaneRecoveryStatus: recovery.status,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = verifyReleaseProfile(process.argv[2]);
    process.stdout.write(
      `Release profile verified: ${result.releaseProfile}; control plane ${result.controlPlaneRecoveryStatus}.\n`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
