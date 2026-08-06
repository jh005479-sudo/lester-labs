// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/finance/VestingWallet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VestingFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_VESTING_FEE = 0.1 ether;
    address public immutable deploymentSigner;
    bool public immutable deploymentSignerMayReceiveFees;
    uint256 public vestingFee;
    uint256 public scheduleCount;
    address public treasury;

    event VestingCreated(uint256 indexed vestingId, address indexed vestingWallet, address indexed beneficiary);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event ProtocolFeeForwarded(address indexed treasury, uint256 amount);

    constructor(
        uint256 _vestingFee,
        address _initialOwner,
        address _treasury,
        bool _allowDeploymentSignerAsFeeRecipient
    ) Ownable(_initialOwner) {
        require(_treasury != address(0), "Invalid treasury");
        require(_initialOwner != msg.sender, "Deployer cannot control");
        require(_allowDeploymentSignerAsFeeRecipient || _treasury != msg.sender, "Deployer fee recipient disabled");
        require(_initialOwner != _treasury, "Owner and treasury must differ");
        require(_vestingFee <= MAX_VESTING_FEE, "Fee too high");
        deploymentSigner = msg.sender;
        deploymentSignerMayReceiveFees = _allowDeploymentSignerAsFeeRecipient;
        vestingFee = _vestingFee;
        treasury = _treasury;
    }

    function createVestingSchedule(
        address token,
        address beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool /*revocable*/ // stored for UI purposes; VestingWallet is not revocable by default
    ) external payable nonReentrant returns (uint256 vestingId) {
        require(msg.value == vestingFee, "Incorrect fee amount"); // RP-004: exact fee policy
        // F-014: Input validation
        require(token != address(0), "Invalid token address");
        require(beneficiary != address(0), "Invalid beneficiary");
        require(totalAmount > 0, "Amount must be > 0");
        require(vestingDuration > 0, "Duration must be > 0");
        require(cliffDuration <= vestingDuration, "Cliff exceeds vesting");
        // Safe uint64 casts
        require(startTime + cliffDuration <= type(uint64).max, "Start+cliff overflow");
        require(vestingDuration - cliffDuration <= type(uint64).max, "Duration overflow");

        VestingWallet wallet =
            new VestingWallet(beneficiary, uint64(startTime + cliffDuration), uint64(vestingDuration - cliffDuration));

        IERC20(token).safeTransferFrom(msg.sender, address(wallet), totalAmount);

        vestingId = scheduleCount++;
        _forwardProtocolFee(msg.value);
        emit VestingCreated(vestingId, address(wallet), beneficiary);
    }

    function setFee(uint256 _fee) external onlyOwner {
        require(_fee <= MAX_VESTING_FEE, "Fee too high");
        vestingFee = _fee;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        require(_treasury != deploymentSigner, "Deployer cannot control");
        require(_treasury != owner(), "Owner and treasury must differ");
        address previousTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(previousTreasury, _treasury);
    }

    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != deploymentSigner, "Deployer cannot control");
        require(newOwner != treasury, "Owner and treasury must differ");
        super.transferOwnership(newOwner);
    }

    function _forwardProtocolFee(uint256 amount) internal {
        if (amount == 0) return;
        (bool success,) = payable(treasury).call{value: amount}("");
        require(success, "Fee forwarding failed");
        emit ProtocolFeeForwarded(treasury, amount);
    }
}
