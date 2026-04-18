import { ethers } from "hardhat";

async function main() {
  const iloFactory = await ethers.getContractAt("ILOFactory", "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  const connector = "0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD";
  console.log("Owner:", await iloFactory.owner());
  console.log("Router:", await iloFactory.router());
  try { console.log("Connector:", await iloFactory.connector()); } catch(e: any) { console.log("Connector reverted:", e.message.slice(0,100)); }
  console.log("Calling setConnector...");
  const tx = await iloFactory.setConnector(connector);
  const rcpt = await tx.wait();
  console.log("Success! gasUsed:", rcpt?.gasUsed.toString());
  console.log("New connector:", await iloFactory.connector());
}

main().catch(console.error);
