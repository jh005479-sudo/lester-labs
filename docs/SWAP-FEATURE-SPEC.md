# Swap Feature — Implementation Notes

> **Historical only:** the incident-associated `0xCbf8…` destination named below
> is rejected and must not be used. The July rotation never executed.
> Fresh DEX deployment is governed by `POST-COMPROMISE-REDEPLOYMENT.md` and its
> fail-closed address-only plan.

> **Scanner-relevant finding:** this legacy pair is not canonical Uniswap V2.
> `swap()` transfers `0.20%` of each measured input token directly to mutable
> `feeTo`. This is not an arbitrary drain, but the extra recipient is a plausible
> transaction-scanner drainer heuristic and compromised `feeToSetter` authority
> can redirect it. Do not carry this behavior into the replacement.

> **Historical status:** the described direct-fee deployment remains
> recovery-only and its proposed EOA was rejected. There is currently no
> approved replacement controller, treasury, or gas EOA. The replacement must
> follow the thirteen-contract post-compromise runbook.

## Scope

The Lester Labs DEX rollout covers three connected surfaces:

- `/swap` for wallet-connected trading
- `/pool` for LP balance and exposure discovery
- Launchpad finalization wired into the same Lester Labs Uniswap V2 deployment

## Legacy fee model

| Recipient | Amount |
|---|---|
| Lester Labs treasury | `0.20%` |
| LPs retained in-pool | `0.10%` |
| **Total per trade** | **`0.30%`** |

Historical incident-associated destination (never use as treasury, controller,
delegate, or deployer):

`0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28`

This split is enforced in the pair contract, not just in frontend config.

## Contracts

Implemented under `contracts/contracts/uniswap/`:

- local `UniswapV2Factory`
- local `UniswapV2Pair`
- local `UniswapV2Router02`
- wrapped native asset contract for zkLTC router compatibility
- `UniSwapConnector.sol` for Launchpad finalization

Historical Lester Labs-specific behavior (not present in the replacement Pair):

- factory constructor sets both `feeTo` and `feeToSetter` to the treasury
- pair `swap()` routes `0.20%` of input directly to treasury and leaves `0.10%` for LPs
- `UniSwapConnector` refuses to add launch liquidity if factory routing drifts away from treasury

Deploy scripts:

- `contracts/scripts/deploy_uniswap_v2.ts`
- `contracts/scripts/deploy.ts`

## Frontend

Implemented routes:

- `src/app/swap/page.tsx`
- `src/app/pool/page.tsx`

Behavior:

- token selection backed by LitVM token metadata
- live quotes from router `getAmountsOut`
- ERC-20 approval flow inline before swap submission
- shared `TxStatusModal` for transaction state
- LP page scans factory pairs and connected-wallet balances
- paid writes authenticate the canonical factory/router/wrapped-native
  addresses and re-read `feeTo` plus `feeToSetter` immediately before signing

## Source-pinned frontend configuration

The LitVM RPC, factory, router, and wrapped-native targets are pinned in reviewed
source. `NEXT_PUBLIC_*` deployment/RPC overrides are rejected at build time so a
compromised hosting account cannot substitute a spender or transaction target.

## Retired deployment sequence

The old partial DEX and connector commands fail closed. Do not run or revive
them. Deploy Factory, Router, Connector, ILO Factory, and governance only as
part of the single nonce-bound thirteen-contract workflow in
`POST-COMPROMISE-REDEPLOYMENT.md`; pin frontend addresses only from its final
independently verified manifest.

## Notes

- The router still uses a wrapped-native contract under the hood because standard Uniswap V2 periphery expects a wrapped asset
- Runtime swaps do not depend on an external DEX
- The legacy direct fee transfer is a deliberate but noncanonical divergence.
  The post-compromise replacement must restore canonical Uniswap V2 pair fee
  behavior and must not copy this direct-recipient path.
