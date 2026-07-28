# LitVM Launchpad — Permissionless Token Launches on LitVM

## Overview

The Launchpad currently provides discovery and recovery access for historical
ILOs. New presale creation is disabled. Contributions and finalization are
also disabled for the canonical legacy ILOs because their treasury was copied
at construction from a retired controller.

Do not send tokens or zkLTC directly to a legacy ILO. Cancellation, refunds,
and claims remain available when the individual contract state permits them.
A separately reviewed future factory and connector must be explicitly pinned
before the application can offer new ILO creation again.

## How it works

In a future reviewed deployment, a project would create an ILO, fund its token
inventory, accept contributions, and finalize through a connector into a
locked Lester Labs DEX position. That workflow is not enabled on the current
legacy deployment.

## Step-by-step guide

**For legacy participants:**

1. Open the historical ILO from the Launchpad.
2. Do not contribute or add token funding.
3. If the owner has cancelled the sale, use the refund action.
4. If a finalized sale permits a claim, use the claim action.
5. Verify the exact ILO address and state in the explorer before signing.

Owners should prefer cancellation/refund recovery over finalization where the
retired treasury is embedded.

## Parameters

| Field | Description | Constraints |
|---|---|---|
| Token Address | ERC-20 token being sold | Must be a deployed token |
| Soft Cap | Minimum zkLTC required for a successful sale | Must be ≤ hard cap |
| Hard Cap | Maximum zkLTC the sale can raise | Sale stops when reached |
| Tokens Per zkLTC | Exchange rate for contributors | Determines token price |
| Start Date | When contributions open | Must be in the future |
| End Date | When contributions close | Must be after start date |
| Liquidity % | Portion of net raised zkLTC added to Lester DEX LP | 50–100% |
| LP Lock Duration | How long LP stays locked after finalization | Minimum 30 days |
| Whitelist | Restrict contributions to approved addresses | Optional |

## Fee structure

| Fee | Amount | When charged |
|---|---|---|
| Creation fee | 0.03 zkLTC | Historical/future contract setting; creation is currently disabled |
| Platform fee | 2% of zkLTC raised | Deducted automatically at finalization |
| DEX trading fee after launch | 0.30% total | Paid by traders on the live pair: 0.20% treasury / 0.10% LPs |

The legacy platform fee route is unsafe because it points to the retired
controller. The example fee split applies only to a future approved deployment
whose treasury and DEX controls pass the application checks.

## Smart contract

- **Forked from:** Unicrypt ILO
- **ILO Factory address:** `0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB`
- **Legacy UniSwapConnector address:** `0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD` (retired treasury; do not reuse)
- **Individual ILO addresses:** Generated per presale at creation

The currently deployed ILO factory predates the connector-aware source, does
not expose `connector()`, and is permanently creation-disabled in the
frontend. A future connector-aware factory must use a new connector deployed
for the approved treasury and must be separately pinned in source.

**Key functions (ILOFactory):**
- `createILO(...)` — legacy on-chain function; the application does not expose this paid write
- `allILOs(uint256)` — returns the address for a sale by index
- `getOwnerILOs(address)` — returns ILOs created by a specific address
- `setConnector(address)` — available only on a future connector-aware factory; it must point at the approved replacement connector

**Key functions (ILO — per presale):**
- `contribute()` — contribute zkLTC to the presale (payable)
- `setWhitelist(address[], bool)` — add or remove approved wallets when whitelist mode is enabled
- `finalize()` — seed LP through the Lester Labs connector/router, lock LP, and enable token claims
- `claim()` — contributor claims their token allocation post-finalization
- `refund()` — contributor claims a zkLTC refund if the sale fails or is cancelled
- `claimLP()` — project owner claims LP tokens after lock expiry
- `sweepExcessETH()` — recover any zkLTC not consumed by LP creation due to slippage
- `tokensRequired()` — returns the token inventory needed before finalization can succeed

## Sources

- [Unicrypt ILO](https://www.unicrypt.network/ilo)

## Security

This module stays close to the Unicrypt-style ILO model while routing liquidity into the Lester Labs DEX. Key security properties:

- **Soft cap protection:** If soft cap is not met, contributors can refund directly from the contract
- **Lester Labs-only liquidity routing:** `UniSwapConnector` re-checks that the Lester Labs factory and treasury settings are still correct before seeding liquidity
- **LP lock enforcement:** LP tokens remain locked at the contract level until the configured unlock time
- **Fee auto-collection:** Platform fee is deducted in-contract at finalization
- **No external DEX dependency:** Launchpad liquidity is seeded into the Lester Labs Uniswap V2 deployment, not a third-party router
- **No admin override:** Lester Labs cannot rewrite sale parameters or withdraw contributor funds after deployment
- **Legacy transaction guard:** The application blocks new funding,
  contribution, and finalization while preserving cancellation, refund, and
  claim recovery actions

These properties describe the intended future connector-aware design, not a
recommendation to use the legacy deployment. Always verify the contract and
token address, and do not contribute to the current legacy ILOs.
