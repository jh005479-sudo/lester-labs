import { network } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isImmutableDisposableTestnetProfile,
  parseReplacementManifest,
  PRODUCTION_SEPARATED_PROFILE,
  replacementPlanRelativePath,
  requireFreshIncidentSafeAddress,
  TESTNET_IMMUTABLE_DISPOSABLE_PROFILE,
  type ReplacementDeploymentProfile,
  type ReplacementPlan,
  validateReplacementPlan,
  verifyReplacementBuildAttestation,
  verifyReplacementManifest,
} from "./lib/post_compromise_replacement.js";
import { verifySourcePinnedProductionAuthorities } from "./lib/production_authority_verifier.js";

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function selectedDeploymentProfile(): ReplacementDeploymentProfile {
  const profile = process.env.REPLACEMENT_DEPLOYMENT_PROFILE;
  if (
    profile !== PRODUCTION_SEPARATED_PROFILE &&
    profile !== TESTNET_IMMUTABLE_DISPOSABLE_PROFILE
  ) {
    throw new Error(
      `REPLACEMENT_DEPLOYMENT_PROFILE must be ${PRODUCTION_SEPARATED_PROFILE} or ${TESTNET_IMMUTABLE_DISPOSABLE_PROFILE}`,
    );
  }
  return profile;
}

async function main(): Promise<void> {
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("Independent verification must run without DEPLOYER_PRIVATE_KEY");
  }
  const requestedProfile = selectedDeploymentProfile();
  const planRelativePath = replacementPlanRelativePath(requestedProfile);
  const planPath = path.resolve(__dirname, "..", planRelativePath);
  const manifestPathValue = process.env.REPLACEMENT_MANIFEST_PATH;
  if (!manifestPathValue) {
    throw new Error("Set REPLACEMENT_MANIFEST_PATH to the deployment manifest to verify");
  }
  const manifestPath = path.resolve(manifestPathValue);
  const manifest = parseReplacementManifest(fs.readFileSync(manifestPath, "utf8"));
  const build = verifyReplacementBuildAttestation();
  if (build.deploymentProfile !== requestedProfile || build.planPath !== planRelativePath) {
    throw new Error("Build attestation was created for a different deployment profile or plan");
  }
  if (manifest.buildAttestationSha256 !== build.attestationSha256) {
    throw new Error(
      `Manifest build attestation is ${manifest.buildAttestationSha256}; reviewed attestation is ${build.attestationSha256}`,
    );
  }
  if (manifest.buildSourceCommit !== build.sourceCommit) {
    throw new Error(
      `Manifest build source is ${manifest.buildSourceCommit}; reviewed source is ${build.sourceCommit}`,
    );
  }

  const planRaw = fs.readFileSync(planPath, "utf8");
  const plan = validateReplacementPlan(JSON.parse(planRaw) as ReplacementPlan);
  if (plan.deploymentProfile !== requestedProfile || manifest.deploymentProfile !== requestedProfile) {
    throw new Error("Plan, manifest, and requested deployment profiles do not agree");
  }
  const planHash = ethers.keccak256(ethers.toUtf8Bytes(planRaw));
  if (manifest.planHash !== planHash) {
    throw new Error(`Manifest plan hash is ${manifest.planHash}; reviewed plan hash is ${planHash}`);
  }
  if (
    JSON.stringify({
      kind: manifest.kind,
      schemaVersion: manifest.schemaVersion,
      chainId: manifest.chainId,
      deploymentProfile: manifest.deploymentProfile,
      controller: ethers.getAddress(manifest.controller),
      treasury: ethers.getAddress(manifest.treasury),
      parameters: manifest.parameters,
    }) !== JSON.stringify(plan)
  ) {
    throw new Error("Manifest deployment plan differs from the reviewed plan file");
  }

  const expectedGasOnlyDeployer = process.env.EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS;
  if (!expectedGasOnlyDeployer || !ethers.isAddress(expectedGasOnlyDeployer)) {
    throw new Error("Set EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS to the independently reviewed single-use EOA");
  }
  if (!isImmutableDisposableTestnetProfile(plan)) {
    requireFreshIncidentSafeAddress("Expected gas-only deployer", expectedGasOnlyDeployer);
  } else if (ethers.getAddress(expectedGasOnlyDeployer) !== ethers.getAddress(plan.treasury)) {
    throw new Error("Disposable testnet signer must exactly match the source-pinned test-gas treasury");
  }
  if (ethers.getAddress(expectedGasOnlyDeployer) !== ethers.getAddress(manifest.gasOnlyDeployer)) {
    throw new Error(
      `Manifest gas-only deployer is ${manifest.gasOnlyDeployer}; expected ${expectedGasOnlyDeployer}`,
    );
  }

  if (!isImmutableDisposableTestnetProfile(plan)) {
    const earliestDeploymentBlock = Math.min(
      ...manifest.deployments.map((deployment) => deployment.blockNumber),
    );
    if (!Number.isSafeInteger(earliestDeploymentBlock) || earliestDeploymentBlock <= 1) {
      throw new Error("Production manifest has no valid pre-deployment authority checkpoint");
    }
    const beforeDeployment = await verifySourcePinnedProductionAuthorities(
      plan,
      ethers.provider,
      {
        blockNumber: earliestDeploymentBlock - 1,
        gasOnlyDeployer: manifest.gasOnlyDeployer,
      },
    );
    const current = await verifySourcePinnedProductionAuthorities(
      plan,
      ethers.provider,
      { gasOnlyDeployer: manifest.gasOnlyDeployer },
    );
    console.log(
      `Production Safe authorities matched the source inventory before deployment at block ${beforeDeployment.blockNumber} and at current block ${current.blockNumber}`,
    );
  }

  await verifyReplacementManifest(manifest, ethers);
  console.log(`Verified post-compromise replacement manifest: ${manifestPath}`);
  console.log(`Verification block: ${await ethers.provider.getBlockNumber()}`);
  console.log(
    isImmutableDisposableTestnetProfile(manifest)
      ? `Disposable transaction signer and fee recipient (no administrative role): ${manifest.gasOnlyDeployer}`
      : `Gas-only deployer with no authority: ${manifest.gasOnlyDeployer}`,
  );
  console.log(`Controller: ${manifest.controller}`);
  console.log(`Treasury: ${manifest.treasury}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
