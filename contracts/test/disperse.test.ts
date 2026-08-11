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
  it("bounds each airdrop to between one and 200 recipients", async function () {
    const { alice, disperse } = await loadFixture(deployDisperseFixture);
    expect(await disperse.MAX_RECIPIENTS()).to.equal(200n);
    await expect(disperse.disperseEther([], [], { value: 0n })).to.be.revertedWith(
      "Invalid recipient count",
    );
    await expect(
      disperse.disperseEther(
        Array.from({ length: 201 }, () => alice.address),
        Array.from({ length: 201 }, () => 0n),
        { value: 0n },
      ),
    ).to.be.revertedWith("Invalid recipient count");
  });

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

  it("rejects zero-value recipient entries", async function () {
    const { alice, disperse } = await loadFixture(deployDisperseFixture);
    await expect(disperse.disperseEther([alice.address], [0n], { value: 0n })).to.be.revertedWith(
      "Invalid amount",
    );
    await expect(
      disperse.disperseToken(ethers.ZeroAddress, [alice.address], [0n]),
    ).to.be.revertedWith("Invalid amount");
  });

  it("sends the exact native amounts and leaves no refund balance", async function () {
    const { sender, alice, bob, disperse } = await loadFixture(deployDisperseFixture);
    const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);
    const bobBalanceBefore = await ethers.provider.getBalance(bob.address);

    await expect(
      disperse.disperseEther(
        [alice.address, bob.address],
        [ethers.parseEther("0.4"), ethers.parseEther("0.6")],
        { value: ethers.parseEther("1") },
      ),
    ).to.emit(disperse, "EtherDispersed").withArgs(sender.address, 2n, ethers.parseEther("1"));
    expect(await ethers.provider.getBalance(alice.address)).to.equal(
      aliceBalanceBefore + ethers.parseEther("0.4"),
    );
    expect(await ethers.provider.getBalance(bob.address)).to.equal(
      bobBalanceBefore + ethers.parseEther("0.6"),
    );
    expect(await ethers.provider.getBalance(await disperse.getAddress())).to.equal(0n);
    expect(await disperse.totalRecipientEntries()).to.equal(2n);
  });

  it("does not refund unrelated native balance to the caller", async function () {
    const { alice, disperse } = await loadFixture(deployDisperseFixture);
    const disperseAddress = await disperse.getAddress();
    const stuckBalance = ethers.parseEther("1");

    await ethers.provider.send("hardhat_setBalance", [
      disperseAddress,
      `0x${stuckBalance.toString(16)}`,
    ]);

    await disperse.disperseEther([alice.address], [1n], { value: 1n });

    expect(await ethers.provider.getBalance(disperseAddress)).to.equal(stuckBalance);
  });

  it("uses safe ERC-20 transfers and emits an authenticated distribution summary", async function () {
    const { sender, alice, bob, disperse } = await loadFixture(deployDisperseFixture);
    const Token = await ethers.getContractFactory("LesterToken");
    const token = await Token.deploy(
      "Airdrop Token",
      "AIR",
      ethers.parseEther("100"),
      18,
      false,
      true,
      false,
      sender.address,
    );
    await token.waitForDeployment();
    await token.approve(await disperse.getAddress(), ethers.parseEther("30"));

    await expect(
      disperse.disperseToken(
        await token.getAddress(),
        [alice.address, bob.address],
        [ethers.parseEther("10"), ethers.parseEther("20")],
      ),
    ).to.emit(disperse, "TokenDispersed").withArgs(
      sender.address,
      await token.getAddress(),
      2n,
      ethers.parseEther("30"),
    );
    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("10"));
    expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("20"));
    expect(await token.balanceOf(await disperse.getAddress())).to.equal(0n);
    expect(await disperse.totalRecipientEntries()).to.equal(2n);
  });
});
