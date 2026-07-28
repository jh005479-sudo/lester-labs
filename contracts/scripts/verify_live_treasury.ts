import { ethers } from "hardhat";
import type { Contract } from "ethers";
import {
  ADDRESSES,
  EXPECTED_CHAIN_ID,
  EXPECTED_CONFIG,
  RETIRED_TREASURY,
  TARGET_TREASURY,
  assertExactRoleInventory,
  attestPinnedRuntime,
  expectedRoleHolders,
  expectedTargetVotingPower,
  holdersFor,
  inventoryTimelock,
  normalized,
  type TimelockInventory,
} from "./lib/live_treasury_audit";
import {
  assertNoActiveRetiredChildAuthority,
  auditLiveChildAuthority,
} from "./lib/live_child_authority_audit";

const ZERO_STORAGE = `0x${"00".repeat(32)}`;
const EIP1967_SLOTS = {
  implementation: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  admin: "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  beacon: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
} as const;

const OWNABLE_ABI = ["function owner() view returns (address)"] as const;
const ILO_FACTORY_ABI = [
  ...OWNABLE_ABI,
  "function treasury() view returns (address)",
  "function router() view returns (address)",
  "function platformFeeBps() view returns (uint256)",
  "function creationFee() view returns (uint256)",
] as const;
const TOKEN_FACTORY_ABI = [
  ...OWNABLE_ABI,
  "function creationFee() view returns (uint256)",
] as const;
const VESTING_FACTORY_ABI = [
  ...OWNABLE_ABI,
  "function vestingFee() view returns (uint256)",
] as const;
const LOCKER_ABI = [
  ...OWNABLE_ABI,
  "function lockFee() view returns (uint256)",
] as const;
const LEDGER_ABI = [
  ...OWNABLE_ABI,
  "function treasury() view returns (address)",
  "function MIN_FEE() view returns (uint256)",
  "function treasuryCutBps() view returns (uint256)",
] as const;
const UNISWAP_FACTORY_ABI = [
  "function feeTo() view returns (address)",
  "function feeToSetter() view returns (address)",
] as const;
const CONNECTOR_ABI = ["function treasury() view returns (address)"] as const;
const GOV_TOKEN_ABI = [
  ...OWNABLE_ABI,
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function delegates(address account) view returns (address)",
  "function getVotes(address account) view returns (uint256)",
] as const;
const GOVERNOR_ABI = [
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256 proposalId) view returns (tuple(uint64 snapshotBlock,uint64 startBlock,uint64 endBlock,address proposer,bool canceled))",
  "function proposalDetails(uint256 proposalId) view returns (tuple(address[] targets,uint256[] values,bytes[] calldatas,string description))",
  "function state(uint256 proposalId) view returns (uint8)",
] as const;
const TIMELOCK_ABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function PROPOSER_ROLE() view returns (bytes32)",
  "function EXECUTOR_ROLE() view returns (bytes32)",
  "function CANCELLER_ROLE() view returns (bytes32)",
  "function getMinDelay() view returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function isOperationPending(bytes32 id) view returns (bool)",
] as const;

function requireAddress(label: string, actual: string, expected: string): void {
  if (normalized(actual) !== normalized(expected)) {
    throw new Error(`${label} is ${actual}; expected ${expected}`);
  }
  console.log(`[ok] ${label}: ${actual}`);
}

function requireUint(label: string, actual: bigint, expected: bigint): void {
  if (actual !== expected) {
    throw new Error(`${label} is ${actual}; expected ${expected}`);
  }
  console.log(`[ok] ${label}: ${actual}`);
}

async function verifyNoStandardProxyPointers(label: string, address: string): Promise<void> {
  for (const [slotLabel, slot] of Object.entries(EIP1967_SLOTS)) {
    const value = await ethers.provider.getStorage(address, slot);
    if (value !== ZERO_STORAGE) {
      throw new Error(`${label} has a non-zero EIP-1967 ${slotLabel} slot: ${value}`);
    }
  }
  console.log(`[ok] ${label}: no standard EIP-1967 implementation/admin/beacon pointers`);
}

async function assertKnownCanceledProposal(governor: Contract): Promise<void> {
  requireUint("Governor proposal count", await governor.proposalCount(), 1n);
  const core = await governor.proposals(1n);
  const details = await governor.proposalDetails(1n);
  if (
    normalized(core.proposer as string) !== RETIRED_TREASURY ||
    !core.canceled ||
    BigInt(await governor.state(1n)) !== 6n ||
    details.targets.length !== 1 ||
    normalized(details.targets[0]) !== "0x0000000000000000000000000000000000000001" ||
    details.values.length !== 1 ||
    details.values[0] !== 0n ||
    details.calldatas.length !== 1 ||
    details.calldatas[0] !== "0x" ||
    details.description !== "Test v2\n\nTest prop"
  ) {
    throw new Error("Governor proposal 1 does not match the audited canceled no-op");
  }
  console.log("[ok] sole audited Governor proposal is canceled");
}

async function assertInventoryMatchesChain(
  timelock: Contract,
  inventory: TimelockInventory,
  expected: Map<string, Set<string>>,
): Promise<void> {
  for (const [role, expectedAccounts] of expected) {
    const candidates = new Set([
      ...(inventory.roleAccountsEver.get(role) ?? []),
      ...expectedAccounts,
      RETIRED_TREASURY,
      ethers.ZeroAddress,
    ]);
    const reconstructed = holdersFor(inventory, role);
    for (const account of candidates) {
      const live = await timelock.hasRole(role, account) as boolean;
      if (live !== reconstructed.has(normalized(account))) {
        throw new Error(
          `Timelock event inventory disagrees with hasRole(${role}, ${account})`,
        );
      }
    }
  }
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Expected LitVM chain ${EXPECTED_CHAIN_ID}, connected to ${network.chainId}`);
  }

  // Exact runtime hashes are the primary deployment attestation. The storage
  // checks below are supplemental and only rule out standard EIP-1967 slots.
  await attestPinnedRuntime(ethers.provider);
  for (const [label, address] of Object.entries(ADDRESSES)) {
    await verifyNoStandardProxyPointers(label, address);
  }

  const iloFactory = new ethers.Contract(ADDRESSES.iloFactory, ILO_FACTORY_ABI, ethers.provider);
  const ledger = new ethers.Contract(ADDRESSES.ledger, LEDGER_ABI, ethers.provider);
  const tokenFactory = new ethers.Contract(ADDRESSES.tokenFactory, TOKEN_FACTORY_ABI, ethers.provider);
  const vestingFactory = new ethers.Contract(ADDRESSES.vestingFactory, VESTING_FACTORY_ABI, ethers.provider);
  const liquidityLocker = new ethers.Contract(ADDRESSES.liquidityLocker, LOCKER_ABI, ethers.provider);
  const uniswapV2Factory = new ethers.Contract(
    ADDRESSES.uniswapV2Factory,
    UNISWAP_FACTORY_ABI,
    ethers.provider,
  );
  const legacyConnector = new ethers.Contract(
    ADDRESSES.legacyConnector,
    CONNECTOR_ABI,
    ethers.provider,
  );
  const litGovToken = new ethers.Contract(ADDRESSES.litGovToken, GOV_TOKEN_ABI, ethers.provider);
  const litGovernor = new ethers.Contract(ADDRESSES.litGovernor, GOVERNOR_ABI, ethers.provider);
  const litTimelock = new ethers.Contract(ADDRESSES.litTimelock, TIMELOCK_ABI, ethers.provider);

  requireAddress("ILOFactory router", await iloFactory.router(), EXPECTED_CONFIG.iloRouter);
  requireAddress("ILOFactory treasury", await iloFactory.treasury(), TARGET_TREASURY);
  requireAddress("TheLedger treasury", await ledger.treasury(), TARGET_TREASURY);
  requireAddress("UniswapV2Factory feeTo", await uniswapV2Factory.feeTo(), TARGET_TREASURY);
  requireAddress("UniswapV2Factory feeToSetter", await uniswapV2Factory.feeToSetter(), TARGET_TREASURY);
  requireAddress("ILOFactory owner", await iloFactory.owner(), TARGET_TREASURY);
  requireAddress("TokenFactory owner", await tokenFactory.owner(), TARGET_TREASURY);
  requireAddress("VestingFactory owner", await vestingFactory.owner(), TARGET_TREASURY);
  requireAddress("LiquidityLocker owner", await liquidityLocker.owner(), TARGET_TREASURY);
  requireAddress("TheLedger owner", await ledger.owner(), TARGET_TREASURY);
  requireAddress("LitGovToken owner", await litGovToken.owner(), TARGET_TREASURY);
  requireAddress("Retired connector immutable treasury", await legacyConnector.treasury(), RETIRED_TREASURY);

  requireUint("ILOFactory platform fee", await iloFactory.platformFeeBps(), EXPECTED_CONFIG.iloPlatformFeeBps);
  requireUint("ILOFactory creation fee", await iloFactory.creationFee(), EXPECTED_CONFIG.iloCreationFee);
  requireUint("TokenFactory creation fee", await tokenFactory.creationFee(), EXPECTED_CONFIG.tokenCreationFee);
  requireUint("VestingFactory fee", await vestingFactory.vestingFee(), EXPECTED_CONFIG.vestingFee);
  requireUint("LiquidityLocker fee", await liquidityLocker.lockFee(), EXPECTED_CONFIG.lockFee);
  requireUint("TheLedger minimum fee", await ledger.MIN_FEE(), EXPECTED_CONFIG.ledgerMinFee);
  requireUint("TheLedger treasury cut", await ledger.treasuryCutBps(), EXPECTED_CONFIG.ledgerTreasuryCutBps);
  requireUint("LitTimelock minimum delay", await litTimelock.getMinDelay(), EXPECTED_CONFIG.timelockMinDelay);

  requireUint("LitGovToken total supply", await litGovToken.totalSupply(), EXPECTED_CONFIG.governanceTotalSupply);
  requireUint("Retired LitGovToken balance", await litGovToken.balanceOf(RETIRED_TREASURY), 0n);
  requireUint("Retired current voting power", await litGovToken.getVotes(RETIRED_TREASURY), 0n);
  requireUint(
    "Target LitGovToken balance",
    await litGovToken.balanceOf(TARGET_TREASURY),
    EXPECTED_CONFIG.governanceTotalSupply,
  );
  const targetDelegate = normalized(
    await litGovToken.delegates(TARGET_TREASURY) as string,
  );
  requireUint(
    "Target current voting power",
    await litGovToken.getVotes(TARGET_TREASURY),
    expectedTargetVotingPower(
      targetDelegate,
      EXPECTED_CONFIG.governanceTotalSupply,
    ),
  );
  await assertKnownCanceledProposal(litGovernor);

  const roles = {
    adminRole: await litTimelock.DEFAULT_ADMIN_ROLE(),
    proposerRole: await litTimelock.PROPOSER_ROLE(),
    executorRole: await litTimelock.EXECUTOR_ROLE(),
    cancellerRole: await litTimelock.CANCELLER_ROLE(),
  };
  const expected = expectedRoleHolders(roles);
  const inventory = await inventoryTimelock(ethers.provider);
  await assertInventoryMatchesChain(litTimelock, inventory, expected);
  assertExactRoleInventory(inventory, expected);
  for (const operationId of inventory.scheduledOperationIds) {
    if (await litTimelock.isOperationPending(operationId)) {
      throw new Error(`Timelock operation ${operationId} remains pending`);
    }
  }
  console.log("[ok] exact Timelock role holders reconstructed; no pending operations");

  const childReport = await auditLiveChildAuthority(ethers.provider);
  assertNoActiveRetiredChildAuthority(childReport);
  console.log(
    `[ok] factory-child authority inventory at block ${childReport.snapshotBlock}: ` +
      `${childReport.inventoryCounts.retiredTokenCandidates} retired-token candidates, ` +
      `${childReport.inventoryCounts.ilos} ILOs, ` +
      `${childReport.inventoryCounts.vestingWallets} vesting wallets, ${childReport.inventoryCounts.locks} locks`,
  );
  console.log(
    `[ok] ${childReport.retiredTokenAuthorities.length} retired-created token(s) have no usable mint/pause control; ` +
      "deterministic child-state reads found no retired ILO owner, vesting owner, or locker withdrawer",
  );
  if (childReport.retiredIloTreasuryRoutes.length > 0) {
    console.warn(
      `[warning] ${childReport.retiredIloTreasuryRoutes.length} legacy ILO(s) immutably route platform fees to the retired treasury; ` +
        "the canonical legacy factory must remain creation-disabled and those ILOs must remain funding/finalization-disabled",
    );
  }

  console.log("Live Lester Labs treasury rotation verified.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
