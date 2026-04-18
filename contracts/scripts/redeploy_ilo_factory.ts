import { ethers } from "hardhat";

const TREASURY = "0xDD221FBbCb0f6092AfE51183d964AA89A968eE13";

// Existing deployed addresses
const ROUTER = "0xD56a623890b083d876D47c3b1c5343b7f983FA62";  // Our UniswapV2Router02
const CONNECTOR = "0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD"; // Our UniSwapConnector

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

  console.log("\n[1/2] Deploying new ILOFactory...");
  const ILOFactory = await ethers.getContractFactory("ILOFactory");
  const iloFactory = await ILOFactory.deploy(
    ROUTER,       // router
    TREASURY,     // treasury
    200,          // 2% platform fee
    ethers.parseEther("0.03")  // 0.03 zkLTC creation fee
  );
  await iloFactory.waitForDeployment();
  const iloFactoryAddress = await iloFactory.getAddress();
  console.log("ILOFactory:", iloFactoryAddress);

  console.log("\n[2/2] Configuring connector...");
  const tx = await iloFactory.setConnector(CONNECTOR);
  await tx.wait();
  console.log("Connector set to:", CONNECTOR);

  // Verify
  console.log("\n=== Verification ===");
  console.log("Owner:", await iloFactory.owner());
  console.log("Router:", await iloFactory.router());
  console.log("Connector:", await iloFactory.connector());
  console.log("Treasury:", await iloFactory.treasury());
  console.log("PlatformFeeBps:", (await iloFactory.platformFeeBps()).toString());
  console.log("CreationFee:", ethers.formatEther(await iloFactory.creationFee()), "zkLTC");

  // Verify connector is not address(0) and not treasury
  const connectorAddr = await iloFactory.connector();
  if (connectorAddr === CONNECTOR) {
    console.log("\n✅ ILOFactory redeployed and configured correctly!");
  } else {
    console.log("\n❌ WARNING: connector mismatch!");
  }

  console.log("\n=== Update for .env.local ===");
  console.log(`NEXT_PUBLIC_ILO_FACTORY_ADDRESS=${iloFactoryAddress}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});