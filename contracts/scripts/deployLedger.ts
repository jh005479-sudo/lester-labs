import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying contracts with account:", deployer.address);

  const TREASURY = "0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28";
  if (network.chainId === 4441n && deployer.address.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error(`LitVM deployments must use the approved treasury ${TREASURY}`);
  }

  const TheLedger = await ethers.getContractFactory("TheLedger");
  const ledger = await TheLedger.deploy(TREASURY);
  await ledger.waitForDeployment();
  if ((await ledger.owner()).toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Unexpected TheLedger owner after deployment");
  }
  const ledgerAddress = await ledger.getAddress();
  console.log("TheLedger deployed to:", ledgerAddress);

  const addresses = {
    TheLedger: ledgerAddress,
    treasury: TREASURY,
    network: network.name,
    chainId: Number(network.chainId),
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
