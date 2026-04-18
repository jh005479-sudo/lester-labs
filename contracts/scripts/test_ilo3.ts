import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const iloFactory = await ethers.getContractAt("ILOFactory", "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  
  // Check specific storage slots
  for (let i = 0; i < 10; i++) {
    const val = await ethers.provider.getStorage(iloFactory.target, i);
    console.log(`Slot ${i}:`, val);
  }
  
  // Try the raw interface
  const iface = new ethers.Interface([
    "function connector() view returns (address)",
    "function setConnector(address) returns ()"
  ]);
  
  console.log("\nRaw connector() call:");
  const result = await ethers.provider.call({
    to: iloFactory.target,
    data: "0x83f3084f"
  });
  console.log("Result:", result);
}

main().catch(console.error);
