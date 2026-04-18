import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const TREASURY_FEE_TARGET = "0xDD221FBbCb0f6092AfE51183d964AA89A968eE13";
const ONE_DAY = 24 * 60 * 60;

async function deployDexFixture() {
  const [deployer, treasury, trader] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(treasury.address);
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

  return { deployer, treasury, trader, factory, wrappedNative, router, tokenA, tokenB };
}

async function deployLaunchpadFixture() {
  const [deployer, treasury, projectOwner, contributor, other] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("UniswapV2Factory", treasury);
  const factory = await Factory.deploy(treasury.address);
  await factory.waitForDeployment();

  const WETH9 = await ethers.getContractFactory("WETH9", treasury);
  const wrappedNative = await WETH9.deploy();
  await wrappedNative.waitForDeployment();

  const Router = await ethers.getContractFactory("UniswapV2Router02", treasury);
  const router = await Router.deploy(await factory.getAddress(), await wrappedNative.getAddress());
  await router.waitForDeployment();

  const Connector = await ethers.getContractFactory("UniSwapConnector", treasury);
  const connector = await Connector.deploy(await router.getAddress(), await factory.getAddress(), treasury.address);
  await connector.waitForDeployment();

  const ILOFactory = await ethers.getContractFactory("ILOFactory", treasury);
  const iloFactory = await ILOFactory.deploy(
    await router.getAddress(),
    treasury.address,
    200,
    ethers.parseEther("0.03"),
  );
  await iloFactory.waitForDeployment();
  await (await iloFactory.setConnector(await connector.getAddress())).wait();

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
  it("routes 0.20% of swap input to the treasury on every trade", async function () {
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
    await router.connect(trader).swapExactTokensForTokens(
      ethers.parseEther("100"),
      0,
      [await tokenA.getAddress(), await tokenB.getAddress()],
      trader.address,
      (await time.latest()) + ONE_DAY,
    );

    const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);

    expect(await tokenA.balanceOf(treasury.address)).to.equal(ethers.parseEther("0.2"));
    expect(await pair.token0()).to.not.equal(ethers.ZeroAddress);
    expect(await pair.token1()).to.not.equal(ethers.ZeroAddress);
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

  it("refuses to seed launchpad liquidity if fee routing drifts away from the treasury", async function () {
    const { treasury, projectOwner, contributor, other, factory, ilo, startTime } = await loadFixture(deployLaunchpadFixture);

    await time.increaseTo(startTime + 1);
    await ilo.connect(contributor).contribute({ value: ethers.parseEther("10") });
    await factory.connect(treasury).setFeeTo(other.address);

    await expect(ilo.connect(projectOwner).finalize()).to.be.revertedWith("Invalid feeTo");
  });

  it("keeps the expected Lester treasury target available for deployment assertions", async function () {
    expect(TREASURY_FEE_TARGET).to.equal("0xDD221FBbCb0f6092AfE51183d964AA89A968eE13");
  });
});
