import { ethers } from "ethers";

export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const LOCAL_RPC_URL = "http://127.0.0.1:8545";

export const contractAbi = [
  "function admin() view returns (address)",

  "function getAllCampaigns() view returns (tuple(uint256 campaignId, string title, string description, string category, uint256 targetAmount, uint256 totalDonated, uint256 totalSpent, bool active, uint256 createdAt)[])",

  "function getPlatformStats() view returns (uint256 totalCampaigns, uint256 totalDonationsAmount, uint256 totalSpendingAmount, uint256 totalRemainingAmount)",

  "function getCampaignProgress(uint256 _campaignId) view returns (uint256)",

  "function getMilestones(uint256 _campaignId) view returns (bool[4])",

  "function donate(uint256 _campaignId) payable",

  "function createCampaign(string _title, string _description, string _category, uint256 _targetAmount)",

  "function recordSpending(uint256 _campaignId, uint256 _amount, string _purpose, string _receiptReference)",

  "function getDonorDonations(address _donor) view returns (tuple(uint256 donationId, address donor, uint256 campaignId, string category, uint256 amount, uint256 timestamp)[])",

  "function getCampaignSpendingRecords(uint256 _campaignId) view returns (tuple(uint256 spendingId, uint256 campaignId, uint256 amount, string purpose, string receiptReference, uint256 timestamp)[])",

  "event DonationReceived(uint256 indexed donationId, address indexed donor, uint256 indexed campaignId, uint256 amount)",

  "event SpendingRecorded(uint256 indexed spendingId, uint256 indexed campaignId, uint256 amount, string purpose)",
];

export function getReadOnlyContract() {
  const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
  return new ethers.Contract(CONTRACT_ADDRESS, contractAbi, provider);
}

export async function getWalletContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signer);
}