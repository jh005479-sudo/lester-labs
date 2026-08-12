# Airdrop Tool

The Airdrop Tool distributes native `zkLTC` or ERC-20 tokens to multiple
recipients in a single transaction.

## Contract

`0x80Cc00444Ac78959520052A3333184C5E81B0EA5`

## Prepare a distribution

Recipient data can be entered directly or imported as CSV rows in the format:

```text
address,amount
0x1234...,10.5
0xabcd...,25
```

The interface validates addresses and amounts, displays the total, and splits
lists longer than 200 entries into separate transactions.

## Contract functions

| Function | Description |
|---|---|
| `disperseEther(recipients, values)` | Sends native `zkLTC` values to up to 200 recipients |
| `disperseToken(token, recipients, values)` | Transfers an ERC-20 token to up to 200 recipients |
| `totalRecipientEntries()` | Returns the number of successfully processed recipient entries |
| `MAX_RECIPIENTS()` | Returns the maximum batch size (`200`) |

The `recipients` and `values` arrays must have the same length. Addresses must
be nonzero and every amount must be greater than zero.

For ERC-20 distributions, approve the Disperse contract for the exact batch
total before calling `disperseToken`. Native distributions must attach a value
equal to the sum of the `values` array.
