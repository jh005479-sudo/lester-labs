# Token Vesting — Immutable Replacement and Legacy Release

> **Legacy deployment status:** the Vesting Factory at
> `0x6EE07118D39e9330Ef0658FFA797EeDD2CB823Cf` is a compromised legacy
> deployment. New schedules, deployment fees, and token approvals to the
> factory are disabled. Releases from source-authenticated historical vesting
> wallets remain available when tokens have vested.

New schedules use only the approved immutable factory at
`0x1808852Ce3EBbD2242174Eea672498a384108E2d` and its attested child runtime,
after chain-`4441`, target, spender, fee, and runtime checks pass.

## Historical behavior

The factory created OpenZeppelin-style VestingWallet children with a start
time, cliff, duration, initial beneficiary/owner, and funded ERC-20 allocation.
Vested tokens are released with `release(token)` to the vesting wallet's
current owner. Anyone may trigger that release.

The schedule has no factory-owner clawback, but the VestingWallet owner can
transfer ownership. “No clawback” therefore does not mean the recipient is
immutable. Replacing the factory does not migrate, cancel, or change an
existing child wallet.

## Existing-schedule recovery

1. Use only a child discovered through a source-pinned legacy factory and a
   reviewed child-runtime hash.
2. Read the current VestingWallet owner, schedule, token balance, released
   amount, and `releasable(token)` value.
3. Confirm the expected beneficiary controls the current owner address.
4. Review a zero-value `release(token)` call to the exact child wallet.
5. Verify the resulting token transfer independently after confirmation.

Do not approve tokens or create a schedule through the legacy factory. A
wallet that merely resembles OpenZeppelin VestingWallet is not sufficient
provenance.

## Historical fee

The legacy schedule-creation fee was `0.03 zkLTC`; never send it to the legacy
factory. The replacement uses the same amount as valueless testnet protocol fee.

## Approved replacement

The replacement freezes administrative ownership at the no-key `0x…01`
precompile and forwards schedule-creation fees directly to the disclosed
valueless test treasury, which has no admin role. The frontend requires exact
factory and child runtime hashes plus explicit chain/target/function/value/
spender checks. Existing children keep their own transferable beneficiary-owner
semantics.

Upstream OpenZeppelin review does not constitute an audit of the Lester factory,
its child configuration, or the deployment process.
