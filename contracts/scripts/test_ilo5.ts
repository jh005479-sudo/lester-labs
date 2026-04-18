import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  
  // Get ILOFactory bytecode
  const factory = await ethers.getContractFactory("ILOFactory");
  const expectedBytecode = await factory.getBytecode(
    "0xD56a623890b083d876D47c3b1c5343b7f983FA62", // router
    "0xDD221FBbCb0f6092AfE51183d964AA89A968eE13", // treasury
    200, 30000000000000000n
  );
  console.log("Expected bytecode hash:", ethers.keccak256(expectedBytecode));
  
  // Get deployed bytecode
  const deployedBytecode = await ethers.provider.getCode("0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  console.log("Deployed bytecode length:", deployedBytecode.length);
  
  // Compare
  const deployedHash = ethers.keccak256(deployedBytecode);
  console.log("Deployed bytecode hash:", deployedHash);
  
  // Check what selectors exist in deployed code
  const selectors = ['0x83f3084f', '0x10188aef', '0x06fdde03', '0x95d89b41'];
  for (const sel of selectors) {
    const pos = deployedBytecode.indexOf(sel.replace('0x',''));
    console.log(`Selector ${sel}: ${pos >= 0 ? 'FOUND at ' + pos : 'NOT FOUND'}`);
  }
  
  // Check for revert patterns
  const revertedPatterns = ['fd44ba4b', '351c5b1d']; // require revert selectors
  for (const pat of revertedPatterns) {
    const count = (deployedBytecode.match(new RegExp(pat, 'g')) || []).length;
    if (count > 0) console.log(`Revert selector ${pat}: ${count} occurrences`);
  }
}

main().catch(console.error);
