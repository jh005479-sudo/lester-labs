import { expect } from "chai";
import { network } from "hardhat";

const { ethers: hardhatEthers } = await network.create();
// Hardhat exposes dynamically keyed contract methods when TypeChain is not installed.
const ethers = hardhatEthers as Omit<typeof hardhatEthers, "getContractFactory"> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContractFactory: (...args: any[]) => Promise<any>;
};

describe("security regression controls", function () {
  it("records a liquidity lock only when the exact requested token amount arrives", async function () {
    const [deployer, owner, treasury, user] = await ethers.getSigners();
    const locker = await (
      await ethers.getContractFactory("LiquidityLocker", deployer)
    ).deploy(0n, owner.address, treasury.address, false);
    const feeToken = await (
      await ethers.getContractFactory("FeeOnTransferToken", deployer)
    ).deploy(user.address, ethers.parseEther("1000"));
    const exactToken = await (
      await ethers.getContractFactory("LesterToken", deployer)
    ).deploy("Exact Token", "EXACT", ethers.parseEther("1000"), 18, false, true, false, user.address);
    await Promise.all([locker.waitForDeployment(), feeToken.waitForDeployment(), exactToken.waitForDeployment()]);

    const unlockTime = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);
    const amount = ethers.parseEther("100");
    await feeToken.connect(user).approve(await locker.getAddress(), amount);
    await expect(
      locker.connect(user).lockLiquidity(await feeToken.getAddress(), amount, unlockTime, user.address),
    ).to.be.revertedWith("Transfer amount mismatch");
    expect(await locker.lockCount()).to.equal(0n);
    expect(await feeToken.balanceOf(await locker.getAddress())).to.equal(0n);

    await exactToken.connect(user).approve(await locker.getAddress(), amount);
    await expect(
      locker.connect(user).lockLiquidity(await exactToken.getAddress(), amount, unlockTime, user.address),
    ).to.emit(locker, "LockCreated").withArgs(0n, await exactToken.getAddress(), amount, unlockTime, user.address);
    expect((await locker.getLock(0n)).amount).to.equal(amount);
  });
});
