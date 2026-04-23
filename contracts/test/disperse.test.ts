import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

async function deployDisperseFixture() {
  const [sender, alice, bob] = await ethers.getSigners();
  const Disperse = await ethers.getContractFactory("Disperse");
  const disperse = await Disperse.deploy();
  await disperse.waitForDeployment();

  return { sender, alice, bob, disperse };
}

describe("Disperse", function () {
  it("requires native airdrops to match the exact recipient total", async function () {
    const { alice, disperse } = await loadFixture(deployDisperseFixture);

    await expect(
      disperse.disperseEther(
        [alice.address],
        [ethers.parseEther("1")],
        { value: ethers.parseEther("1.1") },
      ),
    ).to.be.revertedWith("Incorrect ETH amount");
  });

  it("sends the exact native amounts and leaves no refund balance", async function () {
    const { alice, bob, disperse } = await loadFixture(deployDisperseFixture);

    await expect(
      disperse.disperseEther(
        [alice.address, bob.address],
        [ethers.parseEther("0.4"), ethers.parseEther("0.6")],
        { value: ethers.parseEther("1") },
      ),
    ).to.changeEtherBalances(
      [alice, bob, disperse],
      [ethers.parseEther("0.4"), ethers.parseEther("0.6"), 0n],
    );
  });

  it("does not refund unrelated native balance to the caller", async function () {
    const { alice, disperse } = await loadFixture(deployDisperseFixture);
    const disperseAddress = await disperse.getAddress();
    const stuckBalance = ethers.parseEther("1");

    await ethers.provider.send("hardhat_setBalance", [
      disperseAddress,
      `0x${stuckBalance.toString(16)}`,
    ]);

    await disperse.disperseEther([alice.address], [0n], { value: 0n });

    expect(await ethers.provider.getBalance(disperseAddress)).to.equal(stuckBalance);
  });
});
