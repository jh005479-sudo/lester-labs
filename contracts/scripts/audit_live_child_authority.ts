import { ethers } from "hardhat";
import {
  EXPECTED_CHAIN_ID,
  RETIRED_TREASURY,
  attestPinnedRuntime,
} from "./lib/live_treasury_audit";
import {
  assertNoActiveRetiredChildAuthority,
  auditLiveChildAuthority,
} from "./lib/live_child_authority_audit";

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Expected LitVM chain ${EXPECTED_CHAIN_ID}, connected to ${network.chainId}`,
    );
  }

  await attestPinnedRuntime(ethers.provider);
  const report = await auditLiveChildAuthority(ethers.provider);
  console.log(JSON.stringify(report, null, 2));
  assertNoActiveRetiredChildAuthority(report);
  console.log(
    `[ok] no usable factory-child authority remains at retired controller ${RETIRED_TREASURY}`,
  );
  if (report.retiredIloTreasuryRoutes.length > 0) {
    console.warn(
      `[warning] ${report.retiredIloTreasuryRoutes.length} legacy ILO(s) immutably route platform fees to the retired treasury; keep funding and finalization disabled`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
