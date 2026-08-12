# Token Vesting

The Vesting Factory creates token schedules with a start time, cliff, and
linear release period.

## Contract

| Parameter | Value |
|---|---|
| Vesting Factory | `0x1808852Ce3EBbD2242174Eea672498a384108E2d` |
| Schedule fee | `0.03 zkLTC` |

## Create a schedule

1. Select an ERC-20 token and beneficiary.
2. Enter the total token amount.
3. Choose the start time, cliff duration, and vesting duration.
4. Approve the factory for the total token amount.
5. Submit the schedule transaction with the displayed fee.

The factory deploys a dedicated vesting contract and transfers the approved
tokens into it. Vesting begins after the configured start and cliff, then
progresses linearly for the remaining duration.

## Factory functions

| Function | Description |
|---|---|
| `createVestingSchedule(token, beneficiary, totalAmount, startTime, cliffDuration, vestingDuration, revocable)` | Creates and funds a schedule |
| `vestingFee()` | Returns the current schedule fee |
| `scheduleCount()` | Returns the number of schedules created by the factory |

The current vesting implementation is non-revocable. The `revocable` argument
is accepted for interface compatibility but does not change on-chain behavior.

## Vesting contract functions

| Function | Description |
|---|---|
| `start()` | Returns the vesting start timestamp, including the cliff offset |
| `duration()` | Returns the linear vesting duration after the cliff |
| `vestedAmount(token, timestamp)` | Returns the amount vested at a timestamp |
| `releasable(token)` | Returns the token amount currently available |
| `released(token)` | Returns the token amount already released |
| `release(token)` | Transfers the currently releasable amount to the beneficiary |

The factory emits `VestingCreated(vestingId, vestingWallet, beneficiary)` when
a schedule is created.
