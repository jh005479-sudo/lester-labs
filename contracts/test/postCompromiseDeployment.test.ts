import { expect } from "chai";
import { network } from "hardhat";
import type { ContractFactory } from "ethers";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IMMUTABLE_TESTNET_AUTHORITY,
  PRODUCTION_SEPARATED_PROFILE,
  REPLACEMENT_MANIFEST_KIND,
  REPLACEMENT_PARAMETERS,
  REPLACEMENT_SCHEMA_VERSION,
  TESTNET_IMMUTABLE_DISPOSABLE_PROFILE,
  governanceInitialHolder,
  pinnedLegacyRecovery,
  requireFreshIncidentSafeAddress,
  type ReplacementPlan,
  validateReplacementPlan,
  verifyImmutableTestnetAuthorityPrecompile,
} from "../scripts/lib/post_compromise_replacement.js";

const { ethers: hardhatEthers } = await network.create();
// hardhat-ethers v4 intentionally exposes dynamically keyed contract methods
// through generic ethers contracts when TypeChain is not installed.
const ethers = hardhatEthers as Omit<
  typeof hardhatEthers,
  "getContractFactory" | "getContractAt"
> & {
  getContractFactory: (...args: any[]) => Promise<any>;
  getContractAt: (...args: any[]) => Promise<any>;
};
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN_FEE = ethers.parseEther("0.05");
const STANDARD_FEE = ethers.parseEther("0.03");

describe("post-compromise replacement authority", function () {
  it("pins the immutable testnet controller to working ECRECOVER precompile semantics", async function () {
    await verifyImmutableTestnetAuthorityPrecompile(ethers.provider);
  });

  it("re-simulates address-dependent constructors at the exact historical CREATE nonce", async function () {
    const [gasOnlyDeployer, controller, treasury] = await ethers.getSigners();
    const startingNonce = await ethers.provider.getTransactionCount(gasOnlyDeployer.address);
    const expectedAddress = ethers.getCreateAddress({
      from: gasOnlyDeployer.address,
      nonce: startingNonce,
    });
    const factory = await ethers.getContractFactory("LitGovToken", gasOnlyDeployer);
    const expectedDeploy = await factory.getDeployTransaction(
      controller.address,
      treasury.address,
    );
    expect(expectedDeploy.data).to.be.a("string");

    const token = await factory.deploy(controller.address, treasury.address);
    const deploymentTransaction = token.deploymentTransaction();
    expect(deploymentTransaction).to.not.equal(null);
    expect(deploymentTransaction!.from).to.equal(gasOnlyDeployer.address);
    expect(deploymentTransaction!.nonce).to.equal(startingNonce);
    expect(deploymentTransaction!.data).to.equal(expectedDeploy.data);

    const receipt = await deploymentTransaction!.wait();
    expect(receipt).to.not.equal(null);
    expect(receipt!.status).to.equal(1);
    expect(receipt!.contractAddress).to.equal(expectedAddress);
    const simulationBlock = receipt!.blockNumber - 1;
    expect(simulationBlock).to.be.at.least(0);
    expect(await ethers.provider.getCode(expectedAddress, simulationBlock)).to.equal("0x");
    expect(
      await ethers.provider.getTransactionCount(gasOnlyDeployer.address, simulationBlock),
    ).to.equal(startingNonce);
    expect(
      await ethers.provider.getTransactionCount(gasOnlyDeployer.address, receipt!.blockNumber),
    ).to.equal(startingNonce + 1);

    const deployedRuntime = await ethers.provider.getCode(expectedAddress, receipt!.blockNumber);
    expect(deployedRuntime).to.not.equal("0x");
    const deployedRuntimeHash = ethers.keccak256(deployedRuntime);
    const historicalRuntime = await ethers.provider.call({
      from: gasOnlyDeployer.address,
      data: expectedDeploy.data,
      blockTag: simulationBlock,
    });
    expect(ethers.keccak256(historicalRuntime)).to.equal(deployedRuntimeHash);

    let postDeploymentSimulationMatches = false;
    try {
      const postDeploymentRuntime = await ethers.provider.call({
        from: gasOnlyDeployer.address,
        data: expectedDeploy.data,
        blockTag: receipt!.blockNumber,
      });
      postDeploymentSimulationMatches =
        ethers.keccak256(postDeploymentRuntime) === deployedRuntimeHash;
    } catch {
      // A backend may reject the post-deployment CREATE simulation; it must
      // never be accepted as reproducing the historical deployed runtime.
    }
    expect(postDeploymentSimulationMatches).to.equal(false);
  });

  it("deploys the complete stack at predicted addresses without ever granting the gas signer authority", async function () {
    const [gasOnlyDeployer, controller, treasury, user] = await ethers.getSigners();
    const startingNonce = await gasOnlyDeployer.getNonce();
    let deploymentIndex = 0;

    async function deploy(
      factory: ContractFactory,
      args: readonly unknown[],
    ): Promise<any> {
      const expectedAddress = ethers.getCreateAddress({
        from: gasOnlyDeployer.address,
        nonce: startingNonce + deploymentIndex,
      });
      const contract = await factory.connect(gasOnlyDeployer).deploy(...args);
      const transaction = contract.deploymentTransaction();
      expect(transaction).to.not.equal(null);
      expect(transaction!.nonce).to.equal(startingNonce + deploymentIndex);
      await contract.waitForDeployment();
      expect(await contract.getAddress()).to.equal(expectedAddress);
      deploymentIndex += 1;
      return contract;
    }

    const wrappedNative = await deploy(await ethers.getContractFactory("WETH9"), []);
    const dexFactory = await deploy(await ethers.getContractFactory("UniswapV2Factory"), [
      controller.address,
      treasury.address,
      false,
    ]);
    const router = await deploy(await ethers.getContractFactory("UniswapV2Router02"), [
      await dexFactory.getAddress(),
      await wrappedNative.getAddress(),
    ]);
    const connector = await deploy(await ethers.getContractFactory("UniSwapConnector"), [
      await router.getAddress(),
      await dexFactory.getAddress(),
      treasury.address,
      controller.address,
      false,
    ]);
    const tokenFactory = await deploy(await ethers.getContractFactory("TokenFactory"), [
      TOKEN_FEE,
      controller.address,
      treasury.address,
      false,
    ]);
    const vestingFactory = await deploy(await ethers.getContractFactory("VestingFactory"), [
      STANDARD_FEE,
      controller.address,
      treasury.address,
      false,
    ]);
    const liquidityLocker = await deploy(await ethers.getContractFactory("LiquidityLocker"), [
      STANDARD_FEE,
      controller.address,
      treasury.address,
      false,
    ]);
    const ledger = await deploy(await ethers.getContractFactory("TheLedger"), [
      treasury.address,
      controller.address,
      false,
    ]);
    const disperse = await deploy(await ethers.getContractFactory("Disperse"), []);
    const iloFactory = await deploy(await ethers.getContractFactory("ILOFactory"), [
      await router.getAddress(),
      await connector.getAddress(),
      treasury.address,
      200,
      STANDARD_FEE,
      controller.address,
      false,
    ]);

    const predictedGovernanceToken = ethers.getCreateAddress({
      from: gasOnlyDeployer.address,
      nonce: startingNonce + 10,
    });
    const predictedGovernanceTimelock = ethers.getCreateAddress({
      from: gasOnlyDeployer.address,
      nonce: startingNonce + 11,
    });
    const predictedGovernanceGovernor = ethers.getCreateAddress({
      from: gasOnlyDeployer.address,
      nonce: startingNonce + 12,
    });
    const governanceToken = await deploy(await ethers.getContractFactory("LitGovToken"), [
      predictedGovernanceTimelock,
      treasury.address,
    ]);
    const governanceTimelock = await deploy(await ethers.getContractFactory("LitTimelock"), [
      BigInt(REPLACEMENT_PARAMETERS.governanceTimelockDelay),
      predictedGovernanceGovernor,
      controller.address,
    ]);
    const governanceGovernor = await deploy(await ethers.getContractFactory("LitGovernor"), [
      predictedGovernanceToken,
      predictedGovernanceTimelock,
      BigInt(REPLACEMENT_PARAMETERS.governanceVotingDelay),
      BigInt(REPLACEMENT_PARAMETERS.governanceVotingPeriod),
      BigInt(REPLACEMENT_PARAMETERS.governanceProposalThreshold),
      BigInt(REPLACEMENT_PARAMETERS.governanceQuorumBps),
    ]);

    expect(deploymentIndex).to.equal(13);
    expect(await dexFactory.feeToSetter()).to.equal(controller.address);
    expect(await dexFactory.feeTo()).to.equal(treasury.address);
    expect(await dexFactory.deploymentSigner()).to.equal(gasOnlyDeployer.address);
    expect(await dexFactory.deploymentSignerMayReceiveFees()).to.equal(false);
    expect(await router.factory()).to.equal(await dexFactory.getAddress());
    expect(await router.WETH()).to.equal(await wrappedNative.getAddress());
    expect(await router.totalSwapCount()).to.equal(0n);
    expect(await connector.controller()).to.equal(controller.address);
    expect(await connector.treasury()).to.equal(treasury.address);
    expect(await connector.deploymentSigner()).to.equal(gasOnlyDeployer.address);
    expect(await connector.deploymentSignerMayReceiveFees()).to.equal(false);
    expect(await connector.assertTreasuryRouting()).to.equal(true);

    for (const contract of [tokenFactory, vestingFactory, liquidityLocker, ledger, iloFactory]) {
      expect(await contract.owner()).to.equal(controller.address);
      expect(await contract.treasury()).to.equal(treasury.address);
      expect(await contract.deploymentSigner()).to.equal(gasOnlyDeployer.address);
      expect(await contract.deploymentSignerMayReceiveFees()).to.equal(false);
      expect(await contract.owner()).to.not.equal(gasOnlyDeployer.address);
      expect(await contract.treasury()).to.not.equal(gasOnlyDeployer.address);
    }
    expect(await iloFactory.router()).to.equal(await router.getAddress());
    expect(await iloFactory.connector()).to.equal(await connector.getAddress());
    expect(await iloFactory.dexFactory()).to.equal(await dexFactory.getAddress());
    expect(await ethers.provider.getTransactionCount(await tokenFactory.getAddress())).to.equal(1);
    expect(await ledger.messageCount()).to.equal(0n);
    expect(await disperse.totalRecipientEntries()).to.equal(0n);
    expect(await iloFactory.getILOCount()).to.equal(0n);
    expect(await governanceToken.owner()).to.equal(await governanceTimelock.getAddress());
    expect(await governanceToken.initialHolder()).to.equal(treasury.address);
    expect(await governanceToken.name()).to.equal("Lit Governance Token");
    expect(await governanceToken.symbol()).to.equal("LGT");
    const governanceDomain = await governanceToken.eip712Domain();
    expect(governanceDomain.name).to.equal("Lit Governance Token");
    expect(governanceDomain.version).to.equal("1");
    expect(governanceDomain.chainId).to.equal((await ethers.provider.getNetwork()).chainId);
    expect(governanceDomain.verifyingContract).to.equal(await governanceToken.getAddress());
    expect(governanceDomain.fields).to.equal("0x0f");
    expect(governanceDomain.salt).to.equal(ethers.ZeroHash);
    expect([...governanceDomain.extensions]).to.deep.equal([]);
    expect(await governanceToken.deploymentSigner()).to.equal(gasOnlyDeployer.address);
    expect(await governanceToken.totalSupply()).to.equal(
      BigInt(REPLACEMENT_PARAMETERS.governanceInitialSupply),
    );
    expect(await governanceToken.balanceOf(treasury.address)).to.equal(
      BigInt(REPLACEMENT_PARAMETERS.governanceInitialSupply),
    );
    expect(await governanceToken.getVotes(treasury.address)).to.equal(
      BigInt(REPLACEMENT_PARAMETERS.governanceInitialSupply),
    );
    expect(await governanceToken.balanceOf(gasOnlyDeployer.address)).to.equal(0n);
    expect(await governanceToken.getVotes(gasOnlyDeployer.address)).to.equal(0n);
    expect(await governanceTimelock.governor()).to.equal(await governanceGovernor.getAddress());
    expect(await governanceTimelock.emergencyCanceller()).to.equal(controller.address);
    expect(await governanceTimelock.deploymentSigner()).to.equal(gasOnlyDeployer.address);
    expect(await governanceGovernor.token()).to.equal(await governanceToken.getAddress());
    expect(await governanceGovernor.timelock()).to.equal(await governanceTimelock.getAddress());
    expect(await governanceGovernor.deploymentSigner()).to.equal(gasOnlyDeployer.address);

    const defaultAdminRole = await governanceTimelock.DEFAULT_ADMIN_ROLE();
    const proposerRole = await governanceTimelock.PROPOSER_ROLE();
    const executorRole = await governanceTimelock.EXECUTOR_ROLE();
    const cancellerRole = await governanceTimelock.CANCELLER_ROLE();
    expect(
      await governanceTimelock.hasRole(defaultAdminRole, await governanceTimelock.getAddress()),
    ).to.equal(true);
    expect(
      await governanceTimelock.hasRole(proposerRole, await governanceGovernor.getAddress()),
    ).to.equal(true);
    expect(
      await governanceTimelock.hasRole(executorRole, await governanceGovernor.getAddress()),
    ).to.equal(true);
    expect(await governanceTimelock.hasRole(cancellerRole, controller.address)).to.equal(true);
    for (const role of [defaultAdminRole, proposerRole, executorRole, cancellerRole]) {
      expect(await governanceTimelock.hasRole(role, gasOnlyDeployer.address)).to.equal(false);
      expect(await governanceTimelock.hasRole(role, treasury.address)).to.equal(false);
      expect(await governanceTimelock.hasRole(role, ethers.ZeroAddress)).to.equal(false);
    }
    expect(
      await governanceTimelock.hasRole(cancellerRole, await governanceGovernor.getAddress()),
    ).to.equal(false);

    await expect(tokenFactory.connect(gasOnlyDeployer).setFee(1n))
      .to.be.revertedWithCustomError(tokenFactory, "OwnableUnauthorizedAccount")
      .withArgs(gasOnlyDeployer.address);
    await expect(vestingFactory.connect(gasOnlyDeployer).setFee(1n))
      .to.be.revertedWithCustomError(vestingFactory, "OwnableUnauthorizedAccount")
      .withArgs(gasOnlyDeployer.address);
    await expect(liquidityLocker.connect(gasOnlyDeployer).setFee(1n))
      .to.be.revertedWithCustomError(liquidityLocker, "OwnableUnauthorizedAccount")
      .withArgs(gasOnlyDeployer.address);
    await expect(ledger.connect(gasOnlyDeployer).setTreasury(gasOnlyDeployer.address))
      .to.be.revertedWithCustomError(ledger, "OwnableUnauthorizedAccount")
      .withArgs(gasOnlyDeployer.address);
    await expect(iloFactory.connect(gasOnlyDeployer).setCreationFee(1n))
      .to.be.revertedWithCustomError(iloFactory, "OwnableUnauthorizedAccount")
      .withArgs(gasOnlyDeployer.address);
    await expect(dexFactory.connect(gasOnlyDeployer).setFeeTo(gasOnlyDeployer.address)).to.be.revertedWith(
      "UniswapV2: FORBIDDEN",
    );
    await expect(governanceToken.connect(gasOnlyDeployer).mint(user.address, 1n)).to.be.revertedWith(
      "LitGovToken: caller is not the owner",
    );

    for (const contract of [tokenFactory, vestingFactory, liquidityLocker, ledger, iloFactory]) {
      await expect(contract.connect(controller).transferOwnership(gasOnlyDeployer.address)).to.be.revertedWith(
        "Deployer cannot control",
      );
      await expect(contract.connect(controller).setTreasury(gasOnlyDeployer.address)).to.be.revertedWith(
        "Deployer cannot control",
      );
    }
    await expect(dexFactory.connect(controller).setFeeTo(gasOnlyDeployer.address)).to.be.revertedWith(
      "UniswapV2: DEPLOYER_CONTROL",
    );
    await expect(dexFactory.connect(controller).setFeeToSetter(gasOnlyDeployer.address)).to.be.revertedWith(
      "UniswapV2: DEPLOYER_CONTROL",
    );

    for (const contract of [tokenFactory, vestingFactory, liquidityLocker, ledger, iloFactory]) {
      await expect(contract.connect(controller).setTreasury(controller.address)).to.be.revertedWith(
        "Owner and treasury must differ",
      );
      await expect(contract.connect(controller).transferOwnership(treasury.address)).to.be.revertedWith(
        "Owner and treasury must differ",
      );
    }
    await expect(dexFactory.connect(controller).setFeeTo(controller.address)).to.be.revertedWith(
      "UniswapV2: ROLES_MUST_DIFFER",
    );
    await expect(dexFactory.connect(controller).setFeeToSetter(treasury.address)).to.be.revertedWith(
      "UniswapV2: ROLES_MUST_DIFFER",
    );

    const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
    await expect(
      tokenFactory.connect(user).createToken(
        "Fresh Token",
        "FRESH",
        ethers.parseEther("1000"),
        18,
        false,
        true,
        false,
        { value: TOKEN_FEE },
      ),
    ).to.emit(tokenFactory, "ProtocolFeeForwarded").withArgs(treasury.address, TOKEN_FEE);
    expect(await ethers.provider.getBalance(treasury.address)).to.equal(treasuryBalanceBefore + TOKEN_FEE);
    expect(await ethers.provider.getBalance(await tokenFactory.getAddress())).to.equal(0n);

    const TestToken = await ethers.getContractFactory("LesterToken", user);
    const testToken = await TestToken.deploy(
      "Fee Route Token",
      "FRT",
      ethers.parseEther("1000"),
      18,
      false,
      true,
      false,
      user.address,
    );
    await testToken.waitForDeployment();
    const latestBlock = await ethers.provider.getBlock("latest");
    expect(latestBlock).to.not.equal(null);

    await testToken.connect(user).approve(await vestingFactory.getAddress(), ethers.parseEther("100"));
    const beforeVestingFee = await ethers.provider.getBalance(treasury.address);
    await expect(
      vestingFactory.connect(user).createVestingSchedule(
        await testToken.getAddress(),
        user.address,
        ethers.parseEther("100"),
        BigInt(latestBlock!.timestamp),
        0,
        1000,
        false,
        { value: STANDARD_FEE },
      ),
    ).to.emit(vestingFactory, "ProtocolFeeForwarded").withArgs(treasury.address, STANDARD_FEE);
    expect(await ethers.provider.getBalance(treasury.address)).to.equal(beforeVestingFee + STANDARD_FEE);
    expect(await ethers.provider.getBalance(await vestingFactory.getAddress())).to.equal(0n);

    await testToken.connect(user).approve(await liquidityLocker.getAddress(), ethers.parseEther("100"));
    const beforeLockerFee = await ethers.provider.getBalance(treasury.address);
    await expect(
      liquidityLocker.connect(user).lockLiquidity(
        await testToken.getAddress(),
        ethers.parseEther("100"),
        BigInt(latestBlock!.timestamp + 1000),
        user.address,
        { value: STANDARD_FEE },
      ),
    ).to.emit(liquidityLocker, "ProtocolFeeForwarded").withArgs(treasury.address, STANDARD_FEE);
    expect(await ethers.provider.getBalance(treasury.address)).to.equal(beforeLockerFee + STANDARD_FEE);
    expect(await ethers.provider.getBalance(await liquidityLocker.getAddress())).to.equal(0n);

    const ledgerPostFee = ethers.parseEther("0.01");
    const ledgerImmediateTreasuryFee = ledgerPostFee / 2n;
    const beforeLedgerPost = await ethers.provider.getBalance(treasury.address);
    await expect(
      ledger.connect(user).post(ethers.toUtf8Bytes("replacement ledger route"), { value: ledgerPostFee }),
    ).to.emit(ledger, "ProtocolFeeForwarded").withArgs(treasury.address, ledgerImmediateTreasuryFee);
    expect(await ethers.provider.getBalance(treasury.address)).to.equal(
      beforeLedgerPost + ledgerImmediateTreasuryFee,
    );
    expect(await ethers.provider.getBalance(await ledger.getAddress())).to.equal(ledgerImmediateTreasuryFee);
    const beforeLedgerWithdrawal = await ethers.provider.getBalance(treasury.address);
    await expect(ledger.connect(gasOnlyDeployer).flushRetainedFeesToTreasury())
      .to.emit(ledger, "NativeFeesWithdrawn")
      .withArgs(treasury.address, ledgerImmediateTreasuryFee);
    expect(await ethers.provider.getBalance(treasury.address)).to.equal(
      beforeLedgerWithdrawal + ledgerImmediateTreasuryFee,
    );
    expect(await ethers.provider.getBalance(await ledger.getAddress())).to.equal(0n);
    await expect(ledger.connect(user).flushRetainedFeesToTreasury()).to.be.revertedWith(
      "No retained fees",
    );

    const excessiveFee = ethers.parseEther("0.100000000000000001");
    await expect(tokenFactory.connect(controller).setFee(excessiveFee)).to.be.revertedWith("Fee too high");
    await expect(vestingFactory.connect(controller).setFee(excessiveFee)).to.be.revertedWith("Fee too high");
    await expect(liquidityLocker.connect(controller).setFee(excessiveFee)).to.be.revertedWith("Fee too high");
    await expect(iloFactory.connect(controller).setCreationFee(excessiveFee)).to.be.revertedWith(
      "Creation fee too high",
    );

    const otherDexFactory = await (
      await ethers.getContractFactory("UniswapV2Factory", user)
    ).deploy(controller.address, treasury.address, false);
    await otherDexFactory.waitForDeployment();
    const otherWrappedNative = await (await ethers.getContractFactory("WETH9", user)).deploy();
    await otherWrappedNative.waitForDeployment();
    const otherRouter = await (
      await ethers.getContractFactory("UniswapV2Router02", user)
    ).deploy(await otherDexFactory.getAddress(), await otherWrappedNative.getAddress());
    await otherRouter.waitForDeployment();
    const otherConnector = await (
      await ethers.getContractFactory("UniSwapConnector", user)
    ).deploy(
      await otherRouter.getAddress(),
      await otherDexFactory.getAddress(),
      treasury.address,
      controller.address,
      false,
    );
    await otherConnector.waitForDeployment();
    await expect(
      iloFactory.connect(controller).setRouting(
        await otherRouter.getAddress(),
        await otherConnector.getAddress(),
        treasury.address,
      ),
    ).to.be.revertedWith("Router factory mismatch");

    for (const [artifact, args] of [
      ["TokenFactory", [TOKEN_FEE, controller.address, controller.address, false]],
      ["VestingFactory", [STANDARD_FEE, controller.address, controller.address, false]],
      ["LiquidityLocker", [STANDARD_FEE, controller.address, controller.address, false]],
      ["TheLedger", [controller.address, controller.address, false]],
    ] as const) {
      const Contract = await ethers.getContractFactory(artifact, gasOnlyDeployer);
      await expect(Contract.deploy(...args)).to.be.revertedWith("Owner and treasury must differ");
    }
    const Connector = await ethers.getContractFactory("UniSwapConnector", gasOnlyDeployer);
    await expect(
      Connector.deploy(
        await router.getAddress(),
        await dexFactory.getAddress(),
        controller.address,
        controller.address,
        false,
      ),
    ).to.be.revertedWith("Controller and treasury must differ");
    const IloFactory = await ethers.getContractFactory("ILOFactory", gasOnlyDeployer);
    await expect(
      IloFactory.deploy(
        await router.getAddress(),
        await connector.getAddress(),
        controller.address,
        200,
        STANDARD_FEE,
        controller.address,
        false,
      ),
    ).to.be.revertedWith("Owner and treasury must differ");
  });

  it("rejects zero or deployer-controlled administration while allowing a deployer fee recipient", async function () {
    const [gasOnlyDeployer, controller, treasury] = await ethers.getSigners();
    const TokenFactory = await ethers.getContractFactory("TokenFactory");

    await expect(TokenFactory.deploy(TOKEN_FEE, ethers.ZeroAddress, treasury.address, false))
      .to.be.revertedWithCustomError(TokenFactory, "OwnableInvalidOwner")
      .withArgs(ethers.ZeroAddress);
    await expect(TokenFactory.deploy(TOKEN_FEE, controller.address, ethers.ZeroAddress, false)).to.be.revertedWith(
      "Invalid treasury",
    );
    await expect(TokenFactory.deploy(TOKEN_FEE, gasOnlyDeployer.address, treasury.address, false)).to.be.revertedWith(
      "Deployer cannot control",
    );
    await expect(
      TokenFactory.deploy(TOKEN_FEE, controller.address, gasOnlyDeployer.address, false),
    ).to.be.revertedWith("Deployer fee recipient disabled");
    const economicOnlyFactory = await TokenFactory.deploy(
      TOKEN_FEE,
      controller.address,
      gasOnlyDeployer.address,
      true,
    );
    await economicOnlyFactory.waitForDeployment();
    expect(await economicOnlyFactory.owner()).to.equal(controller.address);
    expect(await economicOnlyFactory.treasury()).to.equal(gasOnlyDeployer.address);
    await expect(economicOnlyFactory.connect(gasOnlyDeployer).setFee(1n))
      .to.be.revertedWithCustomError(economicOnlyFactory, "OwnableUnauthorizedAccount")
      .withArgs(gasOnlyDeployer.address);

    const DexFactory = await ethers.getContractFactory("UniswapV2Factory");
    await expect(DexFactory.deploy(ethers.ZeroAddress, treasury.address, false)).to.be.revertedWith(
      "UniswapV2: ZERO_SETTER",
    );
    await expect(DexFactory.deploy(controller.address, ethers.ZeroAddress, false)).to.be.revertedWith(
      "UniswapV2: ZERO_FEE_TO",
    );
    await expect(DexFactory.deploy(gasOnlyDeployer.address, treasury.address, false)).to.be.revertedWith(
      "UniswapV2: DEPLOYER_CONTROL",
    );
    await expect(
      DexFactory.deploy(controller.address, gasOnlyDeployer.address, false),
    ).to.be.revertedWith("UniswapV2: DEPLOYER_FEE_RECIPIENT_DISABLED");
    const economicOnlyDex = await DexFactory.deploy(controller.address, gasOnlyDeployer.address, true);
    await economicOnlyDex.waitForDeployment();
    expect(await economicOnlyDex.feeToSetter()).to.equal(controller.address);
    expect(await economicOnlyDex.feeTo()).to.equal(gasOnlyDeployer.address);
    await expect(economicOnlyDex.connect(gasOnlyDeployer).setFeeTo(treasury.address)).to.be.revertedWith(
      "UniswapV2: FORBIDDEN",
    );
  });

  it("freezes every testnet administrative path while the deployment signer receives only fees", async function () {
    const [disposableTreasury, user] = await ethers.getSigners();
    const controller = IMMUTABLE_TESTNET_AUTHORITY;

    const wrappedNative = await (await ethers.getContractFactory("WETH9", disposableTreasury)).deploy();
    await wrappedNative.waitForDeployment();
    const dexFactory = await (
      await ethers.getContractFactory("UniswapV2Factory", disposableTreasury)
    ).deploy(controller, disposableTreasury.address, true);
    await dexFactory.waitForDeployment();
    const router = await (
      await ethers.getContractFactory("UniswapV2Router02", disposableTreasury)
    ).deploy(await dexFactory.getAddress(), await wrappedNative.getAddress());
    await router.waitForDeployment();
    const connector = await (
      await ethers.getContractFactory("UniSwapConnector", disposableTreasury)
    ).deploy(
      await router.getAddress(),
      await dexFactory.getAddress(),
      disposableTreasury.address,
      controller,
      true,
    );
    await connector.waitForDeployment();

    const tokenFactory = await (
      await ethers.getContractFactory("TokenFactory", disposableTreasury)
    ).deploy(TOKEN_FEE, controller, disposableTreasury.address, true);
    const vestingFactory = await (
      await ethers.getContractFactory("VestingFactory", disposableTreasury)
    ).deploy(STANDARD_FEE, controller, disposableTreasury.address, true);
    const liquidityLocker = await (
      await ethers.getContractFactory("LiquidityLocker", disposableTreasury)
    ).deploy(STANDARD_FEE, controller, disposableTreasury.address, true);
    const ledger = await (
      await ethers.getContractFactory("TheLedger", disposableTreasury)
    ).deploy(disposableTreasury.address, controller, true);
    const iloFactory = await (
      await ethers.getContractFactory("ILOFactory", disposableTreasury)
    ).deploy(
      await router.getAddress(),
      await connector.getAddress(),
      disposableTreasury.address,
      200,
      STANDARD_FEE,
      controller,
      true,
    );
    await Promise.all([
      tokenFactory.waitForDeployment(),
      vestingFactory.waitForDeployment(),
      liquidityLocker.waitForDeployment(),
      ledger.waitForDeployment(),
      iloFactory.waitForDeployment(),
    ]);

    expect(await dexFactory.feeToSetter()).to.equal(controller);
    expect(await dexFactory.feeTo()).to.equal(disposableTreasury.address);
    expect(await dexFactory.deploymentSignerMayReceiveFees()).to.equal(true);
    expect(await connector.controller()).to.equal(controller);
    expect(await connector.treasury()).to.equal(disposableTreasury.address);
    expect(await connector.deploymentSignerMayReceiveFees()).to.equal(true);
    expect(await connector.assertTreasuryRouting()).to.equal(true);
    for (const contract of [tokenFactory, vestingFactory, liquidityLocker, ledger, iloFactory]) {
      expect(await contract.owner()).to.equal(controller);
      expect(await contract.treasury()).to.equal(disposableTreasury.address);
      expect(await contract.deploymentSignerMayReceiveFees()).to.equal(true);
      await expect(contract.connect(disposableTreasury).transferOwnership(user.address))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(disposableTreasury.address);
    }
    await expect(dexFactory.connect(disposableTreasury).setFeeTo(user.address)).to.be.revertedWith(
      "UniswapV2: FORBIDDEN",
    );

    const governanceNonce = await disposableTreasury.getNonce();
    const predictedToken = ethers.getCreateAddress({ from: disposableTreasury.address, nonce: governanceNonce });
    const predictedTimelock = ethers.getCreateAddress({ from: disposableTreasury.address, nonce: governanceNonce + 1 });
    const predictedGovernor = ethers.getCreateAddress({ from: disposableTreasury.address, nonce: governanceNonce + 2 });
    const governanceToken = await (
      await ethers.getContractFactory("LitGovToken", disposableTreasury)
    ).deploy(predictedTimelock, controller);
    await governanceToken.waitForDeployment();
    const governanceTimelock = await (
      await ethers.getContractFactory("LitTimelock", disposableTreasury)
    ).deploy(BigInt(REPLACEMENT_PARAMETERS.governanceTimelockDelay), predictedGovernor, controller);
    await governanceTimelock.waitForDeployment();
    const governanceGovernor = await (
      await ethers.getContractFactory("LitGovernor", disposableTreasury)
    ).deploy(
      predictedToken,
      predictedTimelock,
      BigInt(REPLACEMENT_PARAMETERS.governanceVotingDelay),
      BigInt(REPLACEMENT_PARAMETERS.governanceVotingPeriod),
      BigInt(REPLACEMENT_PARAMETERS.governanceProposalThreshold),
      BigInt(REPLACEMENT_PARAMETERS.governanceQuorumBps),
    );
    await governanceGovernor.waitForDeployment();

    expect(await governanceToken.initialHolder()).to.equal(controller);
    expect(await governanceToken.balanceOf(controller)).to.equal(
      BigInt(REPLACEMENT_PARAMETERS.governanceInitialSupply),
    );
    expect(await governanceToken.getVotes(controller)).to.equal(
      BigInt(REPLACEMENT_PARAMETERS.governanceInitialSupply),
    );
    expect(await governanceToken.balanceOf(disposableTreasury.address)).to.equal(0n);
    expect(await governanceToken.getVotes(disposableTreasury.address)).to.equal(0n);
    expect(await governanceTimelock.emergencyCanceller()).to.equal(controller);
    expect(await governanceTimelock.governor()).to.equal(predictedGovernor);
    expect(await governanceGovernor.token()).to.equal(predictedToken);
    expect(await governanceGovernor.timelock()).to.equal(predictedTimelock);
  });

  it("fails closed on placeholder, compromised, and chat-disclosed plan addresses", function () {
    const safeController = "0x1111111111111111111111111111111111111111";
    const safeTreasury = "0x2222222222222222222222222222222222222222";
    const basePlan: ReplacementPlan = {
      kind: REPLACEMENT_MANIFEST_KIND,
      schemaVersion: REPLACEMENT_SCHEMA_VERSION,
      chainId: "4441",
      deploymentProfile: PRODUCTION_SEPARATED_PROFILE,
      controller: safeController,
      treasury: safeTreasury,
      parameters: { ...REPLACEMENT_PARAMETERS },
    };

    expect(() => validateReplacementPlan({ ...basePlan, controller: ethers.ZeroAddress })).to.throw(
      "must be non-zero",
    );
    expect(() => validateReplacementPlan({ ...basePlan, treasury: safeController })).to.throw(
      "must be distinct",
    );
    expect(() =>
      validateReplacementPlan({
        ...basePlan,
        controller: "0xdd221fbbcb0f6092afe51183d964aa89a968ee13",
      }),
    ).to.throw("must not reuse");
    expect(() =>
      validateReplacementPlan({
        ...basePlan,
        controller: IMMUTABLE_TESTNET_AUTHORITY,
      }),
    ).to.throw("must not reuse");

    const immutablePlan: ReplacementPlan = {
      ...basePlan,
      deploymentProfile: TESTNET_IMMUTABLE_DISPOSABLE_PROFILE,
      controller: IMMUTABLE_TESTNET_AUTHORITY,
      treasury: "0xcbf819017ae48f261fe143b2a7c8a29d9a2fcd28",
    };
    expect(validateReplacementPlan(immutablePlan).controller).to.equal(
      ethers.getAddress(IMMUTABLE_TESTNET_AUTHORITY),
    );
    expect(governanceInitialHolder(immutablePlan)).to.equal(IMMUTABLE_TESTNET_AUTHORITY);
    expect(() => validateReplacementPlan({ ...immutablePlan, controller: safeController })).to.throw(
      "freeze every controller role",
    );
    expect(() => validateReplacementPlan({ ...immutablePlan, treasury: safeTreasury })).to.throw(
      "explicitly authorised",
    );
    expect(() => validateReplacementPlan({
      ...basePlan,
      deploymentProfile: "unreviewed" as ReplacementPlan["deploymentProfile"],
    })).to.throw("Unsupported replacement deployment profile");
    expect(() =>
      validateReplacementPlan({
        ...basePlan,
        treasury: "0xcbf819017ae48f261fe143b2a7c8a29d9a2fcd28",
      }),
    ).to.throw("must not reuse");
    expect(() =>
      requireFreshIncidentSafeAddress(
        "Gas-only deployer",
        "0xcbf819017ae48f261fe143b2a7c8a29d9a2fcd28",
      ),
    ).to.throw("must not reuse");
    expect(() =>
      requireFreshIncidentSafeAddress("Gas-only deployer", IMMUTABLE_TESTNET_AUTHORITY),
    ).to.throw("must not reuse");
    expect(() =>
      validateReplacementPlan({
        ...basePlan,
        controller: "0xd38ed693730db3eb22ba6d6f0050fc45ac9240ba",
      }),
    ).to.throw("must not reuse");
    expect(() =>
      requireFreshIncidentSafeAddress(
        "Gas-only deployer",
        "0xd56a623890b083d876d47c3b1c5343b7f983fa62",
      ),
    ).to.throw("must not reuse");
  });

  it("pins both legacy ILO factory runtimes as recovery provenance", function () {
    const legacy = pinnedLegacyRecovery();
    expect(legacy.addresses.iloFactory).to.equal("0xa533bbe87bdcd91e4367de517e99bf8ba75fd0ab");
    expect(legacy.addresses.productionBuildIloFactory).to.equal(
      "0xc9b1961def0cc5bc1ffe3cfe37a4988d7987a43f",
    );
    expect(legacy.runtimeCodeHashes.productionBuildIloFactory).to.equal(
      "0xed56b878c6c936b7a54c0fc501a87cd96dc185e8d0967759df88817a03bc2dd5",
    );
    expect(
      legacy.iloFactoryProvenance.reduce(
        (total, factory) => total + BigInt(factory.observedChildCount),
        0n,
      ),
    ).to.equal(8451n);
  });

  it("never auto-loads ignored .env files into Hardhat deployment inputs", function () {
    const configSource = fs.readFileSync(path.resolve(__dirname, "../hardhat.config.ts"), "utf8");
    expect(configSource).not.to.match(/from ["']dotenv["']/);
    expect(configSource).not.to.match(/dotenv\.config\s*\(/);
  });

  it("requires fresh production roles and temporally consistent finality evidence", function () {
    const librarySource = fs.readFileSync(
      path.resolve(__dirname, "../scripts/lib/post_compromise_replacement.ts"),
      "utf8",
    );
    const deploySource = fs.readFileSync(
      path.resolve(__dirname, "../scripts/deploy_post_compromise_replacements.ts"),
      "utf8",
    );
    expect(librarySource).to.match(/startingNonce !== 0/);
    expect(deploySource).to.match(/startingNonce !== 0/);
    expect(librarySource).to.match(/Production controller[\s\S]*Production treasury/);
    expect(librarySource).to.match(/verifiedAtBlock < latestDeploymentBlock/);
    expect(librarySource).to.match(/verifiedAtBlock < requiredFinalityBlock/);
  });
});
