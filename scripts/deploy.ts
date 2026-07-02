import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const { ethers, networkName } = await network.create();

console.log("====================================");
console.log("Campus Donation Transparency Deploy");
console.log("====================================");
console.log(`Deploying to network: ${networkName}`);

const [admin, donor1, donor2, donor3] = await ethers.getSigners();

console.log("Admin address:", admin.address);
console.log("Sample donor 1:", donor1.address);
console.log("Sample donor 2:", donor2.address);
console.log("Sample donor 3:", donor3.address);

console.log("\nDeploying smart contract...");

const donationContract = await ethers.deployContract(
  "CampusDonationTransparency"
);

console.log("Waiting for deployment confirmation...");
await donationContract.waitForDeployment();

const contractAddress = await donationContract.getAddress();

console.log("Contract deployed successfully!");
console.log("Contract address:", contractAddress);

console.log("\nCreating sample campus campaigns...");

const createCampaignTx1 = await donationContract.createCampaign(
  "Library Renovation",
  "Help upgrade the campus library with new books, study tables, and digital learning tools.",
  "Library",
  ethers.parseEther("5")
);
await createCampaignTx1.wait();

const createCampaignTx2 = await donationContract.createCampaign(
  "Student Aid Fund",
  "Support students who need financial help for tuition, books, and essential academic needs.",
  "Student Aid",
  ethers.parseEther("3")
);
await createCampaignTx2.wait();

const createCampaignTx3 = await donationContract.createCampaign(
  "Medical Support",
  "Provide emergency medical support for students inside the campus community.",
  "Medical Support",
  ethers.parseEther("4")
);
await createCampaignTx3.wait();

console.log("Sample campaigns created successfully!");

console.log("\nAdding sample donations for demo...");

const donation1 = await donationContract.connect(donor1).donate(1, {
  value: ethers.parseEther("1.2"),
});
await donation1.wait();

const donation2 = await donationContract.connect(donor2).donate(1, {
  value: ethers.parseEther("0.5"),
});
await donation2.wait();

const donation3 = await donationContract.connect(donor3).donate(2, {
  value: ethers.parseEther("0.8"),
});
await donation3.wait();

const donation4 = await donationContract.connect(donor1).donate(3, {
  value: ethers.parseEther("0.4"),
});
await donation4.wait();

console.log("Sample donations added successfully!");

console.log("\nRecording sample spending records...");

const spending1 = await donationContract.recordSpending(
  1,
  ethers.parseEther("0.3"),
  "Purchased new academic books for the library",
  "LIB-RECEIPT-001"
);
await spending1.wait();

const spending2 = await donationContract.recordSpending(
  2,
  ethers.parseEther("0.2"),
  "Paid partial book support for selected students",
  "AID-RECEIPT-001"
);
await spending2.wait();

console.log("Sample spending records added successfully!");

console.log("\nReading platform statistics...");

const stats = await donationContract.getPlatformStats();

console.log("Total campaigns:", stats[0].toString());
console.log("Total donations:", ethers.formatEther(stats[1]), "ETH");
console.log("Total spending:", ethers.formatEther(stats[2]), "ETH");
console.log("Total remaining:", ethers.formatEther(stats[3]), "ETH");

const deploymentsDir = path.join(process.cwd(), "deployments");

if (!fs.existsSync(deploymentsDir)) {
  fs.mkdirSync(deploymentsDir);
}

const deploymentData = {
  contractName: "CampusDonationTransparency",
  contractAddress,
  networkName,
  admin: admin.address,
  sampleDonors: [donor1.address, donor2.address, donor3.address],
  deployedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(deploymentsDir, "localhost.json"),
  JSON.stringify(deploymentData, null, 2)
);

console.log("\nDeployment data saved to deployments/localhost.json");

console.log("\n====================================");
console.log("Deployment completed successfully!");
console.log("====================================");