import { expect } from "chai";
import { ethers, type Provider, type TransactionRequest } from "ethers";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DISPOSABLE_TESTNET_SIGNER_TREASURY,
  PRODUCTION_SEPARATED_PROFILE,
} from "../scripts/lib/post_compromise_replacement.js";
import {
  PINNED_SAFE_RUNTIME_PROVENANCE,
  PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS,
  PRODUCTION_AUTHORITY_INVENTORY_STATUS,
  parseProductionAuthorityInventory,
  verifyProductionAuthorityInventory,
  type ProductionAuthorityInventory,
  type ReviewedSafeAuthority,
} from "../scripts/lib/production_authority_verifier.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAFE_RUNTIME_PROVENANCE = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../deployment/safe-v1.4.1-runtime-provenance.json"),
    "utf8",
  ),
) as {
  factory: { deployedBytecode: string; runtimeCodeHash: string };
  proxy: {
    creationBytecode: string;
    creationCodeHash: string;
    deployedBytecode: string;
    runtimeCodeHash: string;
  };
  implementation: { deployedBytecode: string; runtimeCodeHash: string };
};
const SAFE_INTERFACE = new ethers.Interface([
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
const SAFE_SECURITY_EVENT_INTERFACE = new ethers.Interface([
  "event ApproveHash(bytes32 indexed approvedHash,address indexed owner)",
]);
const SAFE_FACTORY_INTERFACE = new ethers.Interface([
  "function createChainSpecificProxyWithNonce(address singleton,bytes initializer,uint256 saltNonce) returns (address proxy)",
  "event ProxyCreation(address indexed proxy,address singleton)",
]);
const SAFE_SENTINEL_MODULES = "0x0000000000000000000000000000000000000001";
const SAFE_GUARD_STORAGE_SLOT = ethers.keccak256(
  ethers.toUtf8Bytes("guard_manager.guard.address"),
);
const SAFE_FALLBACK_HANDLER_STORAGE_SLOT = ethers.keccak256(
  ethers.toUtf8Bytes("fallback_manager.handler.address"),
);
const PROXY_CODE = SAFE_RUNTIME_PROVENANCE.proxy.deployedBytecode;
const IMPLEMENTATION_CODE = SAFE_RUNTIME_PROVENANCE.implementation.deployedBytecode;
const FACTORY_CODE = SAFE_RUNTIME_PROVENANCE.factory.deployedBytecode;
const EXTENSION_CODE = "0x60026000526001601ff3";
const BLOCK_NUMBER = 1_234_567;
const BLOCK_HASH = ethers.keccak256(ethers.toUtf8Bytes("authority-verification-block"));
const BLOCK_TIMESTAMP = Date.parse("2026-08-10T21:10:00Z") / 1_000;
const INVENTORY_SHA256 = ethers.keccak256(ethers.toUtf8Bytes("source-inventory"));
const CHAIN_ID = 4441n;

function contractAddress(prefix: string, suffix: string): string {
  return ethers.getAddress(
    `0x${prefix}${"0".repeat(40 - prefix.length - suffix.length)}${suffix}`,
  );
}

function utcTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toISOString().replace(".000Z", "Z");
}

const IMPLEMENTATION = contractAddress("30", "3003");
const FACTORY = contractAddress("31", "3103");
const GAS_ONLY_DEPLOYER = contractAddress("32", "3203");
const CONTROLLER_OWNERS = [
  contractAddress("40", "4001"),
  contractAddress("40", "4002"),
  contractAddress("40", "4003"),
];
const TREASURY_OWNERS = [
  contractAddress("50", "5001"),
  contractAddress("50", "5002"),
  contractAddress("50", "5003"),
];
const CONTROLLER_CREATION_BLOCK = BLOCK_NUMBER - 20;
const TREASURY_CREATION_BLOCK = BLOCK_NUMBER - 19;
const CONTROLLER_BLOCK_HASH = ethers.keccak256(
  ethers.toUtf8Bytes("controller-creation-block"),
);
const CONTROLLER_BLOCK_TIMESTAMP = Date.parse("2026-08-10T20:45:00Z") / 1_000;
const TREASURY_BLOCK_HASH = ethers.keccak256(
  ethers.toUtf8Bytes("treasury-creation-block"),
);
const TREASURY_BLOCK_TIMESTAMP = Date.parse("2026-08-10T20:46:00Z") / 1_000;
const CONTROLLER_TRANSACTION_HASH = ethers.keccak256(
  ethers.toUtf8Bytes("controller-creation-transaction"),
);
const TREASURY_TRANSACTION_HASH = ethers.keccak256(
  ethers.toUtf8Bytes("treasury-creation-transaction"),
);

function safeInitializer(owners: string[]): string {
  return SAFE_SETUP_INTERFACE.encodeFunctionData("setup", [
    owners,
    2n,
    ethers.ZeroAddress,
    "0x",
    ethers.ZeroAddress,
    ethers.ZeroAddress,
    0n,
    ethers.ZeroAddress,
  ]);
}

function safeAddress(owners: string[], saltNonce: bigint): string {
  const initializer = safeInitializer(owners);
  const salt = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint256", "uint256"],
      [ethers.keccak256(initializer), saltNonce, CHAIN_ID],
    ),
  );
  return ethers.getCreate2Address(
    FACTORY,
    salt,
    ethers.keccak256(
      ethers.concat([
        SAFE_RUNTIME_PROVENANCE.proxy.creationBytecode,
        ethers.zeroPadValue(IMPLEMENTATION, 32),
      ]),
    ),
  );
}

const CONTROLLER = safeAddress(CONTROLLER_OWNERS, 101n);
const TREASURY = safeAddress(TREASURY_OWNERS, 202n);

function authority(
  address: string,
  owners: string[],
  deployment: {
    transactionHash: string;
    blockNumber: number;
    blockHash: string;
    saltNonce: string;
  },
): Record<string, unknown> {
  return {
    address,
    deployment: {
      factoryAddress: FACTORY,
      ...deployment,
    },
    safeVersion: "1.4.1",
    proxy: {
      kind: "safe-proxy-storage-slot-0",
      runtimeCodeHash: ethers.keccak256(PROXY_CODE),
      implementationStorageSlot: ethers.ZeroHash,
      implementationAddress: IMPLEMENTATION,
      implementationRuntimeCodeHash: ethers.keccak256(IMPLEMENTATION_CODE),
      sourceRepository: "https://github.com/safe-fndn/safe-smart-account",
      sourceRelease: "v1.4.1",
      sourceCommit: "bf943f80fec5ac647159d26161446ac5d716a294",
    },
    owners,
    threshold: 2,
    enabledModules: [],
    guard: { mode: "none" },
    fallbackHandler: { mode: "none" },
  };
}

function inventoryObject(): Record<string, unknown> {
  return {
    kind: "lester-labs-production-authority-inventory",
    schemaVersion: 1,
    status: PRODUCTION_AUTHORITY_INVENTORY_STATUS,
    chainId: "4441",
    review: {
      approvals: [
        {
          reviewer: "security-reviewer-one@example.invalid",
          approvedAt: "2026-08-10T21:00:00Z",
          evidenceSha256: ethers.keccak256(
            ethers.toUtf8Bytes("independent-review-evidence-one"),
          ),
        },
        {
          reviewer: "security-reviewer-two@example.invalid",
          approvedAt: "2026-08-10T21:05:00Z",
          evidenceSha256: ethers.keccak256(
            ethers.toUtf8Bytes("independent-review-evidence-two"),
          ),
        },
      ],
    },
    controller: authority(CONTROLLER, CONTROLLER_OWNERS, {
      transactionHash: CONTROLLER_TRANSACTION_HASH,
      blockNumber: CONTROLLER_CREATION_BLOCK,
      blockHash: CONTROLLER_BLOCK_HASH,
      saltNonce: "101",
    }),
    treasury: authority(TREASURY, TREASURY_OWNERS, {
      transactionHash: TREASURY_TRANSACTION_HASH,
      blockNumber: TREASURY_CREATION_BLOCK,
      blockHash: TREASURY_BLOCK_HASH,
      saltNonce: "202",
    }),
  };
}

function plan(inventory: ProductionAuthorityInventory) {
  return {
    chainId: inventory.chainId,
    deploymentProfile: PRODUCTION_SEPARATED_PROFILE,
    controller: inventory.controller.address,
    treasury: inventory.treasury.address,
  } as const;
}

class FakeAuthorityProvider {
  readonly codes = new Map<string, string>();
  readonly createdAt = new Map<string, number>();
  readonly storage = new Map<string, string>();
  readonly calls = new Map<string, string>();
  readonly blocks = new Map<number, { hash: string; timestamp: number }>([
    [BLOCK_NUMBER, { hash: BLOCK_HASH, timestamp: BLOCK_TIMESTAMP }],
    [
      CONTROLLER_CREATION_BLOCK,
      { hash: CONTROLLER_BLOCK_HASH, timestamp: CONTROLLER_BLOCK_TIMESTAMP },
    ],
    [
      TREASURY_CREATION_BLOCK,
      { hash: TREASURY_BLOCK_HASH, timestamp: TREASURY_BLOCK_TIMESTAMP },
    ],
  ]);
  readonly transactions = new Map<string, Record<string, unknown>>();
  readonly receipts = new Map<string, Record<string, unknown>>();
  readonly logs: Record<string, unknown>[] = [];
  chainId = CHAIN_ID;
  blockHash = BLOCK_HASH;

  private key(address: string, suffix: string): string {
    return `${ethers.getAddress(address).toLowerCase()}:${suffix.toLowerCase()}`;
  }

  setCode(address: string, code: string, createdAt?: number): void {
    const normalized = ethers.getAddress(address).toLowerCase();
    this.codes.set(normalized, code);
    if (createdAt !== undefined) this.createdAt.set(normalized, createdAt);
  }

  setStorage(address: string, slot: string, value: string): void {
    this.storage.set(this.key(address, ethers.toBeHex(slot, 32)), value);
  }

  setCall(address: string, functionName: string, values: readonly unknown[]): void {
    const selector = SAFE_INTERFACE.getFunction(functionName)!.selector;
    this.calls.set(
      this.key(address, selector),
      SAFE_INTERFACE.encodeFunctionResult(functionName, values),
    );
  }

  setSafe(expected: ReviewedSafeAuthority): void {
    this.setCode(
      expected.address,
      PROXY_CODE,
      expected.deployment.blockNumber,
    );
    this.setCode(expected.proxy.implementationAddress, IMPLEMENTATION_CODE);
    this.setCode(expected.deployment.factoryAddress, FACTORY_CODE);
    this.setStorage(
      expected.address,
      ethers.ZeroHash,
      ethers.zeroPadValue(expected.proxy.implementationAddress, 32),
    );
    this.setStorage(expected.address, SAFE_GUARD_STORAGE_SLOT, ethers.ZeroHash);
    this.setStorage(expected.address, SAFE_FALLBACK_HANDLER_STORAGE_SLOT, ethers.ZeroHash);
    this.setCall(expected.address, "masterCopy", [expected.proxy.implementationAddress]);
    this.setCall(expected.address, "VERSION", [expected.safeVersion]);
    this.setCall(expected.address, "getOwners", [expected.owners]);
    this.setCall(expected.address, "getThreshold", [BigInt(expected.threshold)]);
    this.setCall(expected.address, "nonce", [0n]);
    this.setCall(expected.address, "getModulesPaginated", [
      expected.enabledModules.map((module) => module.address),
      SAFE_SENTINEL_MODULES,
    ]);

    const initializer = safeInitializer(expected.owners);
    const transactionData = SAFE_FACTORY_INTERFACE.encodeFunctionData(
      "createChainSpecificProxyWithNonce",
      [
        expected.proxy.implementationAddress,
        initializer,
        BigInt(expected.deployment.saltNonce),
      ],
    );
    this.transactions.set(expected.deployment.transactionHash, {
      blockNumber: expected.deployment.blockNumber,
      blockHash: expected.deployment.blockHash,
      to: expected.deployment.factoryAddress,
      data: transactionData,
      value: 0n,
    });
    const factoryEvent = SAFE_FACTORY_INTERFACE.encodeEventLog(
      SAFE_FACTORY_INTERFACE.getEvent("ProxyCreation")!,
      [expected.address, expected.proxy.implementationAddress],
    );
    const setupEvent = SAFE_SETUP_INTERFACE.encodeEventLog(
      SAFE_SETUP_INTERFACE.getEvent("SafeSetup")!,
      [
        expected.deployment.factoryAddress,
        expected.owners,
        BigInt(expected.threshold),
        ethers.ZeroAddress,
        ethers.ZeroAddress,
      ],
    );
    const factoryLog = {
      address: expected.deployment.factoryAddress,
      topics: factoryEvent.topics,
      data: factoryEvent.data,
      transactionHash: expected.deployment.transactionHash,
      blockNumber: expected.deployment.blockNumber,
      blockHash: expected.deployment.blockHash,
      index: 1,
    };
    const setupLog = {
      address: expected.address,
      topics: setupEvent.topics,
      data: setupEvent.data,
      transactionHash: expected.deployment.transactionHash,
      blockNumber: expected.deployment.blockNumber,
      blockHash: expected.deployment.blockHash,
      index: 0,
    };
    this.logs.push(setupLog);
    this.receipts.set(expected.deployment.transactionHash, {
      status: 1,
      blockNumber: expected.deployment.blockNumber,
      blockHash: expected.deployment.blockHash,
      logs: [setupLog, factoryLog],
    });
  }

  async getNetwork(): Promise<{ chainId: bigint }> {
    return { chainId: this.chainId };
  }

  async getBlockNumber(): Promise<number> {
    return BLOCK_NUMBER;
  }

  async getBlock(blockNumber: number): Promise<{ hash: string; timestamp: number } | null> {
    if (blockNumber === BLOCK_NUMBER) {
      return { hash: this.blockHash, timestamp: BLOCK_TIMESTAMP };
    }
    return this.blocks.get(blockNumber) ?? null;
  }

  async getCode(address: string, blockTag?: number): Promise<string> {
    const normalized = ethers.getAddress(address).toLowerCase();
    const creationBlock = this.createdAt.get(normalized);
    if (creationBlock !== undefined && blockTag !== undefined && blockTag < creationBlock) {
      return "0x";
    }
    return this.codes.get(normalized) ?? "0x";
  }

  async getStorage(address: string, position: string, blockTag?: number): Promise<string> {
    expect(blockTag).to.equal(BLOCK_NUMBER);
    return this.storage.get(this.key(address, ethers.toBeHex(position, 32))) ?? ethers.ZeroHash;
  }

  async call(transaction: TransactionRequest): Promise<string> {
    expect(transaction.blockTag).to.equal(BLOCK_NUMBER);
    const address = ethers.getAddress(String(transaction.to));
    const selector = String(transaction.data).slice(0, 10);
    const result = this.calls.get(this.key(address, selector));
    if (!result) throw new Error(`Unconfigured call ${address}:${selector}`);
    return result;
  }

  async getTransaction(hash: string): Promise<Record<string, unknown> | null> {
    return this.transactions.get(hash) ?? null;
  }

  async getTransactionReceipt(hash: string): Promise<Record<string, unknown> | null> {
    return this.receipts.get(hash) ?? null;
  }

  async getLogs(filter: {
    address?: string;
    fromBlock?: number;
    toBlock?: number;
  }): Promise<Record<string, unknown>[]> {
    const address = filter.address ? ethers.getAddress(filter.address).toLowerCase() : undefined;
    return this.logs.filter((log) => {
      const blockNumber = Number(log.blockNumber);
      return (
        (!address || ethers.getAddress(String(log.address)).toLowerCase() === address) &&
        (filter.fromBlock === undefined || blockNumber >= filter.fromBlock) &&
        (filter.toBlock === undefined || blockNumber <= filter.toBlock)
      );
    });
  }

  asProvider(): Provider {
    return this as unknown as Provider;
  }
}

function configuredProvider(inventory: ProductionAuthorityInventory): FakeAuthorityProvider {
  const provider = new FakeAuthorityProvider();
  provider.setSafe(inventory.controller);
  provider.setSafe(inventory.treasury);
  return provider;
}

async function verify(
  inventory: ProductionAuthorityInventory,
  provider: FakeAuthorityProvider,
) {
  return verifyProductionAuthorityInventory(
    inventory,
    plan(inventory),
    provider.asProvider(),
    {
      inventorySha256: INVENTORY_SHA256,
      gasOnlyDeployer: GAS_ONLY_DEPLOYER,
    },
  );
}

async function expectRejection(promise: Promise<unknown>, message: string): Promise<void> {
  let rejection: unknown;
  try {
    await promise;
  } catch (error) {
    rejection = error;
  }
  expect(rejection).to.be.instanceOf(Error);
  expect((rejection as Error).message).to.include(message);
}

describe("production Safe authority verifier", function () {
  it("pins the checked-in runtime fixture to the independently reviewed Safe release", function () {
    expect(ethers.keccak256(PROXY_CODE)).to.equal(
      PINNED_SAFE_RUNTIME_PROVENANCE.proxyRuntimeCodeHash,
    );
    expect(ethers.keccak256(IMPLEMENTATION_CODE)).to.equal(
      PINNED_SAFE_RUNTIME_PROVENANCE.implementationRuntimeCodeHash,
    );
    expect(SAFE_RUNTIME_PROVENANCE.proxy.runtimeCodeHash).to.equal(
      PINNED_SAFE_RUNTIME_PROVENANCE.proxyRuntimeCodeHash,
    );
    expect(SAFE_RUNTIME_PROVENANCE.implementation.runtimeCodeHash).to.equal(
      PINNED_SAFE_RUNTIME_PROVENANCE.implementationRuntimeCodeHash,
    );
    expect(IMPLEMENTATION_CODE.toLowerCase()).to.include(
      SAFE_SETUP_INTERFACE.getEvent("SafeReceived")!.topicHash.slice(2).toLowerCase(),
    );
  });

  it("keeps the committed placeholder inventory fail-closed", function () {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../deployment/production-authorities.json"),
      "utf8",
    );
    expect(() => parseProductionAuthorityInventory(source)).to.throw(
      "status must be REVIEWED_FOR_PRODUCTION",
    );
  });

  it("accepts only an exact reviewed inventory and verifies every pinned Safe fact", async function () {
    const inventory = parseProductionAuthorityInventory(inventoryObject());
    const report = await verify(inventory, configuredProvider(inventory));

    expect(report.chainId).to.equal("4441");
    expect(report.blockNumber).to.equal(BLOCK_NUMBER);
    expect(report.blockHash).to.equal(BLOCK_HASH);
    expect(report.blockTimestamp).to.equal(BLOCK_TIMESTAMP);
    expect(report.authorityReviewMaxAgeSeconds).to.equal(
      PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS,
    );
    expect(report.inventorySha256).to.equal(INVENTORY_SHA256);
    expect(report.gasOnlyDeployer).to.equal(GAS_ONLY_DEPLOYER);
    expect(report.controller.address).to.equal(CONTROLLER);
    expect(report.controller.factoryAddress).to.equal(FACTORY);
    expect(report.controller.deploymentTransactionHash).to.equal(
      CONTROLLER_TRANSACTION_HASH,
    );
    expect(report.controller.deploymentBlockNumber).to.equal(
      CONTROLLER_CREATION_BLOCK,
    );
    expect(report.controller.deploymentBlockTimestamp).to.equal(
      CONTROLLER_BLOCK_TIMESTAMP,
    );
    expect(report.controller.owners).to.deep.equal(CONTROLLER_OWNERS);
    expect(report.controller.threshold).to.equal(2);
    expect(report.controller.nonce).to.equal(0);
    expect(report.controller.enabledModules).to.deep.equal([]);
    expect(report.controller.guard).to.equal(ethers.ZeroAddress);
    expect(report.controller.fallbackHandler).to.equal(ethers.ZeroAddress);
    expect(report.controller.benignSafeReceivedLogCount).to.equal(0);
    expect(report.treasury.address).to.equal(TREASURY);
  });

  it("uses renewable canonical-time review freshness instead of a chain-rate block limit", async function () {
    const source = inventoryObject();
    const oldCreationBlock = BLOCK_NUMBER - 25_000;
    const oldCreationBlockHash = ethers.keccak256(
      ethers.toUtf8Bytes("old-but-unused-controller-creation-block"),
    );
    const controller = source.controller as Record<string, unknown>;
    const deployment = controller.deployment as Record<string, unknown>;
    deployment.blockNumber = oldCreationBlock;
    deployment.blockHash = oldCreationBlockHash;
    const inventory = parseProductionAuthorityInventory(source);
    const provider = configuredProvider(inventory);
    provider.blocks.set(oldCreationBlock, {
      hash: oldCreationBlockHash,
      timestamp: BLOCK_TIMESTAMP - 24 * 60 * 60,
    });

    const report = await verify(inventory, provider);
    expect(report.controller.deploymentBlockNumber).to.equal(oldCreationBlock);
    expect(report.controller.nonce).to.equal(0);
  });

  it("rejects reviews made before creation, in the future, or outside the renewal window", async function () {
    const beforeCreationSource = inventoryObject();
    const beforeCreationApprovals = ((beforeCreationSource.review as Record<string, unknown>)
      .approvals as Record<string, unknown>[]);
    beforeCreationApprovals[0].approvedAt = "2026-08-10T20:46:00Z";
    const beforeCreationInventory = parseProductionAuthorityInventory(beforeCreationSource);
    await expectRejection(
      verify(beforeCreationInventory, configuredProvider(beforeCreationInventory)),
      "does not postdate the latest Safe creation block",
    );

    const futureSource = inventoryObject();
    const futureApprovals = ((futureSource.review as Record<string, unknown>)
      .approvals as Record<string, unknown>[]);
    futureApprovals[0].approvedAt = "2026-08-10T22:00:00Z";
    const futureInventory = parseProductionAuthorityInventory(futureSource);
    await expectRejection(
      verify(futureInventory, configuredProvider(futureInventory)),
      "later than the canonical verification block",
    );

    const staleSource = inventoryObject();
    const staleApprovals = ((staleSource.review as Record<string, unknown>)
      .approvals as Record<string, unknown>[]);
    const staleApprovalTimestamp =
      BLOCK_TIMESTAMP - PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS - 1;
    for (const approval of staleApprovals) {
      approval.approvedAt = utcTimestamp(staleApprovalTimestamp);
    }
    const staleInventory = parseProductionAuthorityInventory(staleSource);
    const staleProvider = configuredProvider(staleInventory);
    staleProvider.blocks.set(CONTROLLER_CREATION_BLOCK, {
      hash: CONTROLLER_BLOCK_HASH,
      timestamp: staleApprovalTimestamp - 60,
    });
    staleProvider.blocks.set(TREASURY_CREATION_BLOCK, {
      hash: TREASURY_BLOCK_HASH,
      timestamp: staleApprovalTimestamp - 30,
    });
    await expectRejection(
      verify(staleInventory, staleProvider),
      `older than the ${PRODUCTION_AUTHORITY_REVIEW_MAX_AGE_SECONDS}-second review window`,
    );
  });

  it("rejects zero, sentinel, disclosed, single-signer, and unreviewed inventory fields", function () {
    const zeroAddress = inventoryObject();
    (zeroAddress.controller as Record<string, unknown>).address = ethers.ZeroAddress;
    expect(() => parseProductionAuthorityInventory(zeroAddress)).to.throw(
      "zero, sentinel, burn, or repeated placeholder",
    );

    const disclosed = inventoryObject();
    (disclosed.controller as Record<string, unknown>).address =
      DISPOSABLE_TESTNET_SIGNER_TREASURY;
    expect(() => parseProductionAuthorityInventory(disclosed)).to.throw(
      "incident-compromised or chat-disclosed",
    );

    const singleSigner = inventoryObject();
    (singleSigner.controller as Record<string, unknown>).threshold = 1;
    expect(() => parseProductionAuthorityInventory(singleSigner)).to.throw(
      "threshold must require 2",
    );

    const unreviewedHash = inventoryObject();
    ((unreviewedHash.controller as Record<string, unknown>).proxy as Record<string, unknown>)
      .runtimeCodeHash = ethers.ZeroHash;
    expect(() => parseProductionAuthorityInventory(unreviewedHash)).to.throw(
      "non-zero lower-case keccak256 runtime hash",
    );

    const releaseMismatch = inventoryObject();
    ((releaseMismatch.controller as Record<string, unknown>).proxy as Record<string, unknown>)
      .sourceRelease = "v1.5.0";
    expect(() => parseProductionAuthorityInventory(releaseMismatch)).to.throw(
      "must exactly match controller.safeVersion",
    );

    const customCompatibleRuntime = inventoryObject();
    ((customCompatibleRuntime.controller as Record<string, unknown>).proxy as Record<string, unknown>)
      .implementationRuntimeCodeHash = ethers.keccak256(EXTENSION_CODE);
    expect(() => parseProductionAuthorityInventory(customCompatibleRuntime)).to.throw(
      "must match the pinned, reproducibly reviewed SafeL2 artifact",
    );

    const falseOfficialCommit = inventoryObject();
    ((falseOfficialCommit.controller as Record<string, unknown>).proxy as Record<string, unknown>)
      .sourceCommit = "cf943f80fec5ac647159d26161446ac5d716a294";
    expect(() => parseProductionAuthorityInventory(falseOfficialCommit)).to.throw(
      "must match the pinned, reproducibly reviewed SafeL2 artifact",
    );

    const duplicateReviewer = inventoryObject();
    const approvals = ((duplicateReviewer.review as Record<string, unknown>)
      .approvals as Record<string, unknown>[]);
    approvals[1].reviewer = approvals[0].reviewer;
    expect(() => parseProductionAuthorityInventory(duplicateReviewer)).to.throw(
      "approvals require distinct reviewers",
    );

    const identicalOwners = inventoryObject();
    (identicalOwners.treasury as Record<string, unknown>).owners = [
      ...CONTROLLER_OWNERS,
    ].reverse();
    expect(() => parseProductionAuthorityInventory(identicalOwners)).to.throw(
      "must not have identical owner sets",
    );

    const sharedQuorum = inventoryObject();
    (sharedQuorum.treasury as Record<string, unknown>).owners = [
      CONTROLLER_OWNERS[0],
      CONTROLLER_OWNERS[1],
      TREASURY_OWNERS[2],
    ];
    expect(() => parseProductionAuthorityInventory(sharedQuorum)).to.throw(
      "must not form a signing threshold",
    );

    const differentSingletons = inventoryObject();
    ((differentSingletons.treasury as Record<string, unknown>).proxy as Record<string, unknown>)
      .implementationAddress = contractAddress("33", "3303");
    expect(() => parseProductionAuthorityInventory(differentSingletons)).to.throw(
      "same pinned SafeL2 singleton implementation",
    );
  });

  it("rejects a plan mismatch, wrong connected chain, and conflicting proxy identity", async function () {
    const inventory = parseProductionAuthorityInventory(inventoryObject());
    const provider = configuredProvider(inventory);
    await expectRejection(
      verifyProductionAuthorityInventory(
        inventory,
        { ...plan(inventory), treasury: CONTROLLER },
        provider.asProvider(),
        {
          inventorySha256: INVENTORY_SHA256,
          gasOnlyDeployer: GAS_ONLY_DEPLOYER,
        },
      ),
      "differs from reviewed authority",
    );

    const wrongChainProvider = configuredProvider(inventory);
    wrongChainProvider.chainId = 1n;
    await expectRejection(
      verify(inventory, wrongChainProvider),
      "Connected chain 1 differs from authority inventory chain 4441",
    );

    const masterCopyProvider = configuredProvider(inventory);
    masterCopyProvider.setCall(inventory.controller.address, "masterCopy", [
      contractAddress("60", "6006"),
    ]);
    await expectRejection(
      verify(inventory, masterCopyProvider),
      "masterCopy() reports",
    );
  });

  it("rejects an EOA, proxy implementation drift, owner drift, and threshold drift", async function () {
    const inventory = parseProductionAuthorityInventory(inventoryObject());

    const eoaProvider = configuredProvider(inventory);
    eoaProvider.setCode(inventory.controller.address, "0x");
    await expectRejection(verify(inventory, eoaProvider), "is an EOA or nonexistent");

    const implementationProvider = configuredProvider(inventory);
    implementationProvider.setStorage(
      inventory.controller.address,
      ethers.ZeroHash,
      ethers.zeroPadValue(contractAddress("60", "6006"), 32),
    );
    await expectRejection(
      verify(inventory, implementationProvider),
      "proxy implementation slot contains",
    );

    const ownersProvider = configuredProvider(inventory);
    ownersProvider.setCall(inventory.controller.address, "getOwners", [
      [...CONTROLLER_OWNERS].reverse(),
    ]);
    await expectRejection(verify(inventory, ownersProvider), "Safe owners are");

    const thresholdProvider = configuredProvider(inventory);
    thresholdProvider.setCall(inventory.controller.address, "getThreshold", [3n]);
    await expectRejection(verify(inventory, thresholdProvider), "Safe threshold is 3");
  });

  it("rejects unsafe creation history, used Safes, contract owners, and a privileged gas deployer", async function () {
    const inventory = parseProductionAuthorityInventory(inventoryObject());

    const alteredInitializerProvider = configuredProvider(inventory);
    const alteredTransaction = alteredInitializerProvider.transactions.get(
      inventory.controller.deployment.transactionHash,
    )!;
    alteredTransaction.data = "0x";
    await expectRejection(
      verify(inventory, alteredInitializerProvider),
      "not the exact reviewed factory call",
    );

    const preexistingCodeProvider = configuredProvider(inventory);
    preexistingCodeProvider.createdAt.set(
      inventory.controller.address.toLowerCase(),
      inventory.controller.deployment.blockNumber - 1,
    );
    await expectRejection(
      verify(inventory, preexistingCodeProvider),
      "code existed before its reviewed creation block",
    );

    const extraHistoryProvider = configuredProvider(inventory);
    const approvalEvent = SAFE_SECURITY_EVENT_INTERFACE.encodeEventLog(
      SAFE_SECURITY_EVENT_INTERFACE.getEvent("ApproveHash")!,
      [
        ethers.keccak256(ethers.toUtf8Bytes("unexpected-safe-approval")),
        CONTROLLER_OWNERS[0],
      ],
    );
    extraHistoryProvider.logs.push({
      address: inventory.controller.address,
      topics: approvalEvent.topics,
      data: approvalEvent.data,
      transactionHash: ethers.keccak256(ethers.toUtf8Bytes("unexpected-safe-history")),
      blockNumber: BLOCK_NUMBER - 1,
      blockHash: ethers.keccak256(ethers.toUtf8Bytes("unexpected-safe-history-block")),
      index: 2,
    });
    await expectRejection(
      verify(inventory, extraHistoryProvider),
      "emitted prohibited execution, approval, configuration, or unknown event",
    );

    const usedSafeProvider = configuredProvider(inventory);
    usedSafeProvider.setCall(inventory.controller.address, "nonce", [1n]);
    await expectRejection(
      verify(inventory, usedSafeProvider),
      "fresh incident-recovery Safe must be unused",
    );

    const contractOwnerProvider = configuredProvider(inventory);
    contractOwnerProvider.setCode(CONTROLLER_OWNERS[0], EXTENSION_CODE);
    await expectRejection(
      verify(inventory, contractOwnerProvider),
      "fresh hardware-key EOAs are required",
    );

    await expectRejection(
      verifyProductionAuthorityInventory(
        inventory,
        plan(inventory),
        configuredProvider(inventory).asProvider(),
        {
          inventorySha256: INVENTORY_SHA256,
          gasOnlyDeployer: CONTROLLER_OWNERS[0],
        },
      ),
      "Gas-only deployer must not be",
    );
  });

  it("allows unsolicited native dust without weakening Safe history or state checks", async function () {
    const inventory = parseProductionAuthorityInventory(inventoryObject());
    const provider = configuredProvider(inventory);
    const receivedEvent = SAFE_SETUP_INTERFACE.encodeEventLog(
      SAFE_SETUP_INTERFACE.getEvent("SafeReceived")!,
      [contractAddress("80", "8008"), 1n],
    );
    provider.logs.push({
      address: inventory.controller.address,
      topics: receivedEvent.topics,
      data: receivedEvent.data,
      transactionHash: ethers.keccak256(ethers.toUtf8Bytes("unsolicited-native-dust")),
      blockNumber: BLOCK_NUMBER - 1,
      blockHash: ethers.keccak256(ethers.toUtf8Bytes("native-dust-block")),
      index: 4,
    });

    const report = await verify(inventory, provider);
    expect(report.controller.benignSafeReceivedLogCount).to.equal(1);
    expect(report.controller.nonce).to.equal(0);
    expect(report.controller.enabledModules).to.deep.equal([]);
    expect(report.controller.guard).to.equal(ethers.ZeroAddress);
    expect(report.controller.fallbackHandler).to.equal(ethers.ZeroAddress);
  });

  it("rejects any module, guard, fallback-handler, or implementation-code drift", async function () {
    const inventory = parseProductionAuthorityInventory(inventoryObject());
    const unexpectedExtension = contractAddress("70", "7007");

    const moduleProvider = configuredProvider(inventory);
    moduleProvider.setCall(inventory.controller.address, "getModulesPaginated", [
      [unexpectedExtension],
      SAFE_SENTINEL_MODULES,
    ]);
    await expectRejection(verify(inventory, moduleProvider), "Safe enabled modules are");

    const guardProvider = configuredProvider(inventory);
    guardProvider.setStorage(
      inventory.controller.address,
      SAFE_GUARD_STORAGE_SLOT,
      ethers.zeroPadValue(unexpectedExtension, 32),
    );
    await expectRejection(verify(inventory, guardProvider), "Safe guard is");

    const fallbackProvider = configuredProvider(inventory);
    fallbackProvider.setStorage(
      inventory.controller.address,
      SAFE_FALLBACK_HANDLER_STORAGE_SLOT,
      ethers.zeroPadValue(unexpectedExtension, 32),
    );
    await expectRejection(
      verify(inventory, fallbackProvider),
      "Safe fallback handler is",
    );

    const implementationCodeProvider = configuredProvider(inventory);
    implementationCodeProvider.setCode(IMPLEMENTATION, "0x60026000526001601ff3");
    await expectRejection(
      verify(inventory, implementationCodeProvider),
      "SafeL2 singleton at creation runtime hash is",
    );
  });

  it("rejects modules, guards, and fallback handlers even when their runtime is declared", function () {
    const reviewedExtensions = inventoryObject();
    const controller = reviewedExtensions.controller as Record<string, unknown>;
    const moduleAddress = contractAddress("70", "7007");
    const guardAddress = contractAddress("71", "7107");
    const fallbackHandlerAddress = contractAddress("72", "7207");
    controller.enabledModules = [
      {
        address: moduleAddress,
        runtimeCodeHash: ethers.keccak256(EXTENSION_CODE),
      },
    ];
    controller.guard = {
      mode: "contract",
      address: guardAddress,
      runtimeCodeHash: ethers.keccak256(EXTENSION_CODE),
    };
    controller.fallbackHandler = {
      mode: "contract",
      address: fallbackHandlerAddress,
      runtimeCodeHash: ethers.keccak256(EXTENSION_CODE),
    };

    expect(() => parseProductionAuthorityInventory(reviewedExtensions)).to.throw(
      "must have no modules, guard, or fallback handler",
    );
  });
});
