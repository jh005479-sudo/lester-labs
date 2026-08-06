# RETIRED — Lester Labs Treasury Rotation — 2026-07-27

> **Do not execute this procedure.** A live RPC check on 2026-08-04 confirmed
> that the rotation never ran: the core owners, treasuries, DEX `feeTo`, and
> `feeToSetter` remained at the compromised `0xDD22…` controller. The proposed
> `0xCbf8…` destination is also unsafe because its private key was disclosed in
> chat. The old rotation, verification, sweeping, and governance deployment
> entrypoints now fail closed. Use `POST-COMPROMISE-REDEPLOYMENT.md` with newly
> approved address-only multisig values instead. The material below is retained
> only as historical audit context and does not describe current chain state.

## Status

Historical repository defaults and the never-executed plan proposed this now
rejected address:

`0xCbf819017ae48F261Fe143B2a7c8a29d9a2FCD28`

Its private key was disclosed in chat. It is not approved as controller,
treasury, Timelock delegate, or gas-only deployer; do not fund, sign with, or
reuse it. The live LitVM contracts still require transactions signed by the
compromised current controller. Merging this repository does not change
on-chain state.

The canonical legacy ILO factory is now discovery/recovery-only in the
frontend. It remains creation-disabled even after treasury rotation. A future
factory must be separately reviewed and explicitly pinned in source before
paid creation can be enabled.

## Retired live-migration design (audit evidence only)

Do not configure a key or run this migration. The old write commands are
fail-closed; only `audit:child-authority:litvm` remains a read-only evidence
collector. Use the fresh thirteen-contract workflow instead.

Timelock history through block `34,083,003` was independently reconciled
between Blockscout and a complete deployment-to-checkpoint RPC scan. The eight
exact role-event tuples, their digest
`0x3231e7a8f5dd2023d855f735d206091458c3826694f30a0f450f1dc02e6f65e5`,
and checkpoint hash
`0xcc68c1c3208354963a12e9a51f1682572a40baa2b65faecf0a14a524f9e11e2b`
are pinned in source. Each run verifies that checkpoint and reads every
subsequent Timelock role/operation event directly from canonical RPC, avoiding
dependence on an explorer indexer while keeping the live preflight practical.

The retired rotation script was designed to:

1. requires chain ID `4441`, the exact current signer, and exact pinned runtime
   hashes for every core live deployment;
2. starts from the independently reconciled, block-hash-anchored Timelock
   baseline, reconstructs all later role and operation events directly from
   RPC, then cross-checks reconstructed membership against `hasRole`;
3. repairs and verifies the exact router and fee configuration: ILO router,
   2% platform fee, 0.03 zkLTC ILO fee, 0.05 zkLTC token fee, 0.03 zkLTC
   vesting fee, 0.03 zkLTC locker fee, TheLedger 0.01 zkLTC minimum / 50%
   treasury cut, and the Timelock's exact 172,800-second minimum delay;
4. cancels the sole audited Governor test proposal and every pending Timelock
   operation before the retired canceller is removed;
5. transfers all five application ownership roles, LitGovToken ownership, and
   the retired controller's full 10,000,000-token governance balance, while
   rejecting any preconfigured third-party delegate at the target;
6. sets the exact Timelock role set: admin `{Timelock, approved treasury}`,
   proposer `{Governor}`, executor `{Governor}`, and canceller
   `{approved treasury}`. Execution is deliberately not open to the zero
   address;
7. updates ILOFactory and TheLedger treasury routes and Uniswap V2 `feeTo`;
8. removes every retired or unexpected Timelock role; and
9. transfers Uniswap V2 `feeToSetter` before removing the retired signer's
   final Timelock roles, then verifies all resulting state.

Each proposed operation would have been a separate, non-atomic transaction.
None is authorized now, and the rejected destination must not be funded.

## What “non-upgradeable” means here

The verifier's primary deployment attestation is an exact
`keccak256(runtimeBytecode)` fingerprint captured from each reviewed live
address on 2026-07-27. Zero EIP-1967 implementation/admin/beacon slots are a
supplemental check only; empty standard proxy slots are not, by themselves,
proof of immutability or source equivalence.

The attested core addresses are direct deployments, not EIP-1967 proxy
instances, and their code cannot be upgraded in place through a proxy admin.
That does not make their state immutable:

- ILOFactory ownership can change router, treasury, platform fee, and creation
  fee. Its live legacy runtime predates `connector()`.
- TokenFactory, VestingFactory, and LiquidityLocker ownership can change fees
  and withdraw accrued fees.
- TheLedger ownership can change treasury and fee settings and rescue ERC-20
  balances.
- Uniswap V2 `feeToSetter` can change protocol fee routing.
- LitGovToken ownership can mint an unlimited number of governance tokens.
- LitTimelock admin can grant/revoke execution roles, and its canceller can
  cancel scheduled operations.
- Individual ILO owner/treasury values are copied into each child at creation
  and have no setter in the live child runtime.

After the verifier passes, compromise of the retired controller no longer
controls those core mutable surfaces. Compromise of the approved treasury
would still expose them. A hardware-backed multisig is safer than a single EOA.

A runtime fingerprint identifies deployed bytecode. It does not prove that
unverified bytecode is identical to any particular source tree or constitute a
third-party audit.

## Factory-child authority inventory

The latest successful remediation audit used snapshot block `34,078,601` and
found:

- 113 ILO children: zero owned by the retired controller. All 113 permanently
  embed the retired treasury and share live-bytecode fingerprint
  `0x8359d3e7011bea1f23fad4d454c093a32271b7e2b2078f190a0c0add87598fca`.
- 18,606 deterministic VestingWallet children: zero currently owned by the
  retired controller.
- 22,781 LiquidityLocker records: zero name the retired controller as
  withdrawer.
- 12 retired-created LesterToken children remain owned by the retired
  controller. All 12 report `mintable=false`, `pausable=false`, and
  `burnable=true`, so ownership cannot mint or pause them. Transferring or
  renouncing these inert ownerships would remove the residual cleanly.

The 12 token addresses are:

| Address | Name | Symbol |
|---|---|---|
| `0xEDF080166ADa21cFf451421963Fb04b637f6f028` | test1 | T1000 |
| `0xD7F2278bDd0bc4fC50ff081465833d907E5DB1F5` | test2 | T2000 |
| `0xdC00E7826cD7a092d1bACe136C5C4ba8b8014c27` | Lester is Bester | BEST |
| `0xca10cB934401DeCb2017fDe419f6B98f0743196b` | Cortana | CORT |
| `0xdaF8BDC2b197C2f0fAb9d7359bdF482F8332b21f` | LL wEth | WETH |
| `0x3bCE48A3b30414176e796Af997Bb1Ed5E1dC5B22` | LL wBTC | WBTC |
| `0x4af16CFB61FE9a2C6D1452d85B25e7Ca49748f16` | LL USDT | USDT |
| `0x7f837D1b20c6ff20d8c6F396760C4F1f1F17baBF` | LL USDC | USDC |
| `0x3Bc880f42A05254C30Fb20eAFdC8Ec69253AAdD3` | LL weth 2 | WETH2 |
| `0x7709532F30bC527E8ae48F168581D0dd566B1e1A` | LL wbtc2 | WBTC2 |
| `0x99cB87C30BC214E3c811E8729B33abe361Ede29e` | LL USDT 2 | USDT2 |
| `0x3b3FA0B3BcA2E5790a3AAe7366139D60bF45636c` | LL USDC 2 | USDC2 |

Their shared live-bytecode fingerprint is
`0xe725bfd694a360ad063b072a3adcbb7b2a6ddc602612314a8fb3a93e09066791`.

TokenFactory has no child counter and its heavily used account nonce implies
491,574 successful child CREATEs at the audit snapshot. The automated report
therefore uses targeted `TokenCreated(creator=retired)` and
`OwnershipTransferred(newOwner=retired)` histories, followed by live state
reads. A future exhaustive audit can derive all factory CREATE addresses and
batch every `owner()` call.

Blockscout's ordinary paginated event endpoint omitted records in high-volume
Vesting/Locker histories. The report does not treat that pagination as
complete: ILOs are reconciled against `allILOs`, VestingWallets are derived
from factory CREATE nonces and checked directly, and every locker record is
read by ID at one block snapshot.

Those public factories remain active and their counts can grow. The audit
script takes a fresh block snapshot and re-enumerates the current counters on
every run; the numbers above are evidence from one completed run, not static
allowlists.

## Funded legacy ILO residual

All existing ILOs permanently embed the retired treasury, so factory rotation
does not change their platform-fee destination. One legacy ILO held 0.005
native zkLTC at the audit snapshot:

- ILO: `0x8C788911D6D3dBc428B803DcE3ECaA326F870Ec8`
- owner: `0xe1dF02426C9eDCc0b4Ee15d9ff537b87eec8091E`
- embedded treasury: retired controller

It must not receive further funding and must not be finalized through the UI.
Owner cancellation and contributor refund/claim recovery paths remain
available when the contract state permits them. The frontend deliberately
blocks contribution, funding, whitelist changes, and finalization for every
canonical legacy-factory child—even a new child created after factory treasury
rotation—while leaving recovery actions reachable.

## Legacy factory and connector

The canonical legacy factory remains browse/recovery-only regardless of its
post-rotation treasury value. The deployed legacy connector permanently embeds
the retired treasury and must not be reused.

The old connector-only deployment command is retired and fails closed. A fresh
connector is deployed only at step four of the nonce-bound thirteen-contract
replacement sequence. Frontend creation remains disabled until the final
manifest address and reviewed runtime are explicitly pinned in source.

## Governance finding

Before rotation, the retired controller owns LitGovToken's mint function,
holds the entire 10,000,000-token supply with delegated voting power, and has
Timelock admin/canceller authority. The sole Governor proposal is an audited
test no-op and must be canceled.

The never-executed retired plan would have moved token ownership/balance and
roles to the now-rejected destination. Those post-rotation claims do not
describe live state and are not an authorized recovery target.

The retired signer cannot delegate tokens on behalf of the approved treasury.
The old verifier's proposed target-signed delegation states are historical
only. Do not call `delegate` to the rejected `0xCbf8…` address. Replacement
governance instead mints the exact initial supply to a new distinct treasury
and self-delegates it atomically in the Token constructor.
