# The Ledger — Immutable Replacement and Historical Reads

> **Legacy deployment status:** the Ledger at
> `0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079` is a compromised legacy
> deployment. Historical messages can be sampled and exact transactions can be
> looked up, but paid posting is disabled. Do not call `post()` directly or send
> zkLTC to this contract.

New testnet posts use only the approved immutable Ledger at
`0xEdf195A557EaAE7829f867d6f84316908A65D9B1`, after chain-`4441`, target,
runtime, message, and native-value checks pass.

## What the legacy contract recorded

A successful `post(message)` transaction placed ABI-encoded message bytes in
transaction input data and emitted a `MessagePosted` event. Confirmed chain
data cannot be edited through the Ledger contract. Availability and retention
still depend on the testnet and on an RPC, archive, or explorer retaining the
relevant history; the website does not promise perpetual availability.

The Lester feed is a paginated RPC/event view. It is not a complete archive,
moderated record, or proof that a message is accurate or endorsed. Anyone could
post arbitrary content from any wallet.

## Reading historical messages

- A wallet is not required to read the sampled feed.
- Verify the sender, exact Ledger target, block, transaction status, input data,
  and event log before attributing a message.
- Use an exact transaction hash on an independently selected RPC or explorer
  when completeness matters.
- Do not infer identity, authorship beyond the sending address, or Lester Labs
  endorsement from an on-chain message.

## Historical fee and roles

The legacy minimum fee was `0.01 zkLTC`. Its owner could change that fee and
the treasury destination. The legacy configuration split value between a
treasury transfer and contract-held balance; both mutable control and fee
routing were compromised. This is why checking only `owner()` or only
`treasury()` would be insufficient.

## Approved replacement

The replacement freezes its controller at the no-key `0x…01` precompile. The
disclosed valueless test treasury receives the configured direct share and is
the only destination for the contract-held share; it has no admin role. There
is no upgrade path or arbitrary withdrawal recipient.

Posting is available only when the exact runtime, role graph, fee behavior, and
frontend chain/target/function/value allowlist are verified.
Historical counts remain first-party activity records, not counts of distinct
authors, wallets, or people.
