import { ethers } from "hardhat";

async function main() {
  const governor = await ethers.getContractAt(
    "LitGovernor",
    "0x5b0092996BA897617B46D42B3F108B253be9Ad3d"
  );
  const count = await governor.proposalCount();
  console.log("Proposal count:", count.toString());
  if (count > 0n) {
    const p = await governor.proposals(1n);
    console.log("Proposal 1 fields:", {
      0: p[0]?.toString(),
      1: p[1]?.toString(),
      2: p[2]?.toString(),
      3: p[3],
      4: p[4],
    });
    const d = await governor.proposalDetails(1n);
    console.log("ProposalDetails 1:", {
      targets: d[0],
      values: d[1]?.map((v: bigint) => v.toString()),
      calldatas: d[2]?.slice(0, 2),
      description: d[3]?.slice(0, 80),
    });
    const s = await governor.state(1n);
    console.log("State:", s);
    const threshold = await governor.proposalThreshold();
    console.log("Threshold:", ethers.formatEther(threshold).toString(), "LGT");
    const vp = await governor.votingPeriod();
    console.log("Voting period:", vp.toString(), "blocks");
    const vd = await governor.votingDelay();
    console.log("Voting delay:", vd.toString(), "blocks");
  }
}

main().catch(console.error);
