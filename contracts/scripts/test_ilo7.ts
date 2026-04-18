import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  
  // Get deployed bytecode hash
  const deployedBytecode = await ethers.provider.getCode("0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  const deployedHash = ethers.keccak256(deployedBytecode);
  console.log("Deployed ILOFactory bytecode hash:", deployedHash);
  
  // Compile our current ILOFactory
  const factory = await ethers.getContractFactory("ILOFactory");
  const ourBytecode = await factory.getStaticCall(
    "0xD56a623890b083d876D47c3b1c5343b7f983FA62",
    "0xDD221FBbCb0f6092AfE51183d964AA89A968eE13",
    200, 30000000000000000n
  ).then(() => factory.bytecode).catch(() => null);
  
  // Actually compile
  const { linkReferences } = await factory.getDeploymentTransaction(
    "0xD56a623890b083d876D47c3b1c5343b7f983FA62",
    "0xDD221FBbCb0f6092AfE51183d964AA89A968eE13", 
    200, 30000000000000000n
  );
  
  // Try reading createILO selector
  const iloFactory = await ethers.getContractAt("ILOFactory", "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  try {
    const createILOSelector = await iloFactory.createILO.getFunction();
    console.log("createILO selector:", createILOSelector);
  } catch(e) {
    console.log("createILO function not accessible");
  }
  
  // Try to find what functions actually work on this contract
  const functions = ['router', 'treasury', 'platformFeeBps', 'creationFee', 'owner'];
  for (const fn of functions) {
    try {
      const result = await (iloFactory as any)[fn]();
      console.log(`${fn}(): ${result}`);
    } catch(e: any) {
      console.log(`${fn}(): REVERTED`);
    }
  }
}

main().catch(console.error);
