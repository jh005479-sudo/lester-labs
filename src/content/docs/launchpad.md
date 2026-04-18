# Launchpad

## Overview

The Launchpad enables project teams to run community presales (ILOs — Initial Liquidity Offerings) with automatic LP creation and locking at finalization. Self-service and permissionless: deploy your presale, accept zkLTC contributions, and launch with locked liquidity in a single finalize transaction. No external DEX handoff is required.

## How it works

A project creates an ILO by depositing their tokens into the factory contract and configuring presale parameters. Community members contribute zkLTC during the contribution window. At close, the project calls `finalize()`. The ILO deducts the launchpad fee, then passes the liquidity tranche into Lester Labs' `UniSwapConnector`, which re-validates the Lester Labs Uniswap V2 factory before calling the Lester Labs router to seed the pair. The LP tokens remain tied to the launch flow and can then be locked for the configured duration. If the soft cap is not met, all contributions are automatically refundable.

## Step-by-step guide

**For project teams (creating a presale):**
1. Connect your wallet and switch to LitVM network
2. Navigate to Launchpad → Create Presale
3. Enter your token contract address
4. Set soft cap and hard cap (in zkLTC)
5. Set tokens per zkLTC (determines the presale price)
6. Set presale start and end dates
7. Set liquidity percentage (50–100% of raised zkLTC goes to LP on the Lester Labs DEX)
8. Set LP lock duration (minimum 30 days)
9. Optionally enable whitelist and add permitted addresses
10. Review the creation fee (0.03 zkLTC) and confirm
11. Approve token spend and sign the creation transaction
12. Share your presale page with your community
13. After presale ends: call `finalize()` if soft cap met, or contributors can self-refund if not

**For contributors:**
1. Browse active presales on the Launchpad
2. Review presale details — token, caps, price, LP lock duration
3. Enter contribution amount (zkLTC) and confirm
4. After finalization: return to claim your tokens
5. If soft cap not met: claim a full refund

## Parameters

| Field | Description | Constraints |
|---|---|---|
| Token Address | ERC-20 token being sold | Must be a deployed token |
| Soft Cap | Minimum zkLTC to raise for success | Must be < hard cap |
| Hard Cap | Maximum zkLTC to raise | Presale closes when reached |
| Tokens Per zkLTC | Presale exchange rate | Determines token price |
| Start Date | When contributions open | Must be in the future |
| End Date | When contributions close | Must be after start date |
| Liquidity % | Portion of raised zkLTC added to LP | 50–100% |
| LP Lock Duration | How long LP tokens are locked post-launch | Minimum 30 days |
| Whitelist | Restrict contributions to approved addresses | Optional; off by default |
| Min Contribution | Minimum zkLTC per contribution | Set by project at creation |
| Max Contribution | Maximum zkLTC per wallet | Set by project at creation; 0 = no limit |

## Fee structure

| Fee | Amount | When charged |
|---|---|---|
| Creation fee | 0.03 zkLTC | When project creates presale |
| Platform fee | 2% of zkLTC raised | Deducted automatically at finalization |
| DEX trading fee after launch | 0.30% total | Paid by traders on the live pair: 0.20% treasury / 0.10% LPs |

**Example:** Project raises 100 zkLTC. At finalization, 2 zkLTC goes to the Lester Labs treasury and 98 zkLTC remains available for liquidity plus project allocations. Once the pair is trading, each swap on that pair pays 0.30% total, with 0.20% routed to the Lester Labs treasury wallet `0xDD221FBbCb0f6092AfE51183d964AA89A968eE13`.

## Smart contract

- **Forked from:** Unicrypt ILO (Initial Liquidity Offering)
- **ILO Factory address:** `0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB`
- **UniSwapConnector address:** `Pending deployment`
- **Individual ILO addresses:** Generated per presale at creation

**Key functions (ILOFactory):**
- `createILO(params)` — deploys a new ILO contract for a project (payable, requires creation fee)
- `getILOs()` — returns all ILO contract addresses
- `getILOsByOwner(address)` — returns ILOs created by a specific address
- `setConnector(address)` — points the factory at the Lester Labs liquidity connector used during finalization

**Key functions (ILO — per presale):**
- `contribute()` — contribute zkLTC to the presale (payable)
- `finalize()` — seed LP through the Lester Labs connector/router, lock LP, enable token claims (project owner only, after end date if soft cap met)
- `claimTokens()` — contributor claims their token allocation post-finalization
- `userRefund()` — contributor claims full zkLTC refund if soft cap not met
- `claimLP()` — project owner claims LP tokens after lock expires
- `sweepExcessETH()` — recover any zkLTC not consumed by LP creation due to slippage (owner only)
- `addWhitelist(addresses[])` — add addresses to contribution whitelist (owner only)

## Sources

- [Unicrypt ILO](https://www.unicrypt.network/ilo)

## Security

Forked from Unicrypt ILO, one of the most battle-tested presale contracts in DeFi, used for thousands of launches across Ethereum and BSC. Key security properties:

- **Soft cap protection:** If soft cap is not met by end date, all contributions are refundable directly from the contract — no admin action required
- **Lester Labs-only liquidity routing:** `UniSwapConnector` re-checks that both factory `feeTo` and `feeToSetter` still point at the Lester Labs treasury before it will add launch liquidity
- **LP lock enforcement:** LP tokens are locked at the contract level for the configured duration; the project team cannot access them early
- **Fee auto-collection:** Platform fee is deducted in-contract at finalization — no manual fee invoicing
- **No external DEX dependency:** Launchpad liquidity is seeded into the Lester Labs Uniswap V2 deployment, not a third-party router
- **No admin override:** Once an ILO is created, Lester-Labs has no ability to modify parameters or access contributed funds
- **Slippage handling:** `sweepExcessETH()` allows recovery of any zkLTC not consumed by LP creation due to price slippage at finalization

Always verify the presale contract and token address before contributing. Lester-Labs does not vet projects or guarantee presale outcomes.
