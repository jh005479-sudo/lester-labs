import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, mine, time } from "@nomicfoundation/hardhat-network-helpers";

const MIN_DELAY = 2 * 24 * 60 * 60;

async function deployGovernanceFixture() {
  const [deployer, proposer, voter1, voter2, recipient] = await ethers.getSigners();

  const LitGovToken = await ethers.getContractFactory("LitGovToken", deployer);
  const token = await LitGovToken.deploy();
  await token.waitForDeployment();

  const LitTimelock = await ethers.getContractFactory("LitTimelock", deployer);
  const timelock = await LitTimelock.deploy(MIN_DELAY, [], [], deployer.address);
  await timelock.waitForDeployment();

  const LitGovernor = await ethers.getContractFactory("LitGovernor", deployer);
  const governor = await LitGovernor.deploy(
    await token.getAddress(),
    await timelock.getAddress(),
    1,
    5,
    ethers.parseEther("100"),
    1000,
  );
  await governor.waitForDeployment();

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();

  await (await timelock.grantRole(proposerRole, await governor.getAddress())).wait();
  await (await timelock.grantRole(executorRole, await governor.getAddress())).wait();
  await (await timelock.revokeRole(proposerRole, deployer.address)).wait();
  await (await timelock.revokeRole(executorRole, deployer.address)).wait();

  await (await token.mint(proposer.address, ethers.parseEther("200"))).wait();
  await (await token.mint(voter1.address, ethers.parseEther("150"))).wait();
  await (await token.mint(voter2.address, ethers.parseEther("150"))).wait();

  await (await token.connect(proposer).delegate(proposer.address)).wait();
  await (await token.connect(voter1).delegate(voter1.address)).wait();
  await (await token.connect(voter2).delegate(voter2.address)).wait();

  const TransferRecipient = await ethers.getContractFactory("LesterToken", deployer);
  const payoutToken = await TransferRecipient.deploy(
    "Payout Token",
    "PAY",
    ethers.parseEther("1000"),
    18,
    false,
    true,
    false,
    deployer.address,
  );
  await payoutToken.waitForDeployment();
  await (await payoutToken.transfer(await timelock.getAddress(), ethers.parseEther("100"))).wait();

  return {
    deployer,
    proposer,
    voter1,
    voter2,
    recipient,
    token,
    timelock,
    governor,
    payoutToken,
  };
}

async function createSucceededProposal() {
  const fixture = await loadFixture(deployGovernanceFixture);
  const { proposer, voter1, voter2, governor, payoutToken, recipient } = fixture;

  const transferAmount = ethers.parseEther("10");
  const calldata = payoutToken.interface.encodeFunctionData("transfer", [
    recipient.address,
    transferAmount,
  ]);

  const proposeTx = await governor.connect(proposer).propose(
    [await payoutToken.getAddress()],
    [0],
    [calldata],
    "Transfer tokens after the timelock delay",
  );
  const proposeReceipt = await proposeTx.wait();
  const createdEvent = proposeReceipt?.logs
    .map((log) => {
      try {
        return governor.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event?.name === "ProposalCreated");

  if (!createdEvent) {
    throw new Error("ProposalCreated event not found");
  }

  const proposalId = createdEvent.args.proposalId as bigint;

  await mine(2);
  await (await governor.connect(voter1).castVote(proposalId, 1)).wait();
  await (await governor.connect(voter2).castVote(proposalId, 1)).wait();
  await mine(6);

  return {
    ...fixture,
    proposalId,
    transferAmount,
  };
}

describe("LitGovernor timelock integration", function () {
  it("does not allow direct execution before the proposal is queued", async function () {
    const { governor, proposalId } = await createSucceededProposal();

    expect(await governor.state(proposalId)).to.equal(3n); // Succeeded
    await expect(governor.execute(proposalId)).to.be.revertedWith("Governor: not queued");
    await expect(governor.executeTimelocked(proposalId)).to.be.revertedWith("Governor: not queued");
  });

  it("queues with a stable salt and only executes after the timelock delay", async function () {
    const { governor, timelock, payoutToken, recipient, proposalId, transferAmount } = await createSucceededProposal();

    await (await governor.queue(proposalId)).wait();

    const opId = await governor.timelockId(proposalId);
    expect(opId).to.not.equal(ethers.ZeroHash);
    expect(await timelock.isOperation(opId)).to.equal(true);
    expect(await governor.state(proposalId)).to.equal(4n); // Queued

    await expect(governor.execute(proposalId)).to.be.reverted;

    await time.increase(MIN_DELAY + 1);
    await (await governor.executeTimelocked(proposalId)).wait();

    expect(await governor.state(proposalId)).to.equal(5n); // Executed
    expect(await payoutToken.balanceOf(recipient.address)).to.equal(transferAmount);
  });
});
