// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title LitGovToken — ERC20 with voting, delegation and permit (EIP-712)
 * @notice Governance token for the LitVM self-governance platform.
 *         Mintable by owner. Holders must delegate to accumulate voting power.
 */
contract LitGovToken is ERC20, ERC20Votes {
    /// @notice Address authorised to mint new tokens
    address public owner;

    /// @notice Token name and symbol
    string private _name     = "Lit Governance Token";
    string private _symbol   = "LGT";

    constructor() ERC20(_name, _symbol) EIP712(_name, "1") {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "LitGovToken: caller is not the owner");
        _;
    }

    /**
     * @notice Mint new tokens to a recipient
     * @param to      Recipient address
     * @param amount  Amount in raw token units (18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Batch mint — iterates internally
     * @param recipients List of recipients
     * @param amounts   Parallel list of amounts (same index)
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Arrays must match");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }

    /**
     * @notice Transfer ownership of minting rights
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "LitGovToken: zero address");
        owner = newOwner;
    }

    // ── ERC20Votes override ────────────────────────────────────────────

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }
}
