import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const iloFactory = await ethers.getContractAt("ILOFactory", "0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB");
  const connector = "0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD";
  
  // Try with manual encoding
  const iface = new ethers.Interface(["function setConnector(address)"]);
  const data = iface.encodeFunctionData("setConnector", [connector]);
  
  // Get the signer address
  const from = await signer.getAddress();
  console.log("From:", from);
  console.log("ILOFactory owner:", await iloFactory.owner());
  
  // Try raw transaction with very high gas
  try {
    const tx = await signer.sendTransaction({
      to: iloFactory.target,
      data: data,
      gasLimit: 500000n
    });
    const rcpt = await tx.wait();
    console.log("TX status:", rcpt?.status);
    console.log("TX gasUsed:", rcpt?.gasUsed.toString());
  } catch(e: any) {
    console.log("Error:", e.message.slice(0, 200));
  }
}

main().catch(console.error);
