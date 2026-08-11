import { network } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEPLOYMENT_ORDER,
  deploymentArguments,
  isImmutableDisposableTestnetProfile,
  pinnedLegacyRecovery,
  PRODUCTION_SEPARATED_PROFILE,
  requireFreshIncidentSafeAddress,
  replacementPlanRelativePath,
  TESTNET_IMMUTABLE_DISPOSABLE_PROFILE,
  replacementArtifact,
  type ReplacementDeploymentRecord,
  type VerifiedReplacementBuild,
  type ReplacementManifest,
  type ReplacementDeploymentProfile,
  type ReplacementPlan,
  validateReplacementPlan,
  verifyImmutableTestnetAuthorityPrecompile,
  verifyPinnedLegacyRuntime,
  verifyReplacementBuildAttestation,
  verifyReplacementManifest,
} from "./lib/post_compromise_replacement.js";
import { verifySourcePinnedProductionAuthorities } from "./lib/production_authority_verifier.js";

const hardhatConnection = await network.create();
const { ethers } = hardhatConnection;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRODUCTION_DEPLOYMENT_ACKNOWLEDGEMENT = "DEPLOY_FRESH_POST_COMPROMISE_STACK";
const DISPOSABLE_DEPLOYMENT_ACKNOWLEDGEMENT = "DEPLOY_DISPOSABLE_IMMUTABLE_TESTNET_STACK";
const DISPOSABLE_TESTNET_ACKNOWLEDGEMENT = "ACCEPT_PUBLIC_TESTNET_SIGNER_NONCE_RISK";
const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
let activeKeyedDeploymentBuild: VerifiedReplacementBuild | undefined;

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

function readConfirmations(): number {
  const raw = process.env.DEPLOYMENT_CONFIRMATIONS ?? "1";
  const confirmations = Number(raw);
  if (!Number.isSafeInteger(confirmations) || confirmations < 1 || confirmations > 64) {
    throw new Error("DEPLOYMENT_CONFIRMATIONS must be an integer from 1 through 64");
  }
  return confirmations;
}

function replacementRecordsDirectory(): string {
  const configured = process.env.REPLACEMENT_RECORDS_DIRECTORY;
  if (!configured || !path.isAbsolute(configured)) {
    throw new Error("REPLACEMENT_RECORDS_DIRECTORY must be a pre-created absolute external directory");
  }
  const resolved = path.resolve(configured);
  const relativeToRepository = path.relative(REPOSITORY_ROOT, resolved);
  if (!relativeToRepository.startsWith("..") && !path.isAbsolute(relativeToRepository)) {
    throw new Error("Deployment journals and manifests must be written outside the source repository");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("REPLACEMENT_RECORDS_DIRECTORY must already exist");
  }
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error("REPLACEMENT_RECORDS_DIRECTORY must be a real directory, not a symlink or file");
  }
  if ((stat.mode & 0o077) !== 0) {
    throw new Error("REPLACEMENT_RECORDS_DIRECTORY must not grant group or other permissions");
  }
  return resolved;
}

function checkedExpectedGasOnlyDeployer(plan: ReplacementPlan): string {
  const configured = process.env.EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS;
  if (!configured || !ethers.isAddress(configured)) {
    throw new Error("Set EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS to the public address of the gas-only signer");
  }
  const expected = isImmutableDisposableTestnetProfile(plan)
    ? ethers.getAddress(configured)
    : requireFreshIncidentSafeAddress("Gas-only deployer", configured);
  if (expected === ethers.getAddress(plan.controller)) {
    throw new Error("Deployment signer must never be the controller");
  }
  if (isImmutableDisposableTestnetProfile(plan)) {
    if (expected !== ethers.getAddress(plan.treasury)) {
      throw new Error("Disposable testnet deployment signer must exactly match its authorised test-gas treasury");
    }
  } else if (expected === ethers.getAddress(plan.treasury)) {
    throw new Error("Gas-only deployer must be distinct from both controller and treasury");
  }
  return expected;
}

function requireSameBuild(
  expected: VerifiedReplacementBuild,
  actual: VerifiedReplacementBuild,
  stage: string,
): void {
  if (
    actual.attestationSha256 !== expected.attestationSha256 ||
    actual.sourceCommit !== expected.sourceCommit ||
    actual.nodeModulesTreeSha256 !== expected.nodeModulesTreeSha256 ||
    actual.deploymentProfile !== expected.deploymentProfile ||
    actual.planPath !== expected.planPath
  ) {
    throw new Error(`Reviewed build inputs changed ${stage}`);
  }
}

function writeJournal(
  filePath: string,
  manifest: Omit<ReplacementManifest, "verifiedAtBlock"> & { verifiedAtBlock?: number },
  flag: "w" | "wx" = "w",
): void {
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag,
    mode: 0o600,
  });
}

async function main(): Promise<void> {
  const requestedProfile = selectedDeploymentProfile();
  const planRelativePath = replacementPlanRelativePath(requestedProfile);
  const planPath = path.resolve(__dirname, "..", planRelativePath);
  const planRaw = fs.readFileSync(planPath, "utf8");
  const plan = validateReplacementPlan(JSON.parse(planRaw) as ReplacementPlan);
  if (plan.deploymentProfile !== requestedProfile) {
    throw new Error("Selected deployment profile does not match its source-pinned plan");
  }
  const planHash = ethers.keccak256(ethers.toUtf8Bytes(planRaw));
  const build = verifyReplacementBuildAttestation({ verifyNodeModulesTree: false });
  if (build.deploymentProfile !== requestedProfile || build.planPath !== planRelativePath) {
    throw new Error("Build attestation was created for a different deployment profile or plan");
  }
  const providerNetwork = await ethers.provider.getNetwork();
  if (providerNetwork.chainId.toString() !== plan.chainId) {
    throw new Error(`Plan targets chain ${plan.chainId}; connected chain is ${providerNetwork.chainId}`);
  }
  if (isImmutableDisposableTestnetProfile(plan)) {
    await verifyImmutableTestnetAuthorityPrecompile(ethers.provider);
  }

  const gasOnlyDeployer = checkedExpectedGasOnlyDeployer(plan);
  if ((await ethers.provider.getCode(gasOnlyDeployer)) !== "0x") {
    throw new Error("Gas-only deployer must be a plain externally owned account");
  }

  console.log("Performing read-only legacy runtime preflight before any deployment transaction...");
  await verifyPinnedLegacyRuntime(ethers.provider);

  if (!isImmutableDisposableTestnetProfile(plan)) {
    console.log("Verifying source-pinned production Safe authorities before any deployment transaction...");
    const authorityVerification = await verifySourcePinnedProductionAuthorities(
      plan,
      ethers.provider,
      { gasOnlyDeployer },
    );
    console.log(
      `Production Safe authorities verified at block ${authorityVerification.blockNumber} (${authorityVerification.blockHash}); inventory ${authorityVerification.inventorySha256}`,
    );
  }

  const latestNonce = await ethers.provider.getTransactionCount(gasOnlyDeployer, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(gasOnlyDeployer, "pending");
  if (latestNonce !== pendingNonce) {
    throw new Error(
      `Gas-only deployer has pending transactions (latest nonce ${latestNonce}, pending ${pendingNonce}); deterministic deployment is unsafe`,
    );
  }
  const startingNonce = pendingNonce;
  if (!isImmutableDisposableTestnetProfile(plan) && startingNonce !== 0) {
    throw new Error("Production gas-only deployer must be a fresh nonce-zero EOA");
  }
  const confirmations = readConfirmations();
  const predictedRecords: ReplacementDeploymentRecord[] = DEPLOYMENT_ORDER.map((name, index) => ({
    name,
    artifact: replacementArtifact(name),
    address: ethers.getCreateAddress({ from: gasOnlyDeployer, nonce: startingNonce + index }),
    nonce: startingNonce + index,
    transactionHash: ethers.ZeroHash,
    blockNumber: 0,
    runtimeCodeHash: ethers.ZeroHash,
    runtimeCodeBytes: 0,
  }));

  const draftManifest: ReplacementManifest = {
    ...plan,
    planHash,
    buildAttestationSha256: build.attestationSha256,
    buildSourceCommit: build.sourceCommit,
    gasOnlyDeployer,
    startingNonce,
    confirmations,
    legacyRecovery: pinnedLegacyRecovery(),
    deployments: predictedRecords,
    verifiedAtBlock: 1,
  };
  const argsByName = deploymentArguments(draftManifest);

  console.log(`Network: ${hardhatConnection.networkName} (${plan.chainId})`);
  console.log(`Reviewed controller: ${plan.controller}`);
  console.log(`Reviewed treasury: ${plan.treasury}`);
  console.log(`Gas-only deployer: ${gasOnlyDeployer}`);
  console.log(`Starting nonce: ${startingNonce}`);
  console.log(`Pinned plan hash: ${planHash}`);
  console.log(`Pinned build attestation: ${build.attestationSha256}`);
  console.log(`Build source commit: ${build.sourceCommit}`);
  console.log("Predicted CREATE addresses:");
  for (const record of predictedRecords) {
    console.log(`  ${record.nonce}: ${record.name} -> ${record.address}`);
  }

  if (process.env.REPLACEMENT_PREVIEW_ONLY === "true") {
    if (process.env.DEPLOYER_PRIVATE_KEY) {
      throw new Error("Read-only preview must run without DEPLOYER_PRIVATE_KEY");
    }
    requireSameBuild(build, verifyReplacementBuildAttestation(), "before read-only preview");
    console.log("Read-only preview complete. No deployment transaction was sent.");
    return;
  }
  const requiredDeploymentAcknowledgement = isImmutableDisposableTestnetProfile(plan)
    ? DISPOSABLE_DEPLOYMENT_ACKNOWLEDGEMENT
    : PRODUCTION_DEPLOYMENT_ACKNOWLEDGEMENT;
  if (process.env.ACKNOWLEDGE_REPLACEMENT_DEPLOYMENT !== requiredDeploymentAcknowledgement) {
    throw new Error(
      `Live writes remain disabled. Review the predictions, then set ACKNOWLEDGE_REPLACEMENT_DEPLOYMENT=${requiredDeploymentAcknowledgement} only for this exact ${plan.deploymentProfile} execution.`,
    );
  }
  if (
    isImmutableDisposableTestnetProfile(plan) &&
    process.env.ACKNOWLEDGE_DISPOSABLE_TESTNET_SIGNER !== DISPOSABLE_TESTNET_ACKNOWLEDGEMENT
  ) {
    throw new Error(
      `The testnet signer is publicly disclosed and can be nonce-raced. Set ACKNOWLEDGE_DISPOSABLE_TESTNET_SIGNER=${DISPOSABLE_TESTNET_ACKNOWLEDGEMENT} only for the explicitly authorised valueless testnet execution.`,
    );
  }
  const signers = await ethers.getSigners();
  if (signers.length !== 1) {
    throw new Error(`Expected exactly one configured gas-only signer; Hardhat exposed ${signers.length}`);
  }
  const deployer = signers[0];
  if (ethers.getAddress(deployer.address) !== gasOnlyDeployer) {
    throw new Error(`Connected signer is ${deployer.address}; expected gas-only deployer ${gasOnlyDeployer}`);
  }
  const preDeploymentBuild = verifyReplacementBuildAttestation();
  requireSameBuild(build, preDeploymentBuild, "immediately before keyed deployment");
  activeKeyedDeploymentBuild = preDeploymentBuild;

  const recordsDirectory = replacementRecordsDirectory();
  const fileStem = `replacement-${plan.chainId}-${gasOnlyDeployer.toLowerCase()}-nonce-${startingNonce}`;
  const partialPath = path.join(recordsDirectory, `${fileStem}.partial.json`);
  const finalPath = path.join(recordsDirectory, `${fileStem}.json`);
  if (fs.existsSync(partialPath) || fs.existsSync(finalPath)) {
    throw new Error(`Refusing to overwrite an existing deployment record for ${fileStem}`);
  }
  // Create the nonce-bound record before the first broadcast so an abrupt
  // process failure can never leave an unjournaled deployment attempt.
  writeJournal(partialPath, draftManifest, "wx");

  const deployedRecords: ReplacementDeploymentRecord[] = [];
  for (let index = 0; index < DEPLOYMENT_ORDER.length; index += 1) {
    const name = DEPLOYMENT_ORDER[index];
    const expected = predictedRecords[index];
    const currentBuild = verifyReplacementBuildAttestation({ verifyNodeModulesTree: false });
    requireSameBuild(build, currentBuild, `before the ${name} deployment`);
    const currentPendingNonce = await ethers.provider.getTransactionCount(gasOnlyDeployer, "pending");
    if (currentPendingNonce !== expected.nonce) {
      throw new Error(
        `${name} expected nonce ${expected.nonce}, but pending nonce changed to ${currentPendingNonce}`,
      );
    }

    console.log(`[${index + 1}/${DEPLOYMENT_ORDER.length}] Deploying ${name}...`);
    const factory = await ethers.getContractFactory(expected.artifact, deployer);
    const contract = await factory.deploy(...argsByName[name]);
    const transaction = contract.deploymentTransaction();
    if (!transaction) throw new Error(`${name} has no deployment transaction`);
    if (transaction.nonce !== expected.nonce) {
      throw new Error(`${name} used nonce ${transaction.nonce}; expected ${expected.nonce}`);
    }
    const address = await contract.getAddress();
    if (ethers.getAddress(address) !== ethers.getAddress(expected.address)) {
      throw new Error(`${name} address is ${address}; predicted ${expected.address}`);
    }
    writeJournal(partialPath, {
      ...draftManifest,
      deployments: [
        ...deployedRecords,
        {
          ...expected,
          address: ethers.getAddress(address),
          transactionHash: transaction.hash,
        },
      ],
    });
    const receipt = await transaction.wait(confirmations);
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress) {
      throw new Error(`${name} deployment failed`);
    }
    const runtimeCode = await ethers.provider.getCode(address);
    if (runtimeCode === "0x") throw new Error(`${name} deployment has no runtime code`);

    deployedRecords.push({
      ...expected,
      address: ethers.getAddress(address),
      transactionHash: transaction.hash,
      blockNumber: receipt.blockNumber,
      runtimeCodeHash: ethers.keccak256(runtimeCode),
      runtimeCodeBytes: (runtimeCode.length - 2) / 2,
    });
    writeJournal(partialPath, {
      ...draftManifest,
      deployments: deployedRecords,
    });
  }

  const manifest: ReplacementManifest = {
    ...draftManifest,
    deployments: deployedRecords,
    verifiedAtBlock: await ethers.provider.getBlockNumber(),
  };
  writeJournal(partialPath, manifest);
  await verifyReplacementManifest(manifest, ethers);
  requireSameBuild(build, verifyReplacementBuildAttestation(), "after keyed deployment");
  activeKeyedDeploymentBuild = undefined;
  fs.writeFileSync(finalPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.unlinkSync(partialPath);

  console.log("Replacement stack deployed and independently re-simulated from local constructor bytecode.");
  console.log(`Verified manifest: ${finalPath}`);
  console.log(
    isImmutableDisposableTestnetProfile(plan)
      ? "The disposable testnet signer is only the fee recipient; every administrative and governance capability is frozen."
      : "The gas-only deployer holds no owner, treasury, fee-setter, or connector-controller role.",
  );
}

main().catch((error) => {
  if (activeKeyedDeploymentBuild) {
    try {
      requireSameBuild(
        activeKeyedDeploymentBuild,
        verifyReplacementBuildAttestation(),
        "after the failed keyed deployment attempt",
      );
      console.error("Read-only node_modules tree still matches the attestation after the failed attempt.");
    } catch (recheckError) {
      console.error("Post-failure build/dependency recheck also failed:", recheckError);
    }
  }
  console.error(error);
  process.exitCode = 1;
});
