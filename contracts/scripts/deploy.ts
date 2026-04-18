import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");
const TREASURY = "0xDD221FBbCb0f6092AfE51183d964AA89A968eE13";

function loadExistingAddresses(): Record<string, unknown> {
  if (!fs.existsSync(ADDRESSES_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function resolveAddress(
  existing: Record<string, unknown>,
  envKey: string,
  deployedKey: string,
): string {
  const envValue = process.env[envKey];
  if (envValue) {
    return envValue;
  }

  const fromFile = existing[deployedKey];
  if (typeof fromFile === "string" && /^0x[a-fA-F0-9]{40}$/.test(fromFile)) {
    return fromFile;
  }

  throw new Error(`Missing ${deployedKey}. Set ${envKey} or run deploy_uniswap_v2.ts first.`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = providerNetwork.chainId;

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  if (chainId === 4441n && deployer.address.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error(`LitVM deployments must use the treasury multisig ${TREASURY}`);
  }

  const existing = loadExistingAddresses();
  const routerAddress = resolveAddress(existing, "UNISWAP_V2_ROUTER_ADDRESS", "UniswapV2Router02");
  const connectorAddress = resolveAddress(existing, "UNISWAP_CONNECTOR_ADDRESS", "UniSwapConnector");

  console.log("Using UniswapV2Router02:", routerAddress);
  console.log("Using UniSwapConnector:", connectorAddress);

  // --- TokenFactory ---
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactory = await TokenFactory.deploy(50_000_000_000_000_000n); // 0.05 zkLTC
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log("TokenFactory deployed to:", tokenFactoryAddress);

  // --- LiquidityLocker ---
  const LiquidityLocker = await ethers.getContractFactory("LiquidityLocker");
  const liquidityLocker = await LiquidityLocker.deploy(30_000_000_000_000_000n); // 0.03 zkLTC
  await liquidityLocker.waitForDeployment();
  const liquidityLockerAddress = await liquidityLocker.getAddress();
  console.log("LiquidityLocker deployed to:", liquidityLockerAddress);

  // --- VestingFactory ---
  const VestingFactory = await ethers.getContractFactory("VestingFactory");
  const vestingFactory = await VestingFactory.deploy(30_000_000_000_000_000n); // 0.03 zkLTC
  await vestingFactory.waitForDeployment();
  const vestingFactoryAddress = await vestingFactory.getAddress();
  console.log("VestingFactory deployed to:", vestingFactoryAddress);

  // --- Disperse ---
  const Disperse = await ethers.getContractFactory("Disperse");
  const disperse = await Disperse.deploy();
  await disperse.waitForDeployment();
  const disperseAddress = await disperse.getAddress();
  console.log("Disperse deployed to:", disperseAddress);

  // --- ILOFactory ---
  const ILOFactory = await ethers.getContractFactory("ILOFactory");
  const iloFactory = await ILOFactory.deploy(
    routerAddress,
    TREASURY,
    200, // 2% launchpad platform fee
    ethers.parseEther("0.03"),
  );
  await iloFactory.waitForDeployment();
  const iloFactoryAddress = await iloFactory.getAddress();
  console.log("ILOFactory deployed to:", iloFactoryAddress);

  const setConnectorTx = await iloFactory.setConnector(connectorAddress);
  await setConnectorTx.wait();
  console.log("ILOFactory connector configured");

  const addresses = {
    ...existing,
    TokenFactory: tokenFactoryAddress,
    LiquidityLocker: liquidityLockerAddress,
    VestingFactory: vestingFactoryAddress,
    Disperse: disperseAddress,
    ILOFactory: iloFactoryAddress,
    UniswapV2Router02: routerAddress,
    UniSwapConnector: connectorAddress,
    treasury: TREASURY,
    network: providerNetwork.name,
    chainId: chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
  console.log("\nDeployed addresses written to deployed-addresses.json");
  console.log("\nSummary:");
  console.log("  TokenFactory:      ", tokenFactoryAddress);
  console.log("  LiquidityLocker:   ", liquidityLockerAddress);
  console.log("  VestingFactory:    ", vestingFactoryAddress);
  console.log("  Disperse:          ", disperseAddress);
  console.log("  ILOFactory:        ", iloFactoryAddress);
  console.log("  UniswapV2Router02: ", routerAddress);
  console.log("  UniSwapConnector:  ", connectorAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
