import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { artifacts, network } from "hardhat";
import {
  PRODUCTION_SEPARATED_PROFILE,
  parseReplacementManifest,
  readAttestedVestingWalletBuild,
  verifyReplacementManifest,
} from "./lib/post_compromise_replacement.js";

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTRACTS_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(CONTRACTS_ROOT, "..");
const CODE_HASH_PATTERN = /^0x[0-9a-f]{64}$/;

function requireAbsoluteExternalFile(name: string): string {
  const configured = process.env[name];
  if (!configured || !path.isAbsolute(configured)) {
    throw new Error(`${name} must identify an absolute external file`);
  }
  const resolved = path.resolve(configured);
  const relative = path.relative(REPOSITORY_ROOT, resolved);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error(`${name} must remain outside the source repository`);
  }
  if (!fs.existsSync(resolved) || !fs.lstatSync(resolved).isFile()) {
    throw new Error(`${name} must identify an existing regular file`);
  }
  return resolved;
}

function requireAbsoluteExternalOutput(): string {
  const configured = process.env.PUBLIC_FRONTEND_PACKAGE_OUTPUT_PATH;
  if (!configured || !path.isAbsolute(configured)) {
    throw new Error("PUBLIC_FRONTEND_PACKAGE_OUTPUT_PATH must be an absolute external path");
  }
  const resolved = path.resolve(configured);
  const relative = path.relative(REPOSITORY_ROOT, resolved);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error("The frontend approval candidate must be written outside the source repository");
  }
  if (fs.existsSync(resolved)) throw new Error("Refusing to overwrite an existing approval candidate");
  const parent = path.dirname(resolved);
  const stat = fs.lstatSync(parent);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) {
    throw new Error("Approval candidate directory must exist and grant no group/other permissions");
  }
  return resolved;
}

function canonicalManifestSha256(manifest: unknown): `0x${string}` {
  return `0x${createHash("sha256")
    .update(`${JSON.stringify(manifest, null, 2)}\n`)
    .digest("hex")}`;
}

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

function canonicalApprovalPayloadSha256(payload: unknown): `0x${string}` {
  return `0x${createHash("sha256")
    .update(`${JSON.stringify(canonicalizeJson(payload), null, 2)}\n`)
    .digest("hex")}`;
}

function normalizedImmutableRuntime(
  deployedBytecode: string,
  references: readonly { start: number; length: number }[],
): string {
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(deployedBytecode)) {
    throw new Error("VestingWallet artifact has invalid deployed bytecode");
  }
  const bytes = deployedBytecode.slice(2).toLowerCase().split("");
  const runtimeBytes = bytes.length / 2;
  const covered = new Set<number>();
  for (const reference of references) {
    if (
      !Number.isSafeInteger(reference.start) ||
      !Number.isSafeInteger(reference.length) ||
      reference.start < 0 ||
      reference.length <= 0 ||
      reference.start + reference.length > runtimeBytes
    ) throw new Error("VestingWallet build info contains an invalid immutable reference");
    for (let offset = reference.start; offset < reference.start + reference.length; offset += 1) {
      if (covered.has(offset)) throw new Error("VestingWallet immutable references overlap");
      covered.add(offset);
      bytes[offset * 2] = "0";
      bytes[(offset * 2) + 1] = "0";
    }
  }
  if (covered.size === 0) throw new Error("VestingWallet build info contains no immutable references");
  return `0x${bytes.join("")}`;
}

async function main(): Promise<void> {
  if (process.env.REPLACEMENT_DEPLOYMENT_PROFILE !== PRODUCTION_SEPARATED_PROFILE) {
    throw new Error("Only a production-separated-authority manifest can produce a public frontend candidate");
  }
  const manifestPath = requireAbsoluteExternalFile("REPLACEMENT_MANIFEST_PATH");
  const activityPath = requireAbsoluteExternalFile("PLATFORM_ACTIVITY_CUTOVER_PATH");
  const outputPath = requireAbsoluteExternalOutput();
  const manifest = parseReplacementManifest(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.deploymentProfile !== PRODUCTION_SEPARATED_PROFILE) {
    throw new Error("Disposable testnet manifests can never produce a public frontend candidate");
  }
  await verifyReplacementManifest(manifest, ethers);

  const activity = JSON.parse(fs.readFileSync(activityPath, "utf8")) as {
    snapshotKind?: unknown;
    reviewStatus?: unknown;
    chainId?: unknown;
    throughBlock?: unknown;
    blockHash?: unknown;
    totals?: Record<string, unknown>;
  };
  if (
    activity.snapshotKind !== "post-replacement-cutover" ||
    activity.reviewStatus !== "APPROVED" ||
    activity.chainId !== 4441 ||
    !Number.isSafeInteger(activity.throughBlock) ||
    (activity.throughBlock as number) < manifest.verifiedAtBlock ||
    typeof activity.blockHash !== "string" ||
    !CODE_HASH_PATTERN.test(activity.blockHash)
  ) throw new Error("Activity input is not an approved post-replacement LitVM cutover snapshot");
  const requiredActivityTotals = [
    "tokensMinted",
    "walletsAirdropped",
    "presalesCreated",
    "swapsCompleted",
    "onChainMessages",
  ] as const;
  if (
    !activity.totals ||
    Object.keys(activity.totals).length !== requiredActivityTotals.length ||
    requiredActivityTotals.some((name) => !(name in activity.totals!))
  ) throw new Error("Activity cutover must contain exactly the five reviewed homepage totals");
  for (const [name, value] of Object.entries(activity.totals)) {
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      throw new Error(`Activity total is invalid: ${name}`);
    }
  }
  const cutoverBlock = await ethers.provider.getBlock(activity.throughBlock as number);
  if (!cutoverBlock?.hash || cutoverBlock.hash.toLowerCase() !== activity.blockHash.toLowerCase()) {
    throw new Error("Activity cutover block hash does not match LitVM");
  }

  const deploymentAddress = (name: string): string => {
    const deployment = manifest.deployments.find((record) => record.name === name);
    if (!deployment) throw new Error(`Replacement manifest is missing ${name}`);
    return deployment.address;
  };
  const cutoverBlockTag = activity.throughBlock as number;
  const [tokenFactoryNonce, router, disperse, ledger, iloFactory] = await Promise.all([
    ethers.provider.getTransactionCount(deploymentAddress("TokenFactory"), cutoverBlockTag),
    ethers.getContractAt("UniswapV2Router02", deploymentAddress("UniswapV2Router02")),
    ethers.getContractAt("Disperse", deploymentAddress("Disperse")),
    ethers.getContractAt("TheLedger", deploymentAddress("TheLedger")),
    ethers.getContractAt("ILOFactory", deploymentAddress("ILOFactory")),
  ]);
  if (tokenFactoryNonce !== 1) {
    throw new Error("Replacement TokenFactory had CREATE activity at the exact analytics cutover block");
  }
  const replacementCutoverCounters = await Promise.all([
    router.totalSwapCount({ blockTag: cutoverBlockTag }),
    disperse.totalRecipientEntries({ blockTag: cutoverBlockTag }),
    ledger.messageCount({ blockTag: cutoverBlockTag }),
    iloFactory.getILOCount({ blockTag: cutoverBlockTag }),
  ]);
  if (replacementCutoverCounters.some((counter) => counter !== 0n)) {
    throw new Error("Every replacement analytics counter must be zero at the exact cutover block");
  }

  const [pairArtifact, iloArtifact] = await Promise.all([
    artifacts.readArtifact("UniswapV2Pair"),
    artifacts.readArtifact("ILO"),
  ]);
  const {
    artifact: vestingArtifact,
    contractOutput: vestingContractOutput,
  } = readAttestedVestingWalletBuild();
  const immutableReferenceGroups = (
    vestingContractOutput.evm as
      | {
          deployedBytecode?: {
            immutableReferences?: Record<
              string,
              readonly { start: number; length: number }[]
            >;
          };
        }
      | undefined
  )?.deployedBytecode?.immutableReferences;
  if (!immutableReferenceGroups) throw new Error("VestingWallet immutable build information is missing");
  const immutableReferences = Object.values(immutableReferenceGroups)
    .flat()
    .map(({ start, length }) => ({ start, length }))
    .sort((left, right) => left.start - right.start || left.length - right.length);
  const normalizedVesting = normalizedImmutableRuntime(
    vestingArtifact.deployedBytecode,
    immutableReferences,
  );

  const deploymentManifestSha256 = canonicalManifestSha256(manifest);
  const approvalPayload = {
    deploymentManifestSha256,
    deploymentManifest: manifest,
    frontendRuntimeAttestations: {
      uniswapV2Pair: ethers.keccak256(pairArtifact.deployedBytecode),
      vestingWallet: {
        normalizedRuntimeCodeHash: ethers.keccak256(normalizedVesting),
        runtimeCodeBytes: (vestingArtifact.deployedBytecode.length - 2) / 2,
        immutableReferences,
      },
      iloChild: ethers.keccak256(iloArtifact.deployedBytecode),
    },
    activityCutover: {
      throughBlock: activity.throughBlock,
      blockHash: activity.blockHash,
      totals: {
        tokensMinted: activity.totals.tokensMinted,
        walletsAirdropped: activity.totals.walletsAirdropped,
        presalesCreated: activity.totals.presalesCreated,
        swapsCompleted: activity.totals.swapsCompleted,
        onChainMessages: activity.totals.onChainMessages,
      },
    },
  };
  const candidate = {
    status: "APPROVED",
    approvalPayloadSha256: canonicalApprovalPayloadSha256(approvalPayload),
    ...approvalPayload,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o400,
  });
  console.log(`Wrote externally reviewed public frontend candidate: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
