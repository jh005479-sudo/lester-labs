# Lester Labs Documentation — Current Security Status

> **Post-compromise containment is active.** The former build machine, deployer,
> controller, treasury, and legacy deployment set are not trusted for new
> activity. Ordinary writes remain disabled until replacements are built on a
> clean runner, independently attested, deployed from distinct fresh roles, and
> pinned with their exact runtime hashes in reviewed source.

Lester Labs is independent testnet software for LitVM LiteForge (chain ID
`4441`). It is not operated by LitVM or Litecoin, does not run a reward or
eligibility programme, and does not ask for seed phrases, private keys, wallet
passwords, or opaque signatures.

## What is available now

| Surface | Current posture |
|---|---|
| Explorer, analytics, charts | Read-only, explicitly bounded RPC samples; not complete indexes |
| Token Factory | Legacy factory is read-only; new token creation disabled |
| DEX Swap & Pool | New swaps, wrapping, pool creation, and liquidity additions disabled; narrowly authenticated legacy withdrawal paths only |
| Liquidity Locker | New locks disabled; authenticated matured legacy withdrawals remain available |
| Token Vesting | New schedules disabled; authenticated releases from known legacy vesting wallets remain available |
| Airdrop Tool | Local list validation remains useful; distribution and approval writes disabled until replacement activation |
| Launchpad | Historical discovery plus state-dependent cancellation, refund, claim, LP, and excess-asset recovery; creation, funding, contribution, whitelist changes, and finalization disabled |
| The Ledger | Historical messages are readable; paid posting disabled |
| Governance | Legacy token, governor, and timelock are retired and read-only; no governance writes |

The interface must not be used to bypass a disabled action. A direct call to a
legacy contract is not safer merely because the function remains callable
on-chain.

## Replacement role separation

The replacement deployment requires three distinct fresh public addresses:

- **Controller:** administrative and emergency authority, preferably a
  hardware-backed multisig. It must not receive routine application fees.
- **Treasury:** fee recipient, preferably a separate multisig. It must not hold
  general controller authority merely because it receives fees.
- **Single-use gas deployer:** a fresh EOA used only to broadcast the attested
  deployment sequence, then retired. It must be distinct from both controller
  and treasury.

No replacement address is approved yet. The formerly compromised controller
and the address derived from the publicly disclosed test key are both rejected
for every role.

## Two independent release gates

Ordinary writes may resume only after **both** gates pass. Neither gate is
evidence that the other has passed.

### Gate A — compromised authority and control-plane recovery

1. Fresh controller, treasury, and single-use deployer addresses are generated
   on a separately trusted device and source-pinned.
2. Compromised deployer, controller, treasury, hosting, DNS, CI, and repository
   credentials are revoked or rotated, and the resulting authority graph is
   independently checked.
3. Deployment artifacts, constructor arguments, creation transaction hashes,
   runtime bytecode hashes, and final role assignments match the independently
   stored attestation.

### Gate B — malicious-flag, source, runtime, and served-build remediation

1. The warning is reproduced and its trigger evidence is preserved; misleading
   claims, unsafe wallet prompts, hidden redirects, and unbounded or fabricated
   analytics are removed or explicitly constrained.
2. Replacement contracts and the frontend are compiled from a clean immutable
   commit in an ephemeral environment with pinned tool and compiler digests.
3. The served website assets reproduce from reviewed source, exact contract
   runtimes match the attestation, and no mutable hosting variable can redirect
   an RPC, contract target, spender, or treasury.
4. Every enabled write has an explicit target, function, native-value, spender,
   and runtime allowlist and fails closed when a check cannot be completed.

A fresh authority set does not prove the source or served site is clean, and a
clean build does not remove compromised authority. A MetaMask or other
reputation appeal is submitted only after both gates pass and the clean
production origin is rechecked.

Source availability, upstream OpenZeppelin or Uniswap ancestry, and a package
audit with no known advisory are each useful evidence, but none is an audit or
proof of safety on its own.

## Historical activity continuity

The homepage preserves a first-party provisional snapshot at LitVM block
`36,723,038` (block hash
`0x137d1e60f771a7686ed81f77bcf8c4f4a71e6af7bb96620eda11e34031534552`).
Those counts describe contract events or entries under documented counting
rules. They are not independently verified counts of unique wallets or people; repeated, automated, spam, and
duplicate-recipient activity may be included. Post-replacement values may be
added only from authenticated monotonic counters or documented source-pinned
event ranges.

## Network configuration

| Parameter | LitVM LiteForge |
|---|---|
| Chain ID | `4441` |
| RPC URL | `https://liteforge.rpc.caldera.xyz/http` |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Native test gas | `zkLTC` |

Cross-check these values against LitVM's independently located official
documentation. Testnet zkLTC has no represented monetary value on this site.

## Legacy address policy

Legacy addresses are retained in reviewed source only where needed for
historical reads or recovery. They are not “canonical,” “current,” or approved
for new activity. Exact addresses, retirement blocks, runtime hashes, and
recovery boundaries are maintained in the source-pinned contract registry and
post-compromise deployment evidence; do not substitute an address from a chat
message, social post, search result, or mutable environment variable.

Always verify chain ID `4441`, the exact target, function, native value, token
spender, allowance, recipient, and decoded parameters before signing a recovery
transaction.

## Support

- Security status: [lester-labs.com/security](https://www.lester-labs.com/security)
- X: [@lesterlabshq](https://x.com/lesterlabshq)
- Website: [www.lester-labs.com](https://www.lester-labs.com)
