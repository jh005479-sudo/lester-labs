# Liquidity Locker

## Overview

The Liquidity Locker allows project teams to lock LP tokens for a defined period, providing a verifiable on-chain commitment that liquidity will not be removed. It is the standard trust mechanism used by projects to demonstrate long-term intent to their communities.

## How it works

You deposit LP tokens into the locker contract with an unlock timestamp and an
explicit withdrawer address. The contract holds the tokens until the unlock
date, when only that withdrawer can claim them. The deployed contract has no
function to change the withdrawer or edit/extend the timestamp after creation.
Each lock is publicly readable by ID.

## Step-by-step guide

1. Connect your wallet and switch to LitVM network
2. Navigate to Liquidity Locker
3. Paste the LP token contract address (from the Lester Labs DEX, the Launchpad finalize flow, or another compatible V2 pair)
4. Enter the amount of LP tokens to lock
5. Select the unlock date
6. Review the fee (0.03 zkLTC) and confirm
7. Approve the LP token spend when prompted
8. Sign the lock transaction
9. Your lock is live — share the lock record URL with your community

## Parameters

| Field | Description | Constraints |
|---|---|---|
| LP Token Address | Contract address of the LP token | Must be a valid ERC-20 |
| Amount | Quantity of LP tokens to lock | Must be > 0 and ≤ your balance |
| Unlock Date | Date/time when tokens become withdrawable | Must be at least 1 day in the future |

## Fee structure

| Fee | Amount | When charged |
|---|---|---|
| Lock fee | 0.03 zkLTC | At lock confirmation |

The fee is non-refundable and accrues in the locker until its owner withdraws
it. The frontend reads the live locker owner when the form loads and again
immediately before the paid lock write; creation is disabled unless that owner
is the approved treasury controller.

## Smart contract

- **Forked from:** Unicrypt UNCX Liquidity Locker
- **Contract address:** `0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9`

**Key functions:**
- `lockLiquidity(token, amount, unlockTime, withdrawer)` — creates a new lock
- `withdraw(lockId)` — sends locked LP tokens to the recorded withdrawer after unlock
- `getLock(lockId)` — returns token, amount, unlock time, withdrawer, and withdrawal state

## Sources

- [Unicrypt UNCX Locker](https://github.com/UNCLE-NC/UNCLE-NC-LOCKER/blob/main/contracts/UNCXLocker.sol)

## Security

The lock record's timestamp and withdrawer have no setters, and the factory
owner cannot withdraw user lock principal. Only the recorded withdrawer can
withdraw after the timestamp. Choose that address carefully: it need not equal
the depositor and cannot be corrected later. Upstream inspiration is not an
audit of this deployment.
