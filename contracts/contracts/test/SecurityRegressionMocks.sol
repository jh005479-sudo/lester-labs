// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FeeOnTransferToken is ERC20 {
    uint256 public constant FEE_BPS = 1000;

    constructor(address recipient, uint256 supply) ERC20("Fee Token", "FEE") {
        _mint(recipient, supply);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * FEE_BPS) / 10_000;
        super._update(from, address(0), fee);
        super._update(from, to, value - fee);
    }
}
