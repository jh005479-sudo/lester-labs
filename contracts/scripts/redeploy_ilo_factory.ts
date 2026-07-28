import { ethers } from "hardhat";

const TREASURY = "0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28";

// Existing deployed addresses
const ROUTER = "0xD56a623890b083d876D47c3b1c5343b7f983FA62";  // Our UniswapV2Router02

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const connectorAddress = process.env.UNISWAP_CONNECTOR_ADDRESS;
  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", chainId);

  if (chainId === 4441n && deployer.address.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error(`LitVM deployments must use the approved treasury ${TREASURY}`);
  }
  if (!connectorAddress || !ethers.isAddress(connectorAddress)) {
    throw new Error("Set UNISWAP_CONNECTOR_ADDRESS to a new connector deployed for the approved treasury");
  }

  const connector = await ethers.getContractAt("UniSwapConnector", connectorAddress);
  if ((await connector.router()).toLowerCase() !== ROUTER.toLowerCase()) {
    throw new Error("Connector router mismatch");
  }
  if ((await connector.treasury()).toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error("Connector treasury mismatch");
  }
  await connector.assertTreasuryRouting();

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
  const tx = await iloFactory.setConnector(connectorAddress);
  await tx.wait();
  console.log("Connector set to:", connectorAddress);

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
  if (connectorAddr.toLowerCase() === connectorAddress.toLowerCase()) {
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
