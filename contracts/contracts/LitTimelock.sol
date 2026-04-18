// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title LitTimelock — timelock controller for LitGovernor
 * @notice Delay is set to 2 days (172,800 seconds). Proposer and executor
 *         roles are granted to the Governor contract; canceller role to owner.
 */
contract LitTimelock is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
