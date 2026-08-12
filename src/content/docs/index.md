# Lester Labs Documentation — Security and Release Status

> **An immutable replacement stack is approved for the valueless LitVM
> LiteForge public testnet.** The legacy deployment remains permanently
> contained for new activity. The replacement can be served only from the exact
> source-pinned frontend after its build and apex/`www` artifacts pass parity.

Lester Labs is independent testnet software for LitVM LiteForge (chain ID
`4441`). It is not operated by LitVM or Litecoin, does not run a reward or
eligibility programme, and does not ask for seed phrases, private keys, wallet
passwords, or opaque signatures. Testnet zkLTC and app assets have no represented
monetary value on this site.

## Public-testnet authority model

This bounded testnet release deliberately does not use production Safes or an
independent-reviewer gate:

- every contract administrator and all governance voting power are frozen at
  `0x0000000000000000000000000000000000000001`, the ECRECOVER precompile, for
  which no private key exists;
- the disclosed valueless test wallet is the deployment gas payer and fee
  treasury, but has no contract-administration role;
- the contracts are immutable and the frontend accepts writes only on chain
  `4441` to source-pinned addresses with attested runtime bytecode; and
- governance writes remain disabled because the frozen authority model makes
  the deployed governance path intentionally non-operational.

The disclosed wallet is not approved for real value or production. A future
production release still requires separate reviewed controller and treasury
Safes, a distinct one-use gas EOA, recovered accounts, and independent review.

## Current surface posture

| Surface | Public-testnet posture |
|---|---|
| Explorer, analytics, charts | Read-only, explicitly bounded RPC samples; not complete indexes |
| Token Factory, Vesting, Locker, Airdrop, Ledger | Approved immutable replacement targets; paid calls show exact target/value and enforce chain `4441` |
| DEX Swap & Pool | Approved immutable replacement for new testnet activity; legacy tuple remains recovery-only |
| Launchpad | Approved immutable replacement for new activity; legacy discovery and source-pinned recovery remain separate |
| Governance | Replacement governance is intentionally disabled; legacy governance remains retired and read-only |

The interface must not be used to bypass a disabled action. A direct call to a
legacy contract is not safer merely because the function remains callable
on-chain.

## Two related remediation tracks

### Testnet contract and authority remediation

The replacement deployment is bound to source commit
`abcf1b75ee7945f557163dce11485555da63a5b6`, exact creation transactions,
runtime hashes, constructor inputs, roles, and child-runtime attestations.
Two credential-free RPC origins independently confirmed the deployment state,
frozen controller, test treasury, and zero replacement counters at the cutover
block. The checked-in approval package is recomputed during every release build.

### Malicious-warning and served-site remediation

The source review removed misleading claims, mutable contract/RPC targets,
hidden wallet connection paths, and unsafe legacy write routes. Every enabled
write checks chain `4441`, exact target, function, native value, token spender,
and attested runtime before constructing a transaction. The public origin must
still be built from the approved commit and proven byte-for-byte equivalent at
the apex and `www` hostnames before a MetaMask classification appeal is filed.

A clean contract deployment does not prove the served site is clean, and source
availability or an audit with no known advisory is not proof of safety by itself.

## Historical activity continuity

The homepage freezes the legacy/display counters through LitVM block
`38,999,871` (block hash
`0x0f08a4e58106a4cd465555c5a3b0a2bf44e723277ff69f0a6c0b22de3c77c9da`):

- 517,422 token deployments;
- 16,433 airdrop recipient entries;
- 8,511 presales;
- 12,975 displayed swap actions; and
- 66,832 Ledger messages.

These are first-party continuity records under published counting rules, not
independently verified counts of unique wallets or people. Repeated, automated,
spam, and duplicate-recipient activity may be included. Only authenticated
replacement counters beginning at block `38,999,872` are added to these floors;
later legacy activity is intentionally excluded to avoid overlap.

## Network configuration

| Parameter | LitVM LiteForge |
|---|---|
| Chain ID | `4441` (`0x1159`) |
| RPC URL | `https://liteforge.rpc.caldera.xyz/http` |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Native test gas | `zkLTC` |

Cross-check these values against LitVM's independently located official
documentation. The app asks the wallet to switch to chain `4441` and blocks a
write if the connected chain cannot be verified.

## Legacy address policy

Legacy addresses are retained in reviewed source only for historical reads or
narrow recovery. They are not current targets for new activity. Exact addresses,
retirement blocks, runtime hashes, and recovery boundaries are maintained in the
source-pinned registry. Never substitute an address from a chat message, social
post, search result, or mutable environment variable.

Always verify chain ID `4441`, the exact target, function, native value, token
spender, allowance, recipient, and decoded parameters before signing.

## Support

- X: [@lesterlabshq](https://x.com/lesterlabshq)
- Website: [www.lester-labs.com](https://www.lester-labs.com)
