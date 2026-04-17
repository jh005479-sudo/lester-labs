// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TheLedger is Ownable, ReentrancyGuard {
    uint256 public MIN_FEE = 0.01 ether;    // 0.01 zkLTC
    uint256 public treasuryCutBps = 5000;    // 5000/10000 = 50%
    uint256 public messageCount;

    address public treasury;

    event MessagePosted(
        address indexed sender,
        uint256 indexed index,
        uint256 timestamp,
        bytes data
    );

    error InsufficientFee();
    error EmptyMessage();
    error MessageTooLong();

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Zero treasury");
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
            (bool sent, ) = treasury.call{value: treasuryAmount}("");
            require(sent, "Transfer failed");
        }
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    function setMinFee(uint256 _minFee) external onlyOwner {
        require(_minFee > 0, "Fee must be positive");
        require(_minFee <= 0.1 ether, "Fee too high"); // max 0.1 zkLTC
        MIN_FEE = _minFee;
    }

    function rescueERC20(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    receive() external payable {}
}
