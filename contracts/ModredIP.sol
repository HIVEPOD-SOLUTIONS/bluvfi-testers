 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ERC6551Registry.sol";

/**
 * @title ModredIP
 * @dev Intellectual Property management contract with ERC-6551 token-bound accounts
 */
contract ModredIP is ERC721, Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant ROYALTY_DECIMALS = 10000; // 10000 = 100%
    uint256 public constant MINIMUM_LICENSE_DURATION = 1 days;
    uint256 public constant DISPUTE_TIMEOUT = 30 days;
    uint256 public constant MIN_ARBITRATOR_STAKE = 0.000000001 ether; // Minimum stake to become arbitrator (1 gwei)
    uint256 public constant REQUIRED_ARBITRATORS = 3; // Number of arbitrators required per dispute
    uint256 public constant ARBITRATION_TIMEOUT = 7 days; // Time limit for arbitration
    uint256 public constant MIN_UPHOLD_VOTES = 3; // Minimum uphold votes required to resolve
    uint256 public constant UPHOLD_WAIT_PERIOD = 24 hours; // Wait period after 3 uphold votes
    
    // ERC-6551 Integration
    ERC6551Registry public registry;
    address public accountImplementation;
    uint256 public chainId;
    
    // Platform fees
    address public platformFeeCollector;
    uint256 public platformFeePercentage = 250; // 2.5% (250 basis points)
    
    // Counters
    uint256 public nextTokenId = 1;
    uint256 public nextLicenseId = 1;
    uint256 public nextDisputeId = 1;
    uint256 public nextArbitrationId = 1;
    
    // Structs
    struct IPAsset {
        uint256 tokenId;
        address owner;
        string ipHash;
        string metadata;
        bool isEncrypted;
        bool isDisputed;
        uint256 registrationDate;
        uint256 totalRevenue;
        uint256 royaltyTokens; // Remaining royalty tokens (out of ROYALTY_DECIMALS)
    }
    
    struct License {
        uint256 licenseId;
        address licensee;
        uint256 tokenId;
        uint256 royaltyPercentage;
        uint256 duration;
        uint256 startDate;
        bool isActive;
        bool commercialUse;
        string terms;
    }
    
    struct Dispute {
        uint256 disputeId;
        uint256 tokenId;
        address disputer;
        string reason;
        uint256 timestamp;
        bool isResolved;
        uint256 arbitrationId; // Associated arbitration case
    }
    
    struct Arbitrator {
        address arbitrator;
        uint256 stake;
        uint256 reputation; // Track successful arbitrations
        uint256 totalCases;
        uint256 successfulCases;
        bool isActive;
        uint256 registrationDate;
    }
    
    struct Arbitration {
        uint256 arbitrationId;
        uint256 disputeId;
        address[] arbitrators;
        mapping(address => bool) hasVoted;
        mapping(address => bool) decision; // true = uphold dispute, false = reject dispute
        uint256 votesFor; // Votes to uphold dispute
        uint256 votesAgainst; // Votes to reject dispute
        uint256 deadline;
        bool isResolved;
        string resolution;
        uint256 threeUpholdVotesTimestamp; // Timestamp when 3 uphold votes were first reached (0 if not reached)
    }
    
    struct RoyaltyVault {
        uint256 totalAccumulated;
        uint256 lastClaimed;
        mapping(address => uint256) balances;
    }
    
    // Mappings
    mapping(uint256 => IPAsset) public ipAssets;
    mapping(uint256 => License) public licenses;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => RoyaltyVault) public royaltyVaults;
    mapping(uint256 => uint256[]) public tokenLicenses; // tokenId => licenseIds
    mapping(uint256 => uint256[]) public tokenDisputes; // tokenId => disputeIds (allows multiple disputes per IP)
    mapping(address => Arbitrator) public arbitrators;
    mapping(uint256 => Arbitration) public arbitrations;
    address[] public arbitratorList; // List of all registered arbitrators
    
    // Events
    event IPRegistered(uint256 indexed tokenId, address indexed owner, string ipHash);
    event LicenseMinted(uint256 indexed licenseId, uint256 indexed tokenId, address indexed licensee);
    event RevenuePaid(uint256 indexed tokenId, uint256 amount);
    event RoyaltyClaimed(uint256 indexed tokenId, address indexed claimant, uint256 amount);
    event DisputeRaised(uint256 indexed disputeId, uint256 indexed tokenId, address indexed disputer);
    event DisputeResolved(uint256 indexed disputeId, uint256 indexed tokenId, bool resolved);
    event IPTransferred(uint256 indexed tokenId, address indexed from, address indexed to);
    event ArbitratorRegistered(address indexed arbitrator, uint256 stake);
    event ArbitratorUnstaked(address indexed arbitrator, uint256 stake);
    event ArbitratorsAssigned(uint256 indexed arbitrationId, uint256 indexed disputeId, address[] arbitrators);
    event ArbitrationVote(uint256 indexed arbitrationId, address indexed arbitrator, bool decision);
    event ArbitrationResolved(uint256 indexed arbitrationId, uint256 indexed disputeId, bool upheld);
    
    constructor(
        address _registry,
        address _accountImplementation,
        uint256 _chainId,
        address _platformFeeCollector
    ) ERC721("ModredIP", "MOD") Ownable(msg.sender) {
        registry = ERC6551Registry(_registry);
        accountImplementation = _accountImplementation;
        chainId = _chainId;
        platformFeeCollector = _platformFeeCollector;
    }
    
    /**
     * @dev Register a new IP asset
     */
    function registerIP(
        string memory ipHash,
        string memory metadata,
        bool isEncrypted
    ) public returns (uint256) {
        uint256 tokenId = nextTokenId++;
        
        ipAssets[tokenId] = IPAsset({
            tokenId: tokenId,
            owner: msg.sender,
            ipHash: ipHash,
            metadata: metadata,
            isEncrypted: isEncrypted,
            isDisputed: false,
            registrationDate: block.timestamp,
            totalRevenue: 0,
            royaltyTokens: ROYALTY_DECIMALS // 100% initially
        });
        
        _mint(msg.sender, tokenId);
        emit IPRegistered(tokenId, msg.sender, ipHash);
        
        return tokenId;
    }
    
    /**
     * @dev Mint a license for an IP asset
     */
    function mintLicense(
        uint256 tokenId,
        uint256 royaltyPercentage,
        uint256 duration,
        bool commercialUse,
        string memory terms
    ) public returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Only IP owner can mint licenses");
        require(duration >= MINIMUM_LICENSE_DURATION, "Duration too short");
        require(royaltyPercentage <= ipAssets[tokenId].royaltyTokens, "Invalid royalty percentage");
        require(royaltyPercentage <= ROYALTY_DECIMALS / 2, "Royalty cannot exceed 50%");
        
        uint256 licenseId = nextLicenseId++;
        
        licenses[licenseId] = License({
            licenseId: licenseId,
            licensee: msg.sender,
            tokenId: tokenId,
            royaltyPercentage: royaltyPercentage,
            duration: duration,
            startDate: block.timestamp,
            isActive: true,
            commercialUse: commercialUse,
            terms: terms
        });
        
        tokenLicenses[tokenId].push(licenseId);
        ipAssets[tokenId].royaltyTokens -= royaltyPercentage;
        
        emit LicenseMinted(licenseId, tokenId, msg.sender);
        return licenseId;
    }
    
    /**
     * @dev Pay revenue for an IP asset
     */
    function payRevenue(uint256 tokenId) public payable nonReentrant {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(msg.value > 0, "Payment must be greater than 0");
        
        IPAsset storage asset = ipAssets[tokenId];
        address ipOwner = ownerOf(tokenId);
        asset.totalRevenue += msg.value;
        
        // Calculate platform fee
        uint256 platformFee = (msg.value * platformFeePercentage) / ROYALTY_DECIMALS;
        uint256 remainingAmount = msg.value - platformFee;
        
        // Send platform fee
        if (platformFee > 0 && platformFeeCollector != address(0)) {
            (bool feeSuccess, ) = payable(platformFeeCollector).call{value: platformFee}("");
            require(feeSuccess, "Platform fee transfer failed");
        }
        
        // Distribute to license holders
        uint256 totalLicenseeRoyalties = 0;
        uint256[] memory licenseIds = tokenLicenses[tokenId];
        RoyaltyVault storage vault = royaltyVaults[tokenId];
        
        for (uint256 i = 0; i < licenseIds.length; i++) {
            License storage license = licenses[licenseIds[i]];
            if (license.isActive && block.timestamp < license.startDate + license.duration) {
                uint256 royaltyAmount = (remainingAmount * license.royaltyPercentage) / ROYALTY_DECIMALS;
                vault.balances[license.licensee] += royaltyAmount;
                vault.totalAccumulated += royaltyAmount;
                totalLicenseeRoyalties += royaltyAmount;
            }
        }
        
        // Give remaining amount to IP owner (author)
        uint256 ownerRoyalty = remainingAmount - totalLicenseeRoyalties;
        if (ownerRoyalty > 0) {
            vault.balances[ipOwner] += ownerRoyalty;
            vault.totalAccumulated += ownerRoyalty;
        }
        
        emit RevenuePaid(tokenId, msg.value);
    }
    
    /**
     * @dev Claim royalties for a token
     */
    function claimRoyalties(uint256 tokenId) public nonReentrant {
        RoyaltyVault storage vault = royaltyVaults[tokenId];
        uint256 amount = vault.balances[msg.sender];
        require(amount > 0, "No royalties to claim");
        
        vault.balances[msg.sender] = 0;
        vault.lastClaimed = block.timestamp;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Royalty transfer failed");
        
        emit RoyaltyClaimed(tokenId, msg.sender, amount);
    }
    
    /**
     * @dev Raise a dispute for an IP asset
     * @notice Multiple disputes can be raised for the same IP asset
     */
    function raiseDispute(uint256 tokenId, string memory reason) public {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        uint256 disputeId = nextDisputeId++;
        uint256 arbitrationId = nextArbitrationId++;
        
        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            tokenId: tokenId,
            disputer: msg.sender,
            reason: reason,
            timestamp: block.timestamp,
            isResolved: false,
            arbitrationId: arbitrationId
        });
        
        // Add dispute to token's dispute list
        tokenDisputes[tokenId].push(disputeId);
        
        // Initialize arbitration case
        Arbitration storage arbitration = arbitrations[arbitrationId];
        arbitration.arbitrationId = arbitrationId;
        arbitration.disputeId = disputeId;
        arbitration.deadline = block.timestamp + ARBITRATION_TIMEOUT;
        arbitration.isResolved = false;
        
        // Set isDisputed to true if this is the first active dispute
        if (!ipAssets[tokenId].isDisputed) {
            ipAssets[tokenId].isDisputed = true;
        }
        
        emit DisputeRaised(disputeId, tokenId, msg.sender);
    }
    
    /**
     * @dev Check if an IP asset has any active (unresolved) disputes
     */
    function hasActiveDisputes(uint256 tokenId) public view returns (bool) {
        uint256[] memory disputeIds = tokenDisputes[tokenId];
        for (uint256 i = 0; i < disputeIds.length; i++) {
            if (!disputes[disputeIds[i]].isResolved) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Get all dispute IDs for a token
     */
    function getTokenDisputes(uint256 tokenId) public view returns (uint256[] memory) {
        return tokenDisputes[tokenId];
    }
    
    /**
     * @dev Resolve a dispute (only owner - fallback method)
     */
    function resolveDispute(uint256 disputeId, bool resolved) public onlyOwner {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.disputeId != 0, "Dispute does not exist");
        require(!dispute.isResolved, "Dispute already resolved");
        
        dispute.isResolved = resolved;
        
        // Update isDisputed flag based on whether there are any active disputes remaining
        if (!hasActiveDisputes(dispute.tokenId)) {
            ipAssets[dispute.tokenId].isDisputed = false;
        } else {
            ipAssets[dispute.tokenId].isDisputed = true;
        }
        
        emit DisputeResolved(disputeId, dispute.tokenId, resolved);
    }
    
    /**
     * @dev Register as an arbitrator (requires minimum stake)
     */
    function registerArbitrator() public payable {
        require(msg.value >= MIN_ARBITRATOR_STAKE, "Insufficient stake");
        require(arbitrators[msg.sender].arbitrator == address(0) || !arbitrators[msg.sender].isActive, "Already registered");
        
        if (arbitrators[msg.sender].arbitrator == address(0)) {
            arbitratorList.push(msg.sender);
            arbitrators[msg.sender] = Arbitrator({
                arbitrator: msg.sender,
                stake: msg.value,
                reputation: 0,
                totalCases: 0,
                successfulCases: 0,
                isActive: true,
                registrationDate: block.timestamp
            });
        } else {
            // Re-registering (was deactivated)
            arbitrators[msg.sender].stake += msg.value;
            arbitrators[msg.sender].isActive = true;
        }
        
        emit ArbitratorRegistered(msg.sender, msg.value);
    }
    
    /**
     * @dev Unstake and deactivate as an arbitrator (self-service)
     * @notice Allows arbitrators to withdraw their stake and deactivate themselves
     * @notice Cannot unstake if currently assigned to active disputes
     */
    function unstake() public nonReentrant {
        require(arbitrators[msg.sender].arbitrator != address(0), "Not registered as arbitrator");
        require(arbitrators[msg.sender].stake > 0, "No stake to withdraw");
        
        // Check if arbitrator has active disputes
        require(getArbitratorActiveDisputes(msg.sender) == 0, "Cannot unstake while assigned to active disputes");
        
        uint256 stakeAmount = arbitrators[msg.sender].stake;
        arbitrators[msg.sender].stake = 0;
        arbitrators[msg.sender].isActive = false;
        
        // Transfer stake back to arbitrator
        (bool success, ) = payable(msg.sender).call{value: stakeAmount}("");
        require(success, "Transfer failed");
        
        emit ArbitratorUnstaked(msg.sender, stakeAmount);
    }
    
    /**
     * @dev Deactivate an arbitrator (only owner)
     */
    function deactivateArbitrator(address arbitrator) public onlyOwner {
        require(arbitrators[arbitrator].arbitrator != address(0), "Arbitrator not registered");
        arbitrators[arbitrator].isActive = false;
    }
    
    /**
     * @dev Activate an arbitrator (only owner)
     */
    function activateArbitrator(address arbitrator) public onlyOwner {
        require(arbitrators[arbitrator].arbitrator != address(0), "Arbitrator not registered");
        arbitrators[arbitrator].isActive = true;
    }
    
    /**
     * @dev Assign arbitrators to a dispute (owner or automated selection)
     * @notice Allows 1-3 arbitrators to be assigned (flexible when insufficient arbitrators available)
     */
    function assignArbitrators(uint256 disputeId, address[] memory selectedArbitrators) public {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.disputeId != 0, "Dispute does not exist");
        require(!dispute.isResolved, "Dispute already resolved");
        require(selectedArbitrators.length > 0 && selectedArbitrators.length <= REQUIRED_ARBITRATORS, "Invalid number of arbitrators");
        
        uint256 arbitrationId = dispute.arbitrationId;
        Arbitration storage arbitration = arbitrations[arbitrationId];
        require(arbitration.arbitrators.length == 0, "Arbitrators already assigned");
        
        // Verify all selected arbitrators are active
        for (uint256 i = 0; i < selectedArbitrators.length; i++) {
            require(arbitrators[selectedArbitrators[i]].isActive, "Arbitrator not active");
            require(arbitrators[selectedArbitrators[i]].arbitrator != address(0), "Arbitrator not registered");
            arbitration.arbitrators.push(selectedArbitrators[i]);
        }
        
        emit ArbitratorsAssigned(arbitrationId, disputeId, selectedArbitrators);
    }
    
    /**
     * @dev Submit arbitration decision (only assigned arbitrators)
     */
    function submitArbitrationDecision(uint256 disputeId, bool decision, string memory resolution) public {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.disputeId != 0, "Dispute does not exist");
        require(!dispute.isResolved, "Dispute already resolved");
        
        uint256 arbitrationId = dispute.arbitrationId;
        Arbitration storage arbitration = arbitrations[arbitrationId];
        require(arbitration.arbitrationId != 0, "Arbitration not found");
        require(block.timestamp <= arbitration.deadline, "Arbitration deadline passed");
        require(!arbitration.isResolved, "Arbitration already resolved");
        
        // Verify sender is an assigned arbitrator
        bool isArbitrator = false;
        for (uint256 i = 0; i < arbitration.arbitrators.length; i++) {
            if (arbitration.arbitrators[i] == msg.sender) {
                isArbitrator = true;
                break;
            }
        }
        require(isArbitrator, "Not an assigned arbitrator");
        require(!arbitration.hasVoted[msg.sender], "Already voted");
        
        // Record vote
        arbitration.hasVoted[msg.sender] = true;
        arbitration.decision[msg.sender] = decision;
        
        if (decision) {
            arbitration.votesFor++;
        } else {
            arbitration.votesAgainst++;
        }
        
        // Update arbitrator stats
        arbitrators[msg.sender].totalCases++;
        
        emit ArbitrationVote(arbitrationId, msg.sender, decision);
        
        // Track when 3 uphold votes are first reached
        if (decision && arbitration.votesFor == MIN_UPHOLD_VOTES && arbitration.threeUpholdVotesTimestamp == 0) {
            arbitration.threeUpholdVotesTimestamp = block.timestamp;
        }
        
        // Auto-resolve based on vote majority:
        // 1. If uphold votes > reject votes → resolve as upheld
        // 2. If reject votes > uphold votes → resolve as rejected
        // 3. Resolve immediately when majority is clear (no need to wait for all votes)
        
        uint256 totalVotes = arbitration.votesFor + arbitration.votesAgainst;
        bool allVoted = totalVotes >= arbitration.arbitrators.length;
        bool canResolve = false;
        
        // Auto-resolve if all arbitrators have voted (immediate resolution)
        if (allVoted) {
            canResolve = true;
        } else {
            // Auto-resolve if majority is clear (even if not all voted)
            // Need at least 2 votes to have a majority
            if (totalVotes >= 2) {
                // If uphold votes > reject votes, resolve as upheld
                if (arbitration.votesFor > arbitration.votesAgainst) {
                    canResolve = true;
                }
                // If reject votes > uphold votes, resolve as rejected
                else if (arbitration.votesAgainst > arbitration.votesFor) {
                    canResolve = true;
                }
            }
        }
        
        // Auto-resolve if conditions are met
        if (canResolve) {
            _resolveArbitration(arbitrationId, disputeId, resolution);
        }
    }
    
    /**
     * @dev Internal function to resolve arbitration
     */
    function _resolveArbitration(uint256 arbitrationId, uint256 disputeId, string memory resolution) internal {
        Arbitration storage arbitration = arbitrations[arbitrationId];
        Dispute storage dispute = disputes[disputeId];
        
        require(!arbitration.isResolved, "Already resolved");
        
        // Dispute is upheld if votesFor > votesAgainst
        // Otherwise, it's rejected
        bool upheld = arbitration.votesFor > arbitration.votesAgainst;
        arbitration.isResolved = true;
        arbitration.resolution = resolution;
        dispute.isResolved = true;
        
        if (upheld) {
            // Dispute upheld - IP remains disputed
            // Could add additional logic here (e.g., transfer ownership, burn token, etc.)
        } else {
            // Dispute rejected - check if there are any other active disputes
            if (!hasActiveDisputes(dispute.tokenId)) {
                ipAssets[dispute.tokenId].isDisputed = false;
            }
        }
        
        // Update arbitrator reputations
        for (uint256 i = 0; i < arbitration.arbitrators.length; i++) {
            address arbitrator = arbitration.arbitrators[i];
            if (arbitration.hasVoted[arbitrator]) {
                bool arbitratorVote = arbitration.decision[arbitrator];
                if (arbitratorVote == upheld) {
                    arbitrators[arbitrator].successfulCases++;
                    arbitrators[arbitrator].reputation += 10; // Reward for correct decision
                } else {
                    if (arbitrators[arbitrator].reputation > 0) {
                        arbitrators[arbitrator].reputation -= 5; // Penalty for incorrect decision
                    }
                }
            }
        }
        
        emit ArbitrationResolved(arbitrationId, disputeId, upheld);
        emit DisputeResolved(disputeId, dispute.tokenId, upheld);
    }
    
    /**
     * @dev Resolve arbitration after deadline (if not all votes received)
     * @notice Resolves based on votes received, but still requires minimum 3 uphold votes to uphold
     */
    function resolveArbitrationAfterDeadline(uint256 disputeId) public {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.disputeId != 0, "Dispute does not exist");
        require(!dispute.isResolved, "Dispute already resolved");
        
        uint256 arbitrationId = dispute.arbitrationId;
        Arbitration storage arbitration = arbitrations[arbitrationId];
        require(block.timestamp > arbitration.deadline, "Deadline not passed");
        require(!arbitration.isResolved, "Arbitration already resolved");
        
        // Resolve based on vote majority after deadline
        // If uphold votes > reject votes → resolve as upheld
        // If reject votes > uphold votes → resolve as rejected
        string memory resolution = "Arbitration resolved after deadline based on vote majority";

        // Use the same resolution logic as submitArbitrationDecision
        _resolveArbitration(arbitrationId, disputeId, resolution);
    }
    
    /**
     * @dev Check and resolve arbitration if 3 uphold votes reached and 24 hours passed
     * @notice Only the contract owner can manually trigger resolution after waiting period
     */
    function checkAndResolveArbitration(uint256 disputeId) public onlyOwner {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.disputeId != 0, "Dispute does not exist");
        require(!dispute.isResolved, "Dispute already resolved");
        
        uint256 arbitrationId = dispute.arbitrationId;
        Arbitration storage arbitration = arbitrations[arbitrationId];
        require(!arbitration.isResolved, "Arbitration already resolved");
        require(arbitration.votesFor >= MIN_UPHOLD_VOTES, "Minimum uphold votes not reached");
        require(arbitration.threeUpholdVotesTimestamp > 0, "Three uphold votes timestamp not set");
        require(
            block.timestamp >= arbitration.threeUpholdVotesTimestamp + UPHOLD_WAIT_PERIOD,
            "24 hour waiting period not passed"
        );
        
        // Get the latest resolution from the last vote (if available)
        // For now, use a default resolution
        string memory resolution = "Arbitration resolved after 24 hour waiting period with 3+ uphold votes";
        _resolveArbitration(arbitrationId, disputeId, resolution);
    }
    
    /**
     * @dev Auto-resolve dispute when no arbitrators are available after timeout
     * @notice Only the dispute author can resolve if no arbitrators assigned and deadline passed
     */
    function resolveDisputeWithoutArbitrators(uint256 disputeId) public {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.disputeId != 0, "Dispute does not exist");
        require(!dispute.isResolved, "Dispute already resolved");
        require(msg.sender == dispute.disputer, "Only the dispute author can resolve");
        
        uint256 arbitrationId = dispute.arbitrationId;
        Arbitration storage arbitration = arbitrations[arbitrationId];
        require(arbitration.arbitrators.length == 0, "Arbitrators already assigned");
        require(block.timestamp > arbitration.deadline, "Deadline not passed");
        require(!arbitration.isResolved, "Arbitration already resolved");
        
        // Auto-reject dispute when no arbitrators available (dispute rejected by default)
        arbitration.isResolved = true;
        arbitration.resolution = "Dispute auto-rejected: No arbitrators available within deadline";
        dispute.isResolved = true;
        
        // Check if there are any other active disputes
        if (!hasActiveDisputes(dispute.tokenId)) {
            ipAssets[dispute.tokenId].isDisputed = false;
        } else {
            ipAssets[dispute.tokenId].isDisputed = true;
        }
        
        emit ArbitrationResolved(arbitrationId, disputeId, false);
        emit DisputeResolved(disputeId, dispute.tokenId, false);
    }
    
    /**
     * @dev Transfer IP ownership
     */
    function transferIP(uint256 tokenId, address to) public {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(!hasActiveDisputes(tokenId), "Cannot transfer IP with active disputes");
        
        address from = ownerOf(tokenId);
        _transfer(from, to, tokenId);
        ipAssets[tokenId].owner = to;
        
        emit IPTransferred(tokenId, from, to);
    }
    
    /**
     * @dev Get IP asset details
     */
    function getIPAsset(uint256 tokenId) public view returns (
        address owner_,
        string memory ipHash_,
        string memory metadata_,
        bool isEncrypted_,
        bool isDisputed_,
        uint256 registrationDate_,
        uint256 totalRevenue_,
        uint256 royaltyTokens_
    ) {
        IPAsset storage asset = ipAssets[tokenId];
        return (
            asset.owner,
            asset.ipHash,
            asset.metadata,
            asset.isEncrypted,
            asset.isDisputed,
            asset.registrationDate,
            asset.totalRevenue,
            asset.royaltyTokens
        );
    }
    
    /**
     * @dev Get license details
     */
    function getLicense(uint256 licenseId) public view returns (
        address licensee_,
        uint256 tokenId_,
        uint256 royaltyPercentage_,
        uint256 duration_,
        uint256 startDate_,
        bool isActive_,
        bool commercialUse_,
        string memory terms_
    ) {
        License storage license = licenses[licenseId];
        return (
            license.licensee,
            license.tokenId,
            license.royaltyPercentage,
            license.duration,
            license.startDate,
            license.isActive,
            license.commercialUse,
            license.terms
        );
    }
    
    /**
     * @dev Get royalty information for a token and address
     */
    function getRoyaltyInfo(uint256 tokenId, address claimant) public view returns (
        uint256 totalRevenue_,
        uint256 claimableAmount_,
        uint256 lastClaimed_,
        uint256 totalAccumulated_
    ) {
        IPAsset storage asset = ipAssets[tokenId];
        RoyaltyVault storage vault = royaltyVaults[tokenId];
        
        return (
            asset.totalRevenue,
            vault.balances[claimant],
            vault.lastClaimed,
            vault.totalAccumulated
        );
    }
    
    /**
     * @dev Get IP account address (ERC-6551)
     */
    function getIPAccount(uint256 tokenId) public view returns (address) {
        return registry.account(
            accountImplementation,
                chainId,
            address(this),
                tokenId,
            0
        );
    }
    
    /**
     * @dev Get dispute details
     */
    function getDispute(uint256 disputeId) public view returns (
        uint256 disputeId_,
        uint256 tokenId_,
        address disputer_,
        string memory reason_,
        uint256 timestamp_,
        bool isResolved_,
        uint256 arbitrationId_
    ) {
        Dispute storage dispute = disputes[disputeId];
        return (
            dispute.disputeId,
            dispute.tokenId,
            dispute.disputer,
            dispute.reason,
            dispute.timestamp,
            dispute.isResolved,
            dispute.arbitrationId
        );
    }
    
    /**
     * @dev Get arbitrator details
     */
    function getArbitrator(address arbitrator) public view returns (
        address arbitrator_,
        uint256 stake_,
        uint256 reputation_,
        uint256 totalCases_,
        uint256 successfulCases_,
        bool isActive_,
        uint256 registrationDate_
    ) {
        Arbitrator storage arb = arbitrators[arbitrator];
        return (
            arb.arbitrator,
            arb.stake,
            arb.reputation,
            arb.totalCases,
            arb.successfulCases,
            arb.isActive,
            arb.registrationDate
        );
    }
    
    /**
     * @dev Get arbitration details
     */
    function getArbitration(uint256 arbitrationId) public view returns (
        uint256 arbitrationId_,
        uint256 disputeId_,
        address[] memory arbitrators_,
        uint256 votesFor_,
        uint256 votesAgainst_,
        uint256 deadline_,
        bool isResolved_,
        string memory resolution_,
        uint256 threeUpholdVotesTimestamp_
    ) {
        Arbitration storage arbitration = arbitrations[arbitrationId];
        return (
            arbitration.arbitrationId,
            arbitration.disputeId,
            arbitration.arbitrators,
            arbitration.votesFor,
            arbitration.votesAgainst,
            arbitration.deadline,
            arbitration.isResolved,
            arbitration.resolution,
            arbitration.threeUpholdVotesTimestamp
        );
    }
    
    /**
     * @dev Check if an arbitrator has voted on a specific arbitration
     */
    function hasArbitratorVoted(uint256 arbitrationId, address arbitrator) public view returns (bool) {
        return arbitrations[arbitrationId].hasVoted[arbitrator];
    }
    
    /**
     * @dev Get arbitrator's decision for a specific arbitration
     */
    function getArbitratorDecision(uint256 arbitrationId, address arbitrator) public view returns (bool) {
        return arbitrations[arbitrationId].decision[arbitrator];
    }
    
    /**
     * @dev Get list of all registered arbitrators
     */
    function getAllArbitrators() public view returns (address[] memory) {
        return arbitratorList;
    }
    
    /**
     * @dev Get active arbitrators count
     */
    function getActiveArbitratorsCount() public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < arbitratorList.length; i++) {
            if (arbitrators[arbitratorList[i]].isActive) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Get the number of active (unresolved) disputes assigned to an arbitrator
     * @param arbitrator The address of the arbitrator
     * @return The count of active disputes assigned to this arbitrator
     */
    function getArbitratorActiveDisputes(address arbitrator) public view returns (uint256) {
        uint256 count = 0;
        // Iterate through all arbitrations
        for (uint256 i = 1; i < nextArbitrationId; i++) {
            Arbitration storage arbitration = arbitrations[i];
            // Check if arbitrator is assigned and arbitration is not resolved
            if (!arbitration.isResolved) {
                for (uint256 j = 0; j < arbitration.arbitrators.length; j++) {
                    if (arbitration.arbitrators[j] == arbitrator) {
                        count++;
                        break; // Count each arbitration only once
                    }
                }
            }
        }
        return count;
    }
    
    /**
     * @dev Set platform fee collector (only owner)
     */
    function setPlatformFeeCollector(address _platformFeeCollector) public onlyOwner {
        platformFeeCollector = _platformFeeCollector;
    }
    
    /**
     * @dev Set platform fee percentage (only owner)
     */
    function setPlatformFeePercentage(uint256 _platformFeePercentage) public onlyOwner {
        require(_platformFeePercentage <= ROYALTY_DECIMALS, "Fee too high");
        platformFeePercentage = _platformFeePercentage;
    }
    
    /**
     * @dev Override transfer to check for disputes
     */
    function transferFrom(address from, address to, uint256 tokenId) public override {
        if (from != address(0) && to != address(0)) {
            require(!hasActiveDisputes(tokenId), "Cannot transfer IP with active disputes");
        }
        super.transferFrom(from, to, tokenId);
    }
    
    /**
     * @dev Override safeTransferFrom to check for disputes
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        if (from != address(0) && to != address(0)) {
            require(!hasActiveDisputes(tokenId), "Cannot transfer IP with active disputes");
        }
        super.safeTransferFrom(from, to, tokenId, data);
    }
    
    /**
     * @dev Hook called after any token transfer
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        address updated = super._update(to, tokenId, auth);
        
        // Update IP asset owner if token exists
        if (ipAssets[tokenId].tokenId != 0) {
            if (from != address(0) && to != address(0)) {
                ipAssets[tokenId].owner = to;
                emit IPTransferred(tokenId, from, to);
            } else if (to != address(0)) {
                // Mint case
                ipAssets[tokenId].owner = to;
            }
        }
        
        return updated;
    }
    
    /**
     * @dev Get token URI (for NFT metadata)
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return ipAssets[tokenId].metadata;
    }
} 
