# Liquidity Locker

The Liquidity Locker holds LP tokens until a selected unlock timestamp.

## Contract

| Parameter | Value |
|---|---|
| Address | `0xEfE43FB51a3219B35Ffc30e508e14003752fc18f` |
| Lock fee | `0.03 zkLTC` |

## Create a lock

1. Select the LP token and amount.
2. Choose a future unlock date and the address that can withdraw.
3. Approve the locker for the LP-token amount.
4. Submit the lock transaction with the displayed fee.

Each lock receives a numeric ID. Store the ID or use the Locker interface to
find the associated record.

## Contract functions

| Function | Description |
|---|---|
| `lockLiquidity(lpToken, amount, unlockTime, withdrawer)` | Transfers LP tokens into a new lock and returns its ID |
| `getLock(lockId)` | Returns the token, amount, unlock time, withdrawer, and withdrawal state |
| `locks(lockId)` | Reads a lock from the public mapping |
| `lockCount()` | Returns the number of created locks |
| `lockFee()` | Returns the current lock fee |
| `withdraw(lockId)` | Releases a matured lock to its configured withdrawer |

`lockLiquidity` requires a positive amount, a future Unix timestamp, and a
nonzero withdrawer address. `withdraw` succeeds only after the unlock time and
can be called only by the configured withdrawer.

The contract emits `LockCreated` when a lock is opened and `LockWithdrawn` when
it is released.
