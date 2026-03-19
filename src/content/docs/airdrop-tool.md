# Airdrop Tool

## Overview

The Airdrop Tool distributes tokens to hundreds of addresses in a single transaction. Paste a list of addresses and amounts, confirm once, and all recipients receive their allocation simultaneously. Supports both ERC-20 tokens and native zkLTC.

## How it works

Built on the Disperse contract — approximately 50 lines of audited Solidity that have processed billions of dollars in distributions across Ethereum and EVM chains. You pre-approve the contract to spend your tokens, then call a single function with the full recipient list. All transfers execute atomically: either every recipient receives their amount, or the entire transaction reverts.

## Step-by-step guide

1. Connect your wallet and switch to LitVM network
2. Navigate to Airdrop Tool
3. Select token to distribute (or choose native zkLTC)
4. Paste your recipient list — one address and amount per line, or upload a CSV
5. Review the parsed list and verify totals
6. Approve the token spend (ERC-20 only — not required for native zkLTC)
7. Review the fee (0.01 zkLTC per batch) and confirm
8. Sign the transaction — all transfers execute in one block

## Parameters

| Field | Description | Constraints |
|---|---|---|
| Token | ERC-20 contract address, or native zkLTC | Valid token or native |
| Recipient List | Addresses + amounts | Up to 500 per batch; amounts in token units |

**CSV format:**
```
0xAddress1,1000
0xAddress2,2500
0xAddress3,500
```

For distributions over 500 addresses, split into multiple batches. Each batch is a separate transaction and incurs a separate fee.

## Fee structure

| Fee | Amount | When charged |
|---|---|---|
| Batch fee | 0.01 zkLTC | Per batch (up to 500 addresses) |

Example: 1,200 addresses = 3 batches = 0.03 zkLTC total.

## Smart contract

- **Forked from:** Disperse.app
- **Contract address:** `Pending deployment`

**Key functions:**
- `disperseToken(token, recipients[], amounts[])` — distribute ERC-20 tokens to multiple addresses
- `disperseEther(recipients[], amounts[])` — distribute native zkLTC to multiple addresses

## Security

Forked from Disperse.app — one of the most widely used distribution contracts in DeFi, deployed and operational on Ethereum mainnet since 2018 without incident. The contract is ~50 lines with no owner functions, no upgradability, and no admin controls. Transfers are atomic: if any individual transfer fails, the entire batch reverts and no tokens are distributed. Always verify your recipient list before signing — distributions cannot be reversed once confirmed.
