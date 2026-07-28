import { ethers } from "hardhat";
import type { Log, Provider } from "ethers";
import {
  ADDRESSES,
  RETIRED_TREASURY,
  normalized,
  readExplorerEventLogs,
} from "./live_treasury_audit";

const DEFAULT_LITVM_RPC_URL =
  "https://liteforge.rpc.caldera.xyz/infra-partner-http";
const RPC_BATCH_SIZE = 100;
const RPC_BATCH_CONCURRENCY = 6;
const DIRECT_RPC_CONCURRENCY = 10;

const TOKEN_CREATED_ABI = [
  "event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol)",
] as const;
const OWNERSHIP_TRANSFERRED_ABI = [
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
] as const;
const tokenCreatedEvents = new ethers.Interface(TOKEN_CREATED_ABI);
const ownershipEvents = new ethers.Interface(OWNERSHIP_TRANSFERRED_ABI);
const TOKEN_CREATED_TOPIC = tokenCreatedEvents.getEvent("TokenCreated")!.topicHash;
const OWNERSHIP_TRANSFERRED_TOPIC =
  ownershipEvents.getEvent("OwnershipTransferred")!.topicHash;
const RETIRED_TOPIC = ethers.zeroPadValue(RETIRED_TREASURY, 32);

const TOKEN_ABI = [
  "function owner() view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function mintable() view returns (bool)",
  "function burnable() view returns (bool)",
  "function pausable() view returns (bool)",
] as const;
const ILO_FACTORY_AUDIT_ABI = [
  "function getILOCount() view returns (uint256)",
  "function allILOs(uint256 index) view returns (address)",
] as const;
const CHILD_ILO_ABI = [
  "function owner() view returns (address)",
  "function treasury() view returns (address)",
] as const;
const VESTING_FACTORY_AUDIT_ABI = [
  "function scheduleCount() view returns (uint256)",
] as const;
const VESTING_WALLET_ABI = [
  "function owner() view returns (address)",
] as const;
const LOCKER_AUDIT_ABI = [
  "function lockCount() view returns (uint256)",
  "function getLock(uint256 lockId) view returns (address lpToken, uint256 amount, uint256 unlockTime, address withdrawer, bool withdrawn)",
] as const;
const iloChildInterface = new ethers.Interface(CHILD_ILO_ABI);
const iloFactoryInterface = new ethers.Interface(ILO_FACTORY_AUDIT_ABI);
const vestingWalletInterface = new ethers.Interface(VESTING_WALLET_ABI);
const lockerInterface = new ethers.Interface(LOCKER_AUDIT_ABI);

type BatchedCallRequest<T> = {
  target: string;
  callData: string;
  label: string;
  decode: (returnData: string) => T;
};

export type RetiredTokenAuthority = {
  token: string;
  liveOwner: string;
  name: string;
  symbol: string;
  createdByRetired: boolean;
  runtimeHash: string;
  mintable: boolean;
  burnable: boolean;
  pausable: boolean;
  hasLivePrivilegedControl: boolean;
};

export type RetiredIloAuthority = {
  ilo: string;
  liveOwner: string;
  treasury: string;
};

export type FundedRetiredTreasuryIlo = RetiredIloAuthority & {
  nativeBalance: string;
};

export type RetiredVestingAuthority = {
  id: string;
  wallet: string;
  liveOwner: string;
};

export type RetiredLockAuthority = {
  id: string;
  withdrawer: string;
  withdrawn: boolean;
  unlockTime: string;
  lpToken: string;
  amount: string;
};

export type ChildAuthorityReport = {
  snapshotBlock: number;
  inventoryCounts: {
    retiredTokenCandidates: number;
    ilos: number;
    vestingWallets: number;
    locks: number;
  };
  retiredTokenAuthorities: RetiredTokenAuthority[];
  retiredIloAuthorities: RetiredIloAuthority[];
  retiredIloTreasuryRoutes: string[];
  fundedRetiredTreasuryIlos: FundedRetiredTreasuryIlo[];
  iloRuntimeHashes: Record<string, number>;
  retiredVestingAuthorities: RetiredVestingAuthority[];
  retiredLockAuthorities: RetiredLockAuthority[];
};

function deduplicateAndSort(logs: readonly Log[]): Log[] {
  const unique = new Map<string, Log>();
  for (const log of logs) {
    unique.set(`${normalized(log.transactionHash)}:${log.index}`, log);
  }
  return [...unique.values()].sort((left, right) =>
    left.blockNumber - right.blockNumber || left.index - right.index
  );
}

function parseEvent(
  eventInterface: InstanceType<typeof ethers.Interface>,
  eventName: string,
  log: Log,
) {
  const parsed = eventInterface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed || parsed.name !== eventName) {
    throw new Error(
      `Unable to decode ${eventName} at ${log.transactionHash}:${log.index}`,
    );
  }
  return parsed;
}

async function readRetiredIndexedLogs(
  provider: Provider,
  address: string | undefined,
  topic0: string,
  indexedPosition: 2 | 3,
  snapshotBlock: number,
): Promise<Log[]> {
  return deduplicateAndSort(await readExplorerEventLogs(
    address,
    topic0,
    0,
    snapshotBlock,
    undefined,
    { [indexedPosition]: RETIRED_TOPIC },
  ));
}

async function mapWithConcurrency<T, U>(
  values: readonly T[],
  mapper: (value: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(DIRECT_RPC_CONCURRENCY, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function runBatchedEthCalls<T>(
  snapshotBlock: number,
  requests: readonly BatchedCallRequest<T>[],
  batchSize = RPC_BATCH_SIZE,
): Promise<T[]> {
  const rpcUrl = process.env.LITVM_RPC_URL || DEFAULT_LITVM_RPC_URL;
  const blockTag = ethers.toQuantity(snapshotBlock);
  const executeBatch = async (
    batch: readonly BatchedCallRequest<T>[],
  ): Promise<T[]> => {
    const body = batch.map((request, index) => ({
      jsonrpc: "2.0",
      id: index + 1,
      method: "eth_call",
      params: [
        { to: request.target, data: request.callData },
        blockTag,
      ],
    }));
    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        });
        if (response.ok) break;
        lastError = new Error(`HTTP ${response.status}`);
        response = undefined;
      } catch (error) {
        lastError = error;
      }
    }
    if (!response) {
      throw new Error(
        `Batched child-state RPC failed closed: ${String(lastError)}`,
      );
    }
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) {
      throw new Error("Batched child-state RPC returned a non-array response");
    }
    const byId = new Map<number, { result?: string; error?: unknown }>();
    for (const entry of payload) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as { id?: unknown }).id !== "number"
      ) {
        throw new Error("Batched child-state RPC returned a malformed item");
      }
      const typed = entry as { id: number; result?: string; error?: unknown };
      byId.set(typed.id, typed);
    }
    const batchDecoded: T[] = [];
    for (let index = 0; index < batch.length; index += 1) {
      const entry = byId.get(index + 1);
      if (!entry || entry.error || typeof entry.result !== "string") {
        throw new Error(
          `Batched child-state RPC failed for ${batch[index].label}`,
        );
      }
      batchDecoded.push(batch[index].decode(entry.result));
    }
    return batchDecoded;
  };

  const batches: Array<readonly BatchedCallRequest<T>[]> = [];
  for (let offset = 0; offset < requests.length; offset += batchSize) {
    batches.push(requests.slice(offset, offset + batchSize));
  }
  const decoded: T[] = [];
  for (
    let offset = 0;
    offset < batches.length;
    offset += RPC_BATCH_CONCURRENCY
  ) {
    const group = batches.slice(offset, offset + RPC_BATCH_CONCURRENCY);
    const groupResults = await Promise.all(group.map(executeBatch));
    for (const result of groupResults) decoded.push(...result);
  }
  return decoded;
}

function countToNumber(label: string, count: bigint): number {
  if (count < 0n || count > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} count ${count} cannot be enumerated safely`);
  }
  return Number(count);
}

async function deriveFactoryChildren(
  provider: Provider,
  label: string,
  factory: string,
  count: bigint,
  snapshotBlock: number,
): Promise<string[]> {
  const factoryNonce = BigInt(
    await provider.getTransactionCount(factory, snapshotBlock),
  );
  if (factoryNonce !== count + 1n) {
    throw new Error(
      `${label} nonce is ${factoryNonce} at block ${snapshotBlock}; expected child count + 1 (${count + 1n})`,
    );
  }
  return Array.from(
    { length: countToNumber(label, count) },
    (_, index) =>
      normalized(ethers.getCreateAddress({ from: factory, nonce: index + 1 })),
  );
}

async function readRetiredTokenAuthorities(
  provider: Provider,
  snapshotBlock: number,
): Promise<{
  candidates: number;
  authorities: RetiredTokenAuthority[];
}> {
  const [createdLogs, ownershipLogs] = await Promise.all([
    readRetiredIndexedLogs(
      provider,
      ADDRESSES.tokenFactory,
      TOKEN_CREATED_TOPIC,
      2,
      snapshotBlock,
    ),
    readRetiredIndexedLogs(
      provider,
      undefined,
      OWNERSHIP_TRANSFERRED_TOPIC,
      2,
      snapshotBlock,
    ),
  ]);

  const createdByRetired = new Set(
    createdLogs.map((log) =>
      normalized(
        parseEvent(tokenCreatedEvents, "TokenCreated", log).args
          .tokenAddress as string,
      )
    ),
  );
  const candidates = new Set(createdByRetired);
  for (const log of ownershipLogs) candidates.add(normalized(log.address));

  const possibleTokens = await mapWithConcurrency(
    [...candidates],
    async (address): Promise<RetiredTokenAuthority | undefined> => {
      const token = new ethers.Contract(address, TOKEN_ABI, provider);
      try {
        const [liveOwner, name, symbol, mintable, burnable, pausable, code] =
          await Promise.all([
            token.owner({ blockTag: snapshotBlock }) as Promise<string>,
            token.name({ blockTag: snapshotBlock }) as Promise<string>,
            token.symbol({ blockTag: snapshotBlock }) as Promise<string>,
            token.mintable({ blockTag: snapshotBlock }) as Promise<boolean>,
            token.burnable({ blockTag: snapshotBlock }) as Promise<boolean>,
            token.pausable({ blockTag: snapshotBlock }) as Promise<boolean>,
            provider.getCode(address, snapshotBlock),
          ]);
        const owner = normalized(liveOwner);
        return {
          token: address,
          liveOwner: owner,
          name,
          symbol,
          createdByRetired: createdByRetired.has(address),
          runtimeHash: code === "0x" ? "0x" : ethers.keccak256(code),
          mintable,
          burnable,
          pausable,
          hasLivePrivilegedControl:
            owner === RETIRED_TREASURY && (mintable || pausable),
        };
      } catch {
        return undefined;
      }
    },
  );

  return {
    candidates: candidates.size,
    authorities: possibleTokens.filter(
      (record): record is RetiredTokenAuthority => Boolean(record),
    ),
  };
}

export async function auditLiveChildAuthority(
  provider: Provider,
): Promise<ChildAuthorityReport> {
  const snapshotBlock = await provider.getBlockNumber();
  const iloFactory = new ethers.Contract(
    ADDRESSES.iloFactory,
    ILO_FACTORY_AUDIT_ABI,
    provider,
  );
  const vestingFactory = new ethers.Contract(
    ADDRESSES.vestingFactory,
    VESTING_FACTORY_AUDIT_ABI,
    provider,
  );
  const locker = new ethers.Contract(
    ADDRESSES.liquidityLocker,
    LOCKER_AUDIT_ABI,
    provider,
  );

  const [iloCount, vestingCount, lockCount, tokenAudit] = await Promise.all([
    iloFactory.getILOCount({ blockTag: snapshotBlock }) as Promise<bigint>,
    vestingFactory.scheduleCount({ blockTag: snapshotBlock }) as Promise<bigint>,
    locker.lockCount({ blockTag: snapshotBlock }) as Promise<bigint>,
    readRetiredTokenAuthorities(provider, snapshotBlock),
  ]);
  const [iloAddresses, derivedIloAddresses, vestingAddresses] = await Promise.all([
    runBatchedEthCalls(
      snapshotBlock,
      Array.from({ length: countToNumber("ILOFactory", iloCount) }, (_, index) => ({
        target: ADDRESSES.iloFactory,
        callData: iloFactoryInterface.encodeFunctionData("allILOs", [index]),
        label: `ILOFactory allILOs(${index})`,
        decode: (data: string) =>
          normalized(
            iloFactoryInterface.decodeFunctionResult("allILOs", data)[0] as string,
          ),
      })),
    ),
    deriveFactoryChildren(
      provider,
      "ILOFactory",
      ADDRESSES.iloFactory,
      iloCount,
      snapshotBlock,
    ),
    deriveFactoryChildren(
      provider,
      "VestingFactory",
      ADDRESSES.vestingFactory,
      vestingCount,
      snapshotBlock,
    ),
  ]);
  for (let index = 0; index < iloAddresses.length; index += 1) {
    if (iloAddresses[index] !== derivedIloAddresses[index]) {
      throw new Error(
        `ILOFactory allILOs(${index}) is ${iloAddresses[index]}; CREATE-derived address is ${derivedIloAddresses[index]}`,
      );
    }
  }

  const iloStates = await runBatchedEthCalls(
    snapshotBlock,
    iloAddresses.flatMap((address) => [
      {
        target: address,
        callData: iloChildInterface.encodeFunctionData("owner"),
        label: `ILO ${address} owner`,
        decode: (data: string) =>
          normalized(
            iloChildInterface.decodeFunctionResult("owner", data)[0] as string,
          ),
      },
      {
        target: address,
        callData: iloChildInterface.encodeFunctionData("treasury"),
        label: `ILO ${address} treasury`,
        decode: (data: string) =>
          normalized(
            iloChildInterface.decodeFunctionResult("treasury", data)[0] as string,
          ),
      },
    ]),
  );
  const iloBalances = await mapWithConcurrency(
    iloAddresses,
    (address) => provider.getBalance(address, snapshotBlock),
  );
  const retiredIloAuthorities: RetiredIloAuthority[] = [];
  const retiredIloTreasuryRoutes: string[] = [];
  const fundedRetiredTreasuryIlos: FundedRetiredTreasuryIlo[] = [];
  for (let index = 0; index < iloAddresses.length; index += 1) {
    const liveOwner = iloStates[index * 2];
    const treasury = iloStates[index * 2 + 1];
    const nativeBalance = iloBalances[index];
    if (liveOwner === RETIRED_TREASURY) {
      retiredIloAuthorities.push({
        ilo: iloAddresses[index],
        liveOwner,
        treasury,
      });
    }
    if (treasury === RETIRED_TREASURY) {
      retiredIloTreasuryRoutes.push(iloAddresses[index]);
      if (nativeBalance > 0n) {
        fundedRetiredTreasuryIlos.push({
          ilo: iloAddresses[index],
          liveOwner,
          treasury,
          nativeBalance: String(nativeBalance),
        });
      }
    }
  }
  const iloCodes = await mapWithConcurrency(
    iloAddresses,
    (address) => provider.getCode(address, snapshotBlock),
  );
  const iloRuntimeHashes: Record<string, number> = {};
  for (const code of iloCodes) {
    const hash = code === "0x" ? "0x" : ethers.keccak256(code);
    iloRuntimeHashes[hash] = (iloRuntimeHashes[hash] ?? 0) + 1;
  }

  const vestingOwners = await runBatchedEthCalls(
    snapshotBlock,
    vestingAddresses.map((address) => ({
      target: address,
      callData: vestingWalletInterface.encodeFunctionData("owner"),
      label: `VestingWallet ${address} owner`,
      decode: (data: string) =>
        normalized(
          vestingWalletInterface.decodeFunctionResult("owner", data)[0] as string,
      ),
    })),
  );
  const retiredVestingAuthorities: RetiredVestingAuthority[] = [];
  for (let index = 0; index < vestingAddresses.length; index += 1) {
    if (vestingOwners[index] === RETIRED_TREASURY) {
      retiredVestingAuthorities.push({
        id: String(index),
        wallet: vestingAddresses[index],
        liveOwner: vestingOwners[index],
      });
    }
  }

  const lockCountNumber = countToNumber("LiquidityLocker", lockCount);
  const lockStates = await runBatchedEthCalls(
    snapshotBlock,
    Array.from({ length: lockCountNumber }, (_, id) => ({
      target: ADDRESSES.liquidityLocker,
      callData: lockerInterface.encodeFunctionData("getLock", [id]),
      label: `LiquidityLocker lock ${id}`,
      decode: (data: string) =>
        lockerInterface.decodeFunctionResult("getLock", data),
    })),
  );
  const retiredLockAuthorities: RetiredLockAuthority[] = [];
  for (let id = 0; id < lockStates.length; id += 1) {
    const lock = lockStates[id];
    const withdrawer = normalized(lock[3] as string);
    if (withdrawer === RETIRED_TREASURY) {
      retiredLockAuthorities.push({
        id: String(id),
        lpToken: normalized(lock[0] as string),
        amount: String(lock[1] as bigint),
        unlockTime: String(lock[2] as bigint),
        withdrawer,
        withdrawn: lock[4] as boolean,
      });
    }
  }

  return {
    snapshotBlock,
    inventoryCounts: {
      retiredTokenCandidates: tokenAudit.candidates,
      ilos: iloAddresses.length,
      vestingWallets: vestingAddresses.length,
      locks: lockCountNumber,
    },
    retiredTokenAuthorities: tokenAudit.authorities,
    retiredIloAuthorities,
    retiredIloTreasuryRoutes,
    fundedRetiredTreasuryIlos,
    iloRuntimeHashes,
    retiredVestingAuthorities,
    retiredLockAuthorities,
  };
}

export function assertNoActiveRetiredChildAuthority(
  report: ChildAuthorityReport,
): void {
  const dangerousTokens = report.retiredTokenAuthorities.filter(
    (record) => record.hasLivePrivilegedControl,
  );
  const activeRetiredLocks = report.retiredLockAuthorities.filter(
    (record) => !record.withdrawn,
  );
  const findings = [
    dangerousTokens.length > 0
      ? `${dangerousTokens.length} child token(s) retain usable mint/pause control`
      : "",
    report.retiredIloAuthorities.length > 0
      ? `${report.retiredIloAuthorities.length} ILO(s) retain retired owner authority`
      : "",
    report.retiredVestingAuthorities.length > 0
      ? `${report.retiredVestingAuthorities.length} vesting wallet(s) retain retired beneficiary ownership`
      : "",
    activeRetiredLocks.length > 0
      ? `${activeRetiredLocks.length} active lock(s) retain the retired withdrawer`
      : "",
  ].filter(Boolean);
  if (findings.length > 0) {
    throw new Error(`Retired child authority remains: ${findings.join("; ")}`);
  }
}
