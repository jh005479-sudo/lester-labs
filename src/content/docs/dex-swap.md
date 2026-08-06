# LitVM DEX — Legacy Recovery and Replacement Readiness

> **Current status:** the factory, router, and wrapped-native contract currently
> visible in the application are compromised legacy deployments. New swaps,
> token approvals for trading, wrapping, pool creation, and liquidity additions
> are disabled. Only source-pinned, runtime-authenticated withdrawal paths for
> existing LP or wrapped-native positions may remain available.

## Why the legacy DEX is retired

The legacy V2 pair does not use canonical Uniswap V2 fee behavior. It directly
transfers `0.20%` of measured swap input to mutable factory `feeTo` and retains
approximately `0.10%` in-pool. This extra input-token recipient is not an
arbitrary wallet drain by itself, but it resembles transaction-scanner drainer
patterns and could be redirected by the compromised `feeToSetter` authority.

The legacy deployment tuple is:

| Contract | Recovery-only address |
|---|---|
| Factory | `0x017A126A44Aaae9273F7963D4E295F0Ee2793AD8` |
| Router | `0xD56a623890b083d876D47c3b1c5343b7f983FA62` |
| Wrapped zkLTC | `0xd141A5DDE1a3A373B7e9bb603362A58793AB9D97` |
| Launchpad connector | `0x720A547a29F1C86E0Ef0BE5864FAF14a69E894fD` |

These addresses are historical references, not approved current targets. The
connector immutably embeds the retired treasury and must never be reused.

## Existing-position recovery

Replacing a DEX does not migrate old LP tokens. An LP token remains a claim on
its original pair, and recovery may require the exact original router.

1. Use only a factory/router/wrapped-native tuple in the reviewed, source-pinned
   legacy recovery registry.
2. Verify all three exact runtime hashes. Read `token0()` and `token1()` from the
   LP pair and confirm the legacy factory's `getPair(token0, token1)` returns
   that exact address.
3. Confirm the legacy router's `factory()` and `WETH()` values match the same
   registry entry.
4. Read current reserves, choose explicit minimum outputs, use a short deadline,
   and set the connected wallet as recipient.
5. Approve only the exact LP amount immediately before a source-pinned
   `removeLiquidity` or `removeLiquidityETH` call. Revoke any residual allowance.

Never swap, wrap, add liquidity, create a pool, or grant a reusable token
allowance to a retired router. If the tuple is not source-pinned, the
application must not construct a transaction for it.

Existing wrapped-native withdrawal is similarly limited to an authenticated
`withdraw(amount)` call against the exact source-pinned legacy wrapper. New
wrapping remains disabled.

## Read-only quotes and charts

Router quotes and pair reserves are untrusted read-only inputs from legacy
contracts. A reserve ratio is not an oracle price, USD valuation, fair value,
or promise that a swap can safely execute. The chart view loads at most the 72
newest factory pairs and up to 80 recent `Sync` points within a bounded
30,000-block lookback. It is not a complete DEX index.

## Replacement design

The prepared replacement restores canonical Uniswap V2 economics: the
`997/1000` invariant keeps the swap fee in the pool, and an enabled protocol fee
is realized through the standard one-sixth LP-token mint on a later liquidity
event. It does not directly transfer a fixed fraction of every input token to
`feeTo`.

Replacement governance deliberately separates:

- factory `feeTo` → approved **treasury** (economic recipient);
- factory `feeToSetter` → distinct approved **controller** (administrative authority);
- deployment transactions → distinct single-use gas EOA.

The router adds a monotonic successful public-router swap-action counter for
first-party continuity analytics. It counts one successful public router call,
regardless of hop count, and excludes direct pair swaps. That extension does not
change pair accounting.

No replacement is active until factory, router, wrapper, pair init-code/runtime,
constructor inputs, role assignments, and the clean served frontend are all
independently attested and source-pinned.

## Network configuration

```json
{
  "chainId": "0x1159",
  "chainName": "LitVM LiteForge",
  "nativeCurrency": {
    "name": "zkLTC",
    "symbol": "zkLTC",
    "decimals": 18
  },
  "rpcUrls": ["https://liteforge.rpc.caldera.xyz/http"],
  "blockExplorerUrls": ["https://liteforge.explorer.caldera.xyz"]
}
```

Cross-check network values through LitVM's independently located official
documentation before adding them to a wallet.

## Sources

- [Uniswap v2-core](https://github.com/Uniswap/v2-core)
- [Uniswap v2-periphery](https://github.com/Uniswap/v2-periphery)

Upstream provenance is not an audit of the Lester fork, deployment, frontend,
or role configuration.
