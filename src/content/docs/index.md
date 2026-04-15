# Lester-Labs Documentation

Lester-Labs is a self-service DeFi utility suite built natively for LitVM — a ZK-SNARK verified Litecoin L2 with zkLTC as its native token. Six permissionless tools covering the full project lifecycle, from token creation through community launches. No sign-ups, no admin approvals, no custom contract logic.

## Utilities

| Utility | Purpose | Fee |
|---|---|---|
| [Token Factory](./token-factory.md) | Deploy ERC-20 tokens | 0.05 zkLTC |
| [Liquidity Locker](./liquidity-locker.md) | Lock LP tokens | 0.03 zkLTC |
| [Token Vesting](./token-vesting.md) | Vesting schedules for teams & investors | 0.03 zkLTC |
| [Airdrop Tool](./airdrop-tool.md) | Bulk token distribution | 0.01 zkLTC/batch |
| [Governance](./governance.md) | Off-chain proposals and voting | Free |
| [Launchpad](./launchpad.md) | Community presales with automatic LP | 0.03 zkLTC + 2% of raise |

## Analytics

Lester-Labs aims to be the premier analytics platform for the LitVM ecosystem — providing real-time visibility into protocol activity, yield opportunities, and ecosystem health.

The Analytics dashboard is organized into focused sub-tabs:

- **Trending** — Real-time trending tokens ranked by price movement and tx activity. Timeframes: 10m / 1H / 4H / 24H / 7D. Useful for spotting early momentum in new tokens.
- **Tokens** — Full token index for LitVM. Tracks all deployed tokens, their age, transfer counts, and classification (core vs LP pairs). The primary surface for new token discovery.
- **Health** — Chain network health: latest block, avg block time, TPS, gas price, and active address trends over 24h / 7d / 30d. Status indicator (healthy / degraded / issues) for at-a-glance network state.
- **Dex** — Trading activity across LitVM DEX pairs. Top pairs by TVL and volume, 24h change, recent swaps with size and price impact. Volume trend chart for the last 24 hours.
- **Bridge** — Cross-chain bridge inflow and outflow activity over time. Source chain breakdown (Ethereum, Arbitrum, Optimism, Other). Useful for monitoring capital flow into and out of LitVM.
- **Smart Money** — Whale wallet tracking on LitVM. Top wallets by holdings, recent activity alerts (accumulates, bridges, swaps, LP additions, staking claims). Signal layer for following sophisticated capital moves.

Live at [lester-labs.com/analytics](https://www.lester-labs.com/analytics).

## Network Configuration

**Testnet (current):** LitVM testnet (Liteforge) is live. Connect using the parameters below.

| Parameter | LitVM Testnet (Liteforge) | LitVM Mainnet |
|---|---|---|
| Chain ID | 4441 | TBA |
| RPC URL | https://liteforge.rpc.caldera.xyz/http | TBA |
| Explorer | https://liteforge.caldera.xyz | TBA |
| Native Token | zkLTC (testnet) | zkLTC |
| Faucet | TBA | N/A |

## Token Factory

Deploy standard ERC-20 tokens to LitVM in a single transaction — no Solidity required. Configure name, symbol, supply, decimals, and optional mint/burn capabilities. The deployed token contract is identical to any OpenZeppelin ERC-20 — no custom logic, no surprises.

- **Forked from:** [OpenZeppelin ERC-20](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol)

## Liquidity Locker

Lock LP tokens for a defined period to demonstrate long-term liquidity commitment to your community. Lock duration can be extended but never shortened — enforced at the contract level. All active locks are publicly queryable on-chain.

- **Forked from:** [Unicrypt UNCX Locker](https://github.com/UNCLE-NC/UNCLE-NC-LOCKER/blob/main/contracts/UNCXLocker.sol)

## Token Vesting

Create on-chain vesting schedules for team allocations, investor distributions, and advisor grants. Linear or cliff+linear release schedules. Once funded, tokens vest according to the schedule regardless of the deployer's actions — no claw-back mechanism.

- **Forked from:** [OpenZeppelin VestingWallet](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/finance/VestingWallet.sol)

## Airdrop Tool

Distribute tokens to hundreds of addresses in a single atomic transaction. Supports both ERC-20 tokens and native zkLTC. All transfers execute atomically — either every recipient gets their amount, or the entire batch reverts.

- **Forked from:** [Disperse.app](https://github.com/Dispersao/disperse-contracts/blob/master/contracts/Disperse.sol)

## Governance

Off-chain proposal creation and token-weighted voting using the Snapshot protocol — entirely gas-free. Proposals use snapshot blocks to prevent last-minute vote manipulation. Results are stored on IPFS and publicly verifiable by anyone.

- **Forked from:** [Snapshot](https://github.com/snapshot-labs/snapshot-strategies)

## Launchpad

Community presales (ILOs) with automatic LP creation and locking at finalization. Projects deposit tokens, accept zkLTC contributions, and launch with locked liquidity in a single finalize transaction. Soft cap protection ensures contributors can always refund if the raise doesn't meet its minimum.

- **Forked from:** [Unicrypt ILO](https://www.unicrypt.network/ilo)

## Quick Start

1. Connect your wallet (MetaMask or any WalletConnect-compatible wallet)
2. Switch to LitVM network using the testnet parameters above
3. Choose a utility
4. Configure parameters and confirm the transaction

## Contract Addresses

| Contract | Address |
|---|---|
| Token Factory | `0x93acc61fcdc2e3407A0c03450Adfd8aE78964948` |
| Liquidity Locker | `0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9` |
| Vesting Factory | Pending deployment |
| Airdrop (Disperse) | Pending deployment |
| ILO Factory (Launchpad) | `0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB` |

## Security

All Lester-Labs contracts are forked 1:1 from industry-standard, battle-tested sources. No custom logic has been introduced. This design decision eliminates novel attack surface and inherits the security properties of contracts that have secured billions of dollars across multiple chains.

| Contract | Source |
|---|---|
| Token Factory | OpenZeppelin ERC-20 |
| Liquidity Locker | Unicrypt UNCX Locker |
| Token Vesting | OpenZeppelin VestingWallet |
| Airdrop Tool | Disperse.app |
| Governance | Snapshot / EIP-712 |
| Launchpad | Unicrypt ILO |

## Support

- X: [@lesterlabshq](https://x.com/lesterlabshq)
- Website: [lester-labs.com](https://lester-labs.com)
