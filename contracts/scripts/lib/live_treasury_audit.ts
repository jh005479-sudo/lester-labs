import { ethers } from "hardhat";
import type { Log, Provider } from "ethers";

export const EXPECTED_CHAIN_ID = 4441n;
export const RETIRED_TREASURY = "0xdd221fbbcb0f6092afe51183d964aa89a968ee13";
export const TARGET_TREASURY = "0xcbf819017ae48f261fe143b2a7c8a29d9a2fcd28";
export const TIMELOCK_DEPLOYMENT_BLOCK = 334_011;
export const TIMELOCK_INVENTORY_CHECKPOINT_BLOCK = 34_083_003;
export const TIMELOCK_INVENTORY_CHECKPOINT_HASH =
  "0xcc68c1c3208354963a12e9a51f1682572a40baa2b65faecf0a14a524f9e11e2b";

export const ADDRESSES = {
  iloFactory: "0xa533bbe87bdcd91e4367de517e99bf8ba75fd0ab",
  tokenFactory: "0x93acc61fcdc2e3407a0c03450adfd8ae78964948",
  vestingFactory: "0x6ee07118d39e9330ef0658ffa797eedd2cb823cf",
  liquidityLocker: "0x80d88c7f529d256e5e6a2cb0e0c30d82bc8827a9",
  ledger: "0xa37ff4bab59a5f861b48527a946c433dc1ee8079",
  uniswapV2Factory: "0x017a126a44aaae9273f7963d4e295f0ee2793ad8",
  uniswapV2Router: "0xd56a623890b083d876d47c3b1c5343b7f983fa62",
  wrappedZkLtc: "0xd141a5dde1a3a373b7e9bb603362a58793ab9d97",
  disperse: "0x3cc66cb4713dca78564df512922adb331ac5ee04",
  legacyConnector: "0x720a547a29f1c86e0ef0be5864faf14a69e894fd",
  litGovToken: "0xa5111cedc04554676dbcca39f2268070008c7a8a",
  litGovernor: "0x5b0092996ba897617b46d42b3f108b253be9ad3d",
  litTimelock: "0xd38ed693730db3eb22ba6d6f0050fc45ac9240ba",
} as const;

/**
 * extcodehash values independently captured from the live LitVM deployments
 * on 2026-07-27. These attest the exact reviewed runtime, not merely the
 * absence of one standard proxy storage layout.
 */
export const EXPECTED_RUNTIME_HASHES: Record<keyof typeof ADDRESSES, string> = {
  iloFactory: "0x9c52ccc3cf932eeff5f19c65d7055f9c8eaa50b68e64a1e1e6bafebaf0e81b9a",
  tokenFactory: "0x5b3bb2e693021e2ab040b6bf248785eb627600bbec002e87c10e138521be1d9d",
  vestingFactory: "0x96f1c281dcb7a5a69cb007f511067ac08cf39811fc1d5b92864fb3f455ed2e73",
  liquidityLocker: "0xfa5c90c1aee9f3f2606cf1a04b3a4a742ac2950dbf09e0d2e67412d311786c8a",
  ledger: "0x5bfae473fddc1457d06edc1c5603f0217b0b3debdc34969abe1611b386fb4233",
  uniswapV2Factory: "0xce41e64702f625a6e52ba7d0406293e089078d3e6bdaf68d7fa8587f951453ee",
  uniswapV2Router: "0x0bd1cb8135296ff81274635a526cf4bacb32aee80ea0938899ea64294e2bba8a",
  wrappedZkLtc: "0x8c18c51fd322d08ccd34df2b97420cc87b004e738da9363d35a38cc2be761b05",
  disperse: "0x0a002cb14450c22d20885e40fec35bc924e0229f91b7b359c926850b10548891",
  legacyConnector: "0xddb0ce4525768177261872afa458a433d0fb2a312d23325c46fabc29d398ed4e",
  litGovToken: "0xf2f5e1ca1b5b7f82dc5a7dd2544e8b8d6d06deda8259e8f7ec908e99e460d94c",
  litGovernor: "0x07257ea685127e008299cc168253f764bc24456fe8ca11a5d162a66a57706d8b",
  litTimelock: "0xfb6edd3916b02720e51e48ca654186b058d296236f7d3a6de76aae46964dfdba",
};

export const EXPECTED_CONFIG = {
  iloRouter: ADDRESSES.uniswapV2Router,
  iloPlatformFeeBps: 200n,
  iloCreationFee: 30_000_000_000_000_000n,
  tokenCreationFee: 50_000_000_000_000_000n,
  vestingFee: 30_000_000_000_000_000n,
  lockFee: 30_000_000_000_000_000n,
  ledgerMinFee: 10_000_000_000_000_000n,
  ledgerTreasuryCutBps: 5_000n,
  timelockMinDelay: 172_800n,
  governanceTotalSupply: 10_000_000n * 10n ** 18n,
} as const;

const TIMELOCK_EVENT_ABI = [
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
  "event CallScheduled(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data, bytes32 predecessor, uint256 delay)",
  "event CallExecuted(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data)",
  "event Cancelled(bytes32 indexed id)",
] as const;

const timelockEvents = new ethers.Interface(TIMELOCK_EVENT_ABI);
const relevantTopics = [
  timelockEvents.getEvent("RoleGranted")!.topicHash,
  timelockEvents.getEvent("RoleRevoked")!.topicHash,
  timelockEvents.getEvent("CallScheduled")!.topicHash,
  timelockEvents.getEvent("CallExecuted")!.topicHash,
  timelockEvents.getEvent("Cancelled")!.topicHash,
];

const INITIAL_LOG_CHUNK = 250_000;
const MINIMUM_LOG_CHUNK = 10_000;
const LOG_QUERY_CONCURRENCY = 4;
const DEFAULT_EXPLORER_API_URL = "https://liteforge.explorer.caldera.xyz/api";
const EXPLORER_PAGE_SIZE = 1_000;

type TimelockRoleLogTuple = readonly [
  blockNumber: number,
  transactionHash: string,
  logIndex: number,
  eventName: "RoleGranted" | "RoleRevoked",
  role: string,
  account: string,
  sender: string,
  data: "0x",
];

/**
 * Complete role history through the pinned checkpoint. It was independently
 * reconciled against Blockscout and a full deployment-to-checkpoint scan from
 * https://rpc.lite-node.com. The checkpoint block hash was also matched
 * against the configured canonical Caldera RPC.
 */
export const PINNED_TIMELOCK_BASELINE_LOGS: readonly TimelockRoleLogTuple[] = [
  [
    334_011,
    "0x9a7a8647f9cb986713872a0e217541aef2d82a4215238a4e02c47cb7aeffeddd",
    0,
    "RoleGranted",
    ethers.ZeroHash,
    ADDRESSES.litTimelock,
    RETIRED_TREASURY,
    "0x",
  ],
  [
    334_011,
    "0x9a7a8647f9cb986713872a0e217541aef2d82a4215238a4e02c47cb7aeffeddd",
    1,
    "RoleGranted",
    ethers.ZeroHash,
    RETIRED_TREASURY,
    RETIRED_TREASURY,
    "0x",
  ],
  [
    334_011,
    "0x9a7a8647f9cb986713872a0e217541aef2d82a4215238a4e02c47cb7aeffeddd",
    2,
    "RoleGranted",
    "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1",
    RETIRED_TREASURY,
    RETIRED_TREASURY,
    "0x",
  ],
  [
    334_011,
    "0x9a7a8647f9cb986713872a0e217541aef2d82a4215238a4e02c47cb7aeffeddd",
    3,
    "RoleGranted",
    "0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783",
    RETIRED_TREASURY,
    RETIRED_TREASURY,
    "0x",
  ],
  [
    334_011,
    "0x9a7a8647f9cb986713872a0e217541aef2d82a4215238a4e02c47cb7aeffeddd",
    4,
    "RoleGranted",
    "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63",
    RETIRED_TREASURY,
    RETIRED_TREASURY,
    "0x",
  ],
  [
    334_029,
    "0xbb2924ccab385280bee3990d7171cd94ee31685fab83ba3130e87697d14fba8f",
    0,
    "RoleGranted",
    "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1",
    ADDRESSES.litGovernor,
    RETIRED_TREASURY,
    "0x",
  ],
  [
    334_035,
    "0xc65b0e718eda0980b8616112281eb9a89021c35bf040bdc0bb4d6556c0d0c723",
    5,
    "RoleRevoked",
    "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63",
    RETIRED_TREASURY,
    RETIRED_TREASURY,
    "0x",
  ],
  [
    334_042,
    "0x49a7de95b72cb97239f4ed08ebc8edea59a0137ab819c1100f5538a05667f1f0",
    0,
    "RoleRevoked",
    "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1",
    RETIRED_TREASURY,
    RETIRED_TREASURY,
    "0x",
  ],
] as const;

export const PINNED_TIMELOCK_BASELINE_DIGEST =
  "0x3231e7a8f5dd2023d855f735d206091458c3826694f30a0f450f1dc02e6f65e5";

export type TimelockInventory = {
  roleHolders: Map<string, Set<string>>;
  roleAccountsEver: Map<string, Set<string>>;
  scheduledOperationIds: Set<string>;
  fromBlock: number;
  toBlock: number;
};

export function normalized(value: string): string {
  return value.toLowerCase();
}

export function timelockBaselineDigest(): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(PINNED_TIMELOCK_BASELINE_LOGS)),
  );
}

function pinnedTimelockInventory(): TimelockInventory {
  if (timelockBaselineDigest() !== PINNED_TIMELOCK_BASELINE_DIGEST) {
    throw new Error("Pinned Timelock baseline digest does not match its reviewed event tuples");
  }

  const inventory: TimelockInventory = {
    roleHolders: new Map(),
    roleAccountsEver: new Map(),
    scheduledOperationIds: new Set(),
    fromBlock: TIMELOCK_DEPLOYMENT_BLOCK,
    toBlock: TIMELOCK_INVENTORY_CHECKPOINT_BLOCK,
  };
  for (
    const [
      ,
      ,
      ,
      eventName,
      rawRole,
      rawAccount,
    ] of PINNED_TIMELOCK_BASELINE_LOGS
  ) {
    const role = normalized(rawRole);
    const account = normalized(rawAccount);
    const holders = inventory.roleHolders.get(role) ?? new Set<string>();
    const ever = inventory.roleAccountsEver.get(role) ?? new Set<string>();
    ever.add(account);
    if (eventName === "RoleGranted") holders.add(account);
    else holders.delete(account);
    inventory.roleHolders.set(role, holders);
    inventory.roleAccountsEver.set(role, ever);
  }
  return inventory;
}

export function expectedTargetVotingPower(
  delegate: string,
  targetBalance: bigint,
): bigint {
  const normalizedDelegate = normalized(delegate);
  if (normalizedDelegate === normalized(ethers.ZeroAddress)) return 0n;
  if (normalizedDelegate === TARGET_TREASURY) return targetBalance;
  throw new Error(
    `Approved treasury delegates governance power to unexpected third party ${delegate}`,
  );
}

export async function attestPinnedRuntime(provider: Provider): Promise<void> {
  for (const [label, address] of Object.entries(ADDRESSES) as Array<
    [keyof typeof ADDRESSES, string]
  >) {
    const code = await provider.getCode(address);
    if (code === "0x") {
      throw new Error(`${label} has no deployed bytecode at ${address}`);
    }
    const actualHash = ethers.keccak256(code);
    const expectedHash = EXPECTED_RUNTIME_HASHES[label];
    if (actualHash !== expectedHash) {
      throw new Error(
        `${label} runtime hash is ${actualHash}; expected audited hash ${expectedHash}`,
      );
    }
    console.log(`[ok] ${label}: pinned runtime ${actualHash}`);
  }
}

async function getLogsWithRetry(
  provider: Provider,
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<Log[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await provider.getLogs({
        address,
        topics: [relevantTopics],
        fromBlock,
        toBlock,
      });
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        console.warn(`[retry] Timelock logs ${fromBlock}-${toBlock}`);
      }
    }
  }

  if (toBlock - fromBlock + 1 <= MINIMUM_LOG_CHUNK) {
    throw new Error(
      `Unable to inventory Timelock logs for ${fromBlock}-${toBlock}; refusing an incomplete audit: ${String(lastError)}`,
    );
  }

  const midpoint = Math.floor((fromBlock + toBlock) / 2);
  const [left, right] = await Promise.all([
    getLogsWithRetry(provider, address, fromBlock, midpoint),
    getLogsWithRetry(provider, address, midpoint + 1, toBlock),
  ]);
  return [...left, ...right];
}

async function readTimelockLogsFromRpc(
  provider: Provider,
  fromBlock: number,
  toBlock: number,
): Promise<Log[]> {
  if (fromBlock > toBlock) return [];

  const ranges: Array<[number, number]> = [];
  for (let start = fromBlock; start <= toBlock; start += INITIAL_LOG_CHUNK) {
    ranges.push([start, Math.min(toBlock, start + INITIAL_LOG_CHUNK - 1)]);
  }

  const logs: Log[] = [];
  for (let offset = 0; offset < ranges.length; offset += LOG_QUERY_CONCURRENCY) {
    const group = ranges.slice(offset, offset + LOG_QUERY_CONCURRENCY);
    const results = await Promise.all(
      group.map(([start, end]) =>
        getLogsWithRetry(provider, ADDRESSES.litTimelock, start, end),
      ),
    );
    for (const result of results) logs.push(...result);
  }

  logs.sort((left, right) =>
    left.blockNumber - right.blockNumber || left.index - right.index
  );
  return logs;
}

export async function readExplorerEventLogs(
  address: string | undefined,
  topic: string,
  fromBlock: number,
  toBlock: number,
  baseUrl = process.env.LITVM_EXPLORER_API_URL || DEFAULT_EXPLORER_API_URL,
  indexedTopics: Partial<Record<1 | 2 | 3, string>> = {},
): Promise<Log[]> {
  const logs: Log[] = [];
  const seenLogKeys = new Set<string>();
  for (let page = 1; ; page += 1) {
    const url = new URL(baseUrl);
    url.searchParams.set("module", "logs");
    url.searchParams.set("action", "getLogs");
    url.searchParams.set("fromBlock", String(fromBlock));
    url.searchParams.set("toBlock", String(toBlock));
    if (address) url.searchParams.set("address", address);
    url.searchParams.set("topic0", topic);
    for (const [position, value] of Object.entries(indexedTopics)) {
      url.searchParams.set(`topic${position}`, value);
      url.searchParams.set(`topic0_${position}_opr`, "and");
    }
    url.searchParams.set("page", String(page));
    url.searchParams.set("offset", String(EXPLORER_PAGE_SIZE));

    let response: Response | undefined;
    let lastFetchError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        });
        break;
      } catch (error) {
        lastFetchError = error;
        if (attempt < 3) {
          console.warn(`[retry] Explorer event inventory page ${page}`);
        }
      }
    }
    if (!response) {
      throw new Error(
        `Explorer event inventory request failed closed: ${String(lastFetchError)}`,
      );
    }
    if (!response.ok) {
      throw new Error(`Explorer event inventory returned HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      message?: string;
      result?: unknown;
      status?: string;
    };
    if (!Array.isArray(payload.result)) {
      const noRecords = payload.status === "0" && /no (logs|records)/i.test(payload.message ?? "");
      if (noRecords) break;
      throw new Error(`Explorer event inventory was incomplete: ${JSON.stringify(payload)}`);
    }

    const pageLogs = payload.result.map((entry) => {
      const raw = entry as {
        address: string;
        blockNumber: string;
        data: string;
        logIndex: string;
        topics: Array<string | null>;
        transactionHash: string;
        transactionIndex: string;
      };
      if (
        !raw.address ||
        (address && normalized(raw.address) !== normalized(address)) ||
        !raw.blockNumber ||
        !raw.logIndex ||
        !Array.isArray(raw.topics) ||
        normalized(raw.topics[0] ?? "") !== normalized(topic) ||
        !raw.transactionHash
      ) {
        throw new Error("Explorer returned a malformed or cross-contract event log");
      }
      const topics = raw.topics.filter(
        (value): value is string => typeof value === "string",
      );
      return {
        address: raw.address,
        blockHash: ethers.ZeroHash,
        blockNumber: Number(BigInt(raw.blockNumber)),
        data: raw.data,
        index: Number(BigInt(raw.logIndex)),
        removed: false,
        topics,
        transactionHash: raw.transactionHash,
        transactionIndex: Number(BigInt(raw.transactionIndex)),
      } as unknown as Log;
    });
    const unseenPageLogs = pageLogs.filter((log) => {
      const key = `${normalized(log.transactionHash)}:${log.index}`;
      if (seenLogKeys.has(key)) return false;
      seenLogKeys.add(key);
      return true;
    });
    if (pageLogs.length === EXPLORER_PAGE_SIZE && unseenPageLogs.length === 0) {
      throw new Error(
        "Explorer repeated a full event page; refusing to treat pagination as complete",
      );
    }
    logs.push(...unseenPageLogs);
    if (pageLogs.length < EXPLORER_PAGE_SIZE) break;
  }
  return logs;
}

export async function readTimelockLogs(
  provider: Provider,
  fromBlock: number,
  toBlock: number,
): Promise<Log[]> {
  if (fromBlock > toBlock) return [];
  // Authority inventory must not depend on an explorer indexer returning every
  // historical grant. Query the canonical RPC from the verified deployment
  // boundary to the pinned head, splitting ranges and failing closed on any
  // range that cannot be read.
  return readTimelockLogsFromRpc(provider, fromBlock, toBlock);
}

export function applyTimelockLogs(
  inventory: TimelockInventory,
  logs: readonly Log[],
  toBlock: number,
): void {
  for (const log of logs) {
    const parsed = timelockEvents.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) {
      throw new Error(`Unable to decode Timelock log ${log.transactionHash}:${log.index}`);
    }

    if (parsed.name === "RoleGranted" || parsed.name === "RoleRevoked") {
      const role = normalized(parsed.args.role as string);
      const account = normalized(parsed.args.account as string);
      const holders = inventory.roleHolders.get(role) ?? new Set<string>();
      const ever = inventory.roleAccountsEver.get(role) ?? new Set<string>();
      ever.add(account);
      if (parsed.name === "RoleGranted") holders.add(account);
      else holders.delete(account);
      inventory.roleHolders.set(role, holders);
      inventory.roleAccountsEver.set(role, ever);
    } else if (parsed.name === "CallScheduled") {
      inventory.scheduledOperationIds.add(normalized(parsed.args.id as string));
    }
  }
  inventory.toBlock = toBlock;
}

export async function inventoryTimelock(
  provider: Provider,
  fromBlock = TIMELOCK_DEPLOYMENT_BLOCK,
  toBlock?: number,
): Promise<TimelockInventory> {
  const lastBlock = toBlock ?? await provider.getBlockNumber();
  if (fromBlock === TIMELOCK_DEPLOYMENT_BLOCK) {
    const [codeBefore, codeAtDeployment] = await Promise.all([
      provider.getCode(ADDRESSES.litTimelock, TIMELOCK_DEPLOYMENT_BLOCK - 1),
      provider.getCode(ADDRESSES.litTimelock, TIMELOCK_DEPLOYMENT_BLOCK),
    ]);
    if (codeBefore !== "0x" || codeAtDeployment === "0x") {
      throw new Error("Pinned LitTimelock deployment block boundary did not verify");
    }
  }

  if (
    fromBlock === TIMELOCK_DEPLOYMENT_BLOCK &&
    lastBlock >= TIMELOCK_INVENTORY_CHECKPOINT_BLOCK
  ) {
    const checkpoint = await provider.getBlock(TIMELOCK_INVENTORY_CHECKPOINT_BLOCK);
    if (
      !checkpoint?.hash ||
      normalized(checkpoint.hash) !== TIMELOCK_INVENTORY_CHECKPOINT_HASH
    ) {
      throw new Error(
        `LitTimelock inventory checkpoint hash is ${checkpoint?.hash ?? "missing"}; expected ${TIMELOCK_INVENTORY_CHECKPOINT_HASH}`,
      );
    }
    const inventory = pinnedTimelockInventory();
    const deltaLogs = await readTimelockLogs(
      provider,
      TIMELOCK_INVENTORY_CHECKPOINT_BLOCK + 1,
      lastBlock,
    );
    applyTimelockLogs(inventory, deltaLogs, lastBlock);
    return inventory;
  }

  const inventory: TimelockInventory = {
    roleHolders: new Map(),
    roleAccountsEver: new Map(),
    scheduledOperationIds: new Set(),
    fromBlock,
    toBlock: fromBlock - 1,
  };
  const logs = await readTimelockLogs(provider, fromBlock, lastBlock);
  applyTimelockLogs(inventory, logs, lastBlock);
  return inventory;
}

export async function extendTimelockInventory(
  provider: Provider,
  inventory: TimelockInventory,
  toBlock?: number,
): Promise<void> {
  const lastBlock = toBlock ?? await provider.getBlockNumber();
  // The delta is small enough for a direct, bounded RPC query.
  const logs = await readTimelockLogsFromRpc(
    provider,
    inventory.toBlock + 1,
    lastBlock,
  );
  applyTimelockLogs(inventory, logs, lastBlock);
}

export function holdersFor(inventory: TimelockInventory, role: string): Set<string> {
  return inventory.roleHolders.get(normalized(role)) ?? new Set<string>();
}

export function expectedRoleHolders(roles: {
  adminRole: string;
  proposerRole: string;
  executorRole: string;
  cancellerRole: string;
}): Map<string, Set<string>> {
  return new Map([
    [
      normalized(roles.adminRole),
      new Set([normalized(ADDRESSES.litTimelock), TARGET_TREASURY]),
    ],
    [normalized(roles.proposerRole), new Set([normalized(ADDRESSES.litGovernor)])],
    [normalized(roles.executorRole), new Set([normalized(ADDRESSES.litGovernor)])],
    [normalized(roles.cancellerRole), new Set([TARGET_TREASURY])],
  ]);
}

export function assertExactRoleInventory(
  inventory: TimelockInventory,
  expected: Map<string, Set<string>>,
): void {
  for (const [role, expectedHolders] of expected) {
    const actualHolders = holdersFor(inventory, role);
    const actual = [...actualHolders].sort();
    const wanted = [...expectedHolders].sort();
    if (actual.length !== wanted.length || actual.some((value, index) => value !== wanted[index])) {
      throw new Error(
        `Timelock role ${role} holders are [${actual.join(", ")}]; expected [${wanted.join(", ")}]`,
      );
    }
  }
}
