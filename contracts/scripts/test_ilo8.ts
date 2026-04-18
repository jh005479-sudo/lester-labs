import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const iloFactory = await ethers.getContractAt("ILOFactory", "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  const connector = "0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD";
  
  // Try calling setConnector directly with the raw interface
  const iface = new ethers.Interface([
    "function setConnector(address) external onlyOwner"
  ]);
  
  // First check what the actual function selector is in our compiled version
  const ourFactory = await ethers.getContractFactory("ILOFactory");
  const selector = ourFactory.interface.getFunction("setConnector").selector;
  console.log("Our compiled selector:", selector);
  
  // Try calling setConnector using our interface with hardhat
  try {
    // Direct call via our interface
    const tx = await (iloFactory as any)["setConnector(address)"](connector);
    console.log("TX sent, waiting...");
    const rcpt = await tx.wait();
    console.log("TX status:", rcpt?.status);
    console.log("Connector now:", await iloFactory.connector());
  } catch(e: any) {
    console.log("Error:", e.message.slice(0, 200));
    if (e.data) console.log("Error data:", e.data);
  }
}

main().catch(console.error);
