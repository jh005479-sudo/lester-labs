import { ethers } from "hardhat";

async function main() {
  const iloFactory = await ethers.getContractAt("ILOFactory", "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  const connector = "0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD";
  
  // Check storage layout
  console.log("Storage slots:");
  console.log("Slot 0 (owner):", await ethers.provider.getStorage(iloFactory.target, 0));
  console.log("Slot 1 (router):", await ethers.provider.getStorage(iloFactory.target, 1));
  console.log("Slot 2 (??):", await ethers.provider.getStorage(iloFactory.target, 2));
  console.log("Slot 3 (??):", await ethers.provider.getStorage(iloFactory.target, 3));
  console.log("Slot 4:", await ethers.provider.getStorage(iloFactory.target, 4));
  
  // Try reading with our compiled interface
  console.log("\nTrying functions via ethers...");
  
  // Try to read connector with different function name
  try {
    const c = await (iloFactory as any).connector();
    console.log("connector():", c);
  } catch(e: any) {
    console.log("connector() FAILED:", e.message.slice(0,100));
  }
  
  // Check if feeTo exists  
  try {
    const ft = await (iloFactory as any).feeTo();
    console.log("feeTo():", ft);
  } catch(e: any) {
    console.log("feeTo() FAILED:", e.message.slice(0,100));
  }
  
  // Check platformFeeBps
  try {
    const pf = await iloFactory.platformFeeBps();
    console.log("platformFeeBps():", pf);
  } catch(e: any) {
    console.log("platformFeeBps() FAILED");
  }
  
  // Check creationFee
  try {
    const cf = await iloFactory.creationFee();
    console.log("creationFee():", cf);
  } catch(e: any) {
    console.log("creationFee() FAILED");
  }

  // Try UniSwapConnector's addLiquidityETH to see if it's actually callable
  const uniConnector = await ethers.getContractAt("UniSwapConnector", connector);
  console.log("\nUniSwapConnector checks:");
  console.log("  factory:", await uniConnector.factory());
  console.log("  router:", await uniConnector.router());
  console.log("  treasury:", await uniConnector.treasury());
  
  // Try the WETH deposit/approve pattern
  const wzkltc = await ethers.getContractAt("IERC20", "0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97");
  const signer = (await ethers.getSigners())[0];
  const balance = await wzkltc.balanceOf(signer.address);
  console.log("\nWzkLTC balance:", ethers.formatEther(balance));
  
  if (balance > 0n) {
    const tx = await wzkltc.transfer(iloFactory.target, 1000000n);
    await tx.wait();
    console.log("Transferred 1M wzkLTC to ILOFactory");
  }
}

main().catch(console.error);
