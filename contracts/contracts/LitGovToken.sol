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
    uint256 public constant INITIAL_SUPPLY = 10_000_000 ether;

    /// @notice Address authorised to mint new tokens
    address public owner;
    address public immutable deploymentSigner;
    address public immutable initialHolder;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner, address _initialHolder)
        ERC20("Lit Governance Token", "LGT")
        EIP712("Lit Governance Token", "1")
    {
        require(initialOwner != address(0), "LitGovToken: zero owner");
        require(_initialHolder != address(0), "LitGovToken: zero holder");
        require(initialOwner != msg.sender && _initialHolder != msg.sender, "LitGovToken: deployer control");
        require(initialOwner != _initialHolder, "LitGovToken: roles must differ");
        deploymentSigner = msg.sender;
        initialHolder = _initialHolder;
        owner = initialOwner;
        _mint(_initialHolder, INITIAL_SUPPLY);
        _delegate(_initialHolder, _initialHolder);
        emit OwnershipTransferred(address(0), initialOwner);
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
        require(recipients.length <= 200, "batchMint: max 200 recipients");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }

    /**
     * @notice Transfer ownership of minting rights
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "LitGovToken: zero address");
        require(newOwner != deploymentSigner, "LitGovToken: deployer control");
        require(newOwner != initialHolder, "LitGovToken: roles must differ");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    // ── ERC20Votes override ────────────────────────────────────────────

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }
}
