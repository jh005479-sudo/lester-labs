# Launchpad

## Overview

The Launchpad lets project teams run community presales (ILOs — Initial Liquidity Offerings) and then finalize directly into a Lester Labs DEX pool. The flow is self-serve and permissionless: deploy the presale, fund it with tokens, accept zkLTC contributions, and finalize into locked LP without handing the launch off to an external DEX.

## How it works

A project creates an ILO through the factory and configures the sale parameters. After deployment, the project funds the individual ILO contract with the token inventory required for both participant claims and the liquidity tranche. Community members contribute zkLTC during the sale window. When the raise is complete and the soft cap has been met, `finalize()` routes the liquidity portion into Lester Labs' `UniSwapConnector`, which re-checks the Lester Labs Uniswap V2 deployment before calling the Lester Labs router to seed the pair. LP remains locked until the configured unlock time. If the sale is cancelled or misses soft cap, contributors can self-refund from the contract.

## Step-by-step guide

**For project teams (creating a presale):**
1. Connect your wallet and switch to LitVM
2. Navigate to Launchpad → Create Presale
3. Enter your token contract address
4. Set soft cap and hard cap in zkLTC
5. Set tokens per zkLTC
6. Set presale start and end dates
7. Choose the liquidity percentage that will seed the Lester DEX pool
8. Choose the LP lock duration
9. Optionally enable whitelist mode
10. Pay the creation fee and deploy the ILO
11. Open the presale management page
12. Transfer the required token inventory into the ILO contract
13. If whitelist mode is enabled, upload the approved wallet list
14. Share the presale page with your community once funding is complete
15. After the raise closes or hard cap is hit, call `finalize()` to create the Lester DEX pool and lock LP

**For contributors:**
1. Browse active presales on the Launchpad
2. Review the token, price, soft cap, hard cap, and LP lock details
3. Contribute zkLTC from the presale page
4. Return to the same page to claim tokens after finalization
5. If the sale is cancelled or soft cap is missed, claim a refund from the same page

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
| Creation fee | 0.03 zkLTC | When project creates the presale |
| Platform fee | 2% of zkLTC raised | Deducted automatically at finalization |
| DEX trading fee after launch | 0.30% total | Paid by traders on the live pair: 0.20% treasury / 0.10% LPs |

**Example:** Project raises 100 zkLTC. At finalization, 2 zkLTC goes to the Lester Labs treasury and 98 zkLTC remains available for liquidity plus project allocations. Once the pair is trading, each swap on that pair pays 0.30% total, with 0.20% routed to the Lester Labs treasury.

## Smart contract

- **Forked from:** Unicrypt ILO
- **ILO Factory address:** `0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB`
- **UniSwapConnector address:** `Pending deployment`
- **Individual ILO addresses:** Generated per presale at creation

**Key functions (ILOFactory):**
- `createILO(...)` — deploys a new ILO contract for a project (payable, requires creation fee)
- `allILOs(uint256)` — returns the address for a sale by index
- `getOwnerILOs(address)` — returns ILOs created by a specific address
- `setConnector(address)` — points the factory at the Lester Labs liquidity connector used during finalization

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
- **Funding precondition:** Finalization will fail unless the ILO has been funded with the required token inventory, so creators should complete the funding step before promoting the sale

Always verify the presale contract and token address before contributing. Lester Labs does not vet projects or guarantee presale outcomes.
