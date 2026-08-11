# Lester Labs

Lester Labs is an independent LiteForge testnet toolkit currently operating in
post-compromise containment. Read-only discovery and narrowly scoped recovery
flows remain available; new paid writes, approvals, swaps, liquidity additions,
governance writes, and contract creation remain disabled until the complete
replacement stack is clean-built, deployed, verified, and source-pinned.

This repository contains two main workspaces:

- `src/` and the project root: the Next.js App Router frontend
- `contracts/`: the Hardhat contracts, deploy scripts, and tests

## LitVM Testnet

| Parameter | Value |
|---|---|
| Network | LitVM Testnet (Liteforge) |
| Chain ID | `4441` |
| RPC URL | `https://liteforge.rpc.caldera.xyz/http` |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Native Asset | `zkLTC` |
| Treasury/controller status | **Containment incomplete — no durable replacement is currently approved** |

Repository history and configuration contain legacy and test-only authority
addresses. One proposed treasury address is derived from a private key
disclosed during the incident investigation and must not be treated as a
durable target. Generate replacement controller and treasury addresses on a
separately trusted device, record public addresses only, and treat containment
as incomplete until independent live-chain verification passes.

## Platform Surface During Containment

- `/security` for the public containment and recovery status
- `/locker`, `/vesting`, `/launchpad`, `/swap`, and `/pool` for source-pinned
  discovery or the specifically labelled recovery paths
- `/analytics`, `/portfolio`, `/ledger`, and `/explorer` for bounded or
  read-only views whose coverage is stated in the interface
- `/launch`, `/airdrop`, `/governance`, and every other ordinary write surface
  remain fail-closed until replacement activation

## Getting Started

Install frontend dependencies:

```bash
npm ci --ignore-scripts
```

Install contract dependencies:

```bash
cd contracts
npm ci --ignore-scripts
```

Run the frontend locally from the repo root:

```bash
npm run dev
```

The repository pins Node.js `24.18.0` in CI and npm `11.16.0` in both
`package.json` files. Do not use `npm install`, unreviewed `npx`, or dependency
lifecycle scripts to bypass the immutable lockfiles.

Run contract compile and tests:

```bash
cd contracts
npm run compile
npm test
```

## Environment

Frontend contract targets and the LitVM RPC used for security attestations are
source-pinned in `src/config/contracts.ts` and `src/config/chains.ts`. The build
rejects former `NEXT_PUBLIC_*` contract/RPC overrides because a compromised
hosting environment could otherwise redirect approvals, writes, or bytecode
checks. WalletConnect is intentionally disabled during recovery, and stale
WalletConnect, RPC, or contract-target environment values must be deleted from
the hosting project rather than carried into the clean deployment.

## Deployment Flow

There is one canonical post-compromise workflow with two source-pinned
profiles. Historical partial-Dex, connector-only, governance, sweep, and July
rotation entrypoints are retired and fail closed. The production plan contains
zero-address controller/treasury placeholders, so it cannot deploy until
clean-device, address-only multisig values are reviewed and committed. A
separate immutable disposable profile is restricted to isolated valueless
functional testing: the disclosed wallet may pay gas and receive test fees,
while every authority and all governance voting power are frozen at LitVM's
verified `0x…01` ECRECOVER precompile. Disposable addresses can never activate
the public frontend or support a reputation appeal.

Production must not compile, attest, verify, or deploy from the previously
suspected Mac. Use a clean digest-pinned x64 Linux ephemeral runner with a
fresh HOME/compiler cache, no credentials, and outbound network disabled after
reviewed inputs and exact compiler binaries are fetched. The separately
authorised factory-reset Mac exception is restricted in code to the valueless
immutable disposable profile and cannot select the production profile. The
real attestation is an immutable
external release artifact; the committed `NOT_ATTESTED` file is only a
fail-closed sentinel. The clean install's full `node_modules` tree is also
content/mode/symlink hashed and must be mounted read-only before attestation or
key injection; build artifacts and compiler caches stay outside that tree.
The frontend uses reviewed local/system font stacks, so its production build
does not contact Google Fonts or another remote font service after egress is
disabled.

On the trusted runner, create the external two-pass build attestation using the
reviewed paths and Node/Hardhat/solc digests documented in the runbook. Then
start the read-only preview with its independently distributed digest:

```bash
cd contracts
unset DEPLOYER_PRIVATE_KEY
export REPLACEMENT_BUILD_ATTESTATION_PATH=/absolute/read-only/release/replacement-build-attestation.json
export EXPECTED_REPLACEMENT_BUILD_ATTESTATION_SHA256=0x_REVIEWED_SHA256
export EXPECTED_GAS_ONLY_DEPLOYER_ADDRESS=0x_GAS_ONLY_PUBLIC_ADDRESS
export REPLACEMENT_PREVIEW_ONLY=true
npm run deploy:litvm
```

The same production command can send the fixed thirteen-contract sequence only after the exact
live-write acknowledgement described in
[`docs/POST-COMPROMISE-REDEPLOYMENT.md`](docs/POST-COMPROMISE-REDEPLOYMENT.md).
Live execution also requires a pre-created mode-`0700` absolute
`REPLACEMENT_RECORDS_DIRECTORY` outside the repository so the per-transaction
clean-source guard and deployment journal can coexist.
Do not publish addresses or enable paid writes until the generated manifest
passes the independent verifier:

```bash
export REPLACEMENT_MANIFEST_PATH=/absolute/path/to/replacement-manifest.json
unset DEPLOYER_PRIVATE_KEY
npm run verify:replacements:litvm
```

The workflow:

- rejects the compromised `0xDD22…` controller, incident-associated `0xCbf8…`
  July target, and disclosed-key-derived `0x4399…` address as controller,
  treasury, or gas-only deployer;
- makes the signer gas-only in every constructor and prevents mutable contracts
  from ever assigning authority back to it;
- deploys fresh DEX and application contracts without reusing legacy runtime;
- verifies transaction input, deterministic CREATE address, runtime, immutable
  links, fee roles, owner, and treasury state;
- compiles in a separate credential-free process, then requires a reviewed
  externally published SHA-256 attestation while all live commands run with
  `--no-compile`; and
- preserves legacy addresses only as recovery anchors in a nonce-bound manifest
  written to the reviewed external records directory.

## DEX and Launchpad Notes

The retired local DEX under `contracts/contracts/uniswap/` used a noncanonical
direct-to-`feeTo` split:

- legacy total fee per trade: `0.30%`, split into a direct `0.20%` input-token
  transfer to mutable `feeTo` and only `0.10%` retained in-pool;
- immutable testnet replacement fee: the same disclosed `0.20%` direct transfer
  goes to the fixed valueless test treasury and approximately `0.10%` remains
  in-pool; and
- replacement `feeToSetter` is frozen at the no-key `0x…01` precompile, so the
  direct recipient cannot be redirected.

That direct extra token recipient is not an arbitrary drain, but it is a
plausible transaction-scanner heuristic and the compromised `feeToSetter` could
redirect it. The legacy DEX is therefore recovery-only: no swaps, pool creation,
liquidity additions, or new wrapping. The immutable testnet replacement
publishes this behavior as a known scanner-relevant divergence. A future real-
value production design must reassess it.

`contracts/contracts/UniSwapConnector.sol` bridges Launchpad finalization into
the Lester Labs router. It refuses to add liquidity unless the factory still
points `feeTo` at the reviewed treasury and `feeToSetter` at the reviewed
controller. The replacement ILO factory also pins the fresh DEX factory and
attests the complete connector configuration. The replacement Pair's disclosed
direct fee can reach only the source-pinned treasury.

The older ILO factories and connector are legacy recovery surfaces: new
creation, funding, contribution, and finalization remain disabled against them.
New testnet launches use only the immutable replacement factory/connector after
chain, runtime, target, fee, and state checks. Swap, pool, token, vesting,
locker, and Ledger paid writes likewise re-read their live owner/treasury or
DEX fee controls before submission.

## Documentation

- App docs live in `src/content/docs/`
- Tutorials live in `src/lib/tutorials-content.ts`
- Product and implementation notes live in `docs/`

## Disperse replacement

The fresh `Disperse` uses reentrancy protection, checked native calls, and
OpenZeppelin `SafeERC20`. Successful distributions emit caller, token (for
ERC-20), recipient-entry count, and total amount for authenticated analytics.
Each batch contains 1–200 positive-value entries, and the contract maintains a
monotonic `totalRecipientEntries` counter. Duplicate addresses are permitted,
so this is not a unique-user metric. A recipient revert still reverts the
entire distribution atomically.
