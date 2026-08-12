# DEX Swap & Pool

The Lester Labs DEX supports ERC-20 pairs, native `zkLTC` wrapping, token swaps,
and liquidity management on LitVM testnet.

## Contracts

| Contract | Address |
|---|---|
| Factory | `0x301D649fE86d5CAE665944B3C7942bF9f29B81Ca` |
| Router | `0xf2CA3a3A42136Fd103346914A37b30f3991315EA` |
| Wrapped zkLTC | `0xA13C8Ea8E4084AeEbcdb1B951dEDF2d641567ed0` |

## Swap flow

1. Select the input and output assets.
2. Enter an input amount and review the quoted output.
3. Set slippage tolerance and a transaction deadline.
4. Approve the Router when the input is an ERC-20 token.
5. Submit the swap and confirm the final amounts in the receipt.

Quotes use current pool reserves. They can change before a transaction is
included, so the Router enforces `amountOutMin`, `amountInMax`, and `deadline`
parameters supplied by the interface.

## Router swap functions

| Function | Use |
|---|---|
| `swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)` | Exact token input for token output |
| `swapTokensForExactTokens(amountOut, amountInMax, path, to, deadline)` | Token input capped for an exact token output |
| `swapExactETHForTokens(amountOutMin, path, to, deadline)` | Exact native input for token output |
| `swapTokensForExactETH(amountOut, amountInMax, path, to, deadline)` | Token input capped for exact native output |
| `swapExactTokensForETH(amountIn, amountOutMin, path, to, deadline)` | Exact token input for native output |
| `swapETHForExactTokens(amountOut, path, to, deadline)` | Native input for exact token output |
| `getAmountsOut(amountIn, path)` | Returns quoted outputs for a route |
| `getAmountsIn(amountOut, path)` | Returns quoted inputs for a route |

Fee-on-transfer variants are also available for exact-input routes.

## Liquidity functions

| Function | Use |
|---|---|
| `addLiquidity(...)` | Adds two ERC-20 assets to a pool |
| `addLiquidityETH(...)` | Adds an ERC-20 asset and native `zkLTC` |
| `removeLiquidity(...)` | Burns LP tokens and returns both ERC-20 assets |
| `removeLiquidityETH(...)` | Burns LP tokens and returns an ERC-20 asset plus native `zkLTC` |
| `removeLiquidityWithPermit(...)` | Removes liquidity using an LP-token permit signature |

Adding liquidity creates an LP-token position representing a proportional
share of the pool. Removing liquidity requires an LP-token approval or permit.

## Factory and pair functions

| Contract | Function | Description |
|---|---|---|
| Factory | `createPair(tokenA, tokenB)` | Creates a pair for two tokens |
| Factory | `getPair(tokenA, tokenB)` | Returns the pair address |
| Factory | `allPairsLength()` | Returns the number of pairs |
| Pair | `getReserves()` | Returns the current reserves and timestamp |
| Pair | `token0()` / `token1()` | Returns the pair assets |
| Pair | `totalSupply()` / `balanceOf(account)` | Reads LP-token supply and balances |

## Fee model

Swaps apply an effective `0.30%` input fee: `0.20%` is routed to the configured
protocol recipient and approximately `0.10%` remains in the pool. Router quote
functions use the corresponding `997/1000` calculation.

## Network configuration

```json
{
  "chainId": "0x1159",
  "chainName": "LitVM LiteForge",
  "nativeCurrency": { "name": "zkLTC", "symbol": "zkLTC", "decimals": 18 },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/http"],
  "blockExplorerUrls": ["https://liteforge.explorer.caldera.xyz"]
}
```
