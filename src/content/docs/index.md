# Lester Labs Documentation

Lester Labs is a DeFi suite for creating tokens, distributing assets, managing
vesting and liquidity locks, launching token sales, swapping assets, and
publishing on-chain messages on LitVM testnet.

## Quick start

1. Add LitVM LiteForge to your browser wallet.
2. Obtain test `zkLTC` for transaction fees.
3. Open a Lester Labs tool and connect your wallet.
4. Enter the required contract parameters and review the transaction preview.
5. Confirm the transaction and follow its status in the LitVM explorer.

## Network configuration

| Parameter | Value |
|---|---|
| Network | LitVM LiteForge |
| Chain ID | `4441` (`0x1159`) |
| RPC URL | `https://liteforge.rpc.caldera.xyz/http` |
| Explorer | `https://liteforge.explorer.caldera.xyz` |
| Native test token | `zkLTC` |

## Contract directory

| Contract | Address |
|---|---|
| Wrapped zkLTC | `0xA13C8Ea8E4084AeEbcdb1B951dEDF2d641567ed0` |
| DEX Factory | `0x301D649fE86d5CAE665944B3C7942bF9f29B81Ca` |
| DEX Router | `0xf2CA3a3A42136Fd103346914A37b30f3991315EA` |
| DEX Connector | `0xbB4e527216ac0e0709Bf57ff718ca417ba85AaDF` |
| Token Factory | `0x1A098a86d4C73b44d38e40711e0dd869591B4F60` |
| Vesting Factory | `0x1808852Ce3EBbD2242174Eea672498a384108E2d` |
| Liquidity Locker | `0xEfE43FB51a3219B35Ffc30e508e14003752fc18f` |
| Airdrop / Disperse | `0x80Cc00444Ac78959520052A3333184C5E81B0EA5` |
| Launchpad Factory | `0x412e29e77500752A7B62489c0FaAE6560E8c4380` |
| Ledger | `0xEdf195A557EaAE7829f867d6f84316908A65D9B1` |
| Governance Token | `0x7c1A67Ec89c22b8a738DD881289576102306219C` |
| Governance Timelock | `0x17Ddf4d2e7C0789f600d4f7182785e9E193b44aA` |
| Governor | `0x05e29e239C6e40EcF9639781bba5D558b9f98305` |

## Suite overview

| Tool | Primary operations |
|---|---|
| Token Factory | Create ERC-20 tokens with optional mint, burn, and pause features |
| Airdrop | Send native or ERC-20 assets to multiple recipients |
| Vesting | Create token vesting schedules and release vested tokens |
| Liquidity Locker | Lock LP tokens until a selected timestamp |
| DEX | Create pairs, add or remove liquidity, and swap assets |
| Launchpad | Create and manage token sales with liquidity provisioning |
| Ledger | Publish and browse short on-chain messages |
| Governance | Browse governance contracts and draft proposals |

## Contract interaction conventions

- Token amounts use base units. Convert display amounts using the token's
  `decimals()` value.
- Times are Unix timestamps in seconds.
- Percentages are generally expressed in basis points: `100` is 1% and
  `10,000` is 100%.
- Token-moving functions usually require an ERC-20 `approve()` transaction
  before the main contract call.
- Swap and liquidity functions require minimum output values and a deadline.
- Testnet transactions and assets are for development and testing only.

## Support

- X: [@lesterlabshq](https://x.com/lesterlabshq)
- Website: [www.lester-labs.com](https://www.lester-labs.com)
