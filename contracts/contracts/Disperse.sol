// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Disperse is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_RECIPIENTS = 200;
    uint256 public totalRecipientEntries;

    event EtherDispersed(address indexed sender, uint256 recipientCount, uint256 totalAmount);
    event TokenDispersed(address indexed sender, address indexed token, uint256 recipientCount, uint256 totalAmount);

    function disperseEther(address[] calldata recipients, uint256[] calldata values) external payable nonReentrant {
        require(recipients.length == values.length, "Length mismatch"); // RP-005
        require(recipients.length > 0 && recipients.length <= MAX_RECIPIENTS, "Invalid recipient count");
        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient"); // RP-005
            require(values[i] > 0, "Invalid amount");
            total += values[i];
        }
        require(msg.value == total, "Incorrect ETH amount");
        for (uint256 i = 0; i < recipients.length; i++) {
            (bool success,) = payable(recipients[i]).call{value: values[i]}("");
            require(success, "Native transfer failed");
        }
        totalRecipientEntries += recipients.length;
        emit EtherDispersed(msg.sender, recipients.length, total);
    }

    function disperseToken(IERC20 token, address[] calldata recipients, uint256[] calldata values)
        external
        nonReentrant
    {
        require(recipients.length == values.length, "Length mismatch"); // RP-005
        require(recipients.length > 0 && recipients.length <= MAX_RECIPIENTS, "Invalid recipient count");
        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient"); // RP-005
            require(values[i] > 0, "Invalid amount");
            total += values[i];
        }
        token.safeTransferFrom(msg.sender, address(this), total);
        for (uint256 i = 0; i < recipients.length; i++) {
            token.safeTransfer(recipients[i], values[i]);
        }
        totalRecipientEntries += recipients.length;
        emit TokenDispersed(msg.sender, address(token), recipients.length, total);
    }
}
