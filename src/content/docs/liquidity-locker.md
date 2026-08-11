# Liquidity Locker — Legacy Withdrawal and Replacement Readiness

> **Current status:** the locker at
> `0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9` is a compromised legacy
> deployment. New locks and token approvals to that locker are disabled. A
> narrowly authenticated withdrawal may remain available for an existing,
> matured lock when the connected wallet is the recorded withdrawer.

## Historical lock behavior

A lock record contains an LP-token address, amount, unlock timestamp,
withdrawer, and withdrawal state. The reviewed legacy implementation has no
setter to change the recorded withdrawer or shorten/edit the timestamp after
creation. Only the recorded withdrawer can withdraw after the timestamp.

That limited property does not make the factory safe for new deposits. Its
owner and fee path were compromised, and an LP token itself may represent an
unsafe or retired DEX pair.

## Existing-lock recovery

1. Open the source-pinned locker view; never paste a locker address supplied by
   a message or mutable environment value.
2. Verify the exact locker runtime hash and the lock record's token,
   withdrawer, amount, unlock time, and unwithdrawn state.
3. Verify the connected wallet exactly matches the recorded withdrawer.
4. If the lock is mature, review a `withdraw(lockId)` transaction with no native
   value and the expected locker as its target.
5. After confirmation, verify the token transfer and updated withdrawal state
   on an independently selected explorer or RPC.

Do not grant a new LP-token allowance or create a new lock on the legacy
deployment. If a position is not present in the source-pinned recovery
registry, the application must not construct a recovery transaction for it.

## Historical fee

The legacy lock fee was `0.03 zkLTC`. It is not a current service offer. The
legacy contract accrued fees for its compromised owner.

## Replacement design

The prepared replacement separates:

- the **controller**, which holds limited administrative authority; and
- the **treasury**, which receives the creation fee directly.

It must be deployed by a third, single-use gas EOA and activated only after
constructor inputs, runtime bytecode, role assignments, and the frontend write
allowlist are independently attested. Replacement activation does not migrate
or rewrite old lock records; historical recovery remains tied to the exact
legacy contract that holds the LP tokens.

Upstream Unicrypt-style inspiration is not an audit of either deployment.
