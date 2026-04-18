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
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Derive test voter wallets — they'll be funded by deployer after deployment
  const w1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const w2 = ethers.Wallet.createRandom().connect(ethers.provider);
  const w3 = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log("Test voters (random):", w1.address, w2.address, w3.address);
  console.log("Network:", (await ethers.provider.getNetwork()).chainId.toString());

  // Fund voters with ETH for gas (using deployer balance on the fork)
  const FUND_AMOUNT = ethers.parseEther("1.0");
  await deployer.sendTransaction({ to: w1.address, value: FUND_AMOUNT });
  await deployer.sendTransaction({ to: w2.address, value: FUND_AMOUNT });
  await deployer.sendTransaction({ to: w3.address, value: FUND_AMOUNT });
  console.log("  Funded voters with ETH for gas ✓");
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
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const grantProposerTx = await timelock.grantRole(PROPOSER_ROLE, governorAddress);
  await grantProposerTx.wait();
  const grantExecutorTx = await timelock.grantRole(EXECUTOR_ROLE, governorAddress);
  await grantExecutorTx.wait();
  const revokeProposerTx = await timelock.revokeRole(PROPOSER_ROLE, deployer.address);
  await revokeProposerTx.wait();
  const revokeExecutorTx = await timelock.revokeRole(EXECUTOR_ROLE, deployer.address);
  await revokeExecutorTx.wait();
  console.log("  PROPOSER_ROLE + EXECUTOR_ROLE granted to governor, revoked from deployer ✓");

  // ── 5. Mint tokens + delegate ─────────────────────────────────────────
  console.log("\n[5/6] Minting and delegating...");
  const BOOTSTRAP_AMOUNT = ethers.parseUnits("5000000", 18); // 5M per wallet
  await token.batchMint(
    [w1.address, w2.address, w3.address],
    [BOOTSTRAP_AMOUNT, BOOTSTRAP_AMOUNT, BOOTSTRAP_AMOUNT]
  );
  console.log("  Minted 5M LGT to 3 test voters ✓");

  await token.connect(w1).delegate(w1.address);
  await token.connect(w2).delegate(w2.address);
  await token.connect(w3).delegate(w3.address);
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
    .connect(w1)
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
  await governor.connect(w1).castVoteWithReason(proposalId, 1, "Fully agree");
  await governor.connect(w2).castVoteWithReason(proposalId, 1, "Support");
  await governor.connect(w3).castVoteWithReason(proposalId, 0, "Against");
  console.log("  All 3 votes cast ✓");

  // Advance past voting period (blocks × ~8 seconds/block)
  await ethers.provider.send("evm_increaseTime", [Number(VOTING_PERIOD) * 8 + 10]);
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
