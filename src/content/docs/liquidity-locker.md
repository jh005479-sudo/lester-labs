# Liquidity Locker

## Overview

The Liquidity Locker allows project teams to lock LP tokens for a defined period, providing a verifiable on-chain commitment that liquidity will not be removed. It is the standard trust mechanism used by projects to demonstrate long-term intent to their communities.

## How it works

You deposit LP tokens into the locker contract along with an unlock timestamp. The contract holds the tokens until the unlock date, at which point only the original depositor can withdraw them. Lock duration can be extended at any time but cannot be shortened — this is enforced at the contract level, not by policy. A public record of all active locks is queryable on-chain.

## Step-by-step guide

1. Connect your wallet and switch to LitVM network
2. Navigate to Liquidity Locker
3. Paste the LP token contract address (obtain from the DEX where you created the pair)
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

Fee is non-refundable. Sent to Lester-Labs treasury at lock time. Extending an existing lock does not incur an additional fee.

## Smart contract

- **Forked from:** Unicrypt UNCX Liquidity Locker
- **Contract address:** `Pending deployment`

**Key functions:**
- `lockLPToken(token, amount, unlockDate, owner)` — creates a new lock
- `extendLock(lockId, newUnlockDate)` — extends an existing lock (owner only, cannot shorten)
- `withdraw(lockId)` — withdraws locked LP tokens after unlock date (owner only)
- `getLock(lockId)` — returns lock details (token, amount, unlock date, owner)
- `getLocksForToken(token)` — returns all locks for a specific LP token

## Sources

- [Unicrypt UNCX Locker](https://github.com/UNCLE-NC/UNCLE-NC-LOCKER/blob/main/contracts/UNCXLocker.sol)

## Security

Forked from Unicrypt UNCX Locker, the most widely used LP locking contract in DeFi with billions of dollars locked across BSC, Ethereum, and multiple other chains. The key security property is that the unlock date cannot be shortened after locking — this is enforced in the contract, not as a UI restriction. Only the original depositor address can withdraw after the unlock date. No admin override exists.
