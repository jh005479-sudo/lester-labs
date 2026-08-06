import { expect } from "chai";
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
const { loadFixture, time } = networkHelpers;

const ONE_DAY = 24 * 60 * 60;

async function deployDexFixture() {
  const [deployer, controller, treasury, trader] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(controller.address, treasury.address, false);
  await factory.waitForDeployment();

  const WETH9 = await ethers.getContractFactory("WETH9");
  const wrappedNative = await WETH9.deploy();
  await wrappedNative.waitForDeployment();

  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(await factory.getAddress(), await wrappedNative.getAddress());
  await router.waitForDeployment();

  const LesterToken = await ethers.getContractFactory("LesterToken");
  const tokenA = await LesterToken.deploy(
    "Alpha",
    "ALPHA",
    ethers.parseEther("1000000"),
    18,
    false,
    true,
    false,
    deployer.address,
  );
  await tokenA.waitForDeployment();

  const tokenB = await LesterToken.deploy(
    "Beta",
    "BETA",
    ethers.parseEther("1000000"),
    18,
    false,
    true,
    false,
    deployer.address,
  );
  await tokenB.waitForDeployment();

  await tokenA.approve(await router.getAddress(), ethers.MaxUint256);
  await tokenB.approve(await router.getAddress(), ethers.MaxUint256);
  await tokenA.transfer(trader.address, ethers.parseEther("1000"));

  return { deployer, controller, treasury, trader, factory, wrappedNative, router, tokenA, tokenB };
}

async function deployLaunchpadFixture() {
  const [deployer, controller, treasury, projectOwner, contributor, other] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("UniswapV2Factory", deployer);
  const factory = await Factory.deploy(controller.address, treasury.address, false);
  await factory.waitForDeployment();

  const WETH9 = await ethers.getContractFactory("WETH9", deployer);
  const wrappedNative = await WETH9.deploy();
  await wrappedNative.waitForDeployment();

  const Router = await ethers.getContractFactory("UniswapV2Router02", deployer);
  const router = await Router.deploy(await factory.getAddress(), await wrappedNative.getAddress());
  await router.waitForDeployment();

  const Connector = await ethers.getContractFactory("UniSwapConnector", deployer);
  const connector = await Connector.deploy(
    await router.getAddress(),
    await factory.getAddress(),
    treasury.address,
    controller.address,
    false,
  );
  await connector.waitForDeployment();

  const ILOFactory = await ethers.getContractFactory("ILOFactory", deployer);
  const iloFactory = await ILOFactory.deploy(
    await router.getAddress(),
    await connector.getAddress(),
    treasury.address,
    200,
    ethers.parseEther("0.03"),
    controller.address,
    false,
  );
  await iloFactory.waitForDeployment();

  const LesterToken = await ethers.getContractFactory("LesterToken", projectOwner);
  const saleToken = await LesterToken.deploy(
    "Launch Token",
    "LCH",
    ethers.parseEther("500000"),
    18,
    false,
    true,
    false,
    projectOwner.address,
  );
  await saleToken.waitForDeployment();

  const now = await time.latest();
  const startTime = now + 10;
  const endTime = startTime + ONE_DAY;

  await iloFactory.connect(projectOwner).createILO(
    await saleToken.getAddress(),
    ethers.parseEther("5"),
    ethers.parseEther("10"),
    ethers.parseEther("100"),
    BigInt(startTime),
    BigInt(endTime),
    6000,
    BigInt(30 * ONE_DAY),
    false,
    { value: ethers.parseEther("0.03") },
  );

  const iloAddress = await iloFactory.ownerILOs(projectOwner.address, 0n);
  const ilo = await ethers.getContractAt("ILO", iloAddress);
  const tokensRequired = await ilo.tokensRequired();
  await saleToken.connect(projectOwner).transfer(iloAddress, tokensRequired);

  return {
    deployer,
    controller,
    treasury,
    projectOwner,
    contributor,
    other,
    factory,
    wrappedNative,
    router,
    connector,
    iloFactory,
    saleToken,
    ilo,
    iloAddress,
    startTime,
    endTime,
  };
}

describe("Lester Labs Uniswap V2 fork", function () {
  it("uses the canonical 0.30% invariant and realizes protocol fees as LP tokens", async function () {
    const { deployer, treasury, trader, factory, router, tokenA, tokenB } = await loadFixture(deployDexFixture);

    await router.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      ethers.parseEther("1000"),
      ethers.parseEther("1000"),
      0,
      0,
      deployer.address,
      (await time.latest()) + ONE_DAY,
    );

    await tokenA.connect(trader).approve(await router.getAddress(), ethers.MaxUint256);
    expect(await router.totalSwapCount()).to.equal(0n);
    await router.connect(trader).swapExactTokensForTokens(
      ethers.parseEther("100"),
      0,
      [await tokenA.getAddress(), await tokenB.getAddress()],
      trader.address,
      (await time.latest()) + ONE_DAY,
    );
    expect(await router.totalSwapCount()).to.equal(1n);

    await expect(
      router.connect(trader).swapExactTokensForTokens(
        ethers.parseEther("1000000"),
        0,
        [await tokenA.getAddress(), await tokenB.getAddress()],
        trader.address,
        (await time.latest()) + ONE_DAY,
      ),
    ).to.revert(ethers);
    expect(await router.totalSwapCount()).to.equal(1n);

    const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);

    expect(await tokenA.balanceOf(treasury.address)).to.equal(0n);
    expect(await tokenB.balanceOf(treasury.address)).to.equal(0n);
    expect(await pair.balanceOf(treasury.address)).to.equal(0n);

    await router.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      ethers.parseEther("100"),
      ethers.parseEther("100"),
      0,
      0,
      deployer.address,
      (await time.latest()) + ONE_DAY,
    );

    expect(await pair.balanceOf(treasury.address)).to.be.gt(0n);
    expect(await pair.token0()).to.not.equal(ethers.ZeroAddress);
    expect(await pair.token1()).to.not.equal(ethers.ZeroAddress);
  });

  it("counts each successful public Router swap entrypoint exactly once", async function () {
    const { deployer, trader, wrappedNative, router, tokenA, tokenB } = await loadFixture(deployDexFixture);
    const routerAddress = await router.getAddress();
    const tokenAAddress = await tokenA.getAddress();
    const tokenBAddress = await tokenB.getAddress();
    const wrappedNativeAddress = await wrappedNative.getAddress();
    const deadline = (await time.latest()) + ONE_DAY;

    await router.addLiquidity(
      tokenAAddress,
      tokenBAddress,
      ethers.parseEther("1000"),
      ethers.parseEther("1000"),
      0,
      0,
      deployer.address,
      deadline,
    );
    await router.addLiquidityETH(
      tokenAAddress,
      ethers.parseEther("1000"),
      0,
      0,
      deployer.address,
      deadline,
      { value: ethers.parseEther("10") },
    );
    await tokenA.connect(trader).approve(routerAddress, ethers.MaxUint256);

    const successfulSwaps = [
      () => router.connect(trader).swapExactTokensForTokens(
        ethers.parseEther("1"),
        0,
        [tokenAAddress, tokenBAddress],
        trader.address,
        deadline,
      ),
      () => router.connect(trader).swapTokensForExactTokens(
        ethers.parseEther("0.1"),
        ethers.parseEther("2"),
        [tokenAAddress, tokenBAddress],
        trader.address,
        deadline,
      ),
      () => router.connect(trader).swapExactETHForTokens(
        0,
        [wrappedNativeAddress, tokenAAddress],
        trader.address,
        deadline,
        { value: ethers.parseEther("0.01") },
      ),
      () => router.connect(trader).swapTokensForExactETH(
        ethers.parseEther("0.001"),
        ethers.parseEther("2"),
        [tokenAAddress, wrappedNativeAddress],
        trader.address,
        deadline,
      ),
      () => router.connect(trader).swapExactTokensForETH(
        ethers.parseEther("1"),
        0,
        [tokenAAddress, wrappedNativeAddress],
        trader.address,
        deadline,
      ),
      () => router.connect(trader).swapETHForExactTokens(
        ethers.parseEther("0.1"),
        [wrappedNativeAddress, tokenAAddress],
        trader.address,
        deadline,
        { value: ethers.parseEther("0.01") },
      ),
      () => router.connect(trader).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        ethers.parseEther("1"),
        0,
        [tokenAAddress, tokenBAddress],
        trader.address,
        deadline,
      ),
      () => router.connect(trader).swapExactETHForTokensSupportingFeeOnTransferTokens(
        0,
        [wrappedNativeAddress, tokenAAddress],
        trader.address,
        deadline,
        { value: ethers.parseEther("0.01") },
      ),
      () => router.connect(trader).swapExactTokensForETHSupportingFeeOnTransferTokens(
        ethers.parseEther("1"),
        0,
        [tokenAAddress, wrappedNativeAddress],
        trader.address,
        deadline,
      ),
    ];

    expect(await router.totalSwapCount()).to.equal(0n);
    for (const [index, swap] of successfulSwaps.entries()) {
      await swap();
      expect(await router.totalSwapCount()).to.equal(BigInt(index + 1));
    }

    await expect(
      router.connect(trader).swapExactETHForTokens(
        ethers.MaxUint256,
        [wrappedNativeAddress, tokenAAddress],
        trader.address,
        deadline,
        { value: ethers.parseEther("0.01") },
      ),
    ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    expect(await router.totalSwapCount()).to.equal(9n);
  });

  it("finalizes an ILO into the Lester Labs router and locks the LP tokens on the sale contract", async function () {
    const { projectOwner, contributor, factory, router, saleToken, ilo, startTime } = await loadFixture(deployLaunchpadFixture);

    await time.increaseTo(startTime + 1);
    await ilo.connect(contributor).contribute({ value: ethers.parseEther("10") });
    await ilo.connect(projectOwner).finalize();

    const pairAddress = await factory.getPair(await saleToken.getAddress(), await router.WETH());
    expect(pairAddress).to.not.equal(ethers.ZeroAddress);
    expect(await ilo.lpToken()).to.equal(pairAddress);
    expect(await ilo.lpTokensLocked()).to.be.gt(0n);
  });

  it("lets the owner recover excess sale tokens after preserving finalized contributor claims", async function () {
    const { projectOwner, contributor, saleToken, ilo, startTime, endTime } = await loadFixture(deployLaunchpadFixture);

    await time.increaseTo(startTime + 1);
    await ilo.connect(contributor).contribute({ value: ethers.parseEther("5") });
    await time.increaseTo(endTime + 1);
    await ilo.connect(projectOwner).finalize();

    const ownerBalanceBefore = await saleToken.balanceOf(projectOwner.address);
    await expect(ilo.connect(projectOwner).sweepExcessTokens()).to.emit(ilo, "ExcessTokensSwept");
    expect(await saleToken.balanceOf(projectOwner.address)).to.be.gt(ownerBalanceBefore);

    await ilo.connect(contributor).claim();
    expect(await saleToken.balanceOf(contributor.address)).to.equal(ethers.parseEther("500"));
  });

  it("lets the owner recover funded sale tokens after a failed presale", async function () {
    const { projectOwner, contributor, saleToken, ilo, startTime, endTime } = await loadFixture(deployLaunchpadFixture);

    await time.increaseTo(startTime + 1);
    await ilo.connect(contributor).contribute({ value: ethers.parseEther("1") });
    await time.increaseTo(endTime + 1);
    await ilo.connect(projectOwner).cancel();

    const ownerBalanceBefore = await saleToken.balanceOf(projectOwner.address);
    await ilo.connect(projectOwner).sweepExcessTokens();
    expect(await saleToken.balanceOf(projectOwner.address)).to.be.gt(ownerBalanceBefore);
  });

  it("refuses to finalize an ILO into a skewed pre-existing pair", async function () {
    const { projectOwner, contributor, router, saleToken, ilo, startTime } = await loadFixture(deployLaunchpadFixture);

    await saleToken.connect(projectOwner).approve(await router.getAddress(), ethers.MaxUint256);
    await router.connect(projectOwner).addLiquidityETH(
      await saleToken.getAddress(),
      ethers.parseEther("100000"),
      0,
      0,
      projectOwner.address,
      (await time.latest()) + ONE_DAY,
      { value: ethers.parseEther("1") },
    );

    await time.increaseTo(startTime + 1);
    await ilo.connect(contributor).contribute({ value: ethers.parseEther("10") });

    await expect(ilo.connect(projectOwner).finalize()).to.revert(ethers);
  });

  it("refuses to seed launchpad liquidity if fee routing drifts away from the treasury", async function () {
    const { controller, projectOwner, contributor, other, factory, ilo, startTime } = await loadFixture(deployLaunchpadFixture);

    await time.increaseTo(startTime + 1);
    await ilo.connect(contributor).contribute({ value: ethers.parseEther("10") });
    await factory.connect(controller).setFeeTo(other.address);

    await expect(ilo.connect(projectOwner).finalize()).to.be.revertedWith("Invalid feeTo");
  });

  it("refuses to create new launchpads after DEX fee routing drifts", async function () {
    const { controller, projectOwner, other, factory, iloFactory, saleToken } = await loadFixture(deployLaunchpadFixture);
    const now = await time.latest();
    await factory.connect(controller).setFeeTo(other.address);

    await expect(
      iloFactory.connect(projectOwner).createILO(
        await saleToken.getAddress(),
        ethers.parseEther("5"),
        ethers.parseEther("10"),
        ethers.parseEther("100"),
        BigInt(now + 10),
        BigInt(now + ONE_DAY),
        6000,
        BigInt(30 * ONE_DAY),
        false,
        { value: ethers.parseEther("0.03") },
      ),
    ).to.be.revertedWith("Invalid feeTo");
  });

  it("does not refund force-sent native balance and clears residual router allowance", async function () {
    const { projectOwner, router, connector, saleToken } = await loadFixture(deployLaunchpadFixture);
    const connectorAddress = await connector.getAddress();
    const forcedBalance = ethers.parseEther("1");
    await ethers.provider.send("hardhat_setBalance", [
      connectorAddress,
      `0x${forcedBalance.toString(16)}`,
    ]);

    const desiredTokens = ethers.parseEther("100");
    await saleToken.connect(projectOwner).approve(connectorAddress, desiredTokens);
    await connector.connect(projectOwner).addLiquidityETH(
      await saleToken.getAddress(),
      desiredTokens,
      0,
      0,
      projectOwner.address,
      (await time.latest()) + ONE_DAY,
      { value: ethers.parseEther("1") },
    );

    expect(await ethers.provider.getBalance(connectorAddress)).to.equal(forcedBalance);
    expect(await saleToken.allowance(connectorAddress, await router.getAddress())).to.equal(0n);
  });

  it("rejects unsafe launchpad factory deployment parameters", async function () {
    const { controller, treasury, projectOwner, router, connector } = await loadFixture(deployLaunchpadFixture);
    const ILOFactory = await ethers.getContractFactory("ILOFactory");

    await expect(
      ILOFactory.deploy(
        projectOwner.address,
        await connector.getAddress(),
        treasury.address,
        200,
        ethers.parseEther("0.03"),
        controller.address,
        false,
      ),
    ).to.be.revertedWith("Invalid router");

    await expect(
      ILOFactory.deploy(
        ethers.ZeroAddress,
        await connector.getAddress(),
        treasury.address,
        200,
        ethers.parseEther("0.03"),
        controller.address,
        false,
      ),
    ).to.be.revertedWith("Invalid router");

    await expect(
      ILOFactory.deploy(
        await router.getAddress(),
        projectOwner.address,
        treasury.address,
        200,
        ethers.parseEther("0.03"),
        controller.address,
        false,
      ),
    ).to.be.revertedWith("Invalid connector");

    await expect(
      ILOFactory.deploy(
        await router.getAddress(),
        await connector.getAddress(),
        ethers.ZeroAddress,
        200,
        ethers.parseEther("0.03"),
        controller.address,
        false,
      ),
    ).to.be.revertedWith("Invalid treasury");

    await expect(
      ILOFactory.deploy(
        await router.getAddress(),
        await connector.getAddress(),
        treasury.address,
        501,
        ethers.parseEther("0.03"),
        controller.address,
        false,
      ),
    ).to.be.revertedWith("Max 5%");
  });

  it("rejects unsafe launchpad factory admin updates", async function () {
    const { controller, projectOwner, iloFactory } = await loadFixture(deployLaunchpadFixture);

    await expect(iloFactory.connect(controller).setRouter(projectOwner.address)).to.be.revertedWith("Invalid router");
    await expect(iloFactory.connect(controller).setRouter(ethers.ZeroAddress)).to.be.revertedWith("Invalid router");
    await expect(iloFactory.connect(controller).setConnector(projectOwner.address)).to.be.revertedWith("Invalid connector");
    await expect(iloFactory.connect(controller).setConnector(ethers.ZeroAddress)).to.be.revertedWith("Invalid connector");
    await expect(iloFactory.connect(controller).setTreasury(ethers.ZeroAddress)).to.be.revertedWith("Invalid treasury");
  });

  it("rotates ILO controller and routing together without stranding the factory", async function () {
    const {
      deployer,
      controller,
      contributor: nextController,
      other: nextTreasury,
      factory,
      router,
      iloFactory,
    } = await loadFixture(deployLaunchpadFixture);

    await expect(iloFactory.connect(controller).transferOwnership(nextController.address)).to.be.revertedWith(
      "Use rotateControlAndRouting",
    );
    await expect(iloFactory.connect(controller).renounceOwnership()).to.be.revertedWith(
      "ILOFactory ownership is required",
    );

    const Connector = await ethers.getContractFactory("UniSwapConnector", deployer);
    const replacementConnector = await Connector.deploy(
      await router.getAddress(),
      await factory.getAddress(),
      nextTreasury.address,
      nextController.address,
      false,
    );
    await replacementConnector.waitForDeployment();

    // In production these three calls must be one ordered multisig batch.
    await factory.connect(controller).setFeeTo(nextTreasury.address);
    await factory.connect(controller).setFeeToSetter(nextController.address);
    await expect(
      iloFactory.connect(controller).rotateControlAndRouting(
        nextController.address,
        await router.getAddress(),
        await replacementConnector.getAddress(),
        nextTreasury.address,
      ),
    ).to.emit(iloFactory, "ControllerRotated").withArgs(
      controller.address,
      nextController.address,
      await replacementConnector.getAddress(),
    );

    expect(await iloFactory.owner()).to.equal(nextController.address);
    expect(await iloFactory.treasury()).to.equal(nextTreasury.address);
    expect(await iloFactory.connector()).to.equal(await replacementConnector.getAddress());
    expect(await replacementConnector.assertTreasuryRouting()).to.equal(true);
    await expect(iloFactory.connect(controller).setCreationFee(1n))
      .to.be.revertedWithCustomError(iloFactory, "OwnableUnauthorizedAccount")
      .withArgs(controller.address);
    await expect(iloFactory.connect(nextController).setCreationFee(1n)).to.not.revert(ethers);
    expect(await iloFactory.getILOCount()).to.equal(1n);
  });

  it("rejects launchpad sales that point at a non-contract token address", async function () {
    const { projectOwner, iloFactory } = await loadFixture(deployLaunchpadFixture);
    const now = await time.latest();

    await expect(
      iloFactory.connect(projectOwner).createILO(
        projectOwner.address,
        ethers.parseEther("5"),
        ethers.parseEther("10"),
        ethers.parseEther("100"),
        BigInt(now + 10),
        BigInt(now + ONE_DAY),
        6000,
        BigInt(30 * ONE_DAY),
        false,
        { value: ethers.parseEther("0.03") },
      ),
    ).to.be.revertedWith("Invalid token");
  });
});
