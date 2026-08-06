# Lester-Labs Contracts

Solidity smart contracts for the Lester-Labs DeFi toolkit, built with Hardhat + OpenZeppelin.

## Contracts

| Contract | Description |
|---|---|
| `TokenFactory` | Deploy ERC-20 tokens with configurable mint/burn/pause. Fee: 0.05 ETH |
| `LiquidityLocker` | Time-lock LP tokens with a withdrawer address. Fee: 0.03 ETH |
| `VestingFactory` | Create linear/cliff vesting schedules via OpenZeppelin VestingWallet. Fee: 0.03 ETH |
| `Disperse` | Bulk-send ETH or ERC-20 tokens to multiple recipients |

---

## Prerequisites

- **Node.js** `24.18.0` and **npm** `11.16.0`
- A funded wallet with **Arbitrum Sepolia ETH** for gas
  - Faucet: https://www.alchemy.com/faucets/arbitrum-sepolia
- (Optional) A funded wallet with **LitVM** native token for LitVM deployment

---

## Setup

```bash
# 1. From the repo root, enter the contracts directory
cd contracts

# 2. Install the immutable lockfile without dependency lifecycle scripts
npm ci --ignore-scripts

# 3. Keep DEPLOYER_PRIVATE_KEY absent during compilation and verification
# Inject approved live values explicitly through the clean runner/secret broker
```

> Hardhat intentionally does not auto-load ignored `.env` files. Do not carry a
> local `.env` from the suspected Mac into preview, verification, or deployment.

---

## Compile

```bash
npm run compile
```

For the post-compromise stack, do not use this general compile command in the
live signer process or anywhere on the suspected Mac. On a digest-pinned x64
Linux ephemeral runner, `npm run attest:replacements` performs two forced,
credential-free offline compilations using a fresh HOME/cache and writes an
external immutable artifact/build-info attestation. The deploy and verifier
then run with `--no-compile` on a trusted runner with the attestation mounted
read-only and its SHA-256 supplied independently. The fresh installed
`node_modules` tree must have no writable regular file or directory and must be
enforced read-only before attestation and before any deployment key is exposed;
its complete deterministic tree digest is checked before and after deployment.

---

## Post-compromise deployment

The historical partial, Arbitrum, connector-only, governance, sweep, and July
rotation entrypoints are retired and fail closed. The production LitVM plan
starts with zero-address controller/treasury placeholders and cannot execute
until reviewed address-only multisig values are committed. A separate
`testnet-immutable-disposable` plan exists only for isolated valueless testing:
it freezes every authority at the verified `0x…01` ECRECOVER precompile and
allows the disclosed wallet only as gas payer and test-fee recipient. It is not
a public-cutover or reputation-appeal deployment.

That disposable profile was executed and independently verified on 2026-08-06
from source commit `abcf1b75ee7945f557163dce11485555da63a5b6`.
Post-execution evidence is mirrored under
[`../docs/security/evidence/disposable-testnet-4441-2026-08-06/`](../docs/security/evidence/disposable-testnet-4441-2026-08-06/README.md).
No production replacement has been deployed or approved.

Follow
[`../docs/POST-COMPROMISE-REDEPLOYMENT.md`](../docs/POST-COMPROMISE-REDEPLOYMENT.md)
for the mandatory read-only preview, exact thirteen-contract deployment order, and
independent verifier. The exact order contains thirteen CREATE deployments and
the external attestation contains sixteen artifact records: thirteen direct
deployments, the Pair and ILO child generations, and the VestingWallet template
whose compiler-declared immutable ranges vary by schedule. The committed `NOT_ATTESTED` file remains
a fail-closed sentinel; do not replace or hand-edit it. Follow the runbook for
the required clean-runner paths and pre-reviewed Node, Hardhat, and compiler
digests. The canonical production preview/deploy command is:

```bash
npm run deploy:litvm
```

The isolated disposable command is `npm run
deploy:litvm:disposable-testnet`; it requires its own profile-bound clean-runner
attestation and additional public-signer risk acknowledgement. Never copy a
disposable manifest into the frontend.

Successful execution writes a nonce-bound manifest to the pre-created private
external `REPLACEMENT_RECORDS_DIRECTORY`; it does not dirty the attested
checkout or overwrite the legacy address inventory.

---

## After Deploying

Only after the independent verifier passes, copy replacement addresses from
the verified external deployment manifest into the frontend:

```
src/config/contracts.ts   ← update the address constants here
```

Example address-map shape:
```typescript
export const CONTRACT_ADDRESSES = {
  TokenFactory:    "0x...",
  LiquidityLocker: "0x...",
  VestingFactory:  "0x...",
  Disperse:        "0x...",
} as const;
```

---

## Run Tests

```bash
npm test
```

## Legacy recovery

The July rotation never executed, and its proposed target was later disclosed
in chat. `rotate:treasury:litvm`, `verify:treasury:litvm`, `sweep:litvm`, and the
old governance/deployment commands now stop without sending a transaction.
Both historical pool-creation scripts also stop before loading a key or
granting a token allowance; liquidity for the fresh DEX requires a separately
reviewed plan.
The child-authority audit remains read-only. The optional clean-device legacy
recovery sequence and its race-risk warning are documented in the
post-compromise runbook; legacy ILO claim/refund/cancel paths remain available
while new funding and finalization stay disabled.

---

## Notes

- TokenFactory, VestingFactory, LiquidityLocker, and ILOFactory forward each
  protocol fee directly to their configured treasury; there is no generic fee
  sweep method. `TheLedger.flushRetainedFeesToTreasury()` is permissionless but
  can send only its retained balance to the source-pinned treasury.
- `VestingFactory` uses OpenZeppelin's `VestingWallet` — vesting schedules are non-revocable by design.
- `Disperse` uses `SafeERC20`, reentrancy protection, checked native calls, and
  caller/token/recipient-entry-count/total distribution events. Batches contain
  1–200 positive-value entries and update `totalRecipientEntries`; duplicate
  addresses are entries, not unique users.
