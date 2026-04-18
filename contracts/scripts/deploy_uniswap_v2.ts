import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");
const TREASURY = "0xDD221FBbCb0f6092AfE51183d964AA89A968eE13";

async function main() {
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = providerNetwork.chainId;

  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", chainId.toString());

  if (chainId === 4441n && deployer.address.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error(`LitVM deployments must use the treasury multisig ${TREASURY}`);
  }

  console.log("\n[1/4] Deploying wrapped native asset...");
  const WETH9 = await ethers.getContractFactory("WETH9");
  const wrappedNative = await WETH9.deploy();
  await wrappedNative.waitForDeployment();
  const wrappedNativeAddress = await wrappedNative.getAddress();
  console.log("Wrapped zkLTC:", wrappedNativeAddress);

  console.log("\n[2/4] Deploying UniswapV2Factory...");
  const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await UniswapV2Factory.deploy(TREASURY);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("UniswapV2Factory:", factoryAddress);

  console.log("\n[3/4] Deploying UniswapV2Router02...");
  const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
  const router = await UniswapV2Router02.deploy(factoryAddress, wrappedNativeAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("UniswapV2Router02:", routerAddress);

  console.log("\n[4/4] Deploying UniSwapConnector...");
  const UniSwapConnector = await ethers.getContractFactory("UniSwapConnector");
  const connector = await UniSwapConnector.deploy(routerAddress, factoryAddress, TREASURY);
  await connector.waitForDeployment();
  const connectorAddress = await connector.getAddress();
  console.log("UniSwapConnector:", connectorAddress);

  const feeTo = await factory.feeTo();
  const feeToSetter = await factory.feeToSetter();
  if (feeTo.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error(`Unexpected feeTo ${feeTo}; expected ${TREASURY}`);
  }
  if (feeToSetter.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error(`Unexpected feeToSetter ${feeToSetter}; expected ${TREASURY}`);
  }

  const deployed = {
    UniswapV2Factory: factoryAddress,
    UniswapV2Router02: routerAddress,
    UniSwapConnector: connectorAddress,
    WrappedZkLTC: wrappedNativeAddress,
    treasury: TREASURY,
    network: network.name,
    chainId: chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(ADDRESSES_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
    } catch {
      existing = {};
    }
  }

  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify({ ...existing, ...deployed }, null, 2));

  console.log("\n=== Deployment Summary ===");
  console.log("Wrapped zkLTC    :", wrappedNativeAddress);
  console.log("Factory          :", factoryAddress);
  console.log("Router           :", routerAddress);
  console.log("Connector        :", connectorAddress);
  console.log("Treasury feeTo   :", feeTo);
  console.log("Treasury setter  :", feeToSetter);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
