// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LiquidityLocker is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        address lpToken;
        uint256 amount;
        uint256 unlockTime;
        address withdrawer;
        bool withdrawn;
    }

    uint256 public lockFee;
    uint256 public lockCount;
    mapping(uint256 => Lock) public locks;

    event LockCreated(uint256 indexed lockId, address indexed lpToken, uint256 amount, uint256 unlockTime, address withdrawer);
    event LockWithdrawn(uint256 indexed lockId);

    constructor(uint256 _lockFee) Ownable(msg.sender) {
        lockFee = _lockFee;
    }

    function lockLiquidity(
        address lpToken,
        uint256 amount,
        uint256 unlockTime,
        address withdrawer
    ) external payable nonReentrant returns (uint256 lockId) {
        require(msg.value == lockFee, "Incorrect fee amount"); // RP-004: exact fee policy
        require(unlockTime > block.timestamp, "Unlock time must be future");
        require(amount > 0, "Amount must be > 0");
        require(withdrawer != address(0), "Invalid withdrawer"); // F-012

        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);

        lockId = lockCount++;
        locks[lockId] = Lock(lpToken, amount, unlockTime, withdrawer, false);

        emit LockCreated(lockId, lpToken, amount, unlockTime, withdrawer);
    }

    function getLock(uint256 lockId) external view returns (
        address lpToken, uint256 amount, uint256 unlockTime, address withdrawer, bool withdrawn
    ) {
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
        lockFee = _fee;
    }

    function withdrawFees() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }
}
