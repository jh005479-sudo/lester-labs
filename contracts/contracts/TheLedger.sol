// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TheLedger is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable deploymentSigner;
    bool public immutable deploymentSignerMayReceiveFees;

    uint256 public MIN_FEE = 0.01 ether; // 0.01 zkLTC
    uint256 public treasuryCutBps = 5000; // 5000/10000 = 50%
    uint256 public messageCount;

    address public treasury;

    event MessagePosted(address indexed sender, uint256 indexed index, uint256 timestamp, bytes data);
    event ProtocolFeeForwarded(address indexed treasury, uint256 amount);
    event NativeFeesWithdrawn(address indexed treasury, uint256 amount);
    event ERC20Rescued(address indexed token, address indexed treasury, uint256 amount);

    error InsufficientFee();
    error EmptyMessage();
    error MessageTooLong();

    constructor(address _treasury, address _initialOwner, bool _allowDeploymentSignerAsFeeRecipient)
        Ownable(_initialOwner)
    {
        require(_treasury != address(0), "Zero treasury");
        require(_initialOwner != msg.sender, "Deployer cannot control");
        require(_allowDeploymentSignerAsFeeRecipient || _treasury != msg.sender, "Deployer fee recipient disabled");
        require(_initialOwner != _treasury, "Owner and treasury must differ");
        deploymentSigner = msg.sender;
        deploymentSignerMayReceiveFees = _allowDeploymentSignerAsFeeRecipient;
        treasury = _treasury;
    }

    function post(bytes calldata message) external payable nonReentrant {
        if (msg.value < MIN_FEE) revert InsufficientFee();
        if (message.length == 0) revert EmptyMessage();
        if (message.length > 1024) revert MessageTooLong();

        uint256 index = messageCount;
        messageCount++;

        emit MessagePosted(msg.sender, index, block.timestamp, message);

        uint256 treasuryAmount = (msg.value * treasuryCutBps) / 10000;
        if (treasuryAmount > 0) {
            (bool sent,) = treasury.call{value: treasuryAmount}("");
            require(sent, "Transfer failed");
            emit ProtocolFeeForwarded(treasury, treasuryAmount);
        }
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        require(_treasury != deploymentSigner, "Deployer cannot control");
        require(_treasury != owner(), "Owner and treasury must differ");
        treasury = _treasury;
    }

    function setMinFee(uint256 _minFee) external onlyOwner {
        require(_minFee > 0, "Fee must be positive");
        require(_minFee <= 0.1 ether, "Fee too high"); // max 0.1 zkLTC
        MIN_FEE = _minFee;
    }

    function rescueERC20(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(treasury, amount);
        emit ERC20Rescued(token, treasury, amount);
    }

    /// @notice Permissionless liveness sweep for the retained half of posting
    /// fees. The caller cannot choose or change the treasury recipient.
    function flushRetainedFeesToTreasury() external nonReentrant {
        uint256 amount = address(this).balance;
        require(amount > 0, "No retained fees");
        (bool sent,) = treasury.call{value: amount}("");
        require(sent, "Transfer failed");
        emit NativeFeesWithdrawn(treasury, amount);
    }

    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != deploymentSigner, "Deployer cannot control");
        require(newOwner != treasury, "Owner and treasury must differ");
        super.transferOwnership(newOwner);
    }

    receive() external payable {}
}
