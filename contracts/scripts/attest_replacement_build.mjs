import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const contractsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const planPathsByProfile = Object.freeze({
  "production-separated-authority": "deployment/post-compromise-plan.json",
  "testnet-immutable-disposable": "deployment/disposable-testnet-plan.json",
});
const deploymentProfile = process.env.REPLACEMENT_DEPLOYMENT_PROFILE;
const planRelativePath = planPathsByProfile[deploymentProfile];
if (!planRelativePath) {
  throw new Error(
    "REPLACEMENT_DEPLOYMENT_PROFILE must select production-separated-authority or testnet-immutable-disposable",
  );
}
const planPath = resolve(contractsRoot, planRelativePath);
const selectedPlan = JSON.parse(readFileSync(planPath, "utf8"));
if (selectedPlan.deploymentProfile !== deploymentProfile || selectedPlan.chainId !== "4441") {
  throw new Error("Selected deployment plan does not match the requested profile and LitVM chain");
}
const inputPaths = [
  "package.json",
  "package-lock.json",
  ".npmrc",
  "hardhat.config.ts",
  planRelativePath,
];

const artifacts = [
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
];

const compilerVersions = [
  ["0.5.16", "EXPECTED_SOLC_0_5_16_SHA256"],
  ["0.6.6", "EXPECTED_SOLC_0_6_6_SHA256"],
  ["0.8.24", "EXPECTED_SOLC_0_8_24_SHA256"],
];
const nodeModulesTreeFormat = "lester-labs-node-modules-tree-v1";
const factoryResetMacAcknowledgement =
  "USE_FACTORY_RESET_MAC_FOR_VALUELESS_DISPOSABLE_TESTNET_ONLY";

function sha256(data) {
  return `0x${createHash("sha256").update(data).digest("hex")}`;
}

function requireSha256Environment(name) {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${name} must be an independently reviewed lower-case SHA-256 value`);
  }
  return value;
}

function readRequired(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing required build input: ${filePath}`);
  return readFileSync(filePath);
}

function requireAbsoluteDirectory(name) {
  const value = process.env[name];
  if (!value || !isAbsolute(value) || !existsSync(value)) {
    throw new Error(`${name} must identify an existing absolute directory`);
  }
  const resolved = resolve(value);
  const stat = lstatSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`${name} must be a real directory, not a symlink or file`);
  }
  if ((stat.mode & 0o077) !== 0) {
    throw new Error(`${name} must not grant group or other permissions`);
  }
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error(`${name} must be owned by the unprivileged build user`);
  }
  return resolved;
}

function isInside(parent, candidate) {
  const child = relative(parent, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function updateLengthPrefixed(hash, value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(buffer.length));
  hash.update(length);
  hash.update(buffer);
}

function digestReadOnlyNodeModulesTree() {
  const treeRoot = resolve(contractsRoot, "node_modules");
  const rootStat = lstatSync(treeRoot);
  if (!rootStat.isDirectory()) {
    throw new Error("node_modules must be a real directory, not a symlink or special file");
  }
  const realTreeRoot = realpathSync(treeRoot);
  const records = [{ absolutePath: treeRoot, relativePath: ".", stat: rootStat }];

  function collect(directory, relativeDirectory) {
    const names = readdirSync(directory).sort((left, right) =>
      Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
    );
    for (const name of names) {
      const absolutePath = resolve(directory, name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const stat = lstatSync(absolutePath);
      records.push({ absolutePath, relativePath, stat });
      if (stat.isDirectory()) collect(absolutePath, relativePath);
    }
  }

  collect(treeRoot, "");
  records.sort((left, right) =>
    Buffer.compare(Buffer.from(left.relativePath, "utf8"), Buffer.from(right.relativePath, "utf8"))
  );

  const hash = createHash("sha256");
  updateLengthPrefixed(hash, nodeModulesTreeFormat);
  for (const record of records) {
    const mode = record.stat.mode & 0o7777;
    let type;
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
      payload = readFileSync(record.absolutePath);
    } else if (record.stat.isSymbolicLink()) {
      type = "symlink";
      const target = readlinkSync(record.absolutePath);
      const resolvedTarget = realpathSync(record.absolutePath);
      if (!isInside(realTreeRoot, resolvedTarget)) {
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

if (typeof process.getuid !== "function" || process.getuid() === 0) {
  throw new Error("Replacement attestation must run as an unprivileged non-root user");
}
const isReviewedLinuxRunner = process.platform === "linux" && process.arch === "x64";
const isFactoryResetDarwinDisposable =
  deploymentProfile === "testnet-immutable-disposable" &&
  process.platform === "darwin" &&
  (process.arch === "arm64" || process.arch === "x64");
if (deploymentProfile === "production-separated-authority" && !isReviewedLinuxRunner) {
  throw new Error(
    "Production replacement attestation requires an unprivileged x64 Linux ephemeral runner",
  );
}
if (!isReviewedLinuxRunner && !isFactoryResetDarwinDisposable) {
  throw new Error(
    "Replacement attestation requires x64 Linux, except for the narrowly authorised valueless disposable-testnet Darwin workflow",
  );
}
if (
  isReviewedLinuxRunner &&
  process.env.REPLACEMENT_TRUSTED_EPHEMERAL_BUILD !== "true"
) {
  throw new Error("Linux attestation requires an independently trusted ephemeral build runner");
}
if (
  isFactoryResetDarwinDisposable &&
  process.env[factoryResetMacAcknowledgement] !== "true"
) {
  throw new Error(
    `${factoryResetMacAcknowledgement}=true is required to attest only the valueless immutable disposable testnet profile on a factory-reset Mac`,
  );
}
if (process.env.REPLACEMENT_NETWORK_DISABLED !== "true") {
  throw new Error("Attestation requires an independently enforced outbound-network-disabled build");
}
const buildEnvironmentKind = isFactoryResetDarwinDisposable
  ? "factory-reset-darwin-disposable"
  : "trusted-ephemeral-linux";

const buildHome = requireAbsoluteDirectory("REPLACEMENT_BUILD_HOME");
const buildTmp = requireAbsoluteDirectory("REPLACEMENT_BUILD_TMPDIR");
if (isInside(contractsRoot, buildHome) || isInside(contractsRoot, buildTmp)) {
  throw new Error("Private build state and TMPDIR must be outside the source checkout");
}
if (buildHome === buildTmp || isInside(buildHome, buildTmp) || isInside(buildTmp, buildHome)) {
  throw new Error("Build state and TMPDIR must be separate private directories");
}
const configuredOutput = process.env.REPLACEMENT_BUILD_ATTESTATION_OUTPUT;
if (!configuredOutput || !isAbsolute(configuredOutput)) {
  throw new Error("REPLACEMENT_BUILD_ATTESTATION_OUTPUT must be an absolute external release path");
}
const outputPath = resolve(configuredOutput);
if (isInside(contractsRoot, outputPath)) {
  throw new Error("Build attestation is an external release artifact and must not be written into the checkout");
}
if (!existsSync(dirname(outputPath)) || existsSync(outputPath)) {
  throw new Error("External attestation directory must exist and the output file must not already exist");
}
const outputDirectoryStat = lstatSync(dirname(outputPath));
if (!outputDirectoryStat.isDirectory() || (outputDirectoryStat.mode & 0o022) !== 0) {
  throw new Error("External attestation directory must be a real directory with no group/other write access");
}
if (outputDirectoryStat.uid !== process.getuid()) {
  throw new Error("External attestation directory must be owned by the unprivileged build user");
}

const controlledPath = process.env.REPLACEMENT_BUILD_PATH;
if (
  !controlledPath ||
  controlledPath.split(":").some((entry) => !entry || !isAbsolute(entry))
) {
  throw new Error("REPLACEMENT_BUILD_PATH must be a colon-separated list of reviewed absolute paths");
}

const nodeExecutableSha256 = sha256(readRequired(process.execPath));
if (nodeExecutableSha256 !== requireSha256Environment("EXPECTED_NODE_EXECUTABLE_SHA256")) {
  throw new Error("Node executable does not match its independently reviewed digest");
}

const projectPackage = JSON.parse(readRequired(resolve(contractsRoot, "package.json")).toString("utf8"));
const installedHardhatPackagePath = resolve(contractsRoot, "node_modules/hardhat/package.json");
const installedHardhatPackageRaw = readRequired(installedHardhatPackagePath);
const installedHardhatPackage = JSON.parse(installedHardhatPackageRaw.toString("utf8"));
const expectedHardhatVersion = projectPackage.devDependencies?.hardhat;
if (
  typeof expectedHardhatVersion !== "string" ||
  !/^\d+\.\d+\.\d+$/.test(expectedHardhatVersion) ||
  installedHardhatPackage.version !== expectedHardhatVersion
) {
  throw new Error("Installed Hardhat must exactly match the pinned project version");
}
const hardhatPackageSha256 = sha256(installedHardhatPackageRaw);
if (hardhatPackageSha256 !== requireSha256Environment("EXPECTED_HARDHAT_PACKAGE_SHA256")) {
  throw new Error("Hardhat package metadata does not match its independently reviewed digest");
}
const hardhatBinRelative =
  typeof installedHardhatPackage.bin === "string"
    ? installedHardhatPackage.bin
    : installedHardhatPackage.bin?.hardhat;
if (typeof hardhatBinRelative !== "string") {
  throw new Error("Installed Hardhat package does not expose its expected CLI");
}
const hardhatCliPath = resolve(dirname(installedHardhatPackagePath), hardhatBinRelative);
if (!isInside(dirname(installedHardhatPackagePath), hardhatCliPath)) {
  throw new Error("Hardhat CLI path escapes the reviewed package");
}
const hardhatCliSha256 = sha256(readRequired(hardhatCliPath));
if (hardhatCliSha256 !== requireSha256Environment("EXPECTED_HARDHAT_CLI_SHA256")) {
  throw new Error("Hardhat CLI does not match its independently reviewed digest");
}

const nativeCompilerPlatform = isReviewedLinuxRunner ? "linux-amd64" : "macosx-amd64";
const compilerCacheRoot = isReviewedLinuxRunner
  ? resolve(buildHome, ".cache/hardhat-nodejs/compilers-v3")
  : resolve(homedir(), "Library/Caches/hardhat-nodejs/compilers-v3");
const reviewedDarwinPlatformByVersion = Object.freeze({
  "0.5.16": "wasm",
  "0.6.6": "wasm",
  "0.8.24": "macosx-amd64",
});

function compilerEnvironmentToken(version) {
  return version.replaceAll(".", "_");
}

function compilerList(platform) {
  const platformRoot = resolve(compilerCacheRoot, platform);
  if (!isInside(compilerCacheRoot, platformRoot)) {
    throw new Error(`Hardhat compiler platform escapes its reviewed cache: ${platform}`);
  }
  const listPath = resolve(platformRoot, "list.json");
  const listStat = lstatSync(listPath);
  if (!listStat.isFile() || listStat.isSymbolicLink()) {
    throw new Error(`Hardhat ${platform} compiler list must be a regular non-symlink file`);
  }
  const listRaw = readRequired(listPath);
  const listSha256 = sha256(listRaw);
  const expectedListEnvironment = isReviewedLinuxRunner
    ? "EXPECTED_SOLC_COMPILER_LIST_SHA256"
    : `EXPECTED_SOLC_${platform.toUpperCase().replaceAll("-", "_")}_COMPILER_LIST_SHA256`;
  if (listSha256 !== requireSha256Environment(expectedListEnvironment)) {
    throw new Error(
      `Hardhat ${platform} compiler list does not match its independently reviewed digest`,
    );
  }
  return {
    platformRoot,
    list: JSON.parse(listRaw.toString("utf8")),
    listSha256,
  };
}

function officialCompilerBuild(version, platform, platformList) {
  const build = platformList.list.builds?.find((candidate) => candidate.version === version);
  if (
    !build ||
    typeof build.path !== "string" ||
    build.path.includes("/") ||
    build.path.includes("\\") ||
    build.path.includes("..") ||
    platformList.list.releases?.[version] !== build.path ||
    typeof build.longVersion !== "string" ||
    !/^0x[0-9a-f]{64}$/.test(build.keccak256)
  ) {
    throw new Error(
      `Clean ${platform} compiler cache does not contain a valid official solc ${version} entry`,
    );
  }
  const compilerPath = resolve(platformList.platformRoot, build.path);
  if (!isInside(platformList.platformRoot, compilerPath)) {
    throw new Error(`solc ${version} is outside the reviewed ${platform} cache`);
  }
  return { build, compilerPath };
}

const nativeCompilerList = compilerList(nativeCompilerPlatform);
const compilers = compilerVersions.map(([version, digestEnvironment]) => {
  const native = officialCompilerBuild(version, nativeCompilerPlatform, nativeCompilerList);
  const markerPath = `${native.compilerPath}.does.not.work`;
  const nativeMarkedDoesNotWork = existsSync(markerPath);
  let selectedPlatform = nativeCompilerPlatform;
  let selectedCompilerList = nativeCompilerList;
  let selected = native;
  let selection = "native";
  let nativeDoesNotWorkMarkerSha256 = null;

  if (nativeMarkedDoesNotWork) {
    if (!isFactoryResetDarwinDisposable) {
      throw new Error(`Native solc ${version} is marked unusable on the production Linux runner`);
    }
    if (reviewedDarwinPlatformByVersion[version] !== "wasm") {
      throw new Error(`Unreviewed Darwin WASM fallback requested for solc ${version}`);
    }
    const markerStat = lstatSync(markerPath);
    if (!markerStat.isFile() || markerStat.isSymbolicLink()) {
      throw new Error(`Native solc ${version} unusable marker must be a regular file`);
    }
    nativeDoesNotWorkMarkerSha256 = sha256(readRequired(markerPath));
    const markerEnvironment =
      `EXPECTED_SOLC_${compilerEnvironmentToken(version)}_DOES_NOT_WORK_MARKER_SHA256`;
    if (nativeDoesNotWorkMarkerSha256 !== requireSha256Environment(markerEnvironment)) {
      throw new Error(
        `Native solc ${version} unusable marker does not match its independently reviewed digest`,
      );
    }
    selectedPlatform = "wasm";
    selectedCompilerList = compilerList("wasm");
    selected = officialCompilerBuild(version, selectedPlatform, selectedCompilerList);
    selection = "reviewed-wasm-fallback";
  } else if (
    isFactoryResetDarwinDisposable &&
    reviewedDarwinPlatformByVersion[version] !== nativeCompilerPlatform
  ) {
    throw new Error(
      `Darwin solc ${version} was expected to use a reviewed WASM fallback, but its native unusable marker is absent`,
    );
  }

  const selectedCompilerStat = lstatSync(selected.compilerPath);
  if (!selectedCompilerStat.isFile() || selectedCompilerStat.isSymbolicLink()) {
    throw new Error(`Selected solc ${version} compiler must be a regular non-symlink file`);
  }
  const compilerSha256 = sha256(readRequired(selected.compilerPath));
  if (compilerSha256 !== requireSha256Environment(digestEnvironment)) {
    throw new Error(`Selected solc ${version} compiler does not match its reviewed digest`);
  }
  return {
    version,
    longVersion: selected.build.longVersion,
    platform: selectedPlatform,
    filename: selected.build.path,
    isSolcJs: selectedPlatform === "wasm",
    sha256: compilerSha256,
    registryKeccak256: selected.build.keccak256,
    compilerListSha256: selectedCompilerList.listSha256,
    selection,
    nativePlatform: nativeCompilerPlatform,
    nativeCompilerListSha256: nativeCompilerList.listSha256,
    nativeFilename: native.build.path,
    nativeMarkedDoesNotWork,
    nativeDoesNotWorkMarkerSha256,
  };
});

const gitExecutable = "/usr/bin/git";
const gitExecutableSha256 = sha256(readRequired(gitExecutable));
if (gitExecutableSha256 !== requireSha256Environment("EXPECTED_REPLACEMENT_GIT_EXECUTABLE_SHA256")) {
  throw new Error("Git executable does not match its independently reviewed digest");
}
const gitEnvironment = {
  PATH: controlledPath,
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
  { cwd: contractsRoot, env: gitEnvironment, encoding: "utf8" },
).trim();
if (resolve(repositoryRoot) !== resolve(contractsRoot, "..")) {
  throw new Error("Build attestation must run from the reviewed repository root");
}

function requireCanonicalGitIndex(stage) {
  const trackedEntries = execFileSync(
    gitExecutable,
    [...gitArguments, "ls-files", "-v", "-z"],
    { cwd: contractsRoot, env: gitEnvironment, encoding: "utf8" },
  ).split("\0").filter(Boolean);
  const hiddenEntry = trackedEntries.find((entry) => !entry.startsWith("H "));
  if (hiddenEntry) {
    throw new Error(
      `${stage} Git index contains assume-unchanged, skip-worktree, unmerged, or otherwise hidden state`,
    );
  }

  const stagedEntries = execFileSync(
    gitExecutable,
    [...gitArguments, "ls-files", "--stage", "-z"],
    { cwd: contractsRoot, env: gitEnvironment, encoding: "utf8" },
  ).split("\0").filter(Boolean);
  if (stagedEntries.some((entry) => entry.startsWith("160000 "))) {
    throw new Error(`${stage} Git index contains a submodule, which is not an attested package source`);
  }
}

requireCanonicalGitIndex("Pre-build");
const status = execFileSync(
  gitExecutable,
  [...gitArguments, "status", "--porcelain=v1", "--untracked-files=all"],
  { cwd: contractsRoot, env: gitEnvironment, encoding: "utf8" },
);
if (status.trim()) throw new Error("Build attestation requires a clean reviewed worktree");
const sourceCommit = execFileSync(
  gitExecutable,
  [...gitArguments, "rev-parse", "HEAD"],
  { cwd: contractsRoot, env: gitEnvironment, encoding: "utf8" },
).trim();
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error("Source commit must resolve to a full lower-case Git commit hash");
}
const nodeModulesTreeSha256 = digestReadOnlyNodeModulesTree();

const buildEnvironment = {
  XDG_CACHE_HOME: resolve(buildHome, ".cache"),
  PATH: controlledPath,
  TMPDIR: buildTmp,
  LANG: "C",
  LC_ALL: "C",
  REPLACEMENT_CREDENTIAL_FREE_BUILD: "true",
  HARDHAT_DISABLE_TELEMETRY: "true",
  CI: "true",
};

function compile() {
  execFileSync(process.execPath, [hardhatCliPath, "compile", "--force"], {
    cwd: contractsRoot,
    env: buildEnvironment,
    stdio: "inherit",
  });
}

function requireBuildInfoId(label, value) {
  if (typeof value !== "string" || !/^solc-\d+_\d+_\d+-[0-9a-f]{40}$/.test(value)) {
    throw new Error(`${label} must contain a canonical Hardhat 3 buildInfoId`);
  }
  return value;
}

function buildInfoFiles(buildInfoId) {
  const buildInfoPath = `artifacts/build-info/${buildInfoId}.json`;
  const buildInfoOutputPath = `artifacts/build-info/${buildInfoId}.output.json`;
  return {
    buildInfoPath,
    buildInfoOutputPath,
    buildInfoRaw: readRequired(resolve(contractsRoot, buildInfoPath)),
    buildInfoOutputRaw: readRequired(resolve(contractsRoot, buildInfoOutputPath)),
  };
}

function compilerOutputContract(outputDocument, sourceName, contractName) {
  const compilerOutput = outputDocument?.output ?? outputDocument;
  const contractOutput = compilerOutput?.contracts?.[sourceName]?.[contractName];
  if (!contractOutput || typeof contractOutput !== "object") {
    throw new Error(`Hardhat build output does not contain ${sourceName}:${contractName}`);
  }
  return contractOutput;
}

function deterministicExtractedArtifact(
  buildInfoId,
  sourceName,
  outputSourceName,
  contractName,
  outputDocument,
) {
  const contractOutput = compilerOutputContract(outputDocument, outputSourceName, contractName);
  if (!contractOutput || typeof contractOutput !== "object") {
    throw new Error(
      `Hardhat build output ${buildInfoId} does not contain ${sourceName}:${contractName}`,
    );
  }
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

function loadHardhat3Artifact(name, artifactPath) {
  const artifactAbsolute = resolve(contractsRoot, artifactPath);
  if (existsSync(artifactAbsolute)) {
    const artifactRaw = readRequired(artifactAbsolute);
    const artifact = JSON.parse(artifactRaw.toString("utf8"));
    const buildInfoId = requireBuildInfoId(`${artifactPath} buildInfoId`, artifact.buildInfoId);
    if (artifact._format !== "hh3-artifact-1") {
      throw new Error(`${artifactPath} is not a supported Hardhat 3 artifact`);
    }
    if (
      artifact.contractName !== name &&
      !(name === "WrappedZkLTC" && artifact.contractName === "WETH9")
    ) {
      throw new Error(`${artifactPath} does not contain the expected ${name} artifact`);
    }
    if (typeof artifact.sourceName !== "string" || typeof artifact.contractName !== "string") {
      throw new Error(`${artifactPath} has no canonical Hardhat 3 source/contract identity`);
    }
    return {
      artifactKind: "hardhat-3",
      artifactRaw,
      buildInfoId,
      sourceName: artifact.sourceName,
      contractName: artifact.contractName,
    };
  }
  if (name !== "VestingWallet") {
    throw new Error(`Missing required Hardhat 3 artifact: ${artifactPath}`);
  }

  // Hardhat 3 may omit an artifact for an npm dependency even when solc emitted
  // the dependency contract. Bind VestingWallet to the exact VestingFactory
  // compilation job and deterministically attest the complete compiler-output
  // contract object instead of accepting a stale or hand-created artifact.
  const factoryArtifactPath = resolve(
    contractsRoot,
    "artifacts/contracts/VestingFactory.sol/VestingFactory.json",
  );
  const factoryArtifact = JSON.parse(readRequired(factoryArtifactPath).toString("utf8"));
  const buildInfoId = requireBuildInfoId(
    "VestingFactory artifact buildInfoId",
    factoryArtifact.buildInfoId,
  );
  const { buildInfoRaw, buildInfoOutputRaw } = buildInfoFiles(buildInfoId);
  const buildInfo = JSON.parse(buildInfoRaw.toString("utf8"));
  const sourceName = "@openzeppelin/contracts/finance/VestingWallet.sol";
  const outputSourceName = buildInfo.userSourceNameMap?.[sourceName];
  if (typeof outputSourceName !== "string") {
    throw new Error("VestingWallet build info does not map its npm user source name");
  }
  const outputDocument = JSON.parse(buildInfoOutputRaw.toString("utf8"));
  const artifactRaw = deterministicExtractedArtifact(
    buildInfoId,
    sourceName,
    outputSourceName,
    "VestingWallet",
    outputDocument,
  );
  return {
    artifactKind: "deterministic-build-output-extract-v1",
    artifactRaw,
    buildInfoId,
    sourceName,
    contractName: "VestingWallet",
  };
}

function collectArtifactEntries() {
  return artifacts.map(([name, artifactPath, expectedSolcVersion]) => {
    const {
      artifactKind,
      artifactRaw,
      buildInfoId,
      sourceName,
      contractName,
    } = loadHardhat3Artifact(name, artifactPath);
    const {
      buildInfoPath,
      buildInfoOutputPath,
      buildInfoRaw,
      buildInfoOutputRaw,
    } = buildInfoFiles(buildInfoId);
    const buildInfo = JSON.parse(buildInfoRaw.toString("utf8"));
    const buildInfoOutput = JSON.parse(buildInfoOutputRaw.toString("utf8"));
    const outputSourceName = buildInfo.userSourceNameMap?.[sourceName] ?? sourceName;
    if (typeof outputSourceName !== "string") {
      throw new Error(`${name} build info has an invalid user source-name mapping`);
    }
    compilerOutputContract(buildInfoOutput, outputSourceName, contractName);
    const compiler = compilers.find((entry) => entry.version === expectedSolcVersion);
    if (
      buildInfo.solcVersion !== expectedSolcVersion ||
      buildInfo.solcLongVersion !== compiler?.longVersion ||
      buildInfo._format !== "hh3-sol-build-info-1" ||
      buildInfo.compilerType !== "solc" ||
      buildInfo.id !== buildInfoId ||
      buildInfoOutput._format !== "hh3-sol-build-info-output-1" ||
      buildInfoOutput.id !== buildInfoId ||
      !buildInfoId.startsWith(`solc-${expectedSolcVersion.replaceAll(".", "_")}-`)
    ) {
      throw new Error(
        `${name} did not use the exact attested solc ${expectedSolcVersion} compiler build`,
      );
    }
    return {
      name,
      solcVersion: expectedSolcVersion,
      artifactPath,
      artifactKind,
      artifactSha256: sha256(artifactRaw),
      buildInfoId,
      buildInfoPath,
      buildInfoSha256: sha256(buildInfoRaw),
      buildInfoOutputPath,
      buildInfoOutputSha256: sha256(buildInfoOutputRaw),
    };
  });
}

compile();
const firstPass = collectArtifactEntries();
compile();
const secondPass = collectArtifactEntries();
if (JSON.stringify(firstPass) !== JSON.stringify(secondPass)) {
  throw new Error("Two forced clean-runner compilations did not reproduce identical artifact records");
}
if (digestReadOnlyNodeModulesTree() !== nodeModulesTreeSha256) {
  throw new Error("Credential-free compilation changed the read-only node_modules tree");
}

const postBuildSourceCommit = execFileSync(
  gitExecutable,
  [...gitArguments, "rev-parse", "HEAD"],
  { cwd: contractsRoot, env: gitEnvironment, encoding: "utf8" },
).trim();
if (postBuildSourceCommit !== sourceCommit) {
  throw new Error("Credential-free compilation changed the reviewed source commit");
}
requireCanonicalGitIndex("Post-build");
const postBuildStatus = execFileSync(
  gitExecutable,
  [...gitArguments, "status", "--porcelain=v1", "--untracked-files=all"],
  { cwd: contractsRoot, env: gitEnvironment, encoding: "utf8" },
);
if (postBuildStatus.trim()) {
  throw new Error("Credential-free compilation unexpectedly changed the reviewed source tree");
}

const attestation = {
  schemaVersion: 3,
  status: "ATTESTED",
  hashAlgorithm: "sha256",
  deploymentProfile,
  planPath: planRelativePath,
  sourceCommit,
  nodeVersion: process.version,
  nodeExecutableSha256,
  gitExecutableSha256,
  hardhatVersion: installedHardhatPackage.version,
  hardhatPackageSha256,
  hardhatCliSha256,
  nodeModulesTreeFormat,
  nodeModulesTreeSha256,
  planSha256: sha256(readRequired(planPath)),
  buildEnvironment: {
    kind: buildEnvironmentKind,
    platform: process.platform,
    architecture: process.arch,
    cleanHome: true,
    networkDisabled: true,
    credentialFree: true,
    readOnlyNodeModules: true,
    unprivilegedUser: true,
    reproducibleBuildPasses: 2,
    privateExternalBuildState: true,
    privateExternalTmp: true,
    homeEnvironmentForwarded: false,
    compilerCacheLocation: isFactoryResetDarwinDisposable
      ? "attested-native-user-cache"
      : "private-xdg-cache",
    operatorAcknowledgement: isFactoryResetDarwinDisposable
      ? factoryResetMacAcknowledgement
      : null,
  },
  inputs: inputPaths.map((inputPath) => ({
    path: inputPath,
    sha256: sha256(readRequired(resolve(contractsRoot, inputPath))),
  })),
  compilers,
  artifacts: secondPass,
};

const serialized = `${JSON.stringify(attestation, null, 2)}\n`;
writeFileSync(outputPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o444 });
chmodSync(outputPath, 0o444);
console.log(`Wrote external read-only build attestation: ${outputPath}`);
console.log(`Attestation SHA-256: ${sha256(serialized)}`);
console.log(`Source commit: ${sourceCommit}`);
