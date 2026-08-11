import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers, type Provider } from "ethers";
import { EXPECTED_CHAIN_ID } from "./live_treasury_audit.js";
import {
  PRODUCTION_AUTHORITY_INVENTORY_RELATIVE_PATH,
  PRODUCTION_SEPARATED_PROFILE,
  requireFreshIncidentSafeAddress,
  type ReplacementPlan,
} from "./post_compromise_replacement.js";

export { PRODUCTION_AUTHORITY_INVENTORY_RELATIVE_PATH };

export const PRODUCTION_AUTHORITY_INVENTORY_KIND =
  "lester-labs-production-authority-inventory" as const;
export const PRODUCTION_AUTHORITY_INVENTORY_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_AUTHORITY_INVENTORY_STATUS = "REVIEWED_FOR_PRODUCTION" as const;

const CONTRACTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAFE_PROXY_KIND = "safe-proxy-storage-slot-0" as const;
const SAFE_IMPLEMENTATION_STORAGE_SLOT = ethers.ZeroHash;
const SAFE_SENTINEL_MODULES = "0x0000000000000000000000000000000000000001";
const SAFE_GUARD_STORAGE_SLOT = ethers.keccak256(
  ethers.toUtf8Bytes("guard_manager.guard.address"),
);
const SAFE_FALLBACK_HANDLER_STORAGE_SLOT = ethers.keccak256(
  ethers.toUtf8Bytes("fallback_manager.handler.address"),
);
const SAFE_HISTORY_LOG_BLOCK_SPAN = 10_000;
export const PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const PINNED_SAFE_RUNTIME_PROVENANCE = Object.freeze({
  safeVersion: "1.4.1",
  sourceRepository: "https://github.com/safe-fndn/safe-smart-account",
  sourceRelease: "v1.4.1",
  sourceCommit: "bf943f80fec5ac647159d26161446ac5d716a294",
  sourceTree: "dbbe8faa94445342975303ff4da1471cac2052d6",
  npmPackage: "@safe-global/safe-contracts",
  npmVersion: "1.4.1",
  npmIntegrity:
    "sha512-fP1jewywSwsIniM04NsqPyVRFKPMAuirC3ftA/TA4X3Zc5EnwQp/UCJUU2PL/37/z/jMo8UUaJ+pnFNWmMU7dQ==",
  npmTarballSha512:
    "7cfd637b0cb04b0b089e2334e0db2a3f255114a3cc02e8ab0b77ed03f4c0e17dd9739127c10a7f5022545363cbff7effcff8cca3c514689fa99c535698c53b75",
  compiler: "0.7.6+commit.7338295f",
  buildInfoSha256: "0e26726d8b59a0a5b534b8c85d7119ce6640ed12610ca440c67c90617368bba4",
  proxyArtifactSha256: "b05eaeaf7278097e52a9e9b38410de2a812c23fa3622373473e73eaa19646ecd",
  proxyCreationCodeHash: "0x1856e0ee08399d74e0ea0b03adca210aeade6f748969ac023cdcb4dd62dcaf5f",
  proxyRuntimeCodeHash: "0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c",
  factoryArtifactSha256: "f77ccb60e95345e6583216e82feb5430098679d62aa4aeda7388df3831476997",
  factoryRuntimeCodeHash: "0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317",
  implementationContract: "contracts/SafeL2.sol:SafeL2",
  implementationArtifactSha256:
    "a57d54c0d757ca7fb86693480797de69c880878690b67061f6f9624e11def8bd",
  implementationRuntimeCodeHash:
    "0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff",
});
const SAFE_READ_INTERFACE = new ethers.Interface([
  "function masterCopy() view returns (address)",
  "function VERSION() view returns (string)",
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)",
]);
const SAFE_SETUP_INTERFACE = new ethers.Interface([
  "function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address paymentReceiver)",
  "event SafeSetup(address indexed initiator,address[] owners,uint256 threshold,address initializer,address fallbackHandler)",
  "event SafeReceived(address indexed sender,uint256 value)",
]);
const SAFE_FACTORY_INTERFACE = new ethers.Interface([
  "function createChainSpecificProxyWithNonce(address singleton,bytes initializer,uint256 saltNonce) returns (address proxy)",
  "event ProxyCreation(address indexed proxy,address singleton)",
]);

type ReviewedContract = {
  mode: "contract";
  address: string;
  runtimeCodeHash: string;
};

type ReviewedOptionalContract =
  | { mode: "none" }
  | ReviewedContract;

export type ReviewedSafeModule = {
  address: string;
  runtimeCodeHash: string;
};

export type ReviewedSafeAuthority = {
  address: string;
  deployment: {
    factoryAddress: string;
    transactionHash: string;
    blockNumber: number;
    blockHash: string;
    saltNonce: string;
  };
  safeVersion: string;
  proxy: {
    kind: typeof SAFE_PROXY_KIND;
    runtimeCodeHash: string;
    implementationStorageSlot: typeof SAFE_IMPLEMENTATION_STORAGE_SLOT;
    implementationAddress: string;
    implementationRuntimeCodeHash: string;
    sourceRepository: string;
    sourceRelease: string;
    sourceCommit: string;
  };
  owners: string[];
  threshold: number;
  enabledModules: ReviewedSafeModule[];
  guard: ReviewedOptionalContract;
  fallbackHandler: ReviewedOptionalContract;
};

export type ProductionAuthorityInventory = {
  kind: typeof PRODUCTION_AUTHORITY_INVENTORY_KIND;
  schemaVersion: typeof PRODUCTION_AUTHORITY_INVENTORY_SCHEMA_VERSION;
  status: typeof PRODUCTION_AUTHORITY_INVENTORY_STATUS;
  chainId: string;
  review: {
    approvals: {
      reviewer: string;
      approvedAt: string;
      evidenceSha256: string;
    }[];
  };
  controller: ReviewedSafeAuthority;
  treasury: ReviewedSafeAuthority;
};

export type VerifiedSafeAuthority = {
  address: string;
  factoryAddress: string;
  deploymentTransactionHash: string;
  deploymentBlockNumber: number;
  deploymentBlockHash: string;
  deploymentBlockTimestamp: number;
  saltNonce: string;
  proxyRuntimeCodeHash: string;
  implementationAddress: string;
  implementationRuntimeCodeHash: string;
  safeVersion: string;
  owners: string[];
  threshold: number;
  nonce: number;
  enabledModules: string[];
  guard: string;
  fallbackHandler: string;
  benignSafeReceivedLogCount: number;
};

export type ProductionAuthorityVerification = {
  inventorySha256: string;
  chainId: string;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: number;
  authorityReviewMaxAgeSeconds: number;
  gasOnlyDeployer: string;
  controller: VerifiedSafeAuthority;
  treasury: VerifiedSafeAuthority;
};

function sha256(data: Buffer | string): string {
  return `0x${createHash("sha256").update(data).digest("hex")}`;
}

function requireRecord(label: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  label: string,
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} fields are ${actual.join(", ")}; expected exactly ${expected.join(", ")}`,
    );
  }
}

function requireString(label: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function isPlaceholderText(value: string): boolean {
  return /(?:TODO|TBD|UNREVIEWED|PLACEHOLDER|UNKNOWN|NOT[_ -]?SET)/i.test(value);
}

function requireReviewedText(label: string, value: unknown): string {
  const checked = requireString(label, value);
  if (checked.trim() !== checked || checked.length < 3 || isPlaceholderText(checked)) {
    throw new Error(`${label} must be a concrete reviewed value`);
  }
  return checked;
}

function requireUtcTimestamp(label: string, value: unknown): string {
  const checked = requireReviewedText(label, value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(checked) ||
    Number.isNaN(Date.parse(checked))
  ) {
    throw new Error(`${label} must be an exact UTC timestamp`);
  }
  return checked;
}

function requireSha256(label: string, value: unknown): string {
  const checked = requireString(label, value);
  if (!/^0x[0-9a-f]{64}$/.test(checked) || checked === ethers.ZeroHash) {
    throw new Error(`${label} must be a non-zero lower-case SHA-256 value`);
  }
  if (/^0x([0-9a-f]{2})\1{31}$/.test(checked)) {
    throw new Error(`${label} must not be a repeated-byte placeholder`);
  }
  return checked;
}

function requireRuntimeHash(label: string, value: unknown): string {
  const checked = requireString(label, value);
  if (!/^0x[0-9a-f]{64}$/.test(checked) || checked === ethers.ZeroHash) {
    throw new Error(`${label} must be a non-zero lower-case keccak256 runtime hash`);
  }
  if (/^0x([0-9a-f]{2})\1{31}$/.test(checked)) {
    throw new Error(`${label} must not be a repeated-byte placeholder`);
  }
  return checked;
}

function requireBytes32(label: string, value: unknown): string {
  const checked = requireString(label, value);
  if (!/^0x[0-9a-f]{64}$/.test(checked) || checked === ethers.ZeroHash) {
    throw new Error(`${label} must be a non-zero lower-case bytes32 value`);
  }
  if (/^0x([0-9a-f]{2})\1{31}$/.test(checked)) {
    throw new Error(`${label} must not be a repeated-byte placeholder`);
  }
  return checked;
}

function requirePositiveBlockNumber(label: string, value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 1) {
    throw new Error(`${label} must be an exact safe integer greater than one`);
  }
  return value as number;
}

function requireUint256String(label: string, value: unknown): string {
  const checked = requireString(label, value);
  if (!/^(?:0|[1-9][0-9]*)$/.test(checked) || BigInt(checked) > ethers.MaxUint256) {
    throw new Error(`${label} must be a canonical uint256 decimal string`);
  }
  return checked;
}

function requireSourceCommit(label: string, value: unknown): string {
  const checked = requireString(label, value);
  if (!/^[0-9a-f]{40}$/.test(checked) || /^([0-9a-f])\1{39}$/.test(checked)) {
    throw new Error(`${label} must be a concrete full lower-case Git commit SHA`);
  }
  return checked;
}

function requireReviewedAddress(label: string, value: unknown): string {
  const candidate = requireString(label, value);
  if (!ethers.isAddress(candidate)) {
    throw new Error(`${label} must be an Ethereum address`);
  }
  const checked = ethers.getAddress(candidate);
  const numeric = BigInt(checked);
  const lower = checked.toLowerCase();
  if (
    numeric <= 0xffffn ||
    /^0x([0-9a-f])\1{39}$/.test(lower) ||
    /^0x([0-9a-f]{2})\1{19}$/.test(lower)
  ) {
    throw new Error(`${label} must not be a zero, sentinel, burn, or repeated placeholder address`);
  }
  return requireFreshIncidentSafeAddress(label, checked);
}

function parseOptionalContract(label: string, value: unknown): ReviewedOptionalContract {
  const record = requireRecord(label, value);
  const mode = requireString(`${label}.mode`, record.mode);
  if (mode === "none") {
    requireExactKeys(label, record, ["mode"]);
    return { mode };
  }
  if (mode !== "contract") {
    throw new Error(`${label}.mode must be explicitly "none" or "contract"`);
  }
  requireExactKeys(label, record, ["mode", "address", "runtimeCodeHash"]);
  return {
    mode,
    address: requireReviewedAddress(`${label}.address`, record.address),
    runtimeCodeHash: requireRuntimeHash(
      `${label}.runtimeCodeHash`,
      record.runtimeCodeHash,
    ),
  };
}

function parseAuthority(label: string, value: unknown): ReviewedSafeAuthority {
  const record = requireRecord(label, value);
  requireExactKeys(label, record, [
    "address",
    "deployment",
    "safeVersion",
    "proxy",
    "owners",
    "threshold",
    "enabledModules",
    "guard",
    "fallbackHandler",
  ]);
  const address = requireReviewedAddress(`${label}.address`, record.address);
  const deploymentRecord = requireRecord(`${label}.deployment`, record.deployment);
  requireExactKeys(`${label}.deployment`, deploymentRecord, [
    "factoryAddress",
    "transactionHash",
    "blockNumber",
    "blockHash",
    "saltNonce",
  ]);
  const deployment = {
    factoryAddress: requireReviewedAddress(
      `${label}.deployment.factoryAddress`,
      deploymentRecord.factoryAddress,
    ),
    transactionHash: requireBytes32(
      `${label}.deployment.transactionHash`,
      deploymentRecord.transactionHash,
    ),
    blockNumber: requirePositiveBlockNumber(
      `${label}.deployment.blockNumber`,
      deploymentRecord.blockNumber,
    ),
    blockHash: requireBytes32(
      `${label}.deployment.blockHash`,
      deploymentRecord.blockHash,
    ),
    saltNonce: requireUint256String(
      `${label}.deployment.saltNonce`,
      deploymentRecord.saltNonce,
    ),
  };
  if (deployment.factoryAddress === address) {
    throw new Error(`${label} Safe and deployment factory addresses must differ`);
  }
  const safeVersion = requireReviewedText(`${label}.safeVersion`, record.safeVersion);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(safeVersion)) {
    throw new Error(`${label}.safeVersion must be an exact semantic version`);
  }
  if (safeVersion !== PINNED_SAFE_RUNTIME_PROVENANCE.safeVersion) {
    throw new Error(
      `${label}.safeVersion must be the source-reproduced Safe ${PINNED_SAFE_RUNTIME_PROVENANCE.safeVersion} runtime`,
    );
  }

  const proxyRecord = requireRecord(`${label}.proxy`, record.proxy);
  requireExactKeys(`${label}.proxy`, proxyRecord, [
    "kind",
    "runtimeCodeHash",
    "implementationStorageSlot",
    "implementationAddress",
    "implementationRuntimeCodeHash",
    "sourceRepository",
    "sourceRelease",
    "sourceCommit",
  ]);
  if (proxyRecord.kind !== SAFE_PROXY_KIND) {
    throw new Error(`${label}.proxy.kind must be ${SAFE_PROXY_KIND}`);
  }
  if (proxyRecord.implementationStorageSlot !== SAFE_IMPLEMENTATION_STORAGE_SLOT) {
    throw new Error(`${label}.proxy.implementationStorageSlot must be storage slot zero`);
  }
  const sourceRepository = requireReviewedText(
    `${label}.proxy.sourceRepository`,
    proxyRecord.sourceRepository,
  );
  if (sourceRepository !== PINNED_SAFE_RUNTIME_PROVENANCE.sourceRepository) {
    throw new Error(`${label}.proxy.sourceRepository must match the pinned official Safe repository`);
  }
  const sourceRelease = requireReviewedText(
    `${label}.proxy.sourceRelease`,
    proxyRecord.sourceRelease,
  );
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(sourceRelease)) {
    throw new Error(`${label}.proxy.sourceRelease must be an exact v-prefixed release`);
  }
  if (sourceRelease.slice(1) !== safeVersion) {
    throw new Error(`${label}.proxy.sourceRelease must exactly match ${label}.safeVersion`);
  }
  if (sourceRelease !== PINNED_SAFE_RUNTIME_PROVENANCE.sourceRelease) {
    throw new Error(`${label}.proxy.sourceRelease must match the pinned Safe release`);
  }
  const implementationAddress = requireReviewedAddress(
    `${label}.proxy.implementationAddress`,
    proxyRecord.implementationAddress,
  );
  if (implementationAddress === address) {
    throw new Error(`${label} proxy and implementation addresses must differ`);
  }
  if (implementationAddress === deployment.factoryAddress) {
    throw new Error(`${label} Safe factory and singleton implementation addresses must differ`);
  }
  const proxyRuntimeCodeHash = requireRuntimeHash(
    `${label}.proxy.runtimeCodeHash`,
    proxyRecord.runtimeCodeHash,
  );
  const implementationRuntimeCodeHash = requireRuntimeHash(
    `${label}.proxy.implementationRuntimeCodeHash`,
    proxyRecord.implementationRuntimeCodeHash,
  );
  const sourceCommit = requireSourceCommit(
    `${label}.proxy.sourceCommit`,
    proxyRecord.sourceCommit,
  );
  if (
    proxyRuntimeCodeHash !== PINNED_SAFE_RUNTIME_PROVENANCE.proxyRuntimeCodeHash ||
    implementationRuntimeCodeHash !==
      PINNED_SAFE_RUNTIME_PROVENANCE.implementationRuntimeCodeHash ||
    sourceCommit !== PINNED_SAFE_RUNTIME_PROVENANCE.sourceCommit
  ) {
    throw new Error(
      `${label} Safe runtime and source identity must match the pinned, reproducibly reviewed SafeL2 artifact`,
    );
  }

  if (!Array.isArray(record.owners) || record.owners.length < 2 || record.owners.length > 32) {
    throw new Error(`${label}.owners must contain 2 through 32 reviewed owners`);
  }
  const owners = record.owners.map((owner, index) =>
    requireReviewedAddress(`${label}.owners[${index}]`, owner),
  );
  if (new Set(owners.map((owner) => owner.toLowerCase())).size !== owners.length) {
    throw new Error(`${label}.owners must be unique`);
  }
  if (owners.some((owner) => owner === address)) {
    throw new Error(`${label} must not own itself`);
  }
  if (
    owners.includes(implementationAddress) ||
    owners.includes(deployment.factoryAddress)
  ) {
    throw new Error(`${label} owners must not be the Safe singleton or deployment factory`);
  }
  if (
    !Number.isSafeInteger(record.threshold) ||
    (record.threshold as number) < 2 ||
    (record.threshold as number) > owners.length
  ) {
    throw new Error(`${label}.threshold must require 2 through the complete owner count`);
  }

  if (!Array.isArray(record.enabledModules) || record.enabledModules.length > 32) {
    throw new Error(`${label}.enabledModules must be an array of no more than 32 entries`);
  }
  const enabledModules = record.enabledModules.map((moduleValue, index) => {
    const moduleRecord = requireRecord(`${label}.enabledModules[${index}]`, moduleValue);
    requireExactKeys(`${label}.enabledModules[${index}]`, moduleRecord, [
      "address",
      "runtimeCodeHash",
    ]);
    return {
      address: requireReviewedAddress(
        `${label}.enabledModules[${index}].address`,
        moduleRecord.address,
      ),
      runtimeCodeHash: requireRuntimeHash(
        `${label}.enabledModules[${index}].runtimeCodeHash`,
        moduleRecord.runtimeCodeHash,
      ),
    };
  });
  if (
    new Set(enabledModules.map((module) => module.address.toLowerCase())).size !==
    enabledModules.length
  ) {
    throw new Error(`${label}.enabledModules must be unique`);
  }

  const guard = parseOptionalContract(`${label}.guard`, record.guard);
  const fallbackHandler = parseOptionalContract(
    `${label}.fallbackHandler`,
    record.fallbackHandler,
  );
  if (
    enabledModules.length !== 0 ||
    guard.mode !== "none" ||
    fallbackHandler.mode !== "none"
  ) {
    throw new Error(
      `${label} incident-recovery Safe must have no modules, guard, or fallback handler`,
    );
  }
  return {
    address,
    deployment,
    safeVersion,
    proxy: {
      kind: SAFE_PROXY_KIND,
      runtimeCodeHash: proxyRuntimeCodeHash,
      implementationStorageSlot: SAFE_IMPLEMENTATION_STORAGE_SLOT,
      implementationAddress,
      implementationRuntimeCodeHash,
      sourceRepository,
      sourceRelease,
      sourceCommit,
    },
    owners,
    threshold: record.threshold as number,
    enabledModules,
    guard,
    fallbackHandler,
  };
}

export function parseProductionAuthorityInventory(
  input: string | unknown,
): ProductionAuthorityInventory {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      throw new Error(`Production authority inventory is not valid JSON: ${String(error)}`);
    }
  }
  const record = requireRecord("Production authority inventory", value);
  requireExactKeys("Production authority inventory", record, [
    "kind",
    "schemaVersion",
    "status",
    "chainId",
    "review",
    "controller",
    "treasury",
  ]);
  if (record.kind !== PRODUCTION_AUTHORITY_INVENTORY_KIND) {
    throw new Error(`Unexpected production authority inventory kind: ${String(record.kind)}`);
  }
  if (record.schemaVersion !== PRODUCTION_AUTHORITY_INVENTORY_SCHEMA_VERSION) {
    throw new Error(`Unsupported production authority inventory schema: ${String(record.schemaVersion)}`);
  }
  if (record.status !== PRODUCTION_AUTHORITY_INVENTORY_STATUS) {
    throw new Error(
      `Production authority inventory status must be ${PRODUCTION_AUTHORITY_INVENTORY_STATUS}; placeholders remain fail-closed`,
    );
  }
  const chainId = requireString("Production authority inventory chainId", record.chainId);
  if (!/^\d+$/.test(chainId) || BigInt(chainId) !== EXPECTED_CHAIN_ID) {
    throw new Error(`Production authority inventory must target LitVM chain ${EXPECTED_CHAIN_ID}`);
  }

  const reviewRecord = requireRecord("Production authority inventory review", record.review);
  requireExactKeys("Production authority inventory review", reviewRecord, ["approvals"]);
  if (
    !Array.isArray(reviewRecord.approvals) ||
    reviewRecord.approvals.length < 2 ||
    reviewRecord.approvals.length > 8
  ) {
    throw new Error("Production authority inventory requires 2 through 8 independent approvals");
  }
  const approvals = reviewRecord.approvals.map((approvalValue, index) => {
    const label = `Production authority inventory review.approvals[${index}]`;
    const approval = requireRecord(label, approvalValue);
    requireExactKeys(label, approval, ["reviewer", "approvedAt", "evidenceSha256"]);
    return {
      reviewer: requireReviewedText(`${label}.reviewer`, approval.reviewer),
      approvedAt: requireUtcTimestamp(`${label}.approvedAt`, approval.approvedAt),
      evidenceSha256: requireSha256(`${label}.evidenceSha256`, approval.evidenceSha256),
    };
  });
  if (
    new Set(approvals.map((approval) => approval.reviewer.toLowerCase())).size !==
    approvals.length
  ) {
    throw new Error("Production authority inventory approvals require distinct reviewers");
  }
  if (
    new Set(approvals.map((approval) => approval.evidenceSha256)).size !== approvals.length
  ) {
    throw new Error("Production authority inventory approvals require distinct evidence records");
  }

  const controller = parseAuthority("controller", record.controller);
  const treasury = parseAuthority("treasury", record.treasury);
  if (controller.address === treasury.address) {
    throw new Error("Production controller and treasury Safe addresses must be distinct");
  }
  if (
    controller.proxy.implementationAddress !==
    treasury.proxy.implementationAddress
  ) {
    throw new Error(
      "Production controller and treasury must use the same pinned SafeL2 singleton implementation",
    );
  }
  if (controller.deployment.factoryAddress !== treasury.deployment.factoryAddress) {
    throw new Error(
      "Production controller and treasury must use the same pinned SafeProxyFactory runtime",
    );
  }
  if (controller.deployment.transactionHash === treasury.deployment.transactionHash) {
    throw new Error("Production controller and treasury require distinct creation transactions");
  }
  if (
    controller.deployment.factoryAddress === treasury.address ||
    treasury.deployment.factoryAddress === controller.address
  ) {
    throw new Error("Production Safe authorities must not be one another's deployment factory");
  }
  if (
    controller.owners.includes(treasury.address) ||
    treasury.owners.includes(controller.address)
  ) {
    throw new Error("Production controller and treasury Safes must not own one another");
  }
  const controllerExtensions = [
    ...controller.enabledModules.map((module) => module.address),
    ...(controller.guard.mode === "contract" ? [controller.guard.address] : []),
    ...(controller.fallbackHandler.mode === "contract"
      ? [controller.fallbackHandler.address]
      : []),
  ];
  const treasuryExtensions = [
    ...treasury.enabledModules.map((module) => module.address),
    ...(treasury.guard.mode === "contract" ? [treasury.guard.address] : []),
    ...(treasury.fallbackHandler.mode === "contract"
      ? [treasury.fallbackHandler.address]
      : []),
  ];
  if (
    controllerExtensions.includes(treasury.address) ||
    treasuryExtensions.includes(controller.address)
  ) {
    throw new Error(
      "Production controller and treasury Safes must not be configured as one another's modules, guards, or fallback handlers",
    );
  }
  const controllerOwnerSet = [...controller.owners].map((owner) => owner.toLowerCase()).sort();
  const treasuryOwnerSet = [...treasury.owners].map((owner) => owner.toLowerCase()).sort();
  if (JSON.stringify(controllerOwnerSet) === JSON.stringify(treasuryOwnerSet)) {
    throw new Error(
      "Production controller and treasury Safes must not have identical owner sets",
    );
  }
  const sharedOwnerCount = controllerOwnerSet.filter((owner) =>
    treasuryOwnerSet.includes(owner)
  ).length;
  if (sharedOwnerCount >= Math.min(controller.threshold, treasury.threshold)) {
    throw new Error(
      "Shared production Safe owners must not form a signing threshold for either authority",
    );
  }

  return {
    kind: PRODUCTION_AUTHORITY_INVENTORY_KIND,
    schemaVersion: PRODUCTION_AUTHORITY_INVENTORY_SCHEMA_VERSION,
    status: PRODUCTION_AUTHORITY_INVENTORY_STATUS,
    chainId,
    review: { approvals },
    controller,
    treasury,
  };
}

export function loadSourcePinnedProductionAuthorityInventory(): {
  raw: Buffer;
  inventory: ProductionAuthorityInventory;
  inventorySha256: string;
} {
  const inventoryPath = path.resolve(
    CONTRACTS_ROOT,
    PRODUCTION_AUTHORITY_INVENTORY_RELATIVE_PATH,
  );
  const raw = fs.readFileSync(inventoryPath);
  return {
    raw,
    inventory: parseProductionAuthorityInventory(raw.toString("utf8")),
    inventorySha256: sha256(raw),
  };
}

function requirePlanMatch(
  inventory: ProductionAuthorityInventory,
  plan: Pick<ReplacementPlan, "chainId" | "deploymentProfile" | "controller" | "treasury">,
): void {
  if (plan.deploymentProfile !== PRODUCTION_SEPARATED_PROFILE) {
    throw new Error("Production authority inventory may verify only the production deployment profile");
  }
  if (plan.chainId !== inventory.chainId) {
    throw new Error(`Production plan chain ${plan.chainId} differs from authority inventory chain ${inventory.chainId}`);
  }
  for (const [label, actual, expected] of [
    ["controller", plan.controller, inventory.controller.address],
    ["treasury", plan.treasury, inventory.treasury.address],
  ] as const) {
    if (!ethers.isAddress(actual) || ethers.getAddress(actual) !== expected) {
      throw new Error(`Production plan ${label} ${actual} differs from reviewed authority ${expected}`);
    }
  }
}

function storageAddress(label: string, value: string): string {
  if (!ethers.isHexString(value, 32) || !/^0x0{24}[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} storage value is not a canonical address word`);
  }
  return ethers.getAddress(`0x${value.slice(-40)}`);
}

async function requireRuntimeCode(
  provider: Provider,
  label: string,
  address: string,
  expectedHash: string,
  blockNumber: number,
): Promise<string> {
  const code = await provider.getCode(address, blockNumber);
  if (code === "0x") {
    throw new Error(`${label} ${address} is an EOA or nonexistent at block ${blockNumber}`);
  }
  if (!ethers.isHexString(code)) {
    throw new Error(`${label} ${address} returned malformed runtime code`);
  }
  const actualHash = ethers.keccak256(code);
  if (actualHash !== expectedHash) {
    throw new Error(`${label} runtime hash is ${actualHash}; expected ${expectedHash}`);
  }
  return actualHash;
}

async function safeCall(
  provider: Provider,
  authority: ReviewedSafeAuthority,
  functionName: string,
  args: readonly unknown[],
  blockNumber: number,
): Promise<ethers.Result> {
  const data = SAFE_READ_INTERFACE.encodeFunctionData(functionName, args);
  let result: string;
  try {
    result = await provider.call({ to: authority.address, data, blockTag: blockNumber });
  } catch (error) {
    throw new Error(
      `Safe ${authority.address} ${functionName} call failed at block ${blockNumber}: ${String(error)}`,
    );
  }
  try {
    return SAFE_READ_INTERFACE.decodeFunctionResult(functionName, result);
  } catch (error) {
    throw new Error(
      `Safe ${authority.address} ${functionName} returned malformed data: ${String(error)}`,
    );
  }
}

async function verifyOptionalContract(
  provider: Provider,
  label: string,
  expected: ReviewedOptionalContract,
  actual: string,
  blockNumber: number,
): Promise<void> {
  const expectedAddress = expected.mode === "none" ? ethers.ZeroAddress : expected.address;
  if (actual !== expectedAddress) {
    throw new Error(`${label} is ${actual}; expected ${expectedAddress}`);
  }
  if (expected.mode === "contract") {
    await requireRuntimeCode(
      provider,
      label,
      expected.address,
      expected.runtimeCodeHash,
      blockNumber,
    );
  }
}

type PinnedSafeRuntimeFixture = {
  proxyCreationBytecode: string;
};

let pinnedSafeRuntimeFixture: PinnedSafeRuntimeFixture | undefined;

function loadPinnedSafeRuntimeFixture(): PinnedSafeRuntimeFixture {
  if (pinnedSafeRuntimeFixture) return pinnedSafeRuntimeFixture;
  const provenancePath = path.resolve(
    CONTRACTS_ROOT,
    "deployment/safe-v1.4.1-runtime-provenance.json",
  );
  const value = requireRecord(
    "Pinned Safe runtime provenance",
    JSON.parse(fs.readFileSync(provenancePath, "utf8")) as unknown,
  );
  if (
    value.kind !== "lester-labs-pinned-safe-runtime-provenance" ||
    value.schemaVersion !== 1
  ) {
    throw new Error("Pinned Safe runtime provenance has an unexpected identity");
  }
  const source = requireRecord("Pinned Safe source provenance", value.source);
  const npm = requireRecord("Pinned Safe npm provenance", value.npm);
  const build = requireRecord("Pinned Safe build provenance", value.build);
  const factory = requireRecord("Pinned Safe factory provenance", value.factory);
  const proxy = requireRecord("Pinned Safe proxy provenance", value.proxy);
  const implementation = requireRecord(
    "Pinned Safe implementation provenance",
    value.implementation,
  );
  if (
    source.repository !== PINNED_SAFE_RUNTIME_PROVENANCE.sourceRepository ||
    source.release !== PINNED_SAFE_RUNTIME_PROVENANCE.sourceRelease ||
    source.commit !== PINNED_SAFE_RUNTIME_PROVENANCE.sourceCommit ||
    source.tree !== PINNED_SAFE_RUNTIME_PROVENANCE.sourceTree ||
    npm.package !== PINNED_SAFE_RUNTIME_PROVENANCE.npmPackage ||
    npm.version !== PINNED_SAFE_RUNTIME_PROVENANCE.npmVersion ||
    npm.integrity !== PINNED_SAFE_RUNTIME_PROVENANCE.npmIntegrity ||
    npm.tarballSha512 !== PINNED_SAFE_RUNTIME_PROVENANCE.npmTarballSha512 ||
    build.compiler !== PINNED_SAFE_RUNTIME_PROVENANCE.compiler ||
    build.buildInfoSha256 !== PINNED_SAFE_RUNTIME_PROVENANCE.buildInfoSha256 ||
    factory.artifactSha256 !== PINNED_SAFE_RUNTIME_PROVENANCE.factoryArtifactSha256 ||
    factory.runtimeCodeHash !== PINNED_SAFE_RUNTIME_PROVENANCE.factoryRuntimeCodeHash ||
    proxy.artifactSha256 !== PINNED_SAFE_RUNTIME_PROVENANCE.proxyArtifactSha256 ||
    proxy.creationCodeHash !== PINNED_SAFE_RUNTIME_PROVENANCE.proxyCreationCodeHash ||
    proxy.runtimeCodeHash !== PINNED_SAFE_RUNTIME_PROVENANCE.proxyRuntimeCodeHash ||
    implementation.contract !== PINNED_SAFE_RUNTIME_PROVENANCE.implementationContract ||
    implementation.artifactSha256 !==
      PINNED_SAFE_RUNTIME_PROVENANCE.implementationArtifactSha256 ||
    implementation.runtimeCodeHash !==
      PINNED_SAFE_RUNTIME_PROVENANCE.implementationRuntimeCodeHash
  ) {
    throw new Error("Pinned Safe runtime provenance differs from the reviewed release constants");
  }
  const proxyCreationBytecode = requireString(
    "Pinned Safe proxy creation bytecode",
    proxy.creationBytecode,
  );
  const proxyRuntime = requireString(
    "Pinned Safe proxy runtime bytecode",
    proxy.deployedBytecode,
  );
  const factoryRuntime = requireString(
    "Pinned Safe factory runtime bytecode",
    factory.deployedBytecode,
  );
  const implementationRuntime = requireString(
    "Pinned Safe implementation runtime bytecode",
    implementation.deployedBytecode,
  );
  if (
    !ethers.isHexString(proxyCreationBytecode) ||
    ethers.keccak256(proxyCreationBytecode) !==
      PINNED_SAFE_RUNTIME_PROVENANCE.proxyCreationCodeHash ||
    !ethers.isHexString(proxyRuntime) ||
    ethers.keccak256(proxyRuntime) !== PINNED_SAFE_RUNTIME_PROVENANCE.proxyRuntimeCodeHash ||
    !ethers.isHexString(factoryRuntime) ||
    ethers.keccak256(factoryRuntime) !==
      PINNED_SAFE_RUNTIME_PROVENANCE.factoryRuntimeCodeHash ||
    !ethers.isHexString(implementationRuntime) ||
    ethers.keccak256(implementationRuntime) !==
      PINNED_SAFE_RUNTIME_PROVENANCE.implementationRuntimeCodeHash
  ) {
    throw new Error("Pinned Safe runtime bytecode does not match the reviewed artifact hashes");
  }
  pinnedSafeRuntimeFixture = { proxyCreationBytecode };
  return pinnedSafeRuntimeFixture;
}

function expectedSafeInitializer(authority: ReviewedSafeAuthority): string {
  return SAFE_SETUP_INTERFACE.encodeFunctionData("setup", [
    authority.owners,
    BigInt(authority.threshold),
    ethers.ZeroAddress,
    "0x",
    ethers.ZeroAddress,
    ethers.ZeroAddress,
    0n,
    ethers.ZeroAddress,
  ]);
}

function requireCanonicalBlockTimestamp(
  label: string,
  block: { timestamp?: unknown },
): number {
  if (!Number.isSafeInteger(block.timestamp) || (block.timestamp as number) < 0) {
    throw new Error(`${label} is missing an exact canonical timestamp`);
  }
  return block.timestamp as number;
}

async function readSafeHistoryLogs(
  provider: Provider,
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<ethers.Log[]> {
  const logs: ethers.Log[] = [];
  for (let start = fromBlock; start <= toBlock;) {
    const end = Math.min(toBlock, start + SAFE_HISTORY_LOG_BLOCK_SPAN - 1);
    const chunk = await provider.getLogs({ address, fromBlock: start, toBlock: end });
    logs.push(...chunk);
    if (end === toBlock) break;
    start = end + 1;
  }
  logs.sort((left, right) =>
    left.blockNumber === right.blockNumber
      ? left.index - right.index
      : left.blockNumber - right.blockNumber,
  );
  const identities = new Set<string>();
  for (const log of logs) {
    if (
      ethers.getAddress(log.address) !== address ||
      !Number.isSafeInteger(log.blockNumber) ||
      log.blockNumber < fromBlock ||
      log.blockNumber > toBlock ||
      !Number.isSafeInteger(log.index) ||
      log.index < 0 ||
      !ethers.isHexString(log.blockHash, 32) ||
      !ethers.isHexString(log.transactionHash, 32)
    ) {
      throw new Error(`Safe history RPC returned a malformed or cross-address log`);
    }
    const identity = `${log.transactionHash.toLowerCase()}:${log.index}`;
    if (identities.has(identity)) {
      throw new Error(`Safe history RPC returned duplicate log ${identity}`);
    }
    identities.add(identity);
  }
  return logs;
}

function verifyAuthorityReviewFreshness(
  inventory: ProductionAuthorityInventory,
  verificationBlockTimestamp: number,
  latestCreationBlockTimestamp: number,
): void {
  for (const approval of inventory.review.approvals) {
    const approvalTimestamp = Date.parse(approval.approvedAt) / 1_000;
    if (approvalTimestamp <= latestCreationBlockTimestamp) {
      throw new Error(
        `Production authority approval by ${approval.reviewer} does not postdate the latest Safe creation block`,
      );
    }
    if (approvalTimestamp > verificationBlockTimestamp) {
      throw new Error(
        `Production authority approval by ${approval.reviewer} is later than the canonical verification block`,
      );
    }
    if (
      verificationBlockTimestamp - approvalTimestamp >
      PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS
    ) {
      throw new Error(
        `Production authority approval by ${approval.reviewer} is older than the ${PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS}-second review window`,
      );
    }
  }
}

async function verifySafeCreation(
  provider: Provider,
  label: "controller" | "treasury",
  authority: ReviewedSafeAuthority,
  chainId: bigint,
  verificationBlock: number,
): Promise<{
  deploymentBlockTimestamp: number;
  benignSafeReceivedLogCount: number;
}> {
  const deployment = authority.deployment;
  if (deployment.blockNumber > verificationBlock) {
    throw new Error(`${label} Safe was created after the authority verification block`);
  }
  const creationBlock = await provider.getBlock(deployment.blockNumber);
  if (!creationBlock?.hash || creationBlock.hash !== deployment.blockHash) {
    throw new Error(`${label} Safe creation block does not match the reviewed block hash`);
  }
  const deploymentBlockTimestamp = requireCanonicalBlockTimestamp(
    `${label} Safe creation block`,
    creationBlock,
  );
  const codeBeforeCreation = await provider.getCode(
    authority.address,
    deployment.blockNumber - 1,
  );
  if (codeBeforeCreation !== "0x") {
    throw new Error(`${label} Safe code existed before its reviewed creation block`);
  }
  await requireRuntimeCode(
    provider,
    `${label} SafeProxyFactory`,
    deployment.factoryAddress,
    PINNED_SAFE_RUNTIME_PROVENANCE.factoryRuntimeCodeHash,
    deployment.blockNumber,
  );
  await requireRuntimeCode(
    provider,
    `${label} SafeL2 singleton at creation`,
    authority.proxy.implementationAddress,
    PINNED_SAFE_RUNTIME_PROVENANCE.implementationRuntimeCodeHash,
    deployment.blockNumber,
  );

  const initializer = expectedSafeInitializer(authority);
  const expectedFactoryData = SAFE_FACTORY_INTERFACE.encodeFunctionData(
    "createChainSpecificProxyWithNonce",
    [
      authority.proxy.implementationAddress,
      initializer,
      BigInt(deployment.saltNonce),
    ],
  );
  const transaction = await provider.getTransaction(deployment.transactionHash);
  if (
    !transaction ||
    transaction.blockNumber !== deployment.blockNumber ||
    transaction.blockHash !== deployment.blockHash ||
    !transaction.to ||
    ethers.getAddress(transaction.to) !== deployment.factoryAddress ||
    transaction.data.toLowerCase() !== expectedFactoryData.toLowerCase() ||
    transaction.value !== 0n
  ) {
    throw new Error(`${label} Safe creation transaction is not the exact reviewed factory call`);
  }

  const fixture = loadPinnedSafeRuntimeFixture();
  const salt = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint256", "uint256"],
      [ethers.keccak256(initializer), BigInt(deployment.saltNonce), chainId],
    ),
  );
  const deploymentData = ethers.concat([
    fixture.proxyCreationBytecode,
    ethers.zeroPadValue(authority.proxy.implementationAddress, 32),
  ]);
  const predictedAddress = ethers.getCreate2Address(
    deployment.factoryAddress,
    salt,
    ethers.keccak256(deploymentData),
  );
  if (predictedAddress !== authority.address) {
    throw new Error(
      `${label} Safe address is ${authority.address}; canonical CREATE2 derivation is ${predictedAddress}`,
    );
  }
  await requireRuntimeCode(
    provider,
    `${label} Safe proxy at creation`,
    authority.address,
    PINNED_SAFE_RUNTIME_PROVENANCE.proxyRuntimeCodeHash,
    deployment.blockNumber,
  );

  const receipt = await provider.getTransactionReceipt(deployment.transactionHash);
  if (
    !receipt ||
    receipt.status !== 1 ||
    receipt.blockNumber !== deployment.blockNumber ||
    receipt.blockHash !== deployment.blockHash
  ) {
    throw new Error(`${label} Safe creation receipt is missing, failed, or moved blocks`);
  }
  const factoryEvents = receipt.logs.flatMap((log) => {
    if (ethers.getAddress(log.address) !== deployment.factoryAddress) return [];
    try {
      const parsed = SAFE_FACTORY_INTERFACE.parseLog(log);
      return parsed?.name === "ProxyCreation" ? [parsed] : [];
    } catch {
      return [];
    }
  });
  if (
    factoryEvents.length !== 1 ||
    ethers.getAddress(String(factoryEvents[0].args.proxy)) !== authority.address ||
    ethers.getAddress(String(factoryEvents[0].args.singleton)) !==
      authority.proxy.implementationAddress
  ) {
    throw new Error(`${label} Safe creation receipt lacks the exact ProxyCreation event`);
  }

  const safeLogs = await readSafeHistoryLogs(
    provider,
    authority.address,
    deployment.blockNumber,
    verificationBlock,
  );
  let setupEvent: ethers.LogDescription | null = null;
  let setupLog: ethers.Log | null = null;
  let benignSafeReceivedLogCount = 0;
  for (const log of safeLogs) {
    if (log.removed) {
      throw new Error(`${label} Safe history contains a removed/non-canonical log`);
    }
    let parsed: ethers.LogDescription | null;
    try {
      parsed = SAFE_SETUP_INTERFACE.parseLog(log);
    } catch {
      parsed = null;
    }
    if (parsed?.name === "SafeSetup") {
      if (setupEvent) {
        throw new Error(`${label} Safe history contains more than one SafeSetup event`);
      }
      setupEvent = parsed;
      setupLog = log;
      continue;
    }
    if (parsed?.name === "SafeReceived") {
      if (!setupEvent) {
        throw new Error(`${label} Safe emitted SafeReceived before its reviewed SafeSetup`);
      }
      ethers.getAddress(String(parsed.args.sender));
      BigInt(String(parsed.args.value));
      benignSafeReceivedLogCount += 1;
      continue;
    }
    const topic = log.topics[0] ?? "no-topic";
    throw new Error(
      `${label} Safe emitted prohibited execution, approval, configuration, or unknown event ${topic} in transaction ${log.transactionHash}`,
    );
  }
  const setupOwners = setupEvent?.args.owners as readonly string[] | undefined;
  if (
    setupEvent?.name !== "SafeSetup" ||
    !setupLog ||
    setupLog.transactionHash !== deployment.transactionHash ||
    setupLog.blockNumber !== deployment.blockNumber ||
    ethers.getAddress(String(setupEvent.args.initiator)) !== deployment.factoryAddress ||
    !setupOwners ||
    JSON.stringify(setupOwners.map((owner) => ethers.getAddress(owner))) !==
      JSON.stringify(authority.owners) ||
    BigInt(String(setupEvent.args.threshold)) !== BigInt(authority.threshold) ||
    ethers.getAddress(String(setupEvent.args.initializer)) !== ethers.ZeroAddress ||
    ethers.getAddress(String(setupEvent.args.fallbackHandler)) !== ethers.ZeroAddress
  ) {
    throw new Error(`${label} Safe setup event does not match the zero-extension initializer`);
  }
  return { deploymentBlockTimestamp, benignSafeReceivedLogCount };
}

async function verifySafeAuthority(
  provider: Provider,
  label: "controller" | "treasury",
  authority: ReviewedSafeAuthority,
  chainId: bigint,
  blockNumber: number,
): Promise<VerifiedSafeAuthority> {
  const creation = await verifySafeCreation(
    provider,
    label,
    authority,
    chainId,
    blockNumber,
  );
  const proxyRuntimeCodeHash = await requireRuntimeCode(
    provider,
    `${label} Safe proxy`,
    authority.address,
    authority.proxy.runtimeCodeHash,
    blockNumber,
  );
  const implementationWord = await provider.getStorage(
    authority.address,
    authority.proxy.implementationStorageSlot,
    blockNumber,
  );
  const storedImplementation = storageAddress(`${label} implementation`, implementationWord);
  if (storedImplementation !== authority.proxy.implementationAddress) {
    throw new Error(
      `${label} proxy implementation slot contains ${storedImplementation}; expected ${authority.proxy.implementationAddress}`,
    );
  }
  const [masterCopy] = await safeCall(provider, authority, "masterCopy", [], blockNumber);
  const reportedImplementation = ethers.getAddress(String(masterCopy));
  if (reportedImplementation !== authority.proxy.implementationAddress) {
    throw new Error(
      `${label} masterCopy() reports ${reportedImplementation}; expected ${authority.proxy.implementationAddress}`,
    );
  }
  const implementationRuntimeCodeHash = await requireRuntimeCode(
    provider,
    `${label} Safe implementation`,
    authority.proxy.implementationAddress,
    authority.proxy.implementationRuntimeCodeHash,
    blockNumber,
  );

  const [safeVersionValue] = await safeCall(provider, authority, "VERSION", [], blockNumber);
  const safeVersion = String(safeVersionValue);
  if (safeVersion !== authority.safeVersion) {
    throw new Error(`${label} Safe VERSION() is ${safeVersion}; expected ${authority.safeVersion}`);
  }

  const [ownerValues] = await safeCall(provider, authority, "getOwners", [], blockNumber);
  if (!Array.isArray(ownerValues)) {
    throw new Error(`${label} Safe getOwners() did not return an address array`);
  }
  const owners = ownerValues.map((owner) => ethers.getAddress(String(owner)));
  if (JSON.stringify(owners) !== JSON.stringify(authority.owners)) {
    throw new Error(
      `${label} Safe owners are ${owners.join(", ")}; expected ${authority.owners.join(", ")}`,
    );
  }

  const [thresholdValue] = await safeCall(provider, authority, "getThreshold", [], blockNumber);
  const threshold = BigInt(String(thresholdValue));
  if (threshold !== BigInt(authority.threshold)) {
    throw new Error(`${label} Safe threshold is ${threshold}; expected ${authority.threshold}`);
  }
  const [nonceValue] = await safeCall(provider, authority, "nonce", [], blockNumber);
  const nonce = BigInt(String(nonceValue));
  if (nonce !== 0n) {
    throw new Error(`${label} Safe nonce is ${nonce}; a fresh incident-recovery Safe must be unused`);
  }
  for (const owner of owners) {
    if ((await provider.getCode(owner, blockNumber)) !== "0x") {
      throw new Error(`${label} Safe owner ${owner} is a contract; fresh hardware-key EOAs are required`);
    }
  }

  const requestedModulePageSize = BigInt(authority.enabledModules.length + 1);
  const [moduleValues, nextValue] = await safeCall(
    provider,
    authority,
    "getModulesPaginated",
    [SAFE_SENTINEL_MODULES, requestedModulePageSize],
    blockNumber,
  );
  if (!Array.isArray(moduleValues)) {
    throw new Error(`${label} Safe getModulesPaginated() did not return an address array`);
  }
  const enabledModules = moduleValues.map((module) => ethers.getAddress(String(module)));
  const next = ethers.getAddress(String(nextValue));
  if (next !== ethers.getAddress(SAFE_SENTINEL_MODULES)) {
    throw new Error(`${label} Safe has more enabled modules than the reviewed inventory`);
  }
  if (
    JSON.stringify(enabledModules) !==
    JSON.stringify(authority.enabledModules.map((module) => module.address))
  ) {
    throw new Error(
      `${label} Safe enabled modules are ${enabledModules.join(", ")}; expected ${authority.enabledModules.map((module) => module.address).join(", ")}`,
    );
  }
  for (let index = 0; index < authority.enabledModules.length; index += 1) {
    const safeModule = authority.enabledModules[index];
    await requireRuntimeCode(
      provider,
      `${label} enabled module ${index}`,
      safeModule.address,
      safeModule.runtimeCodeHash,
      blockNumber,
    );
  }

  const guard = storageAddress(
    `${label} guard`,
    await provider.getStorage(authority.address, SAFE_GUARD_STORAGE_SLOT, blockNumber),
  );
  await verifyOptionalContract(
    provider,
    `${label} Safe guard`,
    authority.guard,
    guard,
    blockNumber,
  );
  const fallbackHandler = storageAddress(
    `${label} fallback handler`,
    await provider.getStorage(
      authority.address,
      SAFE_FALLBACK_HANDLER_STORAGE_SLOT,
      blockNumber,
    ),
  );
  await verifyOptionalContract(
    provider,
    `${label} Safe fallback handler`,
    authority.fallbackHandler,
    fallbackHandler,
    blockNumber,
  );

  return {
    address: authority.address,
    factoryAddress: authority.deployment.factoryAddress,
    deploymentTransactionHash: authority.deployment.transactionHash,
    deploymentBlockNumber: authority.deployment.blockNumber,
    deploymentBlockHash: authority.deployment.blockHash,
    deploymentBlockTimestamp: creation.deploymentBlockTimestamp,
    saltNonce: authority.deployment.saltNonce,
    proxyRuntimeCodeHash,
    implementationAddress: authority.proxy.implementationAddress,
    implementationRuntimeCodeHash,
    safeVersion,
    owners,
    threshold: Number(threshold),
    nonce: Number(nonce),
    enabledModules,
    guard,
    fallbackHandler,
    benignSafeReceivedLogCount: creation.benignSafeReceivedLogCount,
  };
}

export async function verifyProductionAuthorityInventory(
  inventory: ProductionAuthorityInventory,
  plan: Pick<ReplacementPlan, "chainId" | "deploymentProfile" | "controller" | "treasury">,
  provider: Provider,
  options: {
    blockNumber?: number;
    inventorySha256?: string;
    gasOnlyDeployer: string;
  },
): Promise<ProductionAuthorityVerification> {
  requirePlanMatch(inventory, plan);
  const network = await provider.getNetwork();
  if (network.chainId.toString() !== inventory.chainId) {
    throw new Error(
      `Connected chain ${network.chainId} differs from authority inventory chain ${inventory.chainId}`,
    );
  }
  const blockNumber = options.blockNumber ?? (await provider.getBlockNumber());
  if (!Number.isSafeInteger(blockNumber) || blockNumber <= 0) {
    throw new Error("Production authority verification requires an exact positive block number");
  }
  const before = await provider.getBlock(blockNumber);
  if (!before?.hash || !ethers.isHexString(before.hash, 32)) {
    throw new Error(`Cannot resolve canonical verification block ${blockNumber}`);
  }
  const blockTimestamp = requireCanonicalBlockTimestamp(
    "Production authority verification block",
    before,
  );

  const controller = await verifySafeAuthority(
    provider,
    "controller",
    inventory.controller,
    network.chainId,
    blockNumber,
  );
  const treasury = await verifySafeAuthority(
    provider,
    "treasury",
    inventory.treasury,
    network.chainId,
    blockNumber,
  );
  if (controller.address === treasury.address) {
    throw new Error("Verified production controller and treasury Safe addresses are not distinct");
  }
  verifyAuthorityReviewFreshness(
    inventory,
    blockTimestamp,
    Math.max(
      controller.deploymentBlockTimestamp,
      treasury.deploymentBlockTimestamp,
    ),
  );
  const gasOnlyDeployer = requireFreshIncidentSafeAddress(
    "Gas-only deployer",
    options.gasOnlyDeployer,
  );
  const forbiddenAuthorityAddresses = new Set(
    [
      controller.address,
      treasury.address,
      controller.factoryAddress,
      controller.implementationAddress,
      ...controller.owners,
      ...treasury.owners,
    ].map((address) => address.toLowerCase()),
  );
  if (forbiddenAuthorityAddresses.has(gasOnlyDeployer.toLowerCase())) {
    throw new Error(
      "Gas-only deployer must not be a Safe, singleton, factory, or owner of either authority",
    );
  }
  if ((await provider.getCode(gasOnlyDeployer, blockNumber)) !== "0x") {
    throw new Error("Gas-only deployer must be an EOA at the authority verification block");
  }

  const after = await provider.getBlock(blockNumber);
  if (!after?.hash || after.hash !== before.hash) {
    throw new Error(`Verification block ${blockNumber} changed during authority verification`);
  }
  const inventorySha256 = options.inventorySha256;
  if (!inventorySha256 || !/^0x[0-9a-f]{64}$/.test(inventorySha256)) {
    throw new Error("Production authority verification requires the source inventory SHA-256");
  }
  return {
    inventorySha256,
    chainId: inventory.chainId,
    blockNumber,
    blockHash: before.hash,
    blockTimestamp,
    authorityReviewMaxAgeSeconds: PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS,
    gasOnlyDeployer,
    controller,
    treasury,
  };
}

export async function verifySourcePinnedProductionAuthorities(
  plan: Pick<ReplacementPlan, "chainId" | "deploymentProfile" | "controller" | "treasury">,
  provider: Provider,
  options: { blockNumber?: number; gasOnlyDeployer: string },
): Promise<ProductionAuthorityVerification> {
  const source = loadSourcePinnedProductionAuthorityInventory();
  return verifyProductionAuthorityInventory(source.inventory, plan, provider, {
    ...options,
    inventorySha256: source.inventorySha256,
  });
}
