import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const iloFactory = await ethers.getContractAt("ILOFactory", "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  const connector = "0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD";
  
  // Check all storage slots
  console.log("Slot 0 (owner):", await ethers.provider.getStorage(iloFactory.target, 0));
  console.log("Slot 1 (router):", await ethers.provider.getStorage(iloFactory.target, 1));
  console.log("Slot 2 (connector):", await ethers.provider.getStorage(iloFactory.target, 2));
  console.log("Slot 3 (treasury):", await ethers.provider.getStorage(iloFactory.target, 3));
  
  // Check bytecode
  const code = await ethers.provider.getCode(iloFactory.target);
  console.log("ILOFactory code length:", code.length);
  
  // Try setConnector with manual gas
  console.log("\nTrying setConnector...");
  try {
    const tx = await iloFactory.setConnector(connector, { gasLimit: 100000 });
    const rcpt = await tx.wait();
    console.log("Success! connector is now:", await iloFactory.connector());
  } catch(e: any) {
    console.log("Error:", e.message.slice(0, 150));
    // Try to decode revert reason
    if (e.data) console.log("Revert data:", e.data);
  }
}

main().catch(console.error);
