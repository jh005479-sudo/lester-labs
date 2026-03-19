# Lester-Labs Documentation

Lester-Labs is a self-service DeFi utility suite built natively for LitVM — a ZK-SNARK verified Bitcoin L2 with zkLTC as its native token. Six permissionless tools covering the full project lifecycle, from token creation through community launches. No sign-ups, no admin approvals, no custom contract logic.

## Utilities

| Utility | Purpose | Fee |
|---|---|---|
| [Token Factory](./token-factory.md) | Deploy ERC-20 tokens | 0.05 zkLTC |
| [Liquidity Locker](./liquidity-locker.md) | Lock LP tokens | 0.03 zkLTC |
| [Token Vesting](./token-vesting.md) | Vesting schedules for teams & investors | 0.03 zkLTC |
| [Airdrop Tool](./airdrop-tool.md) | Bulk token distribution | 0.01 zkLTC/batch |
| [Governance](./governance.md) | Off-chain proposals and voting | Free |
| [Launchpad](./launchpad.md) | Community presales with automatic LP | 0.03 zkLTC + 2% of raise |

## Network Configuration

**Testnet (current):** Arbitrum Sepolia is used as the proxy chain while LitVM testnet is in development. Chain constants will be updated when LitVM publishes its testnet parameters.

| Parameter | Arbitrum Sepolia (Testnet) | LitVM (Mainnet) |
|---|---|---|
| Chain ID | 421614 | TBA |
| RPC URL | https://sepolia-rollup.arbitrum.io/rpc | https://rpc.litvm.io |
| Explorer | https://sepolia.arbiscan.io | https://explorer.litvm.io |
| Native Token | ETH (testnet) | zkLTC |
| Faucet | https://www.alchemy.com/faucets/arbitrum-sepolia | N/A |

## Quick Start

1. Connect your wallet (MetaMask or any WalletConnect-compatible wallet)
2. Switch to LitVM network (or Arbitrum Sepolia for testnet)
3. Choose a utility
4. Configure parameters and confirm the transaction

## Contract Addresses

| Contract | Address |
|---|---|
| Token Factory | Pending deployment — testnet launching soon |
| Liquidity Locker | Pending deployment — testnet launching soon |
| Vesting Factory | Pending deployment — testnet launching soon |
| Airdrop (Disperse) | Pending deployment — testnet launching soon |
| ILO Factory (Launchpad) | Pending deployment — testnet launching soon |

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

- Twitter: [@LesterLabs](#) *(coming soon)*
- GitHub: [github.com/jh005479-sudo/lester-labs](https://github.com/jh005479-sudo/lester-labs)
- Website: [lester-labs.com](https://lester-labs.com)
