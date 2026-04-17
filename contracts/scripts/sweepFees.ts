import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Sweeping fees with account:", deployer.address);
  console.log("Account balance before:", (await ethers.provider.getBalance(deployer.address)).toString());

  const LIQUIDITY_LOCKER = "0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9";
  const VESTING_FACTORY = "0x6EE07118D39e9330Ef0658FFA797EeDD2CB823Cf";

  // --- Sweep LiquidityLocker ---
  console.log("\n=== Sweeping LiquidityLocker ===");
  const liqLocker = await ethers.getContractAt("LiquidityLocker", LIQUIDITY_LOCKER);
  const liqBal = await ethers.provider.getBalance(LIQUIDITY_LOCKER);
  console.log("LiquidityLocker balance:", ethers.formatEther(liqBal), "zkLTC");

  if (liqBal > 0n) {
    const tx1 = await liqLocker.connect(deployer).withdrawFees();
    await tx1.wait();
    console.log("LiquidityLocker sweep tx:", tx1.hash);
  } else {
    console.log("Nothing to sweep from LiquidityLocker");
  }

  // --- Sweep VestingFactory ---
  console.log("\n=== Sweeping VestingFactory ===");
  const vestingFactory = await ethers.getContractAt("VestingFactory", VESTING_FACTORY);
  const vestBal = await ethers.provider.getBalance(VESTING_FACTORY);
  console.log("VestingFactory balance:", ethers.formatEther(vestBal), "zkLTC");

  if (vestBal > 0n) {
    const tx2 = await vestingFactory.connect(deployer).withdraw();
    await tx2.wait();
    console.log("VestingFactory sweep tx:", tx2.hash);
  } else {
    console.log("Nothing to sweep from VestingFactory");
  }

  console.log("\n=== Final balance ===");
  console.log("Deployer balance after:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "zkLTC");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
