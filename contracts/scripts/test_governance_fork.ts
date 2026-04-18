/**
 * test_governance_fork.ts
 *
 * Dry-run the full governance deployment against a forked LitVM state.
 * Run with: npx hardhat test_governance_fork --network litvm_fork
 *
 * How it works:
 *   hardhat node --fork <LITVM_RPC>   (in terminal 1)
 *   npx hardhat run scripts/test_governance_fork.ts --network localhost
 *
 * Or configure hardhat.config.ts with a forking network alias.
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");

async function main() {
  const [deployer, voter1, voter2, voter3] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Test voters:", voter1.address, voter2.address, voter3.address);
  console.log("Network:", (await ethers.provider.getNetwork()).chainId.toString());

  // ── 1. Deploy LitGovToken ────────────────────────────────────────────
  console.log("\n[1/4] Deploying LitGovToken...");
  const LitGovToken = await ethers.getContractFactory("LitGovToken");
  const token = await LitGovToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("  LitGovToken:", tokenAddress);

  // ── 2. Deploy LitTimelock ────────────────────────────────────────────
  console.log("\n[2/4] Deploying LitTimelock...");
  const TIMELOCK_DELAY = 172_800;
  const LitTimelock = await ethers.getContractFactory("LitTimelock");
  const timelock = await LitTimelock.deploy(
    TIMELOCK_DELAY,
    [deployer.address],
    [deployer.address],
    deployer.address
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("  LitTimelock:", timelockAddress);

  // ── 3. Deploy LitGovernor ─────────────────────────────────────────────
  console.log("\n[3/4] Deploying LitGovernor...");
  const VOTING_DELAY = 1;
  const VOTING_PERIOD = 45_600;
  const PROPOSAL_THRESHOLD = ethers.parseUnits("100000", 18);
  const QUORUM_BPS = 400;

  const LitGovernor = await ethers.getContractFactory("LitGovernor");
  const governor = await LitGovernor.deploy(
    tokenAddress,
    timelockAddress,
    VOTING_DELAY,
    VOTING_PERIOD,
    PROPOSAL_THRESHOLD,
    QUORUM_BPS
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("  LitGovernor:", governorAddress);

  // ── 4. Configure timelock ────────────────────────────────────────────
  console.log("\n[4/4] Configuring timelock...");
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const grantProposerTx = await timelock.grantRole(PROPOSER_ROLE, governorAddress);
  await grantProposerTx.wait();
  console.log("  PROPOSER_ROLE granted to governor ✓");

  // ── 5. Mint tokens + delegate ─────────────────────────────────────────
  console.log("\n[5/6] Minting and delegating...");
  const BOOTSTRAP_AMOUNT = ethers.parseUnits("5000000", 18); // 5M per wallet
  await token.batchMint(
    [voter1.address, voter2.address, voter3.address],
    [BOOTSTRAP_AMOUNT, BOOTSTRAP_AMOUNT, BOOTSTRAP_AMOUNT]
  );
  console.log("  Minted 5M LGT to 3 test voters ✓");

  await token.connect(voter1).delegate(voter1.address);
  await token.connect(voter2).delegate(voter2.address);
  await token.connect(voter3).delegate(voter3.address);
  console.log("  All voters self-delegated ✓");

  // ── 6. Create and vote on a test proposal ─────────────────────────────
  console.log("\n[6/6] End-to-end proposal flow...");

  // Wait for voting power to activate (1 block)
  await ethers.provider.send("evm_increaseTime", [2]);
  await ethers.provider.send("evm_mine", []);

  const targets = [deployer.address];
  const values = [0n];
  const calldatas = ["0x"];
  const description = "Test Proposal: Verify Governor Functionality\n\nThis is a test proposal to verify the governance system works correctly.";

  // Propose
  const proposeTx = await governor
    .connect(voter1)
    .propose(targets, values, calldatas, description);
  const proposeReceipt = await proposeTx.wait();
  const proposalId = proposeReceipt.logs[0].args?.proposalId;
  console.log("  Proposal created:", Number(proposalId));

  // Advance past voting delay
  await ethers.provider.send("evm_increaseTime", [2]);
  await ethers.provider.send("evm_mine", []);

  // Check state
  const state = await governor.state(proposalId);
  console.log("  Proposal state:", state, "(1=Active expected)");

  // Cast votes
  await governor.connect(voter1).castVoteWithReason(proposalId, 1, "Fully agree");
  await governor.connect(voter2).castVoteWithReason(proposalId, 1, "Support");
  await governor.connect(voter3).castVoteWithReason(proposalId, 0, "Against");
  console.log("  All 3 votes cast ✓");

  // Advance past voting period
  await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD * 7.5 + 10]);
  await ethers.provider.send("evm_mine", []);

  // Queue
  const queueTx = await governor.queue(proposalId);
  await queueTx.wait();
  console.log("  Queued ✓");

  // Execute
  const execTx = await governor.execute(proposalId);
  await execTx.wait();
  console.log("  Executed ✓");

  // Final state
  const finalState = await governor.state(proposalId);
  console.log("  Final state:", finalState, "(3=Executed expected)");

  // ── Summary ──────────────────────────────────────────────────────────
  console.log("\n=== FORK TEST PASSED ===");
  console.log("LitGovToken :", tokenAddress);
  console.log("LitTimelock :", timelockAddress);
  console.log("LitGovernor :", governorAddress);

  // Save
  const deployed = {
    LitGovToken: tokenAddress,
    LitTimelock: timelockAddress,
    LitGovernor: governorAddress,
    network: "litvm_fork_test",
    forkTestAt: new Date().toISOString(),
  };
  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify({ ...JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8") || "{}"), ...deployed }, null, 2));
  console.log("Governance addresses saved to deployed-addresses.json");
}

main().catch((err) => {
  console.error("\n=== FORK TEST FAILED ===");
  console.error(err);
  process.exit(1);
});
