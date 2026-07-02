// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title CampusDonationTransparency
 * @dev A blockchain-based donation transparency system for campus campaigns.
 *
 * Main idea:
 * - Admin creates donation campaigns.
 * - Donors donate ETH to a selected campaign.
 * - Every donation is permanently recorded on-chain.
 * - Admin records spending from campaign funds.
 * - Anyone can view donations, spending, balances, and progress.
 */
contract CampusDonationTransparency {
    // The address that deployed the contract.
    // This address will be the admin.
    address public admin;

    // Used to generate unique campaign IDs.
    uint256 public nextCampaignId;

    // Used to generate unique donation receipt IDs.
    uint256 public nextDonationId;

    // Used to generate unique spending record IDs.
    uint256 public nextSpendingId;

    /**
     * @dev Campaign represents a donation campaign.
     * Example:
     * title: "Library Renovation"
     * category: "Library"
     * targetAmount: 10 ETH
     */
    struct Campaign {
        uint256 campaignId;
        string title;
        string description;
        string category;
        uint256 targetAmount;
        uint256 totalDonated;
        uint256 totalSpent;
        bool active;
        uint256 createdAt;
    }

    /**
     * @dev Donation represents one donation receipt.
     */
    struct Donation {
        uint256 donationId;
        address donor;
        uint256 campaignId;
        string category;
        uint256 amount;
        uint256 timestamp;
    }

    /**
     * @dev SpendingRecord represents one spending action from campaign funds.
     */
    struct SpendingRecord {
        uint256 spendingId;
        uint256 campaignId;
        uint256 amount;
        string purpose;
        string receiptReference;
        uint256 timestamp;
    }

    // campaignId => Campaign
    mapping(uint256 => Campaign) private campaigns;

    // List of all campaign IDs.
    uint256[] private campaignIds;

    // donationId => Donation
    mapping(uint256 => Donation) private donations;

    // spendingId => SpendingRecord
    mapping(uint256 => SpendingRecord) private spendingRecords;

    // donor address => donation IDs
    mapping(address => uint256[]) private donorDonationIds;

    // campaignId => donation IDs
    mapping(uint256 => uint256[]) private campaignDonationIds;

    // campaignId => spending IDs
    mapping(uint256 => uint256[]) private campaignSpendingIds;

    /**
     * @dev Events are important because they make frontend tracking easier.
     * They also improve transparency because important actions are publicly emitted.
     */
    event CampaignCreated(
        uint256 indexed campaignId,
        string title,
        string category,
        uint256 targetAmount
    );

    event DonationReceived(
        uint256 indexed donationId,
        address indexed donor,
        uint256 indexed campaignId,
        uint256 amount
    );

    event SpendingRecorded(
        uint256 indexed spendingId,
        uint256 indexed campaignId,
        uint256 amount,
        string purpose
    );

    event CampaignStatusChanged(
        uint256 indexed campaignId,
        bool active
    );

    /**
     * @dev Restricts some functions to admin only.
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    /**
     * @dev Checks if campaign exists.
     */
    modifier campaignExists(uint256 _campaignId) {
        require(
            campaigns[_campaignId].createdAt != 0,
            "Campaign does not exist"
        );
        _;
    }

    constructor() {
        admin = msg.sender;
        nextCampaignId = 1;
        nextDonationId = 1;
        nextSpendingId = 1;
    }

    /**
     * @dev Admin creates a new donation campaign.
     */
    function createCampaign(
        string memory _title,
        string memory _description,
        string memory _category,
        uint256 _targetAmount
    ) external onlyAdmin {
        require(bytes(_title).length > 0, "Title is required");
        require(bytes(_category).length > 0, "Category is required");
        require(_targetAmount > 0, "Target amount must be greater than zero");

        uint256 campaignId = nextCampaignId;

        campaigns[campaignId] = Campaign({
            campaignId: campaignId,
            title: _title,
            description: _description,
            category: _category,
            targetAmount: _targetAmount,
            totalDonated: 0,
            totalSpent: 0,
            active: true,
            createdAt: block.timestamp
        });

        campaignIds.push(campaignId);
        nextCampaignId++;

        emit CampaignCreated(
            campaignId,
            _title,
            _category,
            _targetAmount
        );
    }

    /**
     * @dev Donor donates ETH to a specific campaign.
     */
    function donate(uint256 _campaignId)
        external
        payable
        campaignExists(_campaignId)
    {
        Campaign storage campaign = campaigns[_campaignId];

        require(campaign.active, "Campaign is not active");
        require(msg.value > 0, "Donation amount must be greater than zero");

        uint256 donationId = nextDonationId;

        donations[donationId] = Donation({
            donationId: donationId,
            donor: msg.sender,
            campaignId: _campaignId,
            category: campaign.category,
            amount: msg.value,
            timestamp: block.timestamp
        });

        donorDonationIds[msg.sender].push(donationId);
        campaignDonationIds[_campaignId].push(donationId);

        campaign.totalDonated += msg.value;

        nextDonationId++;

        emit DonationReceived(
            donationId,
            msg.sender,
            _campaignId,
            msg.value
        );
    }

    /**
     * @dev Admin records spending from a campaign.
     * This is an accounting transparency record.
     * It does not transfer ETH out of the contract.
     */
    function recordSpending(
        uint256 _campaignId,
        uint256 _amount,
        string memory _purpose,
        string memory _receiptReference
    ) external onlyAdmin campaignExists(_campaignId) {
        require(_amount > 0, "Spending amount must be greater than zero");
        require(bytes(_purpose).length > 0, "Purpose is required");

        uint256 availableBalance = getCampaignRemainingBalance(_campaignId);
        require(
            _amount <= availableBalance,
            "Cannot spend more than available campaign balance"
        );

        uint256 spendingId = nextSpendingId;

        spendingRecords[spendingId] = SpendingRecord({
            spendingId: spendingId,
            campaignId: _campaignId,
            amount: _amount,
            purpose: _purpose,
            receiptReference: _receiptReference,
            timestamp: block.timestamp
        });

        campaigns[_campaignId].totalSpent += _amount;
        campaignSpendingIds[_campaignId].push(spendingId);

        nextSpendingId++;

        emit SpendingRecorded(
            spendingId,
            _campaignId,
            _amount,
            _purpose
        );
    }

    /**
     * @dev Admin can activate or deactivate a campaign.
     */
    function setCampaignStatus(uint256 _campaignId, bool _active)
        external
        onlyAdmin
        campaignExists(_campaignId)
    {
        campaigns[_campaignId].active = _active;

        emit CampaignStatusChanged(_campaignId, _active);
    }

    /**
     * @dev Returns one campaign by ID.
     */
    function getCampaign(uint256 _campaignId)
        external
        view
        campaignExists(_campaignId)
        returns (Campaign memory)
    {
        return campaigns[_campaignId];
    }

    /**
     * @dev Returns all campaigns.
     */
    function getAllCampaigns()
        external
        view
        returns (Campaign[] memory)
    {
        Campaign[] memory allCampaigns = new Campaign[](campaignIds.length);

        for (uint256 i = 0; i < campaignIds.length; i++) {
            allCampaigns[i] = campaigns[campaignIds[i]];
        }

        return allCampaigns;
    }

    /**
     * @dev Returns one donation receipt by ID.
     */
    function getDonation(uint256 _donationId)
        external
        view
        returns (Donation memory)
    {
        require(
            donations[_donationId].timestamp != 0,
            "Donation does not exist"
        );

        return donations[_donationId];
    }

    /**
     * @dev Returns donation history for a specific donor.
     */
    function getDonorDonations(address _donor)
        external
        view
        returns (Donation[] memory)
    {
        uint256[] memory ids = donorDonationIds[_donor];
        Donation[] memory result = new Donation[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = donations[ids[i]];
        }

        return result;
    }

    /**
     * @dev Returns all donations for a campaign.
     */
    function getCampaignDonations(uint256 _campaignId)
        external
        view
        campaignExists(_campaignId)
        returns (Donation[] memory)
    {
        uint256[] memory ids = campaignDonationIds[_campaignId];
        Donation[] memory result = new Donation[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = donations[ids[i]];
        }

        return result;
    }

    /**
     * @dev Returns all spending records for a campaign.
     */
    function getCampaignSpendingRecords(uint256 _campaignId)
        external
        view
        campaignExists(_campaignId)
        returns (SpendingRecord[] memory)
    {
        uint256[] memory ids = campaignSpendingIds[_campaignId];
        SpendingRecord[] memory result = new SpendingRecord[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = spendingRecords[ids[i]];
        }

        return result;
    }

    /**
     * @dev Returns remaining balance for a campaign.
     */
    function getCampaignRemainingBalance(uint256 _campaignId)
        public
        view
        campaignExists(_campaignId)
        returns (uint256)
    {
        Campaign memory campaign = campaigns[_campaignId];

        return campaign.totalDonated - campaign.totalSpent;
    }

    /**
     * @dev Returns campaign progress percentage.
     * Example:
     * target = 10 ETH
     * donated = 5 ETH
     * progress = 50
     */
    function getCampaignProgress(uint256 _campaignId)
        external
        view
        campaignExists(_campaignId)
        returns (uint256)
    {
        Campaign memory campaign = campaigns[_campaignId];

        uint256 progress = (campaign.totalDonated * 100) / campaign.targetAmount;

        if (progress > 100) {
            return 100;
        }

        return progress;
    }

    /**
     * @dev Returns which donation milestones have been reached.
     * Result order:
     * [25%, 50%, 75%, 100%]
     */
    function getMilestones(uint256 _campaignId)
        external
        view
        campaignExists(_campaignId)
        returns (bool[4] memory)
    {
        Campaign memory campaign = campaigns[_campaignId];

        uint256 progress = (campaign.totalDonated * 100) / campaign.targetAmount;

        return [
            progress >= 25,
            progress >= 50,
            progress >= 75,
            progress >= 100
        ];
    }

    /**
     * @dev Returns overall project statistics.
     */
    function getPlatformStats()
        external
        view
        returns (
            uint256 totalCampaigns,
            uint256 totalDonationsAmount,
            uint256 totalSpendingAmount,
            uint256 totalRemainingAmount
        )
    {
        totalCampaigns = campaignIds.length;

        for (uint256 i = 0; i < campaignIds.length; i++) {
            Campaign memory campaign = campaigns[campaignIds[i]];

            totalDonationsAmount += campaign.totalDonated;
            totalSpendingAmount += campaign.totalSpent;
        }

        totalRemainingAmount = totalDonationsAmount - totalSpendingAmount;
    }
}