import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

describe("CampusDonationTransparency", function () {
  async function deployDonationFixture() {
    const [admin, donor1, donor2, nonAdmin] = await ethers.getSigners();

    const donationContract: any = await ethers.deployContract(
      "CampusDonationTransparency"
    );

    await donationContract.createCampaign(
      "Library Renovation",
      "Upgrade the campus library with books and digital tools.",
      "Library",
      ethers.parseEther("5")
    );

    await donationContract.createCampaign(
      "Student Aid Fund",
      "Support students with tuition and academic needs.",
      "Student Aid",
      ethers.parseEther("3")
    );

    return {
      donationContract,
      admin,
      donor1,
      donor2,
      nonAdmin,
    };
  }

  it("Should deploy with the correct admin", async function () {
    const { donationContract, admin } = await networkHelpers.loadFixture(
      deployDonationFixture
    );

    expect(await donationContract.admin()).to.equal(admin.address);
  });

  it("Should create campaigns correctly", async function () {
    const { donationContract } = await networkHelpers.loadFixture(
      deployDonationFixture
    );

    const campaigns = await donationContract.getAllCampaigns();

    expect(campaigns.length).to.equal(2);
    expect(campaigns[0].title).to.equal("Library Renovation");
    expect(campaigns[0].category).to.equal("Library");
    expect(campaigns[0].active).to.equal(true);
  });

  it("Should allow a donor to donate to a campaign", async function () {
    const { donationContract, donor1 } = await networkHelpers.loadFixture(
      deployDonationFixture
    );

    const donationAmount = ethers.parseEther("1");

    await expect(
      donationContract.connect(donor1).donate(1, {
        value: donationAmount,
      })
    )
      .to.emit(donationContract, "DonationReceived")
      .withArgs(1n, donor1.address, 1n, donationAmount);

    const campaign = await donationContract.getCampaign(1);

    expect(campaign.totalDonated).to.equal(donationAmount);
  });

  it("Should store donor donation history correctly", async function () {
    const { donationContract, donor1 } = await networkHelpers.loadFixture(
      deployDonationFixture
    );

    await donationContract.connect(donor1).donate(1, {
      value: ethers.parseEther("0.5"),
    });

    await donationContract.connect(donor1).donate(2, {
      value: ethers.parseEther("0.25"),
    });

    const donorHistory = await donationContract.getDonorDonations(
      donor1.address
    );

    expect(donorHistory.length).to.equal(2);
    expect(donorHistory[0].donor).to.equal(donor1.address);
    expect(donorHistory[0].campaignId).to.equal(1n);
    expect(donorHistory[1].campaignId).to.equal(2n);
  });

  it("Should allow admin to record spending", async function () {
    const { donationContract, donor1 } = await networkHelpers.loadFixture(
      deployDonationFixture
    );

    await donationContract.connect(donor1).donate(1, {
      value: ethers.parseEther("1"),
    });

    const spendingAmount = ethers.parseEther("0.3");

    await expect(
      donationContract.recordSpending(
        1,
        spendingAmount,
        "Purchased new academic books",
        "LIB-RECEIPT-001"
      )
    )
      .to.emit(donationContract, "SpendingRecorded")
      .withArgs(1n, 1n, spendingAmount, "Purchased new academic books");

    const campaign = await donationContract.getCampaign(1);

    expect(campaign.totalSpent).to.equal(spendingAmount);
  });

  it("Should prevent non-admin from recording spending", async function () {
    const { donationContract, donor1, nonAdmin } =
      await networkHelpers.loadFixture(deployDonationFixture);

    await donationContract.connect(donor1).donate(1, {
      value: ethers.parseEther("1"),
    });

    await expect(
      donationContract
        .connect(nonAdmin)
        .recordSpending(
          1,
          ethers.parseEther("0.2"),
          "Unauthorized spending attempt",
          "BAD-001"
        )
    ).to.be.revertedWith("Only admin can perform this action");
  });

  it("Should prevent overspending more than available balance", async function () {
    const { donationContract, donor1 } = await networkHelpers.loadFixture(
      deployDonationFixture
    );

    await donationContract.connect(donor1).donate(1, {
      value: ethers.parseEther("0.5"),
    });

    await expect(
      donationContract.recordSpending(
        1,
        ethers.parseEther("1"),
        "Trying to spend more than available",
        "OVER-001"
      )
    ).to.be.revertedWith(
      "Cannot spend more than available campaign balance"
    );
  });

  it("Should calculate remaining balance correctly", async function () {
    const { donationContract, donor1 } = await networkHelpers.loadFixture(
      deployDonationFixture
    );

    await donationContract.connect(donor1).donate(1, {
      value: ethers.parseEther("2"),
    });

    await donationContract.recordSpending(
      1,
      ethers.parseEther("0.75"),
      "Library chairs",
      "LIB-CHAIRS-001"
    );

    const remainingBalance =
      await donationContract.getCampaignRemainingBalance(1);

    expect(remainingBalance).to.equal(ethers.parseEther("1.25"));
  });

  it("Should calculate progress and milestones correctly", async function () {
    const { donationContract, donor1, donor2 } =
      await networkHelpers.loadFixture(deployDonationFixture);

    await donationContract.connect(donor1).donate(1, {
      value: ethers.parseEther("1.25"),
    });

    let progress = await donationContract.getCampaignProgress(1);
    let milestones = await donationContract.getMilestones(1);

    expect(progress).to.equal(25n);
    expect(milestones[0]).to.equal(true);
    expect(milestones[1]).to.equal(false);

    await donationContract.connect(donor2).donate(1, {
      value: ethers.parseEther("1.25"),
    });

    progress = await donationContract.getCampaignProgress(1);
    milestones = await donationContract.getMilestones(1);

    expect(progress).to.equal(50n);
    expect(milestones[0]).to.equal(true);
    expect(milestones[1]).to.equal(true);
    expect(milestones[2]).to.equal(false);
  });
});