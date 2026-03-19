# Token Vesting

## Overview

Token Vesting creates on-chain vesting schedules for team allocations, investor distributions, and advisor grants. Tokens are locked in a contract and released to a beneficiary address according to a defined schedule — either linear (gradual release over time) or cliff+linear (nothing until a date, then gradual release).

## How it works

You deploy a vesting contract specifying the beneficiary, schedule parameters, and token amount. Tokens are transferred into the contract at creation and held until they vest. The beneficiary can call `claim()` at any time to withdraw whatever has vested so far. The deployer has no ability to claw back tokens once the contract is funded — this is by design and is what makes vesting credible to investors and communities.

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
11. Sign the deployment transaction — the vesting contract is live

The beneficiary can claim their vested tokens from the Vesting page at any time.

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

## Smart contract

- **Forked from:** OpenZeppelin VestingWallet
- **Contract address:** `Pending deployment`

**Key functions:**
- `constructor(beneficiary, startTimestamp, cliffDuration, vestingDuration)` — deploys schedule
- `release(token)` — transfers all vested-but-unclaimed tokens to beneficiary (callable by anyone)
- `vestedAmount(token, timestamp)` — returns total tokens vested as of a given timestamp
- `releasable(token)` — returns tokens available to claim right now

## Security

Forked from OpenZeppelin VestingWallet, part of the OpenZeppelin contracts library that has been formally audited and maintained since 2018. The contract has no owner-controlled pause or claw-back mechanism — once tokens are deposited, they will vest according to the schedule regardless of the deployer's actions. This immutability is intentional and is the property that makes vesting schedules trustworthy.
