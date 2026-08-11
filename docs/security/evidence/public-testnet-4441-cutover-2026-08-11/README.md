# Public-testnet immutable replacement and analytics cutover — 2026-08-11

This directory binds the exact 2026-08-06 chain-4441 replacement deployment to
the later public-testnet activation decision and historical analytics floor. It
is evidence for a valueless `public-testnet-immutable` release only, never a
real-value production authority model.

## Verified facts

- Chain: LitVM LiteForge `4441`
- Cutover block: `38,999,871`
- Cutover block hash:
  `0x0f08a4e58106a4cd465555c5a3b0a2bf44e723277ff69f0a6c0b22de3c77c9da`
- Deployment manifest SHA-256:
  `ab5b035f537ee29f354ac3c6ef08c8c19f726058e8e776bf65ea4a950528a2eb`
- Attested source commit:
  `abcf1b75ee7945f557163dce11485555da63a5b6`
- Controller: `0x0000000000000000000000000000000000000001`
  (ECRECOVER precompile; no administrative private key)
- Treasury/gas EOA: the publicly disclosed valueless test wallet recorded in
  the manifest; it has no contract-administration role
- Replacement counters at cutover: all five zero
- RPC origins: `liteforge.rpc.caldera.xyz` and `rpc.lite-node.com`

The two-RPC verifier checked chain and block identity, the deterministic CREATE
sequence, all thirteen creation transactions and successful receipts, runtime
hashes and byte lengths, frozen authority and treasury bindings, and zero
replacement counters.

## Historical continuity floor

Legacy/display activity is frozen through the cutover block at 517,422 token
deployments, 16,433 airdrop recipient entries, 8,511 presales, 12,975 displayed
swap actions, and 66,832 Ledger messages. These are published counting records,
not unique-user or value claims. Only authenticated replacement counters from
block `38,999,872` onward are added. Later legacy activity is excluded so that
the old and new ranges cannot overlap.

## DEX fee disclosure

The immutable replacement pair is a Lester-specific fork, not canonical
Uniswap V2 fee routing. A successful swap sends `0.20%` of each measured input
to the fixed test treasury and retains approximately `0.10%` in-pool, while the
router quotes an effective `997/1000` input factor. This transparent extra
recipient can resemble a transaction-scanner drainer heuristic. The recipient
cannot be redirected because `feeToSetter` is frozen at the precompile address.

## Evidence digests

| File | Raw SHA-256 | Purpose |
|---|---|---|
| `cutover-candidate.json` | `0bcac0b5b065891c6828066a17bb79284097ada6ac4fcd96375116ab77bd28ed` | Exact-block counters, sources, methods, and warnings |
| `cutover-second-rpc-proof.json` | `2d304713cce21b85cd058b6bdb188ddfc0201bc2a9d45b15374521900c0ad8f1` | Independent block/runtime/counter repeat |
| `replacement-live-verification.json` | `c555d71e66512f01b67560b8dcd468146e01c58493c1011571e2d1877ed6f6b6` | Two-RPC deployment, runtime, authority, and counter report |

The canonical cutover candidate payload SHA-256 is
`c723165e6825ff2429ec1afe1af039905eaa43cdd082161bdf652cefe8fdcbfa`.
The canonical live-verification report SHA-256 is
`e7e631a71a47926537f30d56be0aa66999ba2898a1cbab967eb7a383328e4ecd`.
The complete public-testnet approval package is source-pinned at
`src/config/approvedPublicReplacement.json` and is recomputed by
`scripts/security/verify-approved-public-testnet-replacement.mjs`.

## Scope boundary

The repository-owner's testnet exception does not require Safe addresses or two
independent reviewer identities because this stack is immutable and its assets
are functionally valueless. The disclosed treasury can spend accumulated test
gas, and anyone with the disclosed key can race future transactions from that
EOA. Neither fact grants authority over these already deployed contracts.

A future real-value release still requires distinct reviewed Safe controller
and treasury authorities, a different single-use gas EOA, recovered registrar,
DNS, hosting, and repository accounts, and independent release review.
