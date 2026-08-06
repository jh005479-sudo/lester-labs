import { expect } from "chai";
import type { Log, LogDescription } from "ethers";
import { network } from "hardhat";

const hardhatConnection = await network.create();
const { networkHelpers } = hardhatConnection;
const hardhatEthers = hardhatConnection.ethers;
// hardhat-ethers v4 intentionally exposes dynamically keyed contract methods
// through generic ethers contracts when TypeChain is not installed.
const ethers = hardhatEthers as Omit<
  typeof hardhatEthers,
  "getContractFactory" | "getContractAt"
> & {
  getContractFactory: (...args: any[]) => Promise<any>;
  getContractAt: (...args: any[]) => Promise<any>;
};
const { loadFixture, mine, time } = networkHelpers;

const MIN_DELAY = 2 * 24 * 60 * 60;
const INITIAL_SUPPLY = ethers.parseEther("10000000");
const PROPOSAL_THRESHOLD = ethers.parseEther("100000");
const PROPOSER_TOKENS = ethers.parseEther("200000");
const VOTER_TOKENS = ethers.parseEther("600000");

async function deployGovernanceFixture() {
  const [deployer, controller, treasury, proposer, voter1, voter2, recipient] =
    await ethers.getSigners();
  const startingNonce = await deployer.getNonce();
  const predictedToken = ethers.getCreateAddress({ from: deployer.address, nonce: startingNonce });
  const predictedTimelock = ethers.getCreateAddress({
    from: deployer.address,
    nonce: startingNonce + 1,
  });
  const predictedGovernor = ethers.getCreateAddress({
    from: deployer.address,
    nonce: startingNonce + 2,
  });

  const LitGovToken = await ethers.getContractFactory("LitGovToken", deployer);
  const token = await LitGovToken.deploy(predictedTimelock, treasury.address);
  await token.waitForDeployment();

  const LitTimelock = await ethers.getContractFactory("LitTimelock", deployer);
  const timelock = await LitTimelock.deploy(MIN_DELAY, predictedGovernor, controller.address);
  await timelock.waitForDeployment();

  const LitGovernor = await ethers.getContractFactory("LitGovernor", deployer);
  const governor = await LitGovernor.deploy(
    predictedToken,
    predictedTimelock,
    1,
    5,
    PROPOSAL_THRESHOLD,
    400,
  );
  await governor.waitForDeployment();

  expect(await token.getAddress()).to.equal(predictedToken);
  expect(await timelock.getAddress()).to.equal(predictedTimelock);
  expect(await governor.getAddress()).to.equal(predictedGovernor);

  await (await token.connect(treasury).transfer(proposer.address, PROPOSER_TOKENS)).wait();
  await (await token.connect(treasury).transfer(voter1.address, VOTER_TOKENS)).wait();
  await (await token.connect(treasury).transfer(voter2.address, VOTER_TOKENS)).wait();
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
    controller,
    treasury,
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

async function proposeAndSucceed(
  fixture: Awaited<ReturnType<typeof deployGovernanceFixture>>,
  targets: string[],
  values: bigint[],
  calldatas: string[],
  description: string,
) {
  const { proposer, voter1, voter2, governor } = fixture;
  const proposeTx = await governor.connect(proposer).propose(
    targets,
    values,
    calldatas,
    description,
  );
  const proposeReceipt = await proposeTx.wait();
  const createdEvent = proposeReceipt?.logs
    .map((log: Log) => {
      try {
        return governor.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: LogDescription | null) => event?.name === "ProposalCreated");

  if (!createdEvent) throw new Error("ProposalCreated event not found");
  const proposalId = createdEvent.args.proposalId as bigint;

  await mine(2);
  await (await governor.connect(voter1).castVote(proposalId, 1)).wait();
  await (await governor.connect(voter2).castVote(proposalId, 1)).wait();
  await mine(6);
  expect(await governor.state(proposalId)).to.equal(3n); // Succeeded
  return proposalId;
}

async function createSucceededTokenProposal() {
  const fixture = await loadFixture(deployGovernanceFixture);
  const { governor, payoutToken, recipient } = fixture;
  const transferAmount = ethers.parseEther("10");
  const calldata = payoutToken.interface.encodeFunctionData("transfer", [
    recipient.address,
    transferAmount,
  ]);
  const proposalId = await proposeAndSucceed(
    fixture,
    [await payoutToken.getAddress()],
    [0n],
    [calldata],
    "Transfer tokens after the timelock delay",
  );
  return { ...fixture, proposalId, transferAmount };
}

describe("LitGovernor timelock integration", function () {
  it("constructs the predicted circular stack with no deployer authority", async function () {
    const { deployer, controller, treasury, token, timelock, governor } =
      await loadFixture(deployGovernanceFixture);
    const timelockAddress = await timelock.getAddress();
    const governorAddress = await governor.getAddress();

    expect(await token.owner()).to.equal(timelockAddress);
    expect(await token.initialHolder()).to.equal(treasury.address);
    expect(await token.name()).to.equal("Lit Governance Token");
    expect(await token.symbol()).to.equal("LGT");
    const tokenDomain = await token.eip712Domain();
    expect(tokenDomain.name).to.equal("Lit Governance Token");
    expect(tokenDomain.version).to.equal("1");
    expect(tokenDomain.chainId).to.equal((await ethers.provider.getNetwork()).chainId);
    expect(tokenDomain.verifyingContract).to.equal(await token.getAddress());
    expect(tokenDomain.fields).to.equal("0x0f");
    expect(tokenDomain.salt).to.equal(ethers.ZeroHash);
    expect([...tokenDomain.extensions]).to.deep.equal([]);
    expect(await token.deploymentSigner()).to.equal(deployer.address);
    expect(await token.INITIAL_SUPPLY()).to.equal(INITIAL_SUPPLY);
    expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    expect(await token.balanceOf(deployer.address)).to.equal(0n);
    expect(await token.getVotes(deployer.address)).to.equal(0n);

    expect(await timelock.governor()).to.equal(governorAddress);
    expect(await timelock.emergencyCanceller()).to.equal(controller.address);
    expect(await timelock.deploymentSigner()).to.equal(deployer.address);
    expect(await timelock.getMinDelay()).to.equal(MIN_DELAY);

    const defaultAdminRole = await timelock.DEFAULT_ADMIN_ROLE();
    const proposerRole = await timelock.PROPOSER_ROLE();
    const executorRole = await timelock.EXECUTOR_ROLE();
    const cancellerRole = await timelock.CANCELLER_ROLE();

    expect(await timelock.hasRole(defaultAdminRole, timelockAddress)).to.equal(true);
    expect(await timelock.hasRole(proposerRole, governorAddress)).to.equal(true);
    expect(await timelock.hasRole(executorRole, governorAddress)).to.equal(true);
    expect(await timelock.hasRole(cancellerRole, controller.address)).to.equal(true);
    for (const address of [deployer.address, treasury.address, ethers.ZeroAddress]) {
      expect(await timelock.hasRole(defaultAdminRole, address)).to.equal(false);
      expect(await timelock.hasRole(proposerRole, address)).to.equal(false);
      expect(await timelock.hasRole(executorRole, address)).to.equal(false);
      expect(await timelock.hasRole(cancellerRole, address)).to.equal(false);
    }
    expect(await timelock.hasRole(cancellerRole, governorAddress)).to.equal(false);
    expect(await timelock.hasRole(defaultAdminRole, controller.address)).to.equal(false);

    expect(await governor.token()).to.equal(await token.getAddress());
    expect(await governor.timelock()).to.equal(timelockAddress);
    expect(await governor.deploymentSigner()).to.equal(deployer.address);
    expect(await governor.votingDelay()).to.equal(1n);
    expect(await governor.votingPeriod()).to.equal(5n);
    expect(await governor.proposalThreshold()).to.equal(PROPOSAL_THRESHOLD);
    expect(await governor.quorumBps_()).to.equal(400n);
  });

  it("rejects collapsed roles and deployer-held roles at construction", async function () {
    const [deployer, controller, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("LitGovToken", deployer);
    await expect(Token.deploy(controller.address, controller.address)).to.be.revertedWith(
      "LitGovToken: roles must differ",
    );
    await expect(Token.deploy(deployer.address, treasury.address)).to.be.revertedWith(
      "LitGovToken: deployer control",
    );

    const Timelock = await ethers.getContractFactory("LitTimelock", deployer);
    await expect(Timelock.deploy(MIN_DELAY, controller.address, controller.address)).to.be.revertedWith(
      "LitTimelock: roles must differ",
    );
    await expect(Timelock.deploy(MIN_DELAY, controller.address, deployer.address)).to.be.revertedWith(
      "LitTimelock: deployer control",
    );
  });

  it("does not allow direct execution before the proposal is queued", async function () {
    const { governor, proposalId } = await createSucceededTokenProposal();

    await expect(governor.execute(proposalId)).to.be.revertedWith("Governor: not queued");
    await expect(governor.executeTimelocked(proposalId)).to.be.revertedWith("Governor: not queued");
  });

  it("queues with a stable salt and only executes after the timelock delay", async function () {
    const { governor, timelock, payoutToken, recipient, proposalId, transferAmount } =
      await createSucceededTokenProposal();

    await (await governor.queue(proposalId)).wait();
    const opId = await governor.timelockId(proposalId);
    expect(opId).to.not.equal(ethers.ZeroHash);
    expect(await timelock.isOperation(opId)).to.equal(true);
    expect(await governor.state(proposalId)).to.equal(4n); // Queued

    await expect(governor.execute(proposalId)).to.revert(ethers);
    await time.increase(MIN_DELAY + 1);
    await (await governor.executeTimelocked(proposalId)).wait();

    expect(await governor.state(proposalId)).to.equal(5n); // Executed
    expect(await payoutToken.balanceOf(recipient.address)).to.equal(transferAmount);
  });

  it("keeps a directly timelock-canceled proposal durably canceled", async function () {
    const { controller, governor, timelock, proposalId } = await createSucceededTokenProposal();

    await (await governor.queue(proposalId)).wait();
    const opId = await governor.timelockId(proposalId);
    await (await timelock.connect(controller).cancel(opId)).wait();

    expect(await timelock.isOperation(opId)).to.equal(false);
    expect(await governor.state(proposalId)).to.equal(6n); // Canceled
    await expect(governor.queue(proposalId)).to.be.revertedWith("Governor: not succeeded");
    await expect(governor.execute(proposalId)).to.be.revertedWith("Governor: not queued");
  });

  it("rejects native value at the Governor and funds value proposals from the Timelock", async function () {
    const fixture = await loadFixture(deployGovernanceFixture);
    const { deployer, governor, timelock, recipient } = fixture;
    const amount = ethers.parseEther("1");
    const proposalId = await proposeAndSucceed(
      fixture,
      [recipient.address],
      [amount],
      ["0x"],
      "Pay native value from the prefunded Timelock",
    );

    await (await governor.queue(proposalId)).wait();
    await time.increase(MIN_DELAY + 1);
    const governorAddress = await governor.getAddress();
    const executeData = governor.interface.encodeFunctionData("execute", [proposalId]);
    await expect(
      deployer.sendTransaction({ to: governorAddress, data: executeData, value: 1n }),
    ).to.revert(ethers);
    await expect(deployer.sendTransaction({ to: governorAddress, value: 1n })).to.revert(ethers);
    await expect(governor.execute(proposalId)).to.revert(ethers);

    const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);
    await (await deployer.sendTransaction({ to: await timelock.getAddress(), value: amount })).wait();
    await (await governor.execute(proposalId)).wait();
    expect(await ethers.provider.getBalance(recipient.address)).to.equal(
      recipientBalanceBefore + amount,
    );
  });
});
