# LitVM Airdrop Tool — Batch Token Distribution on LitVM

## Overview

The LitVM Airdrop Tool validates recipient lists locally and distributes ERC-20 tokens or native zkLTC in bounded batches. Each batch is a separate wallet-confirmed transaction, and confirmed hashes are retained locally so an interrupted run can resume from the first unconfirmed batch.

## How it works

The tool calls the Lester Labs Disperse deployment. ERC-20 mode first requests an exact token allowance; native mode sends the batch total with the call. Transfers are atomic within each individual batch, while separate batches remain independent transactions.

## Step-by-step guide

1. Connect your wallet and switch to LitVM network
2. Navigate to Airdrop Tool
3. Select token to distribute (or choose native zkLTC)
4. Paste your recipient list — one address and amount per line, or upload a CSV
5. Review the parsed list and verify totals
6. Approve the token spend (ERC-20 only — not required for native zkLTC)
7. Confirm each bounded batch and wait for its receipt before continuing
8. Keep the transaction hashes as the proof and recovery record for the distribution

## Parameters

| Field | Description | Constraints |
|---|---|---|
| Token | ERC-20 contract address, or native zkLTC | Valid token or native |
| Recipient List | Addresses + amounts | Up to 200 per batch; amounts in displayed token units |

**CSV format:**
```
0xAddress1,1000
0xAddress2,2500
0xAddress3,500
```

Lists over 200 valid recipients are split automatically. Each batch is a separate transaction and consumes network gas.

## Fee structure

| Fee | Amount | When charged |
|---|---|---|
| Platform batch fee | None currently enforced | Network gas still applies to every approval and batch transaction |

## Smart contract

- **Forked from:** Disperse.app
- **Contract address:** `0x3cc66cb4713dca78564df512922adb331ac5ee04`

**Key functions:**
- `disperseToken(token, recipients[], amounts[])` — distribute ERC-20 tokens to multiple addresses
- `disperseEther(recipients[], amounts[])` — distribute native zkLTC to multiple addresses

## Sources

- [Disperse.app](https://github.com/Dispersao/disperse-contracts/blob/master/contracts/Disperse.sol)

## Security

The source follows the small Disperse pattern and has no owner-controlled recipient list. Lester Labs itself is an unaudited testnet deployment. Verify every recipient and amount before signing: a confirmed batch is irreversible even if a later batch fails.
