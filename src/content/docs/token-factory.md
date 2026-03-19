# Token Factory

## Overview

The Token Factory allows anyone to deploy a standard ERC-20 token on LitVM in a single transaction — no Solidity knowledge required. Configure name, symbol, supply, and optional mint/burn capabilities, then deploy directly to the chain.

## How it works

The factory deploys a new ERC-20 contract on your behalf, minting the full supply to your wallet at deployment. The contract follows the OpenZeppelin ERC-20 standard exactly — no modifications. If mintable is enabled, only the deploying address can mint additional supply. If burnable is enabled, any holder can burn their own tokens.

## Step-by-step guide

1. Connect your wallet and switch to LitVM network
2. Navigate to Token Factory
3. Enter token name (e.g. "My Project Token")
4. Enter token symbol (e.g. "MPT")
5. Set total supply (e.g. 1,000,000,000)
6. Set decimals (default: 18 — change only if you have a specific reason)
7. Toggle mintable and/or burnable if required
8. Review the fee (0.05 zkLTC) and confirm
9. Sign the transaction — your token contract is deployed instantly
10. Copy the contract address from the confirmation screen

## Parameters

| Field | Description | Constraints |
|---|---|---|
| Name | Full token name | 1–50 characters |
| Symbol | Ticker symbol | 1–8 characters, uppercase |
| Total Supply | Initial supply minted to deployer | Must be > 0 |
| Decimals | Token decimal places | Default 18; range 0–18 |
| Mintable | Owner can mint additional supply | Boolean |
| Burnable | Holders can burn their own tokens | Boolean |

## Fee structure

| Fee | Amount | When charged |
|---|---|---|
| Deployment fee | 0.05 zkLTC | At transaction confirmation |

Fee is non-refundable. Sent to Lester-Labs treasury at deployment.

## Smart contract

- **Forked from:** OpenZeppelin ERC-20 (v5.x)
- **Contract address:** `Pending deployment`

**Key functions:**
- `constructor(name, symbol, supply, decimals, mintable, burnable)` — deploys token with specified parameters
- `mint(address, amount)` — mint additional tokens (owner only, if mintable enabled)
- `burn(amount)` — burn caller's own tokens (if burnable enabled)
- `transfer(address, amount)` — standard ERC-20 transfer
- `approve(address, amount)` — standard ERC-20 approval

## Security

Forked 1:1 from OpenZeppelin ERC-20, the most widely deployed and audited token standard in existence. OpenZeppelin contracts have secured trillions of dollars in value across thousands of deployments. No custom logic has been added. The Lester-Labs factory is a thin wrapper that calls the standard constructor — the deployed token contract is identical to any OpenZeppelin ERC-20.
