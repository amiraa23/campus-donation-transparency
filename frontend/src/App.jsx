import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./App.css";
import { getReadOnlyContract, getWalletContract } from "./contract";

function App() {
  const [connectedAccount, setConnectedAccount] = useState("");
  const [adminAddress, setAdminAddress] = useState("");
  const [campaigns, setCampaigns] = useState([]);

  const [stats, setStats] = useState({
    totalCampaigns: "0",
    totalDonations: "0",
    totalSpending: "0",
    totalRemaining: "0",
  });

  const [donationAmounts, setDonationAmounts] = useState({});
  const [donorHistory, setDonorHistory] = useState([]);
  const [message, setMessage] = useState("");

  // Nonce states
  const [walletNonce, setWalletNonce] = useState("-");
  const [lastTxNonce, setLastTxNonce] = useState("-");
  const [lastTxHash, setLastTxHash] = useState("");

  const [newCampaign, setNewCampaign] = useState({
    title: "",
    description: "",
    category: "",
    targetAmount: "",
  });

  const [spending, setSpending] = useState({
    campaignId: "",
    amount: "",
    purpose: "",
    receiptReference: "",
  });

  const shortAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatEth = (value) => {
    return Number(ethers.formatEther(value)).toFixed(2);
  };

  const refreshWalletNonce = async (walletAddress) => {
    try {
      if (!window.ethereum || !walletAddress) return;

      const provider = new ethers.BrowserProvider(window.ethereum);

      // latest = confirmed transactions count for this wallet
      const nonce = await provider.getTransactionCount(walletAddress, "latest");

      setWalletNonce(nonce.toString());
    } catch (error) {
      console.error("Failed to load wallet nonce:", error);
      setWalletNonce("Error");
    }
  };

  const getActiveWalletAddress = async () => {
    if (connectedAccount) return connectedAccount;

    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    setConnectedAccount(address);
    return address;
  };

  const loadBlockchainData = async () => {
    try {
      const contract = getReadOnlyContract();

      const admin = await contract.admin();
      setAdminAddress(admin);

      const allCampaigns = await contract.getAllCampaigns();
      const platformStats = await contract.getPlatformStats();

      const enrichedCampaigns = await Promise.all(
        allCampaigns.map(async (campaign) => {
          const progress = await contract.getCampaignProgress(
            campaign.campaignId
          );

          const milestones = await contract.getMilestones(campaign.campaignId);

          const spendingRecords = await contract.getCampaignSpendingRecords(
            campaign.campaignId
          );

          return {
            id: Number(campaign.campaignId),
            title: campaign.title,
            description: campaign.description,
            category: campaign.category,
            targetAmount: campaign.targetAmount,
            totalDonated: campaign.totalDonated,
            totalSpent: campaign.totalSpent,
            remaining: campaign.totalDonated - campaign.totalSpent,
            active: campaign.active,
            progress: Number(progress),
            milestones,
            spendingRecords,
          };
        })
      );

      setCampaigns(enrichedCampaigns);

      setStats({
        totalCampaigns: platformStats[0].toString(),
        totalDonations: formatEth(platformStats[1]),
        totalSpending: formatEth(platformStats[2]),
        totalRemaining: formatEth(platformStats[3]),
      });

      if (connectedAccount) {
        await refreshWalletNonce(connectedAccount);
      }
    } catch (error) {
      console.error(error);
      setMessage(
        "Could not load blockchain data. Make sure Hardhat node is running."
      );
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask first.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const walletAddress = accounts[0];

      setConnectedAccount(walletAddress);
      setMessage(`Wallet connected: ${shortAddress(walletAddress)}`);

      await refreshWalletNonce(walletAddress);
      await loadDonorHistory(walletAddress);
    } catch (error) {
      console.error(error);
      setMessage("Wallet connection failed.");
    }
  };

  const loadDonorHistory = async (address) => {
    try {
      const contract = getReadOnlyContract();
      const history = await contract.getDonorDonations(address);

      const formattedHistory = history.map((donation) => ({
        donationId: Number(donation.donationId),
        donor: donation.donor,
        campaignId: Number(donation.campaignId),
        category: donation.category,
        amount: formatEth(donation.amount),
        timestamp: new Date(Number(donation.timestamp) * 1000).toLocaleString(),
      }));

      setDonorHistory(formattedHistory);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDonate = async (campaignId) => {
    try {
      const amount = donationAmounts[campaignId];

      if (!amount || Number(amount) <= 0) {
        alert("Please enter a valid donation amount.");
        return;
      }

      const walletAddress = await getActiveWalletAddress();

      setMessage("Sending donation transaction...");

      const contract = await getWalletContract();

      const tx = await contract.donate(campaignId, {
        value: ethers.parseEther(amount),
      });

      // Show last transaction nonce and hash on frontend
      setLastTxNonce(tx.nonce.toString());
      setLastTxHash(tx.hash);

      await tx.wait();

      setMessage("Donation recorded successfully on blockchain.");

      setDonationAmounts({
        ...donationAmounts,
        [campaignId]: "",
      });

      await refreshWalletNonce(walletAddress);
      await loadBlockchainData();
      await loadDonorHistory(walletAddress);
    } catch (error) {
      console.error(error);
      setMessage("Donation failed. Check MetaMask and local network.");
    }
  };

  const handleCreateCampaign = async () => {
    try {
      if (
        !newCampaign.title ||
        !newCampaign.description ||
        !newCampaign.category ||
        !newCampaign.targetAmount
      ) {
        alert("Please fill all campaign fields.");
        return;
      }

      const walletAddress = await getActiveWalletAddress();

      setMessage("Creating campaign...");

      const contract = await getWalletContract();

      const tx = await contract.createCampaign(
        newCampaign.title,
        newCampaign.description,
        newCampaign.category,
        ethers.parseEther(newCampaign.targetAmount)
      );

      // Show last transaction nonce and hash on frontend
      setLastTxNonce(tx.nonce.toString());
      setLastTxHash(tx.hash);

      await tx.wait();

      setMessage("Campaign created successfully.");

      setNewCampaign({
        title: "",
        description: "",
        category: "",
        targetAmount: "",
      });

      await refreshWalletNonce(walletAddress);
      await loadBlockchainData();
    } catch (error) {
      console.error(error);
      setMessage("Create campaign failed. Make sure you are using admin wallet.");
    }
  };

  const handleRecordSpending = async () => {
    try {
      if (
        !spending.campaignId ||
        !spending.amount ||
        !spending.purpose ||
        !spending.receiptReference
      ) {
        alert("Please fill all spending fields.");
        return;
      }

      const walletAddress = await getActiveWalletAddress();

      setMessage("Recording spending...");

      const contract = await getWalletContract();

      const tx = await contract.recordSpending(
        Number(spending.campaignId),
        ethers.parseEther(spending.amount),
        spending.purpose,
        spending.receiptReference
      );

      // Show last transaction nonce and hash on frontend
      setLastTxNonce(tx.nonce.toString());
      setLastTxHash(tx.hash);

      await tx.wait();

      setMessage("Spending recorded successfully.");

      setSpending({
        campaignId: "",
        amount: "",
        purpose: "",
        receiptReference: "",
      });

      await refreshWalletNonce(walletAddress);
      await loadBlockchainData();
    } catch (error) {
      console.error(error);
      setMessage(
        "Record spending failed. Make sure you are admin and amount is available."
      );
    }
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  return (
    <div className="app">
      <header className="hero">
        <nav className="navbar">
          <div>
            <h2>Campus Donation Transparency</h2>
            <p>Blockchain-based trust for campus donations</p>
          </div>

          <button className="wallet-btn" onClick={connectWallet}>
            {connectedAccount
              ? `Connected: ${shortAddress(connectedAccount)}`
              : "Connect Wallet"}
          </button>
        </nav>

        {message && <div className="status-message">{message}</div>}

        <section className="hero-content">
          <div>
            <span className="badge">Transparency / Donations</span>
            <h1>Track every donation from receipt to spending.</h1>
            <p>
              This dashboard reads directly from a Solidity smart contract. It
              shows how blockchain can improve donation trust by recording
              campaign funds, donor receipts, spending records, and remaining
              balances.
            </p>

            <div className="hero-actions">
              <button onClick={loadBlockchainData}>
                Refresh Blockchain Data
              </button>
              <button className="secondary-btn">
                Admin: {shortAddress(adminAddress)}
              </button>
            </div>

            <div className="nonce-card">
              <div className="nonce-item">
                <span className="nonce-label">Current Wallet Nonce</span>
                <strong>{walletNonce}</strong>
              </div>

              <div className="nonce-item">
                <span className="nonce-label">Last Transaction Nonce</span>
                <strong>{lastTxNonce}</strong>
              </div>

              <button
                className="nonce-refresh-btn"
                onClick={() => {
                  if (!connectedAccount) {
                    setMessage("Connect wallet first to view nonce.");
                    return;
                  }
                  refreshWalletNonce(connectedAccount);
                }}
              >
                Refresh Nonce
              </button>

              {lastTxHash && (
                <p className="nonce-hash">
                  Last Tx Hash: {lastTxHash.slice(0, 10)}...
                  {lastTxHash.slice(-6)}
                </p>
              )}
            </div>
          </div>

          <div className="trust-card">
            <h3>Total Platform Overview</h3>
            <div className="stats-grid">
              <div>
                <strong>{stats.totalCampaigns}</strong>
                <span>Campaigns</span>
              </div>
              <div>
                <strong>{stats.totalDonations} ETH</strong>
                <span>Total Donations</span>
              </div>
              <div>
                <strong>{stats.totalSpending} ETH</strong>
                <span>Total Spending</span>
              </div>
              <div>
                <strong>{stats.totalRemaining} ETH</strong>
                <span>Remaining</span>
              </div>
            </div>
          </div>
        </section>
      </header>

      <main>
        <section className="section-title">
          <span>Live Campaigns</span>
          <h2>Category-based donation campaigns</h2>
          <p>
            These campaigns are loaded from the smart contract, including target,
            donated amount, spending records, remaining balance, progress, and
            milestones.
          </p>
        </section>

        <section className="campaign-grid">
          {campaigns.map((campaign) => (
            <article className="campaign-card" key={campaign.id}>
              <div className="card-top">
                <span className="category">{campaign.category}</span>
                <span className="campaign-id">#{campaign.id}</span>
              </div>

              <h3>{campaign.title}</h3>
              <p>{campaign.description}</p>

              <div className="money-grid">
                <div>
                  <span>Target</span>
                  <strong>{formatEth(campaign.targetAmount)} ETH</strong>
                </div>
                <div>
                  <span>Donated</span>
                  <strong>{formatEth(campaign.totalDonated)} ETH</strong>
                </div>
                <div>
                  <span>Spent</span>
                  <strong>{formatEth(campaign.totalSpent)} ETH</strong>
                </div>
                <div>
                  <span>Remaining</span>
                  <strong>{formatEth(campaign.remaining)} ETH</strong>
                </div>
              </div>

              <div className="progress-info">
                <span>Campaign Progress</span>
                <strong>{campaign.progress}%</strong>
              </div>

              <div className="progress-bar">
                <div style={{ width: `${campaign.progress}%` }}></div>
              </div>

              <div className="milestones">
                {[25, 50, 75, 100].map((milestone, index) => (
                  <div
                    key={milestone}
                    className={
                      campaign.milestones[index]
                        ? "milestone reached"
                        : "milestone"
                    }
                  >
                    {milestone}%
                  </div>
                ))}
              </div>

              <div className="donation-box">
                <input
                  type="number"
                  placeholder="Donation amount in ETH"
                  value={donationAmounts[campaign.id] || ""}
                  onChange={(event) =>
                    setDonationAmounts({
                      ...donationAmounts,
                      [campaign.id]: event.target.value,
                    })
                  }
                />
                <button onClick={() => handleDonate(campaign.id)}>Donate</button>
              </div>

              {campaign.spendingRecords.length > 0 && (
                <div className="mini-records">
                  <h4>Spending Records</h4>
                  {campaign.spendingRecords.map((record) => (
                    <p key={Number(record.spendingId)}>
                      {formatEth(record.amount)} ETH — {record.purpose}
                    </p>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>

        <section className="transparency-section">
          <div className="section-title">
            <span>Fund Traceability</span>
            <h2>Donation received → Category allocation → Spending record</h2>
          </div>

          <div className="trace-table">
            <div className="table-row table-head">
              <span>Step</span>
              <span>Record</span>
              <span>Transparency Meaning</span>
            </div>

            <div className="table-row">
              <span>1</span>
              <span>Donation Receipt</span>
              <span>Every donor transaction is stored with amount and time.</span>
            </div>

            <div className="table-row">
              <span>2</span>
              <span>Campaign Category</span>
              <span>Funds are linked to a clear cause like Library or Aid.</span>
            </div>

            <div className="table-row">
              <span>3</span>
              <span>Admin Spending Record</span>
              <span>Spending purpose and receipt reference are visible.</span>
            </div>

            <div className="table-row">
              <span>4</span>
              <span>Remaining Balance</span>
              <span>Donors can verify what is left after spending.</span>
            </div>
          </div>
        </section>

        <section className="donor-section">
          <div className="section-title">
            <span>Donor View</span>
            <h2>Connected donor receipt history</h2>
            <p>
              After connecting a wallet and donating, the donor can verify their
              donation receipts from the blockchain.
            </p>
          </div>

          <div className="trace-table">
            <div className="table-row table-head">
              <span>Receipt</span>
              <span>Campaign</span>
              <span>Amount / Time</span>
            </div>

            {donorHistory.length === 0 ? (
              <div className="table-row">
                <span>-</span>
                <span>No donor records yet</span>
                <span>Connect wallet and donate to see history.</span>
              </div>
            ) : (
              donorHistory.map((donation) => (
                <div className="table-row" key={donation.donationId}>
                  <span>#{donation.donationId}</span>
                  <span>
                    Campaign #{donation.campaignId} / {donation.category}
                  </span>
                  <span>
                    {donation.amount} ETH / {donation.timestamp}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-card">
            <h2>Admin Panel</h2>
            <p>
              Only the admin wallet can create campaigns. This is enforced inside
              the Solidity smart contract.
            </p>

            <div className="admin-actions">
              <input
                placeholder="Campaign title"
                value={newCampaign.title}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, title: e.target.value })
                }
              />
              <input
                placeholder="Description"
                value={newCampaign.description}
                onChange={(e) =>
                  setNewCampaign({
                    ...newCampaign,
                    description: e.target.value,
                  })
                }
              />
              <input
                placeholder="Category"
                value={newCampaign.category}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, category: e.target.value })
                }
              />
              <input
                placeholder="Target amount in ETH"
                value={newCampaign.targetAmount}
                onChange={(e) =>
                  setNewCampaign({
                    ...newCampaign,
                    targetAmount: e.target.value,
                  })
                }
              />
              <button onClick={handleCreateCampaign}>Create Campaign</button>
            </div>
          </div>

          <div className="admin-card">
            <h2>Spending Transparency</h2>
            <p>
              Admin can record spending, but the contract prevents overspending
              more than the campaign balance.
            </p>

            <div className="admin-actions">
              <input
                placeholder="Campaign ID"
                value={spending.campaignId}
                onChange={(e) =>
                  setSpending({ ...spending, campaignId: e.target.value })
                }
              />
              <input
                placeholder="Spending amount in ETH"
                value={spending.amount}
                onChange={(e) =>
                  setSpending({ ...spending, amount: e.target.value })
                }
              />
              <input
                placeholder="Purpose"
                value={spending.purpose}
                onChange={(e) =>
                  setSpending({ ...spending, purpose: e.target.value })
                }
              />
              <input
                placeholder="Receipt reference"
                value={spending.receiptReference}
                onChange={(e) =>
                  setSpending({
                    ...spending,
                    receiptReference: e.target.value,
                  })
                }
              />
              <button onClick={handleRecordSpending}>Record Spending</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;