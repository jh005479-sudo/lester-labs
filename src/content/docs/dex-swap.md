# LitVM DEX Swap & Pool — Native Token Trading on LitVM

## Overview

The Lester Labs DEX is the native LitVM decentralized exchange: a self-deployed Uniswap V2 instance on LitVM that powers token swaps, liquidity provision, and Launchpad LP seeding without any external venue dependency. The `/swap` page provides a direct trading interface for native zkLTC and any ERC-20 token deployed on LitVM. The `/pool` page gives a lightweight view of LP positions for any connected wallet.

This LitVM DEX is not a third-party integration or a bridge-dependent pair. Quotes, swaps, pair discovery, and launchpad liquidity seeding all resolve against Lester Labs-owned factory and router contracts deployed on LitVM.

## How it works

The swap page reads the token universe from Lester Labs token metadata, fetches live quotes from the Lester Labs Uniswap V2 router using `getAmountsOut`, and submits swaps through the standard V2 router methods:

- `swapExactETHForTokens`
- `swapExactTokensForETH`
- `swapExactTokensForTokens`

Native zkLTC is represented on the router side by a wrapped zkLTC contract, but the UI continues to present it as the native asset.

## User Flow

1. Connect your wallet and switch to LitVM testnet (`4441`)
2. Select an input token and output token on `/swap`
3. Approve the router if your input token is an ERC-20
4. Review the live quote, fee line, and slippage handling
5. Confirm the swap and track the transaction in the status modal
6. Visit `/pool` to view LP balances and underlying exposure

## Fee Structure

| Fee Recipient | Amount |
|---|---|
| Lester Labs treasury | `0.20%` of each trade |
| Liquidity providers | `0.10%` retained in-pool |
| **Total paid per trade** | **`0.30%`** |

## Contracts

| Contract | Purpose | LitVM testnet address |
|---|---|---|
| Uniswap V2 Factory | Pair creation and fee destination | `0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8` |
| Uniswap V2 Router02 | Swaps and LP operations | `0xD56a623890b083d876D47c3b1c5343b7f983FA62` |
| Wrapped zkLTC | Native-asset wrapper for router compatibility | `0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97` |
| UniSwapConnector | Launchpad-to-DEX liquidity bridge | `0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD` |

The Launchpad finalization path shares the same infrastructure. When an ILO finalizes, `UniSwapConnector` checks the factory configuration before adding liquidity, so newly launched pairs and manually created pairs live on the same DEX.

## Frontend Behavior

- Token selection and wallet connection follow the existing Lester Labs form patterns
- Quotes come from the router, not from a hosted pricing API
- ERC-20 approvals are handled inline before the swap transaction
- Transaction progress is surfaced through the shared `TxStatusModal`
- The `/pool` page scans factory pairs and shows LP balances, pool share, and token exposure

## Network Configuration

```json
{
  "chainId": "0x1159",
  "chainName": "LitVM Testnet",
  "nativeCurrency": {
    "name": "zkLTC",
    "symbol": "zkLTC",
    "decimals": 18
  },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/infra-partner-http"],
  "blockExplorerUrls": ["https://liteforge.caldera.xyz"]
}
```

## Security Notes

- Runtime contract calls go through Lester Labs-owned deployments only
- The factory constructor pins both `feeTo` and `feeToSetter` to the Lester Labs treasury
- The pair contract routes `0.20%` of swap input directly to treasury and keeps `0.10%` in-pool for LPs
- `UniSwapConnector` refuses to seed launch liquidity if treasury routing has drifted away from the expected wallet

## Sources

- [Uniswap v2-core](https://github.com/Uniswap/v2-core)
- [Uniswap v2-periphery](https://github.com/Uniswap/v2-periphery)
