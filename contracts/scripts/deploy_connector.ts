import { ethers } from "hardhat";

const EXPECTED_CHAIN_ID = 4441n;
const TARGET_TREASURY = "0xcbf819017ae48f261fe143b2a7c8a29d9a2fcd28";
const FACTORY = "0x017a126a44aaae9273f7963d4e295f0ee2793ad8";
const ROUTER = "0xd56a623890b083d876d47c3b1c5343b7f983fa62";

const FACTORY_ABI = [
  "function feeTo() view returns (address)",
  "function feeToSetter() view returns (address)",
] as const;
const ROUTER_ABI = ["function factory() view returns (address)"] as const;

async function main() {
  const network = await ethers.provider.getNetwork();
  const [signer] = await ethers.getSigners();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Expected LitVM chain ${EXPECTED_CHAIN_ID}, connected to ${network.chainId}`);
  }
  if (!signer || signer.address.toLowerCase() !== TARGET_TREASURY) {
    throw new Error(`Connector deployment must use the approved treasury ${TARGET_TREASURY}`);
  }

  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, ethers.provider);
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, ethers.provider);
  if ((await factory.feeTo()).toLowerCase() !== TARGET_TREASURY) {
    throw new Error("Uniswap V2 feeTo rotation is not complete");
  }
  if ((await factory.feeToSetter()).toLowerCase() !== TARGET_TREASURY) {
    throw new Error("Uniswap V2 feeToSetter rotation is not complete");
  }
  if ((await router.factory()).toLowerCase() !== FACTORY) {
    throw new Error("Router factory mismatch");
  }

  const UniSwapConnector = await ethers.getContractFactory("UniSwapConnector", signer);
  const connector = await UniSwapConnector.deploy(ROUTER, FACTORY, TARGET_TREASURY);
  await connector.waitForDeployment();
  await connector.assertTreasuryRouting();

  console.log("Replacement UniSwapConnector:", await connector.getAddress());
  console.log("Use this address as UNISWAP_CONNECTOR_ADDRESS for future ILOFactory deployments.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
