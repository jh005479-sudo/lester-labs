import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, type Provider } from "ethers";
import { artifacts, network } from "hardhat";
import {
  PRODUCTION_SEPARATED_PROFILE,
  parseReplacementManifest,
  readAttestedVestingWalletBuild,
  verifyReplacementManifest,
} from "./lib/post_compromise_replacement.js";
import { verifySourcePinnedProductionAuthorities } from "./lib/production_authority_verifier.js";

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTRACTS_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(CONTRACTS_ROOT, "..");
const PRODUCTION_AUTHORITIES_PATH = path.resolve(CONTRACTS_ROOT, "deployment/production-authorities.json");
const CONTROL_PLANE_RECOVERY_PATH = path.resolve(
  REPOSITORY_ROOT,
  "docs/security/evidence/production-control-plane-recovery.json",
);
const CODE_HASH_PATTERN = /^0x[0-9a-f]{64}$/;
const ACTIVITY_METRIC_NAMES = [
  "tokensMinted",
  "walletsAirdropped",
  "presalesCreated",
  "swapsCompleted",
  "onChainMessages",
] as const;
const INDEPENDENT_REPLACEMENT_VERIFICATION_CHECKS = [
  "source-and-build-attestation",
  "legacy-runtime-anchors",
  "deployment-transactions-and-receipts",
  "replacement-runtime-code-and-byte-lengths",
  "constructor-parameters-and-role-bindings",
  "production-safe-creation-history-and-owner-eoas",
  "production-safe-authorities",
  "zero-replacement-counters-at-cutover",
] as const;

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

function optionalAbsoluteExternalFile(name: string): string | undefined {
  if (!process.env[name]) return undefined;
  return requireAbsoluteExternalFile(name);
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

function rawFileSha256(filePath: string): `0x${string}` {
  return `0x${createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function requireCredentialFreeHttpsRpcUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.username || url.password || url.search || url.hash
  ) throw new Error(`${label} must be a credential-free HTTPS URL without query parameters or a fragment`);
  return url.href;
}

function requireExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly the reviewed fields`);
  }
}

type ReviewerApproval = {
  reviewer: string;
  reviewRole: string;
  approvalPayloadSha256: `0x${string}`;
  evidenceSha256: `0x${string}`;
  approvedAt: string;
};

function readReviewerApprovals(
  approvalPath: string,
  expectedPayloadSha256: `0x${string}`,
): ReviewerApproval[] {
  const value: unknown = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
  requireExactKeys(value, ["approvalPayloadSha256", "reviewerApprovals"], "The external approval record");
  if (value.approvalPayloadSha256 !== expectedPayloadSha256) {
    throw new Error("The external approval record is bound to a different approval payload");
  }
  if (!Array.isArray(value.reviewerApprovals) || value.reviewerApprovals.length < 2) {
    throw new Error("At least two independently produced approval records are required");
  }
  const reviewers = new Set<string>();
  const roles = new Set<string>();
  const evidenceDigests = new Set<string>();
  const approvals = value.reviewerApprovals.map((entry): ReviewerApproval => {
    requireExactKeys(
      entry,
      ["reviewer", "reviewRole", "approvalPayloadSha256", "evidenceSha256", "approvedAt"],
      "A public replacement reviewer approval",
    );
    if (
      typeof entry.reviewer !== "string" || entry.reviewer.length < 2 || entry.reviewer.length > 120 ||
      typeof entry.reviewRole !== "string" || entry.reviewRole.length < 2 || entry.reviewRole.length > 120 ||
      entry.approvalPayloadSha256 !== expectedPayloadSha256 ||
      typeof entry.evidenceSha256 !== "string" || !CODE_HASH_PATTERN.test(entry.evidenceSha256) ||
      typeof entry.approvedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.approvedAt) ||
      Number.isNaN(Date.parse(entry.approvedAt))
    ) throw new Error("A public replacement reviewer approval is invalid or bound to another payload");
    reviewers.add(entry.reviewer.toLowerCase());
    roles.add(entry.reviewRole.toLowerCase());
    evidenceDigests.add(entry.evidenceSha256);
    return entry as ReviewerApproval;
  });
  if (
    reviewers.size !== approvals.length ||
    roles.size < 2 ||
    evidenceDigests.size !== approvals.length
  ) throw new Error("Approval reviewers, review roles, and evidence identities must be independent");
  return approvals;
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
  const primaryRpcUrl = requireCredentialFreeHttpsRpcUrl(
    process.env.LITVM_RPC_URL || "https://liteforge.rpc.caldera.xyz/http",
    "The primary production verification RPC",
  );
  const manifestPath = requireAbsoluteExternalFile("REPLACEMENT_MANIFEST_PATH");
  const activityPath = requireAbsoluteExternalFile("PLATFORM_ACTIVITY_CUTOVER_PATH");
  const secondRpcProofPath = requireAbsoluteExternalFile("PLATFORM_ACTIVITY_SECOND_RPC_PROOF_PATH");
  const reviewerApprovalsPath = optionalAbsoluteExternalFile("PUBLIC_FRONTEND_APPROVALS_PATH");
  const outputPath = requireAbsoluteExternalOutput();
  const manifest = parseReplacementManifest(fs.readFileSync(manifestPath, "utf8"));
  const deploymentManifestSha256 = canonicalManifestSha256(manifest);
  if (manifest.deploymentProfile !== PRODUCTION_SEPARATED_PROFILE) {
    throw new Error("Disposable testnet manifests can never produce a public frontend candidate");
  }
  await verifyReplacementManifest(manifest, ethers);

  const authorityInventory = JSON.parse(fs.readFileSync(PRODUCTION_AUTHORITIES_PATH, "utf8")) as {
    kind?: unknown;
    schemaVersion?: unknown;
    status?: unknown;
    chainId?: unknown;
    controller?: { address?: unknown };
    treasury?: { address?: unknown };
  };
  if (
    authorityInventory.kind !== "lester-labs-production-authority-inventory" ||
    authorityInventory.schemaVersion !== 1 ||
    authorityInventory.status !== "REVIEWED_FOR_PRODUCTION" ||
    authorityInventory.chainId !== "4441" ||
    typeof authorityInventory.controller?.address !== "string" ||
    typeof authorityInventory.treasury?.address !== "string" ||
    authorityInventory.controller.address.toLowerCase() !== manifest.controller.toLowerCase() ||
    authorityInventory.treasury.address.toLowerCase() !== manifest.treasury.toLowerCase()
  ) throw new Error("The source-pinned production authority inventory is not reviewed or does not match the manifest");
  const controlPlaneVerifierModuleUrl = new URL(
    "../../scripts/security/verify-control-plane-recovery.mjs",
    import.meta.url,
  ).href;
  const controlPlaneVerifier = await import(controlPlaneVerifierModuleUrl) as {
    verifyControlPlaneRecoveryEvidence: (
      filePath: string,
      options: { requireReviewed: boolean },
    ) => { status: string };
  };
  if (controlPlaneVerifier.verifyControlPlaneRecoveryEvidence(
    CONTROL_PLANE_RECOVERY_PATH,
    { requireReviewed: true },
  ).status !== "REVIEWED") {
    throw new Error("The source-pinned production control-plane recovery evidence is not reviewed");
  }

  const activitySource = fs.readFileSync(activityPath);
  const activity: unknown = JSON.parse(activitySource.toString("utf8"));
  const cutoverVerifierModuleUrl = new URL(
    "../../scripts/security/verify-platform-activity-cutover.mjs",
    import.meta.url,
  ).href;
  const cutoverCaptureModuleUrl = new URL(
    "../../scripts/security/capture-platform-activity-cutover.mjs",
    import.meta.url,
  ).href;
  const cutoverVerifier = await import(cutoverVerifierModuleUrl) as {
    requireCredentialFreeSecondRpcUrl: (value: unknown) => string;
    requirePlatformActivityCutoverCandidate: (value: unknown) => Record<string, unknown>;
    verifyPlatformActivityCutoverCandidate: (
      value: unknown,
      options: { rpc: (method: string, params: unknown[]) => Promise<unknown> },
    ) => Promise<Record<string, unknown>>;
  };
  const cutoverCapture = await import(cutoverCaptureModuleUrl) as {
    createJsonRpcReader: (url: string) => (method: string, params: unknown[]) => Promise<unknown>;
  };
  cutoverVerifier.requirePlatformActivityCutoverCandidate(activity);
  requireExactKeys(activity, [
    "blockHash",
    "blockTimestamp",
    "capturedAt",
    "chainId",
    "components",
    "configuration",
    "metricMethods",
    "operatorRequirements",
    "reviewStatus",
    "schemaVersion",
    "snapshotKind",
    "throughBlock",
    "totals",
    "warnings",
  ], "The platform activity cutover candidate");
  if (
    activity.schemaVersion !== 1 ||
    activity.snapshotKind !== "post-replacement-cutover" ||
    activity.reviewStatus !== "candidate-read-only-capture" ||
    activity.chainId !== 4441 ||
    !Number.isSafeInteger(activity.throughBlock) ||
    (activity.throughBlock as number) < manifest.verifiedAtBlock ||
    typeof activity.blockHash !== "string" ||
    !CODE_HASH_PATTERN.test(activity.blockHash)
  ) throw new Error("Activity input is not an exact post-replacement LitVM cutover candidate");
  const activityTotals = activity.totals;
  requireExactKeys(activityTotals, ACTIVITY_METRIC_NAMES, "The activity cutover totals");
  if (
    ACTIVITY_METRIC_NAMES.some(
      (name) => !Number.isSafeInteger(activityTotals[name]) || (activityTotals[name] as number) < 0,
    )
  ) throw new Error("Activity cutover must contain exactly the five reviewed homepage totals");

  const candidatePayloadSha256 = canonicalApprovalPayloadSha256(activity);
  const secondRpcProofSource = fs.readFileSync(secondRpcProofPath);
  const secondRpcProof: unknown = JSON.parse(secondRpcProofSource.toString("utf8"));
  requireExactKeys(secondRpcProof, [
    "status",
    "chainId",
    "throughBlock",
    "blockHash",
    "candidatePayloadSha256",
    "verifiedCounters",
    "verifiedRuntimeCodeHashes",
    "rpcUrl",
  ], "The independent second-RPC proof");
  requireExactKeys(secondRpcProof.verifiedCounters, ACTIVITY_METRIC_NAMES, "The second-RPC verified counters");
  const secondRpcUrl = cutoverVerifier.requireCredentialFreeSecondRpcUrl(secondRpcProof.rpcUrl);
  if (new URL(primaryRpcUrl).origin === new URL(secondRpcUrl).origin) {
    throw new Error("Primary and independent replacement verification RPC origins must be distinct");
  }
  if (
    secondRpcProof.status !== "VERIFIED_SECOND_RPC" ||
    secondRpcProof.chainId !== 4441 ||
    secondRpcProof.throughBlock !== activity.throughBlock ||
    typeof secondRpcProof.blockHash !== "string" ||
    secondRpcProof.blockHash.toLowerCase() !== activity.blockHash.toLowerCase() ||
    secondRpcProof.candidatePayloadSha256 !== candidatePayloadSha256 ||
    JSON.stringify(canonicalizeJson(secondRpcProof.verifiedCounters)) !== JSON.stringify(canonicalizeJson(activityTotals)) ||
    secondRpcProof.rpcUrl !== secondRpcUrl
  ) throw new Error("The independent second-RPC proof does not bind the exact candidate block and counters");
  const activityComponents = activity.components as Record<string, unknown>;
  if (
    !activityComponents ||
    JSON.stringify(canonicalizeJson(secondRpcProof.verifiedRuntimeCodeHashes)) !==
      JSON.stringify(canonicalizeJson(activityComponents.runtimeCodeHashes))
  ) throw new Error("The independent second-RPC proof does not bind the candidate legacy runtime hashes");
  const recomputedSecondRpcProof = await cutoverVerifier.verifyPlatformActivityCutoverCandidate(
    activity,
    { rpc: cutoverCapture.createJsonRpcReader(secondRpcUrl) },
  );
  const suppliedProofWithoutUrl = Object.fromEntries(
    Object.entries(secondRpcProof).filter(([name]) => name !== "rpcUrl"),
  );
  if (
    JSON.stringify(canonicalizeJson(recomputedSecondRpcProof)) !==
    JSON.stringify(canonicalizeJson(suppliedProofWithoutUrl))
  ) throw new Error("Live second-RPC verification did not reproduce the supplied exact-block proof");

  const independentProvider = new JsonRpcProvider(secondRpcUrl, 4441, { staticNetwork: true });
  await verifyReplacementManifest(manifest, ethers, independentProvider);

  const cutoverBlock = await ethers.provider.getBlock(activity.throughBlock as number);
  if (!cutoverBlock?.hash || cutoverBlock.hash.toLowerCase() !== activity.blockHash.toLowerCase()) {
    throw new Error("Activity cutover block hash does not match LitVM");
  }
  const productionAuthorityVerification = await verifySourcePinnedProductionAuthorities(
    manifest,
    ethers.provider,
    {
      blockNumber: activity.throughBlock as number,
      gasOnlyDeployer: manifest.gasOnlyDeployer,
    },
  );
  if (
    productionAuthorityVerification.inventorySha256 !== rawFileSha256(PRODUCTION_AUTHORITIES_PATH) ||
    productionAuthorityVerification.blockHash.toLowerCase() !== activity.blockHash.toLowerCase()
  ) throw new Error("The full production authority verification is not bound to the exact cutover block and inventory");
  const independentProductionAuthorityVerification = await verifySourcePinnedProductionAuthorities(
    manifest,
    independentProvider,
    {
      blockNumber: activity.throughBlock as number,
      gasOnlyDeployer: manifest.gasOnlyDeployer,
    },
  );
  if (
    independentProductionAuthorityVerification.inventorySha256 !== rawFileSha256(PRODUCTION_AUTHORITIES_PATH) ||
    independentProductionAuthorityVerification.blockHash.toLowerCase() !== activity.blockHash.toLowerCase()
  ) throw new Error("The independent production authority verification is not bound to the exact cutover block and inventory");

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
  const [swapCount, recipientEntries, messageCount, iloCount] = await Promise.all([
    router.totalSwapCount({ blockTag: cutoverBlockTag }),
    disperse.totalRecipientEntries({ blockTag: cutoverBlockTag }),
    ledger.messageCount({ blockTag: cutoverBlockTag }),
    iloFactory.getILOCount({ blockTag: cutoverBlockTag }),
  ]);
  if (swapCount !== 0n || recipientEntries !== 0n || messageCount !== 0n || iloCount !== 0n) {
    throw new Error("Every replacement analytics counter must be zero at the exact cutover block");
  }
  const replacementCountersAtCutover = {
    tokensMinted: 0,
    walletsAirdropped: 0,
    presalesCreated: 0,
    swapsCompleted: 0,
    onChainMessages: 0,
  };
  const connectProvider = <T extends { connect(runner: Provider): unknown }>(
    contract: T,
    provider: Provider,
  ): T => contract.connect(provider) as T;
  const independentRouter = connectProvider(router, independentProvider);
  const independentDisperse = connectProvider(disperse, independentProvider);
  const independentLedger = connectProvider(ledger, independentProvider);
  const independentIloFactory = connectProvider(iloFactory, independentProvider);
  const [
    independentTokenFactoryNonce,
    independentSwapCount,
    independentRecipientEntries,
    independentMessageCount,
    independentIloCount,
  ] = await Promise.all([
    independentProvider.getTransactionCount(deploymentAddress("TokenFactory"), cutoverBlockTag),
    independentRouter.totalSwapCount({ blockTag: cutoverBlockTag }),
    independentDisperse.totalRecipientEntries({ blockTag: cutoverBlockTag }),
    independentLedger.messageCount({ blockTag: cutoverBlockTag }),
    independentIloFactory.getILOCount({ blockTag: cutoverBlockTag }),
  ]);
  if (
    independentTokenFactoryNonce !== 1 ||
    independentSwapCount !== 0n ||
    independentRecipientEntries !== 0n ||
    independentMessageCount !== 0n ||
    independentIloCount !== 0n
  ) throw new Error("Every independent-RPC replacement analytics counter must be zero at the exact cutover block");
  const independentCutoverBlock = await independentProvider.getBlock(cutoverBlockTag);
  if (
    !independentCutoverBlock?.hash ||
    independentCutoverBlock.hash.toLowerCase() !== activity.blockHash.toLowerCase()
  ) throw new Error("The independent replacement verification is not bound to the exact cutover block");
  if (
    JSON.stringify(canonicalizeJson(independentProductionAuthorityVerification)) !==
    JSON.stringify(canonicalizeJson(productionAuthorityVerification))
  ) throw new Error("Primary and independent RPCs returned different production authority facts");
  const independentReplacementVerificationPayload = {
    status: "VERIFIED_INDEPENDENT_RPC",
    primaryRpcOrigin: new URL(primaryRpcUrl).origin,
    rpcUrl: secondRpcUrl,
    chainId: manifest.chainId,
    blockNumber: cutoverBlockTag,
    blockHash: independentCutoverBlock.hash.toLowerCase(),
    deploymentManifestSha256,
    verifiedChecks: INDEPENDENT_REPLACEMENT_VERIFICATION_CHECKS,
    productionAuthorityVerification: independentProductionAuthorityVerification,
    replacementCountersAtCutover,
  };
  const independentReplacementVerification = {
    reportSha256: canonicalApprovalPayloadSha256(independentReplacementVerificationPayload),
    ...independentReplacementVerificationPayload,
  };

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
    sourceEvidence: {
      productionAuthoritiesRawSha256: rawFileSha256(PRODUCTION_AUTHORITIES_PATH),
      controlPlaneRecoveryRawSha256: rawFileSha256(CONTROL_PLANE_RECOVERY_PATH),
      productionAuthorityVerification,
      independentReplacementVerification,
    },
    activityCutover: {
      throughBlock: activity.throughBlock,
      blockHash: activity.blockHash,
      totals: {
        tokensMinted: activityTotals.tokensMinted,
        walletsAirdropped: activityTotals.walletsAirdropped,
        presalesCreated: activityTotals.presalesCreated,
        swapsCompleted: activityTotals.swapsCompleted,
        onChainMessages: activityTotals.onChainMessages,
      },
      independentSecondRpc: {
        candidateRawSha256: `0x${createHash("sha256").update(activitySource).digest("hex")}`,
        candidatePayloadSha256,
        proofRawSha256: `0x${createHash("sha256").update(secondRpcProofSource).digest("hex")}`,
        rpcUrl: secondRpcUrl,
      },
      replacementCountersAtCutover,
    },
  };
  const approvalPayloadSha256 = canonicalApprovalPayloadSha256(approvalPayload);
  const reviewerApprovals = reviewerApprovalsPath
    ? readReviewerApprovals(reviewerApprovalsPath, approvalPayloadSha256)
    : [];
  const candidate = {
    status: reviewerApprovalsPath ? "APPROVED" : "CANDIDATE",
    approvalPayloadSha256,
    ...approvalPayload,
    reviewerApprovals,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o400,
  });
  independentProvider.destroy();
  console.log(
    reviewerApprovalsPath
      ? `Wrote independently reviewed APPROVED public frontend package: ${outputPath}`
      : `Wrote fail-closed public frontend CANDIDATE ${approvalPayloadSha256}: ${outputPath}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
