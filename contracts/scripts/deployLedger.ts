import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const TREASURY = "0xd7cccad536197f0b914aea716c340a7da6855353";

  const TheLedger = await ethers.getContractFactory("TheLedger");
  const ledger = await TheLedger.deploy(TREASURY);
  await ledger.waitForDeployment();
  const ledgerAddress = await ledger.getAddress();
  console.log("TheLedger deployed to:", ledgerAddress);

  const addresses = {
    TheLedger: ledgerAddress,
    treasury: TREASURY,
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  const outputPath = path.join(__dirname, "..", "deployed-addresses.json");
  const existing = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  fs.writeFileSync(outputPath, JSON.stringify({ ...existing, ...addresses }, null, 2));
  console.log("Updated deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
