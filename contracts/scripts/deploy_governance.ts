import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain ID:", chainId.toString());

  // ── 1. Deploy LitGovToken ────────────────────────────────────────────
  console.log("\n[1/3] Deploying LitGovToken...");
  const LitGovToken = await ethers.getContractFactory("LitGovToken");
  const token = await LitGovToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("LitGovToken:", tokenAddress);

  // ── 2. Deploy LitTimelock ────────────────────────────────────────────
  console.log("\n[2/3] Deploying LitTimelock...");
  const TIMELOCK_DELAY = 172_800; // 2 days in seconds
  const LitTimelock = await ethers.getContractFactory("LitTimelock");

  // Proposer = governor, Executor = deployer (open for all), Admin = deployer
  const timelock = await LitTimelock.deploy(
    TIMELOCK_DELAY,
    [deployer.address],   // proposers
    [deployer.address],   // executors (anyone can execute after delay)
    deployer.address      // admin (can grant/revoke roles)
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("LitTimelock:", timelockAddress);

  // ── 3. Deploy LitGovernor ─────────────────────────────────────────────
  console.log("\n[3/3] Deploying LitGovernor...");
  const VOTING_DELAY = 1;             // 1 block
  const VOTING_PERIOD = 45_600;       // ~45,600 blocks (~3-4 days @ 7.5s)
  const PROPOSAL_THRESHOLD = ethers.parseUnits("100000", 18); // 100k LGT
  const QUORUM_BPS = 400;             // 4%

  const LitGovernor = await ethers.getContractFactory("LitGovernor");
  const governor = await LitGovernor.deploy(
    tokenAddress,          // IVotes (token)
    timelockAddress,       // TimelockController
    VOTING_DELAY,
    VOTING_PERIOD,
    PROPOSAL_THRESHOLD,
    QUORUM_BPS
  );
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("LitGovernor:", governorAddress);

  // ── 4. Configure timelock — grant proposer role to governor ───────────
  console.log("\n[4] Configuring LitTimelock...");
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();

  const grantProposerTx = await timelock.grantRole(PROPOSER_ROLE, governorAddress);
  await grantProposerTx.wait();
  console.log("Granted PROPOSER_ROLE to governor");

  // Revoke deployer's admin from timelock (timelock should manage itself)
  // Actually keep admin for now so we can add more proposers — skip revoke

  // ── 5. Batch mint tokens to bootstrap wallets ─────────────────────────
  console.log("\n[5] Minting tokens to bootstrap wallets...");
  const BOOTSTRAP_WALLETS = [
    "0xDD221FBbCb0f6092AfE51183d964AA89A968eE13", // deployer
  ];
  const BOOTSTRAP_AMOUNT = ethers.parseUnits("10000000", 18); // 10M each

  const recipients = BOOTSTRAP_WALLETS;
  const amounts = recipients.map(() => BOOTSTRAP_AMOUNT);

  const mintTx = await token.batchMint(recipients, amounts);
  await mintTx.wait();
  console.log(`Minted ${recipients.length * 10}M LGT to bootstrap wallets`);

  // ── 6. Delegate your own voting power ─────────────────────────────────
  console.log("\n[6] Delegating deployer voting power...");
  const delegateTx = await token.delegate(deployer.address);
  await delegateTx.wait();
  console.log("Deployer self-delegated");

  // ── Save addresses ───────────────────────────────────────────────────
  const deployed = {
    LitGovToken:  tokenAddress,
    LitTimelock:  timelockAddress,
    LitGovernor:  governorAddress,
    network:      network.name,
    chainId:      chainId.toString(),
    deployedAt:   new Date().toISOString(),
    deployer:     deployer.address,
  };

  // Merge with existing deployed-addresses.json
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(ADDRESSES_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8")); } catch {}
  }
  const merged = { ...existing, ...deployed };
  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(merged, null, 2));
  console.log("\nAddresses saved to deployed-addresses.json");

  // ── Print summary ─────────────────────────────────────────────────────
  console.log("\n=== Deployment Summary ===");
  console.log("LitGovToken :", tokenAddress);
  console.log("LitTimelock :", timelockAddress);
  console.log("LitGovernor :", governorAddress);
  console.log("Deployer    :", deployer.address);
  console.log("Total supply:", (await token.totalSupply()).toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
