import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  
  // Get deployed bytecode
  const deployedBytecode = await ethers.provider.getCode("0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  console.log("Deployed bytecode length:", deployedBytecode.length);
  
  // Check for specific selectors
  const selectors = ['83f3084f', '10188aef', '06fdde03', '95d89b41', '18160ddd', '70a08231', 'a9059cbb'];
  for (const sel of selectors) {
    const pos = deployedBytecode.toLowerCase().indexOf(sel);
    console.log(`Selector 0x${sel}: ${pos >= 0 ? 'FOUND at ' + pos : 'NOT FOUND'}`);
  }
  
  // Check what the current bytecode does at position of selector
  // Selector 0x83f3084f = connector()
  // This is the 4-byte JUMP to connector function
  // The selector is placed in the bytecode as part of the function dispatcher
}

main().catch(console.error);
