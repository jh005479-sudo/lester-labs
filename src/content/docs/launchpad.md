# Launchpad

The Launchpad creates token sales with configurable caps, pricing, timing,
whitelisting, liquidity allocation, and LP-token locking.

## Contracts

| Contract | Address |
|---|---|
| Launchpad Factory | `0x412e29e77500752A7B62489c0FaAE6560E8c4380` |
| DEX Connector | `0xbB4e527216ac0e0709Bf57ff718ca417ba85AaDF` |
| DEX Router | `0xf2CA3a3A42136Fd103346914A37b30f3991315EA` |

The creation fee is `0.03 zkLTC`. The sale platform fee is `2%` of the amount
raised. Liquidity allocation can be set from 50% to 100%, and the LP lock must
be at least 30 days.

## Create a sale

1. Select the sale token.
2. Enter the soft cap, hard cap, token rate, start time, and end time.
3. Select the liquidity percentage and LP-lock duration.
4. Choose whether a whitelist is required.
5. Submit `createILO` with the displayed fee.
6. Transfer the value returned by `tokensRequired()` to the new sale contract.

## Factory functions

| Function | Description |
|---|---|
| `createILO(token, softCap, hardCap, tokensPerEth, startTime, endTime, liquidityBps, lpLockDuration, whitelistEnabled)` | Creates a sale and returns its address |
| `creationFee()` | Returns the current creation fee |
| `platformFeeBps()` | Returns the platform fee in basis points |
| `getILOCount()` | Returns the number of sales |
| `allILOs(index)` | Returns a sale address by index |
| `getOwnerILOs(owner)` | Returns sales created by an address |

## Sale lifecycle

| Function | Caller and timing |
|---|---|
| `setWhitelist(users, status)` | Sale owner; updates whitelist access |
| `contribute()` | Participant; payable during the sale window |
| `finalize()` | Owner after completion, or anyone after the end when the soft cap was met |
| `claim()` | Participant after finalization |
| `refund()` | Participant after cancellation or a refundable failed sale |
| `cancel()` | Owner, or anyone after the end when the soft cap was not met |
| `claimLP()` | Sale owner after the LP lock expires |
| `sweepExcessETH()` | Sale owner after finalization |
| `sweepExcessTokens()` | Sale owner after finalization or failure |

## Sale view functions

The sale contract exposes its `token`, `softCap`, `hardCap`, `tokensPerEth`,
`startTime`, `endTime`, `liquidityBps`, `lpLockDuration`, `totalRaised`,
`finalized`, `cancelled`, `contributions(address)`, `whitelist(address)`,
`lpToken`, `lpTokensLocked`, `lpUnlockTime`, and `tokensRequired()` values.

During finalization, the connector adds DEX liquidity and sends the resulting
LP tokens to the sale contract for the configured lock duration.
