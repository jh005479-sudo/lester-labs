import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const { loadFixture } = networkHelpers;

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
    const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);
    const bobBalanceBefore = await ethers.provider.getBalance(bob.address);

    await disperse.disperseEther(
      [alice.address, bob.address],
      [ethers.parseEther("0.4"), ethers.parseEther("0.6")],
      { value: ethers.parseEther("1") },
    );

    expect(await ethers.provider.getBalance(alice.address)).to.equal(
      aliceBalanceBefore + ethers.parseEther("0.4"),
    );
    expect(await ethers.provider.getBalance(bob.address)).to.equal(
      bobBalanceBefore + ethers.parseEther("0.6"),
    );
    expect(await ethers.provider.getBalance(await disperse.getAddress())).to.equal(0n);
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
