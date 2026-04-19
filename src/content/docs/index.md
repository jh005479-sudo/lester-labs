# Lester-Labs Documentation

Lester Labs is a self-serve DeFi suite built natively for LitVM, the Liteforge testnet (chain ID `4441`). The platform covers token deployment, community launches, treasury-routed swapping, liquidity visibility, governance, and analytics without relying on an external DEX at runtime.

## Utilities

| Utility | Purpose | Fee |
|---|---|---|
| [Token Factory](./token-factory.md) | Deploy ERC-20 tokens | 0.05 zkLTC |
| [Liquidity Locker](./liquidity-locker.md) | Lock LP tokens | 0.03 zkLTC |
| [Token Vesting](./token-vesting.md) | Vesting schedules for teams and investors | 0.03 zkLTC |
| [Airdrop Tool](./airdrop-tool.md) | Bulk token or native-asset distribution | 0.01 zkLTC / batch |
| [Governance](./governance.md) | Proposal and voting infrastructure | Varies by action |
| [Launchpad](./launchpad.md) | Community presales with automatic LP seeding | 0.03 zkLTC + 2% of raise |
| [DEX Swap & Pool](./dex-swap.md) | Swap assets and inspect LP positions on Lester Labs V2 | 0.30% per trade / gas only for viewing |
| [The Ledger](./ledger.md) | Post permanent on-chain messages | Protocol-defined posting fee |

## DEX and Launchpad Integration

Lester Labs now ships its own Uniswap V2 deployment for LitVM. The local factory and router power both the `/swap` trading flow and Launchpad finalization, so ILOs seed liquidity into Lester Labs-owned infrastructure instead of an external venue.

The fee split is enforced on-chain in the pair contract:

- Total fee per swap: `0.30%`
- Treasury share: `0.20%`
- LP share retained in-pool: `0.10%`

Launchpad finalization uses `UniSwapConnector`, which re-checks that both factory `feeTo` and `feeToSetter` still point at the Lester Labs treasury before liquidity can be seeded.

## Analytics

The analytics dashboard is the visibility layer for the broader Lester Labs stack:

- **Trending** tracks short-term token momentum and transfer activity
- **Tokens** indexes deployed LitVM tokens and classifies pair contracts
- **Health** surfaces chain throughput, block timing, and active-address trends
- **DEX** summarizes pair-level volume, TVL, and recent swap activity
- **Bridge** tracks capital moving into and out of LitVM
- **Smart Money** highlights large wallets, LP activity, and notable moves

Live at [lester-labs.com/analytics](https://lester-labs.com/analytics).

## Network Configuration

| Parameter | LitVM Testnet (Liteforge) |
|---|---|
| Chain ID | `4441` |
| RPC URL | `https://liteforge.rpc.caldera.xyz/infra-partner-http` |
| Explorer | `https://liteforge.caldera.xyz` |
| Native Token | `zkLTC` |
| Wrapped Native | `Wrapped zkLTC` (deployed alongside the Lester Labs V2 router) |

## Quick Start

1. Connect your wallet to LitVM using the network configuration above.
2. Deploy a token at `/launch`, or open `/swap` if you already hold tradable assets.
3. Use `/launchpad` to run a raise that seeds LP on Lester Labs at finalization.
4. Review LP balances and exposure on `/pool`.
5. Use the docs and tutorials pages for walkthroughs and contract references.

## Contract Addresses

| Contract | Address |
|---|---|
| Token Factory | `0x93acc61fcdc2e3407A0c03450Adfd8aE78964948` |
| Liquidity Locker | `0x80d88C7F529D256e5e6A2CB0e0C30D82bC8827A9` |
| ILO Factory | `0xA533bBe87bdCD91e4367de517e99bf8BA75Fd0aB` |
| LitGovToken | `0xa5111cedc04554676DbCCA39F2268070008C7A8A` |
| LitGovernor | `0x5b0092996BA897617B46D42B3F108B253be9Ad3d` |
| LitTimelock | `0xd38ed693730Db3eB22bA6d6F0050FC45Ac9240ba` |
| Uniswap V2 Factory | Pending deployment |
| Uniswap V2 Router | Pending deployment |
| Wrapped zkLTC | Pending deployment |
| UniSwapConnector | Pending deployment |

## Security Notes

Most Lester Labs contracts are based on battle-tested upstream implementations from OpenZeppelin, Unicrypt, Disperse, and Uniswap. Where Lester Labs adds custom behavior, the changes are intentionally narrow and tied to platform requirements:

- the V2 pair contract routes `0.20%` of each trade input directly to the Lester Labs treasury
- the factory constructor pins both `feeTo` and `feeToSetter` to the Lester Labs treasury
- the Launchpad connector refuses to seed liquidity if treasury routing drifts from the configured treasury

Always verify the chain, contract address, and token pair before transacting.

## Support

- X: [@lesterlabshq](https://x.com/lesterlabshq)
- Website: [lester-labs.com](https://lester-labs.com)
