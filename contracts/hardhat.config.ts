import { registerHooks } from "node:module";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { defineConfig } from "hardhat/config";

// Limit the Zod 4 migration to the consumers in the pinned Hardhat installation.
const hardhatConsumers = [
  "hardhat",
  "@nomicfoundation/hardhat-ethers",
  "@nomicfoundation/hardhat-mocha",
  "@nomicfoundation/hardhat-zod-utils",
].map((name) => new URL(`./node_modules/${name}/`, import.meta.url).href);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "@nomicfoundation/hardhat-zod-utils" &&
      hardhatConsumers.some((prefix) => context.parentURL?.startsWith(prefix))
    ) {
      return { url: new URL("./tooling/hardhat-zod4.mjs", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const credentialFreeBuild = process.env.REPLACEMENT_CREDENTIAL_FREE_BUILD === "true";
if (credentialFreeBuild && process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("Credential-free replacement builds cannot load DEPLOYER_PRIVATE_KEY");
}

const configuredAccounts = process.env.DEPLOYER_PRIVATE_KEY
  ? [process.env.DEPLOYER_PRIVATE_KEY]
  : [];

export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatEthersChaiMatchers,
    hardhatMocha,
    hardhatNetworkHelpers,
  ],
  solidity: {
    npmFilesToBuild: ["@openzeppelin/contracts/finance/VestingWallet.sol"],
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
      {
        version: "0.6.6",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
      {
        version: "0.5.16",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    arbitrumSepolia: {
      type: "http",
      chainType: "generic",
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: configuredAccounts,
    },
    litvm: {
      type: "http",
      chainType: "generic",
      url: process.env.LITVM_RPC_URL || "https://rpc.testnet.liteforge.zeeve.net/",
      chainId: 4441,
      accounts: configuredAccounts,
    },
  },
});
