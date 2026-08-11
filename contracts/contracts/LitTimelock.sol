// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title LitTimelock — timelock controller for LitGovernor
 * @notice Delay is set to 2 days (172,800 seconds). Proposer and executor
 *         roles are granted to the Governor contract; canceller role to owner.
 */
contract LitTimelock is TimelockController {
    address public immutable governor;
    address public immutable emergencyCanceller;
    address public immutable deploymentSigner;

    constructor(uint256 minDelay, address governor_, address emergencyCanceller_)
        TimelockController(minDelay, _singleton(governor_), _singleton(governor_), address(0))
    {
        require(governor_ != address(0), "LitTimelock: zero governor");
        require(emergencyCanceller_ != address(0), "LitTimelock: zero canceller");
        require(governor_ != emergencyCanceller_, "LitTimelock: roles must differ");
        require(governor_ != msg.sender && emergencyCanceller_ != msg.sender, "LitTimelock: deployer control");

        governor = governor_;
        emergencyCanceller = emergencyCanceller_;
        deploymentSigner = msg.sender;

        _revokeRole(CANCELLER_ROLE, governor_);
        _grantRole(CANCELLER_ROLE, emergencyCanceller_);
    }

    function _singleton(address account) private pure returns (address[] memory accounts) {
        accounts = new address[](1);
        accounts[0] = account;
    }
}
