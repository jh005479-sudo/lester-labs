import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ADDRESSES,
  PINNED_TIMELOCK_BASELINE_DIGEST,
  TARGET_TREASURY,
  assertExactRoleInventory,
  expectedRoleHolders,
  expectedTargetVotingPower,
  normalized,
  timelockBaselineDigest,
  type TimelockInventory,
} from "../scripts/lib/live_treasury_audit";

describe("live treasury safety invariants", function () {
  const roles = {
    adminRole: ethers.id("DEFAULT_ADMIN_ROLE"),
    proposerRole: ethers.id("PROPOSER_ROLE"),
    executorRole: ethers.id("EXECUTOR_ROLE"),
    cancellerRole: ethers.id("CANCELLER_ROLE"),
  };

  it("keeps Timelock execution Governor-only", function () {
    const expected = expectedRoleHolders(roles);
    expect([...expected.get(normalized(roles.executorRole))!]).to.deep.equal([
      normalized(ADDRESSES.litGovernor),
    ]);
    expect(
      expected.get(normalized(roles.executorRole))!.has(normalized(ethers.ZeroAddress)),
    ).to.equal(false);
  });

  it("rejects an open or otherwise unexpected executor", function () {
    const expected = expectedRoleHolders(roles);
    const inventory: TimelockInventory = {
      roleHolders: new Map(
        [...expected].map(([role, holders]) => [role, new Set(holders)]),
      ),
      roleAccountsEver: new Map(),
      scheduledOperationIds: new Set(),
      fromBlock: 1,
      toBlock: 1,
    };
    inventory.roleHolders
      .get(normalized(roles.executorRole))!
      .add(normalized(ethers.ZeroAddress));
    expect(() => assertExactRoleInventory(inventory, expected)).to.throw(
      "expected",
    );
  });

  it("allows only disabled or self-delegated target governance", function () {
    expect(expectedTargetVotingPower(ethers.ZeroAddress, 10n)).to.equal(0n);
    expect(expectedTargetVotingPower(TARGET_TREASURY, 10n)).to.equal(10n);
    expect(() =>
      expectedTargetVotingPower(
        "0x1111111111111111111111111111111111111111",
        10n,
      )
    ).to.throw("unexpected third party");
  });

  it("pins the independently reconciled Timelock role baseline", function () {
    expect(timelockBaselineDigest()).to.equal(PINNED_TIMELOCK_BASELINE_DIGEST);
  });
});
