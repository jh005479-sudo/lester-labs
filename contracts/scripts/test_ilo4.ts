import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const iloFactory = await ethers.getContractAt("ILOFactory", "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  
  // Get all function selectors from deployed bytecode
  const code = await ethers.provider.getCode(iloFactory.target);
  const selectorMap: Record<string, string> = {};
  
  // Try calling various functions
  const funcs = [
    "router()",
    "feeTo()", 
    "connector()",
    "treasury()",
    "platformFeeBps()",
    "creationFee()"
  ];
  
  for (const f of funcs) {
    try {
      const result = await iloFactory[f]();
      console.log(`${f}: ${result}`);
    } catch(e: any) {
      console.log(`${f}: REVERTED - ${e.message.slice(0, 80)}`);
    }
  }
  
  // Check what the bytecode contains at selector position
  // Find 0x83f3084f in bytecode
  const selPos = code.toLowerCase().indexOf('83f3084f');
  console.log("\nSelector 0x83f3084f found at position:", selPos);
}

main().catch(console.error);
