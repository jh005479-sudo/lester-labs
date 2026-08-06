// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LiquidityLocker is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_LOCK_FEE = 0.1 ether;
    address public immutable deploymentSigner;
    bool public immutable deploymentSignerMayReceiveFees;

    struct Lock {
        address lpToken;
        uint256 amount;
        uint256 unlockTime;
        address withdrawer;
        bool withdrawn;
    }

    uint256 public lockFee;
    uint256 public lockCount;
    address public treasury;
    mapping(uint256 => Lock) public locks;

    event LockCreated(
        uint256 indexed lockId, address indexed lpToken, uint256 amount, uint256 unlockTime, address withdrawer
    );
    event LockWithdrawn(uint256 indexed lockId);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event ProtocolFeeForwarded(address indexed treasury, uint256 amount);

    constructor(
        uint256 _lockFee,
        address _initialOwner,
        address _treasury,
        bool _allowDeploymentSignerAsFeeRecipient
    ) Ownable(_initialOwner) {
        require(_treasury != address(0), "Invalid treasury");
        require(_initialOwner != msg.sender, "Deployer cannot control");
        require(_allowDeploymentSignerAsFeeRecipient || _treasury != msg.sender, "Deployer fee recipient disabled");
        require(_initialOwner != _treasury, "Owner and treasury must differ");
        require(_lockFee <= MAX_LOCK_FEE, "Fee too high");
        deploymentSigner = msg.sender;
        deploymentSignerMayReceiveFees = _allowDeploymentSignerAsFeeRecipient;
        lockFee = _lockFee;
        treasury = _treasury;
    }

    function lockLiquidity(address lpToken, uint256 amount, uint256 unlockTime, address withdrawer)
        external
        payable
        nonReentrant
        returns (uint256 lockId)
    {
        require(msg.value == lockFee, "Incorrect fee amount"); // RP-004: exact fee policy
        require(unlockTime > block.timestamp, "Unlock time must be future");
        require(amount > 0, "Amount must be > 0");
        require(withdrawer != address(0), "Invalid withdrawer"); // F-012

        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        lockId = lockCount++;
        locks[lockId] = Lock(lpToken, amount, unlockTime, withdrawer, false);

        _forwardProtocolFee(msg.value);
        emit LockCreated(lockId, lpToken, amount, unlockTime, withdrawer);
    }

    function getLock(uint256 lockId)
        external
        view
        returns (address lpToken, uint256 amount, uint256 unlockTime, address withdrawer, bool withdrawn)
    {
        Lock storage l = locks[lockId];
        return (l.lpToken, l.amount, l.unlockTime, l.withdrawer, l.withdrawn);
    }

    function withdraw(uint256 lockId) external nonReentrant {
        Lock storage l = locks[lockId];
        require(msg.sender == l.withdrawer, "Not withdrawer");
        require(block.timestamp >= l.unlockTime, "Still locked");
        require(!l.withdrawn, "Already withdrawn");

        l.withdrawn = true;
        IERC20(l.lpToken).safeTransfer(l.withdrawer, l.amount);

        emit LockWithdrawn(lockId);
    }

    function setFee(uint256 _fee) external onlyOwner {
        require(_fee <= MAX_LOCK_FEE, "Fee too high");
        lockFee = _fee;
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
