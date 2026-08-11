# The Ledger — Historical Reads and Replacement Readiness

> **Current status:** the Ledger at
> `0xa37fF4bAb59A5F861B48527A946C433dc1Ee8079` is a compromised legacy
> deployment. Historical messages can be sampled and exact transactions can be
> looked up, but paid posting is disabled. Do not call `post()` directly or send
> zkLTC to this contract.

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

## Replacement design

The prepared replacement keeps the **controller** and **treasury** distinct:
the controller manages the limited administrative settings, while the treasury
receives the configured fee share directly. The remaining contract share can
be withdrawn only to that same pinned treasury. A separate single-use gas EOA
deploys the attested artifact.

Posting may resume only after the exact runtime, role graph, fee behavior,
frontend target/function/value allowlist, and clean served build are verified.
Historical counts remain first-party activity records, not counts of distinct
authors, wallets, or people.
