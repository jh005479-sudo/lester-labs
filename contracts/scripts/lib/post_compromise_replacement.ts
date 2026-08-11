import { ethers, type Provider } from "ethers";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { HardhatEthers } from "@nomicfoundation/hardhat-ethers/types";
import {
  ADDRESSES as LEGACY_ADDRESSES,
  EXPECTED_CHAIN_ID,
  EXPECTED_RUNTIME_HASHES as LEGACY_RUNTIME_HASHES,
  RETIRED_TREASURY,
  TARGET_TREASURY as REJECTED_JULY_TARGET,
} from "./live_treasury_audit.js";

export const REPLACEMENT_MANIFEST_KIND =
  "lester-labs-post-compromise-replacement" as const;
export const REPLACEMENT_SCHEMA_VERSION = 2 as const;
export const PRODUCTION_SEPARATED_PROFILE = "production-separated-authority" as const;
export const TESTNET_IMMUTABLE_DISPOSABLE_PROFILE = "testnet-immutable-disposable" as const;
export const PRODUCTION_AUTHORITY_INVENTORY_RELATIVE_PATH =
  "deployment/production-authorities.json" as const;
export const IMMUTABLE_TESTNET_AUTHORITY =
  "0x0000000000000000000000000000000000000001" as const;
export const DISPOSABLE_TESTNET_SIGNER_TREASURY =
  "0x439945924515218061b644901a31aC4A6c00957c" as const;
const ECRECOVER_TEST_VECTOR =
  "0x0000000000000000000000000000000000000000000000000000000000000002" +
  "000000000000000000000000000000000000000000000000000000000000001c" +
  "56166f3a4b7d34af3bcc6c8a92a8f3c40309db9f22d7c83f8c5b87b374fd8047" +
  "348ebb966e4e4c5ab15c43277b857c2844e45958f79b1e511163ca560b2ab246";
const ECRECOVER_EXPECTED_RESULT =
  "0x0000000000000000000000007e5f4552091a69125d5dfcb7b8c2659029395bdf";

export type ReplacementDeploymentProfile =
  | typeof PRODUCTION_SEPARATED_PROFILE
  | typeof TESTNET_IMMUTABLE_DISPOSABLE_PROFILE;

export const REPLACEMENT_PLAN_PATHS: Readonly<Record<ReplacementDeploymentProfile, string>> =
  Object.freeze({
    [PRODUCTION_SEPARATED_PROFILE]: "deployment/post-compromise-plan.json",
    [TESTNET_IMMUTABLE_DISPOSABLE_PROFILE]: "deployment/disposable-testnet-plan.json",
  });

export function replacementPlanRelativePath(profile: ReplacementDeploymentProfile): string {
  return REPLACEMENT_PLAN_PATHS[profile];
}

export const REPLACEMENT_PARAMETERS = {
  tokenCreationFee: "50000000000000000",
  vestingFee: "30000000000000000",
  lockFee: "30000000000000000",
  iloPlatformFeeBps: "200",
  iloCreationFee: "30000000000000000",
  ledgerMinFee: "10000000000000000",
  ledgerTreasuryCutBps: "5000",
  governanceInitialSupply: "10000000000000000000000000",
  governanceTimelockDelay: "172800",
  governanceVotingDelay: "1",
  governanceVotingPeriod: "45600",
  governanceProposalThreshold: "100000000000000000000000",
  governanceQuorumBps: "400",
} as const;

export const DEPLOYMENT_ORDER = [
  "WrappedZkLTC",
  "UniswapV2Factory",
  "UniswapV2Router02",
  "UniSwapConnector",
  "TokenFactory",
  "VestingFactory",
  "LiquidityLocker",
  "TheLedger",
  "Disperse",
  "ILOFactory",
  "LitGovToken",
  "LitTimelock",
  "LitGovernor",
] as const;

const CONTRACTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NODE_MODULES_TREE_FORMAT = "lester-labs-node-modules-tree-v1";
const FACTORY_RESET_MAC_ACKNOWLEDGEMENT =
  "USE_FACTORY_RESET_MAC_FOR_VALUELESS_DISPOSABLE_TESTNET_ONLY";

function replacementBuildAttestationPath(): string {
  const configured = process.env.REPLACEMENT_BUILD_ATTESTATION_PATH;
  if (!configured || !path.isAbsolute(configured)) {
    throw new Error(
      "REPLACEMENT_BUILD_ATTESTATION_PATH must identify the absolute path of the externally published clean-runner attestation",
    );
  }
  const resolved = path.resolve(configured);
  const relativeToWorkspace = path.relative(CONTRACTS_ROOT, resolved);
  if (!relativeToWorkspace.startsWith("..") && !path.isAbsolute(relativeToWorkspace)) {
    throw new Error("Replacement build attestation must be external to the source workspace");
  }
  return resolved;
}

const BUILD_ARTIFACTS = [
  ["WrappedZkLTC", "artifacts/contracts/uniswap/periphery/test/WETH9.sol/WETH9.json", "0.6.6"],
  ["UniswapV2Factory", "artifacts/contracts/uniswap/core/UniswapV2Factory.sol/UniswapV2Factory.json", "0.5.16"],
  ["UniswapV2Pair", "artifacts/contracts/uniswap/core/UniswapV2Pair.sol/UniswapV2Pair.json", "0.5.16"],
  ["UniswapV2Router02", "artifacts/contracts/uniswap/periphery/UniswapV2Router02.sol/UniswapV2Router02.json", "0.6.6"],
  ["UniSwapConnector", "artifacts/contracts/UniSwapConnector.sol/UniSwapConnector.json", "0.8.24"],
  ["TokenFactory", "artifacts/contracts/TokenFactory.sol/TokenFactory.json", "0.8.24"],
  ["VestingFactory", "artifacts/contracts/VestingFactory.sol/VestingFactory.json", "0.8.24"],
  ["LiquidityLocker", "artifacts/contracts/LiquidityLocker.sol/LiquidityLocker.json", "0.8.24"],
  ["TheLedger", "artifacts/contracts/TheLedger.sol/TheLedger.json", "0.8.24"],
  ["Disperse", "artifacts/contracts/Disperse.sol/Disperse.json", "0.8.24"],
  ["ILOFactory", "artifacts/contracts/ILOFactory.sol/ILOFactory.json", "0.8.24"],
  ["ILO", "artifacts/contracts/ILO.sol/ILO.json", "0.8.24"],
  [
    "VestingWallet",
    "artifacts/@openzeppelin/contracts/finance/VestingWallet.sol/VestingWallet.json",
    "0.8.24",
  ],
  ["LitGovToken", "artifacts/contracts/LitGovToken.sol/LitGovToken.json", "0.8.24"],
  ["LitTimelock", "artifacts/contracts/LitTimelock.sol/LitTimelock.json", "0.8.24"],
  ["LitGovernor", "artifacts/contracts/LitGovernor.sol/LitGovernor.json", "0.8.24"],
] as const;

export type ReplacementDeploymentName = (typeof DEPLOYMENT_ORDER)[number];

const ARTIFACTS: Record<ReplacementDeploymentName, string> = {
  WrappedZkLTC: "WETH9",
  UniswapV2Factory: "UniswapV2Factory",
  UniswapV2Router02: "UniswapV2Router02",
  UniSwapConnector: "UniSwapConnector",
  TokenFactory: "TokenFactory",
  VestingFactory: "VestingFactory",
  LiquidityLocker: "LiquidityLocker",
  TheLedger: "TheLedger",
  Disperse: "Disperse",
  ILOFactory: "ILOFactory",
  LitGovToken: "LitGovToken",
  LitTimelock: "LitTimelock",
  LitGovernor: "LitGovernor",
};

export function replacementArtifact(name: ReplacementDeploymentName): string {
  return ARTIFACTS[name];
}

export type ReplacementParameters = {
  tokenCreationFee: string;
  vestingFee: string;
  lockFee: string;
  iloPlatformFeeBps: string;
  iloCreationFee: string;
  ledgerMinFee: string;
  ledgerTreasuryCutBps: string;
  governanceInitialSupply: string;
  governanceTimelockDelay: string;
  governanceVotingDelay: string;
  governanceVotingPeriod: string;
  governanceProposalThreshold: string;
  governanceQuorumBps: string;
};

export type ReplacementPlan = {
  kind: typeof REPLACEMENT_MANIFEST_KIND;
  schemaVersion: typeof REPLACEMENT_SCHEMA_VERSION;
  chainId: string;
  deploymentProfile: ReplacementDeploymentProfile;
  controller: string;
  treasury: string;
  parameters: ReplacementParameters;
};

export type ReplacementDeploymentRecord = {
  name: ReplacementDeploymentName;
  artifact: string;
  address: string;
  nonce: number;
  transactionHash: string;
  blockNumber: number;
  runtimeCodeHash: string;
  runtimeCodeBytes: number;
};

export type ReplacementManifest = ReplacementPlan & {
  planHash: string;
  buildAttestationSha256: string;
  buildSourceCommit: string;
  gasOnlyDeployer: string;
  startingNonce: number;
  confirmations: number;
  legacyRecovery: {
    addresses: Record<string, string>;
    runtimeCodeHashes: Record<string, string>;
    iloFactoryProvenance: readonly {
      label: string;
      address: string;
      runtimeCodeHash: string;
      observedChildCount: string;
      observedOn: string;
    }[];
  };
  deployments: ReplacementDeploymentRecord[];
  verifiedAtBlock: number;
};

type BuildAttestationEntry = {
  name: string;
  solcVersion: string;
  artifactPath: string;
  artifactKind: "hardhat-3" | "deterministic-build-output-extract-v1";
  artifactSha256: string;
  buildInfoId: string;
  buildInfoPath: string;
  buildInfoSha256: string;
  buildInfoOutputPath: string;
  buildInfoOutputSha256: string;
};

type BuildAttestation = {
  schemaVersion: number;
  status: string;
  hashAlgorithm: string;
  deploymentProfile: ReplacementDeploymentProfile;
  planPath: string;
  sourceCommit: string;
  nodeVersion: string;
  nodeExecutableSha256: string;
  gitExecutableSha256: string;
  hardhatVersion: string;
  hardhatPackageSha256: string;
  hardhatCliSha256: string;
  nodeModulesTreeFormat: string;
  nodeModulesTreeSha256: string;
  planSha256: string;
  buildEnvironment: {
    kind: string;
    platform: string;
    architecture: string;
    cleanHome: boolean;
    networkDisabled: boolean;
    credentialFree: boolean;
    readOnlyNodeModules: boolean;
    unprivilegedUser: boolean;
    reproducibleBuildPasses: number;
    privateExternalBuildState: boolean;
    privateExternalTmp: boolean;
    homeEnvironmentForwarded: boolean;
    compilerCacheLocation: string;
    operatorAcknowledgement: string | null;
  };
  inputs: {
    path: string;
    sha256: string;
  }[];
  compilers: {
    version: string;
    longVersion: string;
    platform: string;
    filename: string;
    isSolcJs: boolean;
    sha256: string;
    registryKeccak256: string;
    compilerListSha256: string;
    selection: "native" | "reviewed-wasm-fallback";
    nativePlatform: string;
    nativeCompilerListSha256: string;
    nativeFilename: string;
    nativeMarkedDoesNotWork: boolean;
    nativeDoesNotWorkMarkerSha256: string | null;
  }[];
  artifacts: BuildAttestationEntry[];
};

export type VerifiedReplacementBuild = {
  attestationSha256: string;
  sourceCommit: string;
  nodeModulesTreeSha256: string;
  deploymentProfile: ReplacementDeploymentProfile;
  planPath: string;
};

export type AttestedVestingWalletBuild = {
  artifact: {
    contractName: "VestingWallet";
    sourceName: "@openzeppelin/contracts/finance/VestingWallet.sol";
    abi: readonly unknown[];
    bytecode: string;
    deployedBytecode: string;
    linkReferences: Record<string, unknown>;
    deployedLinkReferences: Record<string, unknown>;
    buildInfoId: string;
  };
  compilerOutput: Record<string, unknown>;
  contractOutput: Record<string, unknown>;
};

function sha256(data: Buffer | string): string {
  return `0x${createHash("sha256").update(data).digest("hex")}`;
}

function compilerOutputFromDocument(document: unknown): Record<string, unknown> {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("Hardhat 3 build-output document must be an object");
  }
  const candidate = document as Record<string, unknown>;
  const output = candidate.output ?? candidate;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("Hardhat 3 build-output document has no compiler output");
  }
  return output as Record<string, unknown>;
}

function compilerOutputContract(
  document: unknown,
  sourceName: string,
  contractName: string,
): Record<string, unknown> {
  const output = compilerOutputFromDocument(document);
  const contracts = output.contracts;
  if (!contracts || typeof contracts !== "object" || Array.isArray(contracts)) {
    throw new Error("Hardhat 3 compiler output has no contracts object");
  }
  const source = (contracts as Record<string, unknown>)[sourceName];
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error(`Hardhat 3 compiler output is missing ${sourceName}`);
  }
  const contract = (source as Record<string, unknown>)[contractName];
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    throw new Error(`Hardhat 3 compiler output is missing ${sourceName}:${contractName}`);
  }
  return contract as Record<string, unknown>;
}

function deterministicExtractedBuildOutputArtifact(
  buildInfoId: string,
  sourceName: string,
  outputSourceName: string,
  contractName: string,
  outputDocument: unknown,
): Buffer {
  const contractOutput = compilerOutputContract(outputDocument, outputSourceName, contractName);
  return Buffer.from(
    `${JSON.stringify({
      format: "lester-labs-deterministic-build-output-extract-v1",
      buildInfoId,
      sourceName,
      contractName,
      contractOutput,
    })}\n`,
    "utf8",
  );
}

function mappedBuildOutputSourceName(
  buildInfo: Record<string, unknown>,
  userSourceName: string,
): string {
  const map = buildInfo.userSourceNameMap;
  if (map === undefined) return userSourceName;
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    throw new Error("Hardhat 3 build info has an invalid userSourceNameMap");
  }
  const mapped = (map as Record<string, unknown>)[userSourceName];
  if (mapped === undefined) return userSourceName;
  if (typeof mapped !== "string" || mapped.length === 0) {
    throw new Error(`Hardhat 3 build info has an invalid mapping for ${userSourceName}`);
  }
  return mapped;
}

function updateLengthPrefixed(hash: ReturnType<typeof createHash>, value: Buffer | string): void {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(buffer.length));
  hash.update(length);
  hash.update(buffer);
}

function digestReadOnlyNodeModulesTree(): string {
  const treeRoot = path.resolve(CONTRACTS_ROOT, "node_modules");
  const rootStat = fs.lstatSync(treeRoot);
  if (!rootStat.isDirectory()) {
    throw new Error("node_modules must be a real directory, not a symlink or special file");
  }
  const realTreeRoot = fs.realpathSync(treeRoot);
  const records: { absolutePath: string; relativePath: string; stat: fs.Stats }[] = [
    { absolutePath: treeRoot, relativePath: ".", stat: rootStat },
  ];

  function collect(directory: string, relativeDirectory: string): void {
    const names = fs.readdirSync(directory).sort((left, right) =>
      Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
    );
    for (const name of names) {
      const absolutePath = path.resolve(directory, name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const stat = fs.lstatSync(absolutePath);
      records.push({ absolutePath, relativePath, stat });
      if (stat.isDirectory()) collect(absolutePath, relativePath);
    }
  }

  collect(treeRoot, "");
  records.sort((left, right) =>
    Buffer.compare(Buffer.from(left.relativePath, "utf8"), Buffer.from(right.relativePath, "utf8"))
  );

  const hash = createHash("sha256");
  updateLengthPrefixed(hash, NODE_MODULES_TREE_FORMAT);
  for (const record of records) {
    const mode = record.stat.mode & 0o7777;
    let type: "directory" | "file" | "symlink";
    let payload = Buffer.alloc(0);
    if (record.stat.isDirectory()) {
      type = "directory";
      if ((mode & 0o222) !== 0) {
        throw new Error(`node_modules directory is writable: ${record.relativePath}`);
      }
    } else if (record.stat.isFile()) {
      type = "file";
      if ((mode & 0o222) !== 0) {
        throw new Error(`node_modules file is writable: ${record.relativePath}`);
      }
      payload = fs.readFileSync(record.absolutePath);
    } else if (record.stat.isSymbolicLink()) {
      type = "symlink";
      const target = fs.readlinkSync(record.absolutePath);
      const resolvedTarget = fs.realpathSync(record.absolutePath);
      const relativeTarget = path.relative(realTreeRoot, resolvedTarget);
      if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
        throw new Error(`node_modules symlink escapes the attested tree: ${record.relativePath}`);
      }
      payload = Buffer.from(target, "utf8");
    } else {
      throw new Error(`Unsupported special file in node_modules: ${record.relativePath}`);
    }
    updateLengthPrefixed(hash, record.relativePath);
    updateLengthPrefixed(hash, type);
    updateLengthPrefixed(hash, mode.toString(8).padStart(4, "0"));
    updateLengthPrefixed(hash, payload);
  }
  return `0x${hash.digest("hex")}`;
}

function requireSha256(label: string, actual: unknown): asserts actual is string {
  if (typeof actual !== "string" || !/^0x[0-9a-f]{64}$/.test(actual)) {
    throw new Error(`${label} must be a lower-case SHA-256 value`);
  }
}

function readBuildFile(relativePath: string): Buffer {
  const absolutePath = path.resolve(CONTRACTS_ROOT, relativePath);
  const relativeResolved = path.relative(CONTRACTS_ROOT, absolutePath);
  if (relativeResolved.startsWith("..") || path.isAbsolute(relativeResolved)) {
    throw new Error(`Build attestation path escapes the contracts workspace: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath);
}

function verifyAttestedGitCheckout(sourceCommit: string, expectedGitSha256: string): void {
  const gitExecutable = process.env.REPLACEMENT_GIT_EXECUTABLE_PATH;
  if (!gitExecutable || !path.isAbsolute(gitExecutable)) {
    throw new Error("REPLACEMENT_GIT_EXECUTABLE_PATH must be an absolute reviewed Git executable");
  }
  requireSha256("Build attestation gitExecutableSha256", expectedGitSha256);
  const expectedGitExecutableSha256 = process.env.EXPECTED_REPLACEMENT_GIT_EXECUTABLE_SHA256;
  requireSha256("EXPECTED_REPLACEMENT_GIT_EXECUTABLE_SHA256", expectedGitExecutableSha256);
  const actualGitExecutableSha256 = sha256(fs.readFileSync(gitExecutable));
  if (
    actualGitExecutableSha256 !== expectedGitSha256 ||
    actualGitExecutableSha256 !== expectedGitExecutableSha256
  ) {
    throw new Error("Git executable differs from the attested and independently supplied digests");
  }

  const gitEnvironment = {
    PATH: path.dirname(gitExecutable),
    LANG: "C",
    LC_ALL: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
  };
  const gitArguments = [
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
  ];
  const repositoryRoot = execFileSync(
    gitExecutable,
    [...gitArguments, "rev-parse", "--show-toplevel"],
    { cwd: CONTRACTS_ROOT, env: gitEnvironment, encoding: "utf8" },
  ).trim();
  if (path.resolve(repositoryRoot) !== path.resolve(CONTRACTS_ROOT, "..")) {
    throw new Error("Deployment verification must run from the reviewed repository root");
  }

  const trackedEntries = execFileSync(
    gitExecutable,
    [...gitArguments, "ls-files", "-v", "-z"],
    { cwd: CONTRACTS_ROOT, env: gitEnvironment, encoding: "utf8" },
  ).split("\0").filter(Boolean);
  if (trackedEntries.some((entry) => !entry.startsWith("H "))) {
    throw new Error(
      "Deployment checkout Git index contains assume-unchanged, skip-worktree, unmerged, or otherwise hidden state",
    );
  }
  const stagedEntries = execFileSync(
    gitExecutable,
    [...gitArguments, "ls-files", "--stage", "-z"],
    { cwd: CONTRACTS_ROOT, env: gitEnvironment, encoding: "utf8" },
  ).split("\0").filter(Boolean);
  if (stagedEntries.some((entry) => entry.startsWith("160000 "))) {
    throw new Error("Deployment checkout contains a submodule, which is not an attested package source");
  }

  const head = execFileSync(gitExecutable, [...gitArguments, "rev-parse", "HEAD"], {
    cwd: CONTRACTS_ROOT,
    env: gitEnvironment,
    encoding: "utf8",
  }).trim();
  if (head !== sourceCommit) {
    throw new Error(`Deployment checkout HEAD is ${head}; attested source commit is ${sourceCommit}`);
  }
  const status = execFileSync(
    gitExecutable,
    [...gitArguments, "status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: CONTRACTS_ROOT, env: gitEnvironment, encoding: "utf8" },
  );
  if (status.trim()) {
    throw new Error("Deployment checkout has staged, unstaged, or untracked changes");
  }
}

export function verifyReplacementBuildAttestation(
  options: { verifyNodeModulesTree?: boolean } = {},
): VerifiedReplacementBuild {
  if (typeof process.getuid !== "function" || process.getuid() === 0) {
    throw new Error("Replacement build verification requires an unprivileged non-root user");
  }
  const attestationPath = replacementBuildAttestationPath();
  const raw = fs.readFileSync(attestationPath);
  const expectedAttestationSha256 = process.env.EXPECTED_REPLACEMENT_BUILD_ATTESTATION_SHA256;
  requireSha256("EXPECTED_REPLACEMENT_BUILD_ATTESTATION_SHA256", expectedAttestationSha256);
  if (sha256(raw) !== expectedAttestationSha256) {
    throw new Error("External replacement build attestation does not match its independently supplied digest");
  }
  const parsed = JSON.parse(raw.toString("utf8")) as BuildAttestation;
  if (
    parsed.schemaVersion !== 3 ||
    parsed.status !== "ATTESTED" ||
    parsed.hashAlgorithm !== "sha256"
  ) {
    throw new Error("Replacement build is not backed by a supported ATTESTED build record");
  }
  if (
    parsed.deploymentProfile !== PRODUCTION_SEPARATED_PROFILE &&
    parsed.deploymentProfile !== TESTNET_IMMUTABLE_DISPOSABLE_PROFILE
  ) {
    throw new Error("Build attestation has an unsupported deployment profile");
  }
  if (parsed.planPath !== replacementPlanRelativePath(parsed.deploymentProfile)) {
    throw new Error("Build attestation profile and source-pinned plan path do not agree");
  }
  if (!/^[0-9a-f]{40}$/.test(parsed.sourceCommit)) {
    throw new Error("Build attestation sourceCommit must be a full lower-case Git commit hash");
  }
  verifyAttestedGitCheckout(parsed.sourceCommit, parsed.gitExecutableSha256);
  const attestedLinux =
    parsed.buildEnvironment?.kind === "trusted-ephemeral-linux" &&
    parsed.buildEnvironment.platform === "linux" &&
    parsed.buildEnvironment.architecture === "x64";
  const attestedFactoryResetDarwin =
    parsed.deploymentProfile === TESTNET_IMMUTABLE_DISPOSABLE_PROFILE &&
    parsed.buildEnvironment?.kind === "factory-reset-darwin-disposable" &&
    parsed.buildEnvironment.platform === "darwin" &&
    (parsed.buildEnvironment.architecture === "arm64" ||
      parsed.buildEnvironment.architecture === "x64");
  if (parsed.deploymentProfile === PRODUCTION_SEPARATED_PROFILE && !attestedLinux) {
    throw new Error("Production replacement builds require trusted-ephemeral-linux attestation");
  }
  if (!attestedLinux && !attestedFactoryResetDarwin) {
    throw new Error("Build attestation environment is not authorised for its deployment profile");
  }
  if (
    process.platform !== parsed.buildEnvironment.platform ||
    process.arch !== parsed.buildEnvironment.architecture
  ) {
    throw new Error("Build verification must use the same reviewed platform and architecture");
  }
  if (
    attestedFactoryResetDarwin &&
    process.env[FACTORY_RESET_MAC_ACKNOWLEDGEMENT] !== "true"
  ) {
    throw new Error(
      `${FACTORY_RESET_MAC_ACKNOWLEDGEMENT}=true is required only for the valueless immutable disposable testnet profile`,
    );
  }
  if (
    parsed.buildEnvironment.cleanHome !== true ||
    parsed.buildEnvironment.networkDisabled !== true ||
    parsed.buildEnvironment.credentialFree !== true ||
    parsed.buildEnvironment.readOnlyNodeModules !== true ||
    parsed.buildEnvironment.unprivilegedUser !== true ||
    parsed.buildEnvironment.reproducibleBuildPasses !== 2 ||
    parsed.buildEnvironment.privateExternalBuildState !== true ||
    parsed.buildEnvironment.privateExternalTmp !== true ||
    parsed.buildEnvironment.homeEnvironmentForwarded !== false ||
    parsed.buildEnvironment.compilerCacheLocation !==
      (attestedFactoryResetDarwin ? "attested-native-user-cache" : "private-xdg-cache") ||
    parsed.buildEnvironment.operatorAcknowledgement !==
      (attestedFactoryResetDarwin ? FACTORY_RESET_MAC_ACKNOWLEDGEMENT : null)
  ) {
    throw new Error("Build attestation does not prove the required isolated two-pass build environment");
  }
  if (parsed.nodeVersion !== process.version) {
    throw new Error(`Build attestation requires Node ${parsed.nodeVersion}; running ${process.version}`);
  }
  requireSha256("Build attestation nodeExecutableSha256", parsed.nodeExecutableSha256);
  if (sha256(fs.readFileSync(process.execPath)) !== parsed.nodeExecutableSha256) {
    throw new Error("Deployment Node executable differs from the attested build toolchain");
  }
  const projectPackage = JSON.parse(readBuildFile("package.json").toString("utf8")) as {
    devDependencies?: { hardhat?: unknown };
  };
  const installedHardhat = JSON.parse(
    readBuildFile("node_modules/hardhat/package.json").toString("utf8"),
  ) as { version?: unknown; bin?: unknown };
  if (
    typeof parsed.hardhatVersion !== "string" ||
    projectPackage.devDependencies?.hardhat !== parsed.hardhatVersion ||
    installedHardhat.version !== parsed.hardhatVersion
  ) {
    throw new Error("Build attestation Hardhat version does not match the pinned installed toolchain");
  }
  requireSha256("Build attestation hardhatPackageSha256", parsed.hardhatPackageSha256);
  if (sha256(readBuildFile("node_modules/hardhat/package.json")) !== parsed.hardhatPackageSha256) {
    throw new Error("Installed Hardhat package metadata differs from the attested build toolchain");
  }
  const hardhatBinRelative =
    typeof installedHardhat.bin === "string"
      ? installedHardhat.bin
      : (installedHardhat.bin as { hardhat?: unknown } | undefined)?.hardhat;
  if (typeof hardhatBinRelative !== "string") {
    throw new Error("Installed Hardhat package does not expose its expected CLI");
  }
  const hardhatCliPath = path
    .relative(CONTRACTS_ROOT, path.resolve(CONTRACTS_ROOT, "node_modules/hardhat", hardhatBinRelative))
    .split(path.sep)
    .join("/");
  requireSha256("Build attestation hardhatCliSha256", parsed.hardhatCliSha256);
  if (sha256(readBuildFile(hardhatCliPath)) !== parsed.hardhatCliSha256) {
    throw new Error("Installed Hardhat CLI differs from the attested build toolchain");
  }
  if (parsed.nodeModulesTreeFormat !== NODE_MODULES_TREE_FORMAT) {
    throw new Error("Build attestation uses an unsupported node_modules tree format");
  }
  requireSha256("Build attestation nodeModulesTreeSha256", parsed.nodeModulesTreeSha256);
  if (
    options.verifyNodeModulesTree !== false &&
    digestReadOnlyNodeModulesTree() !== parsed.nodeModulesTreeSha256
  ) {
    throw new Error("Read-only node_modules tree differs from the reviewed build attestation");
  }
  requireSha256("Build attestation planSha256", parsed.planSha256);
  const planRaw = readBuildFile(parsed.planPath);
  if (sha256(planRaw) !== parsed.planSha256) {
    throw new Error("Build attestation was created for a different deployment plan");
  }
  const attestedPlan = validateReplacementPlan(
    JSON.parse(planRaw.toString("utf8")) as ReplacementPlan,
  );
  if (attestedPlan.deploymentProfile !== parsed.deploymentProfile) {
    throw new Error("Build attestation deployment profile differs from its reviewed plan");
  }
  const expectedInputs = [
    "package.json",
    "package-lock.json",
    ".npmrc",
    "hardhat.config.ts",
    parsed.planPath,
    ...(parsed.deploymentProfile === PRODUCTION_SEPARATED_PROFILE
      ? [PRODUCTION_AUTHORITY_INVENTORY_RELATIVE_PATH]
      : []),
  ];
  if (!Array.isArray(parsed.inputs) || parsed.inputs.length !== expectedInputs.length) {
    throw new Error(`Build attestation must contain exactly ${expectedInputs.length} reviewed inputs`);
  }
  for (let index = 0; index < expectedInputs.length; index += 1) {
    const entry = parsed.inputs[index];
    const expectedPath = expectedInputs[index];
    if (!entry || entry.path !== expectedPath) {
      throw new Error(`Build attestation input ${index} must be ${expectedPath}`);
    }
    requireSha256(`Build attestation ${expectedPath} digest`, entry.sha256);
    if (sha256(readBuildFile(expectedPath)) !== entry.sha256) {
      throw new Error(`${expectedPath} differs from the reviewed build attestation`);
    }
  }
  const expectedCompilerVersions = ["0.5.16", "0.6.6", "0.8.24"];
  if (!Array.isArray(parsed.compilers) || parsed.compilers.length !== expectedCompilerVersions.length) {
    throw new Error(`Build attestation must contain exactly ${expectedCompilerVersions.length} compilers`);
  }
  for (let index = 0; index < expectedCompilerVersions.length; index += 1) {
    const compiler = parsed.compilers[index];
    const expectedVersion = expectedCompilerVersions[index];
    const expectedPlatform = attestedFactoryResetDarwin && expectedVersion !== "0.8.24"
      ? "wasm"
      : attestedFactoryResetDarwin
        ? "macosx-amd64"
        : "linux-amd64";
    const expectedNativePlatform = attestedFactoryResetDarwin
      ? "macosx-amd64"
      : "linux-amd64";
    const expectedWasmFallback = expectedPlatform === "wasm";
    if (
      !compiler ||
      compiler.version !== expectedVersion ||
      compiler.platform !== expectedPlatform ||
      compiler.nativePlatform !== expectedNativePlatform ||
      compiler.isSolcJs !== expectedWasmFallback ||
      compiler.selection !== (expectedWasmFallback ? "reviewed-wasm-fallback" : "native") ||
      compiler.nativeMarkedDoesNotWork !== expectedWasmFallback ||
      typeof compiler.longVersion !== "string" ||
      typeof compiler.filename !== "string" ||
      compiler.filename.includes("/") || compiler.filename.includes("\\") ||
      typeof compiler.nativeFilename !== "string" ||
      compiler.nativeFilename.includes("/") || compiler.nativeFilename.includes("\\") ||
      !/^0x[0-9a-f]{64}$/.test(compiler.registryKeccak256)
    ) {
      throw new Error(
        `Build attestation compiler ${index} does not pin the reviewed ${expectedPlatform} solc ${expectedVersion}`,
      );
    }
    requireSha256(`solc ${expectedVersion} binary digest`, compiler.sha256);
    requireSha256(`solc ${expectedVersion} compiler-list digest`, compiler.compilerListSha256);
    requireSha256(
      `solc ${expectedVersion} native compiler-list digest`,
      compiler.nativeCompilerListSha256,
    );
    if (expectedWasmFallback) {
      requireSha256(
        `solc ${expectedVersion} native unusable-marker digest`,
        compiler.nativeDoesNotWorkMarkerSha256,
      );
    } else if (compiler.nativeDoesNotWorkMarkerSha256 !== null) {
      throw new Error(`Native solc ${expectedVersion} unexpectedly records an unusable marker`);
    }
    if (
      !expectedWasmFallback &&
      compiler.compilerListSha256 !== compiler.nativeCompilerListSha256
    ) {
      throw new Error(`Native solc ${expectedVersion} must bind the same native compiler list`);
    }
  }
  if (!Array.isArray(parsed.artifacts) || parsed.artifacts.length !== BUILD_ARTIFACTS.length) {
    throw new Error(`Build attestation must contain exactly ${BUILD_ARTIFACTS.length} artifacts`);
  }

  for (let index = 0; index < BUILD_ARTIFACTS.length; index += 1) {
    const [expectedName, expectedArtifactPath, expectedSolcVersion] = BUILD_ARTIFACTS[index];
    const entry = parsed.artifacts[index];
    const supportedArtifactKind =
      entry?.artifactKind === "hardhat-3" ||
      (expectedName === "VestingWallet" &&
        entry?.artifactKind === "deterministic-build-output-extract-v1");
    if (
      !entry ||
      entry.name !== expectedName ||
      entry.solcVersion !== expectedSolcVersion ||
      entry.artifactPath !== expectedArtifactPath ||
      !supportedArtifactKind ||
      !/^solc-\d+_\d+_\d+-[0-9a-f]{40}$/.test(entry.buildInfoId) ||
      entry.buildInfoPath !== `artifacts/build-info/${entry.buildInfoId}.json` ||
      entry.buildInfoOutputPath !== `artifacts/build-info/${entry.buildInfoId}.output.json`
    ) {
      throw new Error(`Build attestation artifact ${index} does not match ${expectedName}`);
    }
    requireSha256(`${expectedName} artifactSha256`, entry.artifactSha256);
    requireSha256(`${expectedName} buildInfoSha256`, entry.buildInfoSha256);
    requireSha256(`${expectedName} buildInfoOutputSha256`, entry.buildInfoOutputSha256);

    const buildInfoRaw = readBuildFile(entry.buildInfoPath);
    if (sha256(buildInfoRaw) !== entry.buildInfoSha256) {
      throw new Error(`${expectedName} build info differs from the reviewed build attestation`);
    }
    const buildInfoOutputRaw = readBuildFile(entry.buildInfoOutputPath);
    if (sha256(buildInfoOutputRaw) !== entry.buildInfoOutputSha256) {
      throw new Error(`${expectedName} build output differs from the reviewed build attestation`);
    }
    const buildInfo = JSON.parse(buildInfoRaw.toString("utf8")) as Record<string, unknown>;
    const expectedBuildInfoIdPrefix = `solc-${expectedSolcVersion.replaceAll(".", "_")}-`;
    if (
      buildInfo.solcVersion !== expectedSolcVersion ||
      buildInfo.solcLongVersion !==
        parsed.compilers.find(({ version }) => version === expectedSolcVersion)?.longVersion ||
      buildInfo._format !== "hh3-sol-build-info-1" ||
      buildInfo.compilerType !== "solc" ||
      buildInfo.id !== entry.buildInfoId ||
      !entry.buildInfoId.startsWith(expectedBuildInfoIdPrefix)
    ) {
      throw new Error(`${expectedName} build info does not use solc ${expectedSolcVersion}`);
    }
    const outputDocument = JSON.parse(buildInfoOutputRaw.toString("utf8")) as unknown;
    if (
      !outputDocument ||
      typeof outputDocument !== "object" ||
      Array.isArray(outputDocument) ||
      (outputDocument as Record<string, unknown>)._format !==
        "hh3-sol-build-info-output-1" ||
      (outputDocument as Record<string, unknown>).id !== entry.buildInfoId
    ) {
      throw new Error(`${expectedName} does not have a matching Hardhat 3 build-output wrapper`);
    }
    const artifactRaw = entry.artifactKind === "hardhat-3"
      ? readBuildFile(entry.artifactPath)
      : deterministicExtractedBuildOutputArtifact(
          entry.buildInfoId,
          "@openzeppelin/contracts/finance/VestingWallet.sol",
          mappedBuildOutputSourceName(
            buildInfo,
            "@openzeppelin/contracts/finance/VestingWallet.sol",
          ),
          "VestingWallet",
          outputDocument,
        );
    if (sha256(artifactRaw) !== entry.artifactSha256) {
      throw new Error(`${expectedName} artifact differs from the reviewed build attestation`);
    }
    if (entry.artifactKind === "hardhat-3") {
      const artifact = JSON.parse(artifactRaw.toString("utf8")) as {
        _format?: unknown;
        buildInfoId?: unknown;
        contractName?: unknown;
        sourceName?: unknown;
      };
      const expectedContractName = expectedName === "WrappedZkLTC" ? "WETH9" : expectedName;
      if (
        artifact._format !== "hh3-artifact-1" ||
        artifact.buildInfoId !== entry.buildInfoId ||
        artifact.contractName !== expectedContractName ||
        typeof artifact.sourceName !== "string"
      ) {
        throw new Error(`${expectedName} Hardhat 3 artifact is not bound to its build-info output`);
      }
      compilerOutputContract(
        outputDocument,
        mappedBuildOutputSourceName(buildInfo, artifact.sourceName),
        expectedContractName,
      );
    }
  }

  return {
    attestationSha256: sha256(raw),
    sourceCommit: parsed.sourceCommit,
    nodeModulesTreeSha256: parsed.nodeModulesTreeSha256,
    deploymentProfile: parsed.deploymentProfile,
    planPath: parsed.planPath,
  };
}

/**
 * Read VestingWallet from the exact split build-info output pinned by the
 * external attestation. The source-pinned npmFilesToBuild setting normally
 * emits a standalone artifact, while this keeps output provenance explicit.
 */
export function readAttestedVestingWalletBuild(): AttestedVestingWalletBuild {
  verifyReplacementBuildAttestation();
  const attestation = JSON.parse(
    fs.readFileSync(replacementBuildAttestationPath(), "utf8"),
  ) as BuildAttestation;
  const entry = attestation.artifacts.find(({ name }) => name === "VestingWallet");
  if (
    !entry ||
    (entry.artifactKind !== "hardhat-3" &&
      entry.artifactKind !== "deterministic-build-output-extract-v1") ||
    !/^solc-\d+_\d+_\d+-[0-9a-f]{40}$/.test(entry.buildInfoId) ||
    entry.buildInfoPath !== `artifacts/build-info/${entry.buildInfoId}.json` ||
    entry.buildInfoOutputPath !== `artifacts/build-info/${entry.buildInfoId}.output.json`
  ) {
    throw new Error("Attested Hardhat 3 VestingWallet build-output record is missing");
  }
  const buildInfoRaw = readBuildFile(entry.buildInfoPath);
  if (sha256(buildInfoRaw) !== entry.buildInfoSha256) {
    throw new Error("VestingWallet split build input differs from its reviewed attestation");
  }
  const buildInfo = JSON.parse(buildInfoRaw.toString("utf8")) as Record<string, unknown>;
  const buildOutputRaw = readBuildFile(entry.buildInfoOutputPath);
  if (sha256(buildOutputRaw) !== entry.buildInfoOutputSha256) {
    throw new Error("VestingWallet split build output differs from its reviewed attestation");
  }
  const outputDocument = JSON.parse(buildOutputRaw.toString("utf8")) as unknown;
  const compilerOutput = compilerOutputFromDocument(outputDocument);
  const userSourceName = "@openzeppelin/contracts/finance/VestingWallet.sol";
  const contractOutput = compilerOutputContract(
    outputDocument,
    mappedBuildOutputSourceName(buildInfo, userSourceName),
    "VestingWallet",
  );
  const evm = contractOutput.evm as
    | {
        bytecode?: { object?: unknown; linkReferences?: unknown };
        deployedBytecode?: { object?: unknown; linkReferences?: unknown };
      }
    | undefined;
  const creationObject = evm?.bytecode?.object;
  const deployedObject = evm?.deployedBytecode?.object;
  if (
    typeof creationObject !== "string" || !/^[0-9a-fA-F]*$/.test(creationObject) ||
    typeof deployedObject !== "string" || !/^[0-9a-fA-F]*$/.test(deployedObject) ||
    !Array.isArray(contractOutput.abi)
  ) {
    throw new Error("Attested VestingWallet compiler output cannot form a Solidity artifact");
  }
  return {
    artifact: {
      contractName: "VestingWallet",
      sourceName: userSourceName,
      abi: contractOutput.abi,
      bytecode: `0x${creationObject}`,
      deployedBytecode: `0x${deployedObject}`,
      linkReferences: (evm?.bytecode?.linkReferences as Record<string, unknown> | undefined) ?? {},
      deployedLinkReferences:
        (evm?.deployedBytecode?.linkReferences as Record<string, unknown> | undefined) ?? {},
      buildInfoId: entry.buildInfoId,
    },
    compilerOutput,
    contractOutput,
  };
}

function normalized(address: string): string {
  return ethers.getAddress(address).toLowerCase();
}

const INCIDENT_DISALLOWED_ADDRESSES = new Set([
  normalized(RETIRED_TREASURY),
  normalized(REJECTED_JULY_TARGET),
  normalized(DISPOSABLE_TESTNET_SIGNER_TREASURY),
  normalized(IMMUTABLE_TESTNET_AUTHORITY),
  ...Object.values(LEGACY_ADDRESSES).map(normalized),
]);

export function requireFreshIncidentSafeAddress(label: string, address: string): string {
  const checked = ethers.getAddress(address);
  if (INCIDENT_DISALLOWED_ADDRESSES.has(normalized(checked))) {
    throw new Error(`${label} must not reuse an incident-compromised or chat-disclosed address`);
  }
  return checked;
}

export function isImmutableDisposableTestnetProfile(
  value: Pick<ReplacementPlan, "deploymentProfile">,
): boolean {
  return value.deploymentProfile === TESTNET_IMMUTABLE_DISPOSABLE_PROFILE;
}

export function governanceInitialHolder(plan: ReplacementPlan): string {
  return isImmutableDisposableTestnetProfile(plan) ? plan.controller : plan.treasury;
}

export async function verifyImmutableTestnetAuthorityPrecompile(provider: Provider): Promise<void> {
  const result = await provider.call({
    to: IMMUTABLE_TESTNET_AUTHORITY,
    data: ECRECOVER_TEST_VECTOR,
  });
  if (result.toLowerCase() !== ECRECOVER_EXPECTED_RESULT) {
    throw new Error(
      `Address ${IMMUTABLE_TESTNET_AUTHORITY} did not exhibit the source-pinned ECRECOVER precompile semantics`,
    );
  }
}

function requireAddress(label: string, actual: string, expected: string): void {
  if (normalized(actual) !== normalized(expected)) {
    throw new Error(`${label} is ${actual}; expected ${expected}`);
  }
}

function requireUint(label: string, actual: bigint, expected: string): void {
  if (actual !== BigInt(expected)) {
    throw new Error(`${label} is ${actual}; expected ${expected}`);
  }
}

function requireBoolean(label: string, actual: boolean, expected: boolean): void {
  if (actual !== expected) {
    throw new Error(`${label} is ${actual}; expected ${expected}`);
  }
}

function requireString(label: string, actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`${label} is ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}`);
  }
}

function assertParameters(parameters: ReplacementParameters): void {
  for (const [key, expected] of Object.entries(REPLACEMENT_PARAMETERS)) {
    const actual = parameters[key as keyof ReplacementParameters];
    if (actual !== expected) {
      throw new Error(`Replacement parameter ${key} is ${actual}; expected ${expected}`);
    }
  }
}

export function validateReplacementPlan(plan: ReplacementPlan): ReplacementPlan {
  if (plan.kind !== REPLACEMENT_MANIFEST_KIND) {
    throw new Error(`Unexpected replacement plan kind: ${String(plan.kind)}`);
  }
  if (plan.schemaVersion !== REPLACEMENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported replacement schema: ${String(plan.schemaVersion)}`);
  }
  if (BigInt(plan.chainId) !== EXPECTED_CHAIN_ID) {
    throw new Error(`Replacement plan must target LitVM chain ${EXPECTED_CHAIN_ID}`);
  }
  if (
    plan.deploymentProfile !== PRODUCTION_SEPARATED_PROFILE &&
    plan.deploymentProfile !== TESTNET_IMMUTABLE_DISPOSABLE_PROFILE
  ) {
    throw new Error(`Unsupported replacement deployment profile: ${String(plan.deploymentProfile)}`);
  }
  const controller = ethers.getAddress(plan.controller);
  const treasury = ethers.getAddress(plan.treasury);
  if (controller === ethers.ZeroAddress || treasury === ethers.ZeroAddress) {
    throw new Error("Controller and treasury must be non-zero reviewed addresses");
  }
  if (normalized(controller) === normalized(treasury)) {
    throw new Error("Controller and treasury must be distinct reviewed addresses");
  }

  if (plan.deploymentProfile === TESTNET_IMMUTABLE_DISPOSABLE_PROFILE) {
    if (normalized(controller) !== normalized(IMMUTABLE_TESTNET_AUTHORITY)) {
      throw new Error(
        `Disposable testnet deployments must freeze every controller role at ${IMMUTABLE_TESTNET_AUTHORITY}`,
      );
    }
    if (normalized(treasury) !== normalized(DISPOSABLE_TESTNET_SIGNER_TREASURY)) {
      throw new Error(
        "Disposable testnet deployments may use only the explicitly authorised disclosed test-gas address as treasury",
      );
    }
  } else if (
    INCIDENT_DISALLOWED_ADDRESSES.has(normalized(controller)) ||
    INCIDENT_DISALLOWED_ADDRESSES.has(normalized(treasury))
  ) {
    throw new Error("Production controller and treasury must not reuse an incident-compromised or chat-disclosed address");
  }
  assertParameters(plan.parameters);
  return { ...plan, controller, treasury };
}

export function pinnedLegacyRecovery(): ReplacementManifest["legacyRecovery"] {
  return {
    addresses: { ...LEGACY_ADDRESSES },
    runtimeCodeHashes: { ...LEGACY_RUNTIME_HASHES },
    iloFactoryProvenance: [
      {
        label: "production-build-hidden-factory",
        address: LEGACY_ADDRESSES.productionBuildIloFactory,
        runtimeCodeHash: LEGACY_RUNTIME_HASHES.productionBuildIloFactory,
        observedChildCount: "8330",
        observedOn: "2026-08-04",
      },
      {
        label: "canonical-legacy-factory",
        address: LEGACY_ADDRESSES.iloFactory,
        runtimeCodeHash: LEGACY_RUNTIME_HASHES.iloFactory,
        observedChildCount: "121",
        observedOn: "2026-08-04",
      },
    ],
  };
}

export async function verifyPinnedLegacyRuntime(provider: Provider): Promise<void> {
  const chainId = (await provider.getNetwork()).chainId;
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Legacy runtime attestation is pinned to chain ${EXPECTED_CHAIN_ID}, not ${chainId}`);
  }
  for (const [label, address] of Object.entries(LEGACY_ADDRESSES)) {
    const code = await provider.getCode(address);
    if (code === "0x") {
      throw new Error(`Legacy recovery contract ${label} has no runtime at ${address}`);
    }
    const actualHash = ethers.keccak256(code);
    const expectedHash = LEGACY_RUNTIME_HASHES[label as keyof typeof LEGACY_RUNTIME_HASHES];
    if (actualHash !== expectedHash) {
      throw new Error(
        `Legacy recovery contract ${label} runtime is ${actualHash}; expected ${expectedHash}`,
      );
    }
  }
}

function recordMap(
  manifest: ReplacementManifest,
): Map<ReplacementDeploymentName, ReplacementDeploymentRecord> {
  if (manifest.deployments.length !== DEPLOYMENT_ORDER.length) {
    throw new Error(
      `Manifest contains ${manifest.deployments.length} deployments; expected ${DEPLOYMENT_ORDER.length}`,
    );
  }
  const byName = new Map<ReplacementDeploymentName, ReplacementDeploymentRecord>();
  for (const record of manifest.deployments) {
    if (byName.has(record.name)) {
      throw new Error(`Duplicate deployment record for ${record.name}`);
    }
    byName.set(record.name, record);
  }
  for (const name of DEPLOYMENT_ORDER) {
    if (!byName.has(name)) throw new Error(`Missing deployment record for ${name}`);
  }
  return byName;
}

function addressOf(
  records: Map<ReplacementDeploymentName, ReplacementDeploymentRecord>,
  name: ReplacementDeploymentName,
): string {
  return records.get(name)!.address;
}

export function deploymentArguments(
  manifest: ReplacementManifest,
  records = recordMap(manifest),
): Record<ReplacementDeploymentName, readonly unknown[]> {
  const controller = manifest.controller;
  const treasury = manifest.treasury;
  const parameters = manifest.parameters;
  const wrappedNative = addressOf(records, "WrappedZkLTC");
  const factory = addressOf(records, "UniswapV2Factory");
  const router = addressOf(records, "UniswapV2Router02");
  const connector = addressOf(records, "UniSwapConnector");
  const governanceToken = addressOf(records, "LitGovToken");
  const governanceTimelock = addressOf(records, "LitTimelock");
  const governanceGovernor = addressOf(records, "LitGovernor");
  const initialGovernanceHolder = governanceInitialHolder(manifest);
  const allowDeploymentSignerAsFeeRecipient = isImmutableDisposableTestnetProfile(manifest);

  return {
    WrappedZkLTC: [],
    UniswapV2Factory: [controller, treasury, allowDeploymentSignerAsFeeRecipient],
    UniswapV2Router02: [factory, wrappedNative],
    UniSwapConnector: [router, factory, treasury, controller, allowDeploymentSignerAsFeeRecipient],
    TokenFactory: [BigInt(parameters.tokenCreationFee), controller, treasury, allowDeploymentSignerAsFeeRecipient],
    VestingFactory: [BigInt(parameters.vestingFee), controller, treasury, allowDeploymentSignerAsFeeRecipient],
    LiquidityLocker: [BigInt(parameters.lockFee), controller, treasury, allowDeploymentSignerAsFeeRecipient],
    TheLedger: [treasury, controller, allowDeploymentSignerAsFeeRecipient],
    Disperse: [],
    ILOFactory: [
      router,
      connector,
      treasury,
      BigInt(parameters.iloPlatformFeeBps),
      BigInt(parameters.iloCreationFee),
      controller,
      allowDeploymentSignerAsFeeRecipient,
    ],
    LitGovToken: [governanceTimelock, initialGovernanceHolder],
    LitTimelock: [BigInt(parameters.governanceTimelockDelay), governanceGovernor, controller],
    LitGovernor: [
      governanceToken,
      governanceTimelock,
      BigInt(parameters.governanceVotingDelay),
      BigInt(parameters.governanceVotingPeriod),
      BigInt(parameters.governanceProposalThreshold),
      BigInt(parameters.governanceQuorumBps),
    ],
  };
}

async function verifyDeploymentTransactions(
  manifest: ReplacementManifest,
  hardhatEthers: HardhatEthers,
  provider: Provider,
  records: Map<ReplacementDeploymentName, ReplacementDeploymentRecord>,
): Promise<void> {
  const argsByName = deploymentArguments(manifest, records);
  const gasOnlyDeployer = normalized(manifest.gasOnlyDeployer);
  let previousDeploymentBlock = -1;

  for (let index = 0; index < DEPLOYMENT_ORDER.length; index += 1) {
    const name = DEPLOYMENT_ORDER[index];
    const record = records.get(name)!;
    const expectedNonce = manifest.startingNonce + index;
    const expectedAddress = ethers.getCreateAddress({
      from: manifest.gasOnlyDeployer,
      nonce: expectedNonce,
    });

    if (record.artifact !== ARTIFACTS[name]) {
      throw new Error(`${name} artifact is ${record.artifact}; expected ${ARTIFACTS[name]}`);
    }
    if (record.nonce !== expectedNonce) {
      throw new Error(`${name} nonce is ${record.nonce}; expected ${expectedNonce}`);
    }
    requireAddress(`${name} deterministic address`, record.address, expectedAddress);

    const factory = await hardhatEthers.getContractFactory(record.artifact);
    const expectedDeploy = await factory.getDeployTransaction(...argsByName[name]);
    if (typeof expectedDeploy.data !== "string") {
      throw new Error(`Unable to reconstruct ${name} deployment bytecode`);
    }

    const transaction = await provider.getTransaction(record.transactionHash);
    if (!transaction) throw new Error(`Missing deployment transaction for ${name}`);
    if (transaction.to !== null) throw new Error(`${name} transaction was not contract creation`);
    if (normalized(transaction.from) !== gasOnlyDeployer) {
      throw new Error(`${name} was deployed by ${transaction.from}, not the gas-only signer`);
    }
    if (transaction.nonce !== expectedNonce) {
      throw new Error(`${name} transaction nonce is ${transaction.nonce}; expected ${expectedNonce}`);
    }
    if (transaction.value !== 0n) throw new Error(`${name} deployment unexpectedly transferred value`);
    if (transaction.data.toLowerCase() !== expectedDeploy.data.toLowerCase()) {
      throw new Error(`${name} transaction input does not match locally compiled constructor bytecode`);
    }

    const receipt = await provider.getTransactionReceipt(record.transactionHash);
    if (!receipt || receipt.status !== 1) throw new Error(`${name} deployment did not succeed`);
    if (receipt.blockNumber !== record.blockNumber) {
      throw new Error(`${name} block is ${receipt.blockNumber}; manifest records ${record.blockNumber}`);
    }
    if (record.blockNumber <= previousDeploymentBlock) {
      throw new Error(
        `${name} block ${record.blockNumber} is not later than the prior deployment block ${previousDeploymentBlock}`,
      );
    }
    previousDeploymentBlock = record.blockNumber;
    if (!receipt.contractAddress) throw new Error(`${name} receipt has no contract address`);
    requireAddress(`${name} receipt address`, receipt.contractAddress, record.address);

    const runtimeCode = await provider.getCode(record.address);
    if (runtimeCode === "0x") throw new Error(`${name} has no runtime code`);
    const runtimeHash = ethers.keccak256(runtimeCode);
    if (runtimeHash !== record.runtimeCodeHash) {
      throw new Error(`${name} runtime is ${runtimeHash}; manifest records ${record.runtimeCodeHash}`);
    }
    if ((runtimeCode.length - 2) / 2 !== record.runtimeCodeBytes) {
      throw new Error(`${name} runtime byte count does not match its manifest record`);
    }

    const simulationBlock = record.blockNumber - 1;
    if (simulationBlock < 0) {
      throw new Error(`${name} has no valid historical pre-deployment block`);
    }
    if ((await provider.getCode(record.address, simulationBlock)) !== "0x") {
      throw new Error(`${name} deterministic address already contained code before deployment`);
    }
    const historicalNonce = await provider.getTransactionCount(
      manifest.gasOnlyDeployer,
      simulationBlock,
    );
    if (historicalNonce !== expectedNonce) {
      throw new Error(
        `${name} cannot be re-simulated at its exact CREATE nonce: block ${simulationBlock} has deployer nonce ${historicalNonce}, expected ${expectedNonce}`,
      );
    }
    const simulatedRuntime = await provider.call({
      from: manifest.gasOnlyDeployer,
      data: expectedDeploy.data,
      blockTag: simulationBlock,
    });
    if (ethers.keccak256(simulatedRuntime) !== runtimeHash) {
      throw new Error(`${name} runtime does not match a local constructor simulation`);
    }
  }
}

export async function verifyReplacementManifest(
  uncheckedManifest: ReplacementManifest,
  hardhatEthers: HardhatEthers,
  provider: Provider = hardhatEthers.provider,
): Promise<void> {
  const plan = validateReplacementPlan(uncheckedManifest);
  const manifest = { ...uncheckedManifest, ...plan };
  const network = await provider.getNetwork();
  if (network.chainId.toString() !== manifest.chainId) {
    throw new Error(`Manifest chain is ${manifest.chainId}; connected chain is ${network.chainId}`);
  }
  if (isImmutableDisposableTestnetProfile(manifest)) {
    await verifyImmutableTestnetAuthorityPrecompile(provider);
  }
  const gasOnlyDeployer = ethers.getAddress(manifest.gasOnlyDeployer);
  if (isImmutableDisposableTestnetProfile(manifest)) {
    if (normalized(gasOnlyDeployer) !== normalized(manifest.treasury)) {
      throw new Error("Disposable testnet deployment signer must exactly match the authorised treasury");
    }
  } else {
    requireFreshIncidentSafeAddress("Gas-only deployer", gasOnlyDeployer);
    if (normalized(gasOnlyDeployer) === normalized(manifest.treasury)) {
      throw new Error("Production gas-only deployer must not be the treasury");
    }
  }
  if (normalized(gasOnlyDeployer) === normalized(manifest.controller)) {
    throw new Error("Deployment signer must never be the controller");
  }
  if ((await provider.getCode(gasOnlyDeployer)) !== "0x") {
    throw new Error("Gas-only deployer must be a plain externally owned account");
  }
  if (!Number.isSafeInteger(manifest.startingNonce) || manifest.startingNonce < 0) {
    throw new Error("Manifest starting nonce is invalid");
  }
  if (!isImmutableDisposableTestnetProfile(manifest) && manifest.startingNonce !== 0) {
    throw new Error("Production gas-only deployer must be a fresh nonce-zero EOA");
  }
  if (!Number.isSafeInteger(manifest.confirmations) || manifest.confirmations < 1 || manifest.confirmations > 64) {
    throw new Error("Manifest confirmation count is invalid");
  }
  if (!Number.isSafeInteger(manifest.verifiedAtBlock) || manifest.verifiedAtBlock <= 0) {
    throw new Error("Manifest verification block is invalid");
  }
  if (!ethers.isHexString(manifest.planHash, 32)) {
    throw new Error("Manifest plan hash must be a bytes32 value");
  }
  requireSha256("Manifest buildAttestationSha256", manifest.buildAttestationSha256);
  if (!/^[0-9a-f]{40}$/.test(manifest.buildSourceCommit)) {
    throw new Error("Manifest buildSourceCommit must be a full lower-case Git commit hash");
  }
  const currentBuild = verifyReplacementBuildAttestation();
  if (
    manifest.buildAttestationSha256 !== currentBuild.attestationSha256 ||
    manifest.buildSourceCommit !== currentBuild.sourceCommit ||
    manifest.deploymentProfile !== currentBuild.deploymentProfile ||
    currentBuild.planPath !== replacementPlanRelativePath(manifest.deploymentProfile)
  ) {
    throw new Error("Manifest build profile or provenance differs from the reviewed local build attestation");
  }
  const reviewedPlanRaw = readBuildFile(currentBuild.planPath).toString("utf8");
  const reviewedPlan = validateReplacementPlan(JSON.parse(reviewedPlanRaw) as ReplacementPlan);
  if (manifest.planHash !== ethers.keccak256(ethers.toUtf8Bytes(reviewedPlanRaw))) {
    throw new Error("Manifest plan hash differs from the source-pinned profile plan");
  }
  if (
    JSON.stringify({
      kind: manifest.kind,
      schemaVersion: manifest.schemaVersion,
      chainId: manifest.chainId,
      deploymentProfile: manifest.deploymentProfile,
      controller: manifest.controller,
      treasury: manifest.treasury,
      parameters: manifest.parameters,
    }) !== JSON.stringify(reviewedPlan)
  ) {
    throw new Error("Manifest plan fields differ from the source-pinned profile plan");
  }

  const expectedLegacy = pinnedLegacyRecovery();
  if (JSON.stringify(manifest.legacyRecovery) !== JSON.stringify(expectedLegacy)) {
    throw new Error("Manifest legacy recovery anchors differ from the reviewed source inventory");
  }
  await verifyPinnedLegacyRuntime(provider);

  const records = recordMap(manifest);
  const deployedAddresses = new Set<string>();
  const legacyAddresses = new Set(
    Object.values(manifest.legacyRecovery.addresses).map(normalized),
  );
  for (const name of DEPLOYMENT_ORDER) {
    const address = normalized(records.get(name)!.address);
    if (deployedAddresses.has(address)) throw new Error(`Duplicate deployment address ${address}`);
    if (legacyAddresses.has(address)) {
      throw new Error(`${name} unexpectedly resolves to a legacy recovery address ${address}`);
    }
    deployedAddresses.add(address);
  }
  await verifyDeploymentTransactions(manifest, hardhatEthers, provider, records);

  if (!isImmutableDisposableTestnetProfile(manifest)) {
    const earliestDeploymentBlock = Math.min(
      ...manifest.deployments.map((deployment) => deployment.blockNumber),
    );
    if (!Number.isSafeInteger(earliestDeploymentBlock) || earliestDeploymentBlock <= 1) {
      throw new Error("Production replacement deployments do not identify a valid pre-deployment authority checkpoint");
    }
    const authorityCheckpointBlock = earliestDeploymentBlock - 1;
    for (const [label, address] of [
      ["Production controller", manifest.controller],
      ["Production treasury", manifest.treasury],
    ] as const) {
      if (deployedAddresses.has(normalized(address))) {
        throw new Error(`${label} must not overlap a replacement deployment address`);
      }
      if ((await provider.getCode(address, authorityCheckpointBlock)) === "0x") {
        throw new Error(
          `${label} must be a contract authority that existed before replacement deployment; verify its multisig owners and threshold separately`,
        );
      }
      if ((await provider.getCode(address)) === "0x") {
        throw new Error(`${label} must still be a deployed contract authority at verification time`);
      }
    }
  }

  const connectProvider = <T extends { connect(runner: Provider): unknown }>(contract: T): T => (
    contract.connect(provider) as T
  );
  const wrappedNative = connectProvider(await hardhatEthers.getContractAt("WETH9", addressOf(records, "WrappedZkLTC")));
  const factory = connectProvider(await hardhatEthers.getContractAt("UniswapV2Factory", addressOf(records, "UniswapV2Factory")));
  const router = connectProvider(await hardhatEthers.getContractAt("UniswapV2Router02", addressOf(records, "UniswapV2Router02")));
  const connector = connectProvider(await hardhatEthers.getContractAt("UniSwapConnector", addressOf(records, "UniSwapConnector")));
  const tokenFactory = connectProvider(await hardhatEthers.getContractAt("TokenFactory", addressOf(records, "TokenFactory")));
  const vestingFactory = connectProvider(await hardhatEthers.getContractAt("VestingFactory", addressOf(records, "VestingFactory")));
  const liquidityLocker = connectProvider(await hardhatEthers.getContractAt("LiquidityLocker", addressOf(records, "LiquidityLocker")));
  const ledger = connectProvider(await hardhatEthers.getContractAt("TheLedger", addressOf(records, "TheLedger")));
  const disperse = connectProvider(await hardhatEthers.getContractAt("Disperse", addressOf(records, "Disperse")));
  const iloFactory = connectProvider(await hardhatEthers.getContractAt("ILOFactory", addressOf(records, "ILOFactory")));
  const governanceToken = connectProvider(await hardhatEthers.getContractAt("LitGovToken", addressOf(records, "LitGovToken")));
  const governanceTimelock = connectProvider(await hardhatEthers.getContractAt("LitTimelock", addressOf(records, "LitTimelock")));
  const governanceGovernor = connectProvider(await hardhatEthers.getContractAt("LitGovernor", addressOf(records, "LitGovernor")));
  const initialGovernanceHolder = governanceInitialHolder(manifest);
  const deploymentSignerMayReceiveFees = isImmutableDisposableTestnetProfile(manifest);

  requireAddress("DEX fee controller", await factory.feeToSetter(), manifest.controller);
  requireAddress("DEX fee treasury", await factory.feeTo(), manifest.treasury);
  requireAddress("DEX recorded deployment signer", await factory.deploymentSigner(), manifest.gasOnlyDeployer);
  requireBoolean(
    "DEX deployment-signer fee-recipient profile",
    await factory.deploymentSignerMayReceiveFees(),
    deploymentSignerMayReceiveFees,
  );
  requireAddress("Router factory", await router.factory(), await factory.getAddress());
  requireAddress("Router wrapped native", await router.WETH(), await wrappedNative.getAddress());
  requireUint("Router initial swap-action count", await router.totalSwapCount(), "0");
  requireAddress("Connector router", await connector.router(), await router.getAddress());
  requireAddress("Connector factory", await connector.factory(), await factory.getAddress());
  requireAddress("Connector treasury", await connector.treasury(), manifest.treasury);
  requireAddress("Connector controller", await connector.controller(), manifest.controller);
  requireAddress("Connector wrapped native", await connector.wrappedNative(), await wrappedNative.getAddress());
  requireAddress("Connector recorded deployment signer", await connector.deploymentSigner(), manifest.gasOnlyDeployer);
  requireBoolean(
    "Connector deployment-signer fee-recipient profile",
    await connector.deploymentSignerMayReceiveFees(),
    deploymentSignerMayReceiveFees,
  );
  await connector.assertTreasuryRouting();

  for (const [label, contract] of [
    ["TokenFactory", tokenFactory],
    ["VestingFactory", vestingFactory],
    ["LiquidityLocker", liquidityLocker],
    ["TheLedger", ledger],
    ["ILOFactory", iloFactory],
  ] as const) {
    requireAddress(`${label} owner`, await contract.owner(), manifest.controller);
    requireAddress(`${label} recorded deployment signer`, await contract.deploymentSigner(), manifest.gasOnlyDeployer);
    requireBoolean(
      `${label} deployment-signer fee-recipient profile`,
      await contract.deploymentSignerMayReceiveFees(),
      deploymentSignerMayReceiveFees,
    );
  }
  for (const [label, contract] of [
    ["TokenFactory", tokenFactory],
    ["VestingFactory", vestingFactory],
    ["LiquidityLocker", liquidityLocker],
    ["TheLedger", ledger],
    ["ILOFactory", iloFactory],
  ] as const) {
    requireAddress(`${label} treasury`, await contract.treasury(), manifest.treasury);
  }

  requireUint("TokenFactory creation fee", await tokenFactory.creationFee(), manifest.parameters.tokenCreationFee);
  requireUint(
    "TokenFactory initial contract CREATE nonce",
    BigInt(await provider.getTransactionCount(await tokenFactory.getAddress())),
    "1",
  );
  requireUint("VestingFactory fee", await vestingFactory.vestingFee(), manifest.parameters.vestingFee);
  requireUint("LiquidityLocker fee", await liquidityLocker.lockFee(), manifest.parameters.lockFee);
  requireUint("TheLedger minimum fee", await ledger.MIN_FEE(), manifest.parameters.ledgerMinFee);
  requireUint("TheLedger treasury cut", await ledger.treasuryCutBps(), manifest.parameters.ledgerTreasuryCutBps);
  requireUint("TheLedger initial message count", await ledger.messageCount(), "0");
  requireUint("Disperse maximum recipients", await disperse.MAX_RECIPIENTS(), "200");
  requireUint("Disperse initial recipient-entry count", await disperse.totalRecipientEntries(), "0");
  requireAddress("ILOFactory router", await iloFactory.router(), await router.getAddress());
  requireAddress("ILOFactory connector", await iloFactory.connector(), await connector.getAddress());
  requireAddress("ILOFactory DEX factory", await iloFactory.dexFactory(), await factory.getAddress());
  requireUint("ILOFactory platform fee", await iloFactory.platformFeeBps(), manifest.parameters.iloPlatformFeeBps);
  requireUint("ILOFactory creation fee", await iloFactory.creationFee(), manifest.parameters.iloCreationFee);
  requireUint("ILOFactory initial child count", await iloFactory.getILOCount(), "0");

  requireAddress(
    "Governance token owner",
    await governanceToken.owner(),
    await governanceTimelock.getAddress(),
  );
  requireAddress(
    "Governance token initial holder",
    await governanceToken.initialHolder(),
    initialGovernanceHolder,
  );
  requireString("Governance token name", await governanceToken.name(), "Lit Governance Token");
  requireString("Governance token symbol", await governanceToken.symbol(), "LGT");
  requireUint("Governance token decimals", await governanceToken.decimals(), "18");
  const governanceDomain = await governanceToken.eip712Domain();
  requireString("Governance EIP-712 domain name", governanceDomain.name, "Lit Governance Token");
  requireString("Governance EIP-712 domain version", governanceDomain.version, "1");
  requireUint("Governance EIP-712 domain chain", governanceDomain.chainId, manifest.chainId);
  requireAddress(
    "Governance EIP-712 verifying contract",
    governanceDomain.verifyingContract,
    await governanceToken.getAddress(),
  );
  requireString("Governance EIP-712 domain fields", governanceDomain.fields, "0x0f");
  requireString("Governance EIP-712 domain salt", governanceDomain.salt, ethers.ZeroHash);
  if (governanceDomain.extensions.length !== 0) {
    throw new Error("Governance EIP-712 domain unexpectedly declares extensions");
  }
  requireAddress(
    "Governance token recorded deployment signer",
    await governanceToken.deploymentSigner(),
    manifest.gasOnlyDeployer,
  );
  requireUint(
    "Governance token initial-supply constant",
    await governanceToken.INITIAL_SUPPLY(),
    manifest.parameters.governanceInitialSupply,
  );
  requireUint(
    "Governance token initial total supply",
    await governanceToken.totalSupply(),
    manifest.parameters.governanceInitialSupply,
  );
  requireUint(
    "Governance initial-holder balance",
    await governanceToken.balanceOf(initialGovernanceHolder),
    manifest.parameters.governanceInitialSupply,
  );
  requireUint(
    "Governance initial-holder votes",
    await governanceToken.getVotes(initialGovernanceHolder),
    manifest.parameters.governanceInitialSupply,
  );
  requireAddress(
    "Governance initial-holder delegate",
    await governanceToken.delegates(initialGovernanceHolder),
    initialGovernanceHolder,
  );
  requireUint(
    "Gas-only deployer governance-token balance",
    await governanceToken.balanceOf(manifest.gasOnlyDeployer),
    "0",
  );
  requireUint(
    "Gas-only deployer governance votes",
    await governanceToken.getVotes(manifest.gasOnlyDeployer),
    "0",
  );

  requireAddress(
    "Timelock Governor",
    await governanceTimelock.governor(),
    await governanceGovernor.getAddress(),
  );
  requireAddress(
    "Timelock emergency canceller",
    await governanceTimelock.emergencyCanceller(),
    manifest.controller,
  );
  requireAddress(
    "Timelock recorded deployment signer",
    await governanceTimelock.deploymentSigner(),
    manifest.gasOnlyDeployer,
  );
  requireUint(
    "Governance timelock delay",
    await governanceTimelock.getMinDelay(),
    manifest.parameters.governanceTimelockDelay,
  );

  const defaultAdminRole = await governanceTimelock.DEFAULT_ADMIN_ROLE();
  const proposerRole = await governanceTimelock.PROPOSER_ROLE();
  const executorRole = await governanceTimelock.EXECUTOR_ROLE();
  const cancellerRole = await governanceTimelock.CANCELLER_ROLE();
  for (const [label, role] of [
    ["DEFAULT_ADMIN_ROLE", defaultAdminRole],
    ["PROPOSER_ROLE", proposerRole],
    ["EXECUTOR_ROLE", executorRole],
    ["CANCELLER_ROLE", cancellerRole],
  ] as const) {
    if ((await governanceTimelock.getRoleAdmin(role)) !== defaultAdminRole) {
      throw new Error(`Timelock ${label} is not administered by DEFAULT_ADMIN_ROLE`);
    }
  }

  const roleCandidates = [
    manifest.gasOnlyDeployer,
    manifest.controller,
    manifest.treasury,
    await governanceToken.getAddress(),
    await governanceTimelock.getAddress(),
    await governanceGovernor.getAddress(),
    ethers.ZeroAddress,
  ];
  const expectedRoleHolders = new Map<string, Set<string>>([
    [defaultAdminRole, new Set([normalized(await governanceTimelock.getAddress())])],
    [proposerRole, new Set([normalized(await governanceGovernor.getAddress())])],
    [executorRole, new Set([normalized(await governanceGovernor.getAddress())])],
    [cancellerRole, new Set([normalized(manifest.controller)])],
  ]);
  for (const [label, role] of [
    ["DEFAULT_ADMIN_ROLE", defaultAdminRole],
    ["PROPOSER_ROLE", proposerRole],
    ["EXECUTOR_ROLE", executorRole],
    ["CANCELLER_ROLE", cancellerRole],
  ] as const) {
    const expectedHolders = expectedRoleHolders.get(role)!;
    for (const candidate of roleCandidates) {
      const expected = expectedHolders.has(normalized(candidate));
      const actual = await governanceTimelock.hasRole(role, candidate);
      if (actual !== expected) {
        throw new Error(
          `Timelock ${label} membership for ${candidate} is ${actual}; expected ${expected}`,
        );
      }
    }
  }

  requireAddress(
    "Governor voting token",
    await governanceGovernor.token(),
    await governanceToken.getAddress(),
  );
  requireAddress(
    "Governor timelock",
    await governanceGovernor.timelock(),
    await governanceTimelock.getAddress(),
  );
  requireAddress(
    "Governor recorded deployment signer",
    await governanceGovernor.deploymentSigner(),
    manifest.gasOnlyDeployer,
  );
  requireUint(
    "Governor voting delay",
    await governanceGovernor.votingDelay(),
    manifest.parameters.governanceVotingDelay,
  );
  requireUint(
    "Governor voting period",
    await governanceGovernor.votingPeriod(),
    manifest.parameters.governanceVotingPeriod,
  );
  requireUint(
    "Governor proposal threshold",
    await governanceGovernor.proposalThreshold(),
    manifest.parameters.governanceProposalThreshold,
  );
  requireUint(
    "Governor quorum basis points",
    await governanceGovernor.quorumBps_(),
    manifest.parameters.governanceQuorumBps,
  );
  requireUint("Governor initial proposal count", await governanceGovernor.proposalCount(), "0");

  const verifierBlock = await provider.getBlockNumber();
  const latestDeploymentBlock = Math.max(
    ...manifest.deployments.map((deployment) => deployment.blockNumber),
  );
  const requiredFinalityBlock = latestDeploymentBlock + manifest.confirmations - 1;
  if (manifest.verifiedAtBlock < latestDeploymentBlock) {
    throw new Error("Manifest verification block predates a replacement deployment");
  }
  if (manifest.verifiedAtBlock < requiredFinalityBlock) {
    throw new Error(
      `Manifest verification block does not prove ${manifest.confirmations} confirmations for every deployment`,
    );
  }
  if (verifierBlock < manifest.verifiedAtBlock) {
    throw new Error(`Connected node is behind manifest verification block ${manifest.verifiedAtBlock}`);
  }
}

export function parseReplacementManifest(raw: string): ReplacementManifest {
  const parsed = JSON.parse(raw) as ReplacementManifest;
  if (!parsed || typeof parsed !== "object") throw new Error("Replacement manifest must be an object");
  return parsed;
}
