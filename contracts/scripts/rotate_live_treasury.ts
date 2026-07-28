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
  extendTimelockInventory,
  holdersFor,
  inventoryTimelock,
  normalized,
  type TimelockInventory,
} from "./lib/live_treasury_audit";

const OWNABLE_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
] as const;
const ILO_FACTORY_ABI = [
  ...OWNABLE_ABI,
  "function treasury() view returns (address)",
  "function setTreasury(address newTreasury)",
  "function router() view returns (address)",
  "function setRouter(address newRouter)",
  "function platformFeeBps() view returns (uint256)",
  "function setPlatformFee(uint256 newFee)",
  "function creationFee() view returns (uint256)",
  "function setCreationFee(uint256 newFee)",
] as const;
const TOKEN_FACTORY_ABI = [
  ...OWNABLE_ABI,
  "function creationFee() view returns (uint256)",
  "function setFee(uint256 newFee)",
] as const;
const VESTING_FACTORY_ABI = [
  ...OWNABLE_ABI,
  "function vestingFee() view returns (uint256)",
  "function setFee(uint256 newFee)",
] as const;
const LOCKER_ABI = [
  ...OWNABLE_ABI,
  "function lockFee() view returns (uint256)",
  "function setFee(uint256 newFee)",
] as const;
const LEDGER_ABI = [
  ...OWNABLE_ABI,
  "function treasury() view returns (address)",
  "function setTreasury(address newTreasury)",
  "function MIN_FEE() view returns (uint256)",
  "function setMinFee(uint256 newFee)",
  "function treasuryCutBps() view returns (uint256)",
] as const;
const UNISWAP_FACTORY_ABI = [
  "function feeTo() view returns (address)",
  "function feeToSetter() view returns (address)",
  "function setFeeTo(address newFeeTo)",
  "function setFeeToSetter(address newFeeToSetter)",
] as const;
const GOV_TOKEN_ABI = [
  ...OWNABLE_ABI,
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function delegates(address account) view returns (address)",
  "function getVotes(address account) view returns (uint256)",
] as const;
const GOVERNOR_ABI = [
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256 proposalId) view returns (tuple(uint64 snapshotBlock,uint64 startBlock,uint64 endBlock,address proposer,bool canceled))",
  "function proposalDetails(uint256 proposalId) view returns (tuple(address[] targets,uint256[] values,bytes[] calldatas,string description))",
  "function state(uint256 proposalId) view returns (uint8)",
  "function cancel(uint256 proposalId)",
] as const;
const TIMELOCK_ABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function PROPOSER_ROLE() view returns (bytes32)",
  "function EXECUTOR_ROLE() view returns (bytes32)",
  "function CANCELLER_ROLE() view returns (bytes32)",
  "function getMinDelay() view returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function renounceRole(bytes32 role, address callerConfirmation)",
  "function isOperationPending(bytes32 id) view returns (bool)",
  "function cancel(bytes32 id)",
] as const;

type RoleSet = {
  adminRole: string;
  proposerRole: string;
  executorRole: string;
  cancellerRole: string;
};

function assertKnownController(label: string, actual: string): void {
  const value = normalized(actual);
  if (value !== RETIRED_TREASURY && value !== TARGET_TREASURY) {
    throw new Error(`${label} is ${actual}; expected the retired or target treasury. Refusing to continue.`);
  }
}

async function assertSafeTargetDelegation(
  governanceToken: Contract,
): Promise<void> {
  const [delegate, balance, votes] = await Promise.all([
    governanceToken.delegates(TARGET_TREASURY) as Promise<string>,
    governanceToken.balanceOf(TARGET_TREASURY) as Promise<bigint>,
    governanceToken.getVotes(TARGET_TREASURY) as Promise<bigint>,
  ]);
  const expectedVotes = expectedTargetVotingPower(delegate, balance);
  if (votes !== expectedVotes) {
    throw new Error(
      `Approved treasury voting power is ${votes}; expected ${expectedVotes} for delegate ${delegate}`,
    );
  }
}

async function sendAddressStep(
  label: string,
  current: string,
  expected: string,
  submit: () => Promise<{ hash: string; wait: () => Promise<unknown> }>,
): Promise<void> {
  if (normalized(current) === normalized(expected)) {
    console.log(`[skip] ${label} already equals ${expected}`);
    return;
  }
  const transaction = await submit();
  console.log(`[sent] ${label}: ${transaction.hash}`);
  await transaction.wait();
  console.log(`[done] ${label}`);
}

async function sendUintStep(
  label: string,
  current: bigint,
  expected: bigint,
  submit: () => Promise<{ hash: string; wait: () => Promise<unknown> }>,
): Promise<void> {
  if (current === expected) {
    console.log(`[skip] ${label} already equals ${expected}`);
    return;
  }
  const transaction = await submit();
  console.log(`[sent] ${label}: ${transaction.hash}`);
  await transaction.wait();
  console.log(`[done] ${label}: ${current} -> ${expected}`);
}

async function assertKnownGovernorHistory(
  governor: Contract,
  expectedCanceled?: boolean,
): Promise<void> {
  const proposalCount = await governor.proposalCount() as bigint;
  if (proposalCount !== 1n) {
    throw new Error(`Unexpected Governor proposal count ${proposalCount}; expected the one audited test proposal`);
  }

  const core = await governor.proposals(1n);
  const details = await governor.proposalDetails(1n);
  const targets = details.targets as string[];
  const values = details.values as bigint[];
  const calldatas = details.calldatas as string[];
  if (
    normalized(core.proposer as string) !== RETIRED_TREASURY ||
    (expectedCanceled !== undefined && Boolean(core.canceled) !== expectedCanceled) ||
    targets.length !== 1 ||
    normalized(targets[0]) !== "0x0000000000000000000000000000000000000001" ||
    values.length !== 1 ||
    values[0] !== 0n ||
    calldatas.length !== 1 ||
    calldatas[0] !== "0x" ||
    details.description !== "Test v2\n\nTest prop"
  ) {
    throw new Error("Governor proposal history no longer matches the audited benign proposal");
  }
}

async function assertInventoryMatchesChain(
  timelock: Contract,
  inventory: TimelockInventory,
  expected: Map<string, Set<string>>,
): Promise<void> {
  for (const [role, expectedAccounts] of expected) {
    const accounts = new Set([
      ...(inventory.roleAccountsEver.get(role) ?? []),
      ...expectedAccounts,
      RETIRED_TREASURY,
      ethers.ZeroAddress,
    ]);
    const reconstructed = holdersFor(inventory, role);
    for (const account of accounts) {
      const live = await timelock.hasRole(role, account) as boolean;
      if (live !== reconstructed.has(normalized(account))) {
        throw new Error(
          `Timelock event inventory disagrees with hasRole(${role}, ${account}); refusing an incomplete audit`,
        );
      }
    }
  }
}

async function grantRoleIfMissing(
  timelock: Contract,
  inventory: TimelockInventory,
  label: string,
  role: string,
  account: string,
): Promise<void> {
  if (await timelock.hasRole(role, account)) {
    holdersFor(inventory, role).add(normalized(account));
    console.log(`[skip] ${label} already granted`);
    return;
  }
  const transaction = await timelock.grantRole(role, account);
  console.log(`[sent] ${label}: ${transaction.hash}`);
  await transaction.wait();
  holdersFor(inventory, role).add(normalized(account));
  console.log(`[done] ${label}`);
}

async function revokeUnexpectedRoleHolders(
  timelock: Contract,
  inventory: TimelockInventory,
  label: string,
  role: string,
  allowed: Set<string>,
): Promise<void> {
  for (const account of [...holdersFor(inventory, role)]) {
    if (allowed.has(account)) continue;
    if (!await timelock.hasRole(role, account)) {
      holdersFor(inventory, role).delete(account);
      continue;
    }
    const transaction = await timelock.revokeRole(role, account);
    console.log(`[sent] revoke ${label} from ${account}: ${transaction.hash}`);
    await transaction.wait();
    holdersFor(inventory, role).delete(account);
    console.log(`[done] revoke ${label} from ${account}`);
  }
}

async function cancelPendingOperations(
  timelock: Contract,
  inventory: TimelockInventory,
): Promise<void> {
  for (const operationId of inventory.scheduledOperationIds) {
    if (!await timelock.isOperationPending(operationId)) continue;
    const transaction = await timelock.cancel(operationId);
    console.log(`[sent] cancel pending Timelock operation ${operationId}: ${transaction.hash}`);
    await transaction.wait();
    console.log(`[done] cancel pending Timelock operation ${operationId}`);
  }
}

async function assertNoPendingOperations(
  timelock: Contract,
  inventory: TimelockInventory,
): Promise<void> {
  for (const operationId of inventory.scheduledOperationIds) {
    if (await timelock.isOperationPending(operationId)) {
      throw new Error(`Timelock operation ${operationId} remains pending`);
    }
  }
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Expected LitVM chain ${EXPECTED_CHAIN_ID}, connected to ${network.chainId}`);
  }

  const [signer] = await ethers.getSigners();
  if (!signer || normalized(signer.address) !== RETIRED_TREASURY) {
    throw new Error(
      `Rotation must be signed locally by the current controller ${RETIRED_TREASURY}; connected signer is ${signer?.address ?? "missing"}`,
    );
  }

  await attestPinnedRuntime(ethers.provider);

  const iloFactory = new ethers.Contract(ADDRESSES.iloFactory, ILO_FACTORY_ABI, signer);
  const ledger = new ethers.Contract(ADDRESSES.ledger, LEDGER_ABI, signer);
  const tokenFactory = new ethers.Contract(ADDRESSES.tokenFactory, TOKEN_FACTORY_ABI, signer);
  const vestingFactory = new ethers.Contract(ADDRESSES.vestingFactory, VESTING_FACTORY_ABI, signer);
  const liquidityLocker = new ethers.Contract(ADDRESSES.liquidityLocker, LOCKER_ABI, signer);
  const uniswapV2Factory = new ethers.Contract(ADDRESSES.uniswapV2Factory, UNISWAP_FACTORY_ABI, signer);
  const litGovToken = new ethers.Contract(ADDRESSES.litGovToken, GOV_TOKEN_ABI, signer);
  const litGovernor = new ethers.Contract(ADDRESSES.litGovernor, GOVERNOR_ABI, signer);
  const litTimelock = new ethers.Contract(ADDRESSES.litTimelock, TIMELOCK_ABI, signer);

  const controlledContracts = [
    ["ILOFactory owner", iloFactory],
    ["TokenFactory owner", tokenFactory],
    ["VestingFactory owner", vestingFactory],
    ["LiquidityLocker owner", liquidityLocker],
    ["TheLedger owner", ledger],
    ["LitGovToken owner", litGovToken],
  ] as const;

  const roles: RoleSet = {
    adminRole: await litTimelock.DEFAULT_ADMIN_ROLE(),
    proposerRole: await litTimelock.PROPOSER_ROLE(),
    executorRole: await litTimelock.EXECUTOR_ROLE(),
    cancellerRole: await litTimelock.CANCELLER_ROLE(),
  };
  const desiredRoles = expectedRoleHolders(roles);

  // Attest all event-derived Timelock authority before sending any transaction.
  const inventory = await inventoryTimelock(ethers.provider);
  await assertInventoryMatchesChain(litTimelock, inventory, desiredRoles);
  const retiredHasAdmin = await litTimelock.hasRole(
    roles.adminRole,
    RETIRED_TREASURY,
  ) as boolean;
  const targetHasAdmin = await litTimelock.hasRole(
    roles.adminRole,
    TARGET_TREASURY,
  ) as boolean;
  if (!retiredHasAdmin && !targetHasAdmin) {
    throw new Error(
      "Neither the retired nor target controller has Timelock admin; use an independently reviewed recovery path",
    );
  }
  const retiredHasCanceller = await litTimelock.hasRole(
    roles.cancellerRole,
    RETIRED_TREASURY,
  ) as boolean;
  const targetHasCanceller = await litTimelock.hasRole(
    roles.cancellerRole,
    TARGET_TREASURY,
  ) as boolean;
  if (!retiredHasCanceller && !targetHasCanceller) {
    throw new Error(
      "Neither the retired nor target controller can cancel Timelock operations",
    );
  }

  // Validate every single-owner authority and fixed governance invariant first.
  assertKnownController("ILOFactory treasury", await iloFactory.treasury());
  assertKnownController("TheLedger treasury", await ledger.treasury());
  assertKnownController("UniswapV2Factory feeTo", await uniswapV2Factory.feeTo());
  assertKnownController("UniswapV2Factory feeToSetter", await uniswapV2Factory.feeToSetter());
  for (const [label, contract] of controlledContracts) {
    assertKnownController(label, await contract.owner());
  }
  if (await litGovToken.totalSupply() !== EXPECTED_CONFIG.governanceTotalSupply) {
    throw new Error("LitGovToken total supply differs from the audited 10M supply");
  }
  if (await litTimelock.getMinDelay() !== EXPECTED_CONFIG.timelockMinDelay) {
    throw new Error("LitTimelock minimum delay differs from the audited two-day delay");
  }
  await assertKnownGovernorHistory(litGovernor);

  console.log(`Rotating Lester Labs control on chain ${network.chainId}`);
  console.log(`From: ${RETIRED_TREASURY}`);
  console.log(`To:   ${TARGET_TREASURY}`);
  console.log("Each step is a separate transaction. The script is resumable after interruption.");

  // The sole live proposal is an audited no-op, but it was proposed by the
  // retired wallet and is currently Succeeded. Cancel it while that proposer
  // can still do so, preventing it from ever being queued after role repair.
  const proposalState = BigInt(await litGovernor.state(1n));
  if (proposalState === 6n) {
    console.log("[skip] audited Governor proposal 1 is already canceled");
  } else {
    if (![0n, 1n, 3n].includes(proposalState)) {
      throw new Error(`Governor proposal 1 is in unexpected non-cancelable state ${proposalState}`);
    }
    const transaction = await litGovernor.cancel(1n);
    console.log(`[sent] cancel audited Governor proposal 1: ${transaction.hash}`);
    await transaction.wait();
    console.log("[done] cancel audited Governor proposal 1");
  }
  await assertKnownGovernorHistory(litGovernor, true);

  // Repair every mutable live configuration while the known controller still owns it.
  await sendAddressStep(
    "ILOFactory router",
    await iloFactory.router(),
    EXPECTED_CONFIG.iloRouter,
    () => iloFactory.setRouter(EXPECTED_CONFIG.iloRouter),
  );
  await sendUintStep(
    "ILOFactory platform fee",
    await iloFactory.platformFeeBps(),
    EXPECTED_CONFIG.iloPlatformFeeBps,
    () => iloFactory.setPlatformFee(EXPECTED_CONFIG.iloPlatformFeeBps),
  );
  await sendUintStep(
    "ILOFactory creation fee",
    await iloFactory.creationFee(),
    EXPECTED_CONFIG.iloCreationFee,
    () => iloFactory.setCreationFee(EXPECTED_CONFIG.iloCreationFee),
  );
  await sendUintStep(
    "TokenFactory creation fee",
    await tokenFactory.creationFee(),
    EXPECTED_CONFIG.tokenCreationFee,
    () => tokenFactory.setFee(EXPECTED_CONFIG.tokenCreationFee),
  );
  await sendUintStep(
    "VestingFactory fee",
    await vestingFactory.vestingFee(),
    EXPECTED_CONFIG.vestingFee,
    () => vestingFactory.setFee(EXPECTED_CONFIG.vestingFee),
  );
  await sendUintStep(
    "LiquidityLocker fee",
    await liquidityLocker.lockFee(),
    EXPECTED_CONFIG.lockFee,
    () => liquidityLocker.setFee(EXPECTED_CONFIG.lockFee),
  );
  await sendUintStep(
    "TheLedger minimum fee",
    await ledger.MIN_FEE(),
    EXPECTED_CONFIG.ledgerMinFee,
    () => ledger.setMinFee(EXPECTED_CONFIG.ledgerMinFee),
  );
  if (await ledger.treasuryCutBps() !== EXPECTED_CONFIG.ledgerTreasuryCutBps) {
    throw new Error("TheLedger treasury cut differs from the pinned 5000 bps runtime configuration");
  }

  // Route value before relinquishing the authorities required to change it.
  await sendAddressStep(
    "ILOFactory treasury",
    await iloFactory.treasury(),
    TARGET_TREASURY,
    () => iloFactory.setTreasury(TARGET_TREASURY),
  );
  await sendAddressStep(
    "TheLedger treasury",
    await ledger.treasury(),
    TARGET_TREASURY,
    () => ledger.setTreasury(TARGET_TREASURY),
  );
  await sendAddressStep(
    "UniswapV2Factory feeTo",
    await uniswapV2Factory.feeTo(),
    TARGET_TREASURY,
    () => uniswapV2Factory.setFeeTo(TARGET_TREASURY),
  );

  // The retired wallet currently holds and delegates the full governance supply.
  // Move that balance before transferring mint authority so the retired key ends
  // with neither current votes nor the ability to mint replacements.
  const totalSupply = await litGovToken.totalSupply() as bigint;
  const retiredBalance = await litGovToken.balanceOf(RETIRED_TREASURY) as bigint;
  const targetBalance = await litGovToken.balanceOf(TARGET_TREASURY) as bigint;
  // The old signer cannot choose delegation on behalf of the target. Refuse to
  // transfer voting weight to any preconfigured third-party delegate.
  await assertSafeTargetDelegation(litGovToken);
  if (retiredBalance + targetBalance !== totalSupply) {
    throw new Error("Governance supply exists outside the retired and target controllers");
  }
  if (retiredBalance > 0n) {
    const transaction = await litGovToken.transfer(TARGET_TREASURY, retiredBalance);
    console.log(`[sent] transfer retired governance balance: ${transaction.hash}`);
    await transaction.wait();
    console.log("[done] transfer retired governance balance");
  }
  if (
    await litGovToken.balanceOf(RETIRED_TREASURY) !== 0n ||
    await litGovToken.getVotes(RETIRED_TREASURY) !== 0n ||
    await litGovToken.balanceOf(TARGET_TREASURY) !== totalSupply
  ) {
    throw new Error("Governance balance/vote migration did not reach the safe target state");
  }
  await assertSafeTargetDelegation(litGovToken);

  for (const [label, contract] of controlledContracts) {
    await sendAddressStep(
      label,
      await contract.owner(),
      TARGET_TREASURY,
      () => contract.transferOwnership(TARGET_TREASURY),
    );
  }

  // Build the exact intended Timelock role set. Execution remains callable
  // through the Governor, but arbitrary directly scheduled operations cannot
  // be executed by every address.
  await grantRoleIfMissing(
    litTimelock,
    inventory,
    "LitTimelock target default admin",
    roles.adminRole,
    TARGET_TREASURY,
  );
  await grantRoleIfMissing(
    litTimelock,
    inventory,
    "LitTimelock target canceller",
    roles.cancellerRole,
    TARGET_TREASURY,
  );
  await grantRoleIfMissing(
    litTimelock,
    inventory,
    "LitGovernor proposer",
    roles.proposerRole,
    ADDRESSES.litGovernor,
  );
  await grantRoleIfMissing(
    litTimelock,
    inventory,
    "LitGovernor executor",
    roles.executorRole,
    ADDRESSES.litGovernor,
  );

  await revokeUnexpectedRoleHolders(
    litTimelock,
    inventory,
    "proposer",
    roles.proposerRole,
    new Set([normalized(ADDRESSES.litGovernor)]),
  );
  await revokeUnexpectedRoleHolders(
    litTimelock,
    inventory,
    "executor",
    roles.executorRole,
    new Set([normalized(ADDRESSES.litGovernor)]),
  );
  await revokeUnexpectedRoleHolders(
    litTimelock,
    inventory,
    "canceller",
    roles.cancellerRole,
    new Set([TARGET_TREASURY, RETIRED_TREASURY]),
  );

  // Capture operations scheduled during the role cleanup, then cancel every
  // operation still waiting or ready. If the retired canceller was already
  // removed during a prior run, fail closed unless there is nothing left for
  // that signer to cancel.
  await extendTimelockInventory(ethers.provider, inventory);
  if (await litTimelock.hasRole(roles.cancellerRole, RETIRED_TREASURY)) {
    await cancelPendingOperations(litTimelock, inventory);
  } else {
    await assertNoPendingOperations(litTimelock, inventory);
  }

  // feeToSetter is the final non-Timelock authority that requires the retired
  // signer. Move it before either of that signer's remaining Timelock roles.
  await sendAddressStep(
    "UniswapV2Factory feeToSetter",
    await uniswapV2Factory.feeToSetter(),
    TARGET_TREASURY,
    () => uniswapV2Factory.setFeeToSetter(TARGET_TREASURY),
  );

  if (await litTimelock.hasRole(roles.cancellerRole, RETIRED_TREASURY)) {
    const transaction = await litTimelock.renounceRole(
      roles.cancellerRole,
      RETIRED_TREASURY,
    );
    console.log(`[sent] retired controller renounce canceller: ${transaction.hash}`);
    await transaction.wait();
    holdersFor(inventory, roles.cancellerRole).delete(RETIRED_TREASURY);
    console.log("[done] retired controller renounce canceller");
  }

  // Revoke the retired default admin last. After this transaction every
  // retired-key-only action is complete, so an interruption can be recovered
  // by rerunning this script in verification-only mode or by running the
  // standalone verifier.
  await revokeUnexpectedRoleHolders(
    litTimelock,
    inventory,
    "default admin",
    roles.adminRole,
    new Set([normalized(ADDRESSES.litTimelock), TARGET_TREASURY]),
  );

  await extendTimelockInventory(ethers.provider, inventory);
  await assertInventoryMatchesChain(litTimelock, inventory, desiredRoles);
  assertExactRoleInventory(inventory, desiredRoles);
  await assertNoPendingOperations(litTimelock, inventory);
  await assertKnownGovernorHistory(litGovernor, true);
  await assertSafeTargetDelegation(litGovToken);

  const finalAddressChecks = [
    ["ILOFactory router", await iloFactory.router(), EXPECTED_CONFIG.iloRouter],
    ["ILOFactory treasury", await iloFactory.treasury(), TARGET_TREASURY],
    ["TheLedger treasury", await ledger.treasury(), TARGET_TREASURY],
    ["UniswapV2Factory feeTo", await uniswapV2Factory.feeTo(), TARGET_TREASURY],
    ["UniswapV2Factory feeToSetter", await uniswapV2Factory.feeToSetter(), TARGET_TREASURY],
    ...await Promise.all(
      controlledContracts.map(async ([label, contract]) =>
        [label, await contract.owner(), TARGET_TREASURY] as const
      ),
    ),
  ] as const;
  for (const [label, actual, expected] of finalAddressChecks) {
    if (normalized(actual) !== normalized(expected)) {
      throw new Error(`Post-rotation verification failed: ${label} is ${actual}; expected ${expected}`);
    }
  }

  const finalUintChecks = [
    ["ILOFactory platform fee", await iloFactory.platformFeeBps(), EXPECTED_CONFIG.iloPlatformFeeBps],
    ["ILOFactory creation fee", await iloFactory.creationFee(), EXPECTED_CONFIG.iloCreationFee],
    ["TokenFactory creation fee", await tokenFactory.creationFee(), EXPECTED_CONFIG.tokenCreationFee],
    ["VestingFactory fee", await vestingFactory.vestingFee(), EXPECTED_CONFIG.vestingFee],
    ["LiquidityLocker fee", await liquidityLocker.lockFee(), EXPECTED_CONFIG.lockFee],
    ["TheLedger minimum fee", await ledger.MIN_FEE(), EXPECTED_CONFIG.ledgerMinFee],
    ["TheLedger treasury cut", await ledger.treasuryCutBps(), EXPECTED_CONFIG.ledgerTreasuryCutBps],
    ["LitTimelock minimum delay", await litTimelock.getMinDelay(), EXPECTED_CONFIG.timelockMinDelay],
  ] as const;
  for (const [label, actual, expected] of finalUintChecks) {
    if (actual !== expected) {
      throw new Error(`Post-rotation verification failed: ${label} is ${actual}; expected ${expected}`);
    }
  }

  console.log("Rotation verified. Pinned runtime, configuration, value routes, governance balance, and exact roles are safe.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
