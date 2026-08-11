import { network } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_SEPARATED_PROFILE,
  type ReplacementPlan,
  validateReplacementPlan,
} from "./lib/post_compromise_replacement.js";
import { verifySourcePinnedProductionAuthorities } from "./lib/production_authority_verifier.js";

if (process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error("Production authority verification must run without DEPLOYER_PRIVATE_KEY");
}

const { ethers } = await network.create();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const planPath = path.resolve(__dirname, "../deployment/post-compromise-plan.json");
const plan = validateReplacementPlan(
  JSON.parse(fs.readFileSync(planPath, "utf8")) as ReplacementPlan,
);
if (plan.deploymentProfile !== PRODUCTION_SEPARATED_PROFILE) {
  throw new Error("Source-pinned production plan has the wrong deployment profile");
}

const gasOnlyDeployer = process.env.EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS;
if (!gasOnlyDeployer) {
  throw new Error(
    "Set EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS to the independently reviewed production gas-only EOA",
  );
}

const report = await verifySourcePinnedProductionAuthorities(plan, ethers.provider, {
  gasOnlyDeployer,
});
console.log(JSON.stringify(report, null, 2));
