# Token Vesting

## Overview

Token Vesting creates on-chain vesting schedules for team allocations, investor distributions, and advisor grants. Tokens are locked in a contract and released to a beneficiary address according to a defined schedule — either linear (gradual release over time) or cliff+linear (nothing until a date, then gradual release).

## How it works

You deploy a vesting wallet specifying the initial beneficiary, schedule parameters, and token amount. Tokens are transferred into the vesting wallet at creation and held until they vest. Claims follow the OpenZeppelin VestingWallet model: vested tokens are released from the vesting wallet on demand via `release(token)`. The schedule has no clawback, but the beneficiary is the wallet's initial Ownable owner and can transfer ownership; future releases follow the current owner.

## Step-by-step guide

1. Connect your wallet and switch to LitVM network
2. Navigate to Token Vesting
3. Enter the beneficiary wallet address
4. Select the token to vest
5. Enter the total amount to vest
6. Set the start date
7. Set cliff period (optional — leave 0 for no cliff)
8. Set total vesting duration
9. Review the fee (0.03 zkLTC) and confirm
10. Approve the token spend when prompted
11. Sign the deployment transaction — the vesting wallet is live

Share the resulting vesting wallet address with the beneficiary. Once tokens are vested, anyone can call `release(token)` on that vesting wallet for them.

## Parameters

| Field | Description | Constraints |
|---|---|---|
| Beneficiary | Wallet address that receives tokens | Valid address |
| Token | ERC-20 token to vest | Must be a valid token contract |
| Amount | Total tokens to vest | Must be > 0 |
| Start Date | When vesting begins | Can be in the future |
| Cliff Period | Period before any tokens vest | 0 for no cliff; must be < total duration |
| Total Duration | Full vesting period from start | Must be > cliff period |

**Example:** 1,000,000 tokens, 6-month cliff, 24-month total duration → zero tokens claimable for first 6 months (cliff), then linear release of ~55,556 tokens per month for the remaining 18 months (1,000,000 ÷ 18).

**Note:** During the cliff period, tokens accumulate but cannot be claimed. On the first day after the cliff, the full cliff-period accumulation becomes claimable at once.

## Fee structure

| Fee | Amount | When charged |
|---|---|---|
| Schedule creation fee | 0.03 zkLTC | At contract deployment |

Fee is non-refundable. One fee per vesting schedule regardless of token amount or duration.

Before approval/deployment, the frontend reads the live VestingFactory owner
and repeats that check immediately before the paid write. Creation is disabled
unless the factory owner is the approved treasury controller.

## Smart contract

- **Forked from:** OpenZeppelin VestingWallet
- **Contract address:** `Pending deployment`

**Key functions:**
- `constructor(beneficiary, startTimestamp, cliffDuration, vestingDuration)` — deploys schedule
- `release(token)` — transfers all vested-but-unclaimed tokens to the vesting wallet's current owner (callable by anyone)
- `vestedAmount(token, timestamp)` — returns total tokens vested as of a given timestamp
- `releasable(token)` — returns tokens available to claim right now

## Sources

- [OpenZeppelin VestingWallet](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/finance/VestingWallet.sol)

## Security

The implementation uses OpenZeppelin VestingWallet. It has no owner-controlled
pause or clawback mechanism, so deposited tokens continue vesting on schedule.
Ownership is nevertheless transferable by the current beneficiary; “no
clawback” must not be confused with an immutable recipient. Upstream
OpenZeppelin review is not an audit of Lester Labs' factory or deployment.
